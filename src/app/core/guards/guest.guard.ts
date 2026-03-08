import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthRepository } from 'src/app/features/seg/data-access/auth.repository';

export const guestGuard: CanActivateFn = () => {
  const authRepo = inject(AuthRepository);
  const router = inject(Router);

  if (authRepo.isAuthenticated()) {
    return router.createUrlTree(['/app/dashboard']);
  }

  return true;
};
