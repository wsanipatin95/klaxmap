import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { buildListParams, Paged } from './importacion.shared';
import {
  OfertaProveedor,
  OfertaProveedorGuardarRequest,
  OfertaProveedorVersionarRequest,
  OfertaProveedorEditarRequest,
  OfertaProveedorDocumento,
} from './ofertas.models';

@Injectable({ providedIn: 'root' })
export class ImportacionOfertasApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/imp`;

  listar(q = '', page = 0, size = 20, all = false) {
    return this.http.get<ApiEnvelope<Paged<OfertaProveedor>>>(`${this.baseUrl}/ofertas-proveedor`, {
      params: buildListParams({ q, page, size, all }),
    });
  }

  crear(payload: OfertaProveedorGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpOfertaProveedor: number }>>(`${this.baseUrl}/ofertas-proveedor`, payload);
  }

  versionar(payload: OfertaProveedorVersionarRequest) {
    return this.http.post<ApiEnvelope<{ idImpOfertaProveedor: number }>>(`${this.baseUrl}/ofertas-proveedor/versionar`, payload);
  }

  editar(payload: OfertaProveedorEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpOfertaProveedor: number }>>(`${this.baseUrl}/ofertas-proveedor`, payload);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpOfertaProveedor: number }>>(`${this.baseUrl}/ofertas-proveedor/${id}`);
  }

  listarDocumentos(idImpOfertaProveedorFk: number) {
    return this.http.get<ApiEnvelope<Paged<OfertaProveedorDocumento>>>(`${this.baseUrl}/oferta-proveedor-documentos`, {
      params: buildListParams({ all: true, extra: { idImpOfertaProveedorFk } }),
    });
  }

  crearDocumento(payload: Omit<OfertaProveedorDocumento, 'idImpOfertaProveedorDocumento'>) {
    return this.http.post<ApiEnvelope<{ idImpOfertaProveedorDocumento: number }>>(`${this.baseUrl}/oferta-proveedor-documentos`, payload);
  }

  editarDocumento(payload: { idImpOfertaProveedorDocumento: number; cambios: Partial<Omit<OfertaProveedorDocumento, 'idImpOfertaProveedorDocumento'>> }) {
    return this.http.patch<ApiEnvelope<{ idImpOfertaProveedorDocumento: number }>>(`${this.baseUrl}/oferta-proveedor-documentos`, payload);
  }

  eliminarDocumento(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpOfertaProveedorDocumento: number }>>(`${this.baseUrl}/oferta-proveedor-documentos/${id}`);
  }
}
