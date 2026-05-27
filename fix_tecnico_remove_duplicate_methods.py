#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KLAXMAP - Limpieza de métodos técnicos duplicados.

Ejecutar desde la raíz de klaxmap:

    python fix_tecnico_remove_duplicate_methods.py --dry-run
    python fix_tecnico_remove_duplicate_methods.py
    npm run build

Qué hace:
  1. Elimina TODAS las implementaciones duplicadas de:
     - openCreateDialogFromDraft
     - crearElementoTecnico
     - loadTecnicoCatalogos
     - filterTecnicoTipos
     - buildDefaultCreateDescription

  2. Inserta UNA SOLA implementación correcta antes de private authenticate().

  3. Reemplaza redrawDraft() por la versión que pinta:
     - pin visible para caja/NAP
     - línea azul + vértices numerados para fibra

  4. Elimina el botón Cancelar/X del panel lateral técnico si existe.

  5. Limpia backups/instaladores temporales.
"""

from __future__ import annotations

import argparse
import re
import shutil
from datetime import datetime
from pathlib import Path


METHOD_NAMES = [
    "openCreateDialogFromDraft",
    "crearElementoTecnico",
    "loadTecnicoCatalogos",
    "filterTecnicoTipos",
    "buildDefaultCreateDescription",
]


CANONICAL_METHODS = r"""
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
    // tipos_elemento_tecnico filtra lo visible/cercano.
    // Para crear, se usan todos los tipos activos y el modal administrativo
    // filtra por geometría permitida: point, linestring, polygon o mixed.
    return tipos.filter((tipo) => tipo.activo);
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


REDRAW_DRAFT = r"""
  private redrawDraft() {
    this.draftLayer?.clearLayers();

    if (!this.draftLayer) {
      return;
    }

    const mode = this.draftMode();
    const points = this.draftPoints();

    if (!points.length) {
      return;
    }

    if (mode === 'fiber' && points.length >= 2) {
      const latLngs = points.map((p) => [p.lat, p.lng] as L.LatLngExpression);

      L.polyline(latLngs, {
        color: '#ffffff',
        weight: 7,
        opacity: 0.82,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(this.draftLayer);

      L.polyline(latLngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.96,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(this.draftLayer);
    }

    points.forEach((point, index) => {
      L.marker([point.lat, point.lng], {
        icon: this.createDraftPointIcon(index, mode),
        zIndexOffset: 2600 + index,
      }).addTo(this.draftLayer!);
    });
  }

  private createDraftPointIcon(index: number, mode: DraftMode): L.DivIcon {
    if (mode === 'box') {
      return L.divIcon({
        className: 'mapa-embed-draft-icon-host',
        html: `
          <div class="mapa-embed-draft-pin">
            <i class="pi pi-map-marker"></i>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 32],
      });
    }

    return L.divIcon({
      className: 'mapa-embed-draft-icon-host',
      html: `
        <div class="mapa-embed-draft-vertex">
          <span>${index + 1}</span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
""".strip()


SCSS_APPEND = r"""
/* Técnico: dibujo tipo admin, con puntos y línea visibles */
.mapa-embed-draft-icon-host {
  background: transparent;
  border: 0;
}

.mapa-embed-draft-pin {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px 999px 999px 0.35rem;
  transform: rotate(-45deg);
  background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
  border: 3px solid #ffffff;
  color: #ffffff;
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, 0.18),
    0 10px 22px rgba(2, 6, 23, 0.28);
}

.mapa-embed-draft-pin i {
  transform: rotate(45deg);
  font-size: 0.9rem;
}

.mapa-embed-draft-vertex {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 3px solid #ffffff;
  background: #2563eb;
  color: #ffffff;
  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.18),
    0 8px 18px rgba(2, 6, 23, 0.24);
}

.mapa-embed-draft-vertex span {
  font-size: 0.62rem;
  font-weight: 900;
  line-height: 1;
}

.embed-tech-state .edit-action:has(.pi-times) {
  display: none !important;
}
""".strip()


def backup(path: Path, dry_run: bool) -> None:
    if dry_run or not path.exists():
        return

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak_dedup_tecnico_{stamp}")
    shutil.copy2(path, backup_path)
    print(f"backup: {backup_path.relative_to(Path.cwd())}")


def find_method_start(text: str, method_name: str, start: int = 0) -> int:
    # Soporta:
    #   openCreateDialogFromDraft() {
    #   private filterTecnicoTipos(...) {
    #   public/private sin importar indentación.
    pattern = re.compile(
        rf"(?m)^[ \t]*(?:public\s+|private\s+|protected\s+)?{re.escape(method_name)}\s*\("
    )
    match = pattern.search(text, start)
    return -1 if not match else match.start()


def find_method_end(text: str, start: int) -> int:
    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"No encontré apertura de método cerca de {start}")

    depth = 0
    in_string: str | None = None
    escape = False
    in_line_comment = False
    in_block_comment = False

    i = brace
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        if ch in ("'", '"', "`"):
            in_string = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                # Incluye saltos de línea posteriores para no dejar huecos raros.
                end = i + 1
                while end < len(text) and text[end] in " \t\r\n":
                    end += 1
                return end

        i += 1

    raise RuntimeError(f"No encontré cierre de método cerca de {start}")


def remove_all_methods(text: str, method_names: list[str]) -> tuple[str, dict[str, int]]:
    counts = {name: 0 for name in method_names}

    changed = True
    while changed:
        changed = False

        earliest: tuple[int, str] | None = None
        for name in method_names:
            idx = find_method_start(text, name)
            if idx >= 0 and (earliest is None or idx < earliest[0]):
                earliest = (idx, name)

        if earliest is None:
            break

        idx, name = earliest
        end = find_method_end(text, idx)
        text = text[:idx] + text[end:]
        counts[name] += 1
        changed = True

    return text, counts


def insert_methods_before_authenticate(text: str) -> str:
    idx = find_method_start(text, "authenticate")

    if idx < 0:
        raise RuntimeError("No pude ubicar private authenticate() para insertar métodos técnicos.")

    return text[:idx] + CANONICAL_METHODS + "\n\n" + text[idx:]


def replace_method(text: str, method_name: str, replacement: str) -> str:
    idx = find_method_start(text, method_name)

    if idx < 0:
        raise RuntimeError(f"No encontré método {method_name}")

    end = find_method_end(text, idx)
    return text[:idx] + replacement + "\n\n" + text[end:]


def patch_ts(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.ts"

    if not path.exists():
        raise SystemExit(f"No existe {path}")

    text = path.read_text(encoding="utf-8")
    original = text

    text, counts = remove_all_methods(text, METHOD_NAMES)
    text = insert_methods_before_authenticate(text)

    # Unificar redrawDraft. Si no existe, no falla para no romper un estado intermedio raro.
    if find_method_start(text, "redrawDraft") >= 0:
        text = replace_method(text, "redrawDraft", REDRAW_DRAFT)

    if text == original:
        print("TS viewer: sin cambios.")
        return

    if dry_run:
        print(f"[dry-run] parchear TS viewer: {path.relative_to(root)}")
        for name, count in counts.items():
            print(f"  {name}: eliminados {count}, insertado 1")
        return

    backup(path, dry_run=False)
    path.write_text(text, encoding="utf-8")
    print(f"ok TS viewer: {path.relative_to(root)}")
    for name, count in counts.items():
        print(f"  {name}: eliminados {count}, insertado 1")


def patch_html(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.html"

    if not path.exists():
        raise SystemExit(f"No existe {path}")

    text = path.read_text(encoding="utf-8")
    original = text

    # Quitar botón Cancelar del panel lateral técnico; cancelar queda en toolbar.
    text = re.sub(
        r"\n\s*<button\s+type=\"button\"\s+class=\"edit-action\"\s+\(click\)=\"clearDraft\(\)\"[\s\S]*?<span>Cancelar</span>\s*</button>",
        "",
        text,
        count=1,
    )

    if text == original:
        print("HTML viewer: sin cambios.")
        return

    if dry_run:
        print(f"[dry-run] parchear HTML viewer: {path.relative_to(root)}")
        return

    backup(path, dry_run=False)
    path.write_text(text, encoding="utf-8")
    print(f"ok HTML viewer: {path.relative_to(root)}")


def patch_scss(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.scss"

    if not path.exists():
        raise SystemExit(f"No existe {path}")

    text = path.read_text(encoding="utf-8")

    if "Técnico: dibujo tipo admin" in text:
        print("SCSS viewer: estilos técnicos ya existen.")
        return

    if dry_run:
        print(f"[dry-run] parchear SCSS viewer: {path.relative_to(root)}")
        return

    backup(path, dry_run=False)
    path.write_text(text.rstrip() + "\n\n" + SCSS_APPEND + "\n", encoding="utf-8")
    print(f"ok SCSS viewer: {path.relative_to(root)}")


def cleanup(root: Path, dry_run: bool) -> None:
    patterns = [
        "*.bak_dedup_tecnico_*",
        "*.bak_tecnico_draw_admin_*",
        "*.bak_tecnico_missing_methods_*",
        "*.bak_tecnico_modal_*",
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

    temp_files = [
        "fix_tecnico_missing_methods.py",
        "fix_tecnico_draw_like_admin.py",
        "fix_embed_tecnico_modal_admin.py",
        "install_embed_admin_style_patch.py",
        "install_embed_compact_classic_patch.py",
        "install_embed_viewer_ux_patch.py",
        "install_mapa_embed_frontend.py",
    ]

    for name in temp_files:
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

    patch_ts(root, args.dry_run)
    patch_html(root, args.dry_run)
    patch_scss(root, args.dry_run)
    cleanup(root, args.dry_run)

    print("")
    print("Siguiente:")
    print("  npm run build")
    print("  git status")
    print("  git add -A")
    print('  git commit -m "fix: limpiar duplicados tecnico embed"')
    print("  git push")


if __name__ == "__main__":
    main()
