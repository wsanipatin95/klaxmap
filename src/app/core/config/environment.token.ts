import { InjectionToken } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface ApiBases {
  erp: string;
  monitoreo: string;
}

export interface AppEnvironment {
  production: boolean;
  apiBaseUrl: string;

  // Prefijos relativos por back (unificación KLAX).
  apiBases: ApiBases;

  // Multi-tenant defaults
  company: string; // ej: 'kety'
  tenant: string;  // ej: 'public'
}

export const ENVIRONMENT = new InjectionToken<AppEnvironment>('ENVIRONMENT', {
  providedIn: 'root',
  factory: () => ({
    production: environment.production,
    apiBaseUrl: environment.apiBaseUrl,
    apiBases: environment.apiBases,
    company: environment.company,
    tenant: environment.tenant,
  }),
});
