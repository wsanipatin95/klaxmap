import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import {
  VehGarantia,
  VehGarantiaDetalle,
  VehGarantiaDetalleEditarRequest,
  VehGarantiaDetalleGuardarRequest,
  VehGarantiaEditarRequest,
  VehGarantiaGuardarRequest,
  VehGarantiaMovimiento,
  VehGarantiaMovimientoEditarRequest,
  VehGarantiaMovimientoGuardarRequest,
  VehOrdenTrabajo,
  VehOrdenTrabajoGuardarRequest,
  VehOrdenTrabajoRepuesto,
  VehOrdenTrabajoTrabajo,
} from '../../../../data-access/vehiculos.models';
import { VehiculosRepository } from '../../../../data-access/vehiculos.repository';
import { VehiculosEmptyStateComponent } from '../../../../components/empty-state/empty-state.component';
import { NotifyService } from 'src/app/core/services/notify.service';

type CoverageType = 'TRABAJO' | 'REPUESTO' | 'MIXTA';
type ResultadoMovimiento = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'PARCIAL';

type RepuestoOtOption = {
  id: number;
  label: string;
  art: number | null;
  artcod: string;
  articulo: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  serieAnterior: string;
  serieNueva: string;
};

@Component({
  selector: 'app-orden-garantias-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    VehiculosEmptyStateComponent,
  ],
  templateUrl: './orden-garantias-panel.component.html',
  styleUrl: './orden-garantias-panel.component.scss',
})
export class OrdenGarantiasPanelComponent implements OnChanges {
  private readonly repo = inject(VehiculosRepository);
  private readonly notify = inject(NotifyService);
  private readonly fb = inject(FormBuilder);

  @Input() orden: VehOrdenTrabajo | null = null;
  @Input() garantias: VehGarantia[] = [];
  @Input() selectedGarantia: VehGarantia | null = null;
  @Input() garantiaDetalles: VehGarantiaDetalle[] = [];
  @Input() garantiaMovimientos: VehGarantiaMovimiento[] = [];
  @Input() trabajoLabelMap: Record<number, string> = {};
  @Input() articuloLabelMap: Record<number, string> = {};
  @Input() readonlyMode = false;
  @Input() trabajosOt: VehOrdenTrabajoTrabajo[] = [];
  @Input() repuestosOt: VehOrdenTrabajoRepuesto[] = [];

  @Output() selectGarantia = new EventEmitter<VehGarantia>();
  @Output() openGarantia = new EventEmitter<void>();
  @Output() openGarantiaDetalle = new EventEmitter<void>();
  @Output() openGarantiaMovimiento = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly creandoOtGarantia = signal(false);

  readonly garantiaDialogVisible = signal(false);
  readonly coberturaDialogVisible = signal(false);
  readonly reclamoDialogVisible = signal(false);

  readonly garantiasState = signal<VehGarantia[]>([]);
  readonly selectedGarantiaState = signal<VehGarantia | null>(null);
  readonly detallesState = signal<VehGarantiaDetalle[]>([]);
  readonly movimientosState = signal<VehGarantiaMovimiento[]>([]);

  readonly editingGarantiaId = signal<number | null>(null);
  readonly editingDetalleId = signal<number | null>(null);
  readonly editingMovimientoId = signal<number | null>(null);
  readonly otGarantiaPendienteGuardar = signal<number | null>(null);

  readonly tiposGarantia = ['MANO_OBRA', 'REPUESTO', 'MIXTA'];
  readonly modalidadesGarantia = ['TIEMPO', 'KM', 'TIEMPO_O_KM'];
  readonly responsablesCosto = ['TALLER', 'PROVEEDOR', 'CLIENTE', 'MIXTO'];
  readonly estadosGarantia = ['ACTIVA', 'APROBADA', 'RECLAMADA', 'RECHAZADA', 'VENCIDA', 'ANULADA'];
  readonly tiposCobertura: CoverageType[] = ['TRABAJO', 'REPUESTO', 'MIXTA'];
  readonly resultadosMovimiento: ResultadoMovimiento[] = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'PARCIAL'];

  readonly garantiaForm = this.fb.group({
    tipoGarantia: this.fb.control<string>('REPUESTO', { nonNullable: true, validators: [Validators.required] }),
    modalidadVencimiento: this.fb.control<string>('TIEMPO_O_KM', { nonNullable: true, validators: [Validators.required] }),
    fechaBase: this.fb.control<string>(''),
    kmBase: this.fb.control<number | null>(0),
    diasGarantia: this.fb.control<number | null>(90),
    mesesGarantia: this.fb.control<number | null>(null),
    kmGarantia: this.fb.control<number | null>(5000),
    fechaVence: this.fb.control<string>(''),
    kmVence: this.fb.control<number | null>(null),
    estadoGarantia: this.fb.control<string>('ACTIVA', { nonNullable: true, validators: [Validators.required] }),
    responsableCosto: this.fb.control<string>('TALLER', { nonNullable: true, validators: [Validators.required] }),
    observaciones: this.fb.control<string>(''),
  });

  readonly coberturaForm = this.fb.group({
    tipoCobertura: this.fb.control<CoverageType>('REPUESTO', { nonNullable: true, validators: [Validators.required] }),
    idVehOrdenTrabajoTrabajoFk: this.fb.control<number | null>(null),
    idVehOrdenTrabajoRepuestoFk: this.fb.control<number | null>(null),
    art: this.fb.control<number | null>(null),
    cubreManoObra: this.fb.control<boolean>(true, { nonNullable: true }),
    cubreRepuesto: this.fb.control<boolean>(true, { nonNullable: true }),
    montoMaximo: this.fb.control<number | null>(0),
    cantidadMaxima: this.fb.control<number | null>(1),
    serieAnterior: this.fb.control<string>(''),
    serieNueva: this.fb.control<string>(''),
    observaciones: this.fb.control<string>(''),
  });

  readonly reclamoForm = this.fb.group({
    idVehOrdenTrabajoFk: this.fb.control<number | null>(null),
    fechaReclamo: this.fb.control<string>(''),
    kmReclamo: this.fb.control<number | null>(0),
    diagnostico: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    resultado: this.fb.control<ResultadoMovimiento>('PENDIENTE', { nonNullable: true, validators: [Validators.required] }),
    valorCliente: this.fb.control<number | null>(0),
    valorTaller: this.fb.control<number | null>(0),
    valorProveedor: this.fb.control<number | null>(0),
    motivoRechazo: this.fb.control<string>(''),
    observaciones: this.fb.control<string>(''),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['garantias'] && this.garantias?.length) {
      this.garantiasState.set(this.sortGarantias(this.garantias));
    }

    if (changes['garantiaDetalles'] && this.garantiaDetalles?.length) {
      this.detallesState.set(this.garantiaDetalles);
    }

    if (changes['garantiaMovimientos'] && this.garantiaMovimientos?.length) {
      this.movimientosState.set(this.sortMovimientos(this.garantiaMovimientos));
    }

    if (changes['selectedGarantia'] && this.selectedGarantia) {
      this.selectedGarantiaState.set(this.selectedGarantia);
    }

    if (changes['orden']) {
      this.resetReclamoTransientState();
      const order = this.orden;

      if (!order?.idVehOrdenTrabajo) {
        this.garantiasState.set([]);
        this.selectedGarantiaState.set(null);
        this.detallesState.set([]);
        this.movimientosState.set([]);
        return;
      }

      this.loadGarantias(order.idVehOrdenTrabajo);
    }
  }

  selectedGarantiaView(): VehGarantia | null {
    return this.selectedGarantiaState() ?? this.selectedGarantia ?? null;
  }

  garantiasView(): VehGarantia[] {
    const local = this.garantiasState();
    return local.length ? local : this.sortGarantias(this.garantias ?? []);
  }

  detallesView(): VehGarantiaDetalle[] {
    const local = this.detallesState();
    return local.length ? local : (this.garantiaDetalles ?? []);
  }

  movimientosView(): VehGarantiaMovimiento[] {
    const local = this.movimientosState();
    return local.length ? local : this.sortMovimientos(this.garantiaMovimientos ?? []);
  }

  resumen() {
    const garantias = this.garantiasView();
    const detalles = this.detallesView();
    const movimientos = this.movimientosView();

    return {
      total: garantias.length,
      activas: garantias.filter((item) => this.normalizeEstado(item.estadoGarantia).includes('ACTIVA')).length,
      coberturas: detalles.length,
      reclamos: movimientos.length,
    };
  }

  estadoSeverity(estado?: string | null) {
    const value = this.normalizeEstado(estado);
    if (value.includes('ACTIVA') || value.includes('APROB')) return 'success';
    if (value.includes('RECLAM') || value.includes('PEND') || value.includes('PARCIAL')) return 'warn';
    if (value.includes('ANUL') || value.includes('RECHAZ') || value.includes('VENC')) return 'danger';
    return 'secondary';
  }

  modalidadLabel(value?: string | null): string {
    const raw = String(value || '').toUpperCase();
    if (raw === 'TIEMPO') return 'Por tiempo';
    if (raw === 'KM') return 'Por kilometraje';
    if (raw === 'TIEMPO_O_KM') return 'Por tiempo o km';
    return raw || '-';
  }

  responsableLabel(value?: string | null): string {
    const raw = String(value || '').toUpperCase();
    if (raw === 'TALLER') return 'Taller';
    if (raw === 'PROVEEDOR') return 'Proveedor';
    if (raw === 'CLIENTE') return 'Cliente';
    if (raw === 'MIXTO') return 'Mixto';
    return raw || '-';
  }

  garantiaResumenLabel(item: VehGarantia): string {
    const dias = Number(item.diasGarantia || 0);
    const meses = Number(item.mesesGarantia || 0);
    const km = Number(item.kmGarantia || 0);
    const parts: string[] = [];

    if (dias) parts.push(`${dias} día(s)`);
    if (meses) parts.push(`${meses} mes(es)`);
    if (km) parts.push(`${km} km`);

    return parts.length ? parts.join(' · ') : 'Sin límite definido';
  }

  garantiaCompactLine(item: VehGarantia): string {
    return [item.tipoGarantia || 'GARANTÍA', this.garantiaResumenLabel(item)].filter(Boolean).join(' · ');
  }

  garantiaDatesLine(item: VehGarantia): string {
    return `Base ${this.formatDate(item.fechaBase)} · Vence ${this.formatDate(item.fechaVence)}`;
  }

  garantiaFooterLine(item: VehGarantia): string {
    return `Resp. ${this.responsableLabel(item.responsableCosto)} · Km ${Number(item.kmBase || 0)} → ${Number(item.kmVence || 0)}`;
  }

  detalleLabel(item: VehGarantiaDetalle): string {
    if (item.idVehOrdenTrabajoTrabajoFk) {
      const trabajo = (this.trabajosOt ?? []).find((row) => row.idVehOrdenTrabajoTrabajo === item.idVehOrdenTrabajoTrabajoFk);
      if (trabajo) return this.buildTrabajoLabel(trabajo);
      if (this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk]) return this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk];
    }

    if (item.idVehOrdenTrabajoRepuestoFk) {
      const repuesto = (this.repuestosOt ?? []).find((row) => row.idVehOrdenTrabajoRepuesto === item.idVehOrdenTrabajoRepuestoFk);
      if (repuesto) return this.buildRepuestoLabel(repuesto);
    }

    if (item.art && this.articuloLabelMap[item.art]) return this.articuloLabelMap[item.art];
    if (this.isRepuestoCoverage(item.tipoCobertura)) return 'Repuesto cubierto';
    if (this.isTrabajoCoverage(item.tipoCobertura)) return 'Trabajo cubierto';
    return item.tipoCobertura || 'Cobertura';
  }

  detalleSubLabel(item: VehGarantiaDetalle): string {
    const values: string[] = [];
    if (this.toBool(item.cubreManoObra)) values.push('Mano de obra');
    if (this.toBool(item.cubreRepuesto)) values.push('Repuesto');
    return values.length ? values.join(' + ') : 'Cobertura informativa';
  }

  coberturaBadge(item: VehGarantiaDetalle): string {
    const mo = this.toBool(item.cubreManoObra);
    const rep = this.toBool(item.cubreRepuesto);
    if (mo && rep) return 'MO + REP';
    if (mo) return 'MO';
    if (rep) return 'REP';
    return String(item.tipoCobertura || 'COBERTURA');
  }

  movimientoTitle(item: VehGarantiaMovimiento): string {
    return item.resultado || 'PENDIENTE';
  }

  shouldShowSeries(tipo?: string | null): boolean {
    return this.isRepuestoCoverage(tipo);
  }

  isTrabajoCoverage(tipo?: string | null): boolean {
    const value = String(tipo || '').toUpperCase();
    return value === 'TRABAJO' || value === 'MIXTA';
  }

  isRepuestoCoverage(tipo?: string | null): boolean {
    const value = String(tipo || '').toUpperCase();
    return value === 'REPUESTO' || value === 'MIXTA';
  }

  trabajoOptions(): Array<{ id: number; label: string }> {
    const fromRows = (this.trabajosOt ?? [])
      .filter((item) => Number.isFinite(Number(item.idVehOrdenTrabajoTrabajo)))
      .map((item) => ({
        id: item.idVehOrdenTrabajoTrabajo,
        label: this.buildTrabajoLabel(item),
      }));

    if (fromRows.length) return fromRows;

    return Object.entries(this.trabajoLabelMap || {})
      .map(([id, label]) => ({ id: Number(id), label }))
      .filter((item) => Number.isFinite(item.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  repuestoOtOptions(): RepuestoOtOption[] {
    return (this.repuestosOt ?? [])
      .filter((item) => Number.isFinite(Number(item.idVehOrdenTrabajoRepuesto)))
      .map((item) => this.buildRepuestoOption(item));
  }

  articuloOptions(): Array<{ art: number; label: string }> {
    const fromRows = (this.repuestosOt ?? [])
      .filter((item) => !!item.art)
      .map((item) => ({ art: Number(item.art), label: this.buildRepuestoLabel(item) }));

    const merged = new Map<number, string>();
    for (const item of fromRows) merged.set(item.art, item.label);

    for (const [art, label] of Object.entries(this.articuloLabelMap || {})) {
      const parsed = Number(art);
      if (Number.isFinite(parsed) && !merged.has(parsed)) merged.set(parsed, label);
    }

    return Array.from(merged.entries())
      .map(([art, label]) => ({ art, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  selectedTrabajoLabel(): string {
    const id = this.coberturaForm.controls.idVehOrdenTrabajoTrabajoFk.value;
    if (!id) return 'Selecciona un trabajo cubierto';
    const trabajo = (this.trabajosOt ?? []).find((item) => item.idVehOrdenTrabajoTrabajo === id);
    return trabajo ? this.buildTrabajoLabel(trabajo) : (this.trabajoLabelMap[id] || `Trabajo OT #${id}`);
  }

  selectedArticuloLabel(): string {
    const selected = this.selectedRepuestoOption();
    if (selected) return selected.label;

    const art = this.coberturaForm.controls.art.value;
    if (!art) return 'Selecciona el artículo o repuesto cubierto';
    return this.articuloLabelMap[art] || `Artículo #${art}`;
  }

  selectedRepuestoOption(): RepuestoOtOption | null {
    const id = this.coberturaForm.controls.idVehOrdenTrabajoRepuestoFk.value;
    if (!id) return null;
    return this.repuestoOtOptions().find((item) => item.id === id) ?? null;
  }

  montoMaximoPermitido(): number | null {
    const selected = this.selectedRepuestoOption();
    if (!selected) return null;
    return this.moneyNumber(selected.total);
  }

  montoMaximoInvalido(): boolean {
    const max = this.montoMaximoPermitido();
    if (max == null) return false;
    const current = Number(this.coberturaForm.controls.montoMaximo.value || 0);
    return current > max;
  }

  cantidadMaximaInvalida(): boolean {
    const selected = this.selectedRepuestoOption();
    if (!selected) return false;
    const current = Number(this.coberturaForm.controls.cantidadMaxima.value || 0);
    return current > selected.cantidad;
  }

  otVinculadaActual(): number | null {
    return this.reclamoForm.controls.idVehOrdenTrabajoFk.value
      ?? this.otGarantiaPendienteGuardar()
      ?? this.selectedGarantiaView()?.idVehOrdenTrabajoReclamoFk
      ?? null;
  }

  shouldShowMotivoRechazo(): boolean {
    return this.reclamoForm.controls.resultado.value === 'RECHAZADO';
  }

  canCreateOtGarantia(): boolean {
    if (this.readonlyMode || this.creandoOtGarantia() || !this.orden || !this.selectedGarantiaView()) return false;
    if (this.otVinculadaActual()) return false;

    const resultado = this.reclamoForm.controls.resultado.value;
    return resultado === 'APROBADO' || resultado === 'PARCIAL';
  }

  canSaveReclamo(): boolean {
    return !!this.selectedGarantiaView() && this.reclamoForm.valid && !this.saving();
  }

  onCoverageTypeChange(): void {
    const tipo = this.coberturaForm.controls.tipoCobertura.value;

    if (tipo === 'TRABAJO') {
      this.coberturaForm.patchValue({
        idVehOrdenTrabajoRepuestoFk: null,
        art: null,
        cubreManoObra: true,
        cubreRepuesto: false,
        montoMaximo: 0,
        cantidadMaxima: 1,
        serieAnterior: '',
        serieNueva: '',
      });
      return;
    }

    if (tipo === 'REPUESTO') {
      this.coberturaForm.patchValue({
        idVehOrdenTrabajoTrabajoFk: null,
        cubreManoObra: true,
        cubreRepuesto: true,
      });
      return;
    }

    this.coberturaForm.patchValue({
      cubreManoObra: true,
      cubreRepuesto: true,
    });
  }

  onRepuestoOtChange(): void {
    const selected = this.selectedRepuestoOption();
    if (!selected) return;

    this.coberturaForm.patchValue({
      art: selected.art,
      serieAnterior: selected.serieAnterior,
      serieNueva: selected.serieNueva,
      cubreRepuesto: true,
      cantidadMaxima: selected.cantidad || 1,
      montoMaximo: selected.total,
    });
  }

  normalizeMontoMaximo(): void {
    const max = this.montoMaximoPermitido();
    if (max == null) return;

    const current = Number(this.coberturaForm.controls.montoMaximo.value || 0);
    if (current > max) {
      this.coberturaForm.patchValue({ montoMaximo: max });
      this.notify.warn('Monto ajustado', `El monto máximo no puede superar ${this.money(max)}.`);
    }
  }

  normalizeCantidadMaxima(): void {
    const selected = this.selectedRepuestoOption();
    if (!selected) return;

    const current = Number(this.coberturaForm.controls.cantidadMaxima.value || 0);
    if (current > selected.cantidad) {
      this.coberturaForm.patchValue({ cantidadMaxima: selected.cantidad });
      this.notify.warn('Cantidad ajustada', `La cantidad máxima no puede superar ${selected.cantidad}.`);
    }
  }

  selectGarantiaCard(item: VehGarantia): void {
    this.selectedGarantiaState.set(item);
    this.selectGarantia.emit(item);
    this.loadSelectedGarantiaDetail(item.idVehGarantia);
  }

  openNuevaGarantia(): void {
    if (!this.orden || this.readonlyMode) return;

    this.openGarantia.emit();
    this.editingGarantiaId.set(null);
    this.garantiaForm.reset({
      tipoGarantia: 'REPUESTO',
      modalidadVencimiento: 'TIEMPO_O_KM',
      fechaBase: this.toInputDate(this.orden.fechaIngreso || this.orden.fecGen) || this.todayIso(),
      kmBase: Number(this.orden.kilometrajeIngreso || 0),
      diasGarantia: 90,
      mesesGarantia: null,
      kmGarantia: 5000,
      fechaVence: '',
      kmVence: null,
      estadoGarantia: 'ACTIVA',
      responsableCosto: 'TALLER',
      observaciones: '',
    });
    this.garantiaDialogVisible.set(true);
  }

  openEditarGarantia(item: VehGarantia): void {
    if (this.readonlyMode) return;

    this.openGarantia.emit();
    this.editingGarantiaId.set(item.idVehGarantia);
    this.garantiaForm.reset({
      tipoGarantia: item.tipoGarantia || 'REPUESTO',
      modalidadVencimiento: item.modalidadVencimiento || 'TIEMPO_O_KM',
      fechaBase: this.toInputDate(item.fechaBase),
      kmBase: Number(item.kmBase || 0),
      diasGarantia: item.diasGarantia ?? 90,
      mesesGarantia: item.mesesGarantia ?? null,
      kmGarantia: item.kmGarantia ?? 5000,
      fechaVence: this.toInputDate(item.fechaVence),
      kmVence: item.kmVence ?? null,
      estadoGarantia: item.estadoGarantia || 'ACTIVA',
      responsableCosto: item.responsableCosto || 'TALLER',
      observaciones: item.observaciones || '',
    });
    this.garantiaDialogVisible.set(true);
  }

  openNuevaCobertura(): void {
    if (this.readonlyMode || !this.selectedGarantiaView()) return;

    this.openGarantiaDetalle.emit();
    this.editingDetalleId.set(null);
    this.coberturaForm.reset({
      tipoCobertura: 'REPUESTO',
      idVehOrdenTrabajoTrabajoFk: null,
      idVehOrdenTrabajoRepuestoFk: null,
      art: null,
      cubreManoObra: true,
      cubreRepuesto: true,
      montoMaximo: 0,
      cantidadMaxima: 1,
      serieAnterior: '',
      serieNueva: '',
      observaciones: '',
    });
    this.coberturaDialogVisible.set(true);
  }

  openEditarCobertura(item: VehGarantiaDetalle): void {
    if (this.readonlyMode) return;

    this.openGarantiaDetalle.emit();
    this.editingDetalleId.set(item.idVehGarantiaDetalle);
    this.coberturaForm.reset({
      tipoCobertura: (String(item.tipoCobertura || 'REPUESTO').toUpperCase() as CoverageType),
      idVehOrdenTrabajoTrabajoFk: item.idVehOrdenTrabajoTrabajoFk ?? null,
      idVehOrdenTrabajoRepuestoFk: item.idVehOrdenTrabajoRepuestoFk ?? null,
      art: item.art ?? null,
      cubreManoObra: this.toBool(item.cubreManoObra),
      cubreRepuesto: this.toBool(item.cubreRepuesto),
      montoMaximo: item.montoMaximo ?? 0,
      cantidadMaxima: item.cantidadMaxima ?? 1,
      serieAnterior: item.serieAnterior || '',
      serieNueva: item.serieNueva || '',
      observaciones: item.observaciones || '',
    });
    this.coberturaDialogVisible.set(true);
  }

  openNuevoReclamo(): void {
    const garantia = this.selectedGarantiaView();
    if (this.readonlyMode || !garantia) return;

    this.openGarantiaMovimiento.emit();
    this.editingMovimientoId.set(null);
    this.resetReclamoTransientState();
    this.reclamoForm.reset({
      idVehOrdenTrabajoFk: garantia.idVehOrdenTrabajoReclamoFk ?? null,
      fechaReclamo: this.todayIso(),
      kmReclamo: Number(garantia.kmBase || this.orden?.kilometrajeIngreso || 0),
      diagnostico: '',
      resultado: 'PENDIENTE',
      valorCliente: 0,
      valorTaller: 0,
      valorProveedor: 0,
      motivoRechazo: '',
      observaciones: '',
    });
    this.reclamoDialogVisible.set(true);
  }

  openEditarReclamo(item: VehGarantiaMovimiento): void {
    if (this.readonlyMode) return;

    this.openGarantiaMovimiento.emit();
    this.editingMovimientoId.set(item.idVehGarantiaMovimiento);
    this.otGarantiaPendienteGuardar.set(null);
    this.reclamoForm.reset({
      idVehOrdenTrabajoFk: item.idVehOrdenTrabajoFk ?? null,
      fechaReclamo: this.toInputDate(item.fechaReclamo) || this.todayIso(),
      kmReclamo: Number(item.kmReclamo || 0),
      diagnostico: item.diagnostico || '',
      resultado: (String(item.resultado || 'PENDIENTE').toUpperCase() as ResultadoMovimiento),
      valorCliente: Number(item.valorCliente || 0),
      valorTaller: Number(item.valorTaller || 0),
      valorProveedor: Number(item.valorProveedor || 0),
      motivoRechazo: item.motivoRechazo || '',
      observaciones: item.observaciones || '',
    });
    this.reclamoDialogVisible.set(true);
  }

  closeReclamoDialog(): void {
    this.reclamoDialogVisible.set(false);
    this.resetReclamoTransientState();
  }

  onReclamoDialogVisibleChange(visible: boolean): void {
    this.reclamoDialogVisible.set(visible);
    if (!visible) this.resetReclamoTransientState();
  }

  saveGarantia(): void {
    const orden = this.orden;
    if (!orden) return;

    const raw = this.garantiaForm.getRawValue();
    const fechaVence = raw.fechaVence || this.computeFechaVence(raw.fechaBase || null, Number(raw.diasGarantia || 0), Number(raw.mesesGarantia || 0));
    const kmVence = raw.kmVence ?? this.computeKmVence(raw.kmBase, raw.kmGarantia);

    const payload: VehGarantiaGuardarRequest = {
      idVehOrdenTrabajoOrigenFk: orden.idVehOrdenTrabajo,
      idVehOrdenTrabajoReclamoFk: this.selectedGarantiaView()?.idVehOrdenTrabajoReclamoFk ?? null,
      tipoGarantia: raw.tipoGarantia || null,
      modalidadVencimiento: raw.modalidadVencimiento || null,
      fechaBase: this.toTimestamp(raw.fechaBase),
      kmBase: Number(raw.kmBase || 0),
      diasGarantia: raw.diasGarantia ?? null,
      mesesGarantia: raw.mesesGarantia ?? null,
      kmGarantia: raw.kmGarantia ?? null,
      fechaVence: this.toTimestamp(fechaVence),
      kmVence,
      estadoGarantia: raw.estadoGarantia || 'ACTIVA',
      responsableCosto: raw.responsableCosto || 'TALLER',
      observaciones: raw.observaciones?.trim() || null,
      atributos: null,
    };

    const editingId = this.editingGarantiaId();
    const request$ = editingId
      ? this.repo.editarGarantia({ idVehGarantia: editingId, cambios: payload } as VehGarantiaEditarRequest)
      : this.repo.crearGarantia(payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res: any) => {
        const id = editingId ?? this.extractNumericId(res?.data, ['idVehGarantia', 'id_veh_garantia', 'id']);
        this.notify.success(editingId ? 'Garantía actualizada' : 'Garantía creada', 'La garantía quedó guardada correctamente.');
        this.garantiaDialogVisible.set(false);
        this.loadGarantias(orden.idVehOrdenTrabajo, id ?? undefined);
      },
      error: (err) => this.notify.error('No se pudo guardar la garantía', err?.message),
    });
  }

  saveCobertura(): void {
    const garantia = this.selectedGarantiaView();
    if (!garantia) return;

    const raw = this.coberturaForm.getRawValue();
    const tipo = raw.tipoCobertura;
    const isTrabajo = this.isTrabajoCoverage(tipo);
    const isRepuesto = this.isRepuestoCoverage(tipo);
    const hasTrabajo = !!raw.idVehOrdenTrabajoTrabajoFk;
    const hasRepuesto = !!raw.idVehOrdenTrabajoRepuestoFk || !!raw.art;

    if (tipo === 'TRABAJO' && !hasTrabajo) {
      this.notify.warn('Selecciona un trabajo', 'Elige el trabajo cubierto por esta garantía.');
      return;
    }

    if (tipo === 'REPUESTO' && !hasRepuesto) {
      this.notify.warn('Selecciona un repuesto', 'Elige el repuesto de la OT o el artículo cubierto.');
      return;
    }

    if (tipo === 'MIXTA' && !hasTrabajo && !hasRepuesto) {
      this.notify.warn('Selecciona cobertura', 'Para cobertura mixta elige al menos un trabajo o un repuesto.');
      return;
    }

    const max = this.montoMaximoPermitido();
    const monto = Number(raw.montoMaximo || 0);
    if (max != null && monto > max) {
      this.notify.warn('Monto máximo excedido', `El monto máximo no puede superar ${this.money(max)} del repuesto seleccionado.`);
      return;
    }

    const selectedRepuesto = this.selectedRepuestoOption();
    const cantidad = Number(raw.cantidadMaxima || 1);
    if (selectedRepuesto && cantidad > selectedRepuesto.cantidad) {
      this.notify.warn('Cantidad excedida', `La cantidad máxima no puede superar ${selectedRepuesto.cantidad}.`);
      return;
    }

    const payload: VehGarantiaDetalleGuardarRequest = {
      idVehGarantiaFk: garantia.idVehGarantia,
      tipoCobertura: tipo,
      idVehOrdenTrabajoTrabajoFk: isTrabajo ? raw.idVehOrdenTrabajoTrabajoFk : null,
      idVehOrdenTrabajoRepuestoFk: isRepuesto ? raw.idVehOrdenTrabajoRepuestoFk : null,
      art: isRepuesto ? (raw.art ?? null) : null,
      cubreManoObra: raw.cubreManoObra ? 1 : 0,
      cubreRepuesto: raw.cubreRepuesto ? 1 : 0,
      montoMaximo: monto,
      cantidadMaxima: cantidad,
      serieAnterior: this.shouldShowSeries(tipo) ? raw.serieAnterior?.trim() || null : null,
      serieNueva: this.shouldShowSeries(tipo) ? raw.serieNueva?.trim() || null : null,
      observaciones: raw.observaciones?.trim() || null,
      atributos: selectedRepuesto
        ? {
          repuestoOt: {
            precioUnitario: selectedRepuesto.precioUnitario,
            cantidad: selectedRepuesto.cantidad,
            total: selectedRepuesto.total,
          },
        }
        : null,
    };

    const editingId = this.editingDetalleId();
    const request$ = editingId
      ? this.repo.editarGarantiaDetalle({ idVehGarantiaDetalle: editingId, cambios: payload } as VehGarantiaDetalleEditarRequest)
      : this.repo.crearGarantiaDetalle(payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(editingId ? 'Cobertura actualizada' : 'Cobertura agregada', 'La cobertura quedó guardada correctamente.');
        this.coberturaDialogVisible.set(false);
        this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
      },
      error: (err) => this.notify.error('No se pudo guardar la cobertura', err?.message),
    });
  }

  saveReclamo(): void {
    const garantia = this.selectedGarantiaView();
    if (!garantia) return;

    this.reclamoForm.markAllAsTouched();
    if (this.reclamoForm.invalid) {
      this.notify.warn('Diagnóstico requerido', 'Registra el diagnóstico del reclamo antes de guardar.');
      return;
    }

    const raw = this.reclamoForm.getRawValue();
    const resultado = raw.resultado || 'PENDIENTE';
    const payload: VehGarantiaMovimientoGuardarRequest = {
      idVehGarantiaFk: garantia.idVehGarantia,
      idVehOrdenTrabajoFk: raw.idVehOrdenTrabajoFk ?? this.otGarantiaPendienteGuardar() ?? garantia.idVehOrdenTrabajoReclamoFk ?? null,
      fechaReclamo: this.toTimestamp(raw.fechaReclamo),
      kmReclamo: Number(raw.kmReclamo || 0),
      diagnostico: raw.diagnostico?.trim() || null,
      resultado,
      valorCliente: Number(raw.valorCliente || 0),
      valorTaller: Number(raw.valorTaller || 0),
      valorProveedor: Number(raw.valorProveedor || 0),
      motivoRechazo: resultado === 'RECHAZADO' ? raw.motivoRechazo?.trim() || null : null,
      observaciones: raw.observaciones?.trim() || null,
      atributos: null,
    };

    const editingId = this.editingMovimientoId();
    const request$ = editingId
      ? this.repo.editarGarantiaMovimiento({ idVehGarantiaMovimiento: editingId, cambios: payload } as VehGarantiaMovimientoEditarRequest)
      : this.repo.crearGarantiaMovimiento(payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        const estadoSugerido = this.mapResultadoToGarantiaEstado(resultado);
        this.syncGarantiaAfterMovimiento(garantia, payload.idVehOrdenTrabajoFk ?? null, estadoSugerido);
        this.notify.success(editingId ? 'Reclamo actualizado' : 'Reclamo registrado', 'El movimiento quedó guardado en el historial de la garantía.');
        this.reclamoDialogVisible.set(false);
        this.resetReclamoTransientState();
        this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
      },
      error: (err) => this.notify.error('No se pudo guardar el reclamo', err?.message),
    });
  }

  createOtGarantiaFromDialog(): void {
    const orden = this.orden;
    const garantia = this.selectedGarantiaView();
    if (!orden || !garantia || !this.canCreateOtGarantia()) return;

    const raw = this.reclamoForm.getRawValue();
    const km = Number(raw.kmReclamo || orden.kilometrajeIngreso || garantia.kmBase || 0);

    const payload: VehOrdenTrabajoGuardarRequest = {
      dni: orden.dni,
      idCliVehiculoFk: orden.idCliVehiculoFk,
      tipoServicio: 'GARANTIA',
      estadoOrden: 'RECIBIDO',
      fechaIngreso: this.toTimestamp(raw.fechaReclamo || this.todayIso()),
      fechaPrometida: null,
      kilometrajeIngreso: km,
      nivelCombustible: orden.nivelCombustible || null,
      nivelBateria: orden.nivelBateria || null,
      fallaReportada: `RECLAMO DE GARANTIA #${garantia.idVehGarantia}`,
      sintomasReportados: orden.sintomasReportados || null,
      ruidosReportados: orden.ruidosReportados || null,
      detalleCliente: raw.diagnostico?.trim() || `Atención por garantía de la OT #${orden.idVehOrdenTrabajo}`,
      accesoriosEntregados: orden.accesoriosEntregados || null,
      condicionIngreso: orden.condicionIngreso || null,
      diagnosticoGeneral: `Atención de reclamo de garantía asociado a la OT #${orden.idVehOrdenTrabajo}`,
      recomendacionGeneral: orden.recomendacionGeneral || null,
      responsableRecepcion: orden.responsableRecepcion ?? null,
      responsableTecnico: orden.responsableTecnico ?? null,
      observaciones: [
        `OT origen: #${orden.idVehOrdenTrabajo}`,
        `Garantía: #${garantia.idVehGarantia}`,
        raw.observaciones?.trim() || '',
      ].filter(Boolean).join(' · '),
      atributos: {
        garantia: {
          idVehGarantiaFk: garantia.idVehGarantia,
          idVehOrdenTrabajoOrigenFk: orden.idVehOrdenTrabajo,
          resultadoReclamo: raw.resultado,
          generadoDesdePanel: true,
        },
      },
    };

    this.creandoOtGarantia.set(true);
    this.repo.crearOrden(payload)
      .pipe(finalize(() => this.creandoOtGarantia.set(false)))
      .subscribe({
        next: (res: any) => {
          const idOt = this.extractNumericId(res?.data, ['idVehOrdenTrabajo', 'id_veh_orden_trabajo', 'id']);

          if (idOt) {
            this.otGarantiaPendienteGuardar.set(idOt);
            this.reclamoForm.patchValue({ idVehOrdenTrabajoFk: idOt });
            this.syncGarantiaAfterMovimiento(garantia, idOt, 'RECLAMADA');
            this.notify.success('OT de garantía creada', `Se generó la OT #${idOt}. Guarda el reclamo para dejar el historial completo.`);
            return;
          }

          this.notify.success('OT de garantía creada', 'Se creó la OT de garantía. Guarda el reclamo para cerrar el flujo.');
        },
        error: (err) => this.notify.error('No se pudo crear la OT de garantía', err?.message),
      });
  }

  deleteGarantia(item: VehGarantia): void {
    if (this.readonlyMode) return;
    const ok = window.confirm(`¿Eliminar la garantía #${item.idVehGarantia}?`);
    if (!ok) return;

    this.saving.set(true);
    this.repo.eliminarGarantia(item.idVehGarantia)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Garantía eliminada', 'La garantía fue eliminada correctamente.');
          if (this.orden?.idVehOrdenTrabajo) this.loadGarantias(this.orden.idVehOrdenTrabajo);
        },
        error: (err) => this.notify.error('No se pudo eliminar la garantía', err?.message),
      });
  }

  deleteCobertura(item: VehGarantiaDetalle): void {
    if (this.readonlyMode) return;
    const garantia = this.selectedGarantiaView();
    if (!garantia) return;

    const ok = window.confirm('¿Eliminar esta cobertura?');
    if (!ok) return;

    this.saving.set(true);
    this.repo.eliminarGarantiaDetalle(item.idVehGarantiaDetalle)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Cobertura eliminada', 'La cobertura fue retirada de la garantía.');
          this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
        },
        error: (err) => this.notify.error('No se pudo eliminar la cobertura', err?.message),
      });
  }

  deleteReclamo(item: VehGarantiaMovimiento): void {
    if (this.readonlyMode) return;
    const garantia = this.selectedGarantiaView();
    if (!garantia) return;

    const ok = window.confirm('¿Eliminar este reclamo / movimiento?');
    if (!ok) return;

    this.saving.set(true);
    this.repo.eliminarGarantiaMovimiento(item.idVehGarantiaMovimiento)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Reclamo eliminado', 'El movimiento fue retirado del historial.');
          this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
        },
        error: (err) => this.notify.error('No se pudo eliminar el reclamo', err?.message),
      });
  }

  printGarantia(item: VehGarantia): void {
    const detalles = this.selectedGarantiaView()?.idVehGarantia === item.idVehGarantia ? this.detallesView() : [];
    const movimientos = this.selectedGarantiaView()?.idVehGarantia === item.idVehGarantia ? this.movimientosView() : [];

    const html = `
      <html>
        <head>
          <title>Garantía #${this.escapeHtml(String(item.idVehGarantia))}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1,h2,h3 { margin: 0 0 8px; }
            .meta, .block { margin-bottom: 18px; }
            .chip { display:inline-block; padding:4px 10px; border:1px solid #d1d5db; border-radius:999px; margin-right:8px; margin-bottom:8px; font-size:12px; }
            table { width:100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; font-size:12px; vertical-align:top; }
            th { background:#f8fafc; }
            .muted { color:#6b7280; }
          </style>
        </head>
        <body>
          <h1>Garantía #${this.escapeHtml(String(item.idVehGarantia))}</h1>
          <div class="meta">
            <div class="chip">Tipo: ${this.escapeHtml(item.tipoGarantia || '-')}</div>
            <div class="chip">Modalidad: ${this.escapeHtml(this.modalidadLabel(item.modalidadVencimiento))}</div>
            <div class="chip">Estado: ${this.escapeHtml(item.estadoGarantia || '-')}</div>
            <div class="chip">Responsable: ${this.escapeHtml(this.responsableLabel(item.responsableCosto))}</div>
          </div>
          <div class="block">
            <h3>Vigencia</h3>
            <div>Base: ${this.escapeHtml(this.formatDate(item.fechaBase))} · Km ${Number(item.kmBase || 0)}</div>
            <div>Vence: ${this.escapeHtml(this.formatDate(item.fechaVence))} · Km ${Number(item.kmVence || 0)}</div>
            <div class="muted">Cobertura: ${this.escapeHtml(this.garantiaResumenLabel(item))}</div>
          </div>
          <div class="block">
            <h3>Observaciones</h3>
            <div>${this.escapeHtml(item.observaciones || 'Sin observaciones')}</div>
          </div>
          <div class="block">
            <h3>Coberturas</h3>
            ${detalles.length ? `
              <table>
                <thead><tr><th>Qué cubre</th><th>Detalle</th><th>Monto / Cantidad</th><th>Series</th></tr></thead>
                <tbody>
                  ${detalles.map((detalle) => `
                    <tr>
                      <td>${this.escapeHtml(detalle.tipoCobertura || '-')}</td>
                      <td>${this.escapeHtml(this.detalleLabel(detalle))}<br><span class="muted">${this.escapeHtml(detalle.observaciones || '')}</span></td>
                      <td>Monto: ${this.escapeHtml(this.money(detalle.montoMaximo))}<br>Cantidad: ${Number(detalle.cantidadMaxima || 0)}</td>
                      <td>Retirada: ${this.escapeHtml(detalle.serieAnterior || '-')}<br>Instalada: ${this.escapeHtml(detalle.serieNueva || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="muted">Sin coberturas registradas.</div>'}
          </div>
          <div class="block">
            <h3>Reclamos / movimientos</h3>
            ${movimientos.length ? `
              <table>
                <thead><tr><th>Resultado</th><th>Fecha / Km</th><th>Diagnóstico</th><th>Costos</th></tr></thead>
                <tbody>
                  ${movimientos.map((movimiento) => `
                    <tr>
                      <td>${this.escapeHtml(movimiento.resultado || '-')}</td>
                      <td>${this.escapeHtml(this.formatDate(movimiento.fechaReclamo))} · Km ${Number(movimiento.kmReclamo || 0)}<br>OT: ${movimiento.idVehOrdenTrabajoFk ? '#' + movimiento.idVehOrdenTrabajoFk : '-'}</td>
                      <td>${this.escapeHtml(movimiento.diagnostico || '-')}<br><span class="muted">${this.escapeHtml(movimiento.motivoRechazo || '')}</span></td>
                      <td>Cliente: ${this.escapeHtml(this.money(movimiento.valorCliente))}<br>Taller: ${this.escapeHtml(this.money(movimiento.valorTaller))}<br>Proveedor: ${this.escapeHtml(this.money(movimiento.valorProveedor))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="muted">Sin movimientos registrados.</div>'}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1024,height=800');
    if (!printWindow) {
      this.notify.warn('No se pudo abrir la impresión', 'Revisa si el navegador está bloqueando ventanas emergentes.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  garantiaVencimientoPreview(): { fecha: string | null; km: number | null } {
    const raw = this.garantiaForm.getRawValue();
    return {
      fecha: raw.fechaVence || this.computeFechaVence(raw.fechaBase || null, Number(raw.diasGarantia || 0), Number(raw.mesesGarantia || 0)),
      km: raw.kmVence ?? this.computeKmVence(raw.kmBase, raw.kmGarantia),
    };
  }

  money(value?: number | null): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const text = String(value).trim();
    if (!text) return 'Sin fecha';

    const date = new Date(text.includes('T') ? text : `${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return text.slice(0, 10);

    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private loadGarantias(idVehOrdenTrabajo: number, focusId?: number): void {
    this.loading.set(true);
    this.repo.listarGarantias({ idVehOrdenTrabajoOrigenFk: idVehOrdenTrabajo })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const items = this.sortGarantias((result?.items ?? []) as VehGarantia[]);
          this.garantiasState.set(items);

          const selected = focusId
            ? items.find((item) => item.idVehGarantia === focusId) ?? null
            : this.resolveSelectedGarantia(items);

          this.selectedGarantiaState.set(selected);
          if (selected) {
            this.selectGarantia.emit(selected);
            this.loadSelectedGarantiaDetail(selected.idVehGarantia);
          } else {
            this.detallesState.set([]);
            this.movimientosState.set([]);
          }
        },
        error: (err) => {
          this.garantiasState.set([]);
          this.selectedGarantiaState.set(null);
          this.detallesState.set([]);
          this.movimientosState.set([]);
          this.notify.error('No se pudieron cargar las garantías', err?.message);
        },
      });
  }

  private loadSelectedGarantiaDetail(idVehGarantia: number): void {
    this.loading.set(true);
    this.repo.listarGarantiaDetalles({ idVehGarantiaFk: idVehGarantia })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detalleResult) => this.detallesState.set((detalleResult?.items ?? []) as VehGarantiaDetalle[]),
        error: (err) => {
          this.detallesState.set([]);
          this.notify.error('No se pudieron cargar las coberturas', err?.message);
        },
      });

    this.repo.listarGarantiaMovimientos({ idVehGarantiaFk: idVehGarantia })
      .subscribe({
        next: (movResult) => this.movimientosState.set(this.sortMovimientos((movResult?.items ?? []) as VehGarantiaMovimiento[])),
        error: (err) => {
          this.movimientosState.set([]);
          this.notify.error('No se pudieron cargar los reclamos', err?.message);
        },
      });
  }

  private syncGarantiaAfterMovimiento(garantia: VehGarantia, idVehOrdenTrabajoFk: number | null, estadoGarantia: string): void {
    const cambios: Partial<VehGarantiaGuardarRequest> = {
      idVehOrdenTrabajoReclamoFk: idVehOrdenTrabajoFk,
      estadoGarantia,
    };

    this.repo.editarGarantia({
      idVehGarantia: garantia.idVehGarantia,
      cambios,
    } as VehGarantiaEditarRequest).subscribe({
      next: () => {
        const updated: VehGarantia = {
          ...garantia,
          idVehOrdenTrabajoReclamoFk: idVehOrdenTrabajoFk,
          estadoGarantia,
        };
        this.selectedGarantiaState.set(updated);
        this.garantiasState.update((items) => items.map((item) => item.idVehGarantia === updated.idVehGarantia ? updated : item));
      },
      error: () => void 0,
    });
  }

  private resolveSelectedGarantia(items: VehGarantia[]): VehGarantia | null {
    const current = this.selectedGarantiaState() ?? this.selectedGarantia ?? null;
    if (!current) return items[0] ?? null;
    return items.find((item) => item.idVehGarantia === current.idVehGarantia) ?? items[0] ?? null;
  }

  private sortGarantias(items: VehGarantia[]): VehGarantia[] {
    return [...items].sort((a, b) => Number(b.idVehGarantia || 0) - Number(a.idVehGarantia || 0));
  }

  private sortMovimientos(items: VehGarantiaMovimiento[]): VehGarantiaMovimiento[] {
    return [...items].sort((a, b) => Number(b.idVehGarantiaMovimiento || 0) - Number(a.idVehGarantiaMovimiento || 0));
  }

  private mapResultadoToGarantiaEstado(resultado: ResultadoMovimiento): string {
    if (resultado === 'APROBADO') return 'APROBADA';
    if (resultado === 'RECHAZADO') return 'RECHAZADA';
    if (resultado === 'PARCIAL') return 'RECLAMADA';
    return 'RECLAMADA';
  }

  private buildTrabajoLabel(item: VehOrdenTrabajoTrabajo): string {
    return [
      item.tipoTrabajo || 'TRABAJO',
      item.descripcionInicial || item.descripcionRealizada || item.resultado || '',
    ].filter(Boolean).join(' · ');
  }

  private buildRepuestoLabel(item: VehOrdenTrabajoRepuesto): string {
    return [
      item.artcod || (item.art ? `ART-${item.art}` : ''),
      item.articulo || '',
      item.detalleInstalacion || item.motivoCambio || '',
    ].filter(Boolean).join(' · ');
  }

  private buildRepuestoOption(item: VehOrdenTrabajoRepuesto): RepuestoOtOption {
    const cantidad = Number(item.cantidad || 0);
    const precioUnitario = Number(item.precioUnitario || item.precio4 || 0);
    const total = this.moneyNumber(cantidad * precioUnitario);

    return {
      id: item.idVehOrdenTrabajoRepuesto,
      label: this.buildRepuestoLabel(item),
      art: item.art ?? null,
      artcod: item.artcod || (item.art ? `ART-${item.art}` : ''),
      articulo: item.articulo || 'Repuesto',
      cantidad,
      precioUnitario,
      total,
      serieAnterior: item.serieAnterior || '',
      serieNueva: item.serieNueva || '',
    };
  }

  private computeFechaVence(fechaBase: string | null, dias: number, meses: number): string | null {
    if (!fechaBase) return null;
    const safe = fechaBase.includes('T') ? fechaBase : `${fechaBase}T00:00:00`;
    const date = new Date(safe);
    if (Number.isNaN(date.getTime())) return null;
    if (meses) date.setMonth(date.getMonth() + meses);
    if (dias) date.setDate(date.getDate() + dias);
    return this.toInputDate(date.toISOString());
  }

  private computeKmVence(kmBase?: number | null, kmGarantia?: number | null): number | null {
    const base = Number(kmBase || 0);
    const garantia = Number(kmGarantia || 0);
    if (!base && !garantia) return null;
    return base + garantia;
  }

  private extractNumericId(data: unknown, keys: string[]): number | null {
    if (!data || typeof data !== 'object') return null;
    const record = data as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        const nested = this.extractNumericId(value, keys);
        if (nested) return nested;
      }
    }

    return null;
  }

  private toBool(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
  }

  private normalizeEstado(estado?: string | null): string {
    return String(estado || '').trim().toUpperCase();
  }

  private toInputDate(value?: string | null): string {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  private toTimestamp(value?: string | null): string | null {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (text.includes('T')) return text;
    return `${text}T00:00:00`;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private moneyNumber(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  private resetReclamoTransientState(): void {
    this.otGarantiaPendienteGuardar.set(null);
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
