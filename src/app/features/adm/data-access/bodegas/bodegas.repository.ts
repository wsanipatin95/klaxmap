import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import { BodegasApi } from './bodegas.api';
import type { BodegaCrearRequest, BodegaDto, BodegaEditarRequest, BodegaOption } from './bodegas.models';

@Injectable({ providedIn: 'root' })
export class BodegasRepository {
    private api = inject(BodegasApi);

    listarPorCentro(centro: number) {
        return this.api.listarPorCentro(centro).pipe(
            map((r) => unwrapOrThrow<{ items: BodegaDto[] }>(r).items ?? []),
        );
    }

    listarOptionsPorCentro(centro: number) {
        return this.api.listarPorCentro(centro).pipe(
            map((r) => {
                const items = unwrapOrThrow<{ items: BodegaDto[] }>(r).items ?? [];
                const opts: BodegaOption[] = items.map((b) => ({
                    label: b?.nombre ?? `Bodega ${b?.idInvBodega}`,
                    value: Number(b.idInvBodega),
                }));
                opts.sort((a, b) => a.label.localeCompare(b.label));
                return opts;
            }),
        );
    }

    obtener(id: number) {
        return this.api.obtener(id).pipe(
            map((r) => unwrapOrThrow<{ item: BodegaDto }>(r).item),
        );
    }

    crear(req: BodegaCrearRequest) {
        return this.api.crear(req).pipe(
            map((r) => unwrapOrThrow<any>(r)),
        );
    }

    editar(req: BodegaEditarRequest) {
        return this.api.editar(req).pipe(
            map((r) => unwrapOrThrow<any>(r)),
        );
    }

    eliminar(id: number) {
        return this.api.eliminar(id).pipe(
            map((r) => unwrapOrThrow<any>(r)),
        );
    }

    restaurar(id: number) {
        return this.api.restaurar(id).pipe(
            map((r) => unwrapOrThrow<any>(r)),
        );
    }
}
