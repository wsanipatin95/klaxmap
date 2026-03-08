import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

import { finalize, take } from 'rxjs/operators';

import { AuthRepository } from '../../data-access/auth.repository';
import { NotifyService } from 'src/app/core/services/notify.service';

type UiState = 'loading' | 'success' | 'error';

@Component({
    selector: 'app-activate-account',
    standalone: true,
    imports: [CommonModule, RouterModule, CardModule, ButtonModule],
    templateUrl: './activate-account.component.html',
    styleUrl: './activate-account.component.scss',
})
export class ActivateAccountComponent {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authRepo = inject(AuthRepository);
    private notify = inject(NotifyService);

    state: UiState = 'loading';
    message = 'Validando token…';
    email: string | null = null;

    ngOnInit(): void {
        const token = this.route.snapshot.queryParamMap.get('token');

        if (!token) {
            this.state = 'error';
            this.message = 'Token no encontrado en el enlace.';
            return;
        }

        this.state = 'loading';
        this.message = 'Activando tu cuenta…';

        this.authRepo
            .confirmarCuenta(token)
            .pipe(
                take(1),
                finalize(() => { })
            )
            .subscribe({
                next: (data) => {
                    this.state = 'success';
                    this.email = data?.token ?? null;
                    this.message = 'Cuenta activada correctamente. Ya puedes iniciar sesión.';
                    this.notify.success('Cuenta activada', 'Ya puedes iniciar sesión');
                },
                error: (err: any) => {
                    this.state = 'error';
                    this.message =
                        err?.message ||
                        'No se pudo activar la cuenta. El token puede estar inválido o expirado.';
                    this.notify.error('Activación', this.message);
                },
            });
    }

    goLogin(): void {
        this.router.navigate(['/login']);
    }

    goRegister(): void {
        this.router.navigate(['/register']);
    }
}
