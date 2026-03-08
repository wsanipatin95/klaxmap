import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { CajaChicaCrearRequest, CajaChicaEditarRequest, CajaChicaDto } from './caja-chica.models';

@Injectable({ providedIn: 'root' })
export class CajaChicaApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listar(cen: number) {
        return this.http.get<ApiEnvelope<{ items: CajaChicaDto[] }>>(
            `${this.env.apiBaseUrl}/api/erp/caja-chica/listar`,
            { params: { cen } as any }
        );
    }

    obtener(id: number) {
        return this.http.get<ApiEnvelope<{ item: CajaChicaDto }>>(
            `${this.env.apiBaseUrl}/api/erp/caja-chica/obtener`,
            { params: { id } as any }
        );
    }

    crear(body: CajaChicaCrearRequest) {
        return this.http.post<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/caja-chica/crear`, body);
    }

    editar(body: CajaChicaEditarRequest) {
        return this.http.patch<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/caja-chica/editar`, body);
    }

    eliminar(id: number) {
        return this.http.delete<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/caja-chica/eliminar`,
            { params: { id } as any }
        );
    }
}
