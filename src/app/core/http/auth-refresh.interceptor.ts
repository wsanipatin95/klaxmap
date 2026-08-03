import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { AuthRefreshService } from './auth-refresh.service';
import { SKIP_AUTH } from './http-context.tokens';

/**
 * Renueva el token en 401 y reintenta la petición original.
 * <p>
 * Debe ir DESPUÉS del http-error interceptor en el arreglo, para procesar la
 * respuesta ANTES que él: si el refresh funciona, el 401 se resuelve y el
 * http-error nunca lo ve (no aparece el lock-screen). Si el refresh falla,
 * se limpia la sesión y el error sigue su curso.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const refresher = inject(AuthRefreshService);

  // No refrescar en endpoints de auth (login/refresh) ni en peticiones públicas.
  if (req.context.get(SKIP_AUTH) || req.url.includes('/api/aut/')) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const enEmbed = typeof location !== 'undefined' && location.pathname.includes('/embed/');
      if (err.status !== 401 || enEmbed || !session.session()?.refreshToken) {
        return throwError(() => err);
      }
      return refresher.refresh().pipe(
        switchMap((token) =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
        ),
        catchError(() => {
          session.clearSession();
          return throwError(() => err);
        })
      );
    })
  );
};
