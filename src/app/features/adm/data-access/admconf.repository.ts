import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

import { AdmConfApi } from './admconf.api';
import type { AdmConfModuloDto, AdmConfItemDto, AdmConfSaveRequest } from './admconf.models';

@Injectable({ providedIn: 'root' })
export class AdmConfRepository {
    private api = inject(AdmConfApi);

    listarModulos() {
        return this.api.listarModulos().pipe(
            map((r) => unwrapOrThrow<{ items: AdmConfModuloDto[] }>(r).items ?? []),
        );
    }

    listarPorModuloId(id: number) {
        return this.api.listarPorModuloId(id).pipe(
            map((r) => unwrapOrThrow<{ items: AdmConfItemDto[] }>(r).items ?? []),
        );
    }

    guardar(payload: AdmConfSaveRequest) {
        return this.api.guardar(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }
}

// re-export tipos
export type { AdmConfModuloDto, AdmConfItemDto, AdmConfSaveRequest } from './admconf.models';
