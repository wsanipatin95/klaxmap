import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

import { finalize, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthRepository } from '../../data-access/auth.repository';
import { NotifyService } from 'src/app/core/services/notify.service';

type UiState = 'checking' | 'form' | 'success' | 'error';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        CardModule,
        PasswordModule,
        ButtonModule
    ],
    templateUrl: './reset-password.component.html',
    styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
    private fb = inject(FormBuilder);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authRepo = inject(AuthRepository);
    private notify = inject(NotifyService);
    private destroyRef = inject(DestroyRef);

    state: UiState = 'checking';
    loading = false;

    tokenJwt: string | null = null;
    emailFromToken: string | null = null;

    message = 'Validando enlace…';
    formError: string | null = null;

    form = this.fb.group(
        {
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]],
        },
        { validators: this.passwordMatchValidator }
    );

    constructor() {
        // UX: al escribir, limpia error
        this.form.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                if (this.formError) this.formError = null;
            });
    }

    ngOnInit(): void {
        this.tokenJwt = this.route.snapshot.queryParamMap.get('token');

        if (!this.tokenJwt) {
            this.state = 'error';
            this.message = 'Token no encontrado en el enlace.';
            return;
        }

        // Decodifica JWT -> sub (email)
        this.emailFromToken = this.getEmailFromJwt(this.tokenJwt);
        if (!this.emailFromToken) {
            console.warn('No se pudo leer el email (sub) desde el token.');
        }

        this.state = 'checking';
        this.message = 'Validando token…';
        this.setLoading(true);

        this.authRepo
            .checkResetToken(this.tokenJwt)
            .pipe(
                take(1),
                finalize(() => this.setLoading(false))
            )
            .subscribe({
                next: () => {
                    this.state = 'form';
                    this.message = 'Ingresa tu nueva contraseña.';
                },
                error: (err: any) => {
                    this.state = 'error';
                    this.message = err?.message || 'Token inválido o expirado.';
                    this.notify.error('Recuperar clave', this.message);
                },
            });
    }

    private setLoading(value: boolean) {
        this.loading = value;
        if (value) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
    }

    passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
        const p = control.get('password')?.value;
        const c = control.get('confirmPassword')?.value;
        return p === c ? null : { passwordMismatch: true };
    }

    onSubmit(): void {
        if (this.loading) return;

        if (!this.tokenJwt) {
            this.state = 'error';
            this.message = 'Token no encontrado.';
            return;
        }

        // si el backend exige email (tu swagger lo pide)
        if (!this.emailFromToken) {
            this.formError =
                'No se pudo identificar el usuario desde el enlace. Solicita un nuevo enlace.';
            return;
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const payload = {
            token: this.tokenJwt,
            email: this.emailFromToken,
            clave: String(this.form.value.password),
        };

        this.setLoading(true);

        this.authRepo
            .confirmarClave(payload)
            .pipe(
                take(1),
                finalize(() => this.setLoading(false))
            )
            .subscribe({
                next: () => {
                    this.state = 'success';
                    this.message = 'Contraseña restablecida. Ya puedes iniciar sesión.';
                    this.notify.success('Contraseña actualizada', 'Ya puedes iniciar sesión ');
                },
                error: (err: any) => {
                    const msg = err?.message || 'No se pudo restablecer la contraseña.';
                    this.formError = msg;
                    this.notify.error('Recuperar clave', msg);
                },
            });
    }

    goLogin(): void {
        if (this.loading) return;
        this.router.navigate(['/login']);
    }

    goForgot(): void {
        if (this.loading) return;
        this.router.navigate(['/forgot-password']);
    }

    private getEmailFromJwt(jwt: string): string | null {
        try {
            const parts = jwt.split('.');
            if (parts.length < 2) return null;

            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');

            const json = decodeURIComponent(
                atob(payload)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );

            const obj = JSON.parse(json);
            return typeof obj?.sub === 'string' ? obj.sub : null;
        } catch {
            return null;
        }
    }
}
