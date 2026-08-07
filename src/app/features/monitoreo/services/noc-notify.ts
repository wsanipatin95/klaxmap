import { Injectable, signal } from '@angular/core';

/** Resultado a mostrar en el modal notificador global del NOC. */
export interface NocNote {
  kind: 'ok' | 'err';
  title: string;
  text: string;
}

/**
 * Notificador GLOBAL del NOC: modal centrado de OK / error para altas, ediciones y
 * demas acciones. Cualquier pagina inyecta este servicio y llama ok()/error(); el
 * host (montado una vez en el shell) muestra el modal.
 */
@Injectable({ providedIn: 'root' })
export class NocNotify {
  readonly note = signal<NocNote | null>(null);
  ok(text: string, title = 'Listo') { this.note.set({ kind: 'ok', title, text }); }
  error(text: string, title = 'No se pudo completar') { this.note.set({ kind: 'err', title, text }); }
  close() { this.note.set(null); }
}
