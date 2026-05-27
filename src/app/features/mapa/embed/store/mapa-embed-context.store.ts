import { computed, Injectable, signal } from '@angular/core';
import type {
  MapaEmbedConfig,
  MapaEmbedContext,
  MapaEmbedExchangeResponse,
  MapaEmbedMode,
} from '../data-access/mapa-embed.models';

@Injectable({ providedIn: 'root' })
export class MapaEmbedContextStore {
  private readonly _context = signal<MapaEmbedContext | null>(null);
  private readonly _config = signal<MapaEmbedConfig | null>(null);
  private readonly _postMessageOrigin = signal<string>('*');

  readonly context = computed(() => this._context());
  readonly config = computed(() => this._config());
  readonly postMessageOrigin = computed(() => this._postMessageOrigin());

  readonly mode = computed<MapaEmbedMode | null>(() => this._context()?.mode ?? null);
  readonly isAdmin = computed(() => this.mode() === 'admin');
  readonly isVendedor = computed(() => this.mode() === 'vendedor');
  readonly isTecnico = computed(() => this.mode() === 'tecnico');

  setPostMessageOrigin(origin: string | null | undefined) {
    const clean = origin?.trim();
    this._postMessageOrigin.set(clean || '*');
  }

  setFromExchange(response: MapaEmbedExchangeResponse) {
    this._context.set(response.embed);
    this._config.set(response.embedConfig);
  }

  patchContext(patch: Partial<MapaEmbedContext>) {
    const current = this._context();
    if (!current) return;
    this._context.set({ ...current, ...patch });
  }

  setConfig(config: MapaEmbedConfig) {
    this._config.set(config);
  }

  hasAction(action: string) {
    const actions = this._config()?.acciones ?? [];
    return actions.includes(action);
  }

  hasPrivilege(key: string) {
    return !!this._config()?.privilegios?.[key];
  }

  clear() {
    this._context.set(null);
    this._config.set(null);
    this._postMessageOrigin.set('*');
  }
}
