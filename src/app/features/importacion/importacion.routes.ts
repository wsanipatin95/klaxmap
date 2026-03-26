import { Routes } from '@angular/router';

export const IMPORTACION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/importacion-shell/importacion-shell.component').then(
        (m) => m.ImportacionShellComponent
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'proveedores' },
      {
        path: 'proveedores',
        loadComponent: () =>
          import('./pages/proveedores/importacion-proveedores.component').then(
            (m) => m.ImportacionProveedoresComponent
          ),
      },
      {
        path: 'articulos',
        loadComponent: () =>
          import('./pages/articulos/importacion-articulos.component').then(
            (m) => m.ImportacionArticulosComponent
          ),
      },
      {
        path: 'ofertas',
        loadComponent: () =>
          import('./pages/ofertas/importacion-ofertas.component').then(
            (m) => m.ImportacionOfertasComponent
          ),
      },
      {
        path: 'solicitudes',
        loadComponent: () =>
          import('./pages/solicitudes/importacion-solicitudes.component').then(
            (m) => m.ImportacionSolicitudesComponent
          ),
      },
      {
        path: 'solicitudes/:id/comparador',
        loadComponent: () =>
          import('./pages/comparador/importacion-comparador.component').then(
            (m) => m.ImportacionComparadorComponent
          ),
      },
    ],
  },
];
