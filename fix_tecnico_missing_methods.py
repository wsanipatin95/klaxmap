#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KLAXMAP - Fix build técnico embed.

Corrige los TS2339 generados en el commit técnicos:
  - openCreateDialogFromDraft no existe
  - crearElementoTecnico no existe
  - loadTecnicoCatalogos no existe
  - filterTecnicoTipos no existe

Ejecutar desde la raíz de klaxmap:

    python fix_tecnico_missing_methods.py --dry-run
    python fix_tecnico_missing_methods.py
    npm run build
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path


HELPER_METHODS = r"""
  openCreateDialogFromDraft() {
    const mode = this.draftMode();
    const points = this.draftPoints();

    if (mode === 'none') {
      return;
    }

    if (mode === 'box' && points.length !== 1) {
      this.createError.set('Marca un punto en el mapa para la caja/NAP.');
      return;
    }

    if (mode === 'fiber' && points.length < 2) {
      this.createError.set('Marca al menos dos puntos para el tendido de fibra.');
      return;
    }

    const geomTipo: MapaGeomTipo = mode === 'box' ? 'point' : 'linestring';
    const wkt = mode === 'box' ? this.pointWkt(points[0]) : this.lineWkt(points);
    const title = mode === 'box' ? 'Nueva caja / NAP' : 'Nuevo tendido de fibra';
    const defaultNombre = mode === 'box' ? 'Caja / NAP' : 'Tendido de fibra';

    this.loadTecnicoCatalogos();

    this.createDialog?.open({
      wkt,
      geomTipo,
      nodoId: null,
      title,
      defaultNombre,
      defaultDescripcion: this.buildDefaultCreateDescription(mode),
    });
  }

  crearElementoTecnico(payload: MapaElementoSaveRequest) {
    const mode = this.draftMode();
    const points = this.draftPoints();
    const ctx = this.context();

    const enriched: MapaElementoSaveRequest = {
      ...payload,
      origen: 'embed_tecnico',
      origenRef: ctx?.trabajoId != null ? String(ctx.trabajoId) : payload.origenRef ?? null,
      latLon: mode === 'box' && points[0] ? `${points[0].lat},${points[0].lng}` : payload.latLon ?? null,
      atributos: {
        ...(payload.atributos ?? {}),
        embed: true,
        embedMode: this.mode(),
        draftMode: mode,
        trabajoId: ctx?.trabajoId ?? null,
        clienteId: ctx?.clienteId ?? null,
        ordenId: ctx?.ordenId ?? null,
        metadata: (ctx?.metadata ?? null) as any,
      } as any,
    };

    this.createDialog?.markSaving();
    this.saving.set(true);
    this.createError.set(null);

    this.elementosApi.crear(enriched).subscribe({
      next: (resp) => {
        this.saving.set(false);

        try {
          const created = unwrapOrThrow<MapaElemento>(resp);

          this.createDialog?.handleSaveSuccess();

          if (mode === 'box') {
            this.messaging.boxCreated(created);
          }

          if (mode === 'fiber') {
            this.messaging.fiberCreated(created);
          }

          this.clearDraft();
          this.refreshNearby();
        } catch (err: any) {
          const message = err?.message || 'No se pudo crear el elemento.';
          this.createError.set(message);
          this.createDialog?.handleSaveError(message);
        }
      },
      error: (err) => {
        this.saving.set(false);
        const message = err?.error?.mensaje || err?.message || 'No se pudo crear el elemento.';
        this.createError.set(message);
        this.createDialog?.handleSaveError(message);
      },
    });
  }

  private loadTecnicoCatalogos() {
    if (this.nodos().length === 0) {
      this.crud.loadNodos();
    }

    if (this.tipos().length === 0) {
      this.crud.loadTipos();
    }
  }

  private filterTecnicoTipos(tipos: MapaTipoElemento[]) {
    const allowed = new Set((this.config()?.tiposElemento ?? []).filter((id) => Number(id) > 0));

    return tipos.filter((tipo) => {
      if (!tipo.activo) {
        return false;
      }

      if (allowed.size === 0) {
        return true;
      }

      return allowed.has(tipo.idGeoTipoElemento);
    });
  }

  private buildDefaultCreateDescription(mode: DraftMode) {
    const ctx = this.context();
    const parts: string[] = [];

    if (mode === 'box') {
      parts.push('Creado desde mapa técnico.');
    }

    if (mode === 'fiber') {
      parts.push('Tendido dibujado desde mapa técnico.');
    }

    if (ctx?.trabajoId != null) {
      parts.push(`Trabajo: ${ctx.trabajoId}`);
    }

    if (ctx?.ordenId != null) {
      parts.push(`Orden: ${ctx.ordenId}`);
    }

    if (ctx?.clienteId != null) {
      parts.push(`Cliente: ${ctx.clienteId}`);
    }

    return parts.join(' | ');
  }
""".strip()


def backup(path: Path, dry_run: bool) -> None:
    if dry_run:
        return

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak_tecnico_missing_methods_{stamp}")
    shutil.copy2(path, backup_path)
    print(f"backup: {backup_path.relative_to(Path.cwd())}")


def cleanup_backups(root: Path, dry_run: bool) -> None:
    patterns = [
        "*.bak_tecnico_modal_*",
        "*.bak_tecnico_missing_methods_*",
        "*.bak_mobile_v2_*",
        "*.bak_final_vendedor_*",
        "*.bak_vendedor_ui_*",
        "*.bak_admin_style_embed_*",
        "*.bak_compact_embed_*",
        "*.bak_embed_ux_*",
        "*.bak_embed_front_*",
        "*.bak_fix_embed_*",
    ]

    for pattern in patterns:
        for path in (root / "src").rglob(pattern):
            if not path.is_file():
                continue

            rel = path.relative_to(root)
            if dry_run:
                print(f"[dry-run] eliminar backup: {rel}")
            else:
                path.unlink()
                print(f"eliminado backup: {rel}")


def patch_viewer_ts(root: Path, dry_run: bool) -> bool:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.ts"

    if not path.exists():
        raise SystemExit(f"No existe {path}")

    text = path.read_text(encoding="utf-8")

    if "  openCreateDialogFromDraft() {" in text and "  private filterTecnicoTipos(" in text:
        print("Los métodos técnicos ya existen. No se modifica TS.")
        return False

    marker = "  private authenticate("
    idx = text.find(marker)

    if idx < 0:
      raise SystemExit("No pude ubicar 'private authenticate(' para insertar los métodos técnicos.")

    new_text = text[:idx] + HELPER_METHODS + "\n\n" + text[idx:]

    if dry_run:
        print(f"[dry-run] insertar métodos técnicos en: {path.relative_to(root)}")
        return True

    backup(path, dry_run=False)
    path.write_text(new_text, encoding="utf-8")
    print(f"ok: métodos técnicos insertados en {path.relative_to(root)}")
    return True


def remove_installer_files(root: Path, dry_run: bool) -> None:
    names = [
        "fix_embed_tecnico_modal_admin.py",
        "install_embed_admin_style_patch.py",
        "install_embed_compact_classic_patch.py",
        "install_embed_viewer_ux_patch.py",
        "install_mapa_embed_frontend.py",
    ]

    for name in names:
        path = root / name
        if not path.exists() or not path.is_file():
            continue

        if dry_run:
            print(f"[dry-run] eliminar temporal: {name}")
        else:
            path.unlink()
            print(f"eliminado temporal: {name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path.cwd()

    if not (root / "package.json").exists():
        raise SystemExit("No encontré package.json. Ejecuta desde la raíz de klaxmap.")

    print(f"Repo: {root}")
    print(f"Modo: {'dry-run' if args.dry_run else 'aplicar'}")
    print("")

    patch_viewer_ts(root, args.dry_run)
    cleanup_backups(root, args.dry_run)
    remove_installer_files(root, args.dry_run)

    print("")
    print("Siguiente:")
    print("  npm run build")
    print("  git status")
    print("  git add -A")
    print('  git commit -m "fix: agregar metodos tecnico embed"')
    print("  git push")


if __name__ == "__main__":
    main()
