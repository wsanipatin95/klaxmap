import { inject, Injectable } from '@angular/core';
import { tap } from 'rxjs';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { MapaEmbedApi } from '../data-access/mapa-embed.api';
import type { MapaEmbedExchangeResponse, MapaEmbedMode } from '../data-access/mapa-embed.models';
import { MapaEmbedContextStore } from '../store/mapa-embed-context.store';

@Injectable({ providedIn: 'root' })
export class MapaEmbedAuthService {
  private readonly api = inject(MapaEmbedApi);
  private readonly sessionStore = inject(SessionStore);
  private readonly embedStore = inject(MapaEmbedContextStore);

  exchange(code: string, expectedMode?: MapaEmbedMode) {
    return this.api.exchange({ code }).pipe(
      tap((response) => this.applyExchange(response, expectedMode))
    );
  }

  applyExchange(response: MapaEmbedExchangeResponse, expectedMode?: MapaEmbedMode) {
    if (!response?.token) {
      throw new Error('El backend no devolvió token para el embed.');
    }

    if (!response.embed) {
      throw new Error('El backend no devolvió contexto embed.');
    }

    if (expectedMode && response.embed.mode !== expectedMode) {
      throw new Error(`El code pertenece a modo ${response.embed.mode}, pero la ruta espera ${expectedMode}.`);
    }

    const privilegiosEmpresa = response.privilegiosEmpresa ?? [];
    const menusEmpresa = response.menusEmpresa ?? [];

    this.sessionStore.setSession({
      token: response.token,
      user: {
        id: response.usu,
        username: response.usuario,
        catalogo: response.catalogo ?? response.embed.tenant,
        tipo: response.tipo ?? 0,
        organizacion: (response.organizacion as any) ?? [],
      },
      meta: {
        environment: response.environment ?? 'embed',
        contextPath: response.contextPath ?? '/klaxapi',
        company: response.embed.company,
        tenant: response.embed.tenant,
      },
      privilegiosOrg: [],
      privilegiosEmpresa,
      menusEmpresa,
    });

    this.embedStore.setFromExchange(response);
  }
}
