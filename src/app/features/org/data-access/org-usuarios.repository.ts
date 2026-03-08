import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

import { OrgUsuariosApi } from './org-usuarios.api';
import type { Paged, OrgUsuarioDto, OrgInvitacionRequest, OrgUsuarioToggleRequest, OrgUsuarioExisteResponse } from './org-usuarios.models';

@Injectable({ providedIn: 'root' })
export class OrgUsuariosRepository {
    private api = inject(OrgUsuariosApi);

    listarUsuarios(idOrganizacion: number, page = 0, size = 20, all = false) {
        return this.api.listarUsuarios({ idOrganizacion, page, size, all }).pipe(
            map((r) => unwrapOrThrow<Paged<OrgUsuarioDto>>(r)),
        );
    }

    invitar(payload: OrgInvitacionRequest) {
        return this.api.invitar(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    activar(payload: OrgUsuarioToggleRequest) {
        return this.api.activar(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    desactivar(payload: OrgUsuarioToggleRequest) {
        return this.api.desactivar(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    usuarioExiste(usuario: string, idOrganizacion?: number) {
        return this.api.usuarioExiste({ usuario, idOrganizacion }).pipe(
            map((r) => unwrapOrThrow<OrgUsuarioExisteResponse>(r)),
        );
    }
}
