import { CommonModule, DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AuditoriaRepository } from '../../data-access/auditoria.repository';
import type {
  AuditoriaSupervisorFilters,
  AuditoriaSupervisorItem,
  AuditoriaSupervisorResponse,
} from '../../data-access/auditoria.models';

interface AuditoriaCellPopover {
  title: string;
  value: string;
  x: number;
  y: number;
}

type AuditoriaSupervisorSortKey =
  | 'fecha'
  | 'usuario'
  | 'contexto'
  | 'registro'
  | 'operacion'
  | 'campo'
  | 'antes'
  | 'despues'
  | 'resumen';

type AuditoriaSupervisorSortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-auditoria-supervisor',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './auditoria-supervisor.component.html',
  styleUrl: './auditoria-supervisor.component.scss',
})
export class AuditoriaSupervisorComponent {
  private readonly repo = inject(AuditoriaRepository);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<AuditoriaSupervisorResponse | null>(null);
  readonly popover = signal<AuditoriaCellPopover | null>(null);

  readonly sortKey = signal<AuditoriaSupervisorSortKey>('fecha');
  readonly sortDirection = signal<AuditoriaSupervisorSortDirection>('desc');

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
  readonly sortedItems = computed(() => {
    const rows = [...this.items()];
    const key = this.sortKey();
    const direction = this.sortDirection();
    const factor = direction === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      const comparison = this.compareItems(a, b, key);
      if (comparison !== 0) {
        return comparison * factor;
      }

      return Number(a.idSegAuditoria ?? 0) - Number(b.idSegAuditoria ?? 0);
    });

    return rows;
  });

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

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closePopover();
  }

  buscar(resetPage = true) {
    this.loading.set(true);
    this.error.set(null);
    this.closePopover();

    const filtros = this.filtros();
    const payload: AuditoriaSupervisorFilters = {
      ...filtros,
      page: resetPage ? 0 : (filtros.page ?? 0),
    };

    this.repo
      .listarSupervisor(payload)
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

  setSort(key: AuditoriaSupervisorSortKey) {
    if (this.sortKey() === key) {
      this.sortDirection.update((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set(key === 'fecha' ? 'desc' : 'asc');
  }

  isSortedBy(key: AuditoriaSupervisorSortKey): boolean {
    return this.sortKey() === key;
  }

  sortArrow(key: AuditoriaSupervisorSortKey): string {
    if (!this.isSortedBy(key)) {
      return '↕';
    }

    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  sortAriaLabel(key: AuditoriaSupervisorSortKey, label: string): string {
    const current = this.isSortedBy(key)
      ? this.sortDirection() === 'asc'
        ? 'ascendente'
        : 'descendente'
      : 'sin orden aplicado';

    return `${label}. Estado actual: ${current}. Presiona para ordenar.`;
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

  displayUsuario(item: AuditoriaSupervisorItem): string {
    return item.usuarioLogin?.trim() || 'Sistema';
  }

  displayContexto(item: AuditoriaSupervisorItem): string {
    const parts = [item.entidad, item.modulo, item.tablaLabel]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean);

    return parts.join(' · ') || '—';
  }

  displayCampo(item: AuditoriaSupervisorItem): string {
    return item.campoLabel?.trim() || item.campo?.trim() || 'Cambio';
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
      (f.tabla && f.tabla.trim()) ||
      (f.operacion && f.operacion.trim()) ||
      (f.fechaDesde && f.fechaDesde.trim()) ||
      (f.fechaHasta && f.fechaHasta.trim()) ||
      (f.size && f.size !== 25)
    );
  }

  previewValue(
    value: string | null | undefined,
    fieldLabel?: string | null,
    max = 88
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
    max = 88
  ): boolean {
    const preview = this.previewValue(value, fieldLabel, max);
    const full = this.fullValue(value, fieldLabel);
    return full !== 'Sin valor' && (preview !== full || full.length > max);
  }

  openPopover(event: MouseEvent, title: string, value: string) {
    event.stopPropagation();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const boxWidth = 540;
    const boxHeight = 360;
    const margin = 16;

    const desiredX = event.clientX + 12;
    const desiredY = event.clientY + 12;

    const x = Math.max(margin, Math.min(desiredX, viewportWidth - boxWidth - margin));
    const y = Math.max(margin, Math.min(desiredY, viewportHeight - boxHeight - margin));

    this.popover.set({
      title,
      value: value || 'Sin valor',
      x,
      y,
    });
  }

  closePopover() {
    this.popover.set(null);
  }

  private compareItems(
    a: AuditoriaSupervisorItem,
    b: AuditoriaSupervisorItem,
    key: AuditoriaSupervisorSortKey
  ): number {
    switch (key) {
      case 'fecha':
        return this.compareDates(a.fechaHora, b.fechaHora);

      case 'usuario':
        return this.compareText(this.displayUsuario(a), this.displayUsuario(b));

      case 'contexto':
        return this.compareText(this.displayContexto(a), this.displayContexto(b));

      case 'registro':
        return this.compareNumbers(a.idRegistro, b.idRegistro);

      case 'operacion':
        return this.compareText(a.operacionLabel || a.operacion, b.operacionLabel || b.operacion);

      case 'campo':
        return this.compareText(this.displayCampo(a), this.displayCampo(b));

      case 'antes':
        return this.compareText(
          this.fullValue(a.valorAnterior, a.campoLabel),
          this.fullValue(b.valorAnterior, b.campoLabel)
        );

      case 'despues':
        return this.compareText(
          this.fullValue(a.valorNuevo, a.campoLabel),
          this.fullValue(b.valorNuevo, b.campoLabel)
        );

      case 'resumen':
        return this.compareText(
          this.fullValue(a.resumenHumano, a.campoLabel),
          this.fullValue(b.resumenHumano, b.campoLabel)
        );

      default:
        return 0;
    }
  }

  private compareDates(a: string | null | undefined, b: string | null | undefined): number {
    const left = this.dateToMillis(a);
    const right = this.dateToMillis(b);

    if (left === right) return 0;
    return left < right ? -1 : 1;
  }

  private dateToMillis(value: string | null | undefined): number {
    const time = Date.parse(String(value ?? '').trim());
    return Number.isFinite(time) ? time : 0;
  }

  private compareNumbers(a: string | number | null | undefined, b: string | number | null | undefined): number {
    const left = Number(a ?? 0);
    const right = Number(b ?? 0);

    if (left === right) return 0;
    return left < right ? -1 : 1;
  }

  private compareText(a: string | null | undefined, b: string | null | undefined): number {
    const left = String(a ?? '').trim().toLocaleLowerCase();
    const right = String(b ?? '').trim().toLocaleLowerCase();

    return left.localeCompare(right, 'es', {
      numeric: true,
      sensitivity: 'base',
    });
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