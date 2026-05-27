#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse, re, shutil
from datetime import datetime
from pathlib import Path

HELPERS = r"""
  openCreateDialogFromDraft() {
    const mode = this.draftMode();
    const points = this.draftPoints();

    if (mode === 'none') return;

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

          if (mode === 'box') this.messaging.boxCreated(created);
          if (mode === 'fiber') this.messaging.fiberCreated(created);

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
    if (this.nodos().length === 0) this.crud.loadNodos();
    if (this.tipos().length === 0) this.crud.loadTipos();
  }

  private filterTecnicoTipos(tipos: MapaTipoElemento[]) {
    // tipos_elemento_tecnico filtra visibilidad/cercanos.
    // Para crear, se usan todos los tipos activos; el modal filtra por geometría.
    return tipos.filter((tipo) => tipo.activo);
  }

  private buildDefaultCreateDescription(mode: DraftMode) {
    const ctx = this.context();
    const parts: string[] = [];

    if (mode === 'box') parts.push('Creado desde mapa técnico.');
    if (mode === 'fiber') parts.push('Tendido dibujado desde mapa técnico.');

    if (ctx?.trabajoId != null) parts.push(`Trabajo: ${ctx.trabajoId}`);
    if (ctx?.ordenId != null) parts.push(`Orden: ${ctx.ordenId}`);
    if (ctx?.clienteId != null) parts.push(`Cliente: ${ctx.clienteId}`);

    return parts.join(' | ');
  }
""".strip()

REDRAW = r"""
  private redrawDraft() {
    this.draftLayer?.clearLayers();

    if (!this.draftLayer) return;

    const mode = this.draftMode();
    const points = this.draftPoints();

    if (!points.length) return;

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

SCSS = r"""
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

def backup(path: Path, dry: bool):
    if dry:
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    b = path.with_suffix(path.suffix + f".bak_tecnico_draw_admin_{stamp}")
    shutil.copy2(path, b)
    print("backup:", b.relative_to(Path.cwd()))

def replace_method(text: str, name: str, replacement: str) -> str:
    idx = text.find(f"  {name}(")
    if idx < 0:
        idx = text.find(f"  private {name}(")
    if idx < 0:
        raise RuntimeError(f"No encontré método {name}")
    brace = text.find("{", idx)
    depth = 0
    end = None
    for pos in range(brace, len(text)):
        if text[pos] == "{":
            depth += 1
        elif text[pos] == "}":
            depth -= 1
            if depth == 0:
                end = pos + 1
                break
    if end is None:
        raise RuntimeError(f"No cerró método {name}")
    return text[:idx] + replacement + text[end:]

def insert_before(text: str, method: str, content: str) -> str:
    idx = text.find(f"  private {method}(")
    if idx < 0:
        idx = text.find(f"  {method}(")
    if idx < 0:
        raise RuntimeError(f"No pude ubicar {method}")
    return text[:idx] + content + "\n\n" + text[idx:]

def ensure_imports_and_fields(text: str) -> str:
    if "MapaCrudFacade" not in text:
        text = text.replace(
            "import { MAPA_BASEMAP_OPTIONS, type BasemapKey } from '../../../models/mapa-basemap.models';",
            "import { MAPA_BASEMAP_OPTIONS, type BasemapKey } from '../../../models/mapa-basemap.models';\n"
            "import { MapaCrudFacade } from '../../../application/mapa-crud.facade';\n"
            "import { MapaCreateElementDialogComponent } from '../../../components/mapa-create-element-dialog/mapa-create-element-dialog.component';",
        )
    text = text.replace(
        "import type { MapaElemento, MapaElementoSaveRequest } from '../../../data-access/mapa.models';",
        "import type { MapaElemento, MapaElementoSaveRequest, MapaGeomTipo, MapaTipoElemento } from '../../../data-access/mapa.models';",
    )
    text = text.replace(
        "imports: [CommonModule, FormsModule],",
        "imports: [CommonModule, FormsModule, MapaCreateElementDialogComponent],",
    )
    if "@ViewChild('createDialog')" not in text:
        text = text.replace(
            "  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;",
            "  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;\n"
            "  @ViewChild('createDialog') createDialog?: MapaCreateElementDialogComponent;",
        )
    if "private readonly crud = inject(MapaCrudFacade);" not in text:
        text = text.replace(
            "  private readonly elementosApi = inject(MapaElementosApi);",
            "  private readonly elementosApi = inject(MapaElementosApi);\n"
            "  private readonly crud = inject(MapaCrudFacade);",
        )
    if "readonly nodos = this.crud.nodos;" not in text:
        text = text.replace(
            "  readonly context = this.embedStore.context;\n  readonly config = this.embedStore.config;",
            "  readonly context = this.embedStore.context;\n"
            "  readonly config = this.embedStore.config;\n"
            "  readonly nodos = this.crud.nodos;\n"
            "  readonly tipos = this.crud.tipos;\n"
            "  readonly tecnicoTipos = computed(() => this.filterTecnicoTipos(this.tipos()));",
        )
    return text

def patch_ts(root: Path, dry: bool):
    p = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.ts"
    text = p.read_text(encoding="utf-8")
    old = text
    text = ensure_imports_and_fields(text)
    if "  openCreateDialogFromDraft() {" not in text:
        text = insert_before(text, "authenticate", HELPERS)
    if "  private filterTecnicoTipos(" in text:
        text = replace_method(text, "filterTecnicoTipos", """  private filterTecnicoTipos(tipos: MapaTipoElemento[]) {
    // tipos_elemento_tecnico filtra visibilidad/cercanos.
    // Para crear, se usan todos los tipos activos; el modal filtra por geometría.
    return tipos.filter((tipo) => tipo.activo);
  }""")
    text = replace_method(text, "redrawDraft", REDRAW)
    if "  startCreateBox() {" in text:
        text = replace_method(text, "startCreateBox", """  startCreateBox() {
    if (this.mode() !== 'tecnico') return;
    if (!this.can('puedeCrearCaja') || !this.actionEnabled('create_box')) {
      this.createError.set('No tiene permiso para crear caja.');
      return;
    }

    this.loadTecnicoCatalogos();
    this.draftMode.set('box');
    this.draftPoints.set([]);
    this.createError.set(null);
    this.clearRoute();
    this.redrawDraft();
  }""")
    if "  startDrawFiber() {" in text:
        text = replace_method(text, "startDrawFiber", """  startDrawFiber() {
    if (this.mode() !== 'tecnico') return;
    if (!this.can('puedeCrearFibra') || !this.actionEnabled('draw_fiber')) {
      this.createError.set('No tiene permiso para trazar fibra.');
      return;
    }

    this.loadTecnicoCatalogos();
    this.draftMode.set('fiber');
    this.draftPoints.set([]);
    this.createError.set(null);
    this.clearRoute();
    this.redrawDraft();
  }""")
    if text == old:
        print("TS sin cambios")
        return
    if dry:
        print("[dry-run] parchear", p.relative_to(root))
        return
    backup(p, dry)
    p.write_text(text, encoding="utf-8")
    print("ok", p.relative_to(root))

def patch_html(root: Path, dry: bool):
    p = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.html"
    text = p.read_text(encoding="utf-8")
    old = text
    text = re.sub(
        r"\n\s*<button\s+type=\"button\"\s+class=\"edit-action\"\s+\(click\)=\"clearDraft\(\)\"[\s\S]*?<span>Cancelar</span>\s*</button>",
        "",
        text,
        count=1,
    )
    if text == old:
        print("HTML sin cambios")
        return
    if dry:
        print("[dry-run] parchear", p.relative_to(root))
        return
    backup(p, dry)
    p.write_text(text, encoding="utf-8")
    print("ok", p.relative_to(root))

def patch_scss(root: Path, dry: bool):
    p = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.scss"
    text = p.read_text(encoding="utf-8")
    if "Técnico: dibujo tipo admin" in text:
        print("SCSS ya existe")
        return
    if dry:
        print("[dry-run] parchear", p.relative_to(root))
        return
    backup(p, dry)
    p.write_text(text.rstrip() + "\n\n" + SCSS + "\n", encoding="utf-8")
    print("ok", p.relative_to(root))

def cleanup(root: Path, dry: bool):
    pats = ["*.bak_tecnico_draw_admin_*", "*.bak_tecnico_missing_methods_*", "*.bak_tecnico_modal_*", "*.bak_mobile_v2_*", "*.bak_final_vendedor_*", "*.bak_vendedor_ui_*", "*.bak_admin_style_embed_*", "*.bak_compact_embed_*", "*.bak_embed_ux_*", "*.bak_embed_front_*", "*.bak_fix_embed_*"]
    for pat in pats:
        for p in (root / "src").rglob(pat):
            if p.is_file():
                if dry:
                    print("[dry-run] eliminar", p.relative_to(root))
                else:
                    p.unlink()
                    print("eliminado", p.relative_to(root))
    for name in ["fix_tecnico_missing_methods.py", "fix_embed_tecnico_modal_admin.py", "install_embed_admin_style_patch.py", "install_embed_compact_classic_patch.py", "install_embed_viewer_ux_patch.py", "install_mapa_embed_frontend.py"]:
        p = root / name
        if p.exists() and p.is_file():
            if dry:
                print("[dry-run] eliminar", name)
            else:
                p.unlink()
                print("eliminado", name)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    root = Path.cwd()
    if not (root / "package.json").exists():
        raise SystemExit("Ejecuta desde la raíz de klaxmap.")
    patch_ts(root, args.dry_run)
    patch_html(root, args.dry_run)
    patch_scss(root, args.dry_run)
    cleanup(root, args.dry_run)
    print("\nSiguiente:")
    print("  npm run build")
    print("  git status")
    print("  git add -A")
    print('  git commit -m "fix: mejorar dibujo tecnico embed"')
    print("  git push")

if __name__ == "__main__":
    main()
