import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-draw';
import type {
  MapaElemento,
  MapaGeomTipo,
  MapaGeometryEditedEvent,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import type { MapaToolMode } from '../../store/mapa-ui.store';

@Component({
  selector: 'app-mapa-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-canvas.component.html',
  styleUrl: './mapa-canvas.component.scss',
})
export class MapaCanvasComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() elementos: MapaElemento[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() selectedElementoId: number | null = null;
  @Input() toolMode: MapaToolMode = 'select';
  @Input() hiddenTipoIds: number[] = [];

  @Output() elementoSelected = new EventEmitter<MapaElemento | null>();
  @Output() elementoContext = new EventEmitter<{ elemento: MapaElemento; x: number; y: number }>();
  @Output() geometryCreated = new EventEmitter<{ wkt: string; geomTipo: MapaGeomTipo }>();
  @Output() geometryEdited = new EventEmitter<MapaGeometryEditedEvent>();

  private map!: L.Map;
  private drawnItems = new L.FeatureGroup();
  private renderedLayers = new Map<number, L.Layer>();
  private drawControl: any = null;

  ngAfterViewInit(): void {
    this.initMap();
    this.renderElementos();
    this.syncToolMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    if (changes['elementos'] || changes['selectedElementoId'] || changes['tipos'] || changes['hiddenTipoIds']) {
      this.renderElementos();
    }

    if (changes['toolMode']) {
      this.syncToolMode();
    }
  }

  centerOnElemento(id: number | null) {
    if (id == null) return;
    const selected = this.renderedLayers.get(id);
    if (!selected) return;

    if ('getBounds' in selected && typeof (selected as any).getBounds === 'function') {
      const bounds = (selected as any).getBounds();
      if (bounds?.isValid?.()) {
        this.map.fitBounds(bounds.pad(0.3));
        return;
      }
    }

    if ('getLatLng' in selected && typeof (selected as any).getLatLng === 'function') {
      this.map.panTo((selected as any).getLatLng());
    }
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [-0.22985, -78.52495],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 22,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.drawnItems.addTo(this.map);

    this.drawControl = new (L.Control as any).Draw({
      edit: {
        featureGroup: this.drawnItems,
      },
      draw: {
        marker: true,
        circle: false,
        circlemarker: false,
        rectangle: false,
        polyline: true,
        polygon: true,
      },
    });

    this.map.addControl(this.drawControl);

    this.map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Layer;
      const geomTipo = this.geomTipoFromLayerType(e.layerType);
      const wkt = this.layerToWkt(layer, geomTipo);
      if (!wkt) return;

      this.geometryCreated.emit({ wkt, geomTipo });
    });

    this.map.on((L as any).Draw.Event.EDITED, (e: any) => {
      const layers = e.layers;
      layers.eachLayer((layer: any) => {
        const idGeoElemento = layer.__idGeoElemento as number | undefined;
        const geomTipo = layer.__geomTipo as MapaGeomTipo | undefined;
        if (!idGeoElemento || !geomTipo) return;

        const wkt = this.layerToWkt(layer, geomTipo);
        if (!wkt) return;

        this.geometryEdited.emit({
          idGeoElemento,
          geomTipo,
          wkt,
        });
      });
    });
  }

  private syncToolMode() {
    const container = this.map.getContainer();

    this.map.dragging.enable();
    container.style.cursor = '';

    if (this.toolMode === 'move') {
      this.map.dragging.enable();
      container.style.cursor = 'grab';
      return;
    }

    if (this.toolMode === 'select') {
      this.map.dragging.enable();
      container.style.cursor = '';
      return;
    }

    if (this.toolMode === 'edit-geometry') {
      this.map.dragging.disable();
      container.style.cursor = 'crosshair';
      return;
    }

    this.map.dragging.disable();
    container.style.cursor = 'crosshair';
  }

  private renderElementos() {
    this.drawnItems.clearLayers();
    this.renderedLayers.clear();

    const hiddenSet = new Set(this.hiddenTipoIds);

    for (const el of this.elementos) {
      if (hiddenSet.has(el.idGeoTipoElementoFk)) continue;

      const tipo = this.tipos.find((t) => t.idGeoTipoElemento === el.idGeoTipoElementoFk) ?? null;
      const layer = this.layerFromElemento(el, tipo);
      if (!layer) continue;

      (layer as any).__idGeoElemento = el.idGeoElemento;
      (layer as any).__geomTipo = el.geomTipo;

      layer.on('click', () => this.elementoSelected.emit(el));
      layer.on('contextmenu', (ev: any) => {
        this.elementoContext.emit({
          elemento: el,
          x: ev.originalEvent?.clientX ?? 0,
          y: ev.originalEvent?.clientY ?? 0,
        });
      });

      this.drawnItems.addLayer(layer);
      this.renderedLayers.set(el.idGeoElemento, layer);
    }

    this.applySelectionStyle();

    if (this.selectedElementoId != null) {
      this.centerOnElemento(this.selectedElementoId);
    } else if (this.drawnItems.getLayers().length > 0) {
      const bounds = this.drawnItems.getBounds();
      if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.2));
    }
  }
  private applySelectionStyle() {
    for (const [id, layer] of this.renderedLayers.entries()) {
      const isSelected = id === this.selectedElementoId;

      if ('setStyle' in layer && typeof (layer as any).setStyle === 'function') {
        (layer as any).setStyle({
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.9,
          fillOpacity: isSelected ? 0.28 : 0.15,
        });
      }

      if ('setRadius' in layer && typeof (layer as any).setRadius === 'function') {
        (layer as any).setRadius(isSelected ? 8 : 6);
      }
    }
  }
  private layerFromElemento(el: MapaElemento, tipo: MapaTipoElemento | null): L.Layer | null {
    const geom = el.geometria;
    const stroke = tipo?.colorStroke || '#38bdf8';
    const fill = tipo?.colorFill || stroke;

    if (geom) {
      const geojsonLayer = this.tryGeoJsonLayer(geom, stroke, fill, tipo);
      if (geojsonLayer) return geojsonLayer;

      const embeddedWkt = this.tryExtractWkt(geom);
      if (embeddedWkt) return this.layerFromWkt(embeddedWkt, stroke, fill, tipo);
    }

    if ((el as any).wkt) {
      return this.layerFromWkt((el as any).wkt, stroke, fill, tipo);
    }

    return null;
  }

  private tryGeoJsonLayer(
    geom: any,
    stroke: string,
    fill: string,
    tipo: MapaTipoElemento | null
  ): L.Layer | null {
    if (geom && typeof geom === 'object' && geom.type && geom.coordinates) {
      return L.geoJSON(geom as any, {
        pointToLayer: (_f, latlng) => this.createPointLayer(latlng, stroke, fill, tipo),
        style: {
          color: stroke,
          weight: 3,
          fillColor: fill,
          fillOpacity: 0.15,
        },
      });
    }
    return null;
  }

  private tryExtractWkt(geom: any): string | null {
    if (typeof geom === 'string') return geom;
    if (geom && typeof geom === 'object' && typeof geom.wkt === 'string') return geom.wkt;
    return null;
  }

  private layerFromWkt(
    wkt: string,
    stroke: string,
    fill: string,
    tipo: MapaTipoElemento | null
  ): L.Layer | null {
    const raw = wkt.trim();

    if (raw.startsWith('POINT')) {
      const match = raw.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
      if (!match) return null;
      const lng = Number(match[1]);
      const lat = Number(match[2]);
      return this.createPointLayer(L.latLng(lat, lng), stroke, fill, tipo);
    }

    if (raw.startsWith('LINESTRING')) {
      const match = raw.match(/LINESTRING\s*\((.+)\)/i);
      if (!match) return null;
      const coords = match[1].split(',').map((pair) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return [lat, lng] as [number, number];
      });
      return L.polyline(coords, { color: stroke, weight: 3 });
    }

    if (raw.startsWith('POLYGON')) {
      const match = raw.match(/POLYGON\s*\(\((.+)\)\)/i);
      if (!match) return null;
      const coords = match[1].split(',').map((pair) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return [lat, lng] as [number, number];
      });
      return L.polygon(coords, {
        color: stroke,
        weight: 3,
        fillColor: fill,
        fillOpacity: 0.15,
      });
    }

    return null;
  }

  private geomTipoFromLayerType(layerType: string): MapaGeomTipo {
    if (layerType === 'marker') return 'point';
    if (layerType === 'polyline') return 'linestring';
    return 'polygon';
  }

  private layerToWkt(layer: L.Layer, geomTipo: MapaGeomTipo): string | null {
    if (geomTipo === 'point' && 'getLatLng' in layer) {
      const ll = (layer as any).getLatLng();
      return `POINT(${ll.lng} ${ll.lat})`;
    }

    if (geomTipo === 'linestring' && 'getLatLngs' in layer) {
      const latlngs = (layer as any).getLatLngs() as L.LatLng[];
      const coords = latlngs.map((p) => `${p.lng} ${p.lat}`).join(', ');
      return `LINESTRING(${coords})`;
    }

    if (geomTipo === 'polygon' && 'getLatLngs' in layer) {
      const groups = (layer as any).getLatLngs() as L.LatLng[][];
      const ring = Array.isArray(groups[0]) ? groups[0] : (groups as any);
      const coords = [...ring, ring[0]].map((p: L.LatLng) => `${p.lng} ${p.lat}`).join(', ');
      return `POLYGON((${coords}))`;
    }

    return null;
  }

  private createPointLayer(
    latlng: L.LatLng,
    stroke: string,
    fill: string,
    tipo: MapaTipoElemento | null
  ): L.Layer {
    const iconoFuente = (tipo?.iconoFuente || '').toLowerCase();

    if (iconoFuente.includes('triangle')) {
      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `<div style="
        width:0;
        height:0;
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-bottom:16px solid ${fill};
        filter: drop-shadow(0 0 1px ${stroke});
      "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 14],
      });
      return L.marker(latlng, { icon, draggable: true });
    }

    if (iconoFuente.includes('target')) {
      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `<div style="
        width:16px;
        height:16px;
        border:2px solid ${stroke};
        border-radius:999px;
        background:${fill};
        box-shadow: inset 0 0 0 3px white;
      "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      return L.marker(latlng, { icon, draggable: true });
    }

    if (iconoFuente.includes('donut')) {
      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `<div style="
        width:16px;
        height:16px;
        border:4px solid ${stroke};
        border-radius:999px;
        background:transparent;
      "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      return L.marker(latlng, { icon, draggable: true });
    }

    return L.circleMarker(latlng, {
      radius: 6,
      color: stroke,
      weight: 2,
      fillColor: fill,
      fillOpacity: 0.85,
    });
  }
}