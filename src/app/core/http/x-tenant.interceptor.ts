import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { SKIP_TENANT } from './http-context.tokens';
import { ENVIRONMENT,AppEnvironment } from '@core/config/environment.token';

function shouldSkipByUrl(url: string) {
  // Endpoints globales (modo organización) => NO tenant
  // Ajusta si luego decides que empresa/editar sí usa tenant, pero por ahora: NO.
  return (
    url.includes('/api/aut/') // login, etc
  );
}
export const xTenantInterceptor: HttpInterceptorFn = (req, next) => {
  // Si algún request explícitamente quiere saltarse tenant/company
  if (req.context.get(SKIP_TENANT)) return next(req);

  if (shouldSkipByUrl(req.url)) return next(req);

  const env = inject<AppEnvironment>(ENVIRONMENT);
  const sessionStore = inject(SessionStore);

  // Defaults por ambiente (DEV/PROD)
  const defaultCompany = env.company; // 'kety'
  const defaultTenant = env.tenant;   // 'public'

  // Tenant dinámico (modo empresa). Si no hay, cae al default.
  const dynamicTenant = sessionStore.xTenant(); // ej: "public_4f3a..."
  const tenantToSend = dynamicTenant ?? defaultTenant;

  // Company: por ahora fijo por ambiente (kety). (Si mañana lo vuelves dinámico, aquí se cambia.)
  const companyToSend = defaultCompany;

  // No sobrescribas si ya viene definido manualmente
  if (req.headers.has('X-Company') && req.headers.has('X-Tenant')) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        ...(req.headers.has('X-Company') ? {} : { 'X-Company': companyToSend }),
        ...(req.headers.has('X-Tenant') ? {} : { 'X-Tenant': tenantToSend }),
      },
    })
  );
};

