import { inject, Injectable } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

import { CentrosApi } from './centros.api';
import type {
    CentroDto,
    CentroCrearRequest,
    CentroCrearResponse,
    CentroEditarRequest,
} from './centros.models';

@Injectable({ providedIn: 'root' })
export class CentrosRepository {
    private api = inject(CentrosApi);

    listar() {
        return this.api.listar().pipe(
            map((r) => unwrapOrThrow<{ items: CentroDto[] }>(r).items ?? [])
        );
    }

    obtener(id: number) {
        return this.api.obtener(id).pipe(
            map((r) => unwrapOrThrow<{ item: CentroDto }>(r).item)
        );
    }

    crear(payload: CentroCrearRequest) {
        return this.api.crear(payload).pipe(
            map((r) => unwrapWithMsg<CentroCrearResponse>(r))
        );
    }

    editar(payload: CentroEditarRequest) {
        return this.api.editar(payload).pipe(
            map((r) => unwrapWithMsg<{ id: number }>(r))
        );
    }
}

// re-export tipos
export type { CentroDto, CentroCrearRequest, CentroEditarRequest } from './centros.models';
