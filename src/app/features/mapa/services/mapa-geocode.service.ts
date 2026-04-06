import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  MapaGeoSearchBounds,
  MapaGeoSearchResult,
} from '../models/mapa-geo-search.models';

interface NominatimSearchResult {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string] | string[];
  type?: string;
  class?: string;
}

@Injectable({ providedIn: 'root' })
export class MapaGeocodeService {
  private readonly http = inject(HttpClient);

  /**
   * Endpoint público por defecto.
   * Puedes reemplazarlo por tu backend o proveedor corporativo cuando lo necesites.
   */
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';

  search(query: string): Observable<MapaGeoSearchResult[]> {
    const trimmed = (query || '').trim();

    if (!trimmed) {
      return of([]);
    }

    const coordinates = this.tryParseCoordinates(trimmed);
    if (coordinates) {
      return of([coordinates]);
    }

    const params = new HttpParams()
      .set('q', trimmed)
      .set('format', 'jsonv2')
      .set('addressdetails', '1')
      .set('limit', '6');

    return this.http.get<NominatimSearchResult[]>(this.endpoint, { params }).pipe(
      map((items) => (Array.isArray(items) ? items : []).map((item, index) => this.toResult(item, index))),
      catchError(() => of([]))
    );
  }

  private toResult(item: NominatimSearchResult, index: number): MapaGeoSearchResult {
    const lat = Number(item.lat);
    const lng = Number(item.lon);

    return {
      id: `geo-${item.place_id ?? index}`,
      label: item.display_name || 'Ubicación encontrada',
      subtitle: this.buildSubtitle(item),
      lat,
      lng,
      bounds: this.parseBounds(item.boundingbox),
      source: 'geocoder',
    };
  }

  private buildSubtitle(item: NominatimSearchResult): string | null {
    const parts = [item.type, item.class].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  private parseBounds(raw?: [string, string, string, string] | string[] | undefined): MapaGeoSearchBounds | null {
    if (!Array.isArray(raw) || raw.length < 4) {
      return null;
    }

    const south = Number(raw[0]);
    const north = Number(raw[1]);
    const west = Number(raw[2]);
    const east = Number(raw[3]);

    if (![south, north, west, east].every((value) => Number.isFinite(value))) {
      return null;
    }

    return { south, west, north, east };
  }

  private tryParseCoordinates(value: string): MapaGeoSearchResult | null {
    const normalized = value.trim();

    const fromAtPattern = normalized.match(/@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
    if (fromAtPattern) {
      return this.buildCoordinateResult(Number(fromAtPattern[1]), Number(fromAtPattern[2]));
    }

    const labeledPair = normalized.match(
      /(lat(?:itud)?|y)\s*[:=]?\s*(-?\d+(?:\.\d+)?)\D+(lng|lon(?:gitud)?|x)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i
    );
    if (labeledPair) {
      return this.buildCoordinateResult(Number(labeledPair[2]), Number(labeledPair[4]));
    }

    const commaPair = normalized.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/
    );
    if (commaPair) {
      return this.buildCoordinateResult(Number(commaPair[1]), Number(commaPair[2]));
    }

    const spacePair = normalized.match(
      /^\s*(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/
    );
    if (spacePair) {
      return this.buildCoordinateResult(Number(spacePair[1]), Number(spacePair[2]));
    }

    return null;
  }

  private buildCoordinateResult(first: number, second: number): MapaGeoSearchResult | null {
    let lat = first;
    let lng = second;

    if (!this.isValidLat(lat) || !this.isValidLng(lng)) {
      if (this.isValidLat(second) && this.isValidLng(first)) {
        lat = second;
        lng = first;
      } else {
        return null;
      }
    }

    return {
      id: `coord-${lat}-${lng}`,
      label: `Coordenadas ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      subtitle: 'Ubicación ingresada manualmente',
      lat,
      lng,
      bounds: null,
      source: 'coordinates',
    };
  }

  private isValidLat(value: number): boolean {
    return Number.isFinite(value) && value >= -90 && value <= 90;
  }

  private isValidLng(value: number): boolean {
    return Number.isFinite(value) && value >= -180 && value <= 180;
  }
}
