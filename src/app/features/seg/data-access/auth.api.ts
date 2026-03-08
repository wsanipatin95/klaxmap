import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import {
  LoginRequest, LoginResponse, RegistroGlobalRequest, RegistroGlobalResponse,
  ResetearClaveResponse, ConfirmarCuentaResponse, CheckTokenResponse,
  ConfirmarClaveRequest, ConfirmarClaveResponse,
  ConfirmarInvitacionRequest, ConfirmarInvitacionResponse
} from './auth.models';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { AppEnvironment } from 'src/app/core/config/environment.token';
import { SKIP_AUTH } from 'src/app/core/http/http-context.tokens';

const PUBLIC = new HttpContext().set(SKIP_AUTH, true);

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);
  private env = inject<AppEnvironment>(ENVIRONMENT);

  // baseUrl completo para auth:
  private baseUrl = `${this.env.apiBaseUrl}/api/aut`;

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload, {
      context: PUBLIC,
    });
  }

  checkToken() {
    return this.http.get<LoginResponse>(`${this.baseUrl}/check-token`, {
      context: PUBLIC,
    });
  }

  registroGlobal(payload: RegistroGlobalRequest) {
    return this.http.post<RegistroGlobalResponse>(
      `${this.baseUrl}/registro-global`,
      payload,
      { context: PUBLIC }
    );
  }

  resetearClave(usuario: string) {
    return this.http.get<ResetearClaveResponse>(`${this.baseUrl}/resetear-clave`, {
      context: PUBLIC,
      params: { usuario },
    });
  }

  confirmarCuenta(token: string) {
    return this.http.get<ConfirmarCuentaResponse>(`${this.baseUrl}/confirmar-cuenta`, {
      context: PUBLIC,
      params: { token },
    });
  }

  checkTokenFlow(token: string) {
    return this.http.get<CheckTokenResponse>(`${this.baseUrl}/check-token`, {
      context: PUBLIC,
      params: { token },
    });
  }

  confirmarClave(payload: ConfirmarClaveRequest) {
    return this.http.post<ConfirmarClaveResponse>(`${this.baseUrl}/confirmar-clave`, payload, {
      context: PUBLIC,
    });
  }
  checkSesion() {
    return this.http.get(`${this.baseUrl}/check-sesion`);
  }
  confirmarInvitacion(payload: ConfirmarInvitacionRequest) {
    return this.http.post<ConfirmarInvitacionResponse>(
      `${this.baseUrl}/confirmar-invitacion`,
      payload,
      { context: PUBLIC }
    );
  }
  logout() {
    return this.http.post(`${this.baseUrl}/logout`, {});
  }

}