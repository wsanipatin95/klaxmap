import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AuditoriaRepository } from 'src/app/features/adm/data-access/auditoria.repository';
import type {
  AuditoriaCambio,
  AuditoriaRegistroResponse,
} from 'src/app/features/adm/data-access/auditoria.models';

interface AuditoriaLedgerRow {
  rowId: string;
  fechaHora: string | null;
  usuarioLogin: string | null;
  usuarioId: number | null;
  operacion: string | null;
  operacionLabel: string | null;
  campo: string | null;
  campoLabel: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  resumenHumano: string;
  modulo: string;
  entidad: string;
  tablaLabel: string;
  idRegistro: string;
}

@Component({
  selector: 'app-auditoria-registro',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './auditoria-registro.component.html',
  styleUrl: './auditoria-registro.component.scss',
})
export class AuditoriaRegistroComponent implements OnChanges {
  private readonly repo = inject(AuditoriaRepository);

  @Input({ required: true }) tabla!: string;
  @Input() idRegistro: string | number | null = null;
  @Input() titulo = 'Historial';
  @Input() subtitulo = 'Trazabilidad del registro';
  @Input() compact = false;
  @Input() refreshKey: string | number | null = null;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<AuditoriaRegistroResponse | null>(null);

  readonly rows = computed<AuditoriaLedgerRow[]>(() => {
    const audit = this.data();
    if (!audit) return [];

    const result: AuditoriaLedgerRow[] = [];

    for (const grupo of audit.historial ?? []) {
      for (const cambio of grupo.cambios ?? []) {
        if (!this.isUsefulChange(cambio)) {
          continue;
        }

        result.push({
          rowId: `${grupo.grupoId}::${cambio.idSegAuditoria}::${cambio.campo ?? 'campo'}`,
          fechaHora: grupo.fechaHora,
          usuarioLogin: grupo.usuarioLogin,
          usuarioId: grupo.usuarioId,
          operacion: grupo.operacion,
          operacionLabel: grupo.operacionLabel,
          campo: cambio.campo,
          campoLabel: cambio.campoLabel || cambio.campo || 'Cambio',
          valorAnterior: cambio.valorAnterior,
          valorNuevo: cambio.valorNuevo,
          resumenHumano: cambio.resumenHumano || '',
          modulo: grupo.modulo,
          entidad: grupo.entidad,
          tablaLabel: grupo.tablaLabel,
          idRegistro: grupo.idRegistro,
        });
      }
    }

    return result;
  });

  readonly totalRows = computed(() => this.rows().length);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tabla'] || changes['idRegistro'] || changes['refreshKey']) {
      this.cargar();
    }
  }

  cargar() {
    if (!this.tabla || this.idRegistro == null || this.idRegistro === '') {
      this.data.set(null);
      this.error.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.repo
      .historialRegistro(this.tabla, this.idRegistro)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.data.set(resp);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar el historial.');
        },
      });
  }

  trackRow(_: number, item: AuditoriaLedgerRow) {
    return item.rowId;
  }

  displayUsuario(row: AuditoriaLedgerRow): string {
    return row.usuarioLogin?.trim() || (row.usuarioId != null ? `Usuario ${row.usuarioId}` : 'Sistema');
  }

  displayOperacion(value: string | null | undefined, fallback?: string | null): string {
    if (fallback && fallback.trim()) return fallback;

    const op = String(value ?? '').toUpperCase();
    if (op === 'INSERT') return 'Creación';
    if (op === 'UPDATE') return 'Edición';
    if (op === 'DELETE') return 'Eliminación';
    return 'Movimiento';
  }

  operacionClass(value: string | null | undefined): string {
    const op = String(value ?? '').toUpperCase();
    if (op === 'INSERT') return 'is-insert';
    if (op === 'UPDATE') return 'is-update';
    if (op === 'DELETE') return 'is-delete';
    return 'is-default';
  }

  oneLine(value: string | null | undefined, max = 180): string {
    const normalized = String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return '—';
    return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
  }

  hasRows(): boolean {
    return this.rows().length > 0;
  }

  private isUsefulChange(cambio: AuditoriaCambio): boolean {
    const before = this.cleanValue(cambio.valorAnterior);
    const after = this.cleanValue(cambio.valorNuevo);
    const resumen = this.cleanValue(cambio.resumenHumano);
    const campo = this.cleanValue(cambio.campoLabel || cambio.campo);

    if (!campo && !resumen && !before && !after) {
      return false;
    }

    if (before === after && !resumen) {
      return false;
    }

    return true;
  }

  private cleanValue(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}