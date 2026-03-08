import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import type { CajaChicaCrearRequest, CajaChicaEditarRequest, CajaChicaDto } from './caja-chica.models';
import { CajaChicaApi } from './caja-chica.api';

@Injectable({ providedIn: 'root' })
export class CajaChicaRepository {
    private api = inject(CajaChicaApi);

    listar(cen: number) {
        return this.api.listar(cen).pipe(
            map((r) => unwrapOrThrow<{ items: CajaChicaDto[] }>(r).items ?? [])
        );
    }

    obtener(id: number) {
        return this.api.obtener(id).pipe(
            map((r) => unwrapOrThrow<{ item: CajaChicaDto }>(r).item ?? null)
        );
    }

    crear(body: CajaChicaCrearRequest) {
        return this.api.crear(body).pipe(map((r) => unwrapWithMsg<any>(r)));
    }

    editar(body: CajaChicaEditarRequest) {
        return this.api.editar(body).pipe(map((r) => unwrapWithMsg<any>(r)));
    }

    eliminar(id: number) {
        return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg<any>(r)));
    }
}
