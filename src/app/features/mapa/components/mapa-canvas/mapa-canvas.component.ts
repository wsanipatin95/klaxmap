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
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import type { MapaToolMode } from '../../store/mapa-ui.store';
import { parseWktGeometry } from '../../utils/mapa-geometry.utils';

export interface MapaEditSessionState {
  active: boolean;
  dirty: boolean;
  elementId: number | null;
  elementName: string | null;
  geomTipo: MapaGeomTipo | null;
}

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
  @Input() mapCenter: L.LatLngTuple = [-0.22985, -78.52495];
  @Input() mapZoom = 13;

  @Output() elementoSelected = new EventEmitter<MapaElemento | null>();
  @Output() elementoContext = new EventEmitter<{ elemento: MapaElemento; x: number; y: number }>();
  @Output() geometryCreated = new EventEmitter<{ wkt: string; geomTipo: MapaGeomTipo }>();
  @Output() editSessionStateChanged = new EventEmitter<MapaEditSessionState>();

  private readonly DEFAULT_STROKE = '#38bdf8';
  private readonly DEFAULT_FILL = '#38bdf8';
  private readonly EDIT_STROKE = '#2563eb';
  private readonly EDIT_FILL = '#60a5fa';

  private map!: L.Map;
  private drawnItems = new L.FeatureGroup();
  private renderedLayers = new Map<number, L.Layer>();
  private activeDrawHandler: any = null;

  private editSession: {
    active: boolean;
    dirty: boolean;
    elementId: number | null;
    elementName: string | null;
    geomTipo: MapaGeomTipo | null;
    originalWkt: string | null;
    currentWkt: string | null;
    layer: L.Layer | null;
    originalSnapshot: L.Layer | null;
  } = {
    active: false,
    dirty: false,
    elementId: null,
    elementName: null,
    geomTipo: null,
    originalWkt: null,
    currentWkt: null,
    layer: null,
    originalSnapshot: null,
  };

  ngAfterViewInit(): void {
    this.initMap();
    this.renderElementos();
    this.syncToolMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    const dataChanged =
      changes['elementos'] ||
      changes['selectedElementoId'] ||
      changes['tipos'] ||
      changes['hiddenTipoIds'];

    if (dataChanged) {
      if (!this.editSession.active) {
        this.renderElementos();
      } else {
        this.renderElementosKeepingDraft();
      }
    }

    if (changes['toolMode'] || changes['selectedElementoId']) {
      this.syncToolMode();
    }

    if ((changes['mapCenter'] || changes['mapZoom']) && this.map) {
      this.map.setView(this.mapCenter, this.mapZoom);
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

  hasPendingEditChanges(): boolean {
    return this.editSession.active && this.editSession.dirty;
  }

  isEditingElement(elementId: number | null): boolean {
    return this.editSession.active && this.editSession.elementId === elementId;
  }

  saveEditSession(): { idGeoElemento: number; geomTipo: MapaGeomTipo; wkt: string } | null {
    if (!this.editSession.active || !this.editSession.dirty) {
      return null;
    }

    const payload = {
      idGeoElemento: this.editSession.elementId as number,
      geomTipo: this.editSession.geomTipo as MapaGeomTipo,
      wkt: this.editSession.currentWkt as string,
    };

    this.disableLayerEditing(this.editSession.layer);
    this.clearEditSession();
    this.emitEditSessionState();

    return payload;
  }

  cancelEditSession() {
    if (!this.editSession.active) return;

    if (this.editSession.layer && this.editSession.originalSnapshot) {
      this.replaceLayerGeometry(this.editSession.layer, this.editSession.originalSnapshot);
    }

    this.disableLayerEditing(this.editSession.layer);
    this.clearEditSession();
    this.emitEditSessionState();
    this.renderElementos();
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.mapCenter,
      zoom: this.mapZoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 22,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.drawnItems.addTo(this.map);

    this.map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Layer;
      const geomTipo = this.geomTipoFromLayerType(e.layerType);
      const wkt = this.layerToWkt(layer, geomTipo);

      this.stopActiveDraw();

      if (!wkt) return;

      this.geometryCreated.emit({ wkt, geomTipo });
    });
  }

  private syncToolMode() {
    if (!this.map) return;

    const container = this.map.getContainer();
    this.map.dragging.enable();
    container.style.cursor = '';

    if (this.toolMode !== 'edit-geometry' && this.editSession.active) {
      this.disableLayerEditing(this.editSession.layer);
      this.clearEditSession();
      this.emitEditSessionState();
      this.renderElementos();
    }

    if (!this.editSession.active) {
      this.stopActiveDraw();
    }

    if (this.toolMode === 'select' || this.toolMode === 'move') {
      container.style.cursor = this.toolMode === 'move' ? 'grab' : '';
      return;
    }

    if (this.toolMode === 'draw-point') {
      this.map.dragging.disable();
      container.style.cursor = 'crosshair';
      this.startDrawHandler('point');
      return;
    }

    if (this.toolMode === 'draw-line') {
      this.map.dragging.disable();
      container.style.cursor = 'crosshair';
      this.startDrawHandler('line');
      return;
    }

    if (this.toolMode === 'draw-polygon') {
      this.map.dragging.disable();
      container.style.cursor = 'crosshair';
      this.startDrawHandler('polygon');
      return;
    }

    if (this.toolMode === 'edit-geometry') {
      this.stopActiveDraw();
      container.style.cursor = 'crosshair';
      this.ensureEditSessionForSelection();
    }
  }

  private ensureEditSessionForSelection() {
    if (this.selectedElementoId == null) {
      this.disableLayerEditing(this.editSession.layer);
      this.clearEditSession();
      this.emitEditSessionState();
      return;
    }

    if (this.editSession.active && this.editSession.elementId === this.selectedElementoId) {
      if (this.editSession.layer) {
        this.enableLayerEditing(this.editSession.layer);
      }
      this.emitEditSessionState();
      return;
    }

    const selectedElement =
      this.elementos.find((e) => e.idGeoElemento === this.selectedElementoId) ?? null;
    const layer = this.renderedLayers.get(this.selectedElementoId) ?? null;

    if (!selectedElement || !layer) {
      this.disableLayerEditing(this.editSession.layer);
      this.clearEditSession();
      this.emitEditSessionState();
      return;
    }

    this.disableLayerEditing(this.editSession.layer);

    const geomTipo =
      (selectedElement.geomTipo as MapaGeomTipo) || this.inferGeomTipoFromLayer(layer);
    const originalWkt = this.layerToWkt(layer, geomTipo);

    this.editSession = {
      active: true,
      dirty: false,
      elementId: selectedElement.idGeoElemento,
      elementName: selectedElement.nombre ?? null,
      geomTipo,
      originalWkt,
      currentWkt: originalWkt,
      layer,
      originalSnapshot: this.cloneLayer(layer),
    };

    this.enableLayerEditing(layer);
    this.emitEditSessionState();
  }

  private startDrawHandler(type: 'point' | 'line' | 'polygon') {
    if (!this.map) return;

    const DrawRef: any = (L as any).Draw;
    if (!DrawRef) return;

    this.stopActiveDraw();

    if (type === 'point') {
      this.activeDrawHandler = new DrawRef.Marker(this.map, {
        repeatMode: false,
      });
    }

    if (type === 'line') {
      this.activeDrawHandler = new DrawRef.Polyline(this.map, {
        repeatMode: false,
        shapeOptions: {
          color: this.EDIT_STROKE,
          weight: 4,
        },
      });
    }

    if (type === 'polygon') {
      this.activeDrawHandler = new DrawRef.Polygon(this.map, {
        repeatMode: false,
        shapeOptions: {
          color: this.EDIT_STROKE,
          weight: 3,
          fillColor: this.EDIT_FILL,
          fillOpacity: 0.2,
        },
      });
    }

    this.activeDrawHandler?.enable?.();
  }

  private stopActiveDraw() {
    this.activeDrawHandler?.disable?.();
    this.activeDrawHandler = null;
  }

  private enableLayerEditing(layer: L.Layer | null) {
    if (!layer) return;

    const anyLayer = layer as any;

    layer.off('dragend', this.onLayerEdited);
    layer.off('edit', this.onLayerEdited);

    if (typeof anyLayer.dragging?.enable === 'function') {
      anyLayer.dragging.enable();
      layer.on('dragend', this.onLayerEdited);
    }

    if (typeof anyLayer.editing?.enable === 'function') {
      anyLayer.editing.enable();
      layer.on('edit', this.onLayerEdited);
    }
  }

  private disableLayerEditing(layer: L.Layer | null) {
    if (!layer) return;

    const anyLayer = layer as any;

    layer.off('dragend', this.onLayerEdited);
    layer.off('edit', this.onLayerEdited);

    if (typeof anyLayer.dragging?.disable === 'function') {
      anyLayer.dragging.disable();
    }

    if (typeof anyLayer.editing?.disable === 'function') {
      anyLayer.editing.disable();
    }
  }

  private onLayerEdited = () => {
    if (!this.editSession.active || !this.editSession.layer || !this.editSession.geomTipo) {
      return;
    }

    const wkt = this.layerToWkt(this.editSession.layer, this.editSession.geomTipo);
    if (!wkt) return;

    this.editSession.currentWkt = wkt;
    this.editSession.dirty = wkt !== this.editSession.originalWkt;
    this.emitEditSessionState();
  };

  private emitEditSessionState() {
    this.editSessionStateChanged.emit({
      active: this.editSession.active,
      dirty: this.editSession.dirty,
      elementId: this.editSession.elementId,
      elementName: this.editSession.elementName,
      geomTipo: this.editSession.geomTipo,
    });
  }

  private clearEditSession() {
    this.editSession = {
      active: false,
      dirty: false,
      elementId: null,
      elementName: null,
      geomTipo: null,
      originalWkt: null,
      currentWkt: null,
      layer: null,
      originalSnapshot: null,
    };
  }

  private renderElementosKeepingDraft() {
    const activeId = this.editSession.elementId;
    const dirty = this.editSession.dirty;
    const currentWkt = this.editSession.currentWkt;

    this.renderElementos();

    if (!activeId) return;

    const layer = this.renderedLayers.get(activeId);
    if (!layer) return;

    if (dirty && currentWkt) {
      const draftLayer = this.layerFromWkt(currentWkt, this.EDIT_STROKE, this.EDIT_FILL, null);
      if (draftLayer) {
        this.replaceLayerGeometry(layer, draftLayer);
      }
    }

    this.editSession.layer = layer;
    this.enableLayerEditing(layer);
    this.emitEditSessionState();
  }

  private renderElementos() {
    this.drawnItems.clearLayers();
    this.renderedLayers.clear();

    const hiddenSet = new Set(this.hiddenTipoIds);

    for (const el of this.elementos) {
      if (hiddenSet.has(el.idGeoTipoElementoFk)) continue;

      const tipo =
        this.tipos.find((t) => t.idGeoTipoElemento === el.idGeoTipoElementoFk) ?? null;
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

    if (!this.editSession.active) {
      if (this.selectedElementoId != null) {
        this.centerOnElemento(this.selectedElementoId);
      } else if (this.drawnItems.getLayers().length > 0) {
        const bounds = this.drawnItems.getBounds();
        if (bounds.isValid()) {
          this.map.fitBounds(bounds.pad(0.2));
        }
      }
    }
  }

  private applySelectionStyle() {
    for (const [id, layer] of this.renderedLayers.entries()) {
      const isSelected = id === this.selectedElementoId;
      const anyLayer = layer as any;

      if (typeof anyLayer.setStyle === 'function') {
        anyLayer.setStyle({
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.9,
          fillOpacity: isSelected ? 0.28 : 0.15,
        });
      }

      if (typeof anyLayer.setRadius === 'function') {
        anyLayer.setRadius(isSelected ? 8 : 6);
      }

      if (typeof anyLayer.setZIndexOffset === 'function') {
        anyLayer.setZIndexOffset(isSelected ? 1000 : 0);
      }
    }
  }

  private layerFromElemento(el: MapaElemento, tipo: MapaTipoElemento | null): L.Layer | null {
    const geom = el.geometria;
    const stroke = tipo?.colorStroke || this.DEFAULT_STROKE;
    const fill = tipo?.colorFill || stroke;

    if (geom && typeof geom === 'object' && geom.type && geom.coordinates) {
      const fromGeoJson = this.layerFromGeoJsonGeometry(geom, stroke, fill, tipo);
      if (fromGeoJson) return fromGeoJson;
    }

    if (geom) {
      const embeddedWkt = this.tryExtractWkt(geom);
      if (embeddedWkt) {
        return this.layerFromWkt(embeddedWkt, stroke, fill, tipo);
      }
    }

    if ((el as any).wkt) {
      return this.layerFromWkt((el as any).wkt, stroke, fill, tipo);
    }

    return null;
  }

  private layerFromGeoJsonGeometry(
    geom: any,
    stroke: string,
    fill: string,
    tipo: MapaTipoElemento | null
  ): L.Layer | null {
    const type = String(geom.type || '').toLowerCase();
    const coords = geom.coordinates;

    if (type === 'point' && Array.isArray(coords) && coords.length >= 2) {
      return this.createPointLayer(
        L.latLng(Number(coords[1]), Number(coords[0])),
        stroke,
        fill,
        tipo
      );
    }

    if (type === 'linestring' && Array.isArray(coords)) {
      return L.polyline(
        coords.map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number]),
        { color: stroke, weight: 3 }
      );
    }

    if (type === 'polygon' && Array.isArray(coords) && Array.isArray(coords[0])) {
      return L.polygon(
        coords.map((ring: number[][]) =>
          ring.map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number])
        ),
        {
          color: stroke,
          weight: 3,
          fillColor: fill,
          fillOpacity: 0.15,
        }
      );
    }

    if (type === 'multilinestring' && Array.isArray(coords) && Array.isArray(coords[0])) {
      return L.polyline(
        coords[0].map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number]),
        { color: stroke, weight: 3 }
      );
    }

    if (
      type === 'multipolygon' &&
      Array.isArray(coords) &&
      Array.isArray(coords[0]) &&
      Array.isArray(coords[0][0])
    ) {
      return L.polygon(
        coords[0].map((ring: number[][]) =>
          ring.map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number])
        ),
        {
          color: stroke,
          weight: 3,
          fillColor: fill,
          fillOpacity: 0.15,
        }
      );
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
    const parsed = parseWktGeometry(wkt);
    if (!parsed) return null;

    if (parsed.renderType === 'point' && parsed.point) {
      return this.createPointLayer(
        L.latLng(parsed.point[0], parsed.point[1]),
        stroke,
        fill,
        tipo
      );
    }

    if (parsed.renderType === 'polyline' && parsed.line) {
      return L.polyline(parsed.line, { color: stroke, weight: 3 });
    }

    if (parsed.renderType === 'polygon' && parsed.polygon) {
      return L.polygon(parsed.polygon, {
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

  private inferGeomTipoFromLayer(layer: L.Layer): MapaGeomTipo {
    const anyLayer = layer as any;

    if (typeof anyLayer.getLatLng === 'function') {
      return 'point';
    }

    if (typeof anyLayer.getLatLngs === 'function') {
      const latlngs = anyLayer.getLatLngs();
      if (Array.isArray(latlngs) && Array.isArray(latlngs[0])) {
        return 'polygon';
      }
      return 'linestring';
    }

    return 'point';
  }

  private layerToWkt(layer: L.Layer, geomTipo: MapaGeomTipo): string | null {
    const anyLayer = layer as any;

    if (geomTipo === 'point' && typeof anyLayer.getLatLng === 'function') {
      const ll = anyLayer.getLatLng();
      return `POINT(${ll.lng} ${ll.lat})`;
    }

    if (geomTipo === 'linestring' && typeof anyLayer.getLatLngs === 'function') {
      const latlngs = anyLayer.getLatLngs() as L.LatLng[];
      const coords = latlngs.map((p) => `${p.lng} ${p.lat}`).join(', ');
      return `LINESTRING(${coords})`;
    }

    if (geomTipo === 'polygon' && typeof anyLayer.getLatLngs === 'function') {
      const groups = anyLayer.getLatLngs() as L.LatLng[][] | L.LatLng[][][];
      const rings = Array.isArray(groups[0]) && Array.isArray((groups as any)[0][0])
        ? (groups as L.LatLng[][])
        : [groups as unknown as L.LatLng[]];

      const ringText = rings
        .map((ring) => {
          const closed =
            ring.length > 0 &&
            ring[0].lat === ring[ring.length - 1].lat &&
            ring[0].lng === ring[ring.length - 1].lng
              ? ring
              : [...ring, ring[0]];

          return `(${closed.map((p) => `${p.lng} ${p.lat}`).join(', ')})`;
        })
        .join(', ');

      return `POLYGON(${ringText})`;
    }

    return null;
  }

  private cloneLayer(layer: L.Layer): L.Layer | null {
    const geomTipo = this.inferGeomTipoFromLayer(layer);
    const wkt = this.layerToWkt(layer, geomTipo);
    if (!wkt) return null;
    return this.layerFromWkt(wkt, this.EDIT_STROKE, this.EDIT_FILL, null);
  }

  private replaceLayerGeometry(target: L.Layer, source: L.Layer) {
    const targetAny = target as any;
    const sourceAny = source as any;

    if (typeof targetAny.setLatLng === 'function' && typeof sourceAny.getLatLng === 'function') {
      targetAny.setLatLng(sourceAny.getLatLng());
      targetAny.update?.();
      return;
    }

    if (typeof targetAny.setLatLngs === 'function' && typeof sourceAny.getLatLngs === 'function') {
      targetAny.setLatLngs(sourceAny.getLatLngs());
      targetAny.redraw?.();
    }
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

      return L.marker(latlng, { icon, draggable: false });
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

      return L.marker(latlng, { icon, draggable: false });
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

      return L.marker(latlng, { icon, draggable: false });
    }

    const icon = L.divIcon({
      className: 'mapa-div-icon',
      html: `<div style="
        width:14px;
        height:14px;
        border-radius:999px;
        background:${fill};
        border:2px solid ${stroke};
        box-shadow: 0 0 0 1px rgba(255,255,255,0.8);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    return L.marker(latlng, { icon, draggable: false });
  }
}