import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { SKIP_TENANT } from './http-context.tokens';
import { ENVIRONMENT, AppEnvironment } from '@core/config/environment.token';

function shouldSkipByUrl(url: string) {
  // Endpoints globales (modo organización) => NO tenant
  // Ajusta si luego decides que empresa/editar sí usa tenant, pero por ahora: NO.
  return (
    url.includes('/api/aut/') // login, etc
  );
}
export const xTenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_TENANT)) return next(req);
  if (shouldSkipByUrl(req.url)) return next(req);

  const env = inject<AppEnvironment>(ENVIRONMENT);
  const sessionStore = inject(SessionStore);

  const defaultCompany = env.company ?? null;
  const defaultTenant = env.tenant ?? null;

  const dynamicTenant = sessionStore.xTenant();
  const tenantToSend = dynamicTenant ?? defaultTenant;
  const companyToSend = defaultCompany;

  if (req.headers.has('X-Company') && req.headers.has('X-Tenant')) {
    return next(req);
  }

  const headers: Record<string, string> = {};

  if (!req.headers.has('X-Company') && companyToSend) {
    headers['X-Company'] = companyToSend;
  }

  if (!req.headers.has('X-Tenant') && tenantToSend) {
    headers['X-Tenant'] = tenantToSend;
  }

  if (!Object.keys(headers).length) {
    return next(req);
  }

  return next(req.clone({ setHeaders: headers }));
};

