import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';

import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { EmpresaCreateRequest, EmpresaDto, EmpresaEditRequest, Paged } from './org.models';
import { SKIP_TENANT } from 'src/app/core/http/http-context.tokens';

const GLOBAL = new HttpContext().set(SKIP_TENANT, true);

@Injectable({ providedIn: 'root' })
export class OrgApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);

  listarEmpresas(params: { idOrganizacion: number; page?: number; size?: number; all?: boolean }) {
    const httpParams = new HttpParams()
      .set('idOrganizacion', params.idOrganizacion)
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 20)
      .set('all', params.all ?? false);

    return this.http.get<ApiEnvelope<Paged<EmpresaDto>>>(
      `${this.env.apiBaseUrl}/api/erp/empresa/listar`,
      { params: httpParams, context: GLOBAL }
    );
  }

  registrarEmpresa(payload: EmpresaCreateRequest) {
    return this.http.post<ApiEnvelope<{ id: string }>>(
      `${this.env.apiBaseUrl}/api/erp/empresa/registro`,
      payload,
      { context: GLOBAL }
    );
  }

  editarEmpresa(payload: EmpresaEditRequest) {
    return this.http.patch<ApiEnvelope<{ id: string }>>(
      `${this.env.apiBaseUrl}/api/erp/empresa/editar`,
      payload,
      { context: GLOBAL }
    );
  }
}
