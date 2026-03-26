import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AuditoriaRepository } from '../../data-access/auditoria.repository';
import type {
  AuditoriaSupervisorFilters,
  AuditoriaSupervisorItem,
  AuditoriaSupervisorResponse,
} from '../../data-access/auditoria.models';

@Component({
  selector: 'app-auditoria-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './auditoria-supervisor.component.html',
  styleUrl: './auditoria-supervisor.component.scss',
})
export class AuditoriaSupervisorComponent {
  private repo = inject(AuditoriaRepository);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<AuditoriaSupervisorResponse | null>(null);

  readonly filtros = signal<AuditoriaSupervisorFilters>({
    q: '',
    usuario: null,
    tabla: '',
    operacion: '',
    idRegistro: '',
    fechaDesde: '',
    fechaHasta: '',
    page: 0,
    size: 25,
    all: false,
  });

  readonly items = computed(() => this.data()?.items ?? []);
  readonly totalElements = computed(() => this.data()?.totalElements ?? this.data()?.total ?? 0);
  readonly totalPages = computed(() => this.data()?.totalPages ?? 0);
  readonly currentPage = computed(() => this.data()?.page ?? 0);
  readonly pageSize = computed(() => this.data()?.size ?? this.filtros().size ?? 25);

  readonly tablaOptions = [
    { label: 'Todas', value: '' },
    { label: 'Mapa / Elementos', value: 'kxt_geo_elemento' },
    { label: 'Mapa / Tipos de elemento', value: 'kxt_geo_tipo_elemento' },
    { label: 'Mapa / Nodos', value: 'kxt_red_nodo' },
    { label: 'Mapa / Importaciones', value: 'kxt_geo_import_lote' },
    { label: 'Mapa / Importación detalle', value: 'kxt_geo_import_detalle' },
    { label: 'Seguridad / Usuarios', value: 'kxt_seg_usuario' },
    { label: 'Seguridad / Auditoría', value: 'kxt_seg_auditoria' },
  ];

  readonly operacionOptions = [
    { label: 'Todas', value: '' },
    { label: 'Creación', value: 'INSERT' },
    { label: 'Edición', value: 'UPDATE' },
    { label: 'Eliminación', value: 'DELETE' },
  ];

  readonly totalInserciones = computed(() =>
    this.items().filter((x) => String(x.operacion || '').toUpperCase() === 'INSERT').length
  );

  readonly totalEdiciones = computed(() =>
    this.items().filter((x) => String(x.operacion || '').toUpperCase() === 'UPDATE').length
  );

  readonly totalEliminaciones = computed(() =>
    this.items().filter((x) => String(x.operacion || '').toUpperCase() === 'DELETE').length
  );

  constructor() {
    this.buscar();
  }

  buscar(resetPage = true) {
    this.loading.set(true);
    this.error.set(null);

    const filtros = this.filtros();
    const payload: AuditoriaSupervisorFilters = {
      ...filtros,
      page: resetPage ? 0 : (filtros.page ?? 0),
    };

    this.repo.listarSupervisor(payload)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.filtros.set({
            ...this.filtros(),
            page: payload.page ?? 0,
          });
          this.data.set(resp);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar la auditoría.');
        },
      });
  }

  limpiar() {
    this.filtros.set({
      q: '',
      usuario: null,
      tabla: '',
      operacion: '',
      idRegistro: '',
      fechaDesde: '',
      fechaHasta: '',
      page: 0,
      size: 25,
      all: false,
    });
    this.buscar(true);
  }

  setFiltro<K extends keyof AuditoriaSupervisorFilters>(key: K, value: AuditoriaSupervisorFilters[K]) {
    this.filtros.set({
      ...this.filtros(),
      [key]: value,
    });
  }

  prevPage() {
    const current = this.currentPage();
    if (current <= 0) return;

    this.filtros.set({
      ...this.filtros(),
      page: current - 1,
    });
    this.buscar(false);
  }

  nextPage() {
    const current = this.currentPage();
    const total = this.totalPages();
    if (total <= 0 || current + 1 >= total) return;

    this.filtros.set({
      ...this.filtros(),
      page: current + 1,
    });
    this.buscar(false);
  }

  trackById(_: number, item: AuditoriaSupervisorItem) {
    return item.idSegAuditoria;
  }

  shortValue(value: string | null | undefined, max = 180): string {
    if (value == null || value === '') return '—';
    return value.length > max ? value.slice(0, max) + '…' : value;
  }

  operacionClass(value: string | null | undefined): string {
    const op = String(value ?? '').toUpperCase();
    if (op === 'INSERT') return 'is-insert';
    if (op === 'UPDATE') return 'is-update';
    if (op === 'DELETE') return 'is-delete';
    return 'is-default';
  }

  hasFiltersApplied(): boolean {
    const f = this.filtros();
    return !!(
      (f.q && f.q.trim()) ||
      f.usuario != null ||
      (f.tabla && f.tabla.trim()) ||
      (f.operacion && f.operacion.trim()) ||
      (f.idRegistro && f.idRegistro.trim()) ||
      (f.fechaDesde && f.fechaDesde.trim()) ||
      (f.fechaHasta && f.fechaHasta.trim())
    );
  }
}