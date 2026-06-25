import { Routes } from '@angular/router';

export const MAPA_RED_BETA_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/mapa-red-beta-home/mapa-red-beta-home.component').then(
        (m) => m.MapaRedBetaHomeComponent
      ),
  },
  { path: '**', redirectTo: 'home' },
];
