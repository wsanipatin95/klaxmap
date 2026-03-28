import { Routes } from '@angular/router';
import { pendingChangesGuard } from './guards/pending-changes.guard';

export const VEHICULOS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.VehiculosDashboardComponent),
  },
  {
    path: 'tipos',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/tipos/tipos.component').then((m) => m.VehiculosTiposComponent),
  },
  {
    path: 'clientes',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/clientes/clientes.component').then((m) => m.VehiculosClientesComponent),
  },
  {
    path: 'checklists',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/checklists/checklists.component').then((m) => m.VehiculosChecklistsComponent),
  },
  {
    path: 'ordenes',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/ordenes/ordenes.component').then((m) => m.VehiculosOrdenesComponent),
  },
  {
    path: 'facturacion',
    canDeactivate: [pendingChangesGuard],
    loadComponent: () => import('./pages/facturacion/facturacion.component').then((m) => m.VehiculosFacturacionComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
