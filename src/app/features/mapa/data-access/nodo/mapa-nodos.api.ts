import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
  MapaNodo,
  MapaNodoSaveRequest,
  MapaPatchRequest,
  PagedResponse,
  ListOrPageOptions,
} from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaNodosApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/nodo`;

  listar(params: ListOrPageOptions = {}) {
    let httpParams = new HttpParams();
    if (params.q != null) httpParams = httpParams.set('q', params.q);
    if (params.page != null) httpParams = httpParams.set('page', params.page);
    if (params.size != null) httpParams = httpParams.set('size', params.size);
    if (params.all != null) httpParams = httpParams.set('all', params.all);
    if (params.includeDeleted != null)
      httpParams = httpParams.set('includeDeleted', params.includeDeleted);
    if (params.onlyDeleted != null) httpParams = httpParams.set('onlyDeleted', params.onlyDeleted);

    return this.http.get<ApiEnvelope<PagedResponse<MapaNodo> | MapaNodo[]>>(
      `${this.baseUrl}/listar`,
      { params: httpParams }
    );
  }

  crear(payload: MapaNodoSaveRequest) {
    return this.http.post<ApiEnvelope<MapaNodo>>(`${this.baseUrl}/crear`, payload);
  }

  editar(payload: MapaPatchRequest) {
    return this.http.patch<ApiEnvelope<MapaNodo>>(`${this.baseUrl}/editar`, payload);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<MapaNodo>>(`${this.baseUrl}/${id}`);
  }

  restaurar(id: number) {
    return this.http.patch<ApiEnvelope<MapaNodo>>(`${this.baseUrl}/${id}/restaurar`, {});
  }
}
