import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { ArchivoApi } from './archivo.api';
import type {
    ArchivoListItemDto,
    ArchivoUploadUnicoData,
    ArchivoUploadMultipleData,
    ArchivoModo,
} from './archivo.models';

@Injectable({ providedIn: 'root' })
export class ArchivoRepository {
    private api = inject(ArchivoApi);

    uploadUnico(params: {
        modulo: string;
        tabla: string;
        campo_tabla: string;
        id_tabla: number;
        file: File;
    }) {
        return this.api.uploadUnico(params).pipe(
            map((r) => unwrapWithMsg<ArchivoUploadUnicoData>(r)),
            catchError((err) => throwError(() => err))
        );
    }

    uploadMultiple(params: {
        modulo: string;
        tabla: string;
        campo_tabla: string;
        id_tabla: number;
        files: File[];
    }) {
        return this.api.uploadMultiple(params).pipe(
            map((r) => unwrapWithMsg<ArchivoUploadMultipleData>(r)),
            catchError((err) => throwError(() => err))
        );
    }


    list(params: { tabla: string; campo_tabla: string; id_tabla: number }) {
        return this.api.list(params).pipe(
            map((r) => unwrapOrThrow(r).items as ArchivoListItemDto[]),
            catchError((err) => throwError(() => err))
        );
    }

    downloadById(idArchivo: number) {
        return this.api.downloadById(idArchivo);
    }

    deleteById(idArchivo: number, force = false) {
        return this.api.deleteById(idArchivo, force).pipe(
            map((r) => unwrapWithMsg(r)),
            catchError((err) => throwError(() => err))
        );
    }
}
