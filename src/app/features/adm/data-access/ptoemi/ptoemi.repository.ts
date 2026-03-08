import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { PtoEmiApi } from './ptoemi.api';
import type { PtoEmiCrearRequest, PtoEmiEditarRequest, PtoEmiView } from './ptoemi.models';

@Injectable({ providedIn: 'root' })
export class PtoEmiRepository {
    private api = inject(PtoEmiApi);

    listar(cen: number) {
        return this.api.listar(cen).pipe(
            map((r) => unwrapOrThrow<{ items: PtoEmiView[] }>(r).items ?? [])
        );
    }

    obtener(id: number) {
        return this.api.obtener(id).pipe(
            map((r) => unwrapOrThrow<{ item: PtoEmiView }>(r).item ?? null)
        );
    }

    crear(req: PtoEmiCrearRequest) {
        return this.api.crear(req).pipe(map((r) => unwrapWithMsg<any>(r)));
    }

    editar(req: PtoEmiEditarRequest) {
        return this.api.editar(req).pipe(map((r) => unwrapWithMsg<any>(r)));
    }

    eliminar(id: number) {
        return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg<any>(r)));
    }
}
