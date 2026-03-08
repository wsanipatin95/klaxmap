
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
    { path: '**', redirectTo: 'panel' },
];
