import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ENVIRONMENT, AppEnvironment } from 'src/app/core/config/environment.token';
import { ApiResponse } from './importacion.models';

@Injectable({ providedIn: 'root' })
export class ImportacionApi {
  private http = inject(HttpClient);
  private env = inject<AppEnvironment>(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax`;

  paises(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/ciu/paises`, { params });
  }

  monedas(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/gen/monedas`, { params });
  }

  unidades(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/act/inventario-unidades`, { params });
  }

  proveedorProspectos(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospectos`, { params });
  }

  crearProveedorProspecto(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospectos`, payload);
  }

  editarProveedorProspecto(idImpProveedorProspecto: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospectos`, {
      idImpProveedorProspecto,
      cambios,
    });
  }

  eliminarProveedorProspecto(idImpProveedorProspecto: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospectos/${idImpProveedorProspecto}`);
  }

  proveedorProspectoContactos(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospecto-contactos`, { params });
  }

  crearProveedorProspectoContacto(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospecto-contactos`, payload);
  }

  editarProveedorProspectoContacto(idImpProveedorProspectoContacto: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospecto-contactos`, {
      idImpProveedorProspectoContacto,
      cambios,
    });
  }

  eliminarProveedorProspectoContacto(idImpProveedorProspectoContacto: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/proveedor-prospecto-contactos/${idImpProveedorProspectoContacto}`);
  }

  proveedorArticulosProspecto(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/proveedor-articulo-prospectos`, { params });
  }

  crearProveedorArticuloProspecto(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/proveedor-articulo-prospectos`, payload);
  }

  editarProveedorArticuloProspecto(idImpProveedorArticuloProspecto: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/proveedor-articulo-prospectos`, {
      idImpProveedorArticuloProspecto,
      cambios,
    });
  }

  eliminarProveedorArticuloProspecto(idImpProveedorArticuloProspecto: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/proveedor-articulo-prospectos/${idImpProveedorArticuloProspecto}`);
  }

  ofertas(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor`, { params });
  }

  crearOferta(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor`, payload);
  }

  editarOferta(idImpOfertaProveedor: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor`, {
      idImpOfertaProveedor,
      cambios,
    });
  }

  eliminarOferta(idImpOfertaProveedor: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor/${idImpOfertaProveedor}`);
  }

  ofertaDetalles(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor-detalle`, { params });
  }

  crearOfertaDetalle(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor-detalle`, payload);
  }

  editarOfertaDetalle(idImpOfertaProveedorDetalle: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor-detalle`, {
      idImpOfertaProveedorDetalle,
      cambios,
    });
  }

  eliminarOfertaDetalle(idImpOfertaProveedorDetalle: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor-detalle/${idImpOfertaProveedorDetalle}`);
  }

  solicitudes(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales`, { params });
  }

  crearSolicitud(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales`, payload);
  }

  editarSolicitud(idImpSolicitudGeneral: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales`, {
      idImpSolicitudGeneral,
      cambios,
    });
  }

  eliminarSolicitud(idImpSolicitudGeneral: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales/${idImpSolicitudGeneral}`);
  }

  solicitudDetalles(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales-detalle`, { params });
  }

  crearSolicitudDetalle(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales-detalle`, payload);
  }

  editarSolicitudDetalle(idImpSolicitudGeneralDetalle: number, cambios: Record<string, any>) {
    return this.http.patch<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales-detalle`, {
      idImpSolicitudGeneralDetalle,
      cambios,
    });
  }

  eliminarSolicitudDetalle(idImpSolicitudGeneralDetalle: number) {
    return this.http.delete<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales-detalle/${idImpSolicitudGeneralDetalle}`);
  }

  agregarOferta(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/workflow/solicitudes-generales/agregar-oferta`, payload);
  }

  seleccionarDetalle(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/workflow/solicitudes-generales/seleccionar-detalle`, payload);
  }

  cerrarSolicitud(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/workflow/solicitudes-generales/cerrar`, payload);
  }

  reabrirSolicitud(payload: any) {
    return this.http.post<ApiResponse>(`${this.baseUrl}/imp/workflow/solicitudes-generales/reabrir`, payload);
  }

  resumenSolicitud(idImpSolicitudGeneralFk: number) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/workflow/solicitudes-generales/${idImpSolicitudGeneralFk}/resumen`);
  }
}
