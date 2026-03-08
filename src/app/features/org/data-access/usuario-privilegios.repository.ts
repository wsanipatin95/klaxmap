import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

import { UsuarioPrivilegiosApi } from './usuario-privilegios.api';
import type {
    UsuarioAplicarPerfilRequest,
    UsuarioPrivilegiosGuardarRequest,
    UsuarioPrivilegiosArbolResponse,
    UsuarioMenusEmpresaResponse,
} from './usuario-privilegios.models';

@Injectable({ providedIn: 'root' })
export class UsuarioPrivilegiosRepository {
    private api = inject(UsuarioPrivilegiosApi);

    aplicarPerfil(payload: UsuarioAplicarPerfilRequest) {
        return this.api.aplicarPerfil(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    arbolPrivilegios(usu: number) {
        return this.api.arbolPrivilegios(usu).pipe(
            map((r) => unwrapOrThrow<UsuarioPrivilegiosArbolResponse>(r)),
        );
    }

    guardarPrivilegios(payload: UsuarioPrivilegiosGuardarRequest) {
        return this.api.guardarPrivilegios(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    menusEmpresa(usu: number) {
        return this.api.menusEmpresa(usu).pipe(
            map((r) => unwrapOrThrow<UsuarioMenusEmpresaResponse>(r)),
        );
    }
}
