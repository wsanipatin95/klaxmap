import { Routes } from '@angular/router';

export const MAPA_EMBED_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'admin',
  },
  {
    path: 'admin',
    data: { mode: 'admin' },
    loadComponent: () =>
      import('./pages/mapa-embed-admin-shell/mapa-embed-admin-shell.component').then(
        (m) => m.MapaEmbedAdminShellComponent
      ),
  },
  {
    path: 'vendedor',
    data: { mode: 'vendedor' },
    loadComponent: () =>
      import('./pages/mapa-embed-viewer/mapa-embed-viewer.component').then(
        (m) => m.MapaEmbedViewerComponent
      ),
  },
  {
    path: 'tecnico',
    data: { mode: 'tecnico' },
    loadComponent: () =>
      import('./pages/mapa-embed-viewer/mapa-embed-viewer.component').then(
        (m) => m.MapaEmbedViewerComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'admin',
  },
];
