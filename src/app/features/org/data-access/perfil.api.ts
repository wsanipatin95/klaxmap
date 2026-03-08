import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { PerfilDto, PerfilCreateRequest, PerfilEditRequest } from './perfil.models'
import { PerfilPrivilegiosArbolResponse, PerfilPrivilegiosGuardarRequest } from './perfil.models';

@Injectable({ providedIn: 'root' })
export class PerfilApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);

  listar() {
    return this.http.get<ApiEnvelope<{ items: PerfilDto[] }>>(
      `${this.env.apiBaseUrl}/api/erp/perfil/listar`
    );
  }

  crear(payload: PerfilCreateRequest) {
    return this.http.post<ApiEnvelope<{ idSegPerfil: number }>>(
      `${this.env.apiBaseUrl}/api/erp/perfil/crear`,
      payload
    );
  }

  editar(payload: PerfilEditRequest) {
    return this.http.patch<ApiEnvelope<{ id: number }>>(
      `${this.env.apiBaseUrl}/api/erp/perfil/editar`,
      payload
    );
  }

  eliminar(idSegPerfil: number) {
    const params = new HttpParams().set('idSegPerfil', idSegPerfil);
    return this.http.delete<ApiEnvelope<{ id: number }>>(
      `${this.env.apiBaseUrl}/api/erp/perfil/eliminar`,
      { params }
    );
  }
  arbolPrivilegios(idSegPerfil: number) {
    const params = new HttpParams().set('idSegPerfil', idSegPerfil);
    return this.http.get<ApiEnvelope<PerfilPrivilegiosArbolResponse>>(
      `${this.env.apiBaseUrl}/api/erp/perfil/arbol-privilegios`,
      { params }
    );
  }

  guardarPrivilegios(payload: PerfilPrivilegiosGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idSegPerfil: number; asignados: number }>>(
      `${this.env.apiBaseUrl}/api/erp/perfil/guardar-privilegios`,
      payload
    );
  }
}
