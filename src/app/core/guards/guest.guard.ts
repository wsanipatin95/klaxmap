import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionLandingService } from 'src/app/core/services/session-landing.service';
import { AuthRepository } from 'src/app/features/seg/data-access/auth.repository';

export const guestGuard: CanActivateFn = () => {
  const authRepo = inject(AuthRepository);
  const router = inject(Router);
  const landing = inject(SessionLandingService);

  if (authRepo.isAuthenticated()) {
    return router.parseUrl(landing.getLandingUrl());
  }

  return true;
};
