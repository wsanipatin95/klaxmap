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

  confirmDiscard(): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmation.confirm({
        header: 'Cambios pendientes',
        message: 'Tienes cambios sin guardar. ¿Deseas descartarlos?',
        icon: 'pi pi-question-circle',
        acceptLabel: 'Descartar',
        rejectLabel: 'Seguir editando',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }
}
