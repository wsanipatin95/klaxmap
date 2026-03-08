import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

import type {
    UsuarioAplicarPerfilRequest,
    UsuarioPrivilegiosGuardarRequest,
    UsuarioPrivilegiosArbolResponse,
    UsuarioMenusEmpresaResponse,
} from './usuario-privilegios.models';

@Injectable({ providedIn: 'root' })
export class UsuarioPrivilegiosApi {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    aplicarPerfil(payload: UsuarioAplicarPerfilRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/usuario/aplicar-perfil`,
            payload
        );
    }

    arbolPrivilegios(usu: number) {
        const params = new HttpParams().set('usu', usu);
        return this.http.get<ApiEnvelope<UsuarioPrivilegiosArbolResponse>>(
            `${this.env.apiBaseUrl}/api/erp/usuario/arbol-privilegios`,
            { params }
        );
    }

    guardarPrivilegios(payload: UsuarioPrivilegiosGuardarRequest) {
        return this.http.post<ApiEnvelope<any>>(
            `${this.env.apiBaseUrl}/api/erp/usuario/privilegios/guardar`,
            payload
        );
    }
    menusEmpresa(usu: number) {
        const params = new HttpParams().set('usu', usu);
        return this.http.get<ApiEnvelope<UsuarioMenusEmpresaResponse>>(
            `${this.env.apiBaseUrl}/api/erp/usuario/menus`,
            { params }
        );
    }

}
