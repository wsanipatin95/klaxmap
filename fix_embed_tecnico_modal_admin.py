#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path

TECH_SIDEBAR_SECTION = r"""
<section class="sidebar-pane pane-layers embed-info-pane" *ngIf="mode() === 'tecnico' && ready()">
  <button type="button" class="pane-header">
    <span class="pane-header-left">
      <span class="pane-toggle-icon expanded">▾</span>
      <span class="pane-title">Trabajo técnico</span>
    </span>
  </button>

  <div class="pane-body">
    <div class="embed-tech-body">
      <div class="embed-tech-state" *ngIf="draftMode() === 'none'">
        Usa la barra superior para crear una caja/NAP o dibujar un tendido de fibra.
      </div>

      <div class="embed-tech-state active" *ngIf="draftMode() === 'box'">
        <strong>Creando caja/NAP</strong>
        <span>Haz click en el mapa para ubicar la caja. Luego se abrirá el formulario.</span>
      </div>

      <div class="embed-tech-state active" *ngIf="draftMode() === 'fiber'">
        <strong>Dibujando fibra</strong>
        <span>Haz click en el mapa para agregar puntos. Puntos: {{ draftPoints().length }}</span>

        <div class="embed-info-actions">
          <button type="button" class="edit-action" (click)="undoDraftPoint()" [disabled]="!draftPoints().length">
            <i class="pi pi-undo"></i>
            <span>Deshacer</span>
          </button>

          <button type="button" class="edit-action edit-action--primary" (click)="openCreateDialogFromDraft()" [disabled]="draftPoints().length < 2">
            <i class="pi pi-check"></i>
            <span>Finalizar</span>
          </button>

          <button type="button" class="edit-action" (click)="clearDraft()">
            <i class="pi pi-times"></i>
            <span>Cancelar</span>
          </button>
        </div>
      </div>

      <p class="error-text" *ngIf="createError()">{{ createError() }}</p>
    </div>
  </div>
</section>
""".strip()

TECH_TOOLBAR = r"""
<ng-container *ngIf="mode() === 'tecnico'">
  <span class="tool-separator" aria-hidden="true"></span>

  <button type="button" class="tool-btn tech-tool-btn" [class.active]="draftMode() === 'box'" title="Crear caja / NAP" (click)="startCreateBox()" [disabled]="!can('puedeCrearCaja') || !actionEnabled('create_box')">
    <i class="pi pi-plus-circle"></i>
  </button>

  <button type="button" class="tool-btn tech-tool-btn" [class.active]="draftMode() === 'fiber'" title="Dibujar tendido de fibra" (click)="startDrawFiber()" [disabled]="!can('puedeCrearFibra') || !actionEnabled('draw_fiber')">
    <i class="pi pi-share-alt"></i>
  </button>

  <button type="button" class="tool-btn" title="Finalizar fibra" (click)="openCreateDialogFromDraft()" [disabled]="draftMode() !== 'fiber' || draftPoints().length < 2">
    <i class="pi pi-check"></i>
  </button>

  <button type="button" class="tool-btn" title="Deshacer punto" (click)="undoDraftPoint()" [disabled]="draftMode() === 'none' || !draftPoints().length">
    <i class="pi pi-undo"></i>
  </button>

  <button type="button" class="tool-btn" title="Cancelar herramienta" (click)="clearDraft()" [disabled]="draftMode() === 'none'">
    <i class="pi pi-times"></i>
  </button>
</ng-container>
""".strip()

CREATE_DIALOG_TAG = r"""
<app-mapa-create-element-dialog
  #createDialog
  [nodos]="nodos()"
  [tipos]="tecnicoTipos()"
  [showGeometryPreview]="false"
  (submitted)="crearElementoTecnico($event)"
/>
""".strip()

SCSS_APPEND = r"""
/* Técnico embed con modal administrativo */
.tech-tool-btn.active {
  background: linear-gradient(180deg, #f3aad6 0%, #eb79ba 100%);
  border-color: #b02365;
  color: #ffffff;
}

.embed-tech-state {
  display: grid;
  gap: 0.28rem;
  padding: 0.42rem;
  border: 1px solid #d8dee6;
  border-radius: 4px;
  background: #ffffff;
  color: #475569;
  font-size: 0.64rem;
  line-height: 1.25;
}

.embed-tech-state strong {
  color: #334155;
  font-size: 0.68rem;
}

.embed-tech-state.active {
  border-color: #f3c7df;
  background: #fff7fb;
  color: #7b0061;
}

.embed-tech-state.active strong {
  color: #7b0061;
}

.embed-draft {
  display: none !important;
}

@media (max-width: 700px) {
  .tech-tool-btn {
    width: 30px;
    height: 28px;
  }

  .embed-tech-state {
    font-size: 0.62rem;
  }

  .embed-tech-state .embed-info-actions {
    gap: 0.25rem;
  }

  .embed-tech-state .edit-action {
    min-height: 26px;
    padding: 0 0.45rem;
  }
}

:host ::ng-deep app-mapa-create-element-dialog .wkt-box {
  display: none;
}

:host ::ng-deep app-mapa-create-element-dialog .dialog-shell {
  max-height: min(76vh, 620px);
}

@media (max-width: 520px) {
  :host ::ng-deep app-mapa-create-element-dialog .p-dialog {
    width: 100vw !important;
    max-width: 100vw !important;
    margin: 0 !important;
  }

  :host ::ng-deep app-mapa-create-element-dialog .dialog-shell {
    max-height: 78dvh;
  }

  :host ::ng-deep app-mapa-create-element-dialog .tipo-groups {
    grid-template-columns: 1fr;
  }
}
""".strip()

HELPER_METHODS = r"""
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
        metadata: ctx?.metadata ?? null,
      },
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
    const allowed = new Set((this.config()?.tiposElemento ?? []).filter((id) => Number(id) > 0));

    return tipos.filter((tipo) => {
      if (!tipo.activo) return false;
      if (allowed.size === 0) return true;
      return allowed.has(tipo.idGeoTipoElemento);
    });
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

def backup(path: Path, dry_run: bool) -> None:
    if dry_run or not path.exists():
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    b = path.with_suffix(path.suffix + f".bak_tecnico_modal_{stamp}")
    shutil.copy2(path, b)
    print(f"backup: {b.relative_to(Path.cwd())}")

def find_matching_block(text: str, start_idx: int, open_token: str, close_token: str) -> tuple[int, int]:
    first_open = text.find(open_token, start_idx)
    if first_open < 0:
        raise RuntimeError(f"No encontré {open_token}")
    pos = first_open
    depth = 0
    while pos < len(text):
        next_open = text.find(open_token, pos)
        next_close = text.find(close_token, pos)
        if next_close < 0:
            raise RuntimeError(f"No encontré cierre {close_token}")
        if next_open >= 0 and next_open < next_close:
            depth += 1
            pos = next_open + len(open_token)
        else:
            depth -= 1
            pos = next_close + len(close_token)
            if depth == 0:
                return first_open, pos
    raise RuntimeError("No pude cerrar bloque")

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
        raise RuntimeError(f"No encontré cierre de {name}")
    return text[:idx] + replacement.strip() + text[end:]

def patch_viewer_html(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.html"
    text = path.read_text(encoding="utf-8")
    original = text

    marker = '<section class="sidebar-pane pane-layers embed-info-pane" *ngIf="mode() === \'tecnico\' && ready()">'
    idx = text.find(marker)
    if idx >= 0:
        start, end = find_matching_block(text, idx, "<section", "</section>")
        text = text[:start] + TECH_SIDEBAR_SECTION + text[end:]

    if "Crear caja / NAP" not in text:
        route_btn_start = text.find('<button type="button" class="tool-btn" title="Limpiar ruta"')
        if route_btn_start >= 0:
            route_btn_end = text.find("</button>", route_btn_start) + len("</button>")
            text = text[:route_btn_end] + "\n\n        " + TECH_TOOLBAR + text[route_btn_end:]

    if "<strong>Herramienta:</strong>" not in text:
        old = '<span *ngIf="routeTarget()"><strong>Ruta:</strong> {{ routeLoading() ? \'calculando...\' : formatDistance(routeDistanceM()) }}</span>'
        new = old + "\n      <span *ngIf=\"mode() === 'tecnico' && draftMode() !== 'none'\"><strong>Herramienta:</strong> {{ draftMode() === 'box' ? 'Caja/NAP' : 'Fibra' }}</span>"
        text = text.replace(old, new, 1)

    if "app-mapa-create-element-dialog" not in text:
        last = text.rfind("</div>")
        if last < 0:
            raise RuntimeError("No pude insertar create dialog")
        text = text[:last] + "\n\n  " + CREATE_DIALOG_TAG + "\n" + text[last:]

    if text == original:
        print("HTML viewer: sin cambios.")
        return
    if dry_run:
        print(f"[dry-run] parchear HTML viewer: {path.relative_to(root)}")
        return
    backup(path, False)
    path.write_text(text, encoding="utf-8")
    print(f"ok HTML viewer: {path.relative_to(root)}")

def patch_viewer_ts(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.ts"
    text = path.read_text(encoding="utf-8")
    original = text

    if "MapaCrudFacade" not in text:
        text = text.replace(
            "import { MAPA_BASEMAP_OPTIONS, type BasemapKey } from '../../../models/mapa-basemap.models';",
            "import { MAPA_BASEMAP_OPTIONS, type BasemapKey } from '../../../models/mapa-basemap.models';\nimport { MapaCrudFacade } from '../../../application/mapa-crud.facade';\nimport { MapaCreateElementDialogComponent } from '../../../components/mapa-create-element-dialog/mapa-create-element-dialog.component';",
        )
    text = text.replace(
        "import type { MapaElemento, MapaElementoSaveRequest } from '../../../data-access/mapa.models';",
        "import type { MapaElemento, MapaElementoSaveRequest, MapaGeomTipo, MapaTipoElemento } from '../../../data-access/mapa.models';",
    )
    text = text.replace("imports: [CommonModule, FormsModule],", "imports: [CommonModule, FormsModule, MapaCreateElementDialogComponent],")
    if "@ViewChild('createDialog')" not in text:
        text = text.replace("  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;", "  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;\n  @ViewChild('createDialog') createDialog?: MapaCreateElementDialogComponent;")
    if "private readonly crud = inject(MapaCrudFacade);" not in text:
        text = text.replace("  private readonly elementosApi = inject(MapaElementosApi);", "  private readonly elementosApi = inject(MapaElementosApi);\n  private readonly crud = inject(MapaCrudFacade);")
    if "readonly nodos = this.crud.nodos;" not in text:
        text = text.replace("  readonly context = this.embedStore.context;\n  readonly config = this.embedStore.config;", "  readonly context = this.embedStore.context;\n  readonly config = this.embedStore.config;\n  readonly nodos = this.crud.nodos;\n  readonly tipos = this.crud.tipos;\n  readonly tecnicoTipos = computed(() => this.filterTecnicoTipos(this.tipos()));")
    if "this.loadTecnicoCatalogos();" not in text:
        text = text.replace("    const ctx = this.context();\n    const config = this.config();", "    const ctx = this.context();\n    const config = this.config();\n\n    if (this.mode() === 'tecnico') {\n      this.loadTecnicoCatalogos();\n    }", 1)

    text = replace_method(text, "startCreateBox", """
  startCreateBox() {
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
  }
""")

    text = replace_method(text, "startDrawFiber", """
  startDrawFiber() {
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
  }
""")

    text = replace_method(text, "addDraftPoint", """
  private addDraftPoint(point: LatLngPoint) {
    const mode = this.draftMode();
    if (mode === 'none') return;

    if (mode === 'box') {
      this.draftPoints.set([point]);
    } else {
      this.draftPoints.update((items) => [...items, point]);
    }

    this.redrawDraft();
    this.messaging.post('KLAX_MAP_CREATE_DRAFT_CHANGED', {
      mode,
      points: this.draftPoints(),
    });

    if (mode === 'box') {
      this.openCreateDialogFromDraft();
    }
  }
""")

    if "openCreateDialogFromDraft()" not in text:
        idx = text.find("  private authenticate(")
        if idx < 0:
            raise RuntimeError("No pude insertar helpers técnicos")
        text = text[:idx] + HELPER_METHODS + "\n\n" + text[idx:]

    if text == original:
        print("TS viewer: sin cambios.")
        return
    if dry_run:
        print(f"[dry-run] parchear TS viewer: {path.relative_to(root)}")
        return
    backup(path, False)
    path.write_text(text, encoding="utf-8")
    print(f"ok TS viewer: {path.relative_to(root)}")

def patch_viewer_scss(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.scss"
    text = path.read_text(encoding="utf-8")
    if "Técnico embed con modal administrativo" in text:
        print("SCSS viewer: ya estaba aplicado.")
        return
    if dry_run:
        print(f"[dry-run] parchear SCSS viewer: {path.relative_to(root)}")
        return
    backup(path, False)
    path.write_text(text.rstrip() + "\n\n" + SCSS_APPEND + "\n", encoding="utf-8")
    print(f"ok SCSS viewer: {path.relative_to(root)}")

def patch_create_dialog_ts(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/components/mapa-create-element-dialog/mapa-create-element-dialog.component.ts"
    text = path.read_text(encoding="utf-8")
    original = text
    text = text.replace("  descripcion: FormControl<string>;\n  estado:", "  descripcion: FormControl<string>;\n  etiqueta: FormControl<string>;\n  estado:")
    text = text.replace("  readonly currentGeomTipo = signal<MapaGeomTipo | null>(null);\n  readonly submittedAttempt", "  readonly currentGeomTipo = signal<MapaGeomTipo | null>(null);\n  readonly customTitle = signal<string | null>(null);\n  readonly submittedAttempt")
    if "showGeometryPreview" not in text:
        text = text.replace("  @Output() submitted", "  @Input() showGeometryPreview = true;\n\n  @Output() submitted")
    text = text.replace("    descripcion: this.fb.nonNullable.control('', [Validators.maxLength(500)]),\n    estado:", "    descripcion: this.fb.nonNullable.control('', [Validators.maxLength(500)]),\n    etiqueta: this.fb.nonNullable.control('', [Validators.maxLength(120)]),\n    estado:")
    text = text.replace("  readonly dialogTitle = computed(() => {\n    const geom", "  readonly dialogTitle = computed(() => {\n    const custom = this.customTitle();\n    if (custom) return custom;\n\n    const geom")
    text = text.replace("  open(params: { wkt: string; geomTipo: MapaGeomTipo; nodoId?: number | null })", "  open(params: { wkt: string; geomTipo: MapaGeomTipo; nodoId?: number | null; title?: string | null; defaultNombre?: string | null; defaultDescripcion?: string | null })")
    text = text.replace("    this.currentWkt.set(params.wkt);\n    this.currentGeomTipo.set(params.geomTipo);", "    this.currentWkt.set(params.wkt);\n    this.currentGeomTipo.set(params.geomTipo);\n    this.customTitle.set(params.title ?? null);")
    text = text.replace("        nombre: '',\n        descripcion: '',\n        estado:", "        nombre: params.defaultNombre ?? '',\n        descripcion: params.defaultDescripcion ?? '',\n        etiqueta: '',\n        estado:", 1)
    text = text.replace("      if (name === 'descripcion') return 'Máximo 500 caracteres.';", "      if (name === 'descripcion') return 'Máximo 500 caracteres.';\n      if (name === 'etiqueta') return 'Máximo 120 caracteres.';")
    text = text.replace("      descripcion: this.emptyToNull(raw.descripcion) ?? '',\n      estado:", "      descripcion: this.emptyToNull(raw.descripcion) ?? '',\n      etiqueta: this.emptyToNull(raw.etiqueta),\n      estado:")
    text = text.replace("    this.currentGeomTipo.set(null);\n    this.nodeLocked.set(false);", "    this.currentGeomTipo.set(null);\n    this.customTitle.set(null);\n    this.nodeLocked.set(false);")
    text = text.replace("        nombre: '',\n        descripcion: '',\n        estado:", "        nombre: '',\n        descripcion: '',\n        etiqueta: '',\n        estado:", 1)
    if text == original:
        print("TS create dialog: sin cambios.")
        return
    if dry_run:
        print(f"[dry-run] parchear TS create dialog: {path.relative_to(root)}")
        return
    backup(path, False)
    path.write_text(text, encoding="utf-8")
    print(f"ok TS create dialog: {path.relative_to(root)}")

def patch_create_dialog_html(root: Path, dry_run: bool) -> None:
    path = root / "src/app/features/mapa/components/mapa-create-element-dialog/mapa-create-element-dialog.component.html"
    text = path.read_text(encoding="utf-8")
    original = text
    if 'formControlName="etiqueta"' not in text:
        etiqueta = """
          <div class="field">
            <label for="elemento-etiqueta">Etiqueta</label>
            <input
              id="elemento-etiqueta"
              type="text"
              formControlName="etiqueta"
              placeholder="Etiqueta visible en mapa"
            />
            <p class="field-error" *ngIf="controlError('etiqueta') as err">{{ err }}</p>
          </div>

"""
        text = text.replace("          <div class=\"field\">\n            <label for=\"elemento-descripcion\">Descripción</label>", etiqueta + "          <div class=\"field\">\n            <label for=\"elemento-descripcion\">Descripción</label>", 1)
    text = text.replace('<div class="wkt-box">', '<div class="wkt-box" *ngIf="showGeometryPreview">')
    if text == original:
        print("HTML create dialog: sin cambios.")
        return
    if dry_run:
        print(f"[dry-run] parchear HTML create dialog: {path.relative_to(root)}")
        return
    backup(path, False)
    path.write_text(text, encoding="utf-8")
    print(f"ok HTML create dialog: {path.relative_to(root)}")

def cleanup(root: Path, dry_run: bool) -> None:
    patterns = ["*.bak_*embed_*", "*.bak_mobile_v2_*", "*.bak_final_vendedor_*", "*.bak_tecnico_modal_*"]
    files = ["install_embed_admin_style_patch.py", "install_embed_compact_classic_patch.py", "install_embed_viewer_ux_patch.py", "install_mapa_embed_frontend.py"]
    for pattern in patterns:
        for path in (root / "src").rglob(pattern):
            if path.is_file():
                rel = path.relative_to(root)
                if dry_run:
                    print(f"[dry-run] eliminar: {rel}")
                else:
                    path.unlink()
                    print(f"eliminado: {rel}")
    for name in files:
        path = root / name
        if path.exists() and path.is_file():
            if dry_run:
                print(f"[dry-run] eliminar: {name}")
            else:
                path.unlink()
                print(f"eliminado: {name}")

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

    patch_viewer_html(root, args.dry_run)
    patch_viewer_ts(root, args.dry_run)
    patch_viewer_scss(root, args.dry_run)
    patch_create_dialog_ts(root, args.dry_run)
    patch_create_dialog_html(root, args.dry_run)
    cleanup(root, args.dry_run)

    print("\nSiguiente:")
    print("  npm run build")
    print("  git status")
    print("  git add -A")
    print('  git commit -m "feat: usar modal administrativo en tecnico embed"')
    print("  git push")

if __name__ == "__main__":
    main()
