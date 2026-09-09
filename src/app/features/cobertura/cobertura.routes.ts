import { Routes } from '@angular/router';

export const COBERTURA_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/cobertura-home/cobertura-home.component').then(
        (m) => m.CoberturaHomeComponent
      ),
  },
  { path: '**', redirectTo: 'home' },
];
