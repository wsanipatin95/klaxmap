import { Routes } from '@angular/router';
import { pendingChangesGuard } from './guards/pending-changes.guard';

export const BKP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.BkpDashboardComponent) },
  { path: 'agents', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/agents/agents.component').then(m => m.BkpAgentsComponent) },
  { path: 'sources', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/sources/sources.component').then(m => m.BkpSourcesComponent) },
  { path: 'destinations', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/destinations/destinations.component').then(m => m.BkpDestinationsComponent) },
  { path: 'schedules', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/schedules/schedules.component').then(m => m.BkpSchedulesComponent) },
  { path: 'plans', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/plans/plans.component').then(m => m.BkpPlansComponent) },
  { path: 'runs', loadComponent: () => import('./pages/runs/runs.component').then(m => m.BkpRunsComponent) },
  { path: 'secrets', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/secrets/secrets.component').then(m => m.BkpSecretsComponent) },
  { path: 'notifications', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.BkpNotificationsComponent) },
  { path: 'settings', canDeactivate: [pendingChangesGuard], loadComponent: () => import('./pages/settings/settings.component').then(m => m.BkpSettingsComponent) },
  { path: '**', redirectTo: 'dashboard' },
];
