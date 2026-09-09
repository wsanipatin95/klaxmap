import {
  AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, ViewEncapsulation,
  inject, signal,
} from '@angular/core';
import * as L from 'leaflet';
import * as XLSX from 'xlsx';

import { CoberturaApi } from '../../data-access/cobertura.api';
import type { CoberturaNap, CoberturaClienteGeo, CoberturaElementoMeta, CoberturaOlt, CoberturaNapPon, CoberturaLpuPon, CoberturaZona } from '../../data-access/cobertura.models';

type ZonaMetric = 'total' | 'activos' | 'cortados' | 'otros';
import type { MapaNapClientes } from 'src/app/features/mapa/data-access/mapa.models';

const NAP_CAP = 1500;
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
      <div class="flex items-center gap-2 bg-white rounded-lg shadow-sm px-3 py-2">
        <h2 class="font-semibold text-slate-700 text-sm">Cobertura de clientes</h2>
        <span class="text-[11px] text-slate-400">NAP 1er/2do nivel &middot; clic para ver sus clientes y conexiones</span>
        <div class="ml-auto flex items-center gap-2">
          <label class="flex items-center gap-1 text-[11px] text-slate-500">
            <input type="checkbox" class="accent-blue-600" [checked]="verNombres()" (change)="onToggleNombres()" /> Nombres
          </label>
          <button class="cob-toggle" [class.cob-toggle-on]="heatOn()" (click)="toggleHeat()" title="Mapa de calor de clientes">🔥 Mapa de calor</button>
          <button class="cob-toggle" [class.cob-toggle-on]="satOn()" (click)="toggleSat()" title="Cambiar vista del mapa">{{ satOn() ? '🗺️ Calles' : '🛰️ Satélite' }}</button>
          <button class="cob-toggle" [class.cob-toggle-on]="zonasOn()" (click)="toggleZonas()" title="Zonas (barrios) coloreadas por métrica">🟦 Zonas</button>
          @if (zonasOn()) {
            <select class="cob-sel" (change)="onZonaMetric($event)">
              <option value="total" [selected]="zonaMetric() === 'total'">Total clientes</option>
              <option value="activos" [selected]="zonaMetric() === 'activos'">Activos</option>
              <option value="cortados" [selected]="zonaMetric() === 'cortados'">Cortados/Susp.</option>
              <option value="otros" [selected]="zonaMetric() === 'otros'">Bajas</option>
            </select>
          }
          <label class="text-[11px] text-slate-500">Radio (m)</label>
          <select class="cob-sel" (change)="onRadio($event)">
            <option [selected]="radio() === 500" value="500">500</option>
            <option [selected]="radio() === 600" value="600">600</option>
            <option [selected]="radio() === 800" value="800">800</option>
            <option [selected]="radio() === 1000" value="1000">1000</option>
          </select>
          <button class="cob-btn" (click)="recargar()" [disabled]="loading()">{{ loading() ? 'Cargando…' : '↻ Recargar' }}</button>
          <button class="cob-btn" (click)="descargarExcel()" title="Descargar a Excel los clientes visibles según las capas activas">⬇ Excel</button>
          <span class="text-[11px] text-slate-500">{{ naps().length }} NAP</span>
        </div>
      </div>

      <div class="flex items-center gap-1.5 bg-white rounded-lg shadow-sm px-3 py-1.5 flex-wrap">
        <span class="text-[11px] font-semibold text-slate-500 mr-1">Capas de conexión:</span>
        @for (q of [3, 2, 1, 0]; track q) {
          <button class="cob-lg" [class.off]="!verCal()[q]" (click)="toggleCal(q)" [title]="'Mostrar/ocultar: ' + calMeta(q).lbl">
            <span class="cob-lg-dot" [style.background]="calMeta(q).fill"></span>
            {{ calMeta(q).lbl }}
          </button>
        }
        <span class="mx-1 text-slate-300">|</span>
        <span class="text-[11px] font-semibold text-slate-500">Estado:</span>
        @for (g of [1, 2, 3]; track g) {
          <button class="cob-lg" [class.off]="!verEstado()[g]" (click)="toggleEstado(g)" [title]="'Mostrar/ocultar: ' + estMeta(g).lbl">
            <span class="cob-lg-dot is-est" [style.background]="estMeta(g).fill"></span>
            {{ estMeta(g).lbl }}
          </button>
        }
      </div>

      @if (error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-1.5">{{ error() }}</div>
      }

      <div class="flex-1 relative min-h-0">
        <div #mapEl class="cob-map absolute inset-0 rounded-lg overflow-hidden border border-slate-200"></div>

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
                <div class="cob-wiz-h">🔌 Confirmador de PON de esta NAP</div>
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
                <div class="cob-counter">
                  <div><b>{{ d.ocupados }}</b> / {{ d.total }} <span class="cob-mut">puertos</span></div>
                  <div class="cob-disp" [class.full]="d.disponibles === 0">{{ d.disponibles }} disponibles</div>
                </div>
              </div>
            }

            <div class="cob-side-body">
              <div class="cob-sec">Clientes de la NAP · {{ cliGeo().length }}</div>
              @if (cliGeo().length) {
                <div class="cob-cal-counts">
                  <span class="cob-cal cal-3">🟢 {{ calCount(3) }} confirmado</span>
                  <span class="cob-cal cal-2">🟡 {{ calCount(2) }} sin confirmar</span>
                  @if (calCount(1)) { <span class="cob-cal cal-1">🔴 {{ calCount(1) }} otro PON</span> }
                  @if (calCount(0)) { <span class="cob-cal cal-0">⬛ {{ calCount(0) }} sin GPS</span> }
                </div>
                <ul class="cob-list">
                  @for (c of cliGeo(); track c.idRedCoberturaCliente) {
                    <li class="cob-card" [class.active]="cliSel() === c.idRedCoberturaCliente" (click)="resaltarCliente(c)" title="Clic para resaltar su conexión en el mapa">
                      <div class="cob-card-top">
                        <span class="cob-card-name" [title]="c.clienteNombre || ''">{{ c.clienteNombre || c.documento || ('#' + c.idConContratoFk) }}</span>
                        <span class="cob-badge" [class]="estadoClase(c.estado)">{{ c.estado || 's/estado' }}</span>
                      </div>
                      <div class="cob-card-sub">
                        Doc {{ c.documento || '—' }} ·
                        <span class="cob-cal cal-{{ c.calidad ?? 2 }}">{{ calMeta(c.calidad).lbl }}</span>
                        · {{ dist(c.distanciaM) }}
                      </div>
                      <div class="cob-card-svc">
                        <span class="cob-tag cob-tag-olt" [title]="'OLT'">🖧 {{ c.oltNombre || 'Sin OLT' }}</span>
                        <span class="cob-tag" [title]="'Puerto PON (tarjeta/puerto)'">PON {{ ponLabel(c) }}</span>
                        <span class="cob-tag" [title]="'ONU'">ONU {{ c.gponOnu ?? '—' }}</span>
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <div class="cob-empty">Sin clientes en esta NAP.</div>
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
                <div class="cob-modal-title">🖧 Elegí la OLT <span class="cob-modal-sub">clic para ver sus LPU-PON</span></div>
              } @else {
                <div class="cob-modal-title">
                  <button class="cob-modal-back-btn" (click)="volverOlt()" title="Volver a OLTs">‹</button>
                  📍 Elegí LPU-PON <span class="cob-modal-sub">{{ wizOlt()?.nombre }} · tarjeta/puerto</span>
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
                        @if (enOtraNap(lp)) { <span class="cob-pon-nap">🔒 {{ lp.napCodigo }}</span> }
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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly radio = signal(500);
  readonly verNombres = signal(true);

  readonly panelOpen = signal(false);
  readonly titulo = signal('NAP');
  readonly napCli = signal<MapaNapClientes | null>(null);
  readonly cliGeo = signal<CoberturaClienteGeo[]>([]);
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
   * Descarga a Excel (.xlsx) los clientes que pasan las CAPAS ACTIVAS (calidad + estado) — lo mismo
   * que se está pintando en el mapa. Una fila por cliente con su estado, NAP, OLT/PON/ONU y distancia.
   */
  descargarExcel(): void {
    const vis = this.verCal(), visEst = this.verEstado();
    const rows: Record<string, string | number>[] = [];
    for (const [, clientes] of this.cliPorNap) {
      for (const c of clientes) {
        const q = c.calidad ?? 2;
        const g = c.estadoGrupo ?? 3;
        if (!vis[q] || !visEst[g]) continue;   // respeta las capas encendidas
        rows.push({
          'Cliente': (c.clienteNombre && c.clienteNombre.trim()) || '',
          'Documento': c.documento ?? '',
          'Estado': c.estado ?? '',
          'Grupo estado': this.estMeta(g).lbl,
          'Calidad conexión': this.calMeta(q).lbl,
          'NAP': c.napCodigo ?? '',
          'Nivel NAP': c.nivelNap ?? '',
          'OLT': c.oltNombre ?? '',
          'PON (tarjeta/puerto)': this.ponLabel(c),
          'ONU': c.gponOnu ?? '',
          'Distancia (m)': c.distanciaM != null ? Math.round(c.distanciaM) : '',
          'Latitud': c.lat ?? '',
          'Longitud': c.lng ?? '',
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
      { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
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
    if (!this.map) return;
    if (!this.filtroActivo()) return;   // ninguna capa encendida -> nada que pintar
    const vis = this.verCal(), visEst = this.verEstado();
    const view = this.map.getBounds().pad(0.2);   // solo lo visible (+margen) para no relentizar
    const napById = new Map<number, CoberturaNap>(this.naps().map((n) => [n.idGeoElemento, n]));
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
        k++;
      }
    }
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
        this.cliPorNap = m;
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
    setTimeout(() => this.map?.invalidateSize(), 150);
    this.cargar();
    this.api.listarOlts().subscribe({ next: (o) => this.olts.set(o ?? []), error: () => {} });
  }

  ngOnDestroy(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
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

    this.cliPorNap = new Map();
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
        this.cliPorNap = m;
        this.heatPts = pts;
        if (this.heat.active) this.heat.setPoints(this.heatPts);
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
    return (mt?.etiqueta || mt?.nombre || nap.napNombre || nap.napCodigo || ('NAP ' + nap.idGeoElemento)).trim();
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

  private napIcon(nap: CoberturaNap): L.Icon | L.DivIcon {
    // 1) icono real propio; 2) icono real de su nivel (para las que base-elemento no trajo)
    const propio = this.meta.get(nap.idGeoElemento)?.icono;
    const url = (propio && /^https?:\/\//i.test(propio)) ? propio : this.iconByNivel.get(nap.nivelNap ?? 0);
    if (url) {
      return L.icon({ iconUrl: url, iconSize: [26, 26], iconAnchor: [13, 26], tooltipAnchor: [0, -22] });
    }
    // 3) ultimo recurso (si NINGUNA NAP trajo icono): pin de color por nivel
    const c = nap.nivelNap === 1 ? '#2563eb' : '#0891b2';
    const html =
      '<svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M11 0C5 0 0 4.9 0 11c0 7.7 11 17 11 17s11-9.3 11-17C22 4.9 17 0 11 0z" fill="' + c + '" stroke="#ffffff" stroke-width="1.5"/>' +
      '<circle cx="11" cy="11" r="4.2" fill="#ffffff"/></svg>';
    return L.divIcon({ html, className: 'cob-nappin', iconSize: [22, 28], iconAnchor: [11, 28], tooltipAnchor: [0, -24] });
  }

  private pintar(): void {
    if (!this.map) return;
    this.capa.clearLayers();
    this.recalcIconByNivel();
    const view = this.map.getBounds().pad(0.15);
    const zoom = this.map.getZoom();
    const showLabels = this.verNombres() && zoom >= LABEL_ZOOM;
    let n = 0;
    let labels = 0;
    for (const nap of this.naps()) {
      if (n >= NAP_CAP) break;
      if (nap.lat == null || nap.lng == null) continue;
      const ll: L.LatLngTuple = [nap.lat, nap.lng];
      if (!view.contains(ll)) continue;
      n++;
      const nombre = this.nombreCorto(nap);
      const m = L.marker(ll, { icon: this.napIcon(nap) });
      if (showLabels && labels < LABEL_CAP) {
        m.bindTooltip(nombre, { permanent: true, direction: 'top', className: 'cob-lbl-perm' });
        labels++;
      } else {
        m.bindTooltip(nombre + ' · ' + nap.totalClientes + ' cli.', { direction: 'top', className: 'cob-lbl' });
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
