import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { MapaExportRequest } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaExportApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/exportar`;

  exportarKml(payload: MapaExportRequest) {
    return this.http.post(`${this.baseUrl}/kml`, payload, {
      responseType: 'blob',
    });
  }
}