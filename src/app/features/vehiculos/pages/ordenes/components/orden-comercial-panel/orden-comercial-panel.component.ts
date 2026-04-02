import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { VehiculosEmptyStateComponent } from '../../../../components/empty-state/empty-state.component';
import {
  VehArticuloCatalogo,
  VehCobro,
  VehFactura,
  VehFacturacionWorkflowRequest,
  VehOrdenTrabajo,
  VehOrdenTrabajoRepuesto,
  VehFacturaDetalleResponse
} from '../../../../data-access/vehiculos.models';

export type FacturaComercialSavePayload = VehFacturacionWorkflowRequest;

type ComercialMode = 'new' | 'view';

type ComercialDraft = {
  observacionFactura: string;
};

export type FacturaComercialLineaDraft = {
  idVehOrdenTrabajoRepuesto: number;
  art: number;
  artcod: string;
  articulo: string;
  cantidad: number;
  precioUnitario: number;
  porcentajeIva: number;
  descuento: number;
  subtotalBruto: number;
  subtotalNeto: number;
  ivaValor: number;
  total: number;
  selected: boolean;
};


@Component({
  selector: 'app-orden-comercial-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    VehiculosEmptyStateComponent,
  ],
  templateUrl: './orden-comercial-panel.component.html',
  styleUrl: './orden-comercial-panel.component.scss',
})
export class OrdenComercialPanelComponent implements OnChanges {
  @Input() orden: VehOrdenTrabajo | null = null;
  @Input() clienteNombre = 'Cliente';
  @Input() vehiculoNombre = 'Vehículo';
  @Input() repuestos: VehOrdenTrabajoRepuesto[] = [];
  @Input() facturasOt: VehFactura[] = [];
  @Input() selectedFacturaOt: VehFactura | null = null;
  @Input() cobrosFactura: VehCobro[] = [];
  @Input() articulosCatalogo: VehArticuloCatalogo[] = [];
  @Input() facturaDetalle: VehFacturaDetalleResponse | null = null;
  @Output() selectFactura = new EventEmitter<VehFactura>();
  @Output() createFactura = new EventEmitter<FacturaComercialSavePayload>();
  @Output() openCobro = new EventEmitter<void>();
  @Output() openContabilizar = new EventEmitter<void>();

  mode: ComercialMode = 'new';

  comercialDraft: ComercialDraft = this.createEmptyDraft();
  pendingLines: FacturaComercialLineaDraft[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orden']) {
      this.resetDraftFromOrden();
    }

    if (changes['repuestos'] || changes['articulosCatalogo'] || changes['orden']) {
      this.rebuildPendingLines();
    }

    if (changes['selectedFacturaOt']) {
      if (this.selectedFacturaOt) {
        this.mode = 'view';
      } else if (this.pendingLines.length) {
        this.mode = 'new';
      }
    }

    if (changes['facturasOt'] && !this.facturasOt.length && this.pendingLines.length) {
      this.mode = 'new';
    }
  }

  openNuevaFactura() {
    this.mode = 'new';
    if (!this.pendingLines.length) {
      this.rebuildPendingLines();
    }
  }

  seleccionarFacturaRow(item: VehFactura) {
    this.mode = 'view';
    this.selectFactura.emit(item);
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

  facturaActual(): VehFactura | null {
    return this.facturaDetalle?.factura ?? this.selectedFacturaOt ?? null;
  }

  facturaDetalleItems() {
    return this.facturaDetalle?.detalle ?? [];
  }

  facturaCxcItems() {
    return this.facturaDetalle?.cxc ?? [];
  }

  hasPendingLines(): boolean {
    return this.pendingLines.length > 0;
  }

  allPendingSelected(): boolean {
    return this.pendingLines.length > 0 && this.pendingLines.every((line) => !!line.selected);
  }

  toggleAllPending(checked: boolean) {
    this.pendingLines = this.pendingLines.map((line) => ({ ...line, selected: checked }));
  }

  selectedLines(): FacturaComercialLineaDraft[] {
    return this.pendingLines.filter((line) => !!line.selected);
  }

  selectedLineCount(): number {
    return this.selectedLines().length;
  }

  subtotalCeroPreview(): number {
    return this.sumMoney(
      this.selectedLines()
        .filter((line) => line.porcentajeIva <= 0)
        .map((line) => line.subtotalNeto)
    );
  }

  subtotalIvaPreview(): number {
    return this.sumMoney(
      this.selectedLines()
        .filter((line) => line.porcentajeIva > 0)
        .map((line) => line.subtotalNeto)
    );
  }

  descuentoPreview(): number {
    return this.sumMoney(this.selectedLines().map((line) => line.descuento));
  }

  ivaPreview(): number {
    return this.sumMoney(this.selectedLines().map((line) => line.ivaValor));
  }

  totalPreview(): number {
    return this.sumMoney(this.selectedLines().map((line) => line.total));
  }

  canEmitFactura(): boolean {
    if (!this.orden || this.selectedLines().length === 0) return false;

    const tasasPositivas = [
      ...new Set(
        this.selectedLines()
          .map((line) => this.money(line.porcentajeIva))
          .filter((value) => value > 0)
      ),
    ];

    return tasasPositivas.length <= 1;
  }

  emitirFactura() {
    if (!this.orden) return;

    const lineas = this.selectedLines();
    if (!lineas.length) return;

    const tasasPositivas = [
      ...new Set(
        lineas
          .map((line) => this.money(line.porcentajeIva))
          .filter((value) => value > 0)
      ),
    ];

    if (tasasPositivas.length > 1) {
      return;
    }

    const payload: FacturaComercialSavePayload = {
      idVehOrdenTrabajoFk: this.orden.idVehOrdenTrabajo,
      dni: Number(this.orden.dni),
      idsVehOrdenTrabajoRepuesto: lineas.map((line) => line.idVehOrdenTrabajoRepuesto),
      subtotalCero: this.money(this.subtotalCeroPreview()),
      subtotalIva: this.money(this.subtotalIvaPreview()),
      iva: this.money(this.ivaPreview()),
      descuento: this.money(this.descuentoPreview()),
      total: this.money(this.totalPreview()),
      observacionFactura: this.comercialDraft.observacionFactura?.trim() || null,
    };

    this.createFactura.emit(payload);
  }

  severityEstado(estado?: string | null) {
    const value = String(estado || '').toUpperCase();
    if (value.includes('PAG') || value.includes('COBR') || value.includes('ACTIV')) return 'success';
    if (value.includes('SRI') || value.includes('EMIT')) return 'info';
    if (value.includes('PEND')) return 'warn';
    if (value.includes('ANUL') || value.includes('RECHAZ')) return 'danger';
    return 'secondary';
  }

  formatMoney(value?: number | null): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatPct(value?: number | null): string {
    const pct = this.normalizeIva(value);
    return `${this.formatMoney(pct)}%`;
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
    return cantidad * precio;
  }

  detalleTotal(item: any): number {
    const subtotal = this.detalleSubtotal(item);
    const descuento = this.detalleDescuento(item);
    const ivaPct = this.detalleIvaPct(item);
    const neto = subtotal - descuento;
    const iva = neto * (ivaPct / 100);
    return neto + iva;
  }

  private resetDraftFromOrden() {
    this.comercialDraft = this.createEmptyDraft();
  }

  private createEmptyDraft(): ComercialDraft {
    return {
      observacionFactura: '',
    };
  }

  private rebuildPendingLines() {
    const previousSelection = new Map<number, boolean>(
      this.pendingLines.map((line) => [line.idVehOrdenTrabajoRepuesto, !!line.selected]),
    );

    this.pendingLines = (this.repuestos || [])
      .filter((item) => !item.idFacVentaFk)
      .map((item) => this.buildPendingLine(item, previousSelection.get(item.idVehOrdenTrabajoRepuesto) ?? true));

    if (!this.selectedFacturaOt && this.pendingLines.length) {
      this.mode = 'new';
    }
  }

  private buildPendingLine(item: VehOrdenTrabajoRepuesto, selected: boolean): FacturaComercialLineaDraft {
    const article = this.findArticulo(item.art);

    const cantidad = this.money(item.cantidad || 0);
    const precioUnitario = this.money(
      item.precioUnitario ||
      article?.precio4 ||
      article?.artmay ||
      article?.artcom ||
      article?.artmen ||
      0
    );

    const porcentajeIva = this.normalizeIva(
      item.porcentaje ?? article?.porcentaje ?? 0
    );

    const descuento = this.money(0);
    const subtotalBruto = this.money(cantidad * precioUnitario);
    const subtotalNeto = this.money(subtotalBruto - descuento);
    const ivaValor = this.money(subtotalNeto * (porcentajeIva / 100));
    const total = this.money(subtotalNeto + ivaValor);

    return {
      idVehOrdenTrabajoRepuesto: item.idVehOrdenTrabajoRepuesto,
      art: item.art,
      artcod: article?.artcod || item.artcod || `ART-${item.art}`,
      articulo: article?.articulo || item.articulo || `Artículo ${item.art}`,
      cantidad,
      precioUnitario,
      porcentajeIva,
      descuento,
      subtotalBruto,
      subtotalNeto,
      ivaValor,
      total,
      selected,
    };
  }
  private sumMoney(values: number[]): number {
    return this.money(values.reduce((acc, value) => acc + Number(value || 0), 0));
  }

  private money(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  private findArticulo(art?: number | null): VehArticuloCatalogo | null {
    if (!art) return null;
    return this.articulosCatalogo.find((item) => item.idActInventario === art) ?? null;
  }

  private normalizeIva(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num > 1 ? num : num * 100;
  }
}