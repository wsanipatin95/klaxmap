import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';

import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { MapaElementosApi } from '../../../data-access/elemento/mapa-elementos.api';
import type { MapaElemento, MapaElementoSaveRequest } from '../../../data-access/mapa.models';
import { MapaEmbedApi } from '../../data-access/mapa-embed.api';
import type {
  MapaEmbedContext,
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

@Component({
  selector: 'app-mapa-embed-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-embed-viewer.component.html',
  styleUrl: './mapa-embed-viewer.component.scss',
})
export class MapaEmbedViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(MapaEmbedAuthService);
  private readonly sessionStore = inject(SessionStore);
  private readonly embedStore = inject(MapaEmbedContextStore);
  private readonly embedApi = inject(MapaEmbedApi);
  private readonly elementosApi = inject(MapaElementosApi);
  private readonly messaging = inject(MapaEmbedMessagingService);

  readonly mode = signal<MapaEmbedMode>('vendedor');
  readonly loading = signal(true);
  readonly loadingItems = signal(false);
  readonly saving = signal(false);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  readonly context = this.embedStore.context;
  readonly config = this.embedStore.config;

  readonly items = signal<MapaElementoCercano[]>([]);
  readonly selected = signal<MapaElementoCercano | null>(null);
  readonly origin = signal<LatLngPoint | null>(null);
  readonly radioM = signal<number>(500);

  readonly draftMode = signal<DraftMode>('none');
  readonly draftPoints = signal<LatLngPoint[]>([]);
  readonly createError = signal<string | null>(null);

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
  private originLayer?: L.LayerGroup;
  private itemsLayer?: L.LayerGroup;
  private draftLayer?: L.LayerGroup;
  private layersByElementId = new Map<number, L.Layer>();
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

  refreshNearby() {
    const origin = this.origin();
    if (!origin) {
      this.error.set('No hay una ubicación inicial para buscar elementos cercanos.');
      return;
    }

    this.loadNearby(origin.lat, origin.lng, this.radioM());
  }

  centerOrigin() {
    const origin = this.origin();
    if (!origin) return;
    this.map?.setView([origin.lat, origin.lng], Math.max(this.map?.getZoom() ?? 16, 16));
  }

  focusItem(item: MapaElementoCercano) {
    this.selected.set(item);
    this.messaging.elementViewed(item);

    const layer = this.layersByElementId.get(item.idGeoElemento);
    if (!layer || !this.map) return;

    const anyLayer = layer as any;
    if (typeof anyLayer.getBounds === 'function') {
      this.map.fitBounds(anyLayer.getBounds(), { padding: [24, 24], maxZoom: 18 });
      return;
    }

    if (typeof anyLayer.getLatLng === 'function') {
      this.map.setView(anyLayer.getLatLng(), Math.max(this.map.getZoom(), 17));
    }
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
      this.error.set('Este navegador no permite obtener la ubicación actual.');
      return;
    }

    this.loadingItems.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.loadingItems.set(false);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.setOrigin(lat, lng, this.radioM(), true);
      },
      (err) => {
        this.loadingItems.set(false);
        this.error.set(err?.message || 'No se pudo obtener la ubicación actual.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  startCreateBox() {
    if (this.mode() !== 'tecnico') return;
    if (!this.can('puedeCrearCaja') || !this.actionEnabled('create_box')) {
      this.createError.set('No tiene permiso para crear caja.');
      return;
    }

    this.draftMode.set('box');
    this.draftPoints.set([]);
    this.createError.set(null);
    this.seedCreateForm('Caja nueva');
  }

  startDrawFiber() {
    if (this.mode() !== 'tecnico') return;
    if (!this.can('puedeCrearFibra') || !this.actionEnabled('draw_fiber')) {
      this.createError.set('No tiene permiso para trazar fibra.');
      return;
    }

    this.draftMode.set('fiber');
    this.draftPoints.set([]);
    this.createError.set(null);
    this.seedCreateForm('Tendido de fibra');
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

    const wkt = draftMode === 'box' ? this.pointWkt(points[0]) : this.lineWkt(points);

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
      wkt,
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

  private authenticate(expectedMode: MapaEmbedMode) {
    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code && this.sessionStore.isAuthenticated() && this.embedStore.context()?.mode === expectedMode) {
      this.afterAuthenticated();
      return;
    }

    if (!code) {
      this.fail('Falta el parámetro code para abrir el mapa embebido.');
      return;
    }

    this.auth.exchange(code, expectedMode).subscribe({
      next: () => this.afterAuthenticated(),
      error: (err) => this.fail(err?.error?.mensaje || err?.message || 'No se pudo iniciar el mapa embebido.'),
    });
  }

  private afterAuthenticated() {
    this.loading.set(false);
    this.ready.set(true);

    const ctx = this.context();
    const config = this.config();
    this.radioM.set(ctx?.radioM || config?.distanciaM || 500);

    const queryLat = this.numberQueryParam('lat');
    const queryLng = this.numberQueryParam('lng');

    const lat = queryLat ?? ctx?.lat ?? null;
    const lng = queryLng ?? ctx?.lng ?? null;

    if (lat != null && lng != null) {
      this.setOrigin(lat, lng, this.radioM(), true);
    } else {
      this.error.set('Mapa iniciado. Esperando ubicación desde el ERP antiguo o navegador.');
    }

    this.messaging.ready(this.mode(), ctx);
  }

  private initMap() {
    if (!this.mapEl?.nativeElement || this.map) return;

    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    }).setView([-2.170998, -79.922359], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.originLayer = L.layerGroup().addTo(this.map);
    this.itemsLayer = L.layerGroup().addTo(this.map);
    this.draftLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      const mode = this.draftMode();
      if (mode === 'none') return;
      this.addDraftPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    setTimeout(() => this.map?.invalidateSize(), 80);
  }

  private setOrigin(lat: number, lng: number, radioM: number, load = false) {
    this.origin.set({ lat, lng });
    this.radioM.set(radioM);

    this.embedStore.patchContext({ lat, lng, radioM });
    this.drawOrigin();

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
      weight: 1,
      fillOpacity: 0.06,
    }).addTo(this.originLayer);

    L.circleMarker([origin.lat, origin.lng], {
      radius: 8,
      weight: 3,
      fillOpacity: 0.9,
    })
      .bindTooltip('Ubicación enviada por ERP', { permanent: false })
      .addTo(this.originLayer);
  }

  private drawItems() {
    this.itemsLayer?.clearLayers();
    this.layersByElementId.clear();

    if (!this.itemsLayer) return;

    const bounds: L.LatLngExpression[] = [];
    const origin = this.origin();
    if (origin) bounds.push([origin.lat, origin.lng]);

    for (const item of this.items()) {
      const layer = this.layerFromItem(item);
      if (!layer) continue;

      layer.on('click', () => {
        this.selected.set(item);
        this.messaging.elementViewed(item);
      });

      layer.addTo(this.itemsLayer);
      this.layersByElementId.set(item.idGeoElemento, layer);

      const center = this.layerCenter(layer);
      if (center) bounds.push(center);
    }

    if (this.map && bounds.length > 1) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 17 });
    }
  }

  private layerFromItem(item: MapaElementoCercano): L.Layer | null {
    const parsed = this.parseWkt(item.wkt);

    if (!parsed) {
      return null;
    }

    const label = `${item.nombre}${item.distanciaM != null ? ` (${Math.round(item.distanciaM)} m)` : ''}`;

    if (parsed.type === 'point') {
      return L.circleMarker([parsed.coordinates.lat, parsed.coordinates.lng], {
        radius: 7,
        weight: 2,
        fillOpacity: 0.78,
      }).bindTooltip(label);
    }

    if (parsed.type === 'line') {
      return L.polyline(parsed.coordinates.map((p) => [p.lat, p.lng] as L.LatLngExpression), {
        weight: 4,
      }).bindTooltip(label);
    }

    if (parsed.type === 'polygon') {
      return L.polygon(parsed.coordinates.map((p) => [p.lat, p.lng] as L.LatLngExpression), {
        weight: 2,
        fillOpacity: 0.12,
      }).bindTooltip(label);
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
  }

  private redrawDraft() {
    this.draftLayer?.clearLayers();

    if (!this.draftLayer) return;

    const points = this.draftPoints();

    for (const p of points) {
      L.circleMarker([p.lat, p.lng], {
        radius: 5,
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(this.draftLayer);
    }

    if (this.draftMode() === 'fiber' && points.length >= 2) {
      L.polyline(points.map((p) => [p.lat, p.lng] as L.LatLngExpression), {
        weight: 4,
        dashArray: '6 6',
      }).addTo(this.draftLayer);
    }
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
      return 'Debe marcar un punto para la caja.';
    }

    if (draftMode === 'fiber' && points.length < 2) {
      return 'Debe marcar al menos dos puntos para la fibra.';
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

  private parseWkt(wkt?: string | null):
    | { type: 'point'; coordinates: LatLngPoint }
    | { type: 'line'; coordinates: LatLngPoint[] }
    | { type: 'polygon'; coordinates: LatLngPoint[] }
    | null {
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

  private numberQueryParam(name: string) {
    return this.asNumber(this.route.snapshot.queryParamMap.get(name));
  }

  private asNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private fail(message: string) {
    this.loading.set(false);
    this.ready.set(false);
    this.error.set(message);
    this.messaging.error(message);
  }
}
