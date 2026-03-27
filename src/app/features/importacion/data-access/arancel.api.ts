import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { buildListParams, Paged } from './importacion.shared';
import { ReglaArancelaria, ReglaArancelariaEditarRequest, RequisitoArancelario, RequisitoArancelarioEditarRequest } from './arancel.models';

@Injectable({ providedIn: 'root' })
export class ImportacionArancelApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/imp`;

  listarReglas(q = '', page = 0, size = 20, all = false) {
    return this.http.get<ApiEnvelope<Paged<ReglaArancelaria>>>(`${this.baseUrl}/reglas-arancelarias`, {
      params: buildListParams({ q, page, size, all }),
    });
  }

  crearRegla(payload: ReglaArancelaria) {
    return this.http.post<ApiEnvelope<{ idImpReglaArancelaria: number }>>(`${this.baseUrl}/reglas-arancelarias`, payload);
  }

  editarRegla(payload: ReglaArancelariaEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpReglaArancelaria: number }>>(`${this.baseUrl}/reglas-arancelarias`, payload);
  }

  eliminarRegla(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpReglaArancelaria: number }>>(`${this.baseUrl}/reglas-arancelarias/${id}`);
  }

  listarRequisitos(idImpReglaArancelariaFk: number) {
    return this.http.get<ApiEnvelope<Paged<RequisitoArancelario>>>(`${this.baseUrl}/requisitos-arancelarios`, {
      params: buildListParams({ all: true, extra: { idImpReglaArancelariaFk } }),
    });
  }

  crearRequisito(payload: RequisitoArancelario) {
    return this.http.post<ApiEnvelope<{ idImpRequisitoArancelario: number }>>(`${this.baseUrl}/requisitos-arancelarios`, payload);
  }

  editarRequisito(payload: RequisitoArancelarioEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpRequisitoArancelario: number }>>(`${this.baseUrl}/requisitos-arancelarios`, payload);
  }

  eliminarRequisito(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpRequisitoArancelario: number }>>(`${this.baseUrl}/requisitos-arancelarios/${id}`);
  }
}
