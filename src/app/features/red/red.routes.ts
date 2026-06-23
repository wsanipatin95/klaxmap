import { Routes } from '@angular/router';

export const RED_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/red-dashboard/red-dashboard.component').then(
        (m) => m.RedDashboardComponent
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];
