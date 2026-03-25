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

type BasemapKey =
  | 'osm'
  | 'cartoLight'
  | 'cartoDark'
  | 'esriWorldImagery'
  | 'openTopo';

interface BasemapOption {
  key: BasemapKey;
  label: string;
  url: string;
  options: L.TileLayerOptions;
}

interface ResolvedElementStyle {
  iconoFuente: string | null;
  icono: string | null;
  iconoClase: string | null;
  colorFill: string;
  colorStroke: string;
  colorTexto: string | null;
  strokeWidth: number;
  zIndex: number;
  tamanoIcono: number;
}

interface CachedElementBounds {
  signature: string;
  bounds: L.LatLngBounds | null;
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

  readonly basemapOptions: BasemapOption[] = [
    {
      key: 'osm',
      label: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 22,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    {
      key: 'cartoLight',
      label: 'Claro',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      options: {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    },
    {
      key: 'cartoDark',
      label: 'Oscuro',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      options: {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    },
    {
      key: 'esriWorldImagery',
      label: 'Satélite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 22,
        attribution: 'Tiles &copy; Esri',
      },
    },
    {
      key: 'openTopo',
      label: 'Relieve',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution:
          'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
      },
    },
  ];

  selectedBasemap: BasemapKey = 'osm';
  basemapMenuOpen = false;

  private readonly DEFAULT_STROKE = '#38bdf8';
  private readonly DEFAULT_FILL = '#38bdf8';
  private readonly EDIT_STROKE = '#2563eb';
  private readonly EDIT_FILL = '#60a5fa';

  private readonly PERFORMANCE_THRESHOLD = 5000;
  private readonly SIMPLIFY_POINTS_BELOW_ZOOM = 14;
  private readonly VIEWPORT_PAD_FACTOR = 0.85;
  private readonly PERFORMANCE_POINT_RADIUS = 5;

  private map!: L.Map;
  private baseLayer!: L.TileLayer;
  private readonly drawnItems = new L.FeatureGroup();
  private readonly renderedLayers = new Map<number, L.Layer>();
  private readonly elementBoundsCache = new Map<number, CachedElementBounds>();
  private readonly vectorRenderer = L.canvas({ padding: 0.8 });

  private activeDrawHandler: any = null;
  private renderFrameId: number | null = null;
  private currentViewBounds: L.LatLngBounds | null = null;
  private hasInitialAutoFit = false;
  private drawPluginAvailable = false;

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

  private get performanceModeEnabled(): boolean {
    return this.elementos.length >= this.PERFORMANCE_THRESHOLD;
  }

  private get currentZoom(): number {
    return this.map ? this.map.getZoom() : this.mapZoom;
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.updateViewBounds();
    this.scheduleRender();
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
        this.scheduleRender();
      } else {
        this.scheduleRenderKeepingDraft();
      }
    }

    if (changes['toolMode'] || changes['selectedElementoId']) {
      this.syncToolMode();
    }

    if ((changes['mapCenter'] || changes['mapZoom']) && this.map) {
      this.map.setView(this.mapCenter, this.mapZoom);
      this.updateViewBounds();
      this.scheduleRender();
    }
  }

  toggleBasemapMenu() {
    this.basemapMenuOpen = !this.basemapMenuOpen;
  }

  closeBasemapMenu() {
    this.basemapMenuOpen = false;
  }

  setBasemap(key: BasemapKey) {
    if (!this.map || this.selectedBasemap === key) {
      this.basemapMenuOpen = false;
      return;
    }

    const config = this.basemapOptions.find((item) => item.key === key);
    if (!config) {
      this.basemapMenuOpen = false;
      return;
    }

    if (this.baseLayer) {
      this.map.removeLayer(this.baseLayer);
    }

    this.baseLayer = L.tileLayer(config.url, config.options);
    this.baseLayer.addTo(this.map);
    this.selectedBasemap = key;
    this.basemapMenuOpen = false;
  }

  currentBasemapLabel(): string {
    return (
      this.basemapOptions.find((item) => item.key === this.selectedBasemap)?.label ??
      'Mapa'
    );
  }

  centerOnElemento(id: number | null) {
    if (id == null) return;

    const selected = this.renderedLayers.get(id);
    if (!selected) {
      this.scheduleRender();
      return;
    }

    if ('getBounds' in selected && typeof (selected as any).getBounds === 'function') {
      const bounds = (selected as any).getBounds();
      if (bounds?.isValid?.()) {
        this.map.fitBounds(bounds.pad(0.3));
        this.updateViewBounds();
        this.openTooltipForLayer(selected);
        return;
      }
    }

    if ('getLatLng' in selected && typeof (selected as any).getLatLng === 'function') {
      this.map.panTo((selected as any).getLatLng());
      this.updateViewBounds();
      this.openTooltipForLayer(selected);
    }
  }

  centerOnElementos(elementos: MapaElemento[]) {
    if (!this.map || !Array.isArray(elementos) || elementos.length === 0) {
      return;
    }

    const bounds = L.latLngBounds([]);

    for (const item of elementos) {
      const layer = this.renderedLayers.get(item.idGeoElemento);

      if (layer) {
        if ('getBounds' in layer && typeof (layer as any).getBounds === 'function') {
          const layerBounds = (layer as any).getBounds();
          if (layerBounds?.isValid?.()) {
            bounds.extend(layerBounds);
            continue;
          }
        }

        if ('getLatLng' in layer && typeof (layer as any).getLatLng === 'function') {
          bounds.extend((layer as any).getLatLng());
          continue;
        }
      }

      const cachedBounds = this.getElementBounds(item);
      if (cachedBounds?.isValid?.()) {
        bounds.extend(cachedBounds);
      }
    }

    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.2));
      this.updateViewBounds();
      this.scheduleRender();
    }
  }

  hasPendingEditChanges(): boolean {
    return this.editSession.active && this.editSession.dirty;
  }

  isEditingElement(elementId: number | null): boolean {
    return this.editSession.active && this.editSession.elementId === elementId;
  }

  saveEditSession(): { idGeoElemento: number; geomTipo: MapaGeomTipo; wkt: string } | null {
    if (!this.editSession.active) {
      return null;
    }

    this.syncEditSessionFromLayer();

    if (
      !this.editSession.dirty ||
      this.editSession.elementId == null ||
      !this.editSession.geomTipo ||
      !this.editSession.currentWkt
    ) {
      return null;
    }

    const payload = {
      idGeoElemento: this.editSession.elementId,
      geomTipo: this.editSession.geomTipo,
      wkt: this.editSession.currentWkt,
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
    this.scheduleRender();
  }

  private getDrawRef(): any | null {
    const drawRef = (L as any)?.Draw ?? null;
    return drawRef;
  }

  private detectDrawPlugin(): boolean {
    const drawRef = this.getDrawRef();
    return !!(
      drawRef &&
      drawRef.Event &&
      typeof drawRef.Marker === 'function' &&
      typeof drawRef.Polyline === 'function' &&
      typeof drawRef.Polygon === 'function'
    );
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.mapCenter,
      zoom: this.mapZoom,
      zoomControl: true,
      preferCanvas: true,
    });

    const defaultBasemap = this.basemapOptions.find((item) => item.key === this.selectedBasemap)!;
    this.baseLayer = L.tileLayer(defaultBasemap.url, defaultBasemap.options);
    this.baseLayer.addTo(this.map);

    this.drawnItems.addTo(this.map);

    this.map.on('click', () => {
      if (this.basemapMenuOpen) {
        this.closeBasemapMenu();
      }
    });

    this.map.on('moveend zoomend resize', () => {
      this.updateViewBounds();

      if (!this.editSession.active) {
        this.scheduleRender();
      }
    });

    this.drawPluginAvailable = this.detectDrawPlugin();

    console.log('Leaflet version:', (L as any)?.version);
    console.log('Leaflet Draw disponible:', this.drawPluginAvailable);
    console.log('L.Draw:', (L as any)?.Draw);
    console.log('L.Draw.Event:', (L as any)?.Draw?.Event);

    const drawRef = this.getDrawRef();

    if (drawRef?.Event?.CREATED) {
      this.map.on(drawRef.Event.CREATED, (e: any) => {
        const layer = e.layer as L.Layer;
        const geomTipo = this.geomTipoFromLayerType(e.layerType);
        const wkt = this.layerToWkt(layer, geomTipo);

        this.stopActiveDraw();

        if (!wkt) return;

        this.geometryCreated.emit({ wkt, geomTipo });
      });
    } else {
      console.error(
        'Leaflet Draw no está cargado. Verifica angular.json -> scripts/styles y el orden de carga.'
      );
    }
  }

  private updateViewBounds() {
    if (!this.map) {
      this.currentViewBounds = null;
      return;
    }

    this.currentViewBounds = this.map.getBounds();
  }

  private scheduleRender() {
    if (!this.map) return;
    if (this.renderFrameId != null) return;

    this.renderFrameId = window.requestAnimationFrame(() => {
      this.renderFrameId = null;
      this.renderElementos();
    });
  }

  private scheduleRenderKeepingDraft() {
    if (!this.map) return;
    if (this.renderFrameId != null) return;

    this.renderFrameId = window.requestAnimationFrame(() => {
      this.renderFrameId = null;
      this.renderElementosKeepingDraft();
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
      this.scheduleRender();
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

    const DrawRef: any = this.getDrawRef();

    if (!DrawRef) {
      console.error('No se puede iniciar dibujo porque L.Draw no está disponible.');
      return;
    }

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
    if (!layer || !this.map) return;

    const anyLayer = layer as any;

    layer.off('drag', this.onLayerEdited);
    layer.off('dragend', this.onLayerEdited);
    layer.off('edit', this.onLayerEdited);

    this.map.off('mouseup', this.onMapInteractionFinished);
    this.map.off('touchend', this.onMapInteractionFinished);

    if (typeof anyLayer.dragging?.enable === 'function') {
      anyLayer.dragging.enable();
      layer.on('drag', this.onLayerEdited);
      layer.on('dragend', this.onLayerEdited);
    }

    if (typeof anyLayer.editing?.enable === 'function') {
      anyLayer.editing.enable();
      layer.on('edit', this.onLayerEdited);
    }

    this.map.on('mouseup', this.onMapInteractionFinished);
    this.map.on('touchend', this.onMapInteractionFinished);

    this.syncEditSessionFromLayer(true);
  }

  private disableLayerEditing(layer: L.Layer | null) {
    if (!layer) return;

    const anyLayer = layer as any;

    layer.off('drag', this.onLayerEdited);
    layer.off('dragend', this.onLayerEdited);
    layer.off('edit', this.onLayerEdited);

    if (this.map) {
      this.map.off('mouseup', this.onMapInteractionFinished);
      this.map.off('touchend', this.onMapInteractionFinished);
    }

    if (typeof anyLayer.dragging?.disable === 'function') {
      anyLayer.dragging.disable();
    }

    if (typeof anyLayer.editing?.disable === 'function') {
      anyLayer.editing.disable();
    }
  }

  private onLayerEdited = () => {
    queueMicrotask(() => {
      this.syncEditSessionFromLayer();
    });
  };

  private onMapInteractionFinished = () => {
    queueMicrotask(() => {
      this.syncEditSessionFromLayer();
    });
  };

  private syncEditSessionFromLayer(forceEmit = false) {
    if (!this.editSession.active || !this.editSession.layer || !this.editSession.geomTipo) {
      return;
    }

    const wkt = this.layerToWkt(this.editSession.layer, this.editSession.geomTipo);
    if (!wkt) {
      return;
    }

    const nextDirty = wkt !== this.editSession.originalWkt;
    const changed =
      this.editSession.currentWkt !== wkt ||
      this.editSession.dirty !== nextDirty;

    this.editSession.currentWkt = wkt;
    this.editSession.dirty = nextDirty;

    if (changed || forceEmit) {
      this.emitEditSessionState();
    }
  }

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
      const draftStyle: ResolvedElementStyle = {
        iconoFuente: null,
        icono: null,
        iconoClase: null,
        colorFill: this.EDIT_FILL,
        colorStroke: this.EDIT_STROKE,
        colorTexto: this.EDIT_STROKE,
        strokeWidth: 3,
        zIndex: 999,
        tamanoIcono: 18,
      };

      const draftLayer = this.layerFromWkt(currentWkt, draftStyle, false);
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
    const tipoMap = new Map(this.tipos.map((t) => [t.idGeoTipoElemento, t]));

    const candidates = this.elementos.filter((el) => {
      if (hiddenSet.has(el.idGeoTipoElementoFk)) {
        return false;
      }

      return this.shouldRenderElement(el);
    });

    const renderQueue = candidates.sort((a, b) => {
      const tipoA = tipoMap.get(a.idGeoTipoElementoFk) ?? null;
      const tipoB = tipoMap.get(b.idGeoTipoElementoFk) ?? null;

      const styleA = this.resolveElementStyle(a, tipoA);
      const styleB = this.resolveElementStyle(b, tipoB);

      return (
        styleA.zIndex - styleB.zIndex ||
        Number(a.ordenDibujo ?? 0) - Number(b.ordenDibujo ?? 0) ||
        a.idGeoElemento - b.idGeoElemento
      );
    });

    for (const el of renderQueue) {
      const tipo = tipoMap.get(el.idGeoTipoElementoFk) ?? null;
      const layer = this.layerFromElemento(el, tipo);
      if (!layer) continue;

      (layer as any).__idGeoElemento = el.idGeoElemento;
      (layer as any).__geomTipo = el.geomTipo;
      (layer as any).__elementName = el.nombre ?? '';
      (layer as any).__tooltipBound = true;

      this.bindTooltipForLayer(layer, el.nombre ?? '');

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

    if (
      !this.editSession.active &&
      !this.performanceModeEnabled &&
      !this.hasInitialAutoFit &&
      this.selectedElementoId == null &&
      this.drawnItems.getLayers().length > 0
    ) {
      const bounds = this.drawnItems.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds.pad(0.2));
        this.updateViewBounds();
      }
      this.hasInitialAutoFit = true;
    }
  }

  private bindTooltipForLayer(layer: L.Layer, name: string) {
    const safeName = (name || '').trim();
    if (!safeName) return;

    const anyLayer = layer as any;
    if (typeof anyLayer.bindTooltip !== 'function') {
      return;
    }

    anyLayer.bindTooltip(safeName, {
      direction: 'top',
      sticky: true,
      opacity: 0.96,
      className: 'mapa-element-tooltip',
    });
  }

  private openTooltipForLayer(layer: L.Layer | null) {
    if (!layer) return;
    const anyLayer = layer as any;
    if (typeof anyLayer.openTooltip === 'function') {
      anyLayer.openTooltip();
    }
  }

  private shouldRenderElement(el: MapaElemento): boolean {
    if (!this.performanceModeEnabled) {
      return true;
    }

    if (this.selectedElementoId === el.idGeoElemento) {
      return true;
    }

    if (this.editSession.active && this.editSession.elementId === el.idGeoElemento) {
      return true;
    }

    const geomTipo = String(el.geomTipo ?? '').toLowerCase();

    if (geomTipo !== 'point') {
      return true;
    }

    const viewBounds = this.currentViewBounds;
    if (!viewBounds) {
      return true;
    }

    const elementBounds = this.getElementBounds(el);
    if (!elementBounds?.isValid?.()) {
      return true;
    }

    return viewBounds.pad(this.VIEWPORT_PAD_FACTOR).intersects(elementBounds);
  }

  private getElementBounds(el: MapaElemento): L.LatLngBounds | null {
    const signature = this.getElementSignature(el);
    const cached = this.elementBoundsCache.get(el.idGeoElemento);

    if (cached && cached.signature === signature) {
      return cached.bounds;
    }

    const bounds = this.computeElementBounds(el);
    this.elementBoundsCache.set(el.idGeoElemento, { signature, bounds });

    return bounds;
  }

  private getElementSignature(el: MapaElemento): string {
    const geom = el.geometria;
    const wkt = typeof (el as any).wkt === 'string' ? String((el as any).wkt) : '';
    const rawGeom =
      typeof geom === 'string'
        ? geom
        : geom != null
          ? JSON.stringify(geom)
          : '';

    return `${el.idGeoElemento}|${el.geomTipo ?? ''}|${wkt}|${rawGeom}`;
  }

  private computeElementBounds(el: MapaElemento): L.LatLngBounds | null {
    const geom = el.geometria;

    if (geom && typeof geom === 'object' && (geom as any).type && (geom as any).coordinates) {
      return this.boundsFromGeoJsonGeometry(geom as any);
    }

    if (geom) {
      const embeddedWkt = this.tryExtractWkt(geom);
      if (embeddedWkt) {
        return this.boundsFromWkt(embeddedWkt);
      }
    }

    if (typeof (el as any).wkt === 'string' && (el as any).wkt.trim()) {
      return this.boundsFromWkt((el as any).wkt);
    }

    return null;
  }

  private boundsFromGeoJsonGeometry(geom: any): L.LatLngBounds | null {
    const type = String(geom.type || '').toLowerCase();
    const coords = geom.coordinates;

    if (type === 'point' && Array.isArray(coords) && coords.length >= 2) {
      const ll = L.latLng(Number(coords[1]), Number(coords[0]));
      return L.latLngBounds([ll, ll]);
    }

    return this.boundsFromCoordinates(coords);
  }

  private boundsFromCoordinates(coords: any): L.LatLngBounds | null {
    const points: L.LatLng[] = [];
    this.collectCoordinatePoints(coords, points);

    if (!points.length) {
      return null;
    }

    return L.latLngBounds(points);
  }

  private collectCoordinatePoints(value: any, out: L.LatLng[]) {
    if (!Array.isArray(value)) {
      return;
    }

    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      out.push(L.latLng(Number(value[1]), Number(value[0])));
      return;
    }

    for (const item of value) {
      this.collectCoordinatePoints(item, out);
    }
  }

  private boundsFromWkt(wkt: string): L.LatLngBounds | null {
    const parsed = parseWktGeometry(wkt);
    if (!parsed) return null;

    if (parsed.renderType === 'point' && parsed.point) {
      const ll = L.latLng(parsed.point[0], parsed.point[1]);
      return L.latLngBounds([ll, ll]);
    }

    if (parsed.renderType === 'polyline' && parsed.line?.length) {
      return L.latLngBounds(parsed.line);
    }

    if (parsed.renderType === 'polygon' && parsed.polygon?.length) {
      return this.boundsFromLatLngCollections(parsed.polygon as any);
    }

    return null;
  }

  private boundsFromLatLngCollections(value: any): L.LatLngBounds | null {
    const points: L.LatLng[] = [];
    this.collectLatLngPoints(value, points);

    if (!points.length) {
      return null;
    }

    return L.latLngBounds(points);
  }

  private collectLatLngPoints(value: any, out: L.LatLng[]) {
    if (!Array.isArray(value)) {
      return;
    }

    if (value.length && this.isLatLng(value[0])) {
      for (const point of value as L.LatLng[]) {
        out.push(point);
      }
      return;
    }

    for (const item of value) {
      this.collectLatLngPoints(item, out);
    }
  }

  private applySelectionStyle() {
    for (const [id, layer] of this.renderedLayers.entries()) {
      const isSelected = id === this.selectedElementoId;
      const anyLayer = layer as any;

      const baseWeight =
        typeof anyLayer.__baseWeight === 'number' ? Number(anyLayer.__baseWeight) : 3;
      const baseFillOpacity =
        typeof anyLayer.__baseFillOpacity === 'number'
          ? Number(anyLayer.__baseFillOpacity)
          : 0.15;
      const baseZIndex =
        typeof anyLayer.__baseZIndex === 'number' ? Number(anyLayer.__baseZIndex) : 0;
      const baseRadius =
        typeof anyLayer.__baseRadius === 'number'
          ? Number(anyLayer.__baseRadius)
          : this.PERFORMANCE_POINT_RADIUS;

      if (typeof anyLayer.setStyle === 'function') {
        anyLayer.setStyle({
          weight: isSelected ? Math.max(baseWeight + 2, baseWeight * 1.45) : baseWeight,
          opacity: isSelected ? 1 : 0.92,
          fillOpacity: isSelected ? Math.max(baseFillOpacity, 0.36) : baseFillOpacity,
          dashArray: isSelected ? '8 6' : undefined,
        });
      }

      if (typeof anyLayer.setRadius === 'function') {
        anyLayer.setRadius(isSelected ? Math.max(baseRadius + 3, 9) : baseRadius);
      }

      if (typeof anyLayer.setZIndexOffset === 'function') {
        anyLayer.setZIndexOffset(baseZIndex + (isSelected ? 2000 : 0));
      }

      const element = this.tryGetMarkerElement(layer);
      if (element) {
        element.classList.toggle('is-selected', isSelected);
      }

      if (isSelected) {
        if (typeof anyLayer.bringToFront === 'function') {
          anyLayer.bringToFront();
        }
        this.openTooltipForLayer(layer);
      } else if (typeof anyLayer.closeTooltip === 'function') {
        anyLayer.closeTooltip();
      }
    }
  }

  private tryGetMarkerElement(layer: L.Layer): HTMLElement | null {
    const anyLayer = layer as any;
    if (typeof anyLayer.getElement === 'function') {
      return anyLayer.getElement() as HTMLElement | null;
    }
    return null;
  }

  private layerFromElemento(
    el: MapaElemento,
    tipo: MapaTipoElemento | null
  ): L.Layer | null {
    const geom = el.geometria;
    const style = this.resolveElementStyle(el, tipo);

    const simplifyPoint = this.shouldSimplifyPoint(el);

    if (geom && typeof geom === 'object' && (geom as any).type && (geom as any).coordinates) {
      const fromGeoJson = this.layerFromGeoJsonGeometry(geom, style, simplifyPoint);
      if (fromGeoJson) return fromGeoJson;
    }

    if (geom) {
      const embeddedWkt = this.tryExtractWkt(geom);
      if (embeddedWkt) {
        return this.layerFromWkt(embeddedWkt, style, simplifyPoint);
      }
    }

    if ((el as any).wkt) {
      return this.layerFromWkt((el as any).wkt, style, simplifyPoint);
    }

    return null;
  }

  private shouldSimplifyPoint(el: MapaElemento): boolean {
    if (!this.performanceModeEnabled) return false;
    if (this.currentZoom >= this.SIMPLIFY_POINTS_BELOW_ZOOM) return false;
    if (this.selectedElementoId === el.idGeoElemento) return false;
    if (this.editSession.active && this.editSession.elementId === el.idGeoElemento) return false;

    const geomTipo = String(el.geomTipo ?? '').toLowerCase();
    return geomTipo === 'point';
  }

  private layerFromGeoJsonGeometry(
    geom: any,
    style: ResolvedElementStyle,
    simplifyPoint = false
  ): L.Layer | null {
    const type = String(geom.type || '').toLowerCase();
    const coords = geom.coordinates;

    if (type === 'point' && Array.isArray(coords) && coords.length >= 2) {
      return this.createPointLayer(
        L.latLng(Number(coords[1]), Number(coords[0])),
        style,
        simplifyPoint
      );
    }

    if (type === 'linestring' && Array.isArray(coords)) {
      const layer = L.polyline(
        coords.map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number]),
        {
          color: style.colorStroke,
          weight: style.strokeWidth,
          renderer: this.vectorRenderer,
        }
      );

      (layer as any).__baseWeight = style.strokeWidth;
      (layer as any).__baseFillOpacity = 0;
      (layer as any).__baseZIndex = style.zIndex;

      return layer;
    }

    if (type === 'polygon' && Array.isArray(coords) && Array.isArray(coords[0])) {
      const layer = L.polygon(
        coords.map((ring: number[][]) =>
          ring.map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number])
        ),
        {
          color: style.colorStroke,
          weight: style.strokeWidth,
          fillColor: style.colorFill,
          fillOpacity: 0.15,
          renderer: this.vectorRenderer,
        }
      );

      (layer as any).__baseWeight = style.strokeWidth;
      (layer as any).__baseFillOpacity = 0.15;
      (layer as any).__baseZIndex = style.zIndex;

      return layer;
    }

    if (type === 'multilinestring' && Array.isArray(coords) && Array.isArray(coords[0])) {
      const layer = L.polyline(
        coords[0].map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number]),
        {
          color: style.colorStroke,
          weight: style.strokeWidth,
          renderer: this.vectorRenderer,
        }
      );

      (layer as any).__baseWeight = style.strokeWidth;
      (layer as any).__baseFillOpacity = 0;
      (layer as any).__baseZIndex = style.zIndex;

      return layer;
    }

    if (
      type === 'multipolygon' &&
      Array.isArray(coords) &&
      Array.isArray(coords[0]) &&
      Array.isArray(coords[0][0])
    ) {
      const layer = L.polygon(
        coords[0].map((ring: number[][]) =>
          ring.map((pair: number[]) => [Number(pair[1]), Number(pair[0])] as [number, number])
        ),
        {
          color: style.colorStroke,
          weight: style.strokeWidth,
          fillColor: style.colorFill,
          fillOpacity: 0.15,
          renderer: this.vectorRenderer,
        }
      );

      (layer as any).__baseWeight = style.strokeWidth;
      (layer as any).__baseFillOpacity = 0.15;
      (layer as any).__baseZIndex = style.zIndex;

      return layer;
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
    style: ResolvedElementStyle,
    simplifyPoint = false
  ): L.Layer | null {
    const parsed = parseWktGeometry(wkt);
    if (!parsed) return null;

    if (parsed.renderType === 'point' && parsed.point) {
      return this.createPointLayer(
        L.latLng(parsed.point[0], parsed.point[1]),
        style,
        simplifyPoint
      );
    }

    if (parsed.renderType === 'polyline' && parsed.line) {
      const layer = L.polyline(parsed.line, {
        color: style.colorStroke,
        weight: style.strokeWidth,
        renderer: this.vectorRenderer,
      });

      (layer as any).__baseWeight = style.strokeWidth;
      (layer as any).__baseFillOpacity = 0;
      (layer as any).__baseZIndex = style.zIndex;

      return layer;
    }

    if (parsed.renderType === 'polygon' && parsed.polygon) {
      const layer = L.polygon(parsed.polygon, {
        color: style.colorStroke,
        weight: style.strokeWidth,
        fillColor: style.colorFill,
        fillOpacity: 0.15,
        renderer: this.vectorRenderer,
      });

      (layer as any).__baseWeight = style.strokeWidth;
      (layer as any).__baseFillOpacity = 0.15;
      (layer as any).__baseZIndex = style.zIndex;

      return layer;
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

  private isLatLng(value: any): value is L.LatLng {
    return !!value && typeof value.lat === 'number' && typeof value.lng === 'number';
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
      const groups = anyLayer.getLatLngs() as any;

      let rings: L.LatLng[][] = [];

      if (Array.isArray(groups) && groups.length > 0 && this.isLatLng(groups[0])) {
        rings = [groups as L.LatLng[]];
      } else if (
        Array.isArray(groups) &&
        Array.isArray(groups[0]) &&
        (groups[0].length === 0 || this.isLatLng(groups[0][0]))
      ) {
        rings = groups as L.LatLng[][];
      } else if (
        Array.isArray(groups) &&
        Array.isArray(groups[0]) &&
        Array.isArray(groups[0][0])
      ) {
        rings = groups[0] as L.LatLng[][];
      }

      if (!rings.length) return null;

      const ringText = rings
        .filter((ring) => Array.isArray(ring) && ring.length > 0)
        .map((ring) => {
          const closed =
            ring[0].lat === ring[ring.length - 1].lat &&
            ring[0].lng === ring[ring.length - 1].lng
              ? ring
              : [...ring, ring[0]];

          return `(${closed.map((p) => `${p.lng} ${p.lat}`).join(', ')})`;
        })
        .join(', ');

      return ringText ? `POLYGON(${ringText})` : null;
    }

    return null;
  }

  private cloneLayer(layer: L.Layer): L.Layer | null {
    const geomTipo = this.inferGeomTipoFromLayer(layer);
    const wkt = this.layerToWkt(layer, geomTipo);
    if (!wkt) return null;

    const draftStyle: ResolvedElementStyle = {
      iconoFuente: null,
      icono: null,
      iconoClase: null,
      colorFill: this.EDIT_FILL,
      colorStroke: this.EDIT_STROKE,
      colorTexto: this.EDIT_STROKE,
      strokeWidth: 3,
      zIndex: 999,
      tamanoIcono: 18,
    };

    return this.layerFromWkt(wkt, draftStyle, false);
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
    style: ResolvedElementStyle,
    simplifyPoint = false
  ): L.Layer {
    if (simplifyPoint) {
      const radius = Math.max(
        this.PERFORMANCE_POINT_RADIUS,
        Math.min(10, Math.round(style.tamanoIcono * 0.28))
      );

      const layer = L.circleMarker(latlng, {
        radius,
        color: style.colorStroke,
        weight: Math.max(1, Math.min(5, style.strokeWidth)),
        fillColor: style.colorFill,
        fillOpacity: 0.88,
        renderer: this.vectorRenderer,
      });

      (layer as any).__baseWeight = Math.max(1, Math.min(5, style.strokeWidth));
      (layer as any).__baseFillOpacity = 0.88;
      (layer as any).__baseZIndex = style.zIndex;
      (layer as any).__baseRadius = radius;

      return layer;
    }

    const iconSource = this.normalizeIconSource(style.iconoFuente);
    const iconValue = (style.icono || '').trim();
    const iconClassValue = (style.iconoClase || '').trim();
    const size = style.tamanoIcono;
    const stroke = style.colorStroke;
    const fill = style.colorFill;
    const textColor = style.colorTexto || stroke;

    if (this.isUrlIcon(iconSource, iconValue)) {
      const icon = L.icon({
        iconUrl: iconValue,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
        className: 'mapa-url-icon',
      });

      const marker = L.marker(latlng, { icon, draggable: false });
      marker.setZIndexOffset(style.zIndex);

      (marker as any).__baseZIndex = style.zIndex;
      return marker;
    }

    if (this.isMaterialSymbol(iconSource)) {
      const familyClass = this.resolveMaterialFamily(iconSource);
      const weightAxis = this.toMaterialSymbolWeight(style.strokeWidth);
      const fillAxis = fill && fill !== 'transparent' ? 1 : 0;
      const glyph = this.escapeHtml(iconValue || 'radio_button_checked');

      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `
        <div class="mapa-point-icon-shell" style="
          width:${size}px;
          height:${size}px;
          color:${textColor};
        ">
          <span
            class="${familyClass}"
            style="
              font-size:${size}px;
              line-height:1;
              font-variation-settings:'FILL' ${fillAxis}, 'wght' ${weightAxis}, 'GRAD' 0, 'opsz' ${Math.max(20, Math.round(size))};
            "
          >${glyph}</span>
        </div>
      `,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      });

      const marker = L.marker(latlng, { icon, draggable: false });
      marker.setZIndexOffset(style.zIndex);

      (marker as any).__baseZIndex = style.zIndex;
      return marker;
    }

    if (this.isCssClassIcon(iconSource, iconClassValue || iconValue)) {
      const classValue = this.escapeHtmlAttr(iconClassValue || iconValue);

      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `
        <div class="mapa-point-icon-shell" style="
          width:${size}px;
          height:${size}px;
          color:${textColor};
          font-size:${size}px;
          line-height:1;
        ">
          <i class="${classValue}"></i>
        </div>
      `,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      });

      const marker = L.marker(latlng, { icon, draggable: false });
      marker.setZIndexOffset(style.zIndex);

      (marker as any).__baseZIndex = style.zIndex;
      return marker;
    }

    if (iconSource.includes('triangle')) {
      const half = Math.max(6, Math.round(size * 0.5));
      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `
        <div class="mapa-point-icon-shell" style="
          width:${size}px;
          height:${size}px;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <div style="
            width:0;
            height:0;
            border-left:${half}px solid transparent;
            border-right:${half}px solid transparent;
            border-bottom:${size}px solid ${fill};
            filter: drop-shadow(0 0 1px ${stroke});
          "></div>
        </div>
      `,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size * 0.85)],
      });

      const marker = L.marker(latlng, { icon, draggable: false });
      marker.setZIndexOffset(style.zIndex);

      (marker as any).__baseZIndex = style.zIndex;
      return marker;
    }

    if (iconSource.includes('target')) {
      const border = Math.max(2, Math.round(style.strokeWidth));
      const inner = Math.max(2, Math.round(size * 0.18));

      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `
        <div class="mapa-point-icon-shell" style="
          width:${size}px;
          height:${size}px;
          border:${border}px solid ${stroke};
          border-radius:999px;
          background:${fill};
          box-shadow: inset 0 0 0 ${inner}px white;
        "></div>
      `,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      });

      const marker = L.marker(latlng, { icon, draggable: false });
      marker.setZIndexOffset(style.zIndex);

      (marker as any).__baseZIndex = style.zIndex;
      return marker;
    }

    if (iconSource.includes('donut')) {
      const border = Math.max(3, Math.round(size * 0.22));

      const icon = L.divIcon({
        className: 'mapa-div-icon',
        html: `
        <div class="mapa-point-icon-shell" style="
          width:${size}px;
          height:${size}px;
          border:${border}px solid ${stroke};
          border-radius:999px;
          background:transparent;
        "></div>
      `,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      });

      const marker = L.marker(latlng, { icon, draggable: false });
      marker.setZIndexOffset(style.zIndex);

      (marker as any).__baseZIndex = style.zIndex;
      return marker;
    }

    const border = Math.max(2, Math.round(style.strokeWidth));

    const icon = L.divIcon({
      className: 'mapa-div-icon',
      html: `
      <div class="mapa-point-icon-shell" style="
        width:${size}px;
        height:${size}px;
        border-radius:999px;
        background:${fill};
        border:${border}px solid ${stroke};
        box-shadow: 0 0 0 1px rgba(255,255,255,0.8);
      "></div>
    `,
      iconSize: [size, size],
      iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
    });

    const marker = L.marker(latlng, { icon, draggable: false });
    marker.setZIndexOffset(style.zIndex);

    (marker as any).__baseZIndex = style.zIndex;
    return marker;
  }

  private resolveElementStyle(
    el: MapaElemento,
    tipo: MapaTipoElemento | null
  ): ResolvedElementStyle {
    const colorStroke = el.colorStroke || tipo?.colorStroke || this.DEFAULT_STROKE;
    const colorFill = el.colorFill || tipo?.colorFill || colorStroke;
    const colorTexto =
      el.colorTexto || tipo?.colorTexto || el.colorStroke || tipo?.colorStroke || null;

    return {
      iconoFuente: el.iconoFuente || tipo?.iconoFuente || null,
      icono: el.icono || tipo?.icono || null,
      iconoClase: el.iconoClase || tipo?.iconoClase || null,
      colorFill,
      colorStroke,
      colorTexto,
      strokeWidth: this.normalizeStrokeWidth(el.strokeWidth ?? tipo?.strokeWidth ?? null),
      zIndex: this.normalizeZIndex(el.zIndex ?? tipo?.zIndex ?? null),
      tamanoIcono: this.normalizeIconSize(el.tamanoIcono ?? tipo?.tamanoIcono ?? null),
    };
  }

  private normalizeStrokeWidth(value: number | null | undefined): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 3;
    return Math.max(1, Math.min(12, n));
  }

  private normalizeZIndex(value: number | null | undefined): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
  }

  private normalizeIconSize(value: number | null | undefined): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 18;
    return Math.max(12, Math.min(64, Math.round(n)));
  }

  private normalizeIconSource(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
  }

  private isMaterialSymbol(iconSource: string): boolean {
    return (
      iconSource.includes('material-symbols') ||
      iconSource.includes('material symbols') ||
      iconSource === 'google' ||
      iconSource === 'google-icons'
    );
  }

  private isCssClassIcon(iconSource: string, value: string): boolean {
    if (!value) return false;

    return (
      iconSource === 'class' ||
      iconSource === 'css' ||
      iconSource === 'primeicons' ||
      iconSource === 'fontawesome' ||
      iconSource === 'fa' ||
      iconSource === 'mdi' ||
      iconSource === 'bootstrap-icons'
    );
  }

  private isUrlIcon(iconSource: string, value: string): boolean {
    if (!value) return false;

    return (
      iconSource === 'url' ||
      iconSource === 'image' ||
      iconSource === 'img' ||
      /^https?:\/\//i.test(value) ||
      /^data:image\//i.test(value) ||
      /^\/assets\//i.test(value)
    );
  }

  private resolveMaterialFamily(iconSource: string): string {
    if (iconSource.includes('rounded')) return 'material-symbols-rounded';
    if (iconSource.includes('sharp')) return 'material-symbols-sharp';
    return 'material-symbols-outlined';
  }

  private toMaterialSymbolWeight(strokeWidth: number): number {
    const raw = strokeWidth > 10 ? strokeWidth : strokeWidth * 100;
    const snapped = Math.round(raw / 100) * 100;
    return Math.max(100, Math.min(700, snapped));
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeHtmlAttr(value: string): string {
    return this.escapeHtml(value);
  }
}