import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { AuthRepository } from '../../data-access/auth.repository';
import { NotifyService } from 'src/app/core/services/notify.service';
import { HttpErrorResponse } from '@angular/common/http';

import { finalize, take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    FloatLabelModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authRepo = inject(AuthRepository);
  private notify = inject(NotifyService);
  private destroyRef = inject(DestroyRef);

  loading = false;
  loginError: string | null = null;

  loginForm = this.fb.group({
    usuario: ['', [Validators.required]],
    clave: ['', [Validators.required]],
  });

  get usuario() {
    return this.loginForm.get('usuario');
  }

  get clave() {
    return this.loginForm.get('clave');
  }

  constructor() {
    this.loginForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.loginError) this.loginError = null;
      });
  }

  onSubmit(): void {
    if (this.loading) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.loginError = null;
    this.loginForm.disable({ emitEvent: false });

    const { usuario, clave } = this.loginForm.getRawValue(); 
    const returnUrl =
      this.route.snapshot.queryParamMap.get('returnUrl') || '/app/mis-empresas';

    this.authRepo
      .login({
        usuario: usuario!,
        clave: clave!,
      })
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.loginForm.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: () => {
          this.notify.success('Bienvenido 👋');
          this.router.navigateByUrl(returnUrl);
        },
        error: (err: HttpErrorResponse) => {
          const backendError =
            (err?.error && (err.error.error || err.error.message)) ||
            err?.message ||
            'Credenciales inválidas o error de conexión';

          console.error('Error login:', err);
          this.loginError = backendError;
          this.notify.error('Error al iniciar sesión', backendError);
        },
      });
  }
}
