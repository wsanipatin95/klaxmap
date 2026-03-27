import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { buildListParams, Paged, ListQuery } from './importacion.shared';
import {
  ArticuloProspecto,
  ArticuloProspectoGuardarRequest,
  ArticuloProspectoEditarRequest,
  ArticuloImagen,
  ArticuloImagenGuardarRequest,
  ArticuloAtributo,
  ArticuloAtributoGuardarRequest,
  ArticuloHomologacion,
  ArticuloHomologacionGuardarRequest,
  ArticuloClasificacion,
  ArticuloClasificacionGuardarRequest,
} from './articulos.models';

@Injectable({ providedIn: 'root' })
export class ImportacionArticulosApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/imp`;

  listar(query: ListQuery) {
    return this.http.get<ApiEnvelope<Paged<ArticuloProspecto>>>(`${this.baseUrl}/proveedor-articulo-prospectos`, {
      params: buildListParams(query),
    });
  }

  crear(payload: ArticuloProspectoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorArticuloProspecto: number }>>(`${this.baseUrl}/proveedor-articulo-prospectos`, payload);
  }

  editar(payload: ArticuloProspectoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpProveedorArticuloProspecto: number }>>(`${this.baseUrl}/proveedor-articulo-prospectos`, payload);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpProveedorArticuloProspecto: number }>>(`${this.baseUrl}/proveedor-articulo-prospectos/${id}`);
  }

  listarImagenes(idImpProveedorArticuloProspectoFk: number) {
    return this.http.get<ApiEnvelope<Paged<ArticuloImagen>>>(`${this.baseUrl}/proveedor-articulo-prospecto-imagenes`, {
      params: buildListParams({ all: true, extra: { idImpProveedorArticuloProspectoFk } }),
    });
  }

  crearImagen(payload: ArticuloImagenGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorArticuloProspectoImagen: number }>>(`${this.baseUrl}/proveedor-articulo-prospecto-imagenes`, payload);
  }

  editarImagen(payload: { idImpProveedorArticuloProspectoImagen: number; cambios: Partial<ArticuloImagenGuardarRequest> }) {
    return this.http.patch<ApiEnvelope<{ idImpProveedorArticuloProspectoImagen: number }>>(`${this.baseUrl}/proveedor-articulo-prospecto-imagenes`, payload);
  }

  eliminarImagen(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpProveedorArticuloProspectoImagen: number }>>(`${this.baseUrl}/proveedor-articulo-prospecto-imagenes/${id}`);
  }

  listarAtributos(idImpProveedorArticuloProspectoFk: number) {
    return this.http.get<ApiEnvelope<Paged<ArticuloAtributo>>>(`${this.baseUrl}/proveedor-articulo-prospecto-atributos`, {
      params: buildListParams({ all: true, extra: { idImpProveedorArticuloProspectoFk } }),
    });
  }

  crearAtributo(payload: ArticuloAtributoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorArticuloProspectoAtributo: number }>>(`${this.baseUrl}/proveedor-articulo-prospecto-atributos`, payload);
  }

  editarAtributo(payload: { idImpProveedorArticuloProspectoAtributo: number; cambios: Partial<ArticuloAtributoGuardarRequest> }) {
    return this.http.patch<ApiEnvelope<{ idImpProveedorArticuloProspectoAtributo: number }>>(`${this.baseUrl}/proveedor-articulo-prospecto-atributos`, payload);
  }

  eliminarAtributo(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpProveedorArticuloProspectoAtributo: number }>>(`${this.baseUrl}/proveedor-articulo-prospecto-atributos/${id}`);
  }

  listarHomologaciones(idImpProveedorArticuloProspectoFk: number) {
    return this.http.get<ApiEnvelope<Paged<ArticuloHomologacion>>>(`${this.baseUrl}/proveedor-articulo-homologaciones`, {
      params: buildListParams({ all: true, extra: { idImpProveedorArticuloProspectoFk } }),
    });
  }

  crearHomologacion(payload: ArticuloHomologacionGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpProveedorArticuloHomologacion: number }>>(`${this.baseUrl}/proveedor-articulo-homologaciones`, payload);
  }

  aprobarHomologacion(payload: { idImpProveedorArticuloHomologacion: number; idActInventarioFk?: number | null; idActInventarioUnidadFk?: number | null; idImpCodigoArancelarioFk?: number | null; clasificacionConfirmada?: boolean | null; observacion?: string | null }) {
    return this.http.post<ApiEnvelope<{ idImpProveedorArticuloHomologacion: number }>>(`${this.baseUrl}/proveedor-articulo-homologaciones/aprobar`, payload);
  }

  rechazarHomologacion(payload: { idImpProveedorArticuloHomologacion: number; observacion?: string | null }) {
    return this.http.post<ApiEnvelope<{ idImpProveedorArticuloHomologacion: number }>>(`${this.baseUrl}/proveedor-articulo-homologaciones/rechazar`, payload);
  }

  listarClasificaciones(idImpProveedorArticuloProspectoFk: number) {
    return this.http.get<ApiEnvelope<Paged<ArticuloClasificacion>>>(`${this.baseUrl}/articulo-clasificaciones`, {
      params: buildListParams({ all: true, extra: { idImpProveedorArticuloProspectoFk, soloActivos: true } }),
    });
  }

  crearClasificacion(payload: ArticuloClasificacionGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpArticuloClasificacion: number }>>(`${this.baseUrl}/articulo-clasificaciones`, payload);
  }

  confirmarClasificacion(payload: { idImpArticuloClasificacion: number; observacion?: string | null }) {
    return this.http.post<ApiEnvelope<{ idImpArticuloClasificacion: number }>>(`${this.baseUrl}/articulo-clasificaciones/confirmar`, payload);
  }
}
