import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

import { EmpresaUsuariosApi } from './empresa-usuarios.api';
import type {
    Paged,
    EmpresaUsuarioDto,
    EmpresaUsuarioRegistrarRequest,
    EmpresaUsuarioQuitarRequest,
} from './empresa-usuarios.models';

@Injectable({ providedIn: 'root' })
export class EmpresaUsuariosRepository {
    private api = inject(EmpresaUsuariosApi);

    listar(idEmpresa: string, page = 0, size = 20, all = false) {
        return this.api.listar({ idEmpresa, page, size, all }).pipe(
            map((r) => unwrapOrThrow<Paged<EmpresaUsuarioDto>>(r)),
        );
    }

    registrar(payload: EmpresaUsuarioRegistrarRequest) {
        return this.api.registrar(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    quitar(payload: EmpresaUsuarioQuitarRequest) {
        return this.api.quitar(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    listarEmpresasDeUsuario(usu: number, page = 0, size = 20, all = false) {
        return this.api.listarEmpresasUsuario({ usu, page, size, all }).pipe(
            map((r) => unwrapOrThrow<Paged<EmpresaUsuarioDto>>(r)),
        );
    }
     listarEmpresasDeUsuarioOrganizacion(usu: number, idOrganizacion: number, page = 0, size = 20, all = false) {
        return this.api.listarEmpresasUsuarioOrganizacion({ usu, idOrganizacion, page, size, all }).pipe(
            map((r) => unwrapOrThrow<Paged<EmpresaUsuarioDto>>(r)),
        );
    }
}
