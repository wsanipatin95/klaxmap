import { inject, Injectable } from '@angular/core';
import { map, tap, catchError, throwError } from 'rxjs';
import { AuthApi } from './auth.api';
import {
  LoginRequest,
  RegistroGlobalRequest,
  RegistroGlobalData,
  ResetearClaveData,
  ConfirmarCuentaData,
  ConfirmarInvitacionRequest,
  ConfirmarInvitacionData
} from './auth.models';
import { SessionStore } from '../store/session.store';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private api = inject(AuthApi);
  private sessionStore = inject(SessionStore);
  private router = inject(Router);

  login(payload: LoginRequest) {
    return this.api.login(payload).pipe(
      tap((res: any) => {
        const privilegiosOrg = res.privilegiosOrg ?? res.privilegios_organizacion ?? [];
        const privilegiosEmpresa = res.privilegiosEmpresa ?? res.privilegios_empresa ?? [];
        const menusEmpresa = res.menusEmpresa ?? res.menus_empresa ?? [];

        this.sessionStore.setSession({
          token: res.token,
          user: {
            id: res.usu,
            username: res.usuario,
            catalogo: res.catalogo,
            tipo: res.tipo,
            organizacion: res.organizacion ?? []
          },
          meta: {
            environment: res.environment,
            contextPath: res.contextPath,
          },
          privilegiosOrg,
          privilegiosEmpresa,
          menusEmpresa,
        });
      })
    );
  }

  logout() {
    const token = this.sessionStore.session()?.token ?? null;
    if (token) {
      this.api.logout().subscribe({
        next: () => { },
        error: () => { },
        complete: () => { },
      });
    }

    this.sessionStore.clearSession();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  isAuthenticated() {
    return this.sessionStore.isAuthenticated();
  }

  registroGlobal(payload: RegistroGlobalRequest) {
    return this.api.registroGlobal(payload).pipe(
      map((resp) => {
        if (!resp || typeof resp.codigo !== 'number') {
          throw new Error('Respuesta inválida del servidor.');
        }
        if (resp.codigo !== 0) {
          throw new Error(resp.mensaje || 'No se pudo completar el registro.');
        }
        return resp.data as RegistroGlobalData;
      })
    );
  }

  resetearClave(usuario: string) {
    return this.api.resetearClave(usuario).pipe(
      map((resp) => {
        if (!resp || typeof resp.codigo !== 'number') {
          throw new Error('Respuesta inválida del servidor.');
        }
        if (resp.codigo !== 0) {
          throw new Error(resp.mensaje || 'No se pudo resetear la clave.');
        }
        return resp.data as ResetearClaveData;
      }),
      catchError((err: any) => {
        const backendMsg = err?.error?.mensaje || err?.error?.message;
        if (backendMsg) {
          return throwError(() => new Error(backendMsg));
        }
        return throwError(() => err);
      })
    );
  }

  confirmarCuenta(token: string) {
    return this.api.confirmarCuenta(token).pipe(
      map((resp) => {
        if (!resp || typeof resp.codigo !== 'number') {
          throw new Error('Respuesta inválida del servidor.');
        }
        if (resp.codigo !== 0) {
          throw new Error(resp.mensaje || 'No se pudo confirmar la cuenta.');
        }
        return resp.data as ConfirmarCuentaData;
      }),
      catchError((err: any) => {
        const backendMsg = err?.error?.mensaje || err?.error?.message;
        if (backendMsg) return throwError(() => new Error(backendMsg));
        return throwError(() => err);
      })
    );
  }

  checkResetToken(flowToken: string) {
    return this.api.checkTokenFlow(flowToken).pipe(
      map((resp) => {
        if (!resp || typeof resp.codigo !== 'number') {
          throw new Error('Respuesta inválida del servidor.');
        }
        if (resp.codigo !== 0) {
          throw new Error(resp.mensaje || 'Token inválido o expirado.');
        }
        return true;
      }),
      catchError((err: any) => {
        const backendMsg = err?.error?.mensaje || err?.error?.message;
        if (backendMsg) return throwError(() => new Error(backendMsg));
        return throwError(() => err);
      })
    );
  }

  confirmarClave(payload: { token: string; clave: string }) {
    return this.api.confirmarClave(payload).pipe(
      map((resp) => {
        if (!resp || typeof resp.codigo !== 'number') {
          throw new Error('Respuesta inválida del servidor.');
        }
        if (resp.codigo !== 0) {
          throw new Error(resp.mensaje || 'No se pudo restablecer la contraseña.');
        }
        return resp.data;
      }),
      catchError((err: any) => {
        const backendMsg = err?.error?.mensaje || err?.error?.message;
        if (backendMsg) return throwError(() => new Error(backendMsg));
        return throwError(() => err);
      })
    );
  }

  checkSesion() {
    return this.api.checkSesion();
  }

  confirmarInvitacion(payload: ConfirmarInvitacionRequest) {
    return this.api.confirmarInvitacion(payload).pipe(
      map((resp) => {
        if (!resp || typeof resp.codigo !== 'number') {
          throw new Error('Respuesta inválida del servidor.');
        }
        if (resp.codigo !== 0) {
          throw new Error(resp.mensaje || 'No se pudo confirmar la invitación.');
        }
        return resp.data as ConfirmarInvitacionData;
      }),
      catchError((err: any) => {
        const backendMsg = err?.error?.mensaje || err?.error?.message;
        if (backendMsg) return throwError(() => new Error(backendMsg));
        return throwError(() => err);
      })
    );
  }
}