import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { PerfilApi } from './perfil.api';
import {
    PerfilCreateRequest,
    PerfilDto,
    PerfilEditRequest,
    PerfilPrivilegiosArbolResponse,
    PerfilPrivilegiosGuardarRequest,
} from './perfil.models';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

@Injectable({ providedIn: 'root' })
export class PerfilRepository {
    private api = inject(PerfilApi);

    listar() {
        return this.api.listar().pipe(
            map((r) => unwrapOrThrow<{ items: PerfilDto[] }>(r).items ?? []),
        );
    }

    crear(payload: PerfilCreateRequest) {
        return this.api.crear(payload).pipe(
            map((r) => unwrapWithMsg<{ idSegPerfil: number }>(r)),
        );
    }

    editar(payload: PerfilEditRequest) {
        return this.api.editar(payload).pipe(
            map((r) => unwrapWithMsg<{ id: number }>(r)),
        );
    }

    eliminar(idSegPerfil: number) {
        return this.api.eliminar(idSegPerfil).pipe(
            map((r) => unwrapWithMsg<{ id: number }>(r)),
        );
    }

    arbolPrivilegios(idSegPerfil: number) {
        return this.api.arbolPrivilegios(idSegPerfil).pipe(
            map((r) => unwrapOrThrow<PerfilPrivilegiosArbolResponse>(r)),
        );
    }

    guardarPrivilegios(payload: PerfilPrivilegiosGuardarRequest) {
        return this.api.guardarPrivilegios(payload).pipe(
            map((r) => unwrapWithMsg<{ idSegPerfil: number; asignados: number }>(r)),
        );
    }
}
