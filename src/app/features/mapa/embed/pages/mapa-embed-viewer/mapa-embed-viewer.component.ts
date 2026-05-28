
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';

import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { MapaElementosApi } from '../../../data-access/elemento/mapa-elementos.api';
import type { MapaElemento, MapaElementoSaveRequest, MapaGeomTipo, MapaTipoElemento } from '../../../data-access/mapa.models';
import { MAPA_BASEMAP_OPTIONS, type BasemapKey } from '../../../models/mapa-basemap.models';
import { MapaCrudFacade } from '../../../application/mapa-crud.facade';
import { MapaCreateElementDialogComponent } from '../../../components/mapa-create-element-dialog/mapa-create-element-dialog.component';
import { MapaEmbedApi } from '../../data-access/mapa-embed.api';
import type {
  MapaEmbedInitMessage,
  MapaEmbedMode,
  MapaElementoCercano,
} from '../../data-access/mapa-embed.models';
import { MapaEmbedAuthService } from '../../services/mapa-embed-auth.service';
import { MapaEmbedMessagingService } from '../../services/mapa-embed-messaging.service';
import { MapaEmbedContextStore } from '../../store/mapa-embed-context.store';

type DraftMode = 'none' | 'box' | 'fiber';

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface ParsedWktPoint {
  type: 'point';
  coordinates: LatLngPoint;
}

interface ParsedWktCollection {
  type: 'line' | 'polygon';
  coordinates: LatLngPoint[];
}

type ParsedWkt = ParsedWktPoint | ParsedWktCollection;

interface ElementVisualStyle {
  fill: string;
  stroke: string;
  text: string;
  weight: number;
  size: number;
  zIndex: number;
}

@Component({
  selector: 'app-mapa-embed-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaCreateElementDialogComponent],
  templateUrl: './mapa-embed-viewer.component.html',
  styleUrl: './mapa-embed-viewer.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MapaEmbedViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;
  @ViewChild('createDialog') createDialog?: MapaCreateElementDialogComponent;

  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(MapaEmbedAuthService);
  private readonly sessionStore = inject(SessionStore);
  private readonly embedStore = inject(MapaEmbedContextStore);
  private readonly embedApi = inject(MapaEmbedApi);
  private readonly elementosApi = inject(MapaElementosApi);
  private readonly crud = inject(MapaCrudFacade);
  private readonly messaging = inject(MapaEmbedMessagingService);

  readonly mode = signal<MapaEmbedMode>('vendedor');
  readonly loading = signal(true);
  readonly loadingItems = signal(false);
  readonly saving = signal(false);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  readonly context = this.embedStore.context;
  readonly config = this.embedStore.config;
  readonly nodos = this.crud.nodos;
  readonly tipos = this.crud.tipos;
  readonly tecnicoTipos = computed(() => this.filterTecnicoTipos(this.tipos()));

  readonly basemapOptions = MAPA_BASEMAP_OPTIONS;
  readonly basemapKey = signal<BasemapKey>('googleSatellite');
  readonly basemapMenuOpen = signal(false);
  readonly labelsVisible = signal(true);

  readonly items = signal<MapaElementoCercano[]>([]);
  readonly selected = signal<MapaElementoCercano | null>(null);
  readonly infoOpen = signal(false);

  readonly origin = signal<LatLngPoint | null>(null);
  readonly radioM = signal<number>(500);

  readonly routeTarget = signal<MapaElementoCercano | null>(null);
  readonly routeDistanceM = signal<number | null>(null);
  readonly routeLoading = signal(false);

  readonly draftMode = signal<DraftMode>('none');
  readonly draftPoints = signal<LatLngPoint[]>([]);
  readonly createError = signal<string | null>(null);

  readonly selectedName = computed(() => this.selected()?.nombre ?? null);
  readonly basemapLabel = computed(() => {
    return this.basemapOptions.find((item) => item.key === this.basemapKey())?.label ?? 'Mapa';
  });
  readonly modeLabel = computed(() => this.mode() === 'tecnico' ? 'Técnico' : 'Vendedor');

  readonly createForm: {
    idRedNodoFk: number | null;
    idGeoTipoElementoFk: number | null;
    nombre: string;
    descripcion: string;
  } = {
    idRedNodoFk: null,
    idGeoTipoElementoFk: null,
    nombre: '',
    descripcion: '',
  };

  private map?: L.Map;
  private baseLayer?: L.TileLayer;
  private originLayer?: L.LayerGroup;
  private routeLayer?: L.LayerGroup;
  private itemsLayer?: L.LayerGroup;
  private labelsLayer?: L.LayerGroup;
  private draftLayer?: L.LayerGroup;
  private layersByElementId = new Map<number, L.Layer>();

  private readonly KLAX_PRIMARY = '#7b0061';
  private readonly DEFAULT_FILL = '#f3aad6';
  private readonly DEFAULT_STROKE = '#7b0061';

  private readonly messageHandler = (event: MessageEvent) => this.handleParentMessage(event);

  ngOnInit() {
    const routeMode = (this.route.snapshot.data['mode'] ?? 'vendedor') as MapaEmbedMode;
    this.mode.set(routeMode);

    const origin = this.route.snapshot.queryParamMap.get('origin');
    this.embedStore.setPostMessageOrigin(origin);

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.messageHandler);
    }

    this.authenticate(routeMode);
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageHandler);
    }
    this.map?.remove();
  }

  can(key: string) {
    return !!this.config()?.privilegios?.[key];
  }

  actionEnabled(action: string) {
    const actions = this.config()?.acciones ?? [];
    return actions.length === 0 || actions.includes(action);
  }

  itemFill(item: MapaElementoCercano) {
    return this.resolveElementStyle(item).fill;
  }

  itemStroke(item: MapaElementoCercano) {
    return this.resolveElementStyle(item).stroke;
  }

  itemLetter(item: MapaElementoCercano) {
    const text = item.tipoNombre || item.tipoCodigo || item.nombre || 'E';
    return text.slice(0, 1).toUpperCase();
  }

  rowIconImage(item: MapaElementoCercano): string | null {
    const source = String(item.iconoFuente || '').trim().toLowerCase();
    const icon = String(item.icono || '').trim();

    if (!icon) return null;

    if (source.includes('url') || /^https?:\/\//i.test(icon) || icon.startsWith('assets/')) {
      return icon;
    }

    return null;
  }

  rowIsMaterialIcon(item: MapaElementoCercano): boolean {
    const source = String(item.iconoFuente || '').trim().toLowerCase();
    const icon = String(item.icono || '').trim();
    return !!icon && source.includes('material');
  }

  rowIconGlyph(item: MapaElementoCercano): string {
    return String(item.icono || '').trim() || 'radio_button_checked';
  }

  rowIconClass(item: MapaElementoCercano): string | null {
    const source = String(item.iconoFuente || '').trim().toLowerCase();
    const cls = String(item.iconoClase || '').trim();
    const icon = String(item.icono || '').trim();

    if (cls) return cls;
    if (icon.includes('pi-')) return icon.startsWith('pi ') ? icon : `pi ${icon}`;
    if ((source.includes('class') || source.includes('css') || source.includes('prime')) && icon) return icon;

    return null;
  }

  rowIconBackground(item: MapaElementoCercano): string {
    if (this.rowIconImage(item) || this.rowIsMaterialIcon(item) || this.rowIconClass(item)) {
      return '#ffffff';
    }

    return item.colorFill || this.lightenColor(this.itemStroke(item), 0.82);
  }

  elementLabel(item: MapaElementoCercano) {
    return item.etiqueta || item.codigo || item.nombre;
  }

  formatDistance(meters?: number | null): string {
    const value = Number(meters ?? 0);
    if (!Number.isFinite(value) || value <= 0) return '0 m';
    if (value < 1000) return `${value.toFixed(value < 100 ? 1 : 0)} m`;
    return `${(value / 1000).toFixed(value < 10000 ? 2 : 1)} km`;
  }

  changeBasemap(key: BasemapKey) {
    this.basemapKey.set(key);
    this.basemapMenuOpen.set(false);
    this.applyBasemap(key);
  }

  toggleBasemapMenu(event?: Event) {
    event?.stopPropagation();
    this.basemapMenuOpen.update((open) => !open);
  }

  toggleLabels() {
    this.labelsVisible.update((visible) => !visible);
    this.drawItems();
  }

  refreshNearby() {
    const origin = this.origin();
    if (!origin) {
      this.error.set('No hay ubicación de origen.');
      return;
    }

    this.loadNearby(origin.lat, origin.lng, this.radioM());
  }

  centerOrigin() {
    const origin = this.origin();
    if (!origin) return;
    this.map?.setView([origin.lat, origin.lng], Math.max(this.map?.getZoom() ?? 16, 16));
  }

  focusItem(item: MapaElementoCercano, openInfo = false) {
    this.selected.set(item);
    if (openInfo) this.infoOpen.set(true);

    this.messaging.elementViewed(item);
    this.drawItems();

    const layer = this.layersByElementId.get(item.idGeoElemento);
    if (!layer || !this.map) return;

    const anyLayer = layer as any;
    if (typeof anyLayer.getBounds === 'function') {
      this.map.fitBounds(anyLayer.getBounds(), { padding: [26, 26], maxZoom: 18 });
      return;
    }

    if (typeof anyLayer.getLatLng === 'function') {
      this.map.setView(anyLayer.getLatLng(), Math.max(this.map.getZoom(), 17));
    }
  }

  openInfo(item: MapaElementoCercano) {
    this.focusItem(item, true);
  }

  closeInfo() {
    this.infoOpen.set(false);
  }

  selectForErp() {
    const item = this.selected();
    if (!item) return;

    if (this.mode() === 'tecnico' && this.can('puedeSeleccionarCaja')) {
      this.messaging.boxSelected(item);
      return;
    }

    this.messaging.elementSelected(item);
  }

  cancel() {
    this.messaging.cancel();
  }

  locateBrowser() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.error.set('Este navegador no permite obtener ubicación.');
      return;
    }

    this.loadingItems.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.loadingItems.set(false);
        this.setOrigin(position.coords.latitude, position.coords.longitude, this.radioM(), true);
      },
      (err) => {
        this.loadingItems.set(false);
        this.error.set(err?.message || 'No se pudo obtener la ubicación.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

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

  clearRoute() {
    this.routeLayer?.clearLayers();
    this.routeTarget.set(null);
    this.routeDistanceM.set(null);
  }

startCreateBox() {
    if (this.mode() !== 'tecnico') return;

    if (!this.can('puedeCrearCaja') || !this.actionEnabled('create_box')) {
      this.createError.set('No tiene permiso para crear caja.');
      return;
    }

    this.loadTecnicoCatalogos();
    this.selected.set(null);
    this.infoOpen.set(false);
    this.error.set(null);
    this.createError.set(null);
    this.clearRoute();
    this.draftMode.set('box');
    this.draftPoints.set([]);
    this.redrawDraft();
    this.setDrawingCursor(true);
  }

startDrawFiber() {
    if (this.mode() !== 'tecnico') return;

    if (!this.can('puedeCrearFibra') || !this.actionEnabled('draw_fiber')) {
      this.createError.set('No tiene permiso para trazar fibra.');
      return;
    }

    this.loadTecnicoCatalogos();
    this.selected.set(null);
    this.infoOpen.set(false);
    this.error.set(null);
    this.createError.set(null);
    this.clearRoute();
    this.draftMode.set('fiber');
    this.draftPoints.set([]);
    this.redrawDraft();
    this.setDrawingCursor(true);
  }

useOriginAsDraftPoint() {
    const origin = this.origin();
    if (!origin) return;
    this.addDraftPoint(origin);
  }

  undoDraftPoint() {
    const points = this.draftPoints();
    this.draftPoints.set(points.slice(0, Math.max(points.length - 1, 0)));
    this.redrawDraft();
  }

clearDraft() {
    this.draftMode.set('none');
    this.draftPoints.set([]);
    this.createError.set(null);
    this.createForm.idRedNodoFk = null;
    this.createForm.idGeoTipoElementoFk = null;
    this.createForm.nombre = '';
    this.createForm.descripcion = '';
    this.redrawDraft();
    this.setDrawingCursor(false);
  }

saveDraft() {
    const draftMode = this.draftMode();
    const points = this.draftPoints();

    if (draftMode === 'none') return;

    const validation = this.validateCreateForm(draftMode, points);
    if (validation) {
      this.createError.set(validation);
      return;
    }

    const payload: MapaElementoSaveRequest = {
      idRedNodoFk: Number(this.createForm.idRedNodoFk),
      idGeoTipoElementoFk: Number(this.createForm.idGeoTipoElementoFk),
      nombre: this.createForm.nombre.trim(),
      descripcion: this.createForm.descripcion?.trim() || null,
      estado: 'activo',
      visible: true,
      origen: 'embed_tecnico',
      origenRef: this.context()?.trabajoId != null ? String(this.context()?.trabajoId) : null,
      atributos: this.buildCreateAttributes(draftMode),
      wkt: draftMode === 'box' ? this.pointWkt(points[0]) : this.lineWkt(points),
      latLon: draftMode === 'box' ? `${points[0].lat},${points[0].lng}` : null,
    };

    this.saving.set(true);
    this.createError.set(null);

    this.elementosApi.crear(payload).subscribe({
      next: (resp) => {
        this.saving.set(false);
        try {
          const created = unwrapOrThrow<MapaElemento>(resp);
          if (draftMode === 'box') this.messaging.boxCreated(created);
          if (draftMode === 'fiber') this.messaging.fiberCreated(created);
          this.clearDraft();
          this.refreshNearby();
        } catch (err: any) {
          this.createError.set(err?.message || 'No se pudo crear el elemento.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.createError.set(err?.error?.mensaje || err?.message || 'No se pudo crear el elemento.');
      },
    });
  }

onCreateDialogCancelled() {
    this.clearDraft();
  }

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
    this.setDrawingCursor(false);

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

private setDrawingCursor(active: boolean) {
    this.map?.getContainer().classList.toggle('is-embed-drawing', active);
  }

private nearbyLimitForRadius(radioM?: number | null): number {
    const radio = Number(radioM ?? this.radioM());

    if (!Number.isFinite(radio) || radio <= 0) {
      return 50;
    }

    if (radio >= 5000) {
      return 300;
    }

    if (radio >= 3000) {
      return 200;
    }

    if (radio >= 1000) {
      return 120;
    }

    if (radio >= 500) {
      return 80;
    }

    return 50;
  }

private authenticate(expectedMode: MapaEmbedMode) {
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code && this.sessionStore.isAuthenticated() && this.embedStore.context()?.mode === expectedMode) {
      this.afterAuthenticated();
      return;
    }

    if (!code) {
      this.fail('Falta el parámetro code para abrir el mapa.');
      return;
    }

    this.auth.exchange(code, expectedMode).subscribe({
      next: () => this.afterAuthenticated(),
      error: (err) => this.fail(err?.error?.mensaje || err?.message || 'No se pudo iniciar el mapa.'),
    });
  }

  private afterAuthenticated() {
    this.loading.set(false);
    this.ready.set(true);

    const ctx = this.context();
    const config = this.config();

    if (this.mode() === 'tecnico') {
      this.loadTecnicoCatalogos();
    }
    this.radioM.set(ctx?.radioM || config?.distanciaM || 500);

    const lat = this.numberQueryParam('lat') ?? ctx?.lat ?? null;
    const lng = this.numberQueryParam('lng') ?? ctx?.lng ?? null;

    if (lat != null && lng != null) {
      this.setOrigin(lat, lng, this.radioM(), true);
    } else {
      this.error.set('Esperando ubicación desde el ERP o GPS.');
    }

    this.messaging.ready(this.mode(), ctx);
  }

  private initMap() {
    if (!this.mapEl?.nativeElement || this.map) return;

    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      maxZoom: 20,
    }).setView([-2.170998, -79.922359], 14);

    this.applyBasemap(this.basemapKey());

    this.originLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.itemsLayer = L.layerGroup().addTo(this.map);
    this.labelsLayer = L.layerGroup().addTo(this.map);
    this.draftLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const mode = this.draftMode();
      if (mode === 'none') return;
      this.addDraftPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    setTimeout(() => this.map?.invalidateSize(), 80);
    setTimeout(() => this.map?.invalidateSize(), 260);
  }

  private applyBasemap(key: BasemapKey) {
    if (!this.map) return;

    const config = MAPA_BASEMAP_OPTIONS.find((item) => item.key === key) ?? MAPA_BASEMAP_OPTIONS[0];

    if (this.baseLayer) {
      this.map.removeLayer(this.baseLayer);
    }

    this.baseLayer = L.tileLayer(config.url, config.options);
    this.baseLayer.addTo(this.map);
  }

  private setOrigin(lat: number, lng: number, radioM: number, load = false) {
    this.origin.set({ lat, lng });
    this.radioM.set(radioM);

    this.embedStore.patchContext({ lat, lng, radioM });
    this.drawOrigin();
    this.clearRoute();

    if (this.map) {
      this.map.setView([lat, lng], Math.max(this.map.getZoom(), 15));
    }

    if (load) {
      this.loadNearby(lat, lng, radioM);
    }
  }

  private loadNearby(lat: number, lng: number, radioM: number) {
    this.error.set(null);
    this.loadingItems.set(true);

    this.embedApi
      .getElementosCercanos({
        modo: this.mode(),
        lat,
        lng,
        radioM,
        limit: this.mode() === 'tecnico' ? 100 : 50,
        ctx: this.context(),
      })
      .subscribe({
        next: (resp) => {
          this.loadingItems.set(false);
          try {
            const data = unwrapOrThrow(resp);
            this.items.set(data.items ?? []);
            this.drawItems();

            if (!data.items?.length) {
              this.error.set('No se encontraron elementos cercanos.');
            }
          } catch (err: any) {
            this.error.set(err?.message || 'No se pudo leer elementos cercanos.');
          }
        },
        error: (err) => {
          this.loadingItems.set(false);
          this.error.set(err?.error?.mensaje || err?.message || 'No se pudo cargar elementos cercanos.');
        },
      });
  }

  private drawOrigin() {
    this.originLayer?.clearLayers();

    const origin = this.origin();
    if (!origin || !this.originLayer) return;

    L.circle([origin.lat, origin.lng], {
      radius: this.radioM(),
      color: '#2563eb',
      weight: 1,
      fillColor: '#60a5fa',
      fillOpacity: 0.055,
      opacity: 0.72,
    }).addTo(this.originLayer);

    L.marker([origin.lat, origin.lng], {
      icon: this.createOriginIcon(),
      zIndexOffset: 2200,
    })
      .bindTooltip('Tu ubicación', {
        direction: 'top',
        permanent: false,
        opacity: 0.98,
        className: 'mapa-element-tooltip mapa-embed-origin-tooltip',
      })
      .addTo(this.originLayer);
  }

  private drawItems() {
    this.itemsLayer?.clearLayers();
    this.labelsLayer?.clearLayers();
    this.layersByElementId.clear();

    if (!this.itemsLayer || !this.labelsLayer) return;

    const bounds: L.LatLngExpression[] = [];
    const origin = this.origin();
    if (origin) bounds.push([origin.lat, origin.lng]);

    for (const item of this.items()) {
      const layer = this.layerFromItem(item);
      if (!layer) continue;

      layer.on('click', () => this.focusItem(item, true));
      layer.addTo(this.itemsLayer);
      this.layersByElementId.set(item.idGeoElemento, layer);

      const center = this.layerCenter(layer);
      if (center) {
        bounds.push(center);

        if (this.labelsVisible()) {
          L.marker(center, {
            interactive: false,
            zIndexOffset: this.selected()?.idGeoElemento === item.idGeoElemento ? 1700 : 1400,
            icon: this.createElementLabelIcon(item, this.selected()?.idGeoElemento === item.idGeoElemento),
          }).addTo(this.labelsLayer);
        }
      }
    }

    if (this.map && bounds.length > 1) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [34, 34], maxZoom: 17 });
    }
  }

  private layerFromItem(item: MapaElementoCercano): L.Layer | null {
    const parsed = this.parseWkt(item.wkt);
    if (!parsed) return null;

    const selected = this.selected()?.idGeoElemento === item.idGeoElemento;
    const style = this.resolveElementStyle(item, selected);
    const tooltip = `${this.elementLabel(item)} · ${this.formatDistance(item.distanciaM)}`;

    if (parsed.type === 'point') {
      return L.marker([parsed.coordinates.lat, parsed.coordinates.lng], {
        icon: this.createElementIcon(item, style, selected),
        zIndexOffset: selected ? 1800 : style.zIndex,
      }).bindTooltip(tooltip, {
        direction: 'top',
        sticky: false,
        permanent: false,
        opacity: 0.96,
        className: 'mapa-element-tooltip',
      });
    }

    if (parsed.type === 'line') {
      return L.polyline(parsed.coordinates.map((p) => [p.lat, p.lng] as L.LatLngExpression), {
        color: style.stroke,
        weight: selected ? Math.max(style.weight + 2, 5) : Math.max(style.weight, 3),
        opacity: selected ? 1 : 0.86,
        lineCap: 'round',
        lineJoin: 'round',
      }).bindTooltip(tooltip, {
        sticky: false,
        opacity: 0.96,
        className: 'mapa-element-tooltip',
      });
    }

    if (parsed.type === 'polygon') {
      return L.polygon(parsed.coordinates.map((p) => [p.lat, p.lng] as L.LatLngExpression), {
        color: style.stroke,
        weight: selected ? Math.max(style.weight + 1, 4) : Math.max(style.weight, 2),
        fillColor: style.fill,
        fillOpacity: selected ? 0.28 : 0.15,
        opacity: selected ? 1 : 0.86,
      }).bindTooltip(tooltip, {
        direction: 'center',
        sticky: false,
        opacity: 0.96,
        className: 'mapa-element-tooltip',
      });
    }

    return null;
  }

  private layerCenter(layer: L.Layer): L.LatLngExpression | null {
    const anyLayer = layer as any;

    if (typeof anyLayer.getLatLng === 'function') {
      const ll = anyLayer.getLatLng();
      return [ll.lat, ll.lng];
    }

    if (typeof anyLayer.getBounds === 'function') {
      const center = anyLayer.getBounds().getCenter();
      return [center.lat, center.lng];
    }

    return null;
  }

  private itemAnchor(item: MapaElementoCercano): LatLngPoint | null {
    const layer = this.layersByElementId.get(item.idGeoElemento);
    const center = layer ? this.layerCenter(layer) : null;

    if (Array.isArray(center)) {
      return { lat: Number(center[0]), lng: Number(center[1]) };
    }

    const parsed = this.parseWkt(item.wkt);
    if (!parsed) return null;

    if (parsed.type === 'point') return parsed.coordinates;
    if (!parsed.coordinates.length) return null;

    const sum = parsed.coordinates.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: sum.lat / parsed.coordinates.length,
      lng: sum.lng / parsed.coordinates.length,
    };
  }

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

private seedCreateForm(defaultName: string) {
    const firstType = this.config()?.tiposElemento?.[0] ?? null;
    this.createForm.idGeoTipoElementoFk = firstType;
    if (!this.createForm.nombre) {
      this.createForm.nombre = defaultName;
    }
  }

  private validateCreateForm(draftMode: DraftMode, points: LatLngPoint[]) {
    if (!this.createForm.idRedNodoFk || Number(this.createForm.idRedNodoFk) <= 0) {
      return 'Debe ingresar idRedNodoFk.';
    }

    if (!this.createForm.idGeoTipoElementoFk || Number(this.createForm.idGeoTipoElementoFk) <= 0) {
      return 'Debe ingresar idGeoTipoElementoFk.';
    }

    if (!this.createForm.nombre?.trim()) {
      return 'Debe ingresar nombre.';
    }

    if (draftMode === 'box' && points.length !== 1) {
      return 'Debe marcar un punto.';
    }

    if (draftMode === 'fiber' && points.length < 2) {
      return 'Debe marcar al menos dos puntos.';
    }

    return null;
  }

  private buildCreateAttributes(draftMode: DraftMode): Record<string, any> {
    const ctx = this.context();
    return {
      embed: true,
      embedMode: this.mode(),
      draftMode,
      trabajoId: ctx?.trabajoId ?? null,
      clienteId: ctx?.clienteId ?? null,
      ordenId: ctx?.ordenId ?? null,
      metadata: ctx?.metadata ?? null,
    };
  }

  private pointWkt(point: LatLngPoint) {
    return `POINT(${point.lng} ${point.lat})`;
  }

  private lineWkt(points: LatLngPoint[]) {
    return `LINESTRING(${points.map((p) => `${p.lng} ${p.lat}`).join(',')})`;
  }

  private handleParentMessage(event: MessageEvent) {
    const data = event.data as Partial<MapaEmbedInitMessage> | null;
    if (!data || data.type !== 'KLAX_MAP_INIT') return;

    if (data.mode && data.mode !== this.mode()) {
      this.error.set(`El ERP envió modo ${data.mode}, pero este visor está en modo ${this.mode()}.`);
      return;
    }

    const lat = this.asNumber(data.lat);
    const lng = this.asNumber(data.lng);
    const radioM = this.asNumber(data.radioM) ?? this.radioM();

    this.embedStore.patchContext({
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      direccion: data.direccion,
      radioM,
      trabajoId: data.trabajoId,
      clienteId: data.clienteId,
      ordenId: data.ordenId,
      metadata: data.metadata,
    });

    if (lat != null && lng != null) {
      this.setOrigin(lat, lng, radioM, true);
    }
  }

  private resolveElementStyle(item: MapaElementoCercano, selected = false): ElementVisualStyle {
    const stroke = this.normalizeColor(item.colorStroke, this.colorByTipo(item));
    const fill = this.normalizeColor(item.colorFill, this.lightenColor(stroke, 0.82));
    const text = this.normalizeColor(item.colorTexto, stroke);

    return {
      fill,
      stroke,
      text,
      weight: Math.max(1, Number(item.strokeWidth ?? 3)),
      size: Math.max(10, Math.min(34, Number(item.tamanoIcono ?? 22) + (selected ? 3 : 0))),
      zIndex: Math.round(Number(item.zIndex ?? 0)),
    };
  }

  private createOriginIcon(): L.DivIcon {
    return L.divIcon({
      className: 'mapa-embed-origin-icon-host',
      html: `
        <div class="mapa-embed-origin-pulse"></div>
        <div class="mapa-embed-origin-pin">
          <span class="mapa-embed-origin-symbol">${this.mode() === 'tecnico' ? '👤' : '⌂'}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    });
  }

  private createElementIcon(item: MapaElementoCercano, style: ElementVisualStyle, selected = false): L.DivIcon {
    const source = String(item.iconoFuente || '').trim().toLowerCase();
    const iconValue = String(item.icono || '').trim();
    const iconClassValue = String(item.iconoClase || '').trim();
    const size = Math.round(style.size);
    const stroke = style.stroke;
    const fill = style.fill;
    const textColor = style.text || stroke;
    const selectedClass = selected ? ' is-selected' : '';

    if (this.isUrlIcon(source, iconValue)) {
      return L.divIcon({
        className: `mapa-div-icon${selectedClass}`,
        html: `<div class="mapa-point-icon-shell" style="width:${size}px;height:${size}px;">
          <img src="${this.escapeHtml(iconValue)}" alt="" style="width:${size}px;height:${size}px;display:block;" />
        </div>`,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      });
    }

    if (this.isMaterialSymbol(source)) {
      const familyClass = this.resolveMaterialFamily(source);
      const glyph = this.escapeHtml(iconValue || 'radio_button_checked');
      const weightAxis = Math.max(100, Math.min(700, Math.round((style.weight || 3) * 120)));
      const fillAxis = fill && fill !== 'transparent' ? 1 : 0;

      return L.divIcon({
        className: `mapa-div-icon${selectedClass}`,
        html: `
          <div class="mapa-point-icon-shell" style="width:${size}px;height:${size}px;color:${textColor};">
            <span
              class="${familyClass}"
              style="
                font-size:${size}px;
                line-height:1;
                font-variation-settings:'FILL' ${fillAxis}, 'wght' ${weightAxis}, 'GRAD' 0, 'opsz' ${Math.max(20, size)};
              "
            >${glyph}</span>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      });
    }

    const cssClass = iconClassValue || (iconValue.includes('pi-') ? iconValue : '');
    if (this.isCssClassIcon(source, cssClass)) {
      const classValue = this.escapeHtml(cssClass);
      return L.divIcon({
        className: `mapa-div-icon${selectedClass}`,
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
    }

    if (source.includes('triangle')) {
      const half = Math.max(6, Math.round(size * 0.5));
      return L.divIcon({
        className: `mapa-div-icon${selectedClass}`,
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
    }

    if (source.includes('target')) {
      const border = Math.max(2, Math.round(style.weight || 2));
      const inner = Math.max(2, Math.round(size * 0.18));

      return L.divIcon({
        className: `mapa-div-icon${selectedClass}`,
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
    }

    if (source.includes('donut')) {
      const border = Math.max(3, Math.round(size * 0.22));

      return L.divIcon({
        className: `mapa-div-icon${selectedClass}`,
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
    }

    const border = Math.max(2, Math.round(style.weight || 2));

    return L.divIcon({
      className: `mapa-div-icon${selectedClass}`,
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
  }

  private createElementLabelIcon(item: MapaElementoCercano, selected = false): L.DivIcon {
    return L.divIcon({
      className: 'mapa-element-label-host',
      html: `<div class="mapa-element-label${selected ? ' is-selected' : ''}">${this.escapeHtml(this.elementLabel(item))}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  private createRouteLabelIcon(text: string): L.DivIcon {
    return L.divIcon({
      className: 'mapa-measure-label-host',
      html: `<div class="mapa-measure-label">${this.escapeHtml(text)}</div>`,
      iconSize: [0, 0],
      iconAnchor: [-18, -18],
    });
  }

  private parseWkt(wkt?: string | null): ParsedWkt | null {
    if (!wkt) return null;

    const clean = wkt.trim();

    const pointMatch = /^POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)$/i.exec(clean);
    if (pointMatch) {
      return {
        type: 'point',
        coordinates: {
          lng: Number(pointMatch[1]),
          lat: Number(pointMatch[2]),
        },
      };
    }

    const lineMatch = /^LINESTRING\s*\((.+)\)$/i.exec(clean);
    if (lineMatch) {
      const coords = this.parseCoordList(lineMatch[1]);
      return coords.length ? { type: 'line', coordinates: coords } : null;
    }

    const polygonMatch = /^POLYGON\s*\(\((.+)\)\)$/i.exec(clean);
    if (polygonMatch) {
      const coords = this.parseCoordList(polygonMatch[1]);
      return coords.length ? { type: 'polygon', coordinates: coords } : null;
    }

    return null;
  }

  private parseCoordList(raw: string) {
    return raw
      .split(',')
      .map((pair) => {
        const [lngRaw, latRaw] = pair.trim().split(/\s+/);
        return { lng: Number(lngRaw), lat: Number(latRaw) };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  private isUrlIcon(source: string, value: string) {
    return source.includes('url') || /^https?:\/\//i.test(value) || value.startsWith('assets/');
  }

  private isMaterialSymbol(source: string) {
    return source.includes('material');
  }

  private resolveMaterialFamily(source: string) {
    if (source.includes('rounded')) return 'material-symbols-rounded';
    if (source.includes('outlined')) return 'material-symbols-outlined';
    return 'material-symbols-rounded';
  }

  private isCssClassIcon(source: string, value: string) {
    return source.includes('class') || source.includes('css') || source.includes('prime') || /\b(pi|fa|mdi)-/.test(value);
  }

  private colorByTipo(item: MapaElementoCercano) {
    const key = `${item.tipoCodigo ?? ''} ${item.tipoNombre ?? ''} ${item.nombre ?? ''}`.toLowerCase();

    if (key.includes('fibra') || key.includes('fiber') || key.includes('cable')) return '#06b6d4';
    if (key.includes('splitter')) return '#7b0061';
    if (key.includes('nap')) return '#10b981';
    if (key.includes('caja') || key.includes('box') || key.includes('cto')) return '#7b0061';
    if (key.includes('manga')) return '#f59e0b';
    if (key.includes('poste')) return '#64748b';

    return this.DEFAULT_STROKE;
  }

  private normalizeColor(value: unknown, fallback: string) {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
    if (/^rgba?\(/i.test(raw)) return raw;
    return fallback;
  }

  private lightenColor(hex: string, amount = 0.82) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return this.DEFAULT_FILL;

    const n = Number.parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;

    const nr = Math.round(r + (255 - r) * amount);
    const ng = Math.round(g + (255 - g) * amount);
    const nb = Math.round(b + (255 - b) * amount);

    return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  private numberQueryParam(name: string) {
    return this.asNumber(this.route.snapshot.queryParamMap.get(name));
  }

  private asNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private escapeHtml(value: string) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private fail(message: string) {
    this.loading.set(false);
    this.ready.set(false);
    this.error.set(message);
    this.messaging.error(message);
  }
}
