import {
  AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation,
  computed, inject, signal,
} from '@angular/core';
import * as L from 'leaflet';
import * as XLSX from 'xlsx';

import { CoberturaApi } from '../../data-access/cobertura.api';
import type { CoberturaNap, CoberturaClienteGeo, CoberturaElementoMeta, CoberturaOlt, CoberturaNapPon, CoberturaLpuPon, CoberturaZona, CoberturaNapUbicacion, CoberturaContratoFecha } from '../../data-access/cobertura.models';

type ZonaMetric = 'total' | 'activos' | 'cortados' | 'otros';
import type { MapaNapCliente, MapaNapClientes } from 'src/app/features/mapa/data-access/mapa.models';

const NAP_CAP = 1500;     // tope de iconos (de cerca)
const DOT_CAP = 3500;     // tope de cajas en pantalla (alcanza para todas las NAP)
const CONEX_CAP = 250;
const LABEL_ZOOM = 14;   // desde este zoom se muestran los nombres fijos
const LABEL_CAP = 200;   // maximo de etiquetas fijas a la vez

/**
 * Capa de calor propia (canvas simple, sin heredar de L.Layer ni dependencias externas).
 * Dibuja gradientes radiales acumulativos por cliente: mas juntos = mas intenso.
 */
class HeatOverlay {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private map?: L.Map;
  private pts: L.LatLngTuple[] = [];
  private readonly onMove = () => this.reset();

  get active(): boolean { return !!this.canvas; }

  attach(map: L.Map): void {
    if (this.canvas) return;
    this.map = map;
    this.canvas = L.DomUtil.create('canvas', 'cob-heat-canvas') as HTMLCanvasElement;
    this.canvas.style.position = 'absolute';
    this.canvas.style.pointerEvents = 'none';
    this.ctx = this.canvas.getContext('2d');
    map.getPanes().overlayPane.appendChild(this.canvas);
    map.on('moveend zoomend resize', this.onMove);
    this.reset();
  }

  detach(): void {
    if (this.map) this.map.off('moveend zoomend resize', this.onMove);
    this.canvas?.remove();
    this.canvas = undefined;
    this.map = undefined;
  }

  setPoints(p: L.LatLngTuple[]): void { this.pts = p; this.draw(); }

  private reset(): void {
    if (!this.map || !this.canvas) return;
    const topLeft = this.map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this.canvas, topLeft);
    const size = this.map.getSize();
    this.canvas.width = size.x;
    this.canvas.height = size.y;
    this.draw();
  }

  private draw(): void {
    if (!this.map || !this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const zoom = this.map.getZoom();
    const r = Math.max(14, Math.min(48, (zoom - 9) * 6));
    const bounds = this.map.getBounds().pad(0.25);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pts) {
      if (!bounds.contains(p)) continue;
      const pt = this.map.latLngToContainerPoint(p);
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      g.addColorStop(0, 'rgba(255,72,0,0.32)');
      g.addColorStop(0.5, 'rgba(255,160,0,0.16)');
      g.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * Vista de Cobertura (solo lectura). NAP 1er/2do nivel con icono y nombre corto del mapa real.
 * Clic en una NAP -> panel LATERAL derecho (no tapa el mapa) con clientes por puerto + GPS,
 * y en el mapa el circulo de radio + lineas a los clientes. Boton de mapa de calor.
 */
@Component({
  selector: 'app-cobertura-home',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="flex flex-col h-[calc(100vh-4rem)] p-2 gap-2 bg-slate-100">
      <!-- Barra de la pantalla de ventas: titulo · filtros (lo que manda) · vista del mapa · exportar -->
      <div class="cob-bar">
        <div class="cob-bar-title">
          <h2>Cobertura de clientes</h2>
          <span>{{ n(naps().length) }} cajas NAP</span>
        </div>

        <div class="cob-bar-group" role="group" aria-label="Filtros">
          <div class="cob-field">
            <span class="cob-field-lbl">Nivel</span>
            <div class="cob-seg" role="radiogroup" aria-label="Nivel de la caja">
              <button type="button" [class.on]="nivelF() === 0" (click)="setNivel(0)">Todos</button>
              <button type="button" [class.on]="nivelF() === 1" (click)="setNivel(1)" title="Cuelga directo del PON de la OLT">@if (iconoNivel(1); as u) { <img class="cob-ic" [src]="u" alt=""> } @else { <i class="cob-dot n1"></i> }1er nivel</button>
              <button type="button" [class.on]="nivelF() === 2" (click)="setNivel(2)" title="Cuelga de una caja de 1er nivel">@if (iconoNivel(2); as u) { <img class="cob-ic" [src]="u" alt=""> } @else { <i class="cob-dot n2"></i> }2do nivel</button>
            </div>
          </div>

          <div class="cob-field">
            <span class="cob-field-lbl">Ubicación</span>
            <div class="cob-dd" #ubicDd>
              <button type="button" class="cob-dd-btn cob-dd-ubic" [class.open]="ddUbic()" [class.has]="hayUbic()" (click)="ddUbic.set(!ddUbic())"
                      aria-haspopup="dialog" [attr.aria-expanded]="ddUbic()">
                <i class="pi pi-map-marker cob-dd-pin"></i>
                <span class="cob-dd-txt" [title]="ubicRuta()">{{ ubicResumen() }}</span>
                <i class="pi pi-chevron-down"></i>
              </button>
              @if (ddUbic()) {
                <div class="cob-dd-panel cob-ubic-panel" role="dialog" aria-label="Filtrar por ubicación">
                  <div class="cob-dd-head">
                    <div>
                      <div class="cob-dd-ttl">Ubicación</div>
                      <div class="cob-dd-sub">Puedes marcar varias en cada paso · el número son cajas</div>
                    </div>
                    <button type="button" class="cob-dd-link" (click)="limpiarUbic()" [disabled]="!hayUbic()">Limpiar</button>
                  </div>
                  <div class="cob-ubic-steps">
                    @for (st of ubicPasos(); track st.k; let i = $index) {
                      <div class="cob-ubic-step" [class.off]="st.off" [class.done]="st.sel.length > 0">
                        <span class="cob-ubic-dot">{{ i + 1 }}</span>
                        <div class="cob-ubic-body">
                          <span class="cob-ubic-lbl">{{ st.lbl }}
                            @if (st.sel.length) { <b class="cob-ubic-cnt">{{ st.sel.length }}</b>
                              <button type="button" class="cob-ubic-todas" (click)="limpiarPaso(st.k)">Quitar</button> }
                          </span>
                          @if (st.off) {
                            <div class="cob-ubic-vacio">Elige {{ st.padre }} primero</div>
                          } @else {
                            <div class="cob-ubic-lista" role="listbox" aria-multiselectable="true" [attr.aria-label]="st.lbl">
                              @for (o of st.ops; track o.id) {
                                <button type="button" class="cob-ubic-op" [class.sel]="st.sel.includes(o.id)" (click)="toggleUbic(st.k, o.id)"
                                        role="option" [attr.aria-selected]="st.sel.includes(o.id)">
                                  <span class="cob-dd-chk"><i class="pi pi-check"></i></span>
                                  <span class="cob-ubic-nom">{{ o.nombre }}</span>
                                  <span class="cob-ubic-n">{{ n(o.n) }}</span>
                                </button>
                              } @empty { <div class="cob-ubic-vacio">Sin opciones</div> }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                  <div class="cob-dd-foot">
                    <span><b>{{ n(napsFiltradas().length) }}</b> cajas en el mapa</span>
                    <button type="button" class="cob-dd-ok" (click)="ddUbic.set(false)">Listo</button>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="cob-field">
            <span class="cob-field-lbl">Movimiento</span>
            <div class="cob-dd" #movDd>
              <button type="button" class="cob-dd-btn cob-dd-mov" [class.open]="ddMov()" [class.has]="movTipo() !== ''" (click)="ddMov.set(!ddMov())"
                      aria-haspopup="dialog" [attr.aria-expanded]="ddMov()">
                <i class="pi cob-dd-pin" [class.pi-chart-line]="movTipo() !== 'baja'" [class.pi-sign-out]="movTipo() === 'baja'"></i>
                <span class="cob-dd-txt">{{ movResumen() }}</span>
                <i class="pi pi-chevron-down"></i>
              </button>
              @if (ddMov()) {
                <div class="cob-dd-panel cob-mov-panel" role="dialog" aria-label="Ventas y desinstalaciones">
                  <div class="cob-dd-head">
                    <div>
                      <div class="cob-dd-ttl">Ventas y desinstalaciones</div>
                      <div class="cob-dd-sub">Venta = fecha de instalación · Desinstalación = cliente que ya no está activo, cortado ni para retener</div>
                    </div>
                    <button type="button" class="cob-dd-link" (click)="limpiarMov()" [disabled]="movTipo() === ''">Limpiar</button>
                  </div>
                  <div class="cob-mov-body">
                    <div class="cob-seg cob-mov-tipo" role="radiogroup" aria-label="Tipo">
                      <button type="button" [class.on]="movTipo() === ''" (click)="setMovTipo('')">Ninguno</button>
                      <button type="button" [class.on]="movTipo() === 'venta'" (click)="setMovTipo('venta')">Ventas</button>
                      <button type="button" [class.on]="movTipo() === 'baja'" (click)="setMovTipo('baja')">Desinstalaciones</button>
                    </div>
                    @if (movTipo() !== '') {
                      @if (fechasError()) { <div class="cob-ubic-nota cob-ubic-err"><i class="pi pi-exclamation-circle"></i><span>{{ fechasError() }}</span></div> }
                      <span class="cob-ubic-lbl">Año</span>
                      <div class="cob-mov-anios">
                        @for (a of movAniosOps(); track a.anio) {
                          <button type="button" class="cob-mov-anio" [class.on]="movAnios().includes(a.anio)" (click)="toggleAnio(a.anio)">
                            <b>{{ a.anio }}</b><small>{{ n(a.n) }}</small>
                          </button>
                        } @empty { <span class="cob-ubic-vacio">{{ fechasCargando() ? 'Cargando fechas…' : 'Sin fechas' }}</span> }
                      </div>
                      <span class="cob-ubic-lbl">Rango de fechas</span>
                      <div class="cob-mov-rango">
                        <input type="date" [value]="movDesde()" (change)="setMovFecha('desde', $event)" aria-label="Desde">
                        <span>a</span>
                        <input type="date" [value]="movHasta()" (change)="setMovFecha('hasta', $event)" aria-label="Hasta">
                      </div>
                      @if (movTipo() === 'baja' && movStats().sinFecha > 0) {
                        <div class="cob-ubic-nota"><i class="pi pi-info-circle"></i>
                          <span>{{ n(movStats().sinFecha) }} desinstalados no tienen fecha de baja registrada: salen solo sin filtro de año ni rango.</span></div>
                      }
                    }
                  </div>
                  <div class="cob-dd-foot">
                    <span>@if (movTipo() !== '') { <b>{{ n(movStats().clientes) }}</b> {{ movTipo() === 'venta' ? 'ventas' : 'desinstalaciones' }} · } <b>{{ n(napsFiltradas().length) }}</b> cajas</span>
                    <button type="button" class="cob-dd-ok" (click)="ddMov.set(false)">Listo</button>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="cob-field">
            <span class="cob-field-lbl" [title]="modoCaja() ? 'Clientes atados a la caja de 2do nivel (splitter 1/8 o 1/16).' : 'Clientes del puerto PON del que sale la caja (activos + cortados, de todos los contratos).'">
              {{ modoCaja() ? 'Clientes en la caja' : 'Clientes en el PON' }}
            </span>
            <div class="cob-dd" #cliDd>
              <button type="button" class="cob-dd-btn" [class.open]="ddOpen()" [class.has]="cantSel().length > 0" (click)="ddOpen.set(!ddOpen())"
                      aria-haspopup="listbox" [attr.aria-expanded]="ddOpen()">
                <span class="cob-dd-txt">{{ cliResumen() }}</span>
                @if (cantSel().length > 1) { <span class="cob-dd-badge">{{ cantSel().length }}</span> }
                <i class="pi pi-chevron-down"></i>
              </button>
              @if (ddOpen()) {
                <div class="cob-dd-panel" role="listbox" aria-multiselectable="true">
                  <div class="cob-dd-head">
                    <div>
                      <div class="cob-dd-ttl">{{ modoCaja() ? 'Clientes en la caja' : 'Clientes en el PON' }}</div>
                      <div class="cob-dd-sub">{{ modoCaja() ? 'Cajas de 2do nivel · splitter 1/8 o 1/16' : 'Cantidad exacta · puedes marcar varias' }}</div>
                    </div>
                    <button type="button" class="cob-dd-link" (click)="cantSel.set([]); repintarFiltro()" [disabled]="!cantSel().length">Limpiar</button>
                  </div>

                  @if (opcionCero(); as z) {
                    <button type="button" class="cob-dd-zero" [class.sel]="cliMarcado(0)" (click)="toggleCli(0)" role="option" [attr.aria-selected]="cliMarcado(0)">
                      <span class="cob-dd-chk"><i class="pi pi-check"></i></span>
                      <span class="cob-dd-zero-t"><b>Sin clientes</b><small>Zona libre para vender</small>
                        @if (nivelF() === 0) {
                          <small class="cob-dd-zero-niv">
                            @if (iconoNivel(1); as u) { <img [src]="u" alt=""> } @else { <i class="cob-dot n1"></i> }{{ n(z.c1) }} de 1er
                            · @if (iconoNivel(2); as u) { <img [src]="u" alt=""> } @else { <i class="cob-dot n2"></i> }{{ n(z.c2) }} de 2do
                          </small>
                        }
                      </span>
                      <span class="cob-dd-n">{{ n(z.cajas) }}</span>
                    </button>
                  }

                  @if (rangos().length > 1) {
                    <div class="cob-dd-rangos">
                      @for (r of rangos(); track r.lbl) {
                        <button type="button" class="cob-dd-rango" [class.on]="rangoOn(r)" (click)="toggleRango(r)" [title]="n(r.cajas) + ' cajas'">{{ r.lbl }}</button>
                      }
                    </div>
                  }

                  <div class="cob-dd-grid">
                    @for (o of opcionesNum(); track o.v) {
                      <button type="button" class="cob-dd-tile" [class.sel]="cliMarcado(o.v)" (click)="toggleCli(o.v)" role="option" [attr.aria-selected]="cliMarcado(o.v)"
                              [title]="o.lbl + ' · ' + n(o.cajas) + ' cajas'">
                        <span class="cob-dd-tile-v">{{ modoCaja() && o.v >= 8 ? '8+' : o.v }}</span>
                        <span class="cob-dd-tile-c">{{ n(o.cajas) }} {{ o.cajas === 1 ? 'caja' : 'cajas' }}</span>
                        @if (nivelF() === 0) {
                          <span class="cob-dd-tile-niv" [title]="n(o.c1) + ' de 1er nivel · ' + n(o.c2) + ' de 2do nivel'">
                            <span>@if (iconoNivel(1); as u) { <img [src]="u" alt=""> } @else { <i class="cob-dot n1"></i> }{{ n(o.c1) }}</span>
                            <span>@if (iconoNivel(2); as u) { <img [src]="u" alt=""> } @else { <i class="cob-dot n2"></i> }{{ n(o.c2) }}</span>
                          </span>
                        }
                      </button>
                    } @empty {
                      <div class="cob-dd-empty">Cargando cantidades…</div>
                    }
                  </div>

                  @if (nivelF() === 0) {
                    <div class="cob-dd-niv">
                      <div class="cob-dd-niv-row">
                        @if (iconoNivel(1); as u) { <img class="cob-ic" [src]="u" alt=""> } @else { <i class="cob-dot n1"></i> }
                        <span class="cob-dd-niv-lbl">1er nivel</span>
                        <span><b>{{ n(resumenNivel().c1) }}</b> cajas</span>
                        <span class="cob-dd-niv-sep">·</span>
                        <span><b>{{ n(resumenNivel().k1) }}</b> clientes</span>
                      </div>
                      <div class="cob-dd-niv-row">
                        @if (iconoNivel(2); as u) { <img class="cob-ic" [src]="u" alt=""> } @else { <i class="cob-dot n2"></i> }
                        <span class="cob-dd-niv-lbl">2do nivel</span>
                        <span><b>{{ n(resumenNivel().c2) }}</b> cajas</span>
                        <span class="cob-dd-niv-sep">·</span>
                        <span><b>{{ n(resumenNivel().k2) }}</b> clientes</span>
                      </div>
                    </div>
                  }
                  <div class="cob-dd-foot">
                    <span><b>{{ n(napsFiltradas().length) }}</b> cajas en el mapa</span>
                    <button type="button" class="cob-dd-ok" (click)="ddOpen.set(false)">Listo</button>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="cob-result" [class.on]="filtroCajasActivo()" title="Cajas que cumplen el filtro en todo el mapa">
            <span class="cob-result-n">{{ n(napsFiltradas().length) }}</span>
            <span class="cob-result-lbl">cajas</span>
            @if (nivelF() === 0) { <span class="cob-result-sub">{{ n(cajasNivel().n1) }} 1er · {{ n(cajasNivel().n2) }} 2do</span> }
            @if (movTipo() !== '') { <span class="cob-result-sub cob-result-mov">{{ n(movStats().clientes) }} {{ movTipo() === 'venta' ? 'ventas' : 'bajas' }}</span> }
            @if (filtroCajasActivo()) {
              <button type="button" class="cob-result-x" (click)="limpiarFiltro()" title="Quitar filtros" aria-label="Quitar filtros"><i class="pi pi-times"></i></button>
            }
          </div>
        </div>

        <div class="cob-bar-group cob-bar-end">
          <div class="cob-field">
          <span class="cob-field-lbl">Mapa</span>
          <div class="cob-tools" role="group" aria-label="Vista del mapa">
            <button type="button" [class.on]="verNombres()" (click)="onToggleNombres()" title="Mostrar los nombres de las cajas"><i class="pi pi-tag"></i><span>Nombres</span></button>
            <button type="button" [class.on]="satOn()" (click)="toggleSat()" title="Cambiar entre calles y satélite"><i class="pi" [class.pi-map]="satOn()" [class.pi-globe]="!satOn()"></i><span>{{ satOn() ? 'Calles' : 'Satélite' }}</span></button>
            <button type="button" [class.on]="zonasOn()" (click)="toggleZonas()" title="Barrios coloreados por cantidad de clientes"><i class="pi pi-th-large"></i><span>Zonas</span></button>
            <button type="button" [class.on]="vistaTabla()" (click)="vistaTabla.set(!vistaTabla())" title="Ver las cajas del filtro en una tabla"><i class="pi" [class.pi-table]="!vistaTabla()" [class.pi-map]="vistaTabla()"></i><span>{{ vistaTabla() ? 'Mapa' : 'Tabla' }}</span></button>
          </div>
          </div>
          @if (zonasOn()) {
            <div class="cob-select">
              <select (change)="onZonaMetric($event)" aria-label="Métrica de zonas">
                <option value="total" [selected]="zonaMetric() === 'total'">Total clientes</option>
                <option value="activos" [selected]="zonaMetric() === 'activos'">Activos</option>
                <option value="cortados" [selected]="zonaMetric() === 'cortados'">Cortados/Susp.</option>
                <option value="otros" [selected]="zonaMetric() === 'otros'">Bajas</option>
              </select>
              <i class="pi pi-chevron-down"></i>
            </div>
          }
          <button type="button" class="cob-primary" (click)="descargarExcel()" title="Descargar a Excel los clientes de las cajas que cumplen el filtro">
            <i class="pi pi-file-excel"></i><span>Exportar</span>
          </button>
        </div>
      </div>

      <!-- La fila de "Capas de conexión" y los contadores por calidad/estado se quitaron: esta pantalla
           es para VENTAS (mapa de calor + cajas con cupo). Las conexiones de una caja se ven al hacerle clic. -->

      @if (error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-1.5">{{ error() }}</div>
      }

      <div class="flex-1 relative min-h-0">
        <div #mapEl class="cob-map absolute inset-0 rounded-lg overflow-hidden border border-slate-200"></div>

        @if (vistaTabla()) {
          <div class="cob-tabla">
            <div class="cob-tabla-head">
              <b>{{ n(filasTabla().length) }}</b> <span>cajas{{ filtroCajasActivo() ? ' del filtro' : '' }}</span>
              <div class="cob-tabla-q">
                <i class="pi pi-search"></i>
                <input [value]="tablaQ()" (input)="tablaQ.set($any($event.target).value); tablaPag.set(1)" placeholder="Buscar caja, barrio, OLT…">
              </div>
            </div>
            <div class="cob-tabla-scroll">
              <table>
                <thead><tr>
                  @for (c of colsTabla(); track c.k) {
                    <th [class.num]="c.num" [style.width.%]="anchoCol(c.k)" [title]="c.lbl" (click)="ordenarTabla(c.k)">{{ c.lbl }}@if (tablaOrd().k === c.k) { <i class="pi" [class.pi-arrow-up]="tablaOrd().dir > 0" [class.pi-arrow-down]="tablaOrd().dir < 0"></i> }</th>
                  }
                </tr></thead>
                <tbody>
                  @for (f of filasVisibles(); track f.id) {
                    <tr (click)="irACaja(f.id)" title="Ver en el mapa">
                      <td class="b">{{ f.caja }}</td>
                      <td>{{ f.nivel }}</td>
                      <td [title]="f.provincia">{{ f.provincia }}</td>
                      <td [title]="f.canton">{{ f.canton }}</td>
                      <td [title]="f.parroquia">{{ f.parroquia }}</td>
                      <td [title]="f.barrio">{{ f.barrio }}</td>
                      <td class="mono" [title]="f.pon">{{ f.pon }}</td>
                      <td class="num">{{ f.clientes }}</td>
                      <td class="num">{{ f.clientesPon ?? '—' }}</td>
                      @if (movTipo() !== '') { <td class="num b">{{ f.mov }}</td> }
                    </tr>
                  } @empty {
                    <tr><td [attr.colspan]="colsTabla().length" class="cob-tabla-vacio">Ninguna caja cumple el filtro.</td></tr>
                  }
                </tbody>
              </table>
              @if (filasVisibles().length < filasTabla().length) {
                <button type="button" class="cob-tabla-mas" (click)="tablaPag.set(tablaPag() + 1)">
                  Mostrar más ({{ n(filasTabla().length - filasVisibles().length) }} restantes)
                </button>
              }
            </div>
          </div>
        }

        @if (panelOpen()) {
          <aside class="cob-side">
            <div class="cob-side-head">
              <div class="min-w-0">
                <div class="cob-eyebrow">Clientes de la NAP</div>
                <div class="cob-title" [title]="titulo()">{{ titulo() }}</div>
              </div>
              <button class="cob-x" (click)="cerrar()" title="Cerrar">×</button>
            </div>

            @if (esNap1()) {
              <div class="cob-wiz">
                <div class="cob-wiz-h"><i class="pi pi-bolt"></i> Confirmador de PON de esta NAP</div>
                @if (napPons().length) {
                  <div class="cob-wiz-chips">
                    @for (p of napPons(); track p.idRedNapPon) {
                      <span class="cob-wiz-chip">{{ p.oltNombre || 'OLT' }} · {{ napPonLabel(p) }}
                        <button class="cob-wiz-x" (click)="quitarPon(p)" [disabled]="wizBusy()" title="Quitar amarre">×</button>
                      </span>
                    }
                  </div>
                } @else {
                  <button class="cob-btn" (click)="openPicker()" [disabled]="wizBusy()">＋ Amarrar OLT / LPU-PON</button>
                }
                @if (wizErr()) { <div class="cob-wiz-err">{{ wizErr() }}</div> }
              </div>
            }

            @if (napCli(); as d) {
              <div class="cob-meta">
                <div class="cob-splitter">
                  <span class="cob-splitter-lbl">Splitter</span>
                  <div class="cob-seg">
                    <span class="cob-seg-btn" [class.active]="d.splitter === '1/8'">1/8</span>
                    <span class="cob-seg-btn" [class.active]="d.splitter === '1/16'">1/16</span>
                  </div>
                </div>
                @if (puertos(); as pt) {
                  <div class="cob-counter" [title]="pt.detalle">
                    <div><b>{{ pt.ocupados }}</b> / {{ pt.total }} <span class="cob-mut">puertos</span></div>
                    @if (pt.exceso > 0) {
                      <div class="cob-disp full">+{{ pt.exceso }} sobre la capacidad</div>
                    } @else {
                      <div class="cob-disp" [class.full]="pt.disponibles === 0">{{ pt.disponibles }} disponibles</div>
                    }
                  </div>
                }
              </div>
            }

            <div class="cob-side-body">
              <div class="cob-sec">Historial de clientes en la caja · {{ historialCaja().total }}</div>
              @if (historialCaja().filas.length) {
                <ul class="cob-hist">
                  @for (h of historialCaja().filas; track h.estado) {
                    <li class="cob-hist-row">
                      <span class="cob-hist-dot" [class]="'cob-hist-dot ' + estadoClase(h.estado)"></span>
                      <span class="cob-hist-lbl" [title]="h.estado">{{ h.estado }}</span>
                      <span class="cob-hist-bar"><i [style.width.%]="h.pct"></i></span>
                      <span class="cob-hist-n">{{ h.n }}</span>
                    </li>
                  }
                </ul>
              } @else if (loadingCli()) {
                <div class="cob-empty">Cargando…</div>
              } @else {
                <div class="cob-empty">Sin clientes en esta caja.</div>
              }
            </div>
          </aside>
        }
      </div>

      @if (pickerOpen()) {
        <div class="cob-modal-back" (click)="closePicker()">
          <div class="cob-modal" (click)="$event.stopPropagation()">
            <div class="cob-modal-head">
              @if (pickerStep() === 'olt') {
                <div class="cob-modal-title"><i class="pi pi-sitemap"></i> Elegí la OLT <span class="cob-modal-sub">clic para ver sus LPU-PON</span></div>
              } @else {
                <div class="cob-modal-title">
                  <button class="cob-modal-back-btn" (click)="volverOlt()" title="Volver a OLTs">‹</button>
                  <i class="pi pi-map-marker"></i> Elegí LPU-PON <span class="cob-modal-sub">{{ wizOlt()?.nombre }} · tarjeta/puerto</span>
                </div>
              }
              <button class="cob-x" (click)="closePicker()" title="Cerrar">×</button>
            </div>
            <div class="cob-modal-body">
              @if (pickerStep() === 'olt') {
                @if (olts().length) {
                  <div class="cob-olt-grid">
                    @for (o of olts(); track o.idRedOlt) {
                      <button class="cob-olt-card" (click)="pickOlt(o)">
                        <div class="cob-olt-name">{{ o.nombre }}</div>
                        <div class="cob-olt-ip">{{ o.ip || '—' }}</div>
                      </button>
                    }
                  </div>
                } @else {
                  <div class="cob-empty">No hay OLTs registradas.</div>
                }
              } @else {
                @if (loadingPons()) {
                  <div class="cob-empty">Cargando LPU-PON…</div>
                } @else if (wizPons().length) {
                  <div class="cob-pon-grid">
                    @for (lp of wizPons(); track lpLabel(lp)) {
                      <button class="cob-pon-btn"
                              [class.on]="enEstaNap(lp)"
                              [class.taken]="enOtraNap(lp)"
                              [disabled]="wizBusy() || enEstaNap(lp) || enOtraNap(lp)"
                              [title]="enOtraNap(lp) ? ('Ya amarrado a la NAP ' + (lp.napCodigo || '')) : (enEstaNap(lp) ? 'Amarrado a esta NAP' : 'Amarrar a esta NAP')"
                              (click)="pickLpuPon(lp)">
                        <span>{{ lpLabel(lp) }}</span>
                        @if (enOtraNap(lp)) { <span class="cob-pon-nap"><i class="pi pi-lock"></i> {{ lp.napCodigo }}</span> }
                      </button>
                    }
                  </div>
                } @else {
                  <div class="cob-empty">Esta OLT no tiene LPU-PON con clientes.</div>
                }
                @if (wizErr()) { <div class="cob-wiz-err">{{ wizErr() }}</div> }
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `:host{display:block;height:100%;width:100%;}
     .cob-map{background:#eef2f7;}
     .cob-sel{border:1px solid #cbd5e1;border-radius:.375rem;padding:.15rem .4rem;font-size:.75rem;color:#475569;background:#fff;}
     /* ---- Barra superior (una sola fila) ---- */
     .cob-bar{display:flex;align-items:flex-end;flex-wrap:wrap;gap:.5rem 1rem;background:#fff;border:1px solid #e2e8f0;border-radius:10px;
              padding:.5rem .75rem;box-shadow:0 1px 2px rgba(15,23,42,.04);}
     .cob-bar-title{display:flex;flex-direction:column;justify-content:flex-end;min-width:0;height:44px;padding-right:1rem;border-right:1px solid #e2e8f0;}
     /* Cabecera en dos filas: arriba titulo + mapa/exportar; abajo, todos los filtros en una linea. */
     .cob-bar{display:grid !important;grid-template-columns:minmax(0,1fr) auto;column-gap:1rem;row-gap:.55rem;align-items:center;}
     .cob-bar>.cob-bar-title{grid-column:1;grid-row:1;flex-direction:row;align-items:baseline;justify-content:flex-start;gap:.6rem;height:auto;padding:0;border-right:0;}
     .cob-bar>.cob-bar-title h2{font-size:15px;}
     .cob-bar>.cob-bar-title span{display:inline !important;}
     .cob-bar>.cob-bar-end{grid-column:2;grid-row:1;margin-left:0;}
     .cob-bar>.cob-bar-end .cob-field{flex-direction:row;align-items:center;gap:.45rem;}
     .cob-bar>.cob-bar-group:not(.cob-bar-end){grid-column:1 / -1;grid-row:2;flex-wrap:wrap;padding-top:.55rem;border-top:1px solid #f1f5f9;}
     .cob-bar>.cob-bar-group:not(.cob-bar-end)>.cob-result{margin-left:auto;align-self:flex-end;}
     .cob-bar-title h2{margin:0;font-size:14px;font-weight:700;color:#0f172a;line-height:1.25;white-space:nowrap;}
     .cob-bar-title span{font-size:11px;color:#94a3b8;white-space:nowrap;line-height:1.5;}
     .cob-bar-group{display:flex;align-items:flex-end;gap:.6rem;}
     .cob-bar-end{margin-left:auto;}
     .cob-field{display:flex;flex-direction:column;gap:2px;}
     .cob-field-lbl{font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;padding-left:1px;line-height:12px;white-space:nowrap;}
     .cob-seg{display:inline-flex;height:30px;padding:2px;background:#f1f5f9;border-radius:7px;gap:2px;}
     .cob-seg button{display:inline-flex;align-items:center;gap:.35rem;border:0;background:transparent;padding:0 .65rem;font-size:12px;font-weight:600;color:#64748b;
                     border-radius:5px;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s;white-space:nowrap;}
     .cob-seg button:hover{color:#0f172a;}
     .cob-seg button.on{background:#fff;color:#0f172a;box-shadow:0 1px 2px rgba(15,23,42,.14);}
     .cob-dot{display:inline-block;width:8px;height:8px;border-radius:50%;}
     .cob-dot.n1{background:#7b0061;} .cob-dot.n2{background:#0d9488;}
     .cob-ic{width:14px;height:14px;object-fit:contain;}
     .cob-dd{position:relative;}
     .cob-dd-btn{display:inline-flex;align-items:center;gap:.4rem;height:30px;min-width:11.5rem;max-width:16rem;padding:0 .6rem 0 .65rem;border:1px solid #e2e8f0;
                 border-radius:7px;background:#fff;font-size:12px;font-weight:500;color:#0f172a;cursor:pointer;transition:border-color .15s,box-shadow .15s;}
     .cob-dd-btn:hover{border-color:#cbd5e1;}
     .cob-dd-btn.open,.cob-dd-btn:focus-visible{outline:none;border-color:#7b0061;box-shadow:0 0 0 3px rgba(123,0,97,.15);}
     .cob-dd-btn.has{border-color:#e9a8d8;background:#fdf2f8;}
     .cob-dd-txt{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
     .cob-dd-badge{font-size:10px;font-weight:700;color:#fff;background:#7b0061;border-radius:999px;padding:0 .4rem;line-height:16px;}
     .cob-dd-btn i{font-size:9px;color:#94a3b8;transition:transform .15s;}
     .cob-dd-btn.open i{transform:rotate(180deg);}
     .cob-dd-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:1200;width:19rem;background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                   box-shadow:0 16px 40px rgba(15,23,42,.16),0 2px 6px rgba(15,23,42,.06);overflow:hidden;animation:cobDd .12s ease-out;}
     @keyframes cobDd{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}
     .cob-dd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;padding:.7rem .8rem .55rem;}
     .cob-dd-ttl{font-size:13px;font-weight:700;color:#0f172a;}
     .cob-dd-sub{font-size:11px;color:#94a3b8;margin-top:1px;}
     .cob-dd-link{border:0;background:transparent;color:#7b0061;font-size:11.5px;font-weight:600;cursor:pointer;padding:.15rem .35rem;border-radius:5px;}
     .cob-dd-link:hover:not(:disabled){background:#fdf2f8;}
     .cob-dd-link:disabled{color:#cbd5e1;cursor:default;}
     .cob-dd-zero{display:flex;align-items:center;gap:.6rem;width:calc(100% - 1.2rem);margin:0 .6rem .55rem;padding:.5rem .6rem;border:1px solid #bbf7d0;
                  border-radius:9px;background:#f0fdf4;cursor:pointer;text-align:left;transition:border-color .15s,background .15s;}
     .cob-dd-zero:hover{border-color:#86efac;}
     .cob-dd-zero.sel{background:#dcfce7;border-color:#16a34a;}
     .cob-dd-zero-t{flex:1;display:flex;flex-direction:column;line-height:1.2;}
     .cob-dd-zero-t b{font-size:12.5px;color:#14532d;}
     .cob-dd-zero-t small{font-size:10.5px;color:#16a34a;}
     .cob-dd-chk{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1.5px solid #86efac;border-radius:4px;background:#fff;}
     .cob-dd-chk i{font-size:9px;color:#fff;opacity:0;}
     .cob-dd-zero.sel .cob-dd-chk{background:#16a34a;border-color:#16a34a;}
     .cob-dd-zero.sel .cob-dd-chk i{opacity:1;}
     .cob-dd-n{font-size:11px;font-weight:700;color:#166534;background:#fff;border-radius:999px;padding:0 .5rem;line-height:18px;font-variant-numeric:tabular-nums;}
     .cob-dd-rangos{display:flex;gap:.3rem;padding:0 .6rem .5rem;flex-wrap:wrap;}
     .cob-dd-rango{flex:1;min-width:0;height:24px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;font-size:11px;font-weight:600;color:#475569;
                   cursor:pointer;white-space:nowrap;transition:all .15s;}
     .cob-dd-rango:hover{border-color:#cbd5e1;color:#0f172a;}
     .cob-dd-rango.on{background:#7b0061;border-color:#7b0061;color:#fff;}
     .cob-dd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem;max-height:248px;overflow-y:auto;padding:.1rem .6rem .6rem;
                  scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent;overscroll-behavior:contain;}
     .cob-dd-grid::-webkit-scrollbar{width:6px;}
     .cob-dd-grid::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px;}
     .cob-dd-grid::-webkit-scrollbar-button{display:none;height:0;}
     .cob-dd-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;height:44px;border:1px solid #e2e8f0;border-radius:8px;
                  background:#fff;cursor:pointer;transition:border-color .12s,background .12s,transform .12s;}
     .cob-dd-tile:hover{border-color:#e9a8d8;background:#fdf7fb;}
     .cob-dd-tile:active{transform:scale(.97);}
     .cob-dd-tile-v{font-size:14px;font-weight:700;color:#0f172a;line-height:1;font-variant-numeric:tabular-nums;}
     .cob-dd-tile-c{font-size:9.5px;color:#94a3b8;white-space:nowrap;}
     .cob-dd-tile:has(.cob-dd-tile-niv){height:58px;}
     .cob-dd-tile-niv{display:flex;gap:.35rem;font-size:9.5px;font-weight:600;color:#64748b;line-height:1;font-variant-numeric:tabular-nums;}
     .cob-dd-tile-niv span{display:inline-flex;align-items:center;gap:1px;}
     .cob-dd-tile-niv img,.cob-dd-zero-niv img{width:9px;height:9px;object-fit:contain;}
     .cob-dd-tile-niv .cob-dot,.cob-dd-zero-niv .cob-dot{width:6px;height:6px;}
     .cob-dd-tile.sel .cob-dd-tile-niv{color:#fbe7f5;}
     .cob-dd-zero-niv{display:inline-flex;align-items:center;gap:.2rem;color:#15803d !important;margin-top:1px;}
     .cob-dd-tile.sel{background:#7b0061;border-color:#7b0061;}
     .cob-dd-tile.sel .cob-dd-tile-v{color:#fff;}
     .cob-dd-tile.sel .cob-dd-tile-c{color:#f5d0ec;}
     .cob-dd-tile:focus-visible,.cob-dd-rango:focus-visible,.cob-dd-zero:focus-visible,.cob-dd-ok:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(123,0,97,.2);}
     .cob-dd-empty{grid-column:1/-1;padding:.8rem;font-size:12px;color:#94a3b8;text-align:center;}
     .cob-dd-foot{display:flex;align-items:center;justify-content:space-between;padding:.5rem .6rem .5rem .8rem;border-top:1px solid #f1f5f9;background:#f8fafc;
                  font-size:11.5px;color:#64748b;}
     .cob-dd-foot b{color:#0f172a;font-variant-numeric:tabular-nums;}
     .cob-dd-niv{display:flex;flex-direction:column;gap:.3rem;padding:.5rem .8rem;border-top:1px solid #f1f5f9;background:#fff;font-size:11.5px;color:#64748b;}
     .cob-dd-niv-row{display:flex;align-items:center;gap:.4rem;}
     .cob-dd-niv-row b{color:#0f172a;font-variant-numeric:tabular-nums;}
     .cob-dd-niv-lbl{min-width:4.6rem;font-weight:600;color:#334155;}
     .cob-dd-niv-sep{color:#cbd5e1;}
     .cob-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.15rem;}
     .cob-hist-row{display:flex;align-items:center;gap:.55rem;padding:.45rem .5rem;border-radius:8px;}
     .cob-hist-row:hover{background:#f8fafc;}
     .cob-hist-dot{flex:none;width:9px;height:9px;border-radius:50%;background:#94a3b8;}
     .cob-hist-dot.is-activo{background:#16a34a;}
     .cob-hist-dot.is-suspendido{background:#f59e0b;}
     .cob-hist-dot.is-baja{background:#94a3b8;}
     .cob-hist-lbl{flex:0 1 auto;min-width:0;max-width:55%;font-size:12.5px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
     .cob-hist-bar{flex:1;height:6px;border-radius:999px;background:#f1f5f9;overflow:hidden;}
     .cob-hist-bar i{display:block;height:100%;border-radius:999px;background:#cbd5e1;}
     .cob-hist-row:has(.is-activo) .cob-hist-bar i{background:#86efac;}
     .cob-hist-row:has(.is-suspendido) .cob-hist-bar i{background:#fcd34d;}
     .cob-hist-n{flex:none;min-width:1.8rem;text-align:right;font-size:13px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;}
     .cob-dd-ok{height:26px;padding:0 .8rem;border:0;border-radius:6px;background:#7b0061;color:#fff;font-size:11.5px;font-weight:600;cursor:pointer;}
     .cob-dd-ok:hover{background:#5f004b;}
     .cob-dd-ubic{min-width:10.5rem;max-width:14rem;}
     .cob-dd-pin{font-size:11px !important;color:#7b0061 !important;transform:none !important;}
     .cob-dd-mov{min-width:9.5rem;max-width:14rem;}
     .cob-mov-panel{width:21rem;}
     .cob-mov-body{display:flex;flex-direction:column;gap:.45rem;padding:0 .8rem .7rem;}
     .cob-mov-tipo{width:100%;}
     .cob-mov-tipo button{flex:1;}
     .cob-mov-anios{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}
     .cob-mov-anio{display:flex;flex-direction:column;align-items:center;gap:1px;padding:.3rem 0;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;}
     .cob-mov-anio b{font-size:12.5px;color:#334155;} .cob-mov-anio small{font-size:10.5px;color:#94a3b8;}
     .cob-mov-anio.on{background:#7b0061;border-color:#7b0061;} .cob-mov-anio.on b,.cob-mov-anio.on small{color:#fff;}
     .cob-mov-rango{display:flex;align-items:center;gap:.4rem;font-size:12px;color:#64748b;}
     .cob-mov-rango input{flex:1;min-width:0;height:30px;border:1px solid #e2e8f0;border-radius:7px;padding:0 .4rem;font-size:12px;color:#334155;}
     .cob-result-mov{color:#7b0061;font-weight:600;}
     .cob-tabla{position:absolute;inset:0;z-index:1100;display:flex;flex-direction:column;background:#fff;border:1px solid #e2e8f0;border-radius:.5rem;overflow:hidden;}
     .cob-tabla-head{display:flex;align-items:center;gap:.4rem;padding:.55rem .8rem;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;}
     .cob-tabla-head b{color:#0f172a;font-size:15px;}
     .cob-tabla-q{position:relative;margin-left:auto;}
     .cob-tabla-q i{position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8;}
     .cob-tabla-q input{height:30px;width:16rem;border:1px solid #e2e8f0;border-radius:7px;padding:0 .6rem 0 1.7rem;font-size:12.5px;}
     .cob-tabla-scroll{flex:1;overflow-y:auto;overflow-x:hidden;}
     .cob-tabla table{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed;}
     .cob-tabla th{position:sticky;top:0;z-index:1;background:#f8fafc;text-align:left;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;
       color:#64748b;padding:.5rem .6rem;border-bottom:1px solid #e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;user-select:none;}
     .cob-tabla th.num{text-align:right;}
     .cob-tabla th:hover{color:#7b0061;}
     .cob-tabla th i{font-size:9px;margin-left:4px;}
     .cob-tabla td{padding:.42rem .6rem;border-bottom:1px solid #f1f5f9;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
     .cob-tabla td.b,.cob-tabla td.num{white-space:nowrap;}
     .cob-tabla tbody tr{cursor:pointer;} .cob-tabla tbody tr:hover td{background:#fdf2f8;}
     .cob-tabla .num{text-align:right;font-variant-numeric:tabular-nums;}
     .cob-tabla .b{font-weight:600;color:#0f172a;}
     .cob-tabla .mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:#475569;}
     .cob-tabla-vacio{text-align:center;color:#94a3b8;padding:2rem !important;}
     .cob-tabla-mas{display:block;margin:.6rem auto;border:1px solid #e2e8f0;background:#fff;border-radius:7px;padding:.35rem .9rem;font-size:12.5px;color:#7b0061;cursor:pointer;}
     /* Ubicacion: los 4 pasos en COLUMNAS (sin scroll del panel). Cada lista se desplaza sola, con barra fina. */
     .cob-ubic-panel{width:min(62rem, calc(100vw - 2rem));max-height:none;overflow:visible;}
     .cob-ubic-panel .cob-ubic-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem;padding:.1rem .8rem .75rem;}
     .cob-ubic-panel .cob-ubic-step{gap:.45rem;padding:0;}
     .cob-ubic-panel .cob-ubic-step::after{display:none;}
     .cob-ubic-panel .cob-ubic-dot{margin-top:0;width:19px;height:19px;font-size:10px;}
     .cob-ubic-panel .cob-ubic-lbl{display:flex;align-items:center;min-height:19px;}
     .cob-ubic-panel .cob-ubic-lista{height:15rem;max-height:none;}
    .cob-ubic-panel .cob-ubic-op{align-items:flex-start;}
    .cob-ubic-panel .cob-ubic-nom{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25;word-break:normal;overflow-wrap:break-word;hyphens:none;}
    .cob-ubic-panel .cob-ubic-n{padding-top:1px;}
     .cob-ubic-panel .cob-ubic-vacio{display:flex;align-items:center;justify-content:center;height:15rem;border:1px dashed #e2e8f0;border-radius:8px;
       text-align:center;padding:0 .6rem;}
     .cob-ubic-lista,.cob-tabla-scroll,.cob-dd-panel{scrollbar-width:thin;scrollbar-color:#e2e8f0 transparent;}
     .cob-ubic-lista::-webkit-scrollbar,.cob-tabla-scroll::-webkit-scrollbar,.cob-dd-panel::-webkit-scrollbar{width:6px;height:6px;}
     .cob-ubic-lista::-webkit-scrollbar-thumb,.cob-tabla-scroll::-webkit-scrollbar-thumb,.cob-dd-panel::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:6px;}
     .cob-ubic-lista::-webkit-scrollbar-thumb:hover,.cob-tabla-scroll::-webkit-scrollbar-thumb:hover{background:#cbd5e1;}
     .cob-ubic-lista::-webkit-scrollbar-track,.cob-tabla-scroll::-webkit-scrollbar-track{background:transparent;}
     .cob-ubic-panel .cob-ubic-lista .cob-ubic-vacio{height:auto;border:0;padding:.6rem;}
     @media (max-width: 900px){ .cob-ubic-panel .cob-ubic-steps{grid-template-columns:repeat(2,minmax(0,1fr));} }
     .cob-ubic-cnt{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;margin-left:4px;border-radius:8px;
       background:#7b0061;color:#fff;font-size:10px;}
     .cob-ubic-todas{margin-left:6px;border:0;background:none;color:#7b0061;font-size:10.5px;font-weight:600;cursor:pointer;text-transform:none;letter-spacing:0;}
     .cob-ubic-lista{max-height:9.5rem;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:2px;background:#fff;}
     .cob-ubic-op{display:flex;align-items:center;gap:.45rem;width:100%;padding:.3rem .45rem;border:0;border-radius:6px;background:none;cursor:pointer;
       font-size:12.5px;color:#334155;text-align:left;}
     .cob-ubic-op:hover{background:#f8fafc;}
     .cob-ubic-op.sel{background:#fdf2f8;color:#7b0061;font-weight:600;}
     .cob-ubic-op .cob-dd-chk{flex:none;}
     .cob-ubic-op.sel .cob-dd-chk{background:#7b0061;border-color:#7b0061;color:#fff;}
     .cob-ubic-nom{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
     .cob-ubic-n{flex:none;font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums;}
     .cob-ubic-vacio{font-size:12px;color:#cbd5e1;padding:.35rem 0;}
     .cob-ubic-steps{display:flex;flex-direction:column;gap:.15rem;padding:0 .8rem .6rem;}
     .cob-ubic-step{position:relative;display:flex;gap:.6rem;padding:.25rem 0;}
     .cob-ubic-step:not(:last-child)::after{content:"";position:absolute;left:10px;top:28px;bottom:-6px;width:1.5px;background:#e2e8f0;}
     .cob-ubic-step.done:not(:last-child)::after{background:#e9a8d8;}
     .cob-ubic-dot{flex:none;display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;margin-top:15px;border-radius:50%;
                   background:#f1f5f9;color:#64748b;font-size:10.5px;font-weight:700;border:1.5px solid #e2e8f0;}
     .cob-ubic-step.done .cob-ubic-dot{background:#7b0061;border-color:#7b0061;color:#fff;}
     .cob-ubic-step.off .cob-ubic-dot{color:#cbd5e1;}
     .cob-ubic-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
     .cob-ubic-lbl{font-size:10.5px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;}
     .cob-ubic-step.off .cob-ubic-lbl{color:#cbd5e1;}
     .cob-ubic-sel{display:flex;}
     .cob-ubic-sel select{width:100%;min-width:0;}
     .cob-ubic-sel select:disabled{background:#f8fafc;color:#cbd5e1;cursor:not-allowed;}
     .cob-ubic-step.done .cob-ubic-sel select{border-color:#e9a8d8;font-weight:600;}
     .cob-ubic-nota{display:flex;gap:.4rem;align-items:flex-start;margin:0 .8rem .6rem;padding:.45rem .55rem;border-radius:7px;background:#f8fafc;
                    font-size:10.5px;color:#64748b;line-height:1.35;}
     .cob-ubic-nota i{font-size:11px;margin-top:1px;color:#94a3b8;}
     .cob-ubic-err{background:#fef2f2;color:#b91c1c;} .cob-ubic-err i{color:#dc2626;}
     @media (max-width: 1440px){ .cob-result-sub{display:none;} .cob-bar-title span{display:none;} }
     .cob-select{position:relative;display:inline-flex;align-items:center;}
     .cob-select select{appearance:none;-webkit-appearance:none;height:30px;min-width:10.5rem;padding:0 1.8rem 0 .65rem;border:1px solid #e2e8f0;border-radius:7px;
                        background:#fff;font-size:12px;font-weight:500;color:#0f172a;cursor:pointer;transition:border-color .15s,box-shadow .15s;}
     .cob-select select:hover{border-color:#cbd5e1;}
     .cob-select i{position:absolute;right:.6rem;font-size:9px;color:#94a3b8;pointer-events:none;}
     .cob-seg button:focus-visible,.cob-select select:focus-visible,.cob-tools button:focus-visible,.cob-primary:focus-visible,.cob-result-x:focus-visible{
                        outline:none;box-shadow:0 0 0 3px rgba(123,0,97,.18);border-color:#7b0061;}
     .cob-result{display:inline-flex;align-items:baseline;gap:.35rem;height:30px;line-height:28px;padding:0 .3rem 0 .7rem;border:1px solid #e2e8f0;border-radius:7px;
                 background:#f8fafc;white-space:nowrap;transition:background .15s,border-color .15s;}
     .cob-result.on{background:#fdf2f8;border-color:#f5c2e7;}
     .cob-result-n{font-size:15px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;}
     .cob-result.on .cob-result-n{color:#7b0061;}
     .cob-result-lbl{font-size:12px;font-weight:600;color:#475569;}
     .cob-result-sub{font-size:11px;color:#94a3b8;padding-left:.35rem;border-left:1px solid #e2e8f0;margin-left:.1rem;}
     .cob-result-x{align-self:center;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:0;border-radius:5px;
                   background:transparent;color:#a21caf;cursor:pointer;}
     .cob-result-x:hover{background:#fae8ff;}
     .cob-result-x i{font-size:9px;}
     .cob-result:not(.on){padding-right:.7rem;}
     .cob-tools{display:inline-flex;height:30px;border:1px solid #e2e8f0;border-radius:7px;overflow:hidden;background:#fff;}
     .cob-tools button{display:inline-flex;align-items:center;gap:.35rem;border:0;border-right:1px solid #e2e8f0;background:#fff;padding:0 .6rem;font-size:12px;
                       font-weight:500;color:#475569;cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;}
     .cob-tools button:last-child{border-right:0;}
     .cob-tools button:hover{background:#f8fafc;color:#0f172a;}
     .cob-tools button.on{background:#fdf2f8;color:#7b0061;font-weight:600;}
     .cob-tools i{font-size:12px;}
     .cob-primary{display:inline-flex;align-items:center;gap:.4rem;height:30px;padding:0 .85rem;border:1px solid #7b0061;border-radius:7px;background:#7b0061;
                  color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,box-shadow .15s;}
     .cob-primary:hover{background:#5f004b;box-shadow:0 2px 6px rgba(123,0,97,.25);}
     .cob-primary i{font-size:12px;}
     @media (max-width: 1100px){ .cob-tools span{display:none;} .cob-tools button{padding:0 .7rem;} }
     @media (max-width: 1180px){ .cob-bar-title span{display:none;} .cob-result-sub{display:none;} }
     @media (max-width: 900px){ .cob-bar{flex-wrap:wrap;} .cob-bar-group{flex-wrap:wrap;} .cob-bar-end{margin-left:0;} .cob-bar-title{border-right:0;height:auto;} }
     .cob-cajas{font-size:11px;color:#64748b;border:1px solid #e2e8f0;border-radius:999px;padding:.1rem .55rem;background:#f8fafc;white-space:nowrap;}
     .cob-cajas b{color:#0f172a;}
     .cob-cajas-on{border-color:#7b0061;background:#fdf2f8;color:#7b0061;}
     .cob-cajas-on b{color:#7b0061;}
     .cob-btn{font-size:.75rem;padding:.25rem .6rem;border-radius:.375rem;border:1px solid #2563eb;background:#2563eb;color:#fff;cursor:pointer;}
     .cob-btn:disabled{opacity:.5;cursor:default;}
     .cob-toggle{font-size:.75rem;padding:.25rem .6rem;border-radius:.375rem;border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;}
     .cob-toggle:hover{border-color:#f97316;color:#c2410c;}
     .cob-toggle-on{background:#fff7ed;border-color:#f97316;color:#c2410c;font-weight:600;}
     .cob-map .leaflet-div-icon{background:transparent;border:none;}
     .cob-map .leaflet-tooltip.cob-lbl{background:#fff;border:1px solid #cbd5e1;border-radius:.35rem;color:#1f2937;font-size:11px;font-weight:600;padding:.02rem .3rem;}
     .cob-map .leaflet-tooltip.cob-lbl-perm{background:transparent;border:none;box-shadow:none;padding:0;color:#0f172a;font-size:10px;font-weight:700;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff;}
     .cob-map .leaflet-tooltip.cob-lbl-perm::before{display:none;}

     .cob-side{position:absolute;top:.5rem;right:.5rem;bottom:.5rem;width:360px;max-width:90%;z-index:1100;background:#fff;border:1px solid #e2e8f0;border-radius:.6rem;box-shadow:0 10px 30px rgba(15,23,42,.18);display:flex;flex-direction:column;min-height:0;}
     .cob-side-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;padding:.7rem .8rem;border-bottom:1px solid #eef2f7;}
     .cob-eyebrow{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#a4145a;}
     .cob-title{font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
     .cob-x{width:1.6rem;height:1.6rem;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:.375rem;border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;font-size:1rem;line-height:1;}
     .cob-x:hover{background:#fee2e2;border-color:#ef4444;color:#b91c1c;}
     .cob-meta{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.5rem .8rem;border-bottom:1px solid #eef2f7;flex-wrap:wrap;}
     .cob-splitter{display:flex;align-items:center;gap:.4rem;}
     .cob-splitter-lbl{font-size:11px;color:#64748b;}
     .cob-seg{display:inline-flex;border:1px solid #cbd5e1;border-radius:.4rem;overflow:hidden;}
     .cob-seg-btn{font-size:11px;padding:.15rem .5rem;color:#64748b;background:#fff;}
     .cob-seg-btn.active{background:#a4145a;color:#fff;font-weight:600;}
     .cob-counter{text-align:right;font-size:12px;color:#334155;}
     .cob-counter b{color:#a4145a;font-size:14px;}
     .cob-mut{color:#94a3b8;font-size:10px;}
     .cob-disp{font-size:11px;color:#047857;}
     .cob-disp.full{color:#b91c1c;}
     .cob-side-body{flex:1;overflow:auto;padding:.6rem .8rem;}
     .cob-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:.6rem 0 .3rem;}
     .cob-sec:first-child{margin-top:0;}
     .cob-empty{font-size:12px;color:#94a3b8;padding:.3rem 0;}
     .cob-err{color:#dc2626;}
     .cob-list{list-style:none;margin:0;padding:0;}
     .cob-row{display:flex;align-items:center;gap:.4rem;padding:.3rem 0;border-bottom:1px solid #f1f5f9;font-size:12px;}
     .cob-port{flex:0 0 1.6rem;height:1.6rem;display:inline-flex;align-items:center;justify-content:center;background:#f1f5f9;border-radius:.35rem;color:#475569;font-weight:600;font-size:11px;}
     .cob-cli{flex:1;min-width:0;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
     .cob-doc{color:#64748b;font-size:11px;}
     .cob-badge{flex:0 0 auto;font-size:10px;padding:.1rem .4rem;border-radius:.4rem;border:1px solid #e2e8f0;color:#475569;background:#f8fafc;}
     .cob-badge.is-activo{background:#ecfdf5;border-color:#a7f3d0;color:#047857;}
     .cob-badge.is-suspendido{background:#fffbeb;border-color:#fde68a;color:#b45309;}
     .cob-badge.is-baja{background:#fef2f2;border-color:#fecaca;color:#b91c1c;}
     .cob-card{padding:.45rem .4rem;border-bottom:1px solid #f1f5f9;cursor:pointer;border-radius:.35rem;transition:background .12s;}
     .cob-card:hover{background:#f8fafc;}
     .cob-card.active{background:#eff6ff;box-shadow:inset 3px 0 0 #2563eb;}
     .cob-card-top{display:flex;align-items:center;gap:.4rem;justify-content:space-between;}
     .cob-card-name{font-size:12.5px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
     .cob-card-sub{font-size:11px;color:#64748b;margin-top:.1rem;}
     .cob-card-svc{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.25rem;}
     .cob-tag{font-size:10px;padding:.08rem .4rem;border-radius:.4rem;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;}
     .cob-tag-olt{background:#eef2ff;border-color:#c7d2fe;color:#3730a3;}
     .cob-src{font-size:10px;padding:.02rem .3rem;border-radius:.3rem;}
     .cob-src-red{background:#ecfdf5;color:#047857;}
     .cob-src-gps{background:#fff7ed;color:#c2410c;}
     .cob-legend{display:flex;flex-wrap:wrap;gap:.25rem;padding:.4rem .8rem;border-bottom:1px solid #eef2f7;}
     .cob-lg{display:inline-flex;align-items:center;gap:.25rem;font-size:10px;padding:.12rem .4rem;border-radius:.4rem;border:1px solid #e2e8f0;background:#fff;color:#334155;cursor:pointer;}
     .cob-lg.off{opacity:.4;text-decoration:line-through;}
     .cob-lg-dot{width:.6rem;height:.6rem;border-radius:50%;display:inline-block;flex:0 0 auto;}
     .cob-lg-dot.is-est{border-radius:2px;}   /* estado = cuadrito; calidad = círculo (no confundir) */
     .cob-lg b{color:#0f172a;}
     /* ficha del cliente al hacer clic en su punto */
     .cob-pop .leaflet-popup-content{margin:.6rem .75rem;}
     .cob-pop-t{font-size:12.5px;font-weight:700;color:#0f172a;line-height:1.25;}
     .cob-pop-s{font-size:10.5px;color:#64748b;margin-top:.1rem;}
     .cob-pop-chips{display:flex;gap:.25rem;flex-wrap:wrap;margin:.4rem 0 .35rem;}
     .cob-pop-chip{font-size:9.5px;font-weight:700;color:#fff;border-radius:.4rem;padding:.1rem .35rem;letter-spacing:.2px;}
     .cob-pop-r{display:flex;gap:.5rem;font-size:10.5px;line-height:1.5;border-top:1px dashed #e2e8f0;padding-top:.15rem;}
     .cob-pop-r span{color:#64748b;min-width:62px;flex:0 0 auto;}
     .cob-pop-r b{color:#0f172a;font-weight:600;}
     .cob-cal-counts{display:flex;flex-wrap:wrap;gap:.3rem;margin:.1rem 0 .5rem;}
     .cob-cal{font-size:10px;padding:.05rem .4rem;border-radius:.3rem;font-weight:600;}
     .cal-0{background:#f3f4f6;color:#4b5563;}
     .cal-1{background:#fef2f2;color:#b91c1c;}
     .cal-2{background:#fffbeb;color:#b45309;}
     .cal-3{background:#ecfdf5;color:#047857;}
     .cob-wiz{border:1px solid #dbeafe;background:#f8fbff;border-radius:.5rem;padding:.5rem .6rem;margin:.6rem .8rem;}
     .cob-wiz-h{font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:.35rem;}
     .cob-wiz-chips{display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.4rem;}
     .cob-wiz-chip{display:inline-flex;align-items:center;gap:.2rem;font-size:10px;padding:.1rem .35rem;border-radius:.4rem;background:#dbeafe;color:#1e3a8a;font-weight:600;}
     .cob-wiz-x{border:none;background:transparent;color:#1e3a8a;cursor:pointer;font-size:.9rem;line-height:1;padding:0 .1rem;}
     .cob-wiz-x:hover{color:#b91c1c;}
     .cob-wiz-empty{font-size:10.5px;color:#64748b;margin-bottom:.4rem;}
     .cob-wiz-row{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;}
     .cob-wiz-row .cob-sel{flex:1;min-width:5rem;}
     .cob-wiz-err{font-size:10.5px;color:#dc2626;margin-top:.3rem;}
     .cob-modal-back{position:absolute;inset:0;z-index:1200;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:1rem;}
     .cob-modal{width:820px;max-width:96%;max-height:88%;background:#fff;border-radius:.7rem;box-shadow:0 20px 50px rgba(15,23,42,.3);display:flex;flex-direction:column;min-height:0;}
     .cob-modal-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.7rem .9rem;border-bottom:1px solid #eef2f7;}
     .cob-modal-title{display:flex;align-items:center;gap:.4rem;font-size:14px;font-weight:700;color:#0f172a;}
     .cob-modal-sub{font-size:11px;font-weight:400;color:#94a3b8;}
     .cob-modal-back-btn{width:1.5rem;height:1.5rem;display:inline-flex;align-items:center;justify-content:center;border-radius:.35rem;border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;font-size:1.1rem;line-height:1;}
     .cob-modal-back-btn:hover{background:#f1f5f9;}
     .cob-modal-body{padding:.9rem;overflow:auto;min-height:0;}
     .cob-olt-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;}
     .cob-olt-card{text-align:left;border:1px solid #e2e8f0;border-radius:.5rem;background:#fff;padding:.6rem .7rem;cursor:pointer;transition:all .12s;}
     .cob-olt-card:hover{border-color:#2563eb;box-shadow:0 4px 12px rgba(37,99,235,.12);}
     .cob-olt-name{font-size:12.5px;font-weight:700;color:#0f172a;}
     .cob-olt-ip{font-size:11px;color:#64748b;margin-top:.15rem;}
     .cob-pon-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;}
     .cob-pon-btn{border:1px solid #e2e8f0;border-radius:.45rem;background:#fff;color:#334155;font-size:12px;font-weight:600;padding:.5rem 0;cursor:pointer;transition:all .12s;}
     .cob-pon-btn:hover:not(:disabled){border-color:#2563eb;color:#1d4ed8;background:#eff6ff;}
     .cob-pon-btn.on{background:#16a34a;border-color:#16a34a;color:#fff;cursor:default;}
     .cob-pon-btn.taken{background:#fef2f2;border-color:#fecaca;color:#b91c1c;cursor:not-allowed;display:flex;flex-direction:column;align-items:center;gap:.1rem;}
     .cob-pon-btn .cob-pon-nap{font-size:9px;font-weight:700;opacity:.85;}
     .cob-pon-btn:disabled{opacity:1;}`,
  ],
})
export class CoberturaHomeComponent implements AfterViewInit, OnDestroy {
  private api = inject(CoberturaApi);

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  readonly naps = signal<CoberturaNap[]>([]);

  /**
   * Filtro de cajas para VENTAS (nivel + cantidad de clientes). El mapa de calor y las capas
   * de clientes siguen mostrando TODO (sirven para ver donde hay y donde no hay clientes);
   * lo que se filtra son las cajas y sus conexiones, y el contador dice cuantas cumplen.
   */
  readonly nivelF = signal<0 | 1 | 2>(0);
  /**
   * Cantidades elegidas (multiselección). Vacio = todas las cajas.
   *  - 1er nivel / Todos: N = la caja cuelga de un PON con EXACTAMENTE N clientes; 0 = caja sin clientes.
   *  - 2do nivel: N = la CAJA tiene exactamente N clientes (splitter 1/8 o 1/16): 0..7 y 8 = "8 o más".
   */
  readonly cantSel = signal<number[]>([]);
  readonly ddOpen = signal(false);
  @ViewChild('cliDd') private cliDd?: ElementRef<HTMLElement>;
  // ---- Ubicacion (provincia > canton > parroquia > barrio), en cascada ----
  // Multiseleccion: vacio = todas. Cada paso se habilita cuando el de arriba tiene algo marcado.
  readonly provF = signal<number[]>([]);
  readonly canF = signal<number[]>([]);
  readonly parF = signal<number[]>([]);
  readonly barF = signal<number[]>([]);
  readonly hayUbic = computed(() => this.provF().length > 0);
  readonly ddUbic = signal(false);
  @ViewChild('ubicDd') private ubicDd?: ElementRef<HTMLElement>;
  private ubicPorNap = new Map<number, CoberturaNapUbicacion>();
  private readonly ubicTick = signal(0);
  /** null = cargando/ok; texto = por que no hay ubicaciones (para no decir "sin ubicacion" cuando en realidad fallo la carga). */
  readonly ubicError = signal<string | null>(null);
  private cargarUbicacion(): void {
    this.api.napsUbicacion().subscribe({
      next: (rows) => {
        const m = new Map<number, CoberturaNapUbicacion>();
        for (const r of rows ?? []) m.set(r.idGeoElementoFk, r);
        this.ubicPorNap = m;
        this.ubicError.set(m.size ? null : 'El servidor no devolvió ninguna ubicación (la vista kxv_red_nap_ubicacion está vacía).');
        this.ubicTick.set(this.ubicTick() + 1);
      },
      error: (e) => {
        this.ubicPorNap = new Map();
        const st = e?.status;
        this.ubicError.set(st === 404 ? 'klaxapi todavía no tiene el servicio de ubicaciones: hay que compilarlo y reiniciarlo.'
          : st === 500 ? 'Error en el servidor al leer las ubicaciones (¿se creó la vista kxv_red_nap_ubicacion?).'
          : 'No se pudieron cargar las ubicaciones' + (st ? ' (error ' + st + ').' : '.'));
        this.ubicTick.set(this.ubicTick() + 1);
      },
    });
  }
  private pasaNivel(nap: CoberturaNap): boolean {
    const niv = this.nivelF();
    return niv === 0 || (nap.nivelNap ?? 0) === niv;
  }
  private pasaCli(nap: CoberturaNap): boolean {
    const sel = this.cantSel();
    if (!sel.length) return true;
    const caja = this.modoCaja();
    return sel.some((v) => this.cumple(nap, v, caja));
  }
  private pasaUbic(nap: CoberturaNap): boolean {
    const p = this.provF();
    if (!p.length) return true;
    const u = this.ubicPorNap.get(nap.idGeoElemento);
    if (!u || u.idCiuProvincia == null || !p.includes(u.idCiuProvincia)) return false;
    const c = this.canF(), pa = this.parF(), b = this.barF();
    const en = (sel: number[], id: number | null | undefined) => !sel.length || (id != null && sel.includes(id));
    return en(c, u.idCiuCanton) && en(pa, u.idCiuParroquia) && en(b, u.idCiuBarrio);
  }
  /** Opciones de cada paso con cuantas cajas (respetando nivel y clientes, y el paso de arriba). */
  readonly opcionesUbic = computed(() => {
    this.ubicTick(); this.filtroTick();
    const p = this.provF(), c = this.canF(), pa = this.parF();
    type Op = { id: number; nombre: string; n: number };
    const prov = new Map<number, Op>(), can = new Map<number, Op>(), par = new Map<number, Op>(), bar = new Map<number, Op>();
    const suma = (m: Map<number, Op>, id: number | null | undefined, nombre: string | null | undefined) => {
      if (id == null) return;
      const o = m.get(id); if (o) o.n++; else m.set(id, { id, nombre: (nombre || ('#' + id)).trim(), n: 1 });
    };
    let sinUbic = 0, total = 0;
    for (const nap of this.naps()) {
      if (!this.pasaNivel(nap) || !this.pasaCli(nap)) continue;
      total++;
      const u = this.ubicPorNap.get(nap.idGeoElemento);
      if (!u) { sinUbic++; continue; }
      suma(prov, u.idCiuProvincia, u.provincia);
      if (!p.length || u.idCiuProvincia == null || !p.includes(u.idCiuProvincia)) continue;
      suma(can, u.idCiuCanton, u.canton);
      if (!c.length || u.idCiuCanton == null || !c.includes(u.idCiuCanton)) continue;
      suma(par, u.idCiuParroquia, u.parroquia);
      if (!pa.length || u.idCiuParroquia == null || !pa.includes(u.idCiuParroquia)) continue;
      suma(bar, u.idCiuBarrio, u.barrio);
    }
    const orden = (m: Map<number, Op>) => [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { prov: orden(prov), can: orden(can), par: orden(par), bar: orden(bar), sinUbic, total };
  });
  readonly ubicPasos = computed(() => {
    const o = this.opcionesUbic();
    const tot = (ops: { n: number }[]) => ops.reduce((t, x) => t + x.n, 0);
    return [
      { k: 'prov' as const, lbl: 'Provincia', padre: '', sel: this.provF(), ops: o.prov, off: false, total: tot(o.prov) },
      { k: 'can' as const, lbl: 'Cantón', padre: 'la provincia', sel: this.canF(), ops: o.can, off: !this.provF().length, total: tot(o.can) },
      { k: 'par' as const, lbl: 'Parroquia', padre: 'el cantón', sel: this.parF(), ops: o.par, off: !this.canF().length, total: tot(o.par) },
      { k: 'bar' as const, lbl: 'Barrio', padre: 'la parroquia', sel: this.barF(), ops: o.bar, off: !this.parF().length, total: tot(o.bar) },
    ];
  });
  private nombreUbic(campo: 'provincia' | 'canton' | 'parroquia' | 'barrio', idCampo: keyof CoberturaNapUbicacion, id: number): string | null {
    for (const u of this.ubicPorNap.values()) if (u[idCampo] === id) return (u[campo] || '').trim() || null;
    return null;
  }
  /** "Imbabura" / "3 cantones": un paso con una sola eleccion dice el nombre; con varias, cuantas. */
  private textoPaso(sel: number[], campo: 'provincia' | 'canton' | 'parroquia' | 'barrio', idCampo: keyof CoberturaNapUbicacion, plural: string): string | null {
    if (!sel.length) return null;
    if (sel.length === 1) return this.nombreUbic(campo, idCampo, sel[0]) ?? ('#' + sel[0]);
    return sel.length + ' ' + plural;
  }
  readonly ubicRuta = computed(() => {
    this.ubicTick();
    return [this.textoPaso(this.provF(), 'provincia', 'idCiuProvincia', 'provincias'),
            this.textoPaso(this.canF(), 'canton', 'idCiuCanton', 'cantones'),
            this.textoPaso(this.parF(), 'parroquia', 'idCiuParroquia', 'parroquias'),
            this.textoPaso(this.barF(), 'barrio', 'idCiuBarrio', 'barrios')]
      .filter((x): x is string => !!x).join(' › ');
  });
  readonly ubicResumen = computed(() => {
    const r = this.ubicRuta();
    if (!r) return 'Todo el mapa';
    const partes = r.split(' › ');
    return partes.length > 1 ? partes.slice(-2).join(' › ') : partes[0];
  });
  private senalUbic(k: 'prov' | 'can' | 'par' | 'bar') {
    return k === 'prov' ? this.provF : k === 'can' ? this.canF : k === 'par' ? this.parF : this.barF;
  }
  toggleUbic(k: 'prov' | 'can' | 'par' | 'bar', id: number): void {
    const sg = this.senalUbic(k);
    const sel = sg();
    sg.set(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
    this.podarUbic();
    this.repintarFiltro();
  }
  limpiarPaso(k: 'prov' | 'can' | 'par' | 'bar'): void {
    this.senalUbic(k).set([]);
    this.podarUbic();
    this.repintarFiltro();
  }
  /** Quita de los pasos de abajo lo que ya no cuelga de lo marcado arriba. */
  private podarUbic(): void {
    const quedan = (sel: number[], ops: { id: number }[]) => sel.filter((id) => ops.some((o) => o.id === id));
    this.canF.set(this.provF().length ? quedan(this.canF(), this.opcionesUbic().can) : []);
    this.parF.set(this.canF().length ? quedan(this.parF(), this.opcionesUbic().par) : []);
    this.barF.set(this.parF().length ? quedan(this.barF(), this.opcionesUbic().bar) : []);
  }
  limpiarUbic(): void {
    this.provF.set([]); this.canF.set([]); this.parF.set([]); this.barF.set([]);
    this.repintarFiltro();
  }

  // ---- Ventas / desinstalaciones por año o rango de fechas ----
  readonly movTipo = signal<'' | 'venta' | 'baja'>('');
  readonly movAnios = signal<number[]>([]);
  readonly movDesde = signal('');
  readonly movHasta = signal('');
  readonly ddMov = signal(false);
  @ViewChild('movDd') private movDd?: ElementRef<HTMLElement>;
  private fechasPorContrato = new Map<number, CoberturaContratoFecha>();
  private readonly fechasTick = signal(0);
  readonly fechasCargando = signal(false);
  readonly fechasError = signal<string | null>(null);
  /** Todos los clientes (con o sin caja), para el mapa de calor y los totales. */
  private cliFull: CoberturaClienteGeo[] = [];
  private readonly cliTick = signal(0);
  private cargarFechas(): void {
    if (this.fechasPorContrato.size || this.fechasCargando()) return;
    this.fechasCargando.set(true);
    this.api.contratosFechas().subscribe({
      next: (rows) => {
        const m = new Map<number, CoberturaContratoFecha>();
        for (const r of rows ?? []) m.set(r.idConContrato, r);
        this.fechasPorContrato = m;
        this.fechasError.set(null);
        this.fechasCargando.set(false);
        this.fechasTick.set(this.fechasTick() + 1);
        this.repintarFiltro();
      },
      error: (e) => {
        this.fechasCargando.set(false);
        this.fechasError.set(e?.status === 404 ? 'klaxapi todavía no tiene el servicio de fechas: hay que compilarlo y reiniciarlo.'
          : 'No se pudieron cargar las fechas de los contratos.');
      },
    });
  }
  /** Desinstalado = no esta activo, cortado/suspendido ni para retener. */
  private esBaja(c: CoberturaClienteGeo): boolean {
    return (c.estadoGrupo ?? 3) === 3 && !/retener/i.test(c.estado || '');
  }
  /** Fecha que cuenta para el tipo elegido ('' = no aplica / sin fecha). */
  private fechaMov(c: CoberturaClienteGeo): string | null {
    const f = this.fechasPorContrato.get(c.idConContratoFk);
    if (this.movTipo() === 'venta') return f?.instalacion ?? null;
    if (this.movTipo() === 'baja') return this.esBaja(c) ? (f?.cambioEstado ?? '') : null;
    return null;
  }
  private enPeriodo(f: string): boolean {
    const anios = this.movAnios(), d = this.movDesde(), h = this.movHasta();
    if (!anios.length && !d && !h) return true;
    if (!f) return false;
    if (anios.length && !anios.includes(Number(f.slice(0, 4)))) return false;
    if (d && f < d) return false;
    if (h && f > h) return false;
    return true;
  }
  /** El cliente es una venta / desinstalacion del periodo elegido. */
  private cuentaMov(c: CoberturaClienteGeo): boolean {
    const f = this.fechaMov(c);
    return f != null && this.enPeriodo(f);
  }
  /** Ventas / bajas del periodo por caja. */
  readonly movPorNap = computed(() => {
    this.movTipo(); this.movAnios(); this.movDesde(); this.movHasta(); this.fechasTick(); this.cliTick();
    const m = new Map<number, number>();
    if (this.movTipo() === '') return m;
    for (const [napId, arr] of this.cliPorNap) {
      let k = 0;
      for (const c of arr) if (this.cuentaMov(c)) k++;
      if (k) m.set(napId, k);
    }
    return m;
  });
  /** Totales del movimiento (todos los clientes, con o sin caja). */
  readonly movStats = computed(() => {
    this.movTipo(); this.movAnios(); this.movDesde(); this.movHasta(); this.fechasTick(); this.cliTick();
    let clientes = 0, sinFecha = 0;
    if (this.movTipo() === '') return { clientes, sinFecha };
    for (const c of this.cliFull) {
      const f = this.fechaMov(c);
      if (f == null) continue;
      if (f === '') sinFecha++;
      if (this.enPeriodo(f)) clientes++;
    }
    return { clientes, sinFecha };
  });
  /** Años con movimiento y cuantos (para los botones de año). */
  readonly movAniosOps = computed(() => {
    this.movTipo(); this.fechasTick(); this.cliTick();
    const m = new Map<number, number>();
    if (this.movTipo() === '') return [];
    for (const c of this.cliFull) {
      const f = this.fechaMov(c);
      if (!f) continue;
      const a = Number(f.slice(0, 4));
      if (a > 1990) m.set(a, (m.get(a) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([anio, n]) => ({ anio, n }));
  });
  readonly movResumen = computed(() => {
    const t = this.movTipo();
    if (t === '') return 'Sin filtro';
    const base = t === 'venta' ? 'Ventas' : 'Desinstalaciones';
    const a = [...this.movAnios()].sort();
    const d = this.movDesde(), h = this.movHasta();
    const per = a.length ? (a.length > 2 ? a.length + ' años' : a.join(', ')) : '';
    const rango = d || h ? (d || '…') + ' a ' + (h || '…') : '';
    return [base, per, rango].filter(Boolean).join(' · ');
  });
  setMovTipo(t: '' | 'venta' | 'baja'): void {
    this.movTipo.set(t);
    this.movAnios.set([]);
    if (t !== '') this.cargarFechas();
    this.repintarFiltro();
  }
  toggleAnio(a: number): void {
    const sel = this.movAnios();
    this.movAnios.set(sel.includes(a) ? sel.filter((x) => x !== a) : [...sel, a]);
    this.repintarFiltro();
  }
  setMovFecha(k: 'desde' | 'hasta', ev: Event): void {
    const v = (ev.target as HTMLInputElement).value || '';
    (k === 'desde' ? this.movDesde : this.movHasta).set(v);
    this.repintarFiltro();
  }
  limpiarMov(): void {
    this.movTipo.set(''); this.movAnios.set([]); this.movDesde.set(''); this.movHasta.set('');
    this.repintarFiltro();
  }
  private pasaMov(nap: CoberturaNap): boolean {
    return this.movTipo() === '' || (this.movPorNap().get(nap.idGeoElemento) ?? 0) > 0;
  }
  /** Mapa de calor: con movimiento elegido, solo los clientes de ese movimiento. */
  private refrescarCalor(): void {
    const pts: L.LatLngTuple[] = [];
    const conMov = this.movTipo() !== '';
    for (const c of this.cliFull) {
      if (c.lat == null || c.lng == null) continue;
      if (conMov && !this.cuentaMov(c)) continue;
      pts.push([c.lat, c.lng]);
    }
    this.heatPts = pts;
    if (this.heat.active) this.heat.setPoints(this.heatPts);
  }

  // ---- Vista en tabla ----
  readonly vistaTabla = signal(false);
  readonly tablaQ = signal('');
  readonly tablaPag = signal(1);
  readonly tablaOrd = signal<{ k: string; dir: 1 | -1 }>({ k: 'caja', dir: 1 });
  readonly colsTabla = computed(() => {
    const c: { k: string; lbl: string; num?: boolean }[] = [
      { k: 'caja', lbl: 'Caja' }, { k: 'nivel', lbl: 'Nivel' }, { k: 'provincia', lbl: 'Provincia' }, { k: 'canton', lbl: 'Cantón' },
      { k: 'parroquia', lbl: 'Parroquia' }, { k: 'barrio', lbl: 'Barrio' }, { k: 'pon', lbl: 'OLT · PON' },
      { k: 'clientes', lbl: 'Clientes caja', num: true }, { k: 'clientesPon', lbl: 'Clientes PON', num: true },
    ];
    if (this.movTipo() !== '') c.push({ k: 'mov', lbl: this.movTipo() === 'venta' ? 'Ventas' : 'Bajas', num: true });
    return c;
  });
  private textoPon(napId: number): string {
    const pons = this.ponsPorNap.get(napId);
    if (!pons?.size) return '—';
    return [...pons].map((k) => { const [olt, lpu, pon] = k.split('|'); return olt + ' ' + lpu + '/' + pon; }).join(', ');
  }
  readonly filasTabla = computed(() => {
    this.ubicTick(); this.filtroTick();
    const mov = this.movPorNap();
    const q = this.tablaQ().trim().toLowerCase();
    const filas = this.napsFiltradas().map((nap) => {
      const u = this.ubicPorNap.get(nap.idGeoElemento);
      return {
        id: nap.idGeoElemento,
        caja: this.nombreCorto(nap),
        nivel: nap.nivelNap === 1 ? '1er' : nap.nivelNap === 2 ? '2do' : '—',
        provincia: u?.provincia ?? '', canton: u?.canton ?? '', parroquia: u?.parroquia ?? '', barrio: u?.barrio ?? '',
        pon: this.textoPon(nap.idGeoElemento),
        clientes: nap.totalClientes ?? 0,
        clientesPon: this.ponMin(nap.idGeoElemento),
        mov: mov.get(nap.idGeoElemento) ?? 0,
      };
    }).filter((f) => !q || (f.caja + ' ' + f.provincia + ' ' + f.canton + ' ' + f.parroquia + ' ' + f.barrio + ' ' + f.pon).toLowerCase().includes(q));
    const { k, dir } = this.tablaOrd();
    return filas.sort((a, b) => {
      const va = (a as any)[k], vb = (b as any)[k];
      if (typeof va === 'number' || typeof vb === 'number') return ((va ?? -1) - (vb ?? -1)) * dir;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'es', { numeric: true }) * dir;
    });
  });
  /** Anchos fijos (%) para que la tabla entre completa en una sola vista, sin barra horizontal. */
  anchoCol(k: string): number {
    const mov = this.movTipo() !== '';
    const w: Record<string, number> = { caja: 9, nivel: 5, provincia: 10, canton: 11, parroquia: 13, barrio: mov ? 14 : 18,
                                         pon: 18, clientes: 8, clientesPon: 8, mov: 6 };
    return w[k] ?? 8;
  }
  readonly filasVisibles = computed(() => this.filasTabla().slice(0, this.tablaPag() * 300));
  ordenarTabla(k: string): void {
    const o = this.tablaOrd();
    this.tablaOrd.set({ k, dir: o.k === k ? (o.dir === 1 ? -1 : 1) : (k === 'clientes' || k === 'clientesPon' || k === 'mov' ? -1 : 1) });
  }
  /** Clic en una fila: vuelve al mapa y abre esa caja. */
  irACaja(id: number): void {
    const nap = this.naps().find((x) => x.idGeoElemento === id);
    this.vistaTabla.set(false);
    if (!nap) return;
    setTimeout(() => {
      this.map?.invalidateSize();
      if (nap.lat != null && nap.lng != null) this.map?.setView([nap.lat, nap.lng], Math.max(this.map?.getZoom() ?? 16, 16));
      this.seleccionar(nap);
    }, 0);
  }

  /** En 2do nivel se cuenta por caja, no por PON. */
  readonly modoCaja = computed(() => this.nivelF() === 2);
  private static readonly CAJA_TOPE = 8;
  /**
   * Clientes REALES por puerto PON ("olt|tarjeta|pon" -> cantidad) y PON de cada caja.
   * Vienen de klaxapi (kxv_red_nap_pon_real): el conteo es de TODOS los contratos
   * (activos + cortados) y el PON de la caja sale del amarre manual o de los clientes
   * atados a ella en campo / ERP. Antes se deducia de los clientes con GPS y quedaba corto.
   */
  private ponCount = new Map<string, number>();
  private ponsPorNap = new Map<number, Set<string>>();
  /** De donde salio el PON de cada caja: MANUAL / CLIENTES (confirmado) o HIJAS / MADRE / GPS (deducido). */
  private ponFuente = new Map<number, string>();
  /** Cantidades que existen de verdad, con cuantos PON tienen cada una (para el combo). */
  readonly cliOpciones = signal<{ n: number; pon: number }[]>([]);
  private static ponKey(olt?: string | null, lpu?: number | null, pon?: number | null): string | null {
    if (!olt || pon == null) return null;
    return olt + '|' + (lpu ?? 0) + '|' + pon;
  }
  private cargarNapPon(): void {
    this.api.napsPon().subscribe({
      next: (rows) => {
        const pc = new Map<string, number>();
        const pn = new Map<number, Set<string>>();
        const pf = new Map<number, string>();
        for (const r of rows ?? []) {
          const k = CoberturaHomeComponent.ponKey(r.oltNombre, r.lpu, r.pon);
          if (!k) continue;
          if (r.fuente) pf.set(r.idGeoElementoFk, String(r.fuente));
          pc.set(k, r.clientesPon ?? 0);
          const set = pn.get(r.idGeoElementoFk) ?? new Set<string>();
          set.add(k);
          pn.set(r.idGeoElementoFk, set);
        }
        const porCant = new Map<number, number>();
        for (const c of pc.values()) if (c > 0) porCant.set(c, (porCant.get(c) ?? 0) + 1);
        // De menor a mayor: primero los PON con mas cupo (lo que busca ventas).
        this.cliOpciones.set([...porCant.entries()].sort((a, b) => a[0] - b[0]).map(([n, pon]) => ({ n, pon })));
        this.ponCount = pc;
        this.ponsPorNap = pn;
        this.ponFuente = pf;
        this.filtroTick.set(this.filtroTick() + 1);
        if (!this.modoCaja()) this.cantSel.set(this.cantSel().filter((v) => v === 0 || porCant.has(v)));
        this.pintar();
        this.pintarGlobal();
      },
      error: () => { this.cliOpciones.set([]); },
    });
  }

  /** Texto corto de la fuente del PON para el tooltip. */
  private fuenteTexto(napId: number): string {
    switch (this.ponFuente.get(napId)) {
      case 'MANUAL': return 'confirmado';
      case 'CLIENTES': return 'por sus clientes';
      case 'HIJAS': return 'deducido de sus cajas hijas';
      case 'MADRE': return 'deducido de su caja madre';
      case 'GPS': return 'deducido por clientes cercanos';
      case 'GRUPO': return 'deducido de su grupo';
      default: return '';
    }
  }

  /** Clientes del PON menos cargado de la caja (null si no se conoce su PON). Para el tooltip. */
  ponMin(napId: number): number | null {
    const pons = this.ponsPorNap.get(napId);
    if (!pons?.size) return null;
    let min: number | null = null;
    for (const k of pons) { const c = this.ponCount.get(k) ?? 0; if (min == null || c < min) min = c; }
    return min;
  }
  /** true si ALGUN PON del que cuelga la caja tiene exactamente n clientes. */
  private ponTiene(napId: number, n: number): boolean {
    const pons = this.ponsPorNap.get(napId);
    if (!pons?.size) return false;
    for (const k of pons) if ((this.ponCount.get(k) ?? 0) === n) return true;
    return false;
  }
  /** Contador tonto para que napsFiltradas() se recalcule al cambiar ponCount/ponsPorNap (son Map comunes). */
  private readonly filtroTick = signal(0);
  readonly filtroCajasActivo = computed(() => this.nivelF() !== 0 || this.cantSel().length > 0 || this.provF().length > 0 || this.movTipo() !== '');

  /** true si la caja cumple la cantidad v (segun el modo). */
  private cumple(nap: CoberturaNap, v: number, caja: boolean): boolean {
    const tot = nap.totalClientes ?? 0;
    if (caja) return v >= CoberturaHomeComponent.CAJA_TOPE ? tot >= v : tot === v;
    if (v === 0) return tot === 0;
    return this.ponTiene(nap.idGeoElemento, v);
  }
  /** Opciones del combo con cuantas cajas (del nivel elegido) tiene cada una. Solo las que existen. */
  readonly opcionesCli = computed(() => {
    const niv = this.nivelF(), caja = this.modoCaja();
    this.filtroTick(); this.ubicTick();
    // v -> [total, de 1er nivel, de 2do nivel]
    const cuenta = new Map<number, [number, number, number]>();
    const suma = (v: number, nivel: number | null | undefined) => {
      const c = cuenta.get(v) ?? [0, 0, 0];
      c[0]++;
      if (nivel === 1) c[1]++; else if (nivel === 2) c[2]++;
      cuenta.set(v, c);
    };
    for (const nap of this.naps()) {
      if (niv !== 0 && (nap.nivelNap ?? 0) !== niv) continue;
      if (!this.pasaUbic(nap)) continue;
      const tot = nap.totalClientes ?? 0;
      if (caja) { suma(Math.min(tot, CoberturaHomeComponent.CAJA_TOPE), nap.nivelNap); continue; }
      if (tot === 0) suma(0, nap.nivelNap);
      const pons = this.ponsPorNap.get(nap.idGeoElemento);
      if (!pons?.size) continue;
      const vistos = new Set<number>();
      for (const k of pons) { const c = this.ponCount.get(k) ?? 0; if (c > 0 && !vistos.has(c)) { vistos.add(c); suma(c, nap.nivelNap); } }
    }
    const tope = CoberturaHomeComponent.CAJA_TOPE;
    return [...cuenta.entries()].sort((a, b) => a[0] - b[0]).map(([v, [cajas, c1, c2]]) => ({
      v, cajas, c1, c2,
      lbl: v === 0 ? 'Sin clientes · para vender'
         : caja && v >= tope ? tope + ' o más clientes'
         : v + (v === 1 ? ' cliente' : ' clientes'),
    }));
  });
  readonly cliResumen = computed(() => {
    const sel = this.cantSel();
    if (!sel.length) return 'Todas las cajas';
    const tope = CoberturaHomeComponent.CAJA_TOPE, caja = this.modoCaja();
    const t = (v: number) => v === 0 ? 'Sin clientes' : caja && v >= tope ? tope + '+' : String(v);
    if (sel.length === 1) return sel[0] === 0 ? 'Sin clientes' : t(sel[0]) + (sel[0] === 1 ? ' cliente' : ' clientes');
    if (sel.length > 3) return sel.length + ' cantidades elegidas';
    return [...sel].sort((a, b) => a - b).map(t).join(', ') + ' clientes';
  });
  readonly opcionCero = computed(() => this.opcionesCli().find((o) => o.v === 0) ?? null);
  readonly opcionesNum = computed(() => this.opcionesCli().filter((o) => o.v > 0));
  /** Atajos por tramos de 16 (un PON admite 64): marcan de una todas las cantidades del tramo. Solo en modo PON. */
  readonly rangos = computed(() => {
    if (this.modoCaja()) return [];
    const tramos: [number, number][] = [[1, 16], [17, 32], [33, 48], [49, 64], [65, 9999]];
    const nums = this.opcionesNum();
    return tramos.map(([a, b]) => {
      const vs = nums.filter((o) => o.v >= a && o.v <= b);
      return { lbl: b > 64 ? a + '+' : a + '–' + b, vs: vs.map((o) => o.v), cajas: vs.reduce((t, o) => t + o.cajas, 0) };
    }).filter((r) => r.vs.length);
  });
  rangoOn(r: { vs: number[] }): boolean {
    const sel = this.cantSel();
    return r.vs.length > 0 && r.vs.every((v) => sel.includes(v));
  }
  toggleRango(r: { vs: number[] }): void {
    const sel = this.cantSel();
    this.cantSel.set(this.rangoOn(r) ? sel.filter((v) => !r.vs.includes(v)) : [...new Set([...sel, ...r.vs])]);
    this.repintarFiltro();
  }
  cliMarcado(v: number): boolean { return this.cantSel().includes(v); }
  toggleCli(v: number): void {
    const sel = this.cantSel();
    this.cantSel.set(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
    this.repintarFiltro();
  }
  /** Cierra el combo al hacer clic fuera o con Escape. */
  private readonly cerrarDd = (e: Event) => {
    if (!this.ddOpen() && !this.ddUbic() && !this.ddMov()) return;
    if (e instanceof KeyboardEvent) { if (e.key === 'Escape') { this.ddOpen.set(false); this.ddUbic.set(false); this.ddMov.set(false); } return; }
    const t = e.target as Node;
    if (this.ddOpen() && this.cliDd && !this.cliDd.nativeElement.contains(t)) this.ddOpen.set(false);
    if (this.ddUbic() && this.ubicDd && !this.ubicDd.nativeElement.contains(t)) this.ddUbic.set(false);
    if (this.ddMov() && this.movDd && !this.movDd.nativeElement.contains(t)) this.ddMov.set(false);
  };
  /** El contador es de cajas de 1er nivel (las de 2do cuelgan de una de 1er y no se suman), salvo que se filtre 2do nivel. */
  /** Cajas que cumplen el filtro, separadas por nivel (para "Todos"). */
  readonly cajasNivel = computed(() => {
    let n1 = 0, n2 = 0;
    for (const nap of this.napsFiltradas()) {
      if (nap.nivelNap === 1) n1++;
      else if (nap.nivelNap === 2) n2++;
    }
    return { n1, n2 };
  });
  /** Con Nivel = Todos: cajas y clientes de 1er y 2do nivel de lo que esta en el mapa (pie de los combos). */
  readonly resumenNivel = computed(() => {
    let c1 = 0, c2 = 0, k1 = 0, k2 = 0;
    for (const nap of this.napsFiltradas()) {
      const k = nap.totalClientes ?? 0;
      if (nap.nivelNap === 1) { c1++; k1 += k; }
      else if (nap.nivelNap === 2) { c2++; k2 += k; }
    }
    return { c1, c2, k1, k2 };
  });
  readonly cajasContador = computed(() => {
    const niv = this.nivelF() === 2 ? 2 : 1;
    return this.napsFiltradas().filter((nap) => (nap.nivelNap ?? 0) === niv).length;
  });
  readonly napsFiltradas = computed(() => {
    this.nivelF(); this.cantSel(); this.modoCaja(); this.provF(); this.canF(); this.parF(); this.barF();
    this.filtroTick(); this.ubicTick();   // se recalcula cuando llegan los PON y las ubicaciones
    this.movPorNap();
    // Nivel + ubicacion + cantidad (exacta, no acumulada; con varias elegidas basta cumplir una) + ventas/bajas.
    return this.naps().filter((nap) => this.pasaNivel(nap) && this.pasaUbic(nap) && this.pasaCli(nap) && this.pasaMov(nap));
  });

  setNivel(n: 0 | 1 | 2): void {
    if (this.nivelF() === n) return;
    // Al pasar a/desde 2do nivel las cantidades cambian de significado (caja vs PON): se limpian.
    if ((n === 2) !== this.modoCaja()) this.cantSel.set([]);
    this.nivelF.set(n);
    this.repintarFiltro();
  }
  limpiarFiltro(): void {
    this.nivelF.set(0);
    this.cantSel.set([]);
    this.provF.set([]); this.canF.set([]); this.parF.set([]); this.barF.set([]);
    this.movTipo.set(''); this.movAnios.set([]); this.movDesde.set(''); this.movHasta.set('');
    this.ddOpen.set(false);
    this.ddUbic.set(false);
    this.ddMov.set(false);
    this.repintarFiltro();
  }
  onNivel(ev: Event): void {
    this.nivelF.set((Number((ev.target as HTMLSelectElement).value) || 0) as 0 | 1 | 2);
    this.repintarFiltro();
  }
  /**
   * Al elegir un filtro, el mapa se mueve para mostrar TODAS las cajas que lo cumplen.
   * El mapa solo dibuja lo que esta en pantalla (por rendimiento), asi que sin esto las cajas
   * del filtro que estaban en otra zona no se veian y parecia que el filtro no funcionaba.
   */
  private encuadrarFiltro(): void {
    if (!this.map || !this.filtroCajasActivo()) return;
    const pts: L.LatLngTuple[] = [];
    for (const nap of this.napsFiltradas()) if (nap.lat != null && nap.lng != null) pts.push([nap.lat, nap.lng]);
    if (!pts.length) return;
    try { this.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16, animate: true }); } catch { /* */ }
  }

  repintarFiltro(): void {
    // Si la caja seleccionada quedo fuera del filtro, se cierra su panel.
    if (this.napSel && !this.napsFiltradas().some((x) => x.idGeoElemento === this.napSel!.idGeoElemento)) this.cerrar();
    this.refrescarCalor();
    this.pintar();
    this.pintarGlobal();
    this.encuadrarFiltro();   // moveend vuelve a pintar con la nueva vista
  }
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly radio = signal(500);
  readonly verNombres = signal(true);

  readonly panelOpen = signal(false);
  readonly titulo = signal('NAP');
  readonly napCli = signal<MapaNapClientes | null>(null);

  /**
   * Clientes en un PUERTO de la NAP (misma fuente que la ficha del mapa) que NO estan en la
   * lista de cobertura. Explica el "1/8 ocupado" con lista vacia: son dos relaciones distintas
   * (puerto asignado vs. cliente georreferenciado) y aca se muestran las dos.
   */
  sinGeo(): MapaNapCliente[] {
    const d = this.napCli();
    if (!d?.clientes?.length) return [];
    const geo = new Set(this.cliGeo().map((c) => c.idConContratoFk));
    return d.clientes.filter((c) => c.idContrato == null || !geo.has(c.idContrato));
  }
  readonly cliGeo = signal<CoberturaClienteGeo[]>([]);

  /**
   * Puertos OCUPADOS de la caja para ventas. Antes era solo "clientes con puerto marcado por el
   * tecnico", y una caja llena de gente salia "0 / 8 · 8 disponibles". Ahora ocupa puerto todo
   * contrato VIGENTE (activo o cortado: los dos tienen su drop puesto) que:
   *   - esta amarrado a la caja (tecnico en campo o ERP), o
   *   - esta cerca por GPS y su ONU cuelga del MISMO PON que la caja (calidad "confirmado").
   * Terminados y bajas no ocupan. Los cercanos con PON sin confirmar no se cuentan: van en el
   * detalle (tooltip) como "posibles", para que el asesor sepa que puede haber menos cupo.
   */
  readonly puertos = computed(() => {
    const d = this.napCli();
    if (!d) return null;
    const total = d.total || 8;
    const vigente = (e: string | null | undefined) => /activ|cort|suspen/i.test(e || '');
    const ocup = new Set<number>();
    let sinId = 0, porAmarre = 0, porPon = 0;
    for (const c of d.clientes ?? []) {
      if (!vigente(c.estado)) continue;
      if (c.idContrato == null) { sinId++; porAmarre++; continue; }
      if (!ocup.has(c.idContrato)) { ocup.add(c.idContrato); porAmarre++; }
    }
    const cercanos = new Set<number>();
    for (const c of this.cliGeo()) {
      const g = c.estadoGrupo ?? (vigente(c.estado) ? 1 : 3);
      if (g !== 1 && g !== 2) continue;
      const amarre = (c.fuente || '').toUpperCase().startsWith('RED');
      if (amarre || c.calidad === 3) {
        if (!ocup.has(c.idConContratoFk)) { ocup.add(c.idConContratoFk); if (amarre) porAmarre++; else porPon++; }
      } else if (c.calidad === 2) {
        cercanos.add(c.idConContratoFk);
      }
    }
    for (const id of ocup) cercanos.delete(id);
    const ocupados = ocup.size + sinId;
    const posibles = cercanos.size;
    const detalle = `${porAmarre} amarrados a la caja · ${porPon} cercanos en el mismo PON`
      + (posibles ? ` · ${posibles} cercanos más sin confirmar (podrían estar en esta caja)` : '')
      + ' · solo cuentan activos y cortados';
    return { total, ocupados, disponibles: Math.max(0, total - ocupados), exceso: Math.max(0, ocupados - total), posibles, detalle };
  });

  /**
   * Historial de clientes de la caja agrupado por ESTADO del contrato (Activo 5, Cortado 4,
   * Terminado y saldado 4...). Junta los atados/cercanos (cobertura) y los que estan en un puerto
   * de la caja sin georreferenciar, sin contar dos veces el mismo contrato.
   */
  readonly historialCaja = computed(() => {
    const cuenta = new Map<string, number>();
    const vistos = new Set<number>();
    const suma = (estado: string | null | undefined, idContrato: number | null | undefined) => {
      if (idContrato != null) {
        if (vistos.has(idContrato)) return;
        vistos.add(idContrato);
      }
      const e = (estado || '').trim() || 'Sin estado';
      cuenta.set(e, (cuenta.get(e) ?? 0) + 1);
    };
    for (const c of this.cliGeo()) suma(c.estado, c.idConContratoFk);
    for (const c of this.napCli()?.clientes ?? []) suma(c.estado, c.idContrato);
    const total = [...cuenta.values()].reduce((t, x) => t + x, 0);
    const max = Math.max(1, ...cuenta.values());
    const filas = [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([estado, n]) => ({ estado, n, pct: Math.round((n / max) * 100) }));
    return { total, filas };
  });
  readonly cliSel = signal<number | null>(null);   // cliente resaltado desde la lista
  readonly loadingCli = signal(false);
  readonly cliError = signal<string | null>(null);
  readonly heatOn = signal(false);
  // capas de calidad visibles (0 sin gps, 1 otro PON, 2 sin confirmar, 3 confirmado).
  // ARRANCAN APAGADAS: el mapa empieza limpio y las conexiones aparecen al ir seleccionando capas.
  readonly verCal = signal<Record<number, boolean>>({ 0: false, 1: false, 2: false, 3: false });
  // filtro por estado del cliente (1 activo, 2 cortado/suspension, 3 los demas). Arrancan TODOS
  // encendidos: es un refinamiento sobre lo que ya prendiste en "Capas de conexión".
  readonly verEstado = signal<Record<number, boolean>>({ 1: true, 2: true, 3: true });
  /**
   * TODOS los clientes cargados (dentro del radio), aplanados. Existe solo para que los
   * contadores puedan ser un computed: cliPorNap es un Map comun y no notifica cambios.
   */
  private readonly cliTodos = signal<CoberturaClienteGeo[]>([]);
  readonly satOn = signal(false);   // vista satelite
  // coroplético de zonas (barrios)
  readonly zonasOn = signal(false);
  readonly zonaMetric = signal<ZonaMetric>('total');

  // ---- confirmador de PON (picker tipo NOC: Elegí la OLT -> Elegí LPU-PON) ----
  readonly olts = signal<CoberturaOlt[]>([]);
  readonly napPons = signal<CoberturaNapPon[]>([]);      // amarres de la NAP seleccionada
  readonly wizBusy = signal(false);
  readonly wizErr = signal<string | null>(null);
  readonly pickerOpen = signal(false);                  // modal abierto
  readonly pickerStep = signal<'olt' | 'pon'>('olt');   // paso del wizard
  readonly wizOlt = signal<CoberturaOlt | null>(null);  // OLT elegida
  readonly wizPons = signal<CoberturaLpuPon[]>([]);      // LPU-PON de la OLT elegida
  readonly loadingPons = signal(false);

  // paleta de calidad (peor -> mejor)
  private readonly CAL: Record<number, { line: string; fill: string; stroke: string; lbl: string }> = {
    0: { line: '#9ca3af', fill: '#d1d5db', stroke: '#6b7280', lbl: 'Sin GPS' },
    1: { line: '#dc2626', fill: '#ef4444', stroke: '#991b1b', lbl: 'GPS a otro PON' },
    2: { line: '#f59e0b', fill: '#f59e0b', stroke: '#b45309', lbl: 'Sin confirmar' },
    3: { line: '#16a34a', fill: '#22c55e', stroke: '#166534', lbl: 'Confirmado' },
  };
  calMeta(q: number | null | undefined) { return this.CAL[q ?? 2] ?? this.CAL[2]; }
  calCount(q: number): number { return this.cliGeo().filter((c) => (c.calidad ?? 2) === q).length; }

  // paleta por estado del cliente. Familia DISTINTA (azul/púrpura/pizarra) a la de calidad
  // (verde/ámbar/gris) para que los chips de "Estado" no se confundan con los de "Capas de conexión".
  private readonly EST: Record<number, { fill: string; lbl: string }> = {
    1: { fill: '#2563eb', lbl: 'Activo' },
    2: { fill: '#9333ea', lbl: 'Cortado/Susp.' },
    3: { fill: '#64748b', lbl: 'Otros' },
  };
  estMeta(g: number | null | undefined) { return this.EST[g ?? 3] ?? this.EST[3]; }

  /**
   * Contadores que se mueven CON el filtro. Los dos ejes se cruzan:
   *  - el numero de cada chip de Estado cuenta solo los clientes de las capas de conexion encendidas;
   *  - el de cada chip de Conexion cuenta solo los estados encendidos.
   * Asi el numero siempre responde a "de lo que estoy viendo, cuantos hay de esto".
   * Al abrir la pantalla las capas de conexion arrancan apagadas, asi que los chips marcan 0
   * hasta que prendas una: el total de la derecha ("0 de N") lo deja claro.
   */
  readonly conteo = computed(() => {
    const vc = this.verCal(), ve = this.verEstado();
    const porCal: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const porEst: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    let visibles = 0;
    const todos = this.cliTodos();
    for (const c of todos) {
      const q = c.calidad ?? 2;
      const g = c.estadoGrupo ?? 3;
      if (ve[g]) porCal[q] = (porCal[q] ?? 0) + 1;
      if (vc[q]) porEst[g] = (porEst[g] ?? 0) + 1;
      if (vc[q] && ve[g]) visibles++;
    }
    return { porCal, porEst, visibles, total: todos.length };
  });
  /** Numero con separador de miles. */
  n(v: number | null | undefined): string { return (v ?? 0).toLocaleString('es-EC'); }

  /** Asigna el mapa NAP->clientes y mantiene sincronizado el signal que alimenta los contadores. */
  private setCli(m: Map<number, CoberturaClienteGeo[]>): void {
    this.cliPorNap = m;
    const todos: CoberturaClienteGeo[] = [];
    for (const [, arr] of m) for (const c of arr) todos.push(c);
    this.cliTodos.set(todos);
  }

  /**
   * Descarga a Excel (.xlsx) los clientes de las cajas que cumplen el filtro (nivel + clientes).
   * Una fila por cliente con su estado, NAP, OLT/PON/ONU y distancia.
   */
  descargarExcel(): void {
    const cajas = new Set(this.napsFiltradas().map((x) => x.idGeoElemento));
    const rows: Record<string, string | number>[] = [];
    for (const [napId, clientes] of this.cliPorNap) {
      if (!cajas.has(napId)) continue;
      const etiqueta = this.etiquetaNap(napId);
      for (const c of clientes) {
        if (this.movTipo() !== '' && !this.cuentaMov(c)) continue;
        const q = c.calidad ?? 2;
        const g = c.estadoGrupo ?? 3;
        const fc = this.fechasPorContrato.get(c.idConContratoFk);
        rows.push({
          'Cliente': (c.clienteNombre && c.clienteNombre.trim()) || '',
          'Documento': c.documento ?? '',
          'Estado': c.estado ?? '',
          'Grupo estado': this.estMeta(g).lbl,
          'Calidad conexión': this.calMeta(q).lbl,
          'NAP': etiqueta,
          'Nivel NAP': c.nivelNap ?? '',
          'OLT': c.oltNombre ?? '',
          'PON (tarjeta/puerto)': this.ponLabel(c),
          'ONU': c.gponOnu ?? '',
          'Distancia (m)': c.distanciaM != null ? Math.round(c.distanciaM) : '',
          'Latitud': c.lat ?? '',
          'Longitud': c.lng ?? '',
          'Fecha instalación': fc?.instalacion ?? '',
          'Fecha baja': this.esBaja(c) ? (fc?.cambioEstado ?? '') : '',
        });
      }
    }
    if (!rows.length) {
      alert('No hay clientes con las capas activas. Prendé al menos una capa de conexión (y estado) para exportar.');
      return;
    }
    rows.sort((a, b) =>
      String(a['NAP']).localeCompare(String(b['NAP'])) ||
      String(a['Cliente']).localeCompare(String(b['Cliente'])));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
      { wch: 9 }, { wch: 20 }, { wch: 18 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const fn = `cobertura_clientes_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
    XLSX.writeFile(wb, fn);
  }

  /** hay al menos una capa (calidad o estado) encendida */
  filtroActivo(): boolean {
    const v = this.verCal(), e = this.verEstado();
    return v[0] || v[1] || v[2] || v[3] || e[1] || e[2] || e[3];
  }
  private aplicarFiltro(): void {
    this.pintarGlobal();                            // las capas encendidas SIEMPRE pintan todo el mapa
    if (this.napSel) this.dibujarSel(this.napSel);
  }
  toggleCal(q: number): void {
    this.verCal.set({ ...this.verCal(), [q]: !this.verCal()[q] });
    this.aplicarFiltro();
  }
  toggleEstado(g: number): void {
    this.verEstado.set({ ...this.verEstado(), [g]: !this.verEstado()[g] });
    this.aplicarFiltro();
  }
  toggleSat(): void {
    this.satOn.set(!this.satOn());
    if (!this.map) return;
    if (this.satOn()) {
      if (this.baseOsm) this.map.removeLayer(this.baseOsm);
      this.baseSat?.addTo(this.map);
      this.baseSat?.bringToBack();
    } else {
      if (this.baseSat) this.map.removeLayer(this.baseSat);
      this.baseOsm?.addTo(this.map);
      this.baseOsm?.bringToBack();
    }
  }

  // ---- coroplético de zonas (barrios) ----
  private readonly ZMET: Record<ZonaMetric, { fill: string; stroke: string; lbl: string }> = {
    total:    { fill: '#2563eb', stroke: '#1e3a8a', lbl: 'clientes' },
    activos:  { fill: '#16a34a', stroke: '#166534', lbl: 'activos' },
    cortados: { fill: '#f59e0b', stroke: '#b45309', lbl: 'cortados/susp.' },
    otros:    { fill: '#dc2626', stroke: '#991b1b', lbl: 'bajas' },
  };
  zmet(m: ZonaMetric) { return this.ZMET[m]; }
  private zval(z: CoberturaZona, m: ZonaMetric): number {
    return m === 'total' ? z.total : m === 'activos' ? z.activos : m === 'cortados' ? z.cortados : z.otros;
  }
  toggleZonas(): void {
    this.zonasOn.set(!this.zonasOn());
    if (!this.zonasOn()) { this.capaZonas.clearLayers(); return; }
    if (this.zonas.length) { this.dibujarZonas(); return; }
    this.api.listarZonas(300).subscribe({
      next: (z) => { this.zonas = z ?? []; this.dibujarZonas(); },
      error: () => {},
    });
  }
  onZonaMetric(ev: Event): void {
    this.zonaMetric.set((ev.target as HTMLSelectElement).value as ZonaMetric);
    if (this.zonasOn()) this.dibujarZonas();
  }
  private dibujarZonas(): void {
    this.capaZonas.clearLayers();
    const m = this.zonaMetric();
    const hue = this.ZMET[m];
    const max = Math.max(1, ...this.zonas.map((z) => this.zval(z, m)));
    for (const z of this.zonas) {
      if (!z.geojson) continue;
      let geom: any;
      try { geom = JSON.parse(z.geojson); } catch { continue; }
      const v = this.zval(z, m);
      const t = v / max;
      const layer = L.geoJSON(geom as any, {
        style: () => ({ color: hue.stroke, weight: 1, fillColor: hue.fill, fillOpacity: 0.12 + 0.55 * t, opacity: 0.7 }),
      });
      layer.bindTooltip(
        `<b>${v} ${hue.lbl}</b><br>Total ${z.total} · Activos ${z.activos} · Cortados ${z.cortados} · Bajas ${z.otros}`,
        { sticky: true });
      layer.addTo(this.capaZonas);
    }
  }

  /** Pinta TODAS las conexiones (todas las NAP) de las capas encendidas — vista global para cazar problemas. */
  private pintarGlobal(): void {
    this.capaGlobal.clearLayers();
    this.ptsGlobal = [];
    if (!this.map) return;
    if (!this.filtroActivo()) return;   // ninguna capa encendida -> nada que pintar
    const vis = this.verCal(), visEst = this.verEstado();
    const view = this.map.getBounds().pad(0.2);   // solo lo visible (+margen) para no relentizar
    const napById = new Map<number, CoberturaNap>(this.napsFiltradas().map((n) => [n.idGeoElemento, n]));
    const CAP = 8000;
    let k = 0;
    for (const [napId, clientes] of this.cliPorNap) {
      const nap = napById.get(napId);
      if (!nap || nap.lat == null || nap.lng == null) continue;
      const napLL: L.LatLngTuple = [nap.lat, nap.lng];
      const napIn = view.contains(napLL);
      for (const c of clientes) {
        if (k >= CAP) return;
        if (c.lat == null || c.lng == null) continue;
        const q = c.calidad ?? 2;
        if (!vis[q] || !visEst[c.estadoGrupo ?? 3]) continue;
        const cliLL: L.LatLngTuple = [c.lat, c.lng];
        if (!napIn && !view.contains(cliLL)) continue;   // fuera de la vista -> se omite
        const col = this.calMeta(q);
        L.polyline([napLL, cliLL],
          { color: col.line, weight: 2, opacity: 0.85, interactive: false, renderer: this.canvasRenderer }).addTo(this.capaGlobal);
        L.circleMarker(cliLL,
          { radius: 3.4, color: col.stroke, weight: 1, fillColor: col.fill, fillOpacity: 0.95, interactive: false, renderer: this.canvasRenderer }).addTo(this.capaGlobal);
        // Los puntos se dibujan en canvas y NO son interactivos (8000 marcadores con eventos
        // ponen el mapa a gatear). El clic se resuelve buscando el punto mas cercano, que
        // ademas perdona el pulso: no hace falta acertarle al pixel.
        this.ptsGlobal.push({ c, ll: cliLL, napId });
        k++;
      }
    }
  }

  /** Puntos de cliente pintados ahora mismo en la vista global, para resolver el clic. */
  private ptsGlobal: { c: CoberturaClienteGeo; ll: L.LatLngTuple; napId: number }[] = [];

  /**
   * Clic en el mapa: abre la ficha del cliente mas cercano al punto donde tocaste.
   *
   * Los puntos de la vista global se dibujan en canvas y sin eventos (con 8000 marcadores
   * interactivos el mapa se arrastra), asi que el clic se resuelve por distancia en pixeles
   * contra los puntos que estan pintados. Si no hay ninguno cerca, no pasa nada.
   */
  private clicEnMapa(e: L.LeafletMouseEvent): void {
    const map = this.map;
    if (!map || !this.ptsGlobal.length) return;
    const p = map.latLngToContainerPoint(e.latlng);
    let mejor: { c: CoberturaClienteGeo; ll: L.LatLngTuple; napId: number } | null = null;
    let mejorD = 15;   // radio de tolerancia en pixeles
    for (const it of this.ptsGlobal) {
      const q = map.latLngToContainerPoint(L.latLng(it.ll));
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < mejorD) { mejorD = d; mejor = it; }
    }
    if (mejor) this.fichaCliente(mejor.c, mejor.ll, mejor.napId);
  }

  /** Ficha emergente del cliente: quien es, en que estado esta y por donde esta servido. */
  private fichaCliente(c: CoberturaClienteGeo, ll: L.LatLngTuple, napId?: number | null): void {
    if (!this.map) return;
    const est = this.estMeta(c.estadoGrupo);
    const cal = this.calMeta(c.calidad);
    const nom = (c.clienteNombre && c.clienteNombre.trim()) || c.documento || ('#' + c.idConContratoFk);
    const nap = this.etiquetaNap(napId ?? c.idGeoElementoFk ?? 0);
    const fila = (k: string, v: string) => (v ? `<div class="cob-pop-r"><span>${k}</span><b>${v}</b></div>` : '');
    const onu = c.gponOnu != null ? this.esc(c.gponOnu) + (c.onuEstado ? ' \u00b7 ' + this.esc(c.onuEstado) : '') : '';
    const html =
      `<div class="cob-pop-t">${this.esc(nom)}</div>` +
      `<div class="cob-pop-s">${this.esc(c.documento || 's/d')} \u00b7 contrato #${this.esc(c.idConContratoFk)}</div>` +
      `<div class="cob-pop-chips">` +
        `<span class="cob-pop-chip" style="background:${est.fill}">${this.esc(c.estado || est.lbl)}</span>` +
        `<span class="cob-pop-chip" style="background:${cal.fill}">${this.esc(cal.lbl)}</span>` +
      `</div>` +
      fila('NAP', this.esc(nap) + (c.nivelNap ? ' \u00b7 nivel ' + c.nivelNap : '')) +
      fila('OLT', this.esc(c.oltNombre || '')) +
      fila('PON', this.ponLabel(c) === '\u2014' ? '' : this.esc(this.ponLabel(c))) +
      fila('ONU', onu) +
      fila('Distancia', c.distanciaM == null ? '' : this.dist(c.distanciaM)) +
      fila('Origen', c.fuente === 'RED' ? 'Red (amarre confirmado)' : 'GPS (cercan\u00eda)');
    L.popup({ className: 'cob-pop', maxWidth: 280, autoPan: true, closeButton: true })
      .setLatLng(L.latLng(ll))
      .setContent(html)
      .openOn(this.map);
  }

  /** Escapa el texto que va dentro del HTML del popup (los nombres vienen del ERP). */
  private esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- confirmador de PON (wizard) ----
  esNap1(): boolean { return this.napSel?.nivelNap === 1; }
  lpLabel(lp: CoberturaLpuPon): string { return (lp.lpu ?? '?') + '/' + lp.pon; }
  napPonLabel(p: CoberturaNapPon): string { return (p.lpu ?? '?') + '/' + p.pon; }

  openPicker(): void {
    this.pickerStep.set('olt');
    this.wizOlt.set(null);
    this.wizPons.set([]);
    this.wizErr.set(null);
    this.pickerOpen.set(true);
  }
  closePicker(): void { this.pickerOpen.set(false); }
  volverOlt(): void { this.pickerStep.set('olt'); this.wizOlt.set(null); this.wizPons.set([]); }

  /** Paso 1: elegir la OLT -> carga sus LPU-PON y pasa al paso 2. */
  pickOlt(o: CoberturaOlt): void {
    this.wizOlt.set(o);
    this.wizPons.set([]);
    this.loadingPons.set(true);
    this.pickerStep.set('pon');
    this.api.listarPons(o.idRedOlt).subscribe({
      next: (p) => { this.wizPons.set(p ?? []); this.loadingPons.set(false); },
      error: () => { this.loadingPons.set(false); },
    });
  }

  /** ese LPU-PON ya esta amarrado a ESTA NAP */
  enEstaNap(lp: CoberturaLpuPon): boolean {
    return lp.napId != null && lp.napId === this.napSel?.idGeoElemento;
  }
  /** ese LPU-PON ya esta amarrado a OTRA NAP -> bloqueado */
  enOtraNap(lp: CoberturaLpuPon): boolean {
    return lp.napId != null && lp.napId !== this.napSel?.idGeoElemento;
  }

  /** Paso 2: clic en un LPU-PON libre -> amarra a la NAP (se puede amarrar varios). */
  pickLpuPon(lp: CoberturaLpuPon): void {
    const nap = this.napSel;
    const o = this.wizOlt();
    if (!nap || !o || this.wizBusy() || this.enEstaNap(lp)) return;
    if (this.enOtraNap(lp)) {
      this.wizErr.set('Ese LPU-PON ya está amarrado a la NAP ' + (lp.napCodigo || '') + '. Un PON va a una sola NAP.');
      return;
    }
    this.wizErr.set(null);
    this.wizBusy.set(true);
    this.api.guardarNapPon({
      idGeoElementoFk: nap.idGeoElemento,
      idRedOltFk: o.idRedOlt,
      oltNombre: o.nombre ?? null,
      lpu: lp.lpu ?? null,
      pon: lp.pon,
    }).subscribe({
      next: () => {
        this.wizBusy.set(false);
        this.refrescarNapPons(nap);
        this.recargarClientes();
        this.closePicker();          // camello de una sola vez: se amarra y cierra
      },
      error: (e) => { this.wizBusy.set(false); this.wizErr.set(e?.message ?? 'No se pudo guardar el amarre'); },
    });
  }
  quitarPon(p: CoberturaNapPon): void {
    if (p.idRedNapPon == null) return;
    this.wizBusy.set(true);
    this.api.eliminarNapPon(p.idRedNapPon).subscribe({
      next: () => {
        this.wizBusy.set(false);
        if (this.napSel) { this.refrescarNapPons(this.napSel); this.recargarClientes(); }
      },
      error: (e) => { this.wizBusy.set(false); this.wizErr.set(e?.message ?? 'No se pudo eliminar'); },
    });
  }
  private refrescarNapPons(nap: CoberturaNap): void {
    this.api.napPons(nap.idGeoElemento).subscribe({ next: (p) => this.napPons.set(p ?? []), error: () => {} });
  }
  /** Re-lee los clientes (para recalcular la calidad tras cambiar amarres) y repinta. */
  private recargarClientes(): void {
    this.api.listarClientesGeo(this.radio()).subscribe({
      next: (rows) => {
        const m = new Map<number, CoberturaClienteGeo[]>();
        for (const c of rows ?? []) {
          if (!c.dentroRadio || c.idGeoElementoFk == null) continue;
          const a = m.get(c.idGeoElementoFk) ?? [];
          a.push(c);
          m.set(c.idGeoElementoFk, a);
        }
        this.setCli(m);
        if (this.napSel) {
          this.cliGeo.set(m.get(this.napSel.idGeoElemento) ?? []);
          this.dibujarSel(this.napSel);
        }
        this.pintarGlobal();
      },
      error: () => {},
    });
  }

  private map?: L.Map;
  private capa = L.layerGroup();
  private ro: ResizeObserver | null = null;
  private capaSel = L.layerGroup();
  private capaHi = L.layerGroup();     // resaltado del cliente elegido en la lista
  private capaGlobal = L.layerGroup();
  private canvasRenderer = L.canvas({ padding: 0.5 });
  private heat = new HeatOverlay();
  private heatPts: L.LatLngTuple[] = [];
  private fitted = false;
  private frame: number | null = null;

  private meta = new Map<number, CoberturaElementoMeta>();
  private cliPorNap = new Map<number, CoberturaClienteGeo[]>();
  private napSel?: CoberturaNap;
  private baseOsm?: L.TileLayer;
  private baseSat?: L.TileLayer;
  private capaZonas = L.layerGroup();
  private zonas: CoberturaZona[] = [];

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { center: [-0.22985, -78.52495], zoom: 12, zoomControl: true });
    this.baseOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap' });
    // Esri World Imagery: en zonas rurales no hay imagen a z>18; maxNativeZoom hace que Leaflet
    // reescale la ultima disponible en vez de mostrar el mosaico "Map data not yet available".
    this.baseSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 18, attribution: 'Tiles &copy; Esri' });
    this.baseOsm.addTo(this.map);
    this.capaZonas.addTo(this.map);
    this.capaGlobal.addTo(this.map);
    this.capaSel.addTo(this.map);
    this.capaHi.addTo(this.map);
    this.capa.addTo(this.map);
    this.map.on('moveend zoomend', () => this.scheduleRender());
    this.map.on('click', (e: L.LeafletMouseEvent) => this.clicEnMapa(e));
    setTimeout(() => this.map?.invalidateSize(), 150);
    // El contenedor cambia de tamaño (barra que se acomoda, menu lateral): Leaflet necesita saberlo o deja franjas grises.
    this.ro = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.ro.observe(this.mapEl.nativeElement);
    document.addEventListener('mousedown', this.cerrarDd, true);
    document.addEventListener('keydown', this.cerrarDd, true);
    // Sin mapa de calor: la pantalla muestra las cajas (filtradas por nivel y cupo del PON) y nada mas.
    this.cargar();
    this.api.listarOlts().subscribe({ next: (o) => this.olts.set(o ?? []), error: () => {} });
  }

  ngOnDestroy(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.ro?.disconnect();
    document.removeEventListener('mousedown', this.cerrarDd, true);
    document.removeEventListener('keydown', this.cerrarDd, true);
    this.heat.detach();
    this.map?.remove();
  }

  onRadio(ev: Event): void {
    this.radio.set(Number((ev.target as HTMLSelectElement).value) || 500);
    this.cerrar();
    this.cargar();
  }

  onToggleNombres(): void {
    this.verNombres.set(!this.verNombres());
    this.pintar();
  }

  recargar(): void { this.cerrar(); this.cargar(); }

  private cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    const r = this.radio();

    this.api.listarNaps(r).subscribe({
      next: (data) => { this.naps.set(data ?? []); this.fitOnce(); this.pintar(); this.loading.set(false); },
      error: (e) => { this.error.set(e?.message ?? 'Error al cargar la cobertura'); this.loading.set(false); },
    });

    this.api.listarBaseElementos().subscribe({
      next: (rows) => {
        const m = new Map<number, CoberturaElementoMeta>();
        for (const e of rows ?? []) m.set(e.idGeoElemento, e);
        this.meta = m;
        this.pintar();
      },
      error: () => { /* fallback de nombre */ },
    });

    this.cargarNapPon();
    this.cargarUbicacion();
    this.setCli(new Map());
    this.heatPts = [];
    this.api.listarClientesGeo(r).subscribe({
      next: (rows) => {
        const m = new Map<number, CoberturaClienteGeo[]>();
        const pts: L.LatLngTuple[] = [];
        for (const c of rows ?? []) {
          if (c.lat != null && c.lng != null) pts.push([c.lat, c.lng]);
          if (!c.dentroRadio || c.idGeoElementoFk == null) continue;
          const a = m.get(c.idGeoElementoFk) ?? [];
          a.push(c);
          m.set(c.idGeoElementoFk, a);
        }
        this.setCli(m);
        this.cliFull = rows ?? [];
        this.cliTick.set(this.cliTick() + 1);
        this.heatPts = pts;
        this.refrescarCalor();
        this.pintarGlobal();   // repinta el global con los datos frescos
      },
      error: () => { /* silencioso */ },
    });
  }

  toggleHeat(): void {
    const on = !this.heatOn();
    this.heatOn.set(on);
    if (!this.map) return;
    if (on) { this.heat.attach(this.map); this.heat.setPoints(this.heatPts); }
    else { this.heat.detach(); }
  }

  private nombreCorto(nap: CoberturaNap): string {
    const mt = this.meta.get(nap.idGeoElemento);
    return this.soloEtiqueta(mt?.etiqueta || mt?.nombre || nap.napNombre || nap.napCodigo || ('NAP ' + nap.idGeoElemento));
  }

  /** Misma etiqueta que el mapa, pero buscando por id (el Excel recorre el Map por id). */
  private etiquetaNap(napId: number): string {
    const mt = this.meta.get(napId);
    if (mt?.etiqueta || mt?.nombre) return this.soloEtiqueta(mt.etiqueta || mt.nombre || '');
    const n = this.naps().find((x) => x.idGeoElemento === napId);
    return this.soloEtiqueta(n?.napNombre || n?.napCodigo || ('NAP ' + napId));
  }

  /**
   * Deja SOLO la etiqueta de la caja NAP.
   *
   * Los nombres que vienen del KMZ traen toda la ruta del archivo pegada, por ejemplo
   * "KMLE_4_INNO_TOTAL_CALD_10AGO2024_KMZ_SAN_JOSE_MORAN_CALDERON_SJMO24_2_POINT_7182_d1d0..."
   * y lo unico que identifica la caja es "SJMO24_2". Lo que sigue a "_POINT_" es el id del
   * punto y el hash del KMZ, no aporta nada en un reporte.
   *
   * Si el texto no tiene "_POINT_" (etiqueta ya limpia) se devuelve tal cual.
   */
  private soloEtiqueta(s: string): string {
    const t = (s || '').trim();
    const i = t.toUpperCase().indexOf('_POINT_');
    if (i < 0) return t;
    const partes = t.slice(0, i).split('_').filter((x) => !!x);
    if (!partes.length) return t;
    const ultimo = partes[partes.length - 1];
    // "..._SJMO24_2_POINT_7182" -> "SJMO24_2"   |   "..._SJMO24_POINT_7182" -> "SJMO24"
    if (/^\d+$/.test(ultimo) && partes.length >= 2) return partes[partes.length - 2] + '_' + ultimo;
    return ultimo;
  }

  private fitOnce(): void {
    if (this.fitted || !this.map) return;
    const pts: L.LatLngTuple[] = [];
    for (const n of this.naps()) { if (n.lat != null && n.lng != null) pts.push([n.lat, n.lng]); if (pts.length > 800) break; }
    if (!pts.length) return;
    try { this.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 }); this.fitted = true; } catch { /* */ }
  }

  private scheduleRender(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => { this.frame = null; this.pintar(); this.pintarGlobal(); });
  }

  /** Icono real por nivel (de cualquier NAP que si trajo icono en base-elemento). */
  private iconByNivel = new Map<number, string>();

  private recalcIconByNivel(): void {
    this.iconByNivel = new Map();
    for (const nap of this.naps()) {
      const niv = nap.nivelNap ?? 0;
      if (this.iconByNivel.has(niv)) continue;
      const ic = this.meta.get(nap.idGeoElemento)?.icono;
      if (ic && /^https?:\/\//i.test(ic)) this.iconByNivel.set(niv, ic);
    }
  }

  /** Icono real del nivel (para la leyenda de la barra). */
  iconoNivel(n: number): string | null {
    return this.iconByNivel.get(n) ?? null;
  }

  /** Tamaño del icono segun el zoom: de lejos chico para que no se amontonen, de cerca el normal. */
  private tamIcono(zoom: number): number {
    return zoom >= 15 ? 26 : zoom >= 14 ? 22 : zoom >= 13 ? 18 : zoom >= 12 ? 15 : 12;
  }

  private napIcon(nap: CoberturaNap, t = 26): L.Icon | L.DivIcon {
    // 1) icono real propio; 2) icono real de su nivel (para las que base-elemento no trajo)
    const propio = this.meta.get(nap.idGeoElemento)?.icono;
    const url = (propio && /^https?:\/\//i.test(propio)) ? propio : this.iconByNivel.get(nap.nivelNap ?? 0);
    if (url) {
      return L.icon({ iconUrl: url, iconSize: [t, t], iconAnchor: [t / 2, t], tooltipAnchor: [0, -t + 4] });
    }
    // 3) ultimo recurso (si NINGUNA NAP trajo icono): pin de color por nivel
    const c = nap.nivelNap === 1 ? '#2563eb' : '#0891b2';
    const html =
      '<svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M11 0C5 0 0 4.9 0 11c0 7.7 11 17 11 17s11-9.3 11-17C22 4.9 17 0 11 0z" fill="' + c + '" stroke="#ffffff" stroke-width="1.5"/>' +
      '<circle cx="11" cy="11" r="4.2" fill="#ffffff"/></svg>';
    const w = Math.round(t * 22 / 26), h = Math.round(t * 28 / 26);
    return L.divIcon({ html: html.replace('width="22" height="28"', 'width="' + w + '" height="' + h + '"'), className: 'cob-nappin',
                       iconSize: [w, h], iconAnchor: [w / 2, h], tooltipAnchor: [0, -h + 4] });
  }

  private pintar(): void {
    if (!this.map) return;
    this.capa.clearLayers();
    this.recalcIconByNivel();
    const view = this.map.getBounds().pad(0.15);
    const zoom = this.map.getZoom();
    const showLabels = this.verNombres() && zoom >= LABEL_ZOOM;
    const t = this.tamIcono(zoom);
    const cap = DOT_CAP;
    let n = 0;
    let labels = 0;
    for (const nap of this.napsFiltradas()) {
      if (n >= cap) break;
      if (nap.lat == null || nap.lng == null) continue;
      const ll: L.LatLngTuple = [nap.lat, nap.lng];
      if (!view.contains(ll)) continue;
      n++;
      const nombre = this.nombreCorto(nap);
      // 1er nivel un poco mas grande y encima: es la caja que se vende primero
      const m = L.marker(ll, { icon: this.napIcon(nap, nap.nivelNap === 1 ? t + 2 : t), zIndexOffset: nap.nivelNap === 1 ? 500 : 0 });
      if (showLabels && labels < LABEL_CAP) {
        m.bindTooltip(nombre, { permanent: true, direction: 'top', className: 'cob-lbl-perm' });
        labels++;
      } else {
        const pm = this.ponMin(nap.idGeoElemento);
        m.bindTooltip(nombre + ' · ' + nap.totalClientes + ' cli.' + (pm == null ? ' · PON sin amarrar' : ' · PON con ' + pm + ' cli. · ' + this.fuenteTexto(nap.idGeoElemento)), { direction: 'top', className: 'cob-lbl' });
      }
      m.on('click', () => this.seleccionar(nap));
      m.addTo(this.capa);
    }
  }

  seleccionar(nap: CoberturaNap): void {
    this.napSel = nap;
    this.cliSel.set(null);
    this.capaHi.clearLayers();
    this.titulo.set(this.nombreCorto(nap));
    this.napCli.set(null);
    this.cliGeo.set(this.cliPorNap.get(nap.idGeoElemento) ?? []);
    this.cliError.set(null);
    this.loadingCli.set(true);
    this.panelOpen.set(true);

    this.dibujarSel(nap);
    if (nap.lat != null && nap.lng != null) {
      this.map?.setView([nap.lat, nap.lng], Math.max(this.map.getZoom(), 16), { animate: true });
      this.map?.panBy([180, 0], { animate: true });
    }

    // amarres de PON (solo para NAP de 1er nivel)
    this.napPons.set([]);
    this.pickerOpen.set(false); this.wizOlt.set(null); this.wizPons.set([]); this.wizErr.set(null);
    if (nap.nivelNap === 1) {
      this.api.napPons(nap.idGeoElemento).subscribe({ next: (p) => this.napPons.set(p ?? []), error: () => {} });
    }

    this.api.clientesNap(nap.idGeoElemento).subscribe({
      next: (d) => { this.napCli.set(d as unknown as MapaNapClientes); this.loadingCli.set(false); },
      error: (e) => { this.cliError.set(e?.message ?? 'No se pudo cargar el detalle de clientes'); this.loadingCli.set(false); },
    });
  }

  /**
   * Dibuja el circulo de la NAP + las lineas a SUS clientes, coloreadas por calidad.
   * Al hacer clic en una NAP se muestran SIEMPRE todas sus conexiones (vista de detalle/validación),
   * sin importar qué capas globales tengas encendidas o apagadas.
   */
  private dibujarSel(nap: CoberturaNap): void {
    this.capaSel.clearLayers();
    if (nap.lat == null || nap.lng == null) return;
    const napLL: L.LatLngTuple = [nap.lat, nap.lng];
    const color = nap.nivelNap === 1 ? '#2563eb' : '#0891b2';
    L.circle(napLL, { radius: nap.radioM ?? 500, color, weight: 1.5, fillColor: color, fillOpacity: 0.07, opacity: 0.55, interactive: false }).addTo(this.capaSel);
    let k = 0;
    for (const c of this.cliGeo()) {
      if (k >= CONEX_CAP) break;
      if (c.lat == null || c.lng == null) continue;
      const q = c.calidad ?? 2;
      const col = this.calMeta(q);
      const cll: L.LatLngTuple = [c.lat, c.lng];
      L.polyline([napLL, cll], { color: col.line, weight: 1.5, opacity: 0.65, interactive: false }).addTo(this.capaSel);
      const dot = L.circleMarker(cll, { radius: 3.8, color: col.stroke, weight: 1, fillColor: col.fill, fillOpacity: 0.95 });
      const nom = (c.clienteNombre && c.clienteNombre.trim()) || c.documento || ('#' + c.idConContratoFk);
      dot.bindTooltip(nom + ' · ' + col.lbl + ' · ' + this.dist(c.distanciaM), { direction: 'top' });
      dot.on('click', () => this.fichaCliente(c, cll, nap.idGeoElemento));
      dot.addTo(this.capaSel);
      k++;
    }
  }

  /**
   * Clic en un cliente de la lista -> resalta SU conexión en el mapa (halo blanco + línea gruesa
   * de su color de calidad + marcador grande), centra la vista y deja abierto su nombre.
   */
  resaltarCliente(c: CoberturaClienteGeo): void {
    this.capaHi.clearLayers();
    const nap = this.napSel;
    if (!this.map || !nap || nap.lat == null || nap.lng == null || c.lat == null || c.lng == null) return;

    // toggle: si ya estaba resaltado, lo apaga
    if (this.cliSel() === c.idRedCoberturaCliente) { this.cliSel.set(null); return; }
    this.cliSel.set(c.idRedCoberturaCliente);

    const napLL: L.LatLngTuple = [nap.lat, nap.lng];
    const cll: L.LatLngTuple = [c.lat, c.lng];
    const col = this.calMeta(c.calidad);
    // halo blanco debajo para que resalte sobre cualquier fondo
    L.polyline([napLL, cll], { color: '#ffffff', weight: 8, opacity: 0.9, interactive: false }).addTo(this.capaHi);
    L.polyline([napLL, cll], { color: col.line, weight: 4, opacity: 1, interactive: false }).addTo(this.capaHi);
    L.circleMarker(cll, { radius: 8, color: '#ffffff', weight: 3, fillColor: col.fill, fillOpacity: 1 }).addTo(this.capaHi);
    const nom = (c.clienteNombre && c.clienteNombre.trim()) || c.documento || ('#' + c.idConContratoFk);
    L.circleMarker(cll, { radius: 8, color: col.stroke, weight: 1, fillColor: 'transparent', fillOpacity: 0, interactive: false })
      .bindTooltip(nom + ' · ' + col.lbl + ' · ' + this.dist(c.distanciaM), { permanent: true, direction: 'top', className: 'cob-lbl-perm' })
      .addTo(this.capaHi)
      .openTooltip();

    // centra la vista en la conexión (NAP + cliente)
    try { this.map.fitBounds(L.latLngBounds([napLL, cll]).pad(0.6), { maxZoom: 18, animate: true }); } catch { /* */ }
  }

  cerrar(): void {
    this.napSel = undefined;
    this.panelOpen.set(false);
    this.napCli.set(null);
    this.cliGeo.set([]);
    this.cliError.set(null);
    this.napPons.set([]);
    this.cliSel.set(null);
    this.pickerOpen.set(false); this.wizOlt.set(null); this.wizPons.set([]); this.wizErr.set(null);
    this.capaSel.clearLayers();
    this.capaHi.clearLayers();
  }

  estadoClase(estado: string | null | undefined): string {
    const t = String(estado || '').toLowerCase();
    if (t.includes('activ')) return 'is-activo';
    if (t.includes('suspend') || t.includes('cort')) return 'is-suspendido';
    if (t.includes('anul') || t.includes('retir') || t.includes('baja')) return 'is-baja';
    return '';
  }

  dist(m: number | null | undefined): string {
    return m == null ? '? m' : Math.round(m) + ' m';
  }

  ponLabel(c: CoberturaClienteGeo): string {
    if (c.lpuPosicion == null && c.ponPuerto == null) return '—';
    return (c.lpuPosicion ?? '?') + '/' + (c.ponPuerto ?? '?');
  }
}
