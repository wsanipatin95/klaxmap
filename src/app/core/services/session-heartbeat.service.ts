import { Injectable, inject, effect } from '@angular/core';
import { Subscription, timer, fromEvent, merge } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

import { AuthRepository } from 'src/app/features/seg/data-access/auth.repository';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { SessionLockStore } from 'src/app/features/seg/store/session-lock.store';

/**
 * Hace "ping" a /api/aut/check-sesion para detectar token expirado
 * incluso cuando el usuario NO hace requests.
 */
@Injectable({ providedIn: 'root' })
export class SessionHeartbeatService {
    private authRepo = inject(AuthRepository);
    private sessionStore = inject(SessionStore);
    private lockStore = inject(SessionLockStore);

    private started = false;
    private sub: Subscription | null = null;

    // Ajusta: 20-60s recomendado. (Yo lo dejo en 25s para que sea “rápido”)
    private readonly INTERVAL_MS = 25_000;

    /**
     * Llamar 1 sola vez (ej. desde AppComponent).
     * Internamente se auto-activa / auto-pausa según sesión/lock.
     */
    start(): void {
        if (this.started) return;
        this.started = true;

        // (1) Heartbeat periódico (solo si hay sesión y no está bloqueado)
        effect(() => {
            const authed = this.sessionStore.isAuthenticated();
            const locked = this.lockStore.locked();

            if (!authed || locked) {
                this.stopInternal();
                return;
            }

            this.ensureRunning();
        });

        // (2) Re-chequeo inmediato cuando el usuario vuelve a la pestaña
        const visibility$ = fromEvent(document, 'visibilitychange').pipe(
            filter(() => document.visibilityState === 'visible')
        );
        const focus$ = fromEvent(window, 'focus');

        merge(visibility$, focus$).subscribe(() => {
            if (!this.sessionStore.isAuthenticated()) return;
            if (this.lockStore.locked()) return;
            this.pingOnce();
        });

        // (3) Ping inicial al arrancar si ya hay sesión hidratada
        if (this.sessionStore.isAuthenticated() && !this.lockStore.locked()) {
            this.pingOnce();
        }
    }

    private ensureRunning() {
        if (this.sub) return;

        // timer(0, INTERVAL_MS) => ping inmediato + periódico
        this.sub = timer(0, this.INTERVAL_MS)
            .pipe(
                switchMap(() => this.authRepo.checkSesion().pipe(take(1))),
                catchError((err) => {
                    // OJO: el interceptor ya muestra notify + lock, pero
                    // igual protegemos aquí por si algún request no pasa por interceptor.
                    const status = err?.status ?? 0;

                    if ((status === 401 || status === 403) && !this.lockStore.locked()) {
                        const msg =
                            (err?.error && (err.error.mensaje || err.error.message || err.error.error)) ||
                            'Token inválido o expirado.';
                        this.lockStore.lock(msg);
                    }

                    // cortamos el stream (paramos) para evitar spamear
                    this.stopInternal();
                    throw err;
                })
            )
            .subscribe({
                next: () => {
                    // token OK => no hacemos nada
                },
                error: () => {
                    // ya manejado arriba
                },
            });
    }

    private pingOnce() {
        // Ping único (para focus/visible)
        this.authRepo
            .checkSesion()
            .pipe(take(1))
            .subscribe({
                next: () => { },
                error: (err) => {
                    const status = err?.status ?? 0;
                    if ((status === 401 || status === 403) && !this.lockStore.locked()) {
                        const msg =
                            (err?.error && (err.error.mensaje || err.error.message || err.error.error)) ||
                            'Token inválido o expirado.';
                        this.lockStore.lock(msg);
                    }
                },
            });
    }

    private stopInternal() {
        if (this.sub) {
            this.sub.unsubscribe();
            this.sub = null;
        }
    }
}
