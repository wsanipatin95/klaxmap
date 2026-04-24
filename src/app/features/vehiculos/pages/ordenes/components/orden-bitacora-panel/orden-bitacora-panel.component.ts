import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs/operators';
import { VehiculosEmptyStateComponent } from '../../../../components/empty-state/empty-state.component';
import {
  VehOrdenTrabajo,
  VehOrdenTrabajoBitacoraItem,
} from '../../../../data-access/vehiculos.models';
import { VehiculosRepository } from '../../../../data-access/vehiculos.repository';
import { NotifyService } from 'src/app/core/services/notify.service';

type BitacoraCategoriaKey = 'TODOS' | 'ORDEN' | 'CHECKLIST' | 'TRABAJOS' | 'HALLAZGOS' | 'REPUESTOS' | 'COMERCIAL' | 'GARANTIAS' | 'CLIENTE' | 'SISTEMA';

type BitacoraCategoriaOption = {
  key: BitacoraCategoriaKey;
  label: string;
  icon: string;
};

@Component({
  selector: 'app-orden-bitacora-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TagModule,
    VehiculosEmptyStateComponent,
  ],
  templateUrl: './orden-bitacora-panel.component.html',
  styleUrl: './orden-bitacora-panel.component.scss',
})
export class OrdenBitacoraPanelComponent implements OnChanges {
  private readonly repo = inject(VehiculosRepository);
  private readonly notify = inject(NotifyService);

  @Input() orden: VehOrdenTrabajo | null = null;

  readonly loading = signal(false);
  readonly items = signal<VehOrdenTrabajoBitacoraItem[]>([]);
  readonly categoria = signal<BitacoraCategoriaKey>('TODOS');
  readonly q = signal('');
  readonly tecnicoVisible = signal(false);

  readonly categorias: BitacoraCategoriaOption[] = [
    { key: 'TODOS', label: 'Todos', icon: 'pi pi-list' },
    { key: 'ORDEN', label: 'Orden', icon: 'pi pi-receipt' },
    { key: 'CHECKLIST', label: 'Checklist', icon: 'pi pi-check-square' },
    { key: 'TRABAJOS', label: 'Trabajos', icon: 'pi pi-cog' },
    { key: 'HALLAZGOS', label: 'Hallazgos', icon: 'pi pi-exclamation-circle' },
    { key: 'REPUESTOS', label: 'Repuestos', icon: 'pi pi-box' },
    { key: 'COMERCIAL', label: 'Comercial', icon: 'pi pi-dollar' },
    { key: 'GARANTIAS', label: 'Garantías', icon: 'pi pi-shield' },
    { key: 'CLIENTE', label: 'Cliente', icon: 'pi pi-user' },
    { key: 'SISTEMA', label: 'Sistema', icon: 'pi pi-server' },
  ];

  readonly filteredItems = computed(() => {
    const category = this.categoria();
    const text = this.normalize(this.q());

    return this.items().filter((item) => {
      const itemCategory = this.normalizeCategory(item.categoria || item.tipoEvento || item.entidadOrigen);
      const categoryOk = category === 'TODOS' || itemCategory === category;
      if (!categoryOk) return false;

      if (!text) return true;

      const haystack = this.normalize([
        item.titulo,
        item.descripcion,
        item.tipoEvento,
        item.categoria,
        item.usuarioLogin,
        item.entidadOrigen,
        item.idEntidadOrigen,
        item.estadoAnterior,
        item.estadoNuevo,
      ].filter(Boolean).join(' '));

      return haystack.includes(text);
    });
  });

  readonly totalNotificables = computed(() =>
    this.items().filter((item) => this.toBool(item.notificableCliente)).length,
  );

  readonly totalCliente = computed(() =>
    this.items().filter((item) => this.toBool(item.visibleCliente)).length,
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orden']) {
      this.load();
    }
  }

  load(): void {
    const id = this.orden?.idVehOrdenTrabajo;
    if (!id) {
      this.items.set([]);
      return;
    }

    this.loading.set(true);
    this.repo.listarOrdenBitacora(id, '', 0, 250, true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.items.set(this.extractItems(res)),
        error: (err) => this.notify.error('No se pudo cargar la bitácora', err?.message),
      });
  }

  setCategoria(key: BitacoraCategoriaKey): void {
    this.categoria.set(key);
  }

  clearFilters(): void {
    this.q.set('');
    this.categoria.set('TODOS');
  }

  countByCategory(key: BitacoraCategoriaKey): number {
    if (key === 'TODOS') return this.items().length;
    return this.items().filter((item) => this.normalizeCategory(item.categoria || item.tipoEvento || item.entidadOrigen) === key).length;
  }

  trackByBitacora(_: number, item: VehOrdenTrabajoBitacoraItem): number | string {
    return item.idVehOrdenTrabajoBitacora ?? `${item.fechaHora || ''}-${item.tipoEvento || ''}-${item.idEntidadOrigen || ''}`;
  }

  categoryLabel(item: VehOrdenTrabajoBitacoraItem): string {
    const key = this.normalizeCategory(item.categoria || item.tipoEvento || item.entidadOrigen);
    return this.categorias.find((cat) => cat.key === key)?.label ?? 'Evento';
  }

  categoryIcon(item: VehOrdenTrabajoBitacoraItem): string {
    const key = this.normalizeCategory(item.categoria || item.tipoEvento || item.entidadOrigen);
    return this.categorias.find((cat) => cat.key === key)?.icon ?? 'pi pi-circle';
  }

  categoryClass(item: VehOrdenTrabajoBitacoraItem): string {
    const key = this.normalizeCategory(item.categoria || item.tipoEvento || item.entidadOrigen);
    return `cat-${key.toLowerCase()}`;
  }

  eventSeverity(item: VehOrdenTrabajoBitacoraItem): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const event = this.normalize(item.tipoEvento || item.titulo || '');
    if (event.includes('ERROR') || event.includes('FALLIDA') || event.includes('RECHAZ') || event.includes('ANUL')) return 'danger';
    if (event.includes('APROB') || event.includes('FINAL') || event.includes('COBRO') || event.includes('CREAD')) return 'success';
    if (event.includes('FACTUR') || event.includes('NOTIFIC')) return 'info';
    if (event.includes('PEND') || event.includes('CAMBI') || event.includes('EDIT')) return 'warn';
    return 'secondary';
  }

  formatDateGroup(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const date = this.parseDate(value);
    if (!date) return String(value).slice(0, 10);

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (this.sameDate(date, today)) return 'Hoy';
    if (this.sameDate(date, yesterday)) return 'Ayer';

    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  formatTime(value?: string | null): string {
    if (!value) return '--:--';
    const date = this.parseDate(value);
    if (!date) return '--:--';
    return new Intl.DateTimeFormat('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  shouldShowDateHeader(index: number, item: VehOrdenTrabajoBitacoraItem): boolean {
    if (index === 0) return true;
    const current = this.formatDateGroup(item.fechaHora || item.fecGen);
    const previous = this.formatDateGroup(this.filteredItems()[index - 1]?.fechaHora || this.filteredItems()[index - 1]?.fecGen);
    return current !== previous;
  }

  userLabel(item: VehOrdenTrabajoBitacoraItem): string {
    return item.usuarioLogin || item.usuarioNombre || (item.usuario != null ? `Usuario ${item.usuario}` : 'Sistema');
  }

  compactEntity(item: VehOrdenTrabajoBitacoraItem): string {
    const entity = item.entidadOrigen || item.tabla || '';
    const id = item.idEntidadOrigen || item.idRegistro || '';
    if (!entity && !id) return '';
    if (!entity) return `#${id}`;
    if (!id) return this.humanize(entity);
    return `${this.humanize(entity)} #${id}`;
  }

  estadoChangeText(item: VehOrdenTrabajoBitacoraItem): string {
    if (!item.estadoAnterior && !item.estadoNuevo) return '';
    if (item.estadoAnterior && item.estadoNuevo) return `${item.estadoAnterior} → ${item.estadoNuevo}`;
    if (item.estadoNuevo) return `Nuevo estado: ${item.estadoNuevo}`;
    return `Estado anterior: ${item.estadoAnterior}`;
  }

  metadataPreview(item: VehOrdenTrabajoBitacoraItem): string {
    const metadata = item.metadata;
    if (!metadata) return '';

    const preferred = ['articulo', 'repuesto', 'trabajo', 'garantia', 'factura', 'cobro', 'cantidad', 'precio', 'total', 'resultado'];
    const parts: string[] = [];

    for (const key of preferred) {
      const value = (metadata as Record<string, unknown>)[key];
      if (value != null && value !== '') {
        parts.push(`${this.humanize(key)}: ${String(value)}`);
      }
      if (parts.length >= 4) break;
    }

    if (parts.length) return parts.join(' · ');

    return Object.entries(metadata as Record<string, unknown>)
      .filter(([, value]) => value != null && value !== '')
      .slice(0, 3)
      .map(([key, value]) => `${this.humanize(key)}: ${String(value)}`)
      .join(' · ');
  }

  private extractItems(res: unknown): VehOrdenTrabajoBitacoraItem[] {
    const value = res as any;
    const rawItems = Array.isArray(value)
      ? value
      : Array.isArray(value?.items)
        ? value.items
        : Array.isArray(value?.content)
          ? value.content
          : Array.isArray(value?.data?.items)
            ? value.data.items
            : [];

    return rawItems
      .map((item: any) => ({ ...item }))
      .sort((a: VehOrdenTrabajoBitacoraItem, b: VehOrdenTrabajoBitacoraItem) => {
        const ad = this.parseDate(a.fechaHora || a.fecGen)?.getTime() ?? 0;
        const bd = this.parseDate(b.fechaHora || b.fecGen)?.getTime() ?? 0;
        return bd - ad;
      });
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private sameDate(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  private normalizeCategory(raw?: string | null): BitacoraCategoriaKey {
    const value = this.normalize(raw || '');
    if (!value) return 'SISTEMA';
    if (value.includes('CHECK')) return 'CHECKLIST';
    if (value.includes('TRABAJO')) return 'TRABAJOS';
    if (value.includes('HALLAZGO') || value.includes('MARCA') || value.includes('FOTO')) return 'HALLAZGOS';
    if (value.includes('REPUESTO') || value.includes('ARTICULO')) return 'REPUESTOS';
    if (value.includes('FACTURA') || value.includes('COBRO') || value.includes('COMERCIAL') || value.includes('CAJA')) return 'COMERCIAL';
    if (value.includes('GARANTIA') || value.includes('COBERTURA') || value.includes('RECLAMO')) return 'GARANTIAS';
    if (value.includes('CLIENTE') || value.includes('NOTIFIC')) return 'CLIENTE';
    if (value.includes('ORDEN') || value.includes('OT_') || value.includes('OT ')) return 'ORDEN';
    if (value.includes('SISTEMA') || value.includes('SELECT') || value.includes('CONSULTA')) return 'SISTEMA';
    return 'SISTEMA';
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private humanize(value: string): string {
    return String(value || '')
      .replace(/^Kxt/i, '')
      .replace(/^Veh/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí', 's'].includes(value.toLowerCase());
    return false;
  }
}
