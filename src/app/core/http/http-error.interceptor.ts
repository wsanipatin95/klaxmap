import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { NotifyService } from '../services/notify.service';
import { SessionLockStore } from 'src/app/features/seg/store/session-lock.store';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const notify = inject(NotifyService);
  const sessionStore = inject(SessionStore);
  const lockStore = inject(SessionLockStore);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const backendError =
        (error.error && (error.error.error || error.error.message || error.error.mensaje)) ||
        'Ocurrió un error';

      // Para el login dejamos que lo maneje el componente
      if (req.url.includes('/api/aut/login')) {
        return throwError(() => error);
      }

      if (error.status === 401 || error.status === 403) {
        // En el mapa embebido la auth se hace por 'code' (no por contraseña):
        // no mostrar el lock-screen, dejar que el embed maneje su propia sesión.
        const enEmbed = typeof location !== 'undefined' && location.pathname.includes('/embed/');
        if (enEmbed) {
          return throwError(() => error);
        }
        // 401 = token expirado/inválido -> sesión caída (bloquea y pide re-login).
        // 403 = autenticado pero SIN permiso o acción no permitida por regla de negocio
        //       (p.ej. escritura ACS/OLT deshabilitada). NO es sesión caída: se muestra el
        //       mensaje del backend y NO se bloquea la pantalla.
        if (error.status === 401) {
          notify.error('Sesión expirada', backendError);
          lockStore.lock(backendError);
        } else {
          notify.error('No autorizado', backendError);
        }
        return throwError(() => error);
      }

      if (error.status >= 500) {
        notify.error('Error del servidor', 'Inténtalo de nuevo más tarde.');
      } else {
        notify.error('Error', backendError);
      }

      return throwError(() => error);
    })
  );
};
