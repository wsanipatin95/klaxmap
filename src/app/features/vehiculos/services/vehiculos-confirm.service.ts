import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class VehiculosConfirmService {
  private confirmation = inject(ConfirmationService);

  confirmDelete(label: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmation.confirm({
        header: 'Confirmar eliminación',
        message: `¿Seguro que deseas eliminar ${label}?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  confirmAnnul(label: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmation.confirm({
        header: 'Confirmar anulación',
        message: `¿Seguro que deseas anular ${label}?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Anular',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-warning',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  confirmLeaveEdit(): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmation.confirm({
        header: 'Cambios pendientes',
        message: 'Tienes cambios sin guardar. ¿Deseas salir sin guardar?',
        icon: 'pi pi-question-circle',
        acceptLabel: 'Salir sin guardar',
        rejectLabel: 'Seguir editando',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  confirmSaveBeforeClose(): Promise<'save' | 'cancel'> {
    return new Promise((resolve) => {
      this.confirmation.confirm({
        header: 'Cambios sin guardar',
        message: 'Esta orden nueva aún no se ha guardado. ¿Deseas guardar y salir?',
        icon: 'pi pi-question-circle',
        acceptLabel: 'Guardar y salir',
        rejectLabel: 'Cancelar',
        accept: () => resolve('save'),
        reject: () => resolve('cancel'),
      });
    });
  }

  confirmDiscard(): Promise<boolean> {
    return this.confirmLeaveEdit();
  }
}