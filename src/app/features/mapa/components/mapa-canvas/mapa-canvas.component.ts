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
import type { MapaElemento } from '../../data-access/mapa.models';

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
  @Input() selectedElementoId: number | null = null;

  @Output() elementoSelected = new EventEmitter<MapaElemento | null>();

  private map!: L.Map;
  private drawnItems = new L.FeatureGroup();
  private renderedLayers = new Map<number, L.Layer>();

  ngAfterViewInit(): void {
    this.initMap();
    this.renderElementos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && (changes['elementos'] || changes['selectedElementoId'])) {
      this.renderElementos();
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

    const drawControl = new (L.Control as any).Draw({
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

    this.map.addControl(drawControl);

    this.map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Layer;
      this.drawnItems.addLayer(layer);
    });
  }

  private renderElementos() {
    this.drawnItems.clearLayers();
    this.renderedLayers.clear();

    for (const el of this.elementos) {
      const layer = this.layerFromElemento(el);
      if (!layer) continue;

      layer.on('click', () => this.elementoSelected.emit(el));
      this.drawnItems.addLayer(layer);
      this.renderedLayers.set(el.idGeoElemento, layer);
    }

    const selected = this.selectedElementoId != null
      ? this.renderedLayers.get(this.selectedElementoId)
      : null;

    if (selected && 'getBounds' in selected && typeof (selected as any).getBounds === 'function') {
      const bounds = (selected as any).getBounds();
      if (bounds?.isValid?.()) {
        this.map.fitBounds(bounds.pad(0.3));
      }
    } else if (selected && 'getLatLng' in selected && typeof (selected as any).getLatLng === 'function') {
      this.map.panTo((selected as any).getLatLng());
    } else if (this.drawnItems.getLayers().length > 0) {
      const bounds = this.drawnItems.getBounds();
      if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.2));
    }
  }

  private layerFromElemento(el: MapaElemento): L.Layer | null {
    const geom = el.geometria;
    const color = el.visible ? '#38bdf8' : '#64748b';

    if (!geom) return null;

    const geojsonLayer = this.tryGeoJsonLayer(geom, color);
    if (geojsonLayer) return geojsonLayer;

    const wkt = this.tryExtractWkt(geom);
    if (wkt) return this.layerFromWkt(wkt, color);

    return null;
  }

  private tryGeoJsonLayer(geom: any, color: string): L.Layer | null {
    if (geom && typeof geom === 'object' && geom.type && geom.coordinates) {
      return L.geoJSON(geom as any, {
        pointToLayer: (_f, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.85,
          }),
        style: {
          color,
          weight: 3,
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

  private layerFromWkt(wkt: string, color: string): L.Layer | null {
    const raw = wkt.trim();

    if (raw.startsWith('POINT')) {
      const match = raw.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
      if (!match) return null;
      const lng = Number(match[1]);
      const lat = Number(match[2]);
      return L.circleMarker([lat, lng], {
        radius: 6,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.85,
      });
    }

    if (raw.startsWith('LINESTRING')) {
      const match = raw.match(/LINESTRING\s*\((.+)\)/i);
      if (!match) return null;
      const coords = match[1].split(',').map((pair) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return [lat, lng] as [number, number];
      });
      return L.polyline(coords, { color, weight: 3 });
    }

    if (raw.startsWith('POLYGON')) {
      const match = raw.match(/POLYGON\s*\(\((.+)\)\)/i);
      if (!match) return null;
      const coords = match[1].split(',').map((pair) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return [lat, lng] as [number, number];
      });
      return L.polygon(coords, { color, weight: 3, fillOpacity: 0.15 });
    }

    return null;
  }
}