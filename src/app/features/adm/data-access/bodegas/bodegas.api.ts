import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { BodegaCrearRequest, BodegaDto, BodegaEditarRequest } from './bodegas.models';

@Injectable({ providedIn: 'root' })
export class BodegasApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listarPorCentro(centro: number) {
        const params = new HttpParams().set('centro', centro);
        return this.http.get<ApiEnvelope<{ items: BodegaDto[] }>>(
            `${this.env.apiBaseUrl}/api/erp/bodegas/listar`,
            { params }
        );
    }

    obtener(id: number) {
        const params = new HttpParams().set('id', id);
        return this.http.get<ApiEnvelope<{ item: BodegaDto }>>(
            `${this.env.apiBaseUrl}/api/erp/bodegas/obtener`,
            { params }
        );
    }

    crear(req: BodegaCrearRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/bodegas/crear`,
            req
        );
    }

    editar(req: BodegaEditarRequest) {
        return this.http.patch<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/bodegas/editar`,
            req
        );
    }

    eliminar(id: number) {
        const params = new HttpParams().set('id', id);
        return this.http.patch<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/bodegas/eliminar`,
            null,
            { params }
        );
    }

    restaurar(id: number) {
        const params = new HttpParams().set('id', id);
        return this.http.patch<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/bodegas/restaurar`,
            null,
            { params }
        );
    }
}
