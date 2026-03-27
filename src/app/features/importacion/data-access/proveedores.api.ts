import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { buildListParams, Paged, ListQuery } from './importacion.shared';
import {
  ProveedorProspecto,
  ProveedorProspectoGuardarRequest,
  ProveedorProspectoEditarRequest,
  ProveedorProspectoContacto,
  ProveedorProspectoContactoGuardarRequest,
  ProveedorProspectoContactoEditarRequest,
  ProveedorProspectoDocumento,
  ProveedorProspectoDocumentoGuardarRequest,
  ProveedorProspectoDocumentoEditarRequest,
} from './proveedores.models';

@Injectable({ providedIn: 'root' })
export class ImportacionProveedoresApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/imp`;

  listar(query: ListQuery) {
    return this.http.get<ApiEnvelope<Paged<ProveedorProspecto>>>(`${this.baseUrl}/proveedor-prospectos`, {
      params: buildListParams(query),
    });
  }

  crear(payload: ProveedorProspectoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorProspecto: number }>>(`${this.baseUrl}/proveedor-prospectos`, payload);
  }

  editar(payload: ProveedorProspectoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpProveedorProspecto: number }>>(`${this.baseUrl}/proveedor-prospectos`, payload);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpProveedorProspecto: number }>>(`${this.baseUrl}/proveedor-prospectos/${id}`);
  }

  listarContactos(query: ListQuery) {
    return this.http.get<ApiEnvelope<Paged<ProveedorProspectoContacto>>>(`${this.baseUrl}/proveedor-prospecto-contactos`, {
      params: buildListParams(query),
    });
  }

  crearContacto(payload: ProveedorProspectoContactoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorProspectoContacto: number }>>(`${this.baseUrl}/proveedor-prospecto-contactos`, payload);
  }

  editarContacto(payload: ProveedorProspectoContactoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpProveedorProspectoContacto: number }>>(`${this.baseUrl}/proveedor-prospecto-contactos`, payload);
  }

  eliminarContacto(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpProveedorProspectoContacto: number }>>(`${this.baseUrl}/proveedor-prospecto-contactos/${id}`);
  }

  listarDocumentos(idImpProveedorProspectoFk: number, query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<ProveedorProspectoDocumento>>>(`${this.baseUrl}/proveedor-prospecto-documentos`, {
      params: buildListParams({ ...query, extra: { ...(query.extra ?? {}), idImpProveedorProspectoFk } }),
    });
  }

  crearDocumento(payload: ProveedorProspectoDocumentoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorProspectoDocumento: number }>>(`${this.baseUrl}/proveedor-prospecto-documentos`, payload);
  }

  editarDocumento(payload: ProveedorProspectoDocumentoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpProveedorProspectoDocumento: number }>>(`${this.baseUrl}/proveedor-prospecto-documentos`, payload);
  }

  eliminarDocumento(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpProveedorProspectoDocumento: number }>>(`${this.baseUrl}/proveedor-prospecto-documentos/${id}`);
  }
}
