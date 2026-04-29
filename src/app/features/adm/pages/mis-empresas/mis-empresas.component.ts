import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule  } from 'primeng/toggleswitch';

import { EmpresaUsuariosRepository } from 'src/app/features/org/data-access/empresa-usuarios.repository';
import type { EmpresaUsuarioDto } from 'src/app/features/org/data-access/empresa-usuarios.models';

import { UsuarioPrivilegiosRepository } from 'src/app/features/org/data-access/usuario-privilegios.repository';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { NotifyService } from 'src/app/core/services/notify.service';
import { SessionLandingService } from 'src/app/core/services/session-landing.service';

@Component({
    selector: 'app-mis-empresas',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        ToggleSwitchModule,
    ],
    templateUrl: './mis-empresas.component.html',
    styleUrl: './mis-empresas.component.scss',
})
export class MisEmpresasComponent implements OnInit {
    private repo = inject(EmpresaUsuariosRepository);
    private usuPrivRepo = inject(UsuarioPrivilegiosRepository);
    private sessionStore = inject(SessionStore);
    private notify = inject(NotifyService);
    private router = inject(Router);
    private landing = inject(SessionLandingService);

    loading = signal(false);
    entering = signal(false);

    q = '';
    verTodos = true;

    page = 0;
    size = 10;
    totalElements = 0;

    items = signal<EmpresaUsuarioDto[]>([]);

    get usu(): number {
        return this.sessionStore.user()?.id ?? 0;
    }

    ngOnInit(): void {
        this.cargar();
    }

    // ===== helpers seguros (evitan "as any" en HTML) =====
    private rowIdEmpresa(row: EmpresaUsuarioDto): string {
        return String((row as any)?.idSegOrganizacionEmpresaFk ?? '').trim();
    }

    empresaLabel(row: any) {
        return row?.empresa || '—';
    }

    empresaUuid(row: any) {
        return row?.idSegOrganizacionEmpresaFk || '—';
    }

    empresaNombre(row: EmpresaUsuarioDto): string {
        return String((row as any)?.empresa ?? '—');
    }

    isRowActive(row: EmpresaUsuarioDto): boolean {
        return ((row as any)?.estado ?? 1) === 1;
    }

    isRowActiveEmpresa(row: EmpresaUsuarioDto): boolean {
        return ((row as any)?.estadoEmpresa ?? 1) === 1;
    }

    estadoLabel(row: EmpresaUsuarioDto) {
        return this.isRowActive(row) ? 'Activa' : 'Inactiva';
    }

    estadoEmpresaLabel(row: EmpresaUsuarioDto) {
        return this.isRowActive(row) ? 'Activa' : 'Inactiva';
    }

    get filteredItems(): EmpresaUsuarioDto[] {
        const base = this.verTodos
            ? this.items()
            : this.items().filter((x) => this.isRowActiveEmpresa(x));

        const term = (this.q || '').trim().toLowerCase();
        if (!term) return base;

        return base.filter((x) => this.empresaNombre(x).toLowerCase().includes(term));
    }

    cargar() {
        if (!this.usu) return;

        this.loading.set(true);
        this.repo
            .listarEmpresasDeUsuario(this.usu, this.page, this.size, this.verTodos)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (paged: any) => {
                    this.items.set(paged.items ?? []);
                    this.totalElements = paged.totalElements ?? 0;
                },
                error: (err) => {
                    console.error('mis-empresas listarEmpresasDeUsuario error:', err);
                    this.notify.error(
                        'No se pudo cargar',
                        err?.message || 'Error al listar tus empresas.'
                    );
                },
            });
    }

    onLazyLoad(ev: any) {
        this.page = ev.page ?? 0;
        this.size = ev.rows ?? this.size;
        this.cargar();
    }

    onToggleVerTodos() {
        this.page = 0;
        this.cargar();
    }

    entrar(row: EmpresaUsuarioDto) {
        const idEmpresa = this.rowIdEmpresa(row);
        if (!idEmpresa) return;

        if (!this.isRowActive(row)) {
            this.notify.info('Empresa inactiva', 'No puedes entrar a una empresa inactiva.');
            return;
        }

        if (this.entering()) return;
        this.entering.set(true);

        const companyName = this.empresaNombre(row);

        // Refresca sesión por empresa (menus/privilegios bajo tenant).
        // La ruta inicial ya no sale del primer menú dinámico.
        // Regla:
        // - inno -> mapas
        // - dumax -> órdenes
        // - cualquier otra empresa -> dashboard
        this.usuPrivRepo
            .menusEmpresa(this.usu)
            .pipe(finalize(() => this.entering.set(false)))
            .subscribe({
                next: (res: any) => {
                    const privilegiosEmpresa = res?.privilegiosEmpresa ?? [];
                    const menusEmpresa = res?.menusEmpresa ?? [];

                    this.sessionStore.patchSession({
                        privilegiosEmpresa,
                        menusEmpresa,
                    });

                    const target = this.landing.getLandingUrlForCompanyName(companyName);
                    this.router.navigateByUrl(target);
                },
                error: (err) => {
                    console.error('menusEmpresa error:', err);
                    this.notify.error(
                        'No se pudo entrar',
                        err?.message || 'Error al cargar permisos/menú de la empresa.'
                    );
                },
            });
    }

    salirDeEmpresa() {
        this.router.navigate(['/app/mis-empresas']);
    }
}
