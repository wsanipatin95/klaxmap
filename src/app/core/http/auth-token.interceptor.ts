import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { SKIP_AUTH } from './http-context.tokens';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }

  const sessionStore = inject(SessionStore);
  const token = sessionStore.session()?.token;

  if (!token) return next(req);

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};