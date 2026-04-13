import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MapaGeocodeService } from '../services/mapa-geocode.service';
import type { MapaGeoSearchResult } from '../models/mapa-geo-search.models';

@Injectable({ providedIn: 'root' })
export class MapaGeoSearchFacade {
  constructor(private readonly geocode: MapaGeocodeService) {}

  readonly value = signal('');
  readonly loading = signal(false);
  readonly hasSearched = signal(false);
  readonly results = signal<MapaGeoSearchResult[]>([]);
  readonly error = signal<string | null>(null);

  async search(
    query: string,
    options?: {
      onClearedEmptyQuery?: () => void;
      onAutoSelectCoordinates?: (result: MapaGeoSearchResult) => void;
    }
  ) {
    const trimmed = (query || '').trim();

    this.value.set(trimmed);
    this.hasSearched.set(false);
    this.results.set([]);
    this.error.set(null);

    if (!trimmed) {
      options?.onClearedEmptyQuery?.();
      return;
    }

    this.loading.set(true);
    this.hasSearched.set(true);

    try {
      const results = await firstValueFrom(this.geocode.search(trimmed));
      this.results.set(results);

      if (!results.length) {
        this.error.set('No se encontraron ubicaciones para la búsqueda ingresada.');
        return;
      }

      if (results.length === 1 && results[0].source === 'coordinates') {
        options?.onAutoSelectCoordinates?.(results[0]);
      }
    } catch {
      this.error.set('No se pudo consultar la ubicación en este momento.');
    } finally {
      this.loading.set(false);
    }
  }

  select(result: MapaGeoSearchResult) {
    this.value.set(result.label);
    this.error.set(null);
  }

  clear(onCleared?: () => void) {
    this.value.set('');
    this.loading.set(false);
    this.hasSearched.set(false);
    this.results.set([]);
    this.error.set(null);
    onCleared?.();
  }
}
