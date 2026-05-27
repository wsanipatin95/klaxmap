#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KLAXMAP - Retoques finales vendedor/técnico embed.

Ejecutar desde la raíz de klaxmap:

    python fix_embed_vendedor_final_tweaks.py --dry-run
    python fix_embed_vendedor_final_tweaks.py

Qué corrige:
  1. Quita el botón de etiquetas del toolbar superior.
  2. Deja Google Satélite por defecto.
  3. Mejora los botones de ubicación: Buscar, GPS y Centrar.
  4. Al dar click en una fila solo centra/selecciona. El modal se abre solo con botón Info.
  5. Intenta trazar ruta por calles usando OSRM público y si falla usa línea directa.
  6. Ajusta responsive móvil para vendedores en navegador celular.
  7. Limpia backups e instaladores temporales.
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path


HTML = r"""
<div class="mapa-layout mapa-embed-layout sidebar-expanded">
  <aside class="sidebar">
    <div class="sidebar-shell">
      <div class="sidebar-geo-search embed-location-strip">
        <div class="embed-location-title">
          <i class="pi pi-map-marker"></i>
          <span>Ubicación</span>
          <strong *ngIf="origin()">OK</strong>
        </div>

        <div class="embed-location-controls" *ngIf="ready()">
          <label>
            <span>Radio</span>
            <input type="number" min="1" [ngModel]="radioM()" (ngModelChange)="radioM.set(+$event || 1)" />
          </label>

          <button type="button" class="edit-action edit-action--primary embed-search-btn" title="Buscar cercanos" (click)="refreshNearby()" [disabled]="loadingItems()">
            <i class="pi pi-search"></i>
            <span>Buscar</span>
          </button>

          <button type="button" class="edit-action embed-gps-btn" title="Usar GPS" (click)="locateBrowser()">
            <i class="pi pi-map-marker"></i>
            <span>GPS</span>
          </button>

          <button type="button" class="tool-btn" title="Centrar ubicación" (click)="centerOrigin()" [disabled]="!origin()">
            <i class="pi pi-crosshairs"></i>
          </button>
        </div>
      </div>

      <div class="sidebar-sections">
        <section class="sidebar-pane pane-places">
          <button type="button" class="pane-header">
            <span class="pane-header-left">
              <span class="pane-toggle-icon expanded">▾</span>
              <span class="pane-title">Elementos cercanos</span>
            </span>
            <span class="embed-count">{{ items().length }}</span>
          </button>

          <div class="pane-body">
            <div class="embed-nearby-list">
              <div class="embed-message" *ngIf="loading()">
                <span class="mini-loader"></span>
                Iniciando mapa...
              </div>

              <div class="embed-message error" *ngIf="!loading() && error()">
                {{ error() }}
              </div>

              <div class="embed-message" *ngIf="ready() && loadingItems()">
                <span class="mini-loader"></span>
                Buscando cercanos...
              </div>

              <div class="embed-message" *ngIf="ready() && routeLoading()">
                <span class="mini-loader"></span>
                Calculando ruta...
              </div>

              <div class="embed-message" *ngIf="ready() && !loadingItems() && !items().length">
                No hay elementos cercanos.
              </div>

              <article
                class="embed-nearby-row"
                *ngFor="let item of items()"
                [class.selected]="selected()?.idGeoElemento === item.idGeoElemento"
              >
                <button type="button" class="embed-row-main" (click)="focusItem(item)">
                  <span
                    class="embed-row-icon"
                    [style.background]="rowIconBackground(item)"
                    [style.border-color]="itemStroke(item)"
                    [style.color]="item.colorTexto || itemStroke(item)"
                  >
                    <img *ngIf="rowIconImage(item) as iconUrl; else rowIconSymbol" [src]="iconUrl" alt="" />

                    <ng-template #rowIconSymbol>
                      <span *ngIf="rowIsMaterialIcon(item); else rowCssIcon" class="material-symbols-rounded">
                        {{ rowIconGlyph(item) }}
                      </span>

                      <ng-template #rowCssIcon>
                        <i *ngIf="rowIconClass(item) as iconClass; else rowDot" [class]="iconClass"></i>
                      </ng-template>

                      <ng-template #rowDot>
                        <span class="embed-row-dot"></span>
                      </ng-template>
                    </ng-template>
                  </span>

                  <span class="embed-row-text">
                    <strong>{{ elementLabel(item) }}</strong>
                    <span>{{ item.tipoNombre || item.tipoCodigo || 'Elemento' }}</span>
                    <em *ngIf="item.distanciaM != null">{{ formatDistance(item.distanciaM) }}</em>
                  </span>
                </button>

                <span class="embed-row-actions">
                  <button type="button" class="tool-btn" title="Trazar ruta" (click)="traceRoute(item)">
                    <i class="pi pi-directions"></i>
                  </button>
                  <button type="button" class="tool-btn" title="Información" (click)="openInfo(item)">
                    <i class="pi pi-info-circle"></i>
                  </button>
                </span>
              </article>
            </div>
          </div>
        </section>

        <section class="sidebar-pane pane-layers embed-info-pane" *ngIf="mode() === 'tecnico' && ready()">
          <button type="button" class="pane-header">
            <span class="pane-header-left">
              <span class="pane-toggle-icon expanded">▾</span>
              <span class="pane-title">Trabajo técnico</span>
            </span>
          </button>

          <div class="pane-body">
            <div class="embed-tech-body">
              <div class="embed-info-actions">
                <button
                  type="button"
                  class="edit-action"
                  (click)="startCreateBox()"
                  [disabled]="!can('puedeCrearCaja') || !actionEnabled('create_box')"
                >
                  <i class="pi pi-plus-circle"></i>
                  <span>Caja</span>
                </button>

                <button
                  type="button"
                  class="edit-action"
                  (click)="startDrawFiber()"
                  [disabled]="!can('puedeCrearFibra') || !actionEnabled('draw_fiber')"
                >
                  <i class="pi pi-share-alt"></i>
                  <span>Fibra</span>
                </button>
              </div>

              <div class="embed-draft" *ngIf="draftMode() !== 'none'">
                <label>
                  Nodo
                  <input type="number" [(ngModel)]="createForm.idRedNodoFk" />
                </label>

                <label>
                  Tipo
                  <input type="number" [(ngModel)]="createForm.idGeoTipoElementoFk" />
                </label>

                <label>
                  Nombre
                  <input type="text" [(ngModel)]="createForm.nombre" />
                </label>

                <p class="error-text" *ngIf="createError()">{{ createError() }}</p>

                <div class="embed-info-actions">
                  <button type="button" class="edit-action" (click)="useOriginAsDraftPoint()" [disabled]="!origin()">Origen</button>
                  <button type="button" class="edit-action" (click)="undoDraftPoint()" [disabled]="!draftPoints().length">Deshacer</button>
                  <button type="button" class="edit-action edit-action--primary" (click)="saveDraft()" [disabled]="saving()">Guardar</button>
                  <button type="button" class="edit-action" (click)="clearDraft()">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </aside>

  <header class="toolbar">
    <div class="ge-toolbar-shell">
      <div class="ge-toolbar-strip" role="toolbar" aria-label="Herramientas mapa embed">
        <div class="toolbar-dropdown" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="tool-btn tool-btn--wide tool-btn--dropdown"
            [class.active]="basemapMenuOpen()"
            [attr.title]="'Mapa base: ' + basemapLabel()"
            (click)="toggleBasemapMenu($event)"
          >
            <i class="pi pi-map"></i>
            <span class="tool-btn-label">{{ basemapLabel() }}</span>
            <i class="pi pi-angle-down tool-btn-dropdown-icon" [class.is-open]="basemapMenuOpen()"></i>
          </button>

          <div class="toolbar-dropdown-menu" *ngIf="basemapMenuOpen()">
            <button
              type="button"
              class="toolbar-dropdown-item"
              *ngFor="let option of basemapOptions"
              [class.active]="option.key === basemapKey()"
              (click)="changeBasemap(option.key)"
            >
              <span class="toolbar-dropdown-item-text">{{ option.label }}</span>
              <i class="pi pi-check" *ngIf="option.key === basemapKey()"></i>
            </button>
          </div>
        </div>

        <button type="button" class="tool-btn" title="Limpiar ruta" (click)="clearRoute()" [disabled]="!routeTarget()">
          <i class="pi pi-eraser"></i>
        </button>

        <span class="tool-separator" aria-hidden="true"></span>

        <button type="button" class="tool-btn" title="Cerrar" (click)="cancel()">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>
  </header>

  <main class="canvas">
    <div class="canvas-surface">
      <div #mapEl class="mapa-embed-canvas"></div>
    </div>
  </main>

  <footer class="status">
    <div class="mapa-embed-statusbar">
      <span><strong>Modo:</strong> {{ modeLabel() }}</span>
      <span><strong>Total:</strong> {{ items().length }}</span>
      <span *ngIf="selectedName()"><strong>Sel:</strong> {{ selectedName() }}</span>
      <span *ngIf="routeTarget()"><strong>Ruta:</strong> {{ routeLoading() ? 'calculando...' : formatDistance(routeDistanceM()) }}</span>
    </div>
  </footer>

  <div class="embed-info-modal-backdrop" *ngIf="selected() && infoOpen()" (click)="closeInfo()">
    <section class="embed-info-modal" (click)="$event.stopPropagation()">
      <header>
        <div>
          <strong>{{ elementLabel(selected()!) }}</strong>
          <span>{{ selected()?.tipoNombre || selected()?.tipoCodigo || 'Elemento' }}</span>
        </div>
        <button type="button" class="tool-btn" title="Cerrar" (click)="closeInfo()">
          <i class="pi pi-times"></i>
        </button>
      </header>

      <dl>
        <div>
          <dt>Distancia</dt>
          <dd>{{ formatDistance(selected()?.distanciaM) }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{{ selected()?.estado || 'N/D' }}</dd>
        </div>
        <div *ngIf="selected()?.codigo || selected()?.etiqueta">
          <dt>Código</dt>
          <dd>{{ selected()?.codigo || selected()?.etiqueta }}</dd>
        </div>
      </dl>

      <p *ngIf="selected()?.descripcion">{{ selected()?.descripcion }}</p>

      <footer>
        <button type="button" class="edit-action edit-action--primary" (click)="selectForErp()">
          <i class="pi pi-check"></i>
          <span>Usar</span>
        </button>

        <button type="button" class="edit-action" (click)="traceRoute(selected()!)">
          <i class="pi pi-directions"></i>
          <span>Ruta</span>
        </button>
      </footer>
    </section>
  </div>
</div>
"""


SCSS_APPEND = r"""
/* Retoques finales vendedor responsive */
.embed-location-controls {
  grid-template-columns: minmax(0, 1fr) auto auto 28px;
}

.embed-search-btn {
  min-width: 64px;
  height: 26px;
  padding: 0 0.42rem;
  justify-content: center;
}

.embed-gps-btn {
  height: 26px;
  min-width: 44px;
  padding: 0 0.38rem;
  justify-content: center;
}

.embed-search-btn i,
.embed-gps-btn i {
  font-size: 0.72rem;
}

.embed-search-btn span,
.embed-gps-btn span {
  font-size: 0.62rem;
  font-weight: 800;
}

.embed-nearby-row .embed-row-main {
  min-width: 0;
}

.embed-row-icon img {
  width: 14px;
  height: 14px;
  object-fit: contain;
  display: block;
}

.embed-row-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  display: block;
}

.mapa-embed-layout .toolbar,
.mapa-embed-layout .ge-toolbar-shell,
.mapa-embed-layout .ge-toolbar-strip {
  overflow: visible;
}

.mapa-embed-layout .ge-toolbar-strip {
  gap: 3px;
}

.mapa-embed-layout .tool-separator {
  margin-left: 4px;
  margin-right: 4px;
}

.embed-info-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(1px);
}

.embed-info-modal {
  width: min(390px, calc(100vw - 2rem));
  max-height: min(78vh, 520px);
  display: grid;
  grid-template-rows: auto auto minmax(0, auto) auto;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #334155;
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.22);
}

.embed-info-modal > header {
  min-height: 30px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  gap: 0.35rem;
  align-items: center;
  padding: 0.35rem 0.42rem;
  color: #ffffff;
  background: linear-gradient(180deg, #b00084, #7b0061);
}

.embed-info-modal > header strong {
  display: block;
  font-size: 0.74rem;
  font-weight: 800;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.embed-info-modal > header span {
  display: block;
  margin-top: 0.08rem;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.58rem;
  line-height: 1;
}

.embed-info-modal > header .tool-btn {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.35);
}

.embed-info-modal dl {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0.42rem 0.5rem 0.2rem;
  background: #ffffff;
}

.embed-info-modal dl div {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 0.45rem;
  min-height: 21px;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
}

.embed-info-modal dt {
  color: #64748b;
  font-size: 0.6rem;
  font-weight: 700;
}

.embed-info-modal dd {
  margin: 0;
  color: #334155;
  font-size: 0.62rem;
  font-weight: 800;
  min-width: 0;
  overflow-wrap: anywhere;
}

.embed-info-modal p {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  padding: 0.42rem 0.5rem;
  color: #475569;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.64rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.embed-info-modal > footer {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: flex-end;
  padding: 0.42rem 0.5rem;
  background: #eef2f7;
}

@media (max-width: 700px) {
  .mapa-embed-layout {
    --toolbar-height: 36px;
    --status-height: 28px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--toolbar-height) minmax(0, 58dvh) minmax(0, calc(42dvh - var(--status-height))) var(--status-height);
    grid-template-areas:
      'toolbar'
      'canvas'
      'sidebar'
      'status';
    height: 100dvh;
    max-height: 100dvh;
  }

  .mapa-embed-layout .sidebar {
    border-right: 0;
    border-top: 1px solid #cbd5e1;
    min-height: 0;
  }

  .mapa-embed-layout .sidebar-shell {
    min-height: 0;
  }

  .embed-location-strip {
    padding: 0.12rem;
  }

  .embed-location-title {
    min-height: 18px;
  }

  .embed-location-controls {
    grid-template-columns: minmax(0, 1fr) auto auto 30px;
  }

  .embed-search-btn,
  .embed-gps-btn {
    height: 28px;
  }

  .mapa-embed-layout .tool-btn {
    width: 30px;
    height: 28px;
  }

  .mapa-embed-layout .tool-btn--wide {
    max-width: calc(100vw - 108px);
  }

  .mapa-embed-layout .tool-btn-label {
    max-width: 8.2rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .embed-nearby-row {
    min-height: 36px;
  }

  .embed-row-actions .tool-btn {
    width: 28px;
    height: 28px;
  }

  .embed-row-icon {
    width: 20px;
    height: 20px;
  }

  .embed-row-text strong {
    font-size: 0.68rem;
  }

  .embed-row-text span,
  .embed-row-text em {
    font-size: 0.6rem;
  }

  .mapa-embed-statusbar {
    font-size: 0.62rem;
    gap: 0.25rem;
    padding: 0 0.36rem;
  }

  .mapa-embed-statusbar span {
    max-width: 9rem;
  }

  .embed-info-modal-backdrop {
    place-items: end center;
    padding: 0.45rem;
  }

  .embed-info-modal {
    width: 100%;
    max-height: 72dvh;
  }
}

@media (max-width: 420px) {
  .mapa-embed-layout {
    grid-template-rows: var(--toolbar-height) minmax(0, 54dvh) minmax(0, calc(46dvh - var(--status-height))) var(--status-height);
  }

  .embed-location-controls {
    grid-template-columns: minmax(0, 1fr) 62px 46px 30px;
  }

  .embed-search-btn {
    min-width: 62px;
  }

  .embed-gps-btn {
    min-width: 46px;
  }

  .embed-nearby-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .embed-row-main {
    grid-template-columns: 20px minmax(0, 1fr);
  }
}
"""


TRACE_ROUTE_METHOD = r"""
  traceRoute(item: MapaElementoCercano) {
    const origin = this.origin();
    if (!origin) {
      this.error.set('No hay ubicación de origen.');
      return;
    }

    const target = this.itemAnchor(item);
    if (!target) {
      this.error.set('No se pudo ubicar el elemento.');
      return;
    }

    this.routeLayer?.clearLayers();
    this.routeTarget.set(item);
    this.routeDistanceM.set(null);
    this.routeLoading.set(true);

    this.resolveStreetRoute(origin, target)
      .then((streetPoints) => {
        const routePoints = streetPoints.length >= 2 ? streetPoints : [origin, target];
        const distance = this.computeRouteDistance(routePoints, item.distanciaM);
        this.routeDistanceM.set(distance);

        this.paintRoute(routePoints, distance);
        this.focusItem(item, false);
        this.fitRoute(routePoints);

        this.messaging.post('KLAX_MAP_ELEMENT_VIEWED', {
          ...item,
          routeDistanceM: distance,
          routeDistanceText: this.formatDistance(distance),
          routeMode: streetPoints.length >= 2 ? 'street' : 'direct',
        });
      })
      .catch(() => {
        const routePoints = [origin, target];
        const distance = this.computeRouteDistance(routePoints, item.distanciaM);
        this.routeDistanceM.set(distance);

        this.paintRoute(routePoints, distance);
        this.focusItem(item, false);
        this.fitRoute(routePoints);
      })
      .finally(() => {
        this.routeLoading.set(false);
      });
  }
"""


HELPER_METHODS = r"""
  private async resolveStreetRoute(origin: LatLngPoint, target: LatLngPoint): Promise<LatLngPoint[]> {
    const url = new URL(
      `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${target.lng},${target.lat}`
    );

    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('alternatives', 'false');
    url.searchParams.set('steps', 'false');

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const data = await response.json();
    const coordinates = data?.routes?.[0]?.geometry?.coordinates;

    if (!Array.isArray(coordinates)) return [];

    return coordinates
      .map((coord: unknown) => {
        const pair = coord as [number, number];
        return { lng: Number(pair[0]), lat: Number(pair[1]) };
      })
      .filter((point: LatLngPoint) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  private paintRoute(points: LatLngPoint[], distance: number) {
    this.routeLayer?.clearLayers();

    if (!this.routeLayer || points.length < 2) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as L.LatLngExpression);

    L.polyline(latLngs, {
      color: '#ffffff',
      weight: 7,
      opacity: 0.78,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.routeLayer);

    L.polyline(latLngs, {
      color: this.KLAX_PRIMARY,
      weight: 3,
      opacity: 0.98,
      dashArray: '10 7',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.routeLayer);

    const middle = this.middleRoutePoint(points);
    L.marker([middle.lat, middle.lng], {
      interactive: false,
      icon: this.createRouteLabelIcon(this.formatDistance(distance)),
      zIndexOffset: 1800,
    }).addTo(this.routeLayer);
  }

  private fitRoute(points: LatLngPoint[]) {
    if (!this.map || points.length < 2) return;

    this.map.fitBounds(
      L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng))),
      { padding: [40, 40], maxZoom: 17 }
    );
  }

  private computeRouteDistance(points: LatLngPoint[], fallback?: number | null): number {
    if (!this.map || points.length < 2) {
      return Number(fallback ?? 0);
    }

    let distance = 0;

    for (let i = 1; i < points.length; i++) {
      distance += this.map.distance(
        L.latLng(points[i - 1].lat, points[i - 1].lng),
        L.latLng(points[i].lat, points[i].lng)
      );
    }

    return Number.isFinite(distance) && distance > 0 ? distance : Number(fallback ?? 0);
  }

  private middleRoutePoint(points: LatLngPoint[]): LatLngPoint {
    if (points.length === 0) {
      return this.origin() ?? { lat: 0, lng: 0 };
    }

    return points[Math.floor(points.length / 2)];
  }
"""


BACKUP_PATTERNS = [
    "*.bak_admin_style_embed_*",
    "*.bak_compact_embed_*",
    "*.bak_embed_ux_*",
    "*.bak_embed_front_*",
    "*.bak_fix_embed_*",
    "*.bak_vendedor_ui_*",
]

TEMP_ROOT_FILES = [
    "install_embed_admin_style_patch.py",
    "install_embed_compact_classic_patch.py",
    "install_embed_viewer_ux_patch.py",
    "install_mapa_embed_frontend.py",
]


def backup(path: Path, dry_run: bool) -> None:
    if dry_run or not path.exists():
        return

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak_final_vendedor_{stamp}")
    shutil.copy2(path, backup_path)
    print(f"backup: {backup_path.relative_to(Path.cwd())}")


def replace_method(text: str, name: str, replacement: str) -> str:
    idx = text.find(f"  {name}(")
    if idx < 0:
        idx = text.find(f"  private {name}(")

    if idx < 0:
        raise RuntimeError(f"No encontré método {name}.")

    brace = text.find("{", idx)
    if brace < 0:
        raise RuntimeError(f"No encontré apertura de {name}.")

    depth = 0
    end = None

    for pos in range(brace, len(text)):
        ch = text[pos]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = pos + 1
                break

    if end is None:
        raise RuntimeError(f"No encontré cierre de {name}.")

    return text[:idx] + replacement.strip("\n") + text[end:]


def patch_ts(root: Path, dry_run: bool) -> bool:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.ts"
    if not path.exists():
        raise SystemExit(f"No existe {path}")

    text = path.read_text(encoding="utf-8")
    original = text

    text = text.replace("signal<BasemapKey>('openStreetMap')", "signal<BasemapKey>('googleSatellite')")
    text = text.replace("signal<BasemapKey>('osm')", "signal<BasemapKey>('googleSatellite')")
    text = text.replace("basemapKey = signal('openStreetMap')", "basemapKey = signal<BasemapKey>('googleSatellite')")

    if "readonly routeLoading = signal(false);" not in text:
        text = text.replace(
            "  readonly routeDistanceM = signal<number | null>(null);",
            "  readonly routeDistanceM = signal<number | null>(null);\n  readonly routeLoading = signal(false);",
            1,
        )

    text = replace_method(text, "traceRoute", TRACE_ROUTE_METHOD)

    if "private async resolveStreetRoute(" not in text:
        marker = "  clearRoute() {"
        idx = text.find(marker)
        if idx < 0:
            raise SystemExit("No pude ubicar clearRoute() para insertar helpers de ruta.")
        text = text[:idx] + HELPER_METHODS.strip("\n") + "\n\n" + text[idx:]

    if text == original:
        print("TS: no hubo cambios.")
        return False

    if dry_run:
        print(f"[dry-run] parchear TS: {path.relative_to(root)}")
        return True

    backup(path, dry_run=False)
    path.write_text(text, encoding="utf-8")
    print(f"ok TS: {path.relative_to(root)}")
    return True


def patch_html(root: Path, dry_run: bool) -> bool:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.html"
    if not path.exists():
        raise SystemExit(f"No existe {path}")

    if dry_run:
        print(f"[dry-run] escribir HTML: {path.relative_to(root)}")
        return True

    backup(path, dry_run=False)
    path.write_text(HTML.strip() + "\n", encoding="utf-8")
    print(f"ok HTML: {path.relative_to(root)}")
    return True


def patch_scss(root: Path, dry_run: bool) -> bool:
    path = root / "src/app/features/mapa/embed/pages/mapa-embed-viewer/mapa-embed-viewer.component.scss"
    if not path.exists():
        raise SystemExit(f"No existe {path}")

    text = path.read_text(encoding="utf-8")

    if "Retoques finales vendedor responsive" in text:
        print("SCSS: retoques finales ya existen.")
        return False

    new_text = text.rstrip() + "\n\n" + SCSS_APPEND.strip() + "\n"

    if dry_run:
        print(f"[dry-run] parchear SCSS: {path.relative_to(root)}")
        return True

    backup(path, dry_run=False)
    path.write_text(new_text, encoding="utf-8")
    print(f"ok SCSS: {path.relative_to(root)}")
    return True


def cleanup(root: Path, dry_run: bool) -> int:
    count = 0

    for pattern in BACKUP_PATTERNS:
        for path in (root / "src").rglob(pattern):
            if path.is_file():
                rel = path.relative_to(root)
                if dry_run:
                    print(f"[dry-run] eliminar: {rel}")
                else:
                    path.unlink()
                    print(f"eliminado: {rel}")
                count += 1

    for rel_name in TEMP_ROOT_FILES:
        path = root / rel_name
        if path.exists() and path.is_file():
            if dry_run:
                print(f"[dry-run] eliminar: {rel_name}")
            else:
                path.unlink()
                print(f"eliminado: {rel_name}")
            count += 1

    return count


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

    patch_html(root, args.dry_run)
    patch_ts(root, args.dry_run)
    patch_scss(root, args.dry_run)
    removed = cleanup(root, args.dry_run)

    print("")
    print("Resumen:")
    print(f"  Temporales eliminados: {removed}")

    print("")
    print("Siguiente:")
    print("  npm run build")
    print("  git status")
    print("  git add -A")
    print('  git commit -m "fix: retoques finales embed vendedor"')
    print("  git push")


if __name__ == "__main__":
    main()
