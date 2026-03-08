import { InjectionToken } from '@angular/core';

export interface AppEnvironment {
  apiBaseUrl: string; // ej: 'http://localhost:8081/klaxerp'
}

export const ENVIRONMENT = new InjectionToken<AppEnvironment>('environment');
