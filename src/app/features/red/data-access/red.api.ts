import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { RedIndicador } from './red.models';

@Injectable({ providedIn: 'root' })
export class RedApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/red`;

  indicadores() {
    return this.http.get<ApiEnvelope<RedIndicador[]>>(`${this.baseUrl}/indicadores`);
  }
}
