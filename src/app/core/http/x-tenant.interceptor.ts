import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { SKIP_TENANT } from './http-context.tokens';

function shouldSkipByUrl(url: string) {
  // Endpoints globales (modo organización) => NO tenant
  // Ajusta si luego decides que empresa/editar sí usa tenant, pero por ahora: NO.
  return (
    url.includes('/api/erp/empresa/listar') ||
    url.includes('/api/erp/empresa/registro') ||
    url.includes('/api/erp/empresa/editar') ||
    url.includes('/api/erp/organizacion/usuarios/listar') ||
    url.includes('/api/erp/empresa/usuarios/listar-empresas') ||
    url.includes('/api/aut/') // login, etc
  );
}

export const xTenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_TENANT)) return next(req);

  if (shouldSkipByUrl(req.url)) return next(req);

  const sessionStore = inject(SessionStore);
  const xTenant = sessionStore.xTenant();

  if (!xTenant) return next(req);

  if (req.headers.has('X-Tenant')) return next(req);

  return next(
    req.clone({
      setHeaders: { 'X-Tenant': xTenant },
    })
  );
};
