import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionLockStore {
    // true = pantalla bloqueada encima
    locked = signal(false);

    // mensaje opcional (sesión expirada, token inválido, etc.)
    reason = signal<string | null>(null);

    lock(reason?: string) {
        if (this.locked()) return;
        this.reason.set(reason ?? 'Sesión expirada');
        this.locked.set(true);
    }

    unlock() {
        this.locked.set(false);
        this.reason.set(null);
    }
}
