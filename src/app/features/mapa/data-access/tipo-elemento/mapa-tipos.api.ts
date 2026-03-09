import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
  MapaPatchRequest,
  PagedResponse,
  ListOrPageOptions,
} from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaTiposApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/tipo-elemento`;

  listar(params: ListOrPageOptions = {}) {
    let httpParams = new HttpParams();
    if (params.q != null) httpParams = httpParams.set('q', params.q);
    if (params.page != null) httpParams = httpParams.set('page', params.page);
    if (params.size != null) httpParams = httpParams.set('size', params.size);
    if (params.all != null) httpParams = httpParams.set('all', params.all);

    return this.http.get<ApiEnvelope<PagedResponse<MapaTipoElemento> | MapaTipoElemento[]>>(
      `${this.baseUrl}/listar`,
      { params: httpParams }
    );
  }

  crear(payload: MapaTipoElementoSaveRequest) {
    return this.http.post<ApiEnvelope<MapaTipoElemento>>(`${this.baseUrl}/crear`, payload);
  }

  editar(payload: MapaPatchRequest) {
    return this.http.patch<ApiEnvelope<MapaTipoElemento>>(`${this.baseUrl}/editar`, payload);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<{ id: number }>>(`${this.baseUrl}/${id}`);
  }
}