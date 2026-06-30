import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy,
  Output, SimpleChanges, ViewChild, ViewEncapsulation,
} from '@angular/core';
import * as L from 'leaflet';

import type {
  RedBaseElemento, RedCapaKey, RedDispositivoPasivo, RedDispositivoPuerto,
  RedElementoRelacion, RedFoHilo, RedPonElementoRelacion,
} from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';
import { estadoVisual, esConflicto, esPendienteCampo, esValidado, parseLatLon } from '../../util/red-beta-estado.util';

const BASE_CAP = 2500;
const LABEL_CAP = 60;
const OVERLAY_CAP = 1500;
const HILOS_CAP = 600;
const PUERTOS_SPLIT_CAP = 200;
const POINTS_MIN_ZOOM = 15;
const LABELS_MIN_ZOOM = 18;
const VIEWPORT_PAD = 0.1;
const FANOUT_CAP = 80;
const PUERTO_RADIO = 0.00012;
const DIM = 0.12;

/**
 * Mapa Leaflet de la beta. Capa base + capas operativas. Al seleccionar: halo grueso en lo
 * seleccionado, el resto baja opacidad (o se oculta en modo "ver solo anillo"). NO mueve el mapa
 * automaticamente; el centrado es por boton.
 */
@Component({
  selector: 'app-red-beta-map',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `<div #mapEl class="rb-map h-full w-full rounded-lg overflow-hidden border border-slate-200"></div>`,
  styles: [
    `:host{display:block;height:100%;width:100%;}
     .rb-map .leaflet-tooltip.rb-label{background:transparent;border:none;box-shadow:none;padding:0;color:#1f2937;font-size:10px;font-weight:600;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 2px #fff;}
     .rb-map .leaflet-tooltip.rb-label::before{display:none;}
     .rb-flow{stroke-dasharray:9 7;animation:rb-dash 0.6s linear infinite;stroke-linecap:round;}
     @keyframes rb-dash{from{stroke-dashoffset:0;}to{stroke-dashoffset:-16;}}
     .rb-glow{animation:rb-glow 1.2s ease-in-out infinite;stroke-linecap:round;}
     @keyframes rb-glow{0%,100%{opacity:.18;stroke-width:7px;}50%{opacity:.5;stroke-width:15px;}}
     .rb-pulse{animation:rb-pulse 1.2s ease-in-out infinite;transform-origin:center;transform-box:fill-box;}
     @keyframes rb-pulse{0%{opacity:.95;transform:scale(.8);}50%{opacity:.2;transform:scale(1.35);}100%{opacity:.95;transform:scale(.8);}}
     .rb-ping{animation:rb-ping 1.6s ease-out infinite;transform-origin:center;transform-box:fill-box;}
     @keyframes rb-ping{0%{opacity:.55;transform:scale(.6);}80%,100%{opacity:0;transform:scale(2.3);}}
     .rb-relpulse{animation:rb-relpulse 1.3s ease-in-out infinite;}
     @keyframes rb-relpulse{0%,100%{opacity:.5;}50%{opacity:1;}}`,
  ],
})
export class RedBetaMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() baseElementos: RedBaseElemento[] = [];
  @Input() relaciones: RedElementoRelacion[] = [];
  @Input() splitters: RedDispositivoPasivo[] = [];
  @Input() ponFo: RedPonElementoRelacion[] = [];
  @Input() hilos: RedFoHilo[] = [];
  @Input() puertos: RedDispositivoPuerto[] = [];
  @Input() hiddenCapas: Set<RedCapaKey> = new Set();
  @Input() etiquetas = true;
  @Input() seleccion: RedSeleccion | null = null;
  @Input() relatedGeoIds: Set<number> = new Set();
  @Input() soloAnillo = false;
  @Input() centrarReq = 0;

  @Output() seleccionar = new EventEmitter<RedSeleccion>();

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private baseGroup = L.layerGroup();
  private overlayGroup = L.layerGroup();
  private highlightGroup = L.layerGroup();
  private viewInit = false;
  private fitted = false;
  private resizeObs?: ResizeObserver;
  private frame: number | null = null;

  private baseSrc: RedBaseElemento[] | null = null;
  private baseIdx = new Map<number, RedBaseElemento>();
  private puertosSrc: RedDispositivoPuerto[] | null = null;
  private puertosIdx = new Map<number, RedDispositivoPuerto[]>();
  private splitterSrc: RedDispositivoPasivo[] | null = null;
  private splitterIdx = new Map<number, RedDispositivoPasivo>();

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { center: [-0.22985, -78.52495], zoom: 13, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' }).addTo(this.map);
    this.baseGroup.addTo(this.map);
    this.overlayGroup.addTo(this.map);
    this.highlightGroup.addTo(this.map);
    this.viewInit = true;
    this.map.on('moveend zoomend', () => this.scheduleRender());
    this.resizeObs = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObs.observe(this.mapEl.nativeElement);
    this.renderAll();
    this.fitOnce();
    setTimeout(() => this.map?.invalidateSize(), 150);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewInit) return;
    if (changes['baseElementos'] || changes['relaciones'] || changes['splitters'] || changes['ponFo'] ||
        changes['hilos'] || changes['puertos'] || changes['hiddenCapas'] || changes['etiquetas'] ||
        changes['seleccion'] || changes['relatedGeoIds'] || changes['soloAnillo']) {
      this.renderAll();
      if (changes['relaciones'] || changes['splitters']) this.fitOnce();
    }
    if (changes['centrarReq'] && !changes['centrarReq'].firstChange) {
      this.centrarSeleccion();
    }
  }

  ngOnDestroy(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.resizeObs?.disconnect();
    this.map?.remove();
  }

  private renderAll(): void {
    this.renderBase();
    this.renderOverlay();
    this.renderHighlight();
  }

  private scheduleRender(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => { this.frame = null; this.renderBase(); this.renderOverlay(); });
  }

  private visible(key: RedCapaKey): boolean { return !this.hiddenCapas.has(key); }
  private entidadVisible(categoria: RedCapaKey, estado: string | null | undefined): boolean {
    if (this.visible(categoria)) return true;
    if (esConflicto(estado) && this.visible('conflictos')) return true;
    if (esPendienteCampo(estado) && this.visible('pendienteCampo')) return true;
    return false;
  }

  // ---- resaltado / atenuacion
  private selActive(): boolean { return !!this.seleccion && this.relatedGeoIds.size > 0; }
  private skip(rel: boolean): boolean { return this.soloAnillo && this.selActive() && !rel; }
  private op(base: number, rel: boolean): number { return this.selActive() ? (rel ? base : base * DIM) : base; }
  private geoRel(id: number | null | undefined): boolean { return id != null && this.relatedGeoIds.has(id); }

  private baseIndex(): Map<number, RedBaseElemento> {
    if (this.baseSrc !== this.baseElementos) {
      this.baseIdx = new Map();
      for (const e of this.baseElementos) this.baseIdx.set(e.idGeoElemento, e);
      this.baseSrc = this.baseElementos;
    }
    return this.baseIdx;
  }
  private puertosBySplitter(): Map<number, RedDispositivoPuerto[]> {
    if (this.puertosSrc !== this.puertos) {
      this.puertosIdx = new Map();
      for (const p of this.puertos) { const a = this.puertosIdx.get(p.idDispositivoPasivoFk) ?? []; a.push(p); this.puertosIdx.set(p.idDispositivoPasivoFk, a); }
      this.puertosSrc = this.puertos;
    }
    return this.puertosIdx;
  }
  private splitterIndex(): Map<number, RedDispositivoPasivo> {
    if (this.splitterSrc !== this.splitters) {
      this.splitterIdx = new Map();
      for (const s of this.splitters) this.splitterIdx.set(s.idDispositivoPasivo, s);
      this.splitterSrc = this.splitters;
    }
    return this.splitterIdx;
  }

  // ---- capa base
  private renderBase(): void {
    if (!this.map) return;
    this.baseGroup.clearLayers();
    if (!this.visible('base')) return;
    const view = this.map.getBounds().pad(VIEWPORT_PAD);
    const zoom = this.map.getZoom();
    const showPoints = zoom >= POINTS_MIN_ZOOM;
    const showLabels = this.etiquetas && zoom >= LABELS_MIN_ZOOM;
    let drawn = 0, labels = 0;
    for (const e of this.baseElementos) {
      if (drawn >= BASE_CAP) break;
      const rel = this.geoRel(e.idGeoElemento);
      if (this.skip(rel)) continue;
      const stroke = e.colorStroke || '#94a3b8';
      const fill = e.colorFill || stroke;
      const weight = e.strokeWidth || 2;
      const tipo = (e.geomTipo || '').toLowerCase();
      const nombre = e.etiqueta || e.nombre || '';
      const wkt = e.wkt || '';
      const onClick = () => this.seleccionar.emit({ tipo: 'base', data: e });
      try {
        const esPunto = tipo.includes('point') || /^POINT/i.test(wkt) || (!wkt && !!e.latLon);
        if (esPunto) {
          if (!showPoints) continue;
          const ll = this.pointFromWkt(wkt) || parseLatLon(e.latLon);
          if (!ll || !view.contains(ll)) continue;
          drawn++;
          let marker: L.Layer;
          if (e.icono && /^https?:\/\//i.test(e.icono) && (!this.selActive() || rel)) {
            marker = L.marker(ll, { icon: L.icon({ iconUrl: e.icono, iconSize: [16, 16], iconAnchor: [8, 8] }), opacity: this.op(1, rel) });
          } else {
            marker = L.circleMarker(ll, { radius: 3, color: stroke, weight: 1, fillColor: fill, fillOpacity: this.op(0.85, rel), opacity: this.op(0.85, rel) });
          }
          marker.on('click', onClick);
          if (nombre && (!this.selActive() || rel)) {
            if (showLabels && labels < LABEL_CAP) { marker.bindTooltip(nombre, { permanent: true, direction: 'top', className: 'rb-label', offset: [0, -6] }); labels++; }
            else marker.bindTooltip(nombre);
          }
          marker.addTo(this.baseGroup);
        } else {
          const esPoligono = /POLYGON/i.test(wkt) || tipo.includes('polygon');
          for (const coords of this.ringsFromWkt(wkt)) {
            if (coords.length < 2) continue;
            if (!view.intersects(L.latLngBounds(coords))) continue;
            drawn++;
            const layer = esPoligono
              ? L.polygon(coords, { color: stroke, weight, fillColor: fill, fillOpacity: this.op(0.12, rel), opacity: this.op(0.85, rel) })
              : L.polyline(coords, { color: stroke, weight, opacity: this.op(0.85, rel) });
            layer.on('click', onClick);
            if (nombre) layer.bindTooltip(nombre);
            layer.addTo(this.baseGroup);
          }
        }
      } catch { /* geometria invalida */ }
    }
  }

  // ---- capas operativas
  private renderOverlay(): void {
    if (!this.map) return;
    this.overlayGroup.clearLayers();
    const view = this.map.getBounds().pad(VIEWPORT_PAD);
    let drawn = 0;
    for (const r of this.relaciones) {
      if (drawn >= OVERLAY_CAP) break;
      const categoria: RedCapaKey = esValidado(r.estadoRelacion) ? 'relValidadas' : 'relSugeridas';
      if (!this.entidadVisible(categoria, r.estadoRelacion)) continue;
      const rel = this.geoRel(r.idOrigen) || this.geoRel(r.idDestino);
      if (this.skip(rel)) continue;
      const o = parseLatLon(r.origenLatLon);
      const d = parseLatLon(r.destinoLatLon);
      if (!o && !d) continue;
      if (!(o && view.contains(o)) && !(d && view.contains(d))) continue;
      const vis = estadoVisual(r.estadoRelacion);
      drawn++;
      if (o && d) {
        const line = L.polyline([o, d], { color: vis.color, weight: this.selActive() && rel ? 5 : 4, opacity: this.op(vis.strike ? 0.4 : 0.95, rel), dashArray: vis.dashed ? '6 6' : undefined, className: this.selActive() && rel ? 'rb-relpulse' : undefined });
        line.on('click', () => this.seleccionar.emit({ tipo: 'relacion', data: r }));
        line.bindTooltip((r.origenNombre || '') + ' -> ' + (r.destinoNombre || '') + ' (' + r.estadoRelacion + ')');
        line.addTo(this.overlayGroup);
      } else if (o) {
        this.punto(o, vis.color, () => this.seleccionar.emit({ tipo: 'relacion', data: r }), r.estadoRelacion, rel);
      }
    }
    for (const s of this.splitters) {
      if (!this.entidadVisible('splitters', s.estadoDispositivo)) continue;
      const rel = this.geoRel(s.idContenedor);
      if (this.skip(rel)) continue;
      const ll = parseLatLon(s.contenedorLatLon) ?? parseLatLon(s.splitterOrigenLatLon);
      if (!ll || !view.contains(ll)) continue;
      const vis = estadoVisual(s.estadoDispositivo);
      const m = L.circleMarker(ll, { radius: 8, color: vis.color, weight: 2, fillColor: vis.color, fillOpacity: this.op(0.65, rel), opacity: this.op(1, rel) });
      m.on('click', () => this.seleccionar.emit({ tipo: 'splitter', data: s }));
      m.bindTooltip(s.nombreOperativo + ' (' + s.ratioSplitter + ', ' + s.estadoDispositivo + ')');
      m.addTo(this.overlayGroup);
    }
    if (this.visible('ponFo')) {
      for (const p of this.ponFo) {
        const rel = this.geoRel(p.idGeoElementoFk);
        if (this.skip(rel)) continue;
        const ll = parseLatLon(p.elementoLatLon);
        if (!ll || !view.contains(ll)) continue;
        const vis = estadoVisual(p.estadoRelacion);
        const m = L.circleMarker(ll, { radius: 7, color: vis.color, weight: 2, fillColor: '#ffffff', fillOpacity: this.op(0.9, rel), opacity: this.op(1, rel), dashArray: vis.dashed ? '4 4' : undefined });
        m.on('click', () => this.seleccionar.emit({ tipo: 'ponfo', data: p }));
        m.bindTooltip('PON/VLAN ' + p.idRedVlanFk + ' -> ' + (p.elementoNombre || '') + ' (' + p.estadoRelacion + ')');
        m.addTo(this.overlayGroup);
      }
    }
    this.renderHilos(view);
    this.renderPuertos(view);
  }

  private renderHilos(view: L.LatLngBounds): void {
    if (!this.visible('hilos')) return;
    const idx = this.baseIndex();
    let n = 0;
    for (const h of this.hilos) {
      if (n >= HILOS_CAP) break;
      const rel = this.geoRel(h.idGeoElementoFoFk);
      if (this.skip(rel)) continue;
      const fo = idx.get(h.idGeoElementoFoFk);
      const vis = estadoVisual(h.estadoHilo);
      const foNombre = h.foNombre || fo?.nombre || '';
      const tip = 'FO: ' + foNombre + '<br>Hilo: ' + h.numeroHilo + '<br>Color: ' + h.colorHilo + '<br>Estado: ' + h.estadoHilo + '<br>Origen: ' + h.origenRegistro;
      const wkt = h.foWkt || fo?.wkt || '';
      let drew = false;
      if (/LINESTRING/i.test(wkt) || (fo?.geomTipo || '').toLowerCase().includes('line')) {
        for (const coords of this.ringsFromWkt(wkt)) {
          if (coords.length < 2) continue;
          if (!view.intersects(L.latLngBounds(coords))) continue;
          const line = L.polyline(coords, { color: vis.color, weight: 2, opacity: this.op(0.95, rel) });
          line.bindTooltip(tip);
          line.on('click', () => this.seleccionar.emit({ tipo: 'hilo', data: h }));
          line.addTo(this.overlayGroup);
          drew = true; n++; break;
        }
      }
      if (!drew) {
        const ll = parseLatLon(h.foLatLon) || (fo ? parseLatLon(fo.latLon) : null);
        if (!ll || !view.contains(ll)) continue;
        const m = L.circleMarker(ll, { radius: 4, color: vis.color, weight: 1, fillColor: vis.color, fillOpacity: this.op(0.9, rel) });
        m.bindTooltip(tip);
        m.on('click', () => this.seleccionar.emit({ tipo: 'hilo', data: h }));
        m.addTo(this.overlayGroup);
        n++;
      }
    }
  }

  private renderPuertos(view: L.LatLngBounds): void {
    if (!this.visible('puertos')) return;
    const bySplit = this.puertosBySplitter();
    let drawnSplit = 0;
    for (const s of this.splitters) {
      if (drawnSplit >= PUERTOS_SPLIT_CAP) break;
      const rel = this.geoRel(s.idContenedor);
      if (this.skip(rel)) continue;
      const ll = parseLatLon(s.contenedorLatLon) ?? parseLatLon(s.splitterOrigenLatLon);
      if (!ll || !view.contains(ll)) continue;
      const ps = bySplit.get(s.idDispositivoPasivo);
      if (!ps || ps.length === 0) continue;
      drawnSplit++;
      const positions = this.fanout(ll, ps.length);
      ps.forEach((p, i) => {
        const vis = estadoVisual(p.estadoPuerto);
        const m = L.circleMarker(positions[i], { radius: 4, color: '#ffffff', weight: 1, fillColor: vis.color, fillOpacity: this.op(1, rel), opacity: this.op(1, rel) });
        m.bindTooltip(this.puertoTip(p));
        m.on('click', () => this.seleccionar.emit({ tipo: 'puerto', data: p }));
        m.addTo(this.overlayGroup);
      });
    }
  }

  private puertoTip(p: RedDispositivoPuerto): string {
    let t = 'Dispositivo: ' + (p.dispositivoNombre || '') + '<br>Puerto: ' + p.nombrePuerto + '<br>Tipo: ' + p.tipoPuerto + '<br>Numero: ' + p.numeroPuerto + '<br>Estado: ' + p.estadoPuerto;
    if (p.colorHilo) t += '<br>Hilo: ' + (p.numeroHilo ?? '') + ' ' + p.colorHilo;
    if (p.destinoNombre) t += '<br>Destino: ' + p.destinoNombre;
    return t;
  }

  private fanout(center: L.LatLngTuple, count: number): L.LatLngTuple[] {
    const out: L.LatLngTuple[] = [];
    const n = Math.max(count, 1);
    const start = -Math.PI / 2;
    for (let i = 0; i < count; i++) { const a = start + (2 * Math.PI * i) / n; out.push([center[0] + PUERTO_RADIO * Math.sin(a) * 0.7, center[1] + PUERTO_RADIO * Math.cos(a)]); }
    return out;
  }

  private punto(ll: L.LatLngExpression, color: string, onClick: () => void, estado: string, rel: boolean): void {
    const m = L.circleMarker(ll, { radius: 7, color, weight: 2, fillColor: color, fillOpacity: this.op(0.65, rel), opacity: this.op(1, rel) });
    m.on('click', onClick);
    m.bindTooltip(estado);
    m.addTo(this.overlayGroup);
  }

  // ---- resaltado del seleccionado (halo grueso) — NO mueve el mapa
  private renderHighlight(): void {
    if (!this.map) return;
    this.highlightGroup.clearLayers();
    const sel = this.seleccion;
    if (!sel) return;
    const d = sel.data;

    if (sel.tipo === 'relacion') {
      const o = parseLatLon(d.origenLatLon);
      const f = parseLatLon(d.destinoLatLon);
      if (o && f) {
        this.flowLine(o, f, estadoVisual(d.estadoRelacion).color);
        this.halo(o, '#16a34a', 'Inicio: ' + (d.origenNombre || ''));
        this.halo(f, '#dc2626', 'Fin: ' + (d.destinoNombre || ''));
        return;
      }
    }
    if (sel.tipo === 'splitter') {
      const ll = parseLatLon(d.contenedorLatLon) ?? parseLatLon(d.splitterOrigenLatLon);
      if (ll) {
        this.halo(ll, estadoVisual(d.estadoDispositivo).color, d.nombreOperativo || '');
        const ps = this.puertosBySplitter().get(d.idDispositivoPasivo) ?? [];
        const positions = this.fanout(ll, ps.length);
        const idx = this.baseIndex();
        ps.forEach((p, i) => {
          const vis = estadoVisual(p.estadoPuerto);
          L.polyline([ll, positions[i]], { color: vis.color, weight: 2, opacity: 0.85 }).addTo(this.highlightGroup);
          this.pulseSmall(positions[i], vis.color);
          if (p.idGeoElementoDestinoFk != null) {
            const dest = idx.get(p.idGeoElementoDestinoFk);
            const dll = dest ? parseLatLon(dest.latLon) : null;
            if (dll) L.polyline([positions[i], dll], { color: vis.color, weight: 2, opacity: 0.6, dashArray: '4 4' }).addTo(this.highlightGroup);
          }
        });
        return;
      }
    }
    if (sel.tipo === 'puerto') {
      const sp = this.splitterIndex().get(d.idDispositivoPasivoFk);
      const ll = sp ? (parseLatLon(sp.contenedorLatLon) ?? parseLatLon(sp.splitterOrigenLatLon)) : null;
      if (ll) {
        // Entrada: pintar la FO del hilo de subida en su color fisico (si esta asociado) y conectar al splitter.
        if (d.idFoHiloFk != null) {
          const hilo = this.hilos.find((h) => h.idFoHilo === d.idFoHiloFk);
          if (hilo) {
            const colH = this.colorHiloCss(hilo.colorHilo ?? d.colorHilo);
            const fo = this.baseIndex().get(hilo.idGeoElementoFoFk);
            const wkt = hilo.foWkt || fo?.wkt || '';
            let foEnd: L.LatLngTuple | null = null;
            for (const coords of this.ringsFromWkt(wkt)) {
              if (coords.length < 2) continue;
              L.polyline(coords, { color: '#ffffff', weight: 8, opacity: 0.6 }).addTo(this.highlightGroup);
              L.polyline(coords, { color: colH, weight: 4, className: 'rb-flow' }).addTo(this.highlightGroup);
              foEnd = coords[coords.length - 1];
            }
            const foLL = parseLatLon(hilo.foLatLon) || (fo ? parseLatLon(fo.latLon) : null) || foEnd;
            if (foLL) { this.flowLine(foLL, ll, colH); this.pulseSmall(foLL, colH); }
          }
        }
        // Salida: flujo del splitter hacia el destino fisico.
        if (d.idGeoElementoDestinoFk != null) {
          const dest = this.baseIndex().get(d.idGeoElementoDestinoFk);
          const dll = dest ? parseLatLon(dest.latLon) : null;
          if (dll) { this.flowLine(ll, dll, '#16a34a'); this.pulseSmall(dll, '#16a34a'); }
        }
        this.halo(ll, estadoVisual(d.estadoPuerto).color, d.nombrePuerto || '');
        return;
      }
    }
    if (sel.tipo === 'hilo') {
      const col = this.colorHiloCss(d.colorHilo);
      const fo = this.baseIndex().get(d.idGeoElementoFoFk);
      const wkt = d.foWkt || fo?.wkt || '';
      let drew = false;
      for (const coords of this.ringsFromWkt(wkt)) {
        if (coords.length < 2) continue;
        L.polyline(coords, { color: '#ffffff', weight: 9, opacity: 0.7 }).addTo(this.highlightGroup);
        L.polyline(coords, { color: col, weight: 5, opacity: 1, className: 'rb-flow' }).addTo(this.highlightGroup);
        drew = true;
      }
      const ll = parseLatLon(d.foLatLon) || (fo ? parseLatLon(fo.latLon) : null);
      if (ll) this.halo(ll, col, `Hilo ${d.numeroHilo} ${d.colorHilo}`);
      if (drew || ll) return;
    }
    const center = this.centerOf(sel);
    const gid = this.geoIdOf(sel);
    if (center) this.halo(center, '#2563eb', this.nombreOf(sel));
    if (center && gid != null) {
      let n = 0;
      for (const r of this.relaciones) {
        if (n >= FANOUT_CAP) break;
        const isO = r.idOrigen === gid, isD = r.idDestino === gid;
        if (!isO && !isD) continue;
        const other = parseLatLon(isO ? r.destinoLatLon : r.origenLatLon);
        if (!other) continue;
        n++;
        this.flowLine(center, other, estadoVisual(r.estadoRelacion).color);
        this.pulseSmall(other, estadoVisual(r.estadoRelacion).color);
      }
    }
  }

  private colorHiloCss(color: string | null | undefined): string {
    const m: Record<string, string> = {
      Azul: '#2563eb', 'Tomate / Naranja': '#fb923c', Verde: '#16a34a', Cafe: '#92400e',
      Gris: '#9ca3af', Blanco: '#cbd5e1', Rojo: '#dc2626', Negro: '#111827',
      Amarillo: '#facc15', Violeta: '#7c3aed', Rosado: '#f472b6', 'Aqua / Celeste': '#22d3ee',
    };
    return (color && m[color]) || '#7c3aed';
  }
  private flowLine(a: L.LatLngTuple, b: L.LatLngTuple, color: string): void {
    L.polyline([a, b], { color, weight: 9, opacity: 0.25, className: 'rb-glow' }).addTo(this.highlightGroup);
    L.polyline([a, b], { color, weight: 3.5, opacity: 0.95, className: 'rb-flow' }).addTo(this.highlightGroup);
  }
  private halo(ll: L.LatLngTuple, color: string, label: string): void {
    L.circleMarker(ll, { radius: 22, color, weight: 2, fillColor: color, fillOpacity: 0.1, className: 'rb-ping' }).addTo(this.highlightGroup);
    L.circleMarker(ll, { radius: 16, color, weight: 4, fillColor: color, fillOpacity: 0.14, className: 'rb-pulse' }).addTo(this.highlightGroup);
    const dot = L.circleMarker(ll, { radius: 6, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 });
    if (label) dot.bindTooltip(label, { permanent: true, direction: 'top', className: 'rb-label', offset: [0, -10] });
    dot.addTo(this.highlightGroup);
  }
  private pulseSmall(ll: L.LatLngTuple, color: string): void {
    L.circleMarker(ll, { radius: 5, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(this.highlightGroup);
  }

  // ---- centrar (boton)
  private centrarSeleccion(): void {
    if (!this.map || !this.seleccion) return;
    const sel = this.seleccion, d = sel.data;
    if (sel.tipo === 'relacion') {
      const o = parseLatLon(d.origenLatLon), f = parseLatLon(d.destinoLatLon);
      if (o && f) { this.map.fitBounds(L.latLngBounds([o, f]), { padding: [80, 80], maxZoom: 17 }); return; }
    }
    const ll = this.centerOf(sel);
    if (ll) this.map.setView(ll, Math.max(this.map.getZoom(), 16), { animate: true });
  }

  private centerOf(sel: RedSeleccion): L.LatLngTuple | null {
    const d = sel.data;
    switch (sel.tipo) {
      case 'base': return parseLatLon(d.latLon);
      case 'relacion': return parseLatLon(d.origenLatLon);
      case 'splitter': return parseLatLon(d.contenedorLatLon) ?? parseLatLon(d.splitterOrigenLatLon);
      case 'ponfo': return parseLatLon(d.elementoLatLon);
      case 'hilo': return parseLatLon(d.foLatLon);
      case 'puerto': {
        const sp = this.splitterIndex().get(d.idDispositivoPasivoFk);
        return sp ? (parseLatLon(sp.contenedorLatLon) ?? parseLatLon(sp.splitterOrigenLatLon)) : null;
      }
      default: return null;
    }
  }
  private geoIdOf(sel: RedSeleccion): number | null {
    const d = sel.data;
    switch (sel.tipo) {
      case 'base': return d.idGeoElemento ?? null;
      case 'relacion': return d.idOrigen ?? null;
      case 'splitter': return d.idContenedor ?? null;
      case 'ponfo': return d.idGeoElementoFk ?? null;
      case 'hilo': return d.idGeoElementoFoFk ?? null;
      default: return null;
    }
  }
  private nombreOf(sel: RedSeleccion): string {
    const d = sel.data;
    switch (sel.tipo) {
      case 'base': return d.etiqueta || d.nombre || '';
      case 'relacion': return d.origenNombre || '';
      case 'splitter': return d.nombreOperativo || '';
      case 'ponfo': return d.elementoNombre || '';
      case 'hilo': return d.foNombre || '';
      default: return '';
    }
  }

  private fitOnce(): void {
    if (this.fitted || !this.map) return;
    const pts: L.LatLngExpression[] = [];
    for (const r of this.relaciones) { const o = parseLatLon(r.origenLatLon), d = parseLatLon(r.destinoLatLon); if (o) pts.push(o); if (d) pts.push(d); if (pts.length > 400) break; }
    for (const s of this.splitters) { const ll = parseLatLon(s.contenedorLatLon) ?? parseLatLon(s.splitterOrigenLatLon); if (ll) pts.push(ll); if (pts.length > 600) break; }
    if (pts.length === 0) return;
    try { this.map.fitBounds(L.latLngBounds(pts as L.LatLngTuple[]), { padding: [30, 30], maxZoom: 14 }); this.fitted = true; this.renderBase(); } catch { /* */ }
  }

  private pointFromWkt(wkt: string): L.LatLngTuple | null {
    const m = wkt.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lon = Number(m[1]), lat = Number(m[2]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return [lat, lon];
  }
  private ringsFromWkt(wkt: string): L.LatLngTuple[][] {
    const groups = wkt.match(/\(([-0-9eE.,\s]+)\)/g);
    if (!groups) return [];
    const rings: L.LatLngTuple[][] = [];
    for (const g of groups) {
      const inner = g.replace(/[()]/g, '');
      const coords: L.LatLngTuple[] = [];
      for (const pair of inner.split(',')) {
        const nums = pair.trim().split(/\s+/);
        if (nums.length < 2) continue;
        const lon = Number(nums[0]), lat = Number(nums[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) coords.push([lat, lon]);
      }
      if (coords.length) rings.push(coords);
    }
    return rings;
  }
}
