import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthRepository } from 'src/app/features/seg/data-access/auth.repository';

export const authGuard: CanActivateFn = (route, state) => {
    const authRepo = inject(AuthRepository);
    const router = inject(Router);

    if (authRepo.isAuthenticated()) {
        return true;
    }

    return router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
    });
};
