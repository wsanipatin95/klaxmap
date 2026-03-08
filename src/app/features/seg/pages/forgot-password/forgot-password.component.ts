import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { finalize, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthRepository } from '../../data-access/auth.repository';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputTextModule,
    ButtonModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authRepo = inject(AuthRepository);
  private notify = inject(NotifyService);
  private destroyRef = inject(DestroyRef);

  forgotPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = false;
  submitted = false;

  // UX: error/success del backend
  formError: string | null = null;
  successMsg: string | null = null;

  constructor() {
    // UX: al escribir, limpiamos error
    this.forgotPasswordForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.formError) this.formError = null;
      });
  }

  get email() {
    return this.forgotPasswordForm.get('email');
  }

  onSubmit(): void {
    if (this.loading) return;

    if (this.forgotPasswordForm.invalid) {
      this.email?.markAsTouched();
      return;
    }

    this.loading = true;
    this.formError = null;
    this.successMsg = null;

    this.forgotPasswordForm.disable({ emitEvent: false });
    const { email } = this.forgotPasswordForm.getRawValue();
    const usuario = String(email).trim();

    this.authRepo.resetearClave(usuario).pipe(
      take(1),
      finalize(() => {
        this.loading = false;
        this.forgotPasswordForm.enable({ emitEvent: false });
      })
    ).subscribe({
      next: () => {
        // Swagger: "se ha enviado un correo correctamente"
        this.successMsg = 'Se ha enviado un correo correctamente. Revisa tu bandeja de entrada.';
        this.submitted = true;
        this.notify.success('Recuperación de contraseña', 'Correo enviado correctamente ');
      },
      error: (err: any) => {
        const msg = err?.message || 'Error de conexión. Intenta nuevamente.';
        this.formError = msg;
        this.notify.error('Recuperación de contraseña', msg);
      }
    });
  }

  backToLogin(): void {
    if (this.loading) return;
    this.router.navigate(['/login']);
  }

  // opcional: botón para reenviar
  resend(): void {
    if (this.loading) return;
    this.submitted = false;
    this.onSubmit();
  }
}
