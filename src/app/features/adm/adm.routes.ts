
import { Routes } from '@angular/router';
export const ADM_ROUTES: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'panel' },
    {
        path: 'mis-empresas',
        loadComponent: () =>
            import('./pages/mis-empresas/mis-empresas.component').then(
                (m) => m.MisEmpresasComponent
            ),
    },
    {
        path: 'auditoria',
        loadComponent: () =>
            import('./pages/auditoria-supervisor/auditoria-supervisor.component').then(
                (m) => m.AuditoriaSupervisorComponent
            ),
    },
    { path: '**', redirectTo: 'panel' },
];
