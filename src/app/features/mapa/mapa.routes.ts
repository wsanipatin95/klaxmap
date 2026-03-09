import { Routes } from '@angular/router';

export const MAPA_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },

  {
    path: 'home',
    loadComponent: () =>
      import('./pages/mapa-home/mapa-home.component').then(
        (m) => m.MapaHomeComponent
      ),
  },
  {
    path: 'importar',
    loadComponent: () =>
      import('./pages/mapa-importar/mapa-importar.component').then(
        (m) => m.MapaImportarComponent
      ),
  },
  {
    path: 'nodos',
    loadComponent: () =>
      import('./pages/mapa-nodos/mapa-nodos.component').then(
        (m) => m.MapaNodosComponent
      ),
  },
  {
    path: 'tipos',
    loadComponent: () =>
      import('./pages/mapa-tipos/mapa-tipos.component').then(
        (m) => m.MapaTiposComponent
      ),
  },

  { path: '**', redirectTo: 'home' },
];