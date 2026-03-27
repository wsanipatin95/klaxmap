import { Routes } from '@angular/router';
import { pendingChangesGuard } from './guards/pending-changes.guard';

export const IMPORTACION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/importacion-dashboard.component').then((m) => m.ImportacionDashboardComponent),
  },
  {
    path: 'proveedores',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/proveedores/importacion-proveedores.component').then((m) => m.ImportacionProveedoresComponent),
  },
  {
    path: 'articulos',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/articulos/importacion-articulos.component').then((m) => m.ImportacionArticulosComponent),
  },
  {
    path: 'ofertas',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/ofertas/importacion-ofertas.component').then((m) => m.ImportacionOfertasComponent),
  },
  {
    path: 'solicitudes',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/solicitudes/importacion-solicitudes.component').then((m) => m.ImportacionSolicitudesComponent),
  },
  {
    path: 'arancel',
    loadComponent: () => import('./pages/arancel/importacion-arancel.component').then((m) => m.ImportacionArancelComponent),
  },
  {
    path: 'fichas',
    loadComponent: () => import('./pages/fichas/importacion-fichas.component').then((m) => m.ImportacionFichasComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
