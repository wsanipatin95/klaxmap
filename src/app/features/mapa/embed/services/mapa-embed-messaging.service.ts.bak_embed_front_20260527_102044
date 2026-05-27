import { Injectable, inject } from '@angular/core';
import type { MapaElemento } from '../../data-access/mapa.models';
import type { MapaEmbedContext, MapaEmbedMode, MapaElementoCercano } from '../data-access/mapa-embed.models';
import { MapaEmbedContextStore } from '../store/mapa-embed-context.store';

export type KlaxMapMessageType =
  | 'KLAX_MAP_READY'
  | 'KLAX_MAP_ERROR'
  | 'KLAX_MAP_CANCEL'
  | 'KLAX_MAP_ELEMENT_SELECTED'
  | 'KLAX_MAP_ELEMENT_VIEWED'
  | 'KLAX_MAP_BOX_SELECTED'
  | 'KLAX_MAP_BOX_CREATED'
  | 'KLAX_MAP_FIBER_CREATED'
  | 'KLAX_MAP_CREATE_DRAFT_CHANGED';

@Injectable({ providedIn: 'root' })
export class MapaEmbedMessagingService {
  private readonly store = inject(MapaEmbedContextStore);

  post(type: KlaxMapMessageType, payload: unknown = null) {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;

    window.parent.postMessage(
      {
        type,
        payload,
        timestamp: new Date().toISOString(),
      },
      this.store.postMessageOrigin() || '*'
    );
  }

  ready(mode: MapaEmbedMode, context: MapaEmbedContext | null) {
    this.post('KLAX_MAP_READY', { mode, context });
  }

  error(message: string, detail?: unknown) {
    this.post('KLAX_MAP_ERROR', { message, detail });
  }

  cancel() {
    this.post('KLAX_MAP_CANCEL', {});
  }

  elementSelected(item: MapaElementoCercano) {
    this.post('KLAX_MAP_ELEMENT_SELECTED', item);
  }

  elementViewed(item: MapaElementoCercano) {
    this.post('KLAX_MAP_ELEMENT_VIEWED', item);
  }

  boxSelected(item: MapaElementoCercano) {
    this.post('KLAX_MAP_BOX_SELECTED', item);
  }

  boxCreated(item: MapaElemento) {
    this.post('KLAX_MAP_BOX_CREATED', item);
  }

  fiberCreated(item: MapaElemento) {
    this.post('KLAX_MAP_FIBER_CREATED', item);
  }
}
