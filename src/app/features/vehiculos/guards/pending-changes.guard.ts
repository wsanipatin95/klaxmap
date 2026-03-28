import { CanDeactivateFn } from '@angular/router';

export interface PendingChangesAware {
  canDeactivate: () => boolean | Promise<boolean>;
}

export const pendingChangesGuard: CanDeactivateFn<PendingChangesAware> = async (component) => {
  if (!component || typeof component.canDeactivate !== 'function') return true;
  return component.canDeactivate();
};
