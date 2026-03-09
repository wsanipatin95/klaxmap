import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { MapaImportResult } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaImportApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/mapa/importar`;

  importarKml(file: File) {
    const form = new FormData();
    form.append('file', file);

    return this.http.post<ApiEnvelope<MapaImportResult>>(
      `${this.baseUrl}/kml`,
      form
    );
  }
}