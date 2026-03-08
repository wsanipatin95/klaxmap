import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

import { finalize, take } from 'rxjs/operators';

import { SessionLockStore } from '../../store/session-lock.store';
import { SessionStore } from '../../store/session.store';
import { AuthRepository } from '../../data-access/auth.repository';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({
    selector: 'app-lock-screen',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, CardModule, PasswordModule, ButtonModule],
    templateUrl: './lock-screen.component.html',
    styleUrl: './lock-screen.component.scss',
})
export class LockScreenComponent {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private lockStore = inject(SessionLockStore);
    private sessionStore = inject(SessionStore);
    private authRepo = inject(AuthRepository);
    private notify = inject(NotifyService);

    loading = false;

    form = this.fb.group({
        password: ['', [Validators.required, Validators.minLength(4)]],
    });

    get username() {
        return this.sessionStore.user()?.username ?? '';
    }

    get reason() {
        return this.lockStore.reason();
    }

    unlock(): void {
        if (this.loading) return;

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const usuario = this.username;
        const clave = String(this.form.value.password);

        if (!usuario) {
            // no hay usuario => no se puede desbloquear, mandamos al login
            this.authRepo.logout();
            this.lockStore.unlock();
            this.router.navigate(['/login']);
            return;
        }

        this.loading = true;

        this.authRepo
            .login({ usuario, clave })
            .pipe(finalize(() => (this.loading = false)), take(1))
            .subscribe({
                next: () => {
                    this.lockStore.unlock();
                    this.form.reset();
                    this.notify.success('Sesión reactivada ');
                },
                error: (err: any) => {
                    const msg =
                        (err?.error && (err.error.error || err.error.message)) ||
                        err?.message ||
                        'Contraseña incorrecta';
                    this.notify.error('No se pudo desbloquear', msg);
                },
            });
    }

    logout(): void {
        this.authRepo.logout();
        this.lockStore.unlock();
        this.router.navigate(['/login']);
    }
}
