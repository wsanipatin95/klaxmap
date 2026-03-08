import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { PtoEmiCrearRequest, PtoEmiEditarRequest, PtoEmiView } from './ptoemi.models';

type ListarPtoEmiData = { items: PtoEmiView[] };
type ObtenerPtoEmiData = { item: PtoEmiView };

@Injectable({ providedIn: 'root' })
export class PtoEmiApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listar(cen: number) {
        return this.http.get<ApiEnvelope<ListarPtoEmiData>>(
            `${this.env.apiBaseUrl}/api/erp/ptoemi/listar`,
            { params: { cen: String(cen) } }
        );
    }

    obtener(id: number) {
        return this.http.get<ApiEnvelope<ObtenerPtoEmiData>>(
            `${this.env.apiBaseUrl}/api/erp/ptoemi/obtener`,
            { params: { id: String(id) } }
        );
    }

    crear(req: PtoEmiCrearRequest) {
        return this.http.post<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/ptoemi/crear`, req);
    }

    editar(req: PtoEmiEditarRequest) {
        return this.http.patch<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/ptoemi/editar`, req);
    }

    eliminar(id: number) {
        return this.http.delete<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/ptoemi/eliminar`,
            { params: { id: String(id) } }
        );
    }
}
