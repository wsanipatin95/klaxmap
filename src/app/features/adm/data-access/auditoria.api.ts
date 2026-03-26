import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
  AuditoriaFormularioFilters,
  AuditoriaFormularioResponse,
  AuditoriaRegistroResponse,
  AuditoriaSupervisorFilters,
  AuditoriaSupervisorResponse,
} from './auditoria.models';

@Injectable({ providedIn: 'root' })
export class AuditoriaApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/auditoria`;

  listarSupervisor(filters: AuditoriaSupervisorFilters = {}) {
    let params = new HttpParams();

    if (filters.q != null && filters.q !== '') params = params.set('q', filters.q);
    if (filters.usuario != null) params = params.set('usuario', filters.usuario);
    if (filters.tabla != null && filters.tabla !== '') params = params.set('tabla', filters.tabla);
    if (filters.operacion != null && filters.operacion !== '') params = params.set('operacion', filters.operacion);
    if (filters.idRegistro != null && filters.idRegistro !== '') params = params.set('idRegistro', filters.idRegistro);
    if (filters.fechaDesde != null && filters.fechaDesde !== '') params = params.set('fechaDesde', filters.fechaDesde);
    if (filters.fechaHasta != null && filters.fechaHasta !== '') params = params.set('fechaHasta', filters.fechaHasta);
    if (filters.page != null) params = params.set('page', filters.page);
    if (filters.size != null) params = params.set('size', filters.size);
    if (filters.all != null) params = params.set('all', filters.all);

    return this.http.get<ApiEnvelope<AuditoriaSupervisorResponse>>(
      `${this.baseUrl}/listar`,
      { params }
    );
  }

  historialRegistro(tabla: string, idRegistro: string | number) {
    const params = new HttpParams()
      .set('tabla', tabla)
      .set('idRegistro', String(idRegistro));

    return this.http.get<ApiEnvelope<AuditoriaRegistroResponse>>(
      `${this.baseUrl}/registro`,
      { params }
    );
  }

  historialFormulario(filters: AuditoriaFormularioFilters) {
    let params = new HttpParams().set('tabla', filters.tabla);

    if (filters.q != null && filters.q !== '') params = params.set('q', filters.q);
    if (filters.operacion != null && filters.operacion !== '') params = params.set('operacion', filters.operacion);
    if (filters.fechaDesde != null && filters.fechaDesde !== '') params = params.set('fechaDesde', filters.fechaDesde);
    if (filters.fechaHasta != null && filters.fechaHasta !== '') params = params.set('fechaHasta', filters.fechaHasta);
    if (filters.page != null) params = params.set('page', filters.page);
    if (filters.size != null) params = params.set('size', filters.size);
    if (filters.all != null) params = params.set('all', filters.all);

    return this.http.get<ApiEnvelope<AuditoriaFormularioResponse>>(
      `${this.baseUrl}/formulario`,
      { params }
    );
  }
}