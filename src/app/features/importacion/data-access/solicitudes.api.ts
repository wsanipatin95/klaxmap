import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { buildListParams, Paged } from './importacion.shared';
import {
  SolicitudGeneral,
  SolicitudGeneralGuardarRequest,
  SolicitudGeneralEditarRequest,
  SolicitudAgregarOfertaRequest,
  SolicitudSeleccionDetalleRequest,
  SolicitudCerrarRequest,
  SolicitudReabrirRequest,
  SolicitudCrearVersionRequest,
  WorkflowValidacionCierre,
  WorkflowResumenFicha,
  WorkflowVersionResultado,
  WorkflowHistorialVersion,
} from './solicitudes.models';

@Injectable({ providedIn: 'root' })
export class ImportacionSolicitudesApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/imp`;
  private workflowUrl = `${this.env.apiBaseUrl}/api/erp/klax/imp/workflow`;

  listar(q = '', page = 0, size = 20, all = false) {
    return this.http.get<ApiEnvelope<Paged<SolicitudGeneral>>>(`${this.baseUrl}/solicitudes-generales`, {
      params: buildListParams({ q, page, size, all }),
    });
  }

  crear(payload: SolicitudGeneralGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idImpSolicitudGeneral: number }>>(`${this.baseUrl}/solicitudes-generales`, payload);
  }

  editar(payload: SolicitudGeneralEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idImpSolicitudGeneral: number }>>(`${this.baseUrl}/solicitudes-generales`, payload);
  }

  eliminar(id: number) {
    return this.http.delete<ApiEnvelope<{ idImpSolicitudGeneral: number }>>(`${this.baseUrl}/solicitudes-generales/${id}`);
  }

  agregarOferta(payload: SolicitudAgregarOfertaRequest) {
    return this.http.post<ApiEnvelope<unknown>>(`${this.workflowUrl}/solicitudes-generales/agregar-oferta`, payload);
  }

  seleccionarDetalle(payload: SolicitudSeleccionDetalleRequest) {
    return this.http.post<ApiEnvelope<unknown>>(`${this.workflowUrl}/solicitudes-generales/seleccionar-detalle`, payload);
  }

  cerrar(payload: SolicitudCerrarRequest) {
    return this.http.post<ApiEnvelope<unknown>>(`${this.workflowUrl}/solicitudes-generales/cerrar`, payload);
  }

  reabrir(payload: SolicitudReabrirRequest) {
    return this.http.post<ApiEnvelope<unknown>>(`${this.workflowUrl}/solicitudes-generales/reabrir`, payload);
  }

  resumen(id: number) {
    return this.http.get<ApiEnvelope<Record<string, unknown>>>(`${this.workflowUrl}/solicitudes-generales/${id}/resumen`);
  }

  resumenDetallado(id: number) {
    return this.http.get<ApiEnvelope<WorkflowValidacionCierre>>(`${this.workflowUrl}/solicitudes-generales/${id}/resumen-detallado`);
  }

  validarCierre(id: number) {
    return this.http.get<ApiEnvelope<WorkflowValidacionCierre>>(`${this.workflowUrl}/solicitudes-generales/${id}/validacion-cierre`);
  }

  crearVersion(payload: SolicitudCrearVersionRequest) {
    return this.http.post<ApiEnvelope<WorkflowVersionResultado>>(`${this.workflowUrl}/solicitudes-generales/crear-version`, payload);
  }

  historialVersiones(id: number) {
    return this.http.get<ApiEnvelope<{ versiones: WorkflowHistorialVersion[] }>>(`${this.workflowUrl}/solicitudes-generales/${id}/versiones`);
  }

  resumenFicha(idImpFichaProveedorFinal: number) {
    return this.http.get<ApiEnvelope<WorkflowResumenFicha>>(`${this.workflowUrl}/fichas-proveedor-final/${idImpFichaProveedorFinal}/resumen`);
  }
}
