import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  VehCobro,
  VehFactura,
  VehFacturaCrearRequest,
  VehFacturaDetalleResponse,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type QuickFilter = 'all' | 'saldo' | 'pagadas' | 'credito' | 'anuladas';

@Component({
  selector: 'app-vehiculos-facturacion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    ConfirmDialogModule,
    VehiculosPageHeaderComponent,
    VehiculosEmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './facturacion.component.html',
  styleUrl: './facturacion.component.scss',
})
export class VehiculosFacturacionComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);
  private router = inject(Router);

  q = '';
  loading = signal(false);
  saving = signal(false);
  drawerVisible = signal(false);
  dirty = signal(false);

  quickFilter = signal<QuickFilter>('all');

  facturas = signal<VehFactura[]>([]);
  selectedFactura = signal<VehFactura | null>(null);
  facturaDetalle = signal<VehFacturaDetalleResponse | null>(null);
  cobrosFactura = signal<VehCobro[]>([]);

  readonly quickFilters: Array<{ key: QuickFilter; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'saldo', label: 'Con saldo' },
    { key: 'pagadas', label: 'Pagadas' },
    { key: 'credito', label: 'Crédito' },
    { key: 'anuladas', label: 'Anuladas' },
  ];

  facturaForm = this.fb.group({
    idVehOrdenTrabajoFk: [null as number | null, Validators.required],
    idsVehOrdenTrabajoRepuesto: [''],
    tipoFacturacion: ['PARCIAL'],
    observacion: [''],
    dni: [null as number | null],
    cen: [null as number | null],
    idAdmPtoemi: [null as number | null],
    credito: [false],
    entrada: [0],
    cuotas: [1],
    fechaPrimerVencimiento: [''],
    idTaxCompAutFk: [1],
    usarPrecioRepuesto: [true],
  });

  readonly filteredFacturas = computed(() => {
    const items = this.facturas();
    const filter = this.quickFilter();

    switch (filter) {
      case 'saldo':
        return items.filter((item) => Number(item.cxcDeuda || 0) > 0);
      case 'pagadas':
        return items.filter((item) => Number(item.cxcDeuda || 0) <= 0);
      case 'credito':
        return items.filter((item) => this.isCredito(item));
      case 'anuladas':
        return items.filter((item) => this.isAnulada(item));
      default:
        return items;
    }
  });

  readonly facturaActual = computed<VehFactura | null>(() => {
    return this.facturaDetalle()?.factura ?? this.selectedFactura() ?? null;
  });

  readonly totalFacturadoListado = computed(() =>
    this.money(this.filteredFacturas().reduce((acc, item) => acc + Number(item.total || 0), 0)),
  );

  readonly saldoPendienteListado = computed(() =>
    this.money(this.filteredFacturas().reduce((acc, item) => acc + Number(item.cxcDeuda || 0), 0)),
  );

  readonly totalCobradoListado = computed(() =>
    this.money(this.filteredFacturas().reduce((acc, item) => {
      const total = Number(item.total || 0);
      const saldo = Number(item.cxcDeuda || 0);
      return acc + Math.max(total - saldo, 0);
    }, 0)),
  );

  constructor() {
    this.facturaForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    return true;
  }

  volver() {
    if (this.drawerVisible() && this.dirty()) {
      this.confirm.confirmDiscard().then((ok) => {
        if (ok) this.router.navigate(['/app/vehiculos/dashboard']);
      });
      return;
    }

    this.router.navigate(['/app/vehiculos/dashboard']);
  }

  irAOrdenes() {
    if (this.drawerVisible() && this.dirty()) {
      this.confirm.confirmDiscard().then((ok) => {
        if (ok) this.router.navigate(['/app/vehiculos/ordenes']);
      });
      return;
    }

    this.router.navigate(['/app/vehiculos/ordenes']);
  }

  cargar() {
    this.loading.set(true);

    this.repo
      .listarFacturas(this.q, 0, 100, false)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.facturas.set(items);

          const currentId = this.selectedFactura()?.idFacVenta ?? null;
          const selected = currentId
            ? items.find((item) => item.idFacVenta === currentId) ?? null
            : (items[0] ?? null);

          if (selected) {
            this.seleccionarFactura(selected, false);
          } else {
            this.selectedFactura.set(null);
            this.facturaDetalle.set(null);
            this.cobrosFactura.set([]);
          }
        },
        error: (err) => this.notify.error('No se pudo cargar facturación', err?.message),
      });
  }

  seleccionarFactura(item: VehFactura, scrollToTop = true) {
    this.selectedFactura.set(item);

    forkJoin({
      detalle: this.repo.obtenerFactura(item.idFacVenta),
      cobros: this.repo.listarCobros('', 0, 100, false, { idFacVenta: item.idFacVenta }),
    }).subscribe({
      next: ({ detalle, cobros }) => {
        this.facturaDetalle.set(detalle);
        this.cobrosFactura.set(cobros.items ?? []);

        if (scrollToTop && typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      error: (err) => this.notify.error('No se pudo cargar el detalle de la factura', err?.message),
    });
  }

  setQuickFilter(filter: QuickFilter) {
    this.quickFilter.set(filter);

    const items = this.filteredFacturas();
    const current = this.selectedFactura();
    const selected = current
      ? items.find((item) => item.idFacVenta === current.idFacVenta) ?? null
      : null;

    if (selected) {
      this.seleccionarFactura(selected, false);
      return;
    }

    if (items.length) {
      this.seleccionarFactura(items[0], false);
      return;
    }

    this.selectedFactura.set(null);
    this.facturaDetalle.set(null);
    this.cobrosFactura.set([]);
  }

  abrirDrawer() {
    const relation = this.facturaDetalle()?.ordenesTrabajo?.[0] ?? null;

    this.facturaForm.reset({
      idVehOrdenTrabajoFk: relation?.idVehOrdenTrabajoFk ?? null,
      idsVehOrdenTrabajoRepuesto: '',
      tipoFacturacion: relation?.tipoFacturacion || 'PARCIAL',
      observacion: '',
      dni: this.facturaActual()?.dni ?? null,
      cen: this.facturaActual()?.cen ?? null,
      idAdmPtoemi: null,
      credito: false,
      entrada: 0,
      cuotas: 1,
      fechaPrimerVencimiento: '',
      idTaxCompAutFk: 1,
      usarPrecioRepuesto: true,
    });

    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  cerrarDrawer = async () => {
    if (this.dirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }

    this.drawerVisible.set(false);
    this.dirty.set(false);
  };

  submit() {
    if (this.facturaForm.invalid) {
      this.facturaForm.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Debes indicar la OT.');
      return;
    }

    this.saving.set(true);

    const payload: VehFacturaCrearRequest = {
      idVehOrdenTrabajoFk: Number(this.facturaForm.value.idVehOrdenTrabajoFk),
      idsVehOrdenTrabajoRepuesto: this.toIdList(this.facturaForm.value.idsVehOrdenTrabajoRepuesto),
      tipoFacturacion: this.facturaForm.value.tipoFacturacion || null,
      observacion: this.facturaForm.value.observacion?.trim() || null,
      dni: this.facturaForm.value.dni ?? null,
      cen: this.facturaForm.value.cen ?? null,
      idAdmPtoemi: this.facturaForm.value.idAdmPtoemi ?? null,
      credito: !!this.facturaForm.value.credito,
      entrada: Number(this.facturaForm.value.entrada || 0),
      cuotas: Number(this.facturaForm.value.cuotas || 1),
      fechaPrimerVencimiento: this.facturaForm.value.fechaPrimerVencimiento || null,
      idTaxCompAutFk: this.facturaForm.value.idTaxCompAutFk ?? null,
      usarPrecioRepuesto: !!this.facturaForm.value.usarPrecioRepuesto,
    };

    const request$: Observable<any> = this.repo.crearFactura(payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res: any) => {
          this.notify.success('Factura creada', res?.mensaje || 'La factura fue creada correctamente.');
          this.drawerVisible.set(false);
          this.dirty.set(false);
          this.cargar();
        },
        error: (err: any) => this.notify.error('No se pudo crear la factura', err?.message),
      });
  }

  facturaNumber(item?: VehFactura | null): string {
    if (!item) return 'Factura';
    if (item.numeroFactura?.trim()) return item.numeroFactura;
    const estab = String(item.estab ?? 0).padStart(3, '0');
    const ptoemi = String(item.ptoemi ?? 0).padStart(3, '0');
    const sec = String(item.secuencial ?? item.idFacVenta ?? 0).padStart(9, '0');
    return `${estab}-${ptoemi}-${sec}`;
  }

  facturaCliente(item?: VehFactura | null): string {
    if (!item) return 'Cliente';
    return item.nombre || item.ruc || (item.dni ? `DNI ${item.dni}` : 'Cliente');
  }

  formatMoney(value?: number | null): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDateShort(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const raw = String(value).trim();
    if (!raw) return 'Sin fecha';

    const safe = raw.includes('T') ? raw : `${raw}T00:00:00`;
    const date = new Date(safe);

    if (Number.isNaN(date.getTime())) {
      return raw.slice(0, 10);
    }

    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  severityEstado(estado?: string | null) {
    const value = String(estado || '').toUpperCase();
    if (value.includes('PAG') || value.includes('COBR') || value.includes('ACTIV')) return 'success';
    if (value.includes('SRI') || value.includes('EMIT')) return 'info';
    if (value.includes('PEND')) return 'warn';
    if (value.includes('ANUL') || value.includes('RECHAZ')) return 'danger';
    return 'secondary';
  }

  detalleLabel(item: any): string {
    const code = item?.artcod || (item?.art ? `ART-${item.art}` : '');
    const detail =
      item?.detalle ||
      item?.descripcion ||
      item?.articulo ||
      item?.observaciones ||
      'Detalle';
    return [code, detail].filter(Boolean).join(' · ');
  }

  detalleCantidad(item: any): number {
    return Number(item?.unidades ?? item?.cantidad ?? 0);
  }

  detallePrecio(item: any): number {
    return Number(item?.valuni ?? item?.precioUnitario ?? 0);
  }

  detalleDescuento(item: any): number {
    return Number(item?.descuento ?? 0);
  }

  detalleIvaPct(item: any): number {
    return this.normalizeIva(item?.ivaPorcen ?? item?.ivaPorcentaje ?? item?.porcentaje ?? 0);
  }

  detalleSubtotal(item: any): number {
    const cantidad = this.detalleCantidad(item);
    const precio = this.detallePrecio(item);
    return this.money(cantidad * precio);
  }

  detalleTotal(item: any): number {
    const subtotal = this.detalleSubtotal(item);
    const descuento = this.detalleDescuento(item);
    const ivaPct = this.detalleIvaPct(item);
    const neto = subtotal - descuento;
    const iva = neto * (ivaPct / 100);
    return this.money(neto + iva);
  }

  cobradoFactura(item?: VehFactura | null): number {
    if (!item) return 0;
    const total = Number(item.total || 0);
    const saldo = Number(item.cxcDeuda || 0);
    return this.money(Math.max(total - saldo, 0));
  }

  facturaDetalleItems() {
    return this.facturaDetalle()?.detalle ?? [];
  }

  facturaCxcItems() {
    return this.facturaDetalle()?.cxc ?? [];
  }

  ordenesFactura() {
    return this.facturaDetalle()?.ordenesTrabajo ?? [];
  }

  private isCredito(item: VehFactura): boolean {
    return Number(item.cuotas || 0) > 1 || Number(item.entrada || 0) > 0 || Number(item.cxc || 0) > 0;
  }

  private isAnulada(item: VehFactura): boolean {
    const estado = String(item.sriEstado || '').toUpperCase();
    return estado.includes('ANUL') || estado.includes('RECHAZ');
  }

  private toIdList(raw?: string | null): number[] | null {
    if (!raw || !raw.trim()) return null;
    const ids = raw
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => !Number.isNaN(x) && x > 0);
    return ids.length ? ids : null;
  }

  private money(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  private normalizeIva(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num > 1 ? num : num * 100;
  }
}
