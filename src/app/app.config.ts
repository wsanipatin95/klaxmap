import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { ENVIRONMENT } from './core/config/environment.token';
import { AppEnvironment } from './core/config/environment.token';
import { httpErrorInterceptor } from './core/http/http-error.interceptor';
import { authTokenInterceptor } from './core/http/auth-token.interceptor';
import { xTenantInterceptor } from './core/http/x-tenant.interceptor';
import { routes } from './app.routes';
import MyPreset from '../mypreset';
import { MessageService, ConfirmationService } from 'primeng/api';
import { environment } from 'src/environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authTokenInterceptor, xTenantInterceptor, httpErrorInterceptor])
    ),
    {
      provide: ENVIRONMENT,
      useValue: <AppEnvironment>{
        production: environment.production,
        apiBaseUrl: environment.apiBaseUrl,
        company: environment.company,
        tenant: environment.tenant,
      },
    },
    providePrimeNG({
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: '.dark-mode',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
