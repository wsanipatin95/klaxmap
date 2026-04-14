import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
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

interface AuditoriaCellDetail {
  title: string;
  value: string;
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
  readonly detail = signal<AuditoriaCellDetail | null>(null);

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

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeDetail();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tabla'] || changes['idRegistro'] || changes['refreshKey']) {
      this.cargar();
    }
  }

  cargar() {
    if (!this.tabla || this.idRegistro == null || this.idRegistro === '') {
      this.data.set(null);
      this.error.set(null);
      this.closeDetail();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.closeDetail();

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

  hasRows(): boolean {
    return this.rows().length > 0;
  }

  previewValue(
    value: string | null | undefined,
    fieldLabel?: string | null,
    max = 92
  ): string {
    const cleaned = this.extractUsefulValue(value, fieldLabel);
    if (!cleaned) return '—';
    return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
  }

  fullValue(value: string | null | undefined, fieldLabel?: string | null): string {
    const normalized = this.normalizeValue(value);
    if (!normalized) return 'Sin valor';

    const pairs = this.parseStructuredPairs(normalized);
    if (pairs.length) {
      return pairs
        .map((pair) => `${this.humanizePairKey(pair.key)}: ${pair.value || '—'}`)
        .join('\n');
    }

    const field = this.normalizeFieldName(fieldLabel);
    if (field.includes('geometria resumen')) {
      const wkt = this.extractStructuredKey(normalized, 'wkt');
      const geomTipo = this.extractStructuredKey(normalized, 'geomTipo');
      if (wkt || geomTipo) {
        return [geomTipo ? `Tipo: ${geomTipo}` : '', wkt ? `WKT: ${wkt}` : '']
          .filter(Boolean)
          .join('\n');
      }
    }

    return normalized;
  }

  canOpenDetail(
    value: string | null | undefined,
    fieldLabel?: string | null,
    max = 92
  ): boolean {
    const preview = this.previewValue(value, fieldLabel, max);
    const full = this.fullValue(value, fieldLabel);
    return full !== 'Sin valor' && (preview !== full || full.length > max);
  }

  openDetail(event: MouseEvent, title: string, value: string) {
    event.stopPropagation();

    this.detail.set({
      title,
      value: value || 'Sin valor',
    });
  }

  closeDetail() {
    this.detail.set(null);
  }

  private isUsefulChange(cambio: AuditoriaCambio): boolean {
    const before = this.normalizeValue(cambio.valorAnterior);
    const after = this.normalizeValue(cambio.valorNuevo);
    const resumen = this.normalizeValue(cambio.resumenHumano);
    const campo = this.normalizeValue(cambio.campoLabel || cambio.campo);

    if (!campo && !resumen && !before && !after) {
      return false;
    }

    if (before === after && !resumen) {
      return false;
    }

    return true;
  }

  private extractUsefulValue(
    value: string | null | undefined,
    fieldLabel?: string | null
  ): string {
    const normalized = this.normalizeValue(value);
    if (!normalized) return '';

    const field = this.normalizeFieldName(fieldLabel);

    if (field.includes('geometria')) {
      const wkt = this.extractWkt(normalized) || this.extractStructuredKey(normalized, 'wkt');
      const geomTipo = this.extractStructuredKey(normalized, 'geomTipo');

      if (field.includes('geometria resumen') && (wkt || geomTipo)) {
        return [geomTipo, wkt].filter(Boolean).join(': ');
      }

      if (wkt) return wkt;
    }

    if (field.includes('resumen de edicion') || field.includes('registro completo')) {
      const structured = this.summarizeStructured(normalized, 2);
      if (structured) return structured;
    }

    const genericStructured = this.summarizeStructured(normalized, 2);
    if (genericStructured) return genericStructured;

    return normalized;
  }

  private summarizeStructured(value: string, limit: number): string | null {
    const pairs = this.parseStructuredPairs(value);
    if (!pairs.length) return null;

    const compact = pairs
      .slice(0, limit)
      .map((pair) => `${this.humanizePairKey(pair.key)}: ${pair.value}`)
      .join(' · ');

    return pairs.length > limit ? `${compact}…` : compact;
  }

  private parseStructuredPairs(value: string): Array<{ key: string; value: string }> {
    let source = value.trim();
    if (!source) return [];

    if (source.startsWith('{') && source.endsWith('}')) {
      source = source.slice(1, -1).trim();
    }

    if (!source.includes('=') && !source.includes(':')) {
      return [];
    }

    const parts = source
      .split(/,(?=\s*[\w.-]+\s*[:=])/g)
      .map((part) => part.trim())
      .filter(Boolean);

    const pairs = parts
      .map((part) => {
        const match = part.match(/^([\w.-]+)\s*[:=]\s*(.+)$/);
        if (!match) return null;

        return {
          key: match[1].trim(),
          value: match[2].trim(),
        };
      })
      .filter((item): item is { key: string; value: string } => !!item);

    return pairs;
  }

  private extractStructuredKey(value: string, key: string): string | null {
    const regex = new RegExp(`${key}\\s*[:=]\\s*(.+?)(?=,\\s*[\\w.-]+\\s*[:=]|\\}$)`, 'i');
    const match = value.match(regex);
    return match?.[1]?.trim() || null;
  }

  private extractWkt(value: string): string | null {
    const match = value.match(
      /\b(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON)\s*\(.+\)/i
    );

    return match?.[0]?.trim() || null;
  }

  private humanizePairKey(key: string): string {
    const normalized = key.trim();

    if (!normalized) return 'Campo';
    if (/^idrednodofk$/i.test(normalized)) return 'Nodo';
    if (/^idgeotipoelementofk$/i.test(normalized)) return 'Tipo';
    if (/^geomtipo$/i.test(normalized)) return 'Tipo geom.';
    if (/^wkt$/i.test(normalized)) return 'WKT';

    return normalized
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_.-]+/g, ' ')
      .trim();
  }

  private normalizeFieldName(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}