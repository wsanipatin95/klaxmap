import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ReactiveFormsModule,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

import { finalize, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NotifyService } from 'src/app/core/services/notify.service';
import { AuthRepository } from '../../data-access/auth.repository';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private authRepo = inject(AuthRepository);
  private destroyRef = inject(DestroyRef);

  loading = false;
  registerError: string | null = null;

  private passwordMatchValidator = (control: AbstractControl): ValidationErrors | null => {
    const p = control.get('password')?.value;
    const c = control.get('confirmPassword')?.value;
    return p === c ? null : { passwordMismatch: true };
  };

  registerForm = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],

      organization: ['', [Validators.required, Validators.minLength(2)]],

      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{7,15}$/)]],
      email: ['', [Validators.required, Validators.email]],

      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],

      acceptTerms: [false, [Validators.requiredTrue]],
      receiveUpdates: [false],
    },
    { validators: this.passwordMatchValidator }
  );

  constructor() {
    // UX: si el usuario edita, limpiamos el error global
    this.registerForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.registerError) this.registerError = null;
      });
  }

  onSubmit(): void {
    if (this.loading) return;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.registerError = null;

    this.registerForm.disable({ emitEvent: false });
    const v = this.registerForm.getRawValue();

    const payload = {
      usuario: String(v.email).trim(),
      clave: String(v.password),
      organizacion: String(v.organization).trim(),
      representante: `${String(v.firstName).trim()} ${String(v.lastName).trim()}`.trim(),
      movil: String(v.phone).trim(),
    };

    this.authRepo
      .registroGlobal(payload)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.registerForm.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: () => {
          this.notify.success('Empresa registrada correctamente ');
          this.router.navigate(['/login']);
        },
        error: (err: any) => {
          // Aquí cae el Error lanzado por codigo!=0 y también errores de red reales
          const msg = err?.message || 'Error de conexión. Intenta nuevamente.';
          this.registerError = msg;
          this.notify.error('Registro Global', msg);
        },
      });
  }

  // getters para el template
  get firstName() { return this.registerForm.get('firstName'); }
  get lastName() { return this.registerForm.get('lastName'); }
  get organization() { return this.registerForm.get('organization'); }
  get phone() { return this.registerForm.get('phone'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }
  get acceptTerms() { return this.registerForm.get('acceptTerms'); }
}
