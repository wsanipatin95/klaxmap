import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
    Paged,
    OrgUsuarioDto,
    OrgInvitacionRequest,
    OrgUsuarioToggleRequest,
    OrgUsuarioExisteResponse
} from './org-usuarios.models';
import { SKIP_TENANT } from 'src/app/core/http/http-context.tokens';

const GLOBAL = new HttpContext().set(SKIP_TENANT, true);

@Injectable({ providedIn: 'root' })
export class OrgUsuariosApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listarUsuarios(params: { idOrganizacion: number; page?: number; size?: number; all?: boolean }) {
        const httpParams = new HttpParams()
            .set('idOrganizacion', params.idOrganizacion)
            .set('page', params.page ?? 0)
            .set('size', params.size ?? 20)
            .set('all', params.all ?? false);

        return this.http.get<ApiEnvelope<Paged<OrgUsuarioDto>>>(
            `${this.env.apiBaseUrl}/api/erp/organizacion/usuarios/listar`,
            { params: httpParams, context: GLOBAL }
        );
    }

    invitar(payload: OrgInvitacionRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/organizacion/invitacion`,
            payload
        );
    }

    activar(payload: OrgUsuarioToggleRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/organizacion/usuario-activar`,
            payload
        );
    }

    desactivar(payload: OrgUsuarioToggleRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/organizacion/usuario-desactivar`,
            payload
        );
    }

    usuarioExiste(params: { usuario: string; idOrganizacion?: number }) {
        const httpParams = new HttpParams()
            .set('usuario', params.usuario)
            .set('idOrganizacion', params.idOrganizacion ?? 0);

        return this.http.get<ApiEnvelope<OrgUsuarioExisteResponse>>(
            `${this.env.apiBaseUrl}/api/erp/organizacion/usuario-existe`,
            { params: httpParams }
        );
    }
}
