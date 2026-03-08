import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { finalize, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthRepository } from '../../data-access/auth.repository';
import { NotifyService } from 'src/app/core/services/notify.service';

type UiState = 'checking' | 'form' | 'loading' | 'success' | 'error';

@Component({
    selector: 'app-activate-invitation',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        CardModule,
        ButtonModule,
        InputTextModule,
        PasswordModule,
    ],
    templateUrl: './activate-invitation.component.html',
    styleUrl: './activate-invitation.component.scss',
})
export class ActivateInvitationComponent {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private fb = inject(FormBuilder);
    private authRepo = inject(AuthRepository);
    private notify = inject(NotifyService);
    private destroyRef = inject(DestroyRef);

    state: UiState = 'checking';
    message = 'Validando token…';
    email: string | null = null;

    token = '';
    org = 0;   // idSegOrganizacionUsuario
    modo = 0;  // 0 nuevo, 1 existente

    loading = false;

    private passwordMatchValidator = (control: AbstractControl): ValidationErrors | null => {
        const p = control.get('clave')?.value;
        const c = control.get('confirmClave')?.value;
        return p === c ? null : { passwordMismatch: true };
    };

    form = this.fb.group(
        {
            representante: ['', [Validators.required, Validators.minLength(2)]],
            movil: ['', [Validators.required, Validators.pattern(/^[0-9]{7,15}$/)]],
            clave: ['', [Validators.required, Validators.minLength(6)]],
            confirmClave: ['', [Validators.required]],
        },
        { validators: this.passwordMatchValidator }
    );

    constructor() {
        // UX: si edita el form, no hace nada extra por ahora
        this.form.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => { });
    }

    ngOnInit(): void {
        const token = this.route.snapshot.queryParamMap.get('token');
        const org = this.route.snapshot.queryParamMap.get('org');
        const modo = this.route.snapshot.queryParamMap.get('modo');

        if (!token) {
            this.state = 'error';
            this.message = 'Token no encontrado en el enlace.';
            return;
        }
        if (!org) {
            this.state = 'error';
            this.message = 'Parámetro org no encontrado en el enlace.';
            return;
        }

        this.token = token;
        this.org = Number(org);
        this.modo = Number(modo ?? 0);

        if (!this.org || Number.isNaN(this.org)) {
            this.state = 'error';
            this.message = 'El parámetro org es inválido.';
            return;
        }

        // 1) validar token primero (igual que reset flow)
        this.state = 'checking';
        this.message = 'Validando token…';

        this.authRepo
            .checkResetToken(this.token)
            .pipe(take(1))
            .subscribe({
                next: () => {
                    // 2) flujo por modo
                    if (this.modo === 1) {
                        this.confirmarModo1();
                    } else {
                        this.state = 'form';
                        this.message = 'Completa tus datos para activar tu cuenta.';
                    }
                },
                error: (err: any) => {
                    this.state = 'error';
                    this.message = err?.message || 'Token inválido o expirado.';
                    this.notify.error('Invitación', this.message);
                },
            });
    }

    private confirmarModo1() {
        this.state = 'loading';
        this.message = 'Confirmando invitación…';

        // modo 1: datos no importan, mandamos dummy
        const payload = {
            token: this.token,
            clave: 'x',
            representante: 'x',
            movil: '0',
            organizacion: this.org,
            modo: this.modo,
        };

        this.authRepo
            .confirmarInvitacion(payload)
            .pipe(take(1), finalize(() => { }))
            .subscribe({
                next: (data) => {
                    this.state = 'success';
                    this.email = data?.token ?? null;
                    this.message = 'Invitación confirmada. Ya puedes iniciar sesión.';
                    this.notify.success('Invitación confirmada ', 'Ya puedes iniciar sesión');
                },
                error: (err: any) => {
                    this.state = 'error';
                    this.message =
                        err?.message || 'No se pudo confirmar la invitación. El token puede estar inválido o expirado.';
                    this.notify.error('Invitación', this.message);
                },
            });
    }

    submitModo0() {
        if (this.loading) return;

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading = true;
        this.state = 'loading';
        this.message = 'Activando tu cuenta…';

        this.form.disable({ emitEvent: false });

        const v = this.form.getRawValue();
        const payload = {
            token: this.token,
            clave: String(v.clave),
            representante: String(v.representante).trim(),
            movil: String(v.movil).trim(),
            organizacion: this.org,
            modo: this.modo,
        };

        this.authRepo
            .confirmarInvitacion(payload)
            .pipe(
                take(1),
                finalize(() => {
                    this.loading = false;
                    this.form.enable({ emitEvent: false });
                })
            )
            .subscribe({
                next: (data) => {
                    this.state = 'success';
                    this.email = data?.token ?? null;
                    this.message = 'Cuenta activada por invitación. Ya puedes iniciar sesión.';
                    this.notify.success('Cuenta activada ', 'Ya puedes iniciar sesión');
                },
                error: (err: any) => {
                    this.state = 'form'; // vuelve al form para corregir
                    const msg =
                        err?.message || 'No se pudo activar la invitación. Revisa los datos o intenta nuevamente.';
                    this.message = msg;
                    this.notify.error('Invitación', msg);
                },
            });
    }

    goLogin(): void {
        this.router.navigate(['/login']);
    }

    goRegister(): void {
        this.router.navigate(['/register']);
    }

    // getters
    get representante() { return this.form.get('representante'); }
    get movil() { return this.form.get('movil'); }
    get clave() { return this.form.get('clave'); }
    get confirmClave() { return this.form.get('confirmClave'); }
}
