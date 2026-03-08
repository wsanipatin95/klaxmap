import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
    ArchivoListData,
    ArchivoUploadUnicoData,
    ArchivoUploadMultipleData,
    ArchivoModo,
} from './archivo.models';

@Injectable({ providedIn: 'root' })
export class ArchivoApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    uploadUnico(params: {
        modulo: string;
        tabla: string;
        campo_tabla: string;
        id_tabla: number;
        file: File;
    }) {
        const form = new FormData();
        form.append('modulo', params.modulo);
        form.append('tabla', params.tabla);
        form.append('campo_tabla', params.campo_tabla);
        form.append('id_tabla', String(params.id_tabla));
        form.append('modo', 'UNICO');
        form.append('file', params.file);

        return this.http.post<ApiEnvelope<ArchivoUploadUnicoData>>(
            `${this.env.apiBaseUrl}/api/erp/archivo/upload`,
            form
        );
    }

    uploadMultiple(params: {
        modulo: string;
        tabla: string;
        campo_tabla: string;
        id_tabla: number;
        files: File[];
    }) {
        const form = new FormData();
        form.append('modulo', params.modulo);
        form.append('tabla', params.tabla);
        form.append('campo_tabla', params.campo_tabla);
        form.append('id_tabla', String(params.id_tabla));
        form.append('modo', 'MULTIPLE');

        for (const f of params.files) form.append('files', f);

        return this.http.post<ApiEnvelope<ArchivoUploadMultipleData>>(
            `${this.env.apiBaseUrl}/api/erp/archivo/upload`,
            form
        );
    }



    list(params: { tabla: string; campo_tabla: string; id_tabla: number }) {
        const httpParams = new HttpParams()
            .set('tabla', params.tabla)
            .set('campo_tabla', params.campo_tabla)
            .set('id_tabla', String(params.id_tabla));

        return this.http.get<ApiEnvelope<ArchivoListData>>(
            `${this.env.apiBaseUrl}/api/erp/archivo/list`,
            { params: httpParams }
        );
    }

    downloadById(idArchivo: number) {
        return this.http.get(
            `${this.env.apiBaseUrl}/api/erp/archivo/download/${idArchivo}`,
            { responseType: 'blob' }
        );
    }

    deleteById(idArchivo: number, force = false) {
        const httpParams = new HttpParams().set('force', String(force));
        return this.http.delete<ApiEnvelope<{ idArchivo: number; force: boolean }>>(
            `${this.env.apiBaseUrl}/api/erp/archivo/${idArchivo}`,
            { params: httpParams }
        );
    }
}
