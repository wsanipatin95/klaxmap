import { Routes } from '@angular/router';
import { guestGuard } from 'src/app/core/guards/guest.guard';
import { authGuard } from 'src/app/core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // públicas (lazy)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('src/app/features/seg/pages/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('src/app/features/seg/pages/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import(
        'src/app/features/seg/pages/forgot-password/forgot-password.component'
      ).then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'activarcuenta',
    canActivate: [guestGuard],
    loadComponent: () =>
      import(
        'src/app/features/seg/pages/activate-account/activate-account.component'
      ).then((m) => m.ActivateAccountComponent),
  },
  {
    path: 'recuperarclave',
    canActivate: [guestGuard],
    loadComponent: () =>
      import(
        'src/app/features/seg/pages/reset-password/reset-password.component'
      ).then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'activarcuentainvitacion',
    loadComponent: () =>
      import(
        'src/app/features/seg/pages/activate-invitation/activate-invitation.component'
      ).then((m) => m.ActivateInvitationComponent),
  },

  // panel protegido
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-layout/app-layout.component').then(
        (m) => m.AppLayoutComponent
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('src/app/features/adm/pages/dashboard/dashboard').then(
            (m) => m.Dashboard
          ),
      },
      {
        path: 'components',
        loadComponent: () =>
          import(
            'src/app/features/adm/pages/component-guide-ui/component-guide-ui'
          ).then((m) => m.ComponentGuideUi),
      },
      {
        path: 'adm',
        loadChildren: () =>
          import('src/app/features/adm/adm.routes').then((m) => m.ADM_ROUTES),
      },
      {
        path: 'mapa',
        loadChildren: () =>
          import('src/app/features/mapa/mapa.routes').then((m) => m.MAPA_ROUTES),
      },
      {
        path: 'importacion',
        loadChildren: () =>
          import('src/app/features/importacion/importacion.routes').then(
            (m) => m.IMPORTACION_ROUTES
          ),
      },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
