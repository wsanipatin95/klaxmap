import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

import type {
    CentroDto,
    CentroCrearRequest,
    CentroCrearResponse,
    CentroEditarRequest,
} from './centros.models';

@Injectable({ providedIn: 'root' })
export class CentrosApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listar() {
        // GET /api/erp/centros/listar -> data: { items: [...] }
        return this.http.get<ApiEnvelope<{ items: CentroDto[] }>>(
            `${this.env.apiBaseUrl}/api/erp/centros/listar`
        );
    }

    obtener(id: number) {
        const params = new HttpParams().set('id', id);
        // GET /api/erp/centros/obtener?id= -> data: { item: {...} }
        return this.http.get<ApiEnvelope<{ item: CentroDto }>>(
            `${this.env.apiBaseUrl}/api/erp/centros/obtener`,
            { params }
        );
    }

    crear(payload: CentroCrearRequest) {
        // POST /api/erp/centros/crear -> data: { idAdmCentro, cen, serieDocs }
        return this.http.post<ApiEnvelope<CentroCrearResponse>>(
            `${this.env.apiBaseUrl}/api/erp/centros/crear`,
            payload
        );
    }

    editar(payload: CentroEditarRequest) {
        // PATCH /api/erp/centros/editar -> data: { id: ... }
        return this.http.patch<ApiEnvelope<{ id: number }>>(
            `${this.env.apiBaseUrl}/api/erp/centros/editar`,
            payload
        );
    }
}
