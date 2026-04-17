import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
  MapaElemento,
  MapaElementoSaveRequest,
  MapaPatchRequest,
  MapaElementoGeometriaRequest,
  PagedResponse,
} from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaElementosApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/elemento`;

  listar(params: {
    q?: string;
    idRedNodoFk?: number | null;
    idGeoTipoElementoFk?: number | null;
    visible?: boolean | null;
    page?: number;
    size?: number;
    all?: boolean;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  } = {}) {
    let httpParams = new HttpParams();

    if (params.q != null) httpParams = httpParams.set('q', params.q);
    if (params.idRedNodoFk != null) httpParams = httpParams.set('idRedNodoFk', params.idRedNodoFk);
    if (params.idGeoTipoElementoFk != null)
      httpParams = httpParams.set('idGeoTipoElementoFk', params.idGeoTipoElementoFk);
    if (params.visible != null) httpParams = httpParams.set('visible', params.visible);
    if (params.page != null) httpParams = httpParams.set('page', params.page);
    if (params.size != null) httpParams = httpParams.set('size', params.size);
    if (params.all != null) httpParams = httpParams.set('all', params.all);
    if (params.includeDeleted != null)
      httpParams = httpParams.set('includeDeleted', params.includeDeleted);
    if (params.onlyDeleted != null) httpParams = httpParams.set('onlyDeleted', params.onlyDeleted);

    return this.http.get<ApiEnvelope<PagedResponse<MapaElemento> | MapaElemento[]>>(
      `${this.baseUrl}/listar`,
      { params: httpParams }
    );
  }

  crear(payload: MapaElementoSaveRequest) {
    return this.http.post<ApiEnvelope<MapaElemento>>(`${this.baseUrl}/crear`, payload);
  }

  editar(payload: MapaPatchRequest) {
    return this.http.patch<ApiEnvelope<MapaElemento>>(`${this.baseUrl}/editar`, payload);
  }

  editarGeometria(payload: MapaElementoGeometriaRequest) {
    return this.http.patch<ApiEnvelope<MapaElemento>>(
      `${this.baseUrl}/editar-geometria`,
      payload
    );
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<MapaElemento>>(`${this.baseUrl}/${id}`);
  }

  restaurar(id: number) {
    return this.http.patch<ApiEnvelope<MapaElemento>>(`${this.baseUrl}/${id}/restaurar`, {});
  }
}
