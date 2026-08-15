import { Routes } from '@angular/router';
import { MonitoreoShellComponent } from './monitoreo-shell.component';

/**
 * Rutas del módulo Monitoreo (NOC), portadas desde el front independiente.
 * Se montan bajo el shell protegido de klaxmap en /app/monitoreo.
 * El shell `MonitoreoShellComponent` envuelve las páginas en `.mon-scope` y les
 * da los estilos del front de NOC (acotados a este módulo).
 * El JWT del ERP y el tenant los inyectan los interceptores globales de klaxmap.
 */
export const MONITOREO_ROUTES: Routes = [
  {
    path: '',
    component: MonitoreoShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', loadComponent: () => import('./pages/inicio').then((m) => m.Inicio) },
      { path: 'mi-dashboard', loadComponent: () => import('./pages/mi-dashboard').then((m) => m.MiDashboard) },
      { path: 'equipos', loadComponent: () => import('./pages/equipos').then((m) => m.Equipos) },
      { path: 'equipos/:id', loadComponent: () => import('./pages/equipo-detalle').then((m) => m.EquipoDetalle) },
      { path: 'clientes', loadComponent: () => import('./pages/clientes-onu').then((m) => m.ClientesOnu) },
      { path: 'topologia', loadComponent: () => import('./pages/topologia').then((m) => m.Topologia) },
      { path: 'soporte', loadComponent: () => import('./pages/soporte').then((m) => m.Soporte) },
      { path: 'salud-gpon', loadComponent: () => import('./pages/panel-noc').then((m) => m.PanelNoc) },
      { path: 'panel-noc', pathMatch: 'full', redirectTo: 'salud-gpon' },
      { path: 'alertas', loadComponent: () => import('./pages/alertas').then((m) => m.Alertas) },
      { path: 'seguridad', loadComponent: () => import('./pages/seguridad').then((m) => m.Seguridad) },
      { path: 'trafico-apps', loadComponent: () => import('./pages/trafico-apps').then((m) => m.TraficoApps) },
      { path: 'configurar-olt', loadComponent: () => import('./pages/olt-config').then((m) => m.OltConfig) },
      { path: 'configurar-acs', loadComponent: () => import('./pages/acs-config').then((m) => m.AcsConfig) },
      { path: 'configuracion', loadComponent: () => import('./pages/configuracion').then((m) => m.Configuracion) },
      { path: 'tiempos', pathMatch: 'full', redirectTo: 'configuracion' },
      { path: 'notificaciones', pathMatch: 'full', redirectTo: 'configuracion' },
    ],
  },
];
