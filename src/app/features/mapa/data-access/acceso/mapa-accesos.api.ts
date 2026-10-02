import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { MapaAcceso } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaAccesosApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/acceso`;

  listar(q?: string | null) {
    let params = new HttpParams();
    if (q && q.trim()) params = params.set('q', q.trim());
    return this.http.get<ApiEnvelope<MapaAcceso[]>>(`${this.baseUrl}/listar`, { params });
  }

  detalle(id: number) {
    return this.http.get<ApiEnvelope<MapaAcceso>>(`${this.baseUrl}/${id}`);
  }

  guardar(req: MapaAcceso) {
    return this.http.post<ApiEnvelope<MapaAcceso>>(`${this.baseUrl}/guardar`, req);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<unknown>>(`${this.baseUrl}/${id}`);
  }
}
