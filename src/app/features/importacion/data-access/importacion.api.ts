import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ENVIRONMENT, AppEnvironment } from 'src/app/core/config/environment.token';
import { ApiResponse } from './importacion.models';

@Injectable({ providedIn: 'root' })
export class ImportacionApi {
  private readonly http = inject(HttpClient);
  private readonly env = inject<AppEnvironment>(ENVIRONMENT);
  private readonly baseUrl = `${this.env.apiBaseUrl}/api/erp/klax`;

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

  proveedorArticulosProspecto(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/proveedor-articulo-prospectos`, { params });
  }

  ofertas(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/ofertas-proveedor`, { params });
  }

  solicitudes(params: Record<string, any>) {
    return this.http.get<ApiResponse>(`${this.baseUrl}/imp/solicitudes-generales`, { params });
  }

  resumenSolicitud(idImpSolicitudGeneralFk: number) {
    return this.http.get<ApiResponse>(
      `${this.baseUrl}/imp/workflow/solicitudes-generales/${idImpSolicitudGeneralFk}/resumen`
    );
  }
}
