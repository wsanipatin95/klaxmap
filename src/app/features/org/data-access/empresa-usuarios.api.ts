import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

import type {
    Paged,
    EmpresaUsuarioDto,
    EmpresaUsuarioRegistrarRequest,
    EmpresaUsuarioQuitarRequest,
} from './empresa-usuarios.models';

import { SKIP_TENANT } from 'src/app/core/http/http-context.tokens';

const GLOBAL = new HttpContext().set(SKIP_TENANT, true);

@Injectable({ providedIn: 'root' })
export class EmpresaUsuariosApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    //  Este sí es “modo empresa”, debe llevar tenant
    listar(params: { idEmpresa: string; page?: number; size?: number; all?: boolean }) {
        const httpParams = new HttpParams()
            .set('idEmpresa', params.idEmpresa)
            .set('page', params.page ?? 0)
            .set('size', params.size ?? 20)
            .set('all', params.all ?? false);

        return this.http.get<ApiEnvelope<Paged<EmpresaUsuarioDto>>>(
            `${this.env.apiBaseUrl}/api/erp/empresa/usuarios/listar`,
            { params: httpParams }
        );
    }

    registrar(payload: EmpresaUsuarioRegistrarRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/empresa/usuarios/registrar`,
            payload
        );
    }

    quitar(payload: EmpresaUsuarioQuitarRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/empresa/usuarios/quitar`,
            payload
        );
    }

    //  Este es global (usuario → empresas disponibles), NO debe llevar tenant
    listarEmpresasUsuario(params: { usu: number; page?: number; size?: number; all?: boolean }) {
        const httpParams = new HttpParams()
            .set('usu', params.usu)
            .set('page', params.page ?? 0)
            .set('size', params.size ?? 20)
            .set('all', params.all ?? false);

        return this.http.get<ApiEnvelope<Paged<EmpresaUsuarioDto>>>(
            `${this.env.apiBaseUrl}/api/erp/empresa/usuarios/listar-empresas`,
            { params: httpParams, context: GLOBAL }
        );
    }

    listarEmpresasUsuarioOrganizacion(params: { usu: number; idOrganizacion: number; page?: number; size?: number; all?: boolean }) {
        const httpParams = new HttpParams()
            .set('usu', params.usu)
            .set('idOrganizacion', params.idOrganizacion)
            .set('page', params.page ?? 0)
            .set('size', params.size ?? 20)
            .set('all', params.all ?? false);

        return this.http.get<ApiEnvelope<Paged<EmpresaUsuarioDto>>>(
            `${this.env.apiBaseUrl}/api/erp/empresa/usuarios/listar-empresas-organizacion`,
            { params: httpParams, context: GLOBAL }
        );
    }
}
