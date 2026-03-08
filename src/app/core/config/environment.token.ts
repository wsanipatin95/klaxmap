import { InjectionToken } from '@angular/core';
import { environment } from 'src/app/environments/environment';

export interface AppEnvironment {
  production: boolean;
  apiBaseUrl: string;

  // Multi-tenant defaults
  company: string; // ej: 'kety'
  tenant: string;  // ej: 'public'
}

export const ENVIRONMENT = new InjectionToken<AppEnvironment>('ENVIRONMENT', {
  providedIn: 'root',
  factory: () => ({
    production: environment.production,
    apiBaseUrl: environment.apiBaseUrl,
    company: environment.company,
    tenant: environment.tenant,
  }),
});
