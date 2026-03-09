import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { MapaImportLoteResumen, PagedResponse } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaImportLotesApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/importar/lote`;

  listar(params: {
    q?: string;
    page?: number;
    size?: number;
    all?: boolean;
  } = {}) {
    let httpParams = new HttpParams();
    if (params.q != null) httpParams = httpParams.set('q', params.q);
    if (params.page != null) httpParams = httpParams.set('page', params.page);
    if (params.size != null) httpParams = httpParams.set('size', params.size);
    if (params.all != null) httpParams = httpParams.set('all', params.all);

    return this.http.get<ApiEnvelope<PagedResponse<MapaImportLoteResumen> | MapaImportLoteResumen[]>>(
      `${this.baseUrl}/listar`,
      { params: httpParams }
    );
  }
}