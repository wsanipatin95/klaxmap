import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

@Injectable({ providedIn: 'root' })
export class AdmConfigFileApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    uploadUnico(params: { modulo: string; parametro: string; file: File }) {
        const form = new FormData();
        form.append('modulo', params.modulo);
        form.append('parametro', params.parametro);
        form.append('modo', 'UNICO');
        form.append('file', params.file);

        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/adm/config/file/upload`,
            form
        );
    }

    downloadByParametro(parametro: string) {
        const httpParams = new HttpParams().set('parametro', parametro);
        return this.http.get(
            `${this.env.apiBaseUrl}/api/erp/adm/config/file/download`,
            { params: httpParams, responseType: 'blob' }
        );
    }
}
