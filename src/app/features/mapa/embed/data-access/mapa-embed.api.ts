import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { AppEnvironment } from 'src/app/core/config/environment.token';
import { SKIP_AUTH, SKIP_TENANT } from 'src/app/core/http/http-context.tokens';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
  MapaEmbedContext,
  MapaEmbedConfig,
  MapaEmbedExchangeRequest,
  MapaEmbedExchangeResponse,
  MapaEmbedMode,
  MapaElementosCercanosResponse,
  MapaOtaCrearRequest,
  MapaOtaCrearResponse,
} from './mapa-embed.models';

const PUBLIC = new HttpContext().set(SKIP_AUTH, true).set(SKIP_TENANT, true);

@Injectable({ providedIn: 'root' })
export class MapaEmbedApi {
  private readonly http = inject(HttpClient);
  private readonly env = inject<AppEnvironment>(ENVIRONMENT);

  private readonly authBaseUrl = `${this.env.apiBaseUrl}/api/aut/embed`;
  private readonly erpBaseUrl = `${this.env.apiBaseUrl}/api/erp`;

  exchange(payload: MapaEmbedExchangeRequest) {
    return this.http.post<MapaEmbedExchangeResponse>(`${this.authBaseUrl}/exchange`, payload, {
      context: PUBLIC,
    });
  }

  getConfig(modo: MapaEmbedMode, ctx?: MapaEmbedContext | null) {
    const params = new HttpParams().set('modo', modo);
    return this.http.get<ApiEnvelope<MapaEmbedConfig>>(`${this.erpBaseUrl}/mapa/embed/config`, {
      params,
      headers: this.headersFromContext(ctx),
    });
  }

  getElementosCercanos(params: {
    modo: MapaEmbedMode;
    lat: number;
    lng: number;
    radioM?: number | null;
    limit?: number | null;
    ctx?: MapaEmbedContext | null;
  }) {
    let httpParams = new HttpParams()
      .set('modo', params.modo)
      .set('lat', String(params.lat))
      .set('lng', String(params.lng));

    if (params.radioM != null) httpParams = httpParams.set('radioM', String(params.radioM));
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));

    return this.http.get<ApiEnvelope<MapaElementosCercanosResponse>>(
      `${this.erpBaseUrl}/mapa/elemento/cercanos`,
      {
        params: httpParams,
        headers: this.headersFromContext(params.ctx),
      }
    );
  }

  crearOta(payload: MapaOtaCrearRequest, ctx?: MapaEmbedContext | null) {
    return this.http.post<ApiEnvelope<MapaOtaCrearResponse>>(
      `${this.erpBaseUrl}/mapa/ota/crear`,
      payload,
      { headers: this.headersFromContext(ctx) }
    );
  }

  private headersFromContext(ctx?: MapaEmbedContext | null) {
    if (!ctx?.company || !ctx?.tenant) return undefined;

    return new HttpHeaders({
      'X-Company': ctx.company,
      'X-Tenant': ctx.tenant,
    });
  }
}
