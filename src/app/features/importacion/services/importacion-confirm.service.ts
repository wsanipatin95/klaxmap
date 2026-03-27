import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class ImportacionConfirmService {
  private confirmation = inject(ConfirmationService);

  ask(options: {
    header: string;
    message: string;
    acceptLabel?: string;
    rejectLabel?: string;
    icon?: string;
  }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.confirmation.confirm({
        header: options.header,
        message: options.message,
        icon: options.icon ?? 'pi pi-exclamation-triangle',
        acceptLabel: options.acceptLabel ?? 'Aceptar',
        rejectLabel: options.rejectLabel ?? 'Cancelar',
        acceptButtonStyleClass: 'p-button-sm',
        rejectButtonStyleClass: 'p-button-text p-button-sm',
        accept: () => resolve(true),
        reject: () => resolve(false),
        closeOnEscape: true,
      });
    });
  }

  confirmDelete(name = 'registro') {
    return this.ask({
      header: 'Confirmar eliminación',
      message: `Se eliminará ${name}. Esta acción es lógica y dejará el registro fuera de los listados activos.`,
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      icon: 'pi pi-trash',
    });
  }

  confirmDiscard() {
    return this.ask({
      header: 'Cambios sin guardar',
      message: 'Tienes cambios pendientes. ¿Deseas seguir editando o salir sin guardar?',
      acceptLabel: 'Salir sin guardar',
      rejectLabel: 'Seguir editando',
    });
  }
}
