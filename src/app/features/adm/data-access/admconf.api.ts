import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

import type { AdmConfModuloDto, AdmConfItemDto, AdmConfSaveRequest } from './admconf.models';

@Injectable({ providedIn: 'root' })
export class AdmConfApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listarModulos() {
        return this.http.get<ApiEnvelope<{ items: AdmConfModuloDto[] }>>(
            `${this.env.apiBaseUrl}/api/erp/adm/conf-modulo/listar`
        );
    }

    listarPorModuloId(id: number) {
        const params = new HttpParams().set('id', id);
        return this.http.get<ApiEnvelope<{ items: AdmConfItemDto[] }>>(
            `${this.env.apiBaseUrl}/api/erp/adm/configuracion/por-modulo-id`,
            { params }
        );
    }

    guardar(payload: AdmConfSaveRequest) {
        // aquí no hace falta items wrapper
        return this.http.patch<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/adm/configuracion/guardar`,
            payload
        );
    }
}
