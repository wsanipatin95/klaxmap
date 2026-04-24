import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-orden-garantias-panel',
  standalone: true,
  imports: [
    CommonModule,
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
  readonly creandoOtGarantia = signal(false);
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
      this.garantiasState.set(this.garantias);
    }
    if (changes['garantiaDetalles'] && this.garantiaDetalles?.length) {
      this.detallesState.set(this.garantiaDetalles);
    }
    if (changes['garantiaMovimientos'] && this.garantiaMovimientos?.length) {
      this.movimientosState.set(this.garantiaMovimientos);
    }
    if (changes['selectedGarantia'] && this.selectedGarantia) {
      this.selectedGarantiaState.set(this.selectedGarantia);
    }

    if (changes['orden']) {
      const order = this.orden;
      this.resetReclamoTransientState();
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
    return local.length ? local : (this.garantias ?? []);
  }

  detallesView(): VehGarantiaDetalle[] {
    const local = this.detallesState();
    return local.length ? local : (this.garantiaDetalles ?? []);
  }

  movimientosView(): VehGarantiaMovimiento[] {
    const local = this.movimientosState();
    return local.length ? local : (this.garantiaMovimientos ?? []);
  }

  trabajoOptions(): Array<{ id: number; label: string }> {
    const fromRows = (this.trabajosOt ?? []).map((item) => ({
      id: item.idVehOrdenTrabajoTrabajo,
      label: this.buildTrabajoLabel(item),
    }));

    if (fromRows.length) return fromRows;

    return Object.entries(this.trabajoLabelMap || {})
      .map(([id, label]) => ({ id: Number(id), label }))
      .filter((item) => Number.isFinite(item.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  repuestoOtOptions(): Array<{ id: number; label: string; art: number | null; serieAnterior: string; serieNueva: string }> {
    return (this.repuestosOt ?? []).map((item) => ({
      id: item.idVehOrdenTrabajoRepuesto,
      label: this.buildRepuestoLabel(item),
      art: item.art ?? null,
      serieAnterior: item.serieAnterior || '',
      serieNueva: item.serieNueva || '',
    }));
  }

  articuloOptions(): Array<{ art: number; label: string }> {
    const fromRows = (this.repuestosOt ?? [])
      .filter((item) => !!item.art)
      .map((item) => ({
        art: Number(item.art),
        label: this.buildRepuestoLabel(item),
      }));

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

  resumen(): { total: number; activas: number; reclamos: number; coberturas: number } {
    const garantias = this.garantiasView();
    const detalles = this.detallesView();
    const movimientos = this.movimientosView();
    return {
      total: garantias.length,
      activas: garantias.filter((x) => this.normalizeEstado(x.estadoGarantia).includes('ACTIVA')).length,
      reclamos: movimientos.length,
      coberturas: detalles.length,
    };
  }

  garantiaVencimientoPreview(): { fecha: string | null; km: number } {
    const fechaBase = this.garantiaForm.controls.fechaBase.value || null;
    const dias = Number(this.garantiaForm.controls.diasGarantia.value || 0);
    const meses = Number(this.garantiaForm.controls.mesesGarantia.value || 0);
    const kmBase = Number(this.garantiaForm.controls.kmBase.value || 0);
    const kmGarantia = Number(this.garantiaForm.controls.kmGarantia.value || 0);
    return {
      fecha: this.computeFechaVence(fechaBase, dias, meses),
      km: kmBase + kmGarantia,
    };
  }

  estadoSeverity(estado?: string | null) {
    const v = this.normalizeEstado(estado);
    if (v.includes('ACTIVA') || v.includes('APROB')) return 'success';
    if (v.includes('RECLAM') || v.includes('REVISION') || v.includes('PARCIAL') || v.includes('PENDIENTE')) return 'warn';
    if (v.includes('RECHAZ') || v.includes('ANUL')) return 'danger';
    if (v.includes('VENC')) return 'secondary';
    return 'secondary';
  }

  normalizeEstado(value?: string | null): string {
    return String(value || '').trim().toUpperCase();
  }

  formatDate(value?: string | null): string {
    if (!value) return '-';
    const safe = value.includes('T') ? value : `${value}T00:00:00`;
    const dt = new Date(safe);
    if (Number.isNaN(dt.getTime())) return value;
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(dt);
  }

  money(value?: number | null): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  modalidadLabel(modalidad?: string | null): string {
    const value = String(modalidad || '').toUpperCase();
    if (value === 'TIEMPO') return 'Por tiempo';
    if (value === 'KM') return 'Por kilometraje';
    if (value === 'TIEMPO_O_KM') return 'Por tiempo o km';
    return modalidad || '-';
  }

  responsableLabel(responsable?: string | null): string {
    const value = String(responsable || '').toUpperCase();
    if (value === 'TALLER') return 'Taller';
    if (value === 'PROVEEDOR') return 'Proveedor';
    if (value === 'CLIENTE') return 'Cliente';
    if (value === 'MIXTO') return 'Compartido';
    return responsable || '-';
  }

  garantiaResumenLabel(item: VehGarantia): string {
    const partes: string[] = [];
    if ((item.mesesGarantia || 0) > 0) partes.push(`${item.mesesGarantia} mes(es)`);
    if ((item.diasGarantia || 0) > 0) partes.push(`${item.diasGarantia} día(s)`);
    if ((item.kmGarantia || 0) > 0) partes.push(`${item.kmGarantia} km`);
    return partes.length ? partes.join(' · ') : this.modalidadLabel(item.modalidadVencimiento);
  }

  detalleLabel(item: VehGarantiaDetalle): string {
    if (item.idVehOrdenTrabajoTrabajoFk) {
      const trabajo = (this.trabajosOt ?? []).find((x) => x.idVehOrdenTrabajoTrabajo === item.idVehOrdenTrabajoTrabajoFk);
      if (trabajo) return this.buildTrabajoLabel(trabajo);
      if (this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk]) return this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk];
    }
    if (item.idVehOrdenTrabajoRepuestoFk) {
      const repuesto = (this.repuestosOt ?? []).find((x) => x.idVehOrdenTrabajoRepuesto === item.idVehOrdenTrabajoRepuestoFk);
      if (repuesto) return this.buildRepuestoLabel(repuesto);
    }
    if (item.art && this.articuloLabelMap[item.art]) return this.articuloLabelMap[item.art];
    if (this.isRepuestoCoverage(item.tipoCobertura)) return 'Repuesto cubierto';
    if (this.isTrabajoCoverage(item.tipoCobertura)) return 'Trabajo cubierto';
    return item.tipoCobertura || 'Cobertura';
  }

  detalleSubLabel(item: VehGarantiaDetalle): string {
    if (this.isTrabajoCoverage(item.tipoCobertura)) return 'Mano de obra / trabajo cubierto';
    if (this.isRepuestoCoverage(item.tipoCobertura)) return 'Repuesto / artículo cubierto';
    return 'Cobertura mixta';
  }

  coberturaBadge(item: VehGarantiaDetalle): string {
    const partes: string[] = [];
    if (this.toBool(item.cubreManoObra)) partes.push('MO');
    if (this.toBool(item.cubreRepuesto)) partes.push('REP');
    return partes.length ? partes.join(' + ') : 'Sin cobertura';
  }

  movimientoTitle(item: VehGarantiaMovimiento): string {
    const estado = item.resultado || 'PENDIENTE';
    if (item.idVehOrdenTrabajoFk) return `${estado} · OT #${item.idVehOrdenTrabajoFk}`;
    return estado;
  }

  toBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
  }

  isTrabajoCoverage(tipo?: string | null): boolean {
    return String(tipo || '').toUpperCase() === 'TRABAJO';
  }

  isRepuestoCoverage(tipo?: string | null): boolean {
    const value = String(tipo || '').toUpperCase();
    return value === 'REPUESTO' || value === 'MIXTA';
  }

  shouldShowSeries(tipo?: string | null): boolean {
    return this.isRepuestoCoverage(tipo);
  }

  shouldShowMotivoRechazo(): boolean {
    return this.reclamoForm.controls.resultado.value === 'RECHAZADO';
  }

  shouldRequireOtAtencion(): boolean {
    const resultado = this.reclamoForm.controls.resultado.value;
    return resultado === 'APROBADO' || resultado === 'PARCIAL';
  }

  hasExistingOtGarantia(): boolean {
    const garantia = this.selectedGarantiaView();
    const formOt = this.normalizeNullableNumber(this.reclamoForm.controls.idVehOrdenTrabajoFk.value);
    const garantiaOt = this.normalizeNullableNumber(garantia?.idVehOrdenTrabajoReclamoFk ?? null);
    return formOt != null || garantiaOt != null || this.otGarantiaPendienteGuardar() != null;
  }

  currentOtGarantiaId(): number | null {
    return this.normalizeNullableNumber(this.reclamoForm.controls.idVehOrdenTrabajoFk.value)
      ?? this.normalizeNullableNumber(this.selectedGarantiaView()?.idVehOrdenTrabajoReclamoFk ?? null)
      ?? this.otGarantiaPendienteGuardar();
  }

  canCreateOtGarantia(): boolean {
    return !this.readonlyMode
      && !this.creandoOtGarantia()
      && !this.saving()
      && !!this.orden
      && !!this.selectedGarantiaView()
      && !this.hasExistingOtGarantia();
  }

  canSaveReclamo(): boolean {
    return !this.readonlyMode && !this.saving() && !this.creandoOtGarantia();
  }

  selectedTrabajoLabel(): string {
    const id = this.coberturaForm.controls.idVehOrdenTrabajoTrabajoFk.value;
    if (!id) return 'Selecciona un trabajo cubierto';
    const trabajo = (this.trabajosOt ?? []).find((x) => x.idVehOrdenTrabajoTrabajo === id);
    return trabajo ? this.buildTrabajoLabel(trabajo) : (this.trabajoLabelMap[id] || `Trabajo OT #${id}`);
  }

  selectedArticuloLabel(): string {
    const idRepuesto = this.coberturaForm.controls.idVehOrdenTrabajoRepuestoFk.value;
    if (idRepuesto) {
      const repuesto = (this.repuestosOt ?? []).find((x) => x.idVehOrdenTrabajoRepuesto === idRepuesto);
      if (repuesto) return this.buildRepuestoLabel(repuesto);
    }
    const art = this.coberturaForm.controls.art.value;
    if (!art) return 'Selecciona el artículo o repuesto cubierto';
    return this.articuloLabelMap[art] || `Artículo #${art}`;
  }

  onRepuestoOtChange(): void {
    const idRepuesto = this.coberturaForm.controls.idVehOrdenTrabajoRepuestoFk.value;
    const repuesto = (this.repuestosOt ?? []).find((x) => x.idVehOrdenTrabajoRepuesto === idRepuesto);
    if (!repuesto) return;
    this.coberturaForm.patchValue({
      art: repuesto.art ?? null,
      serieAnterior: repuesto.serieAnterior || '',
      serieNueva: repuesto.serieNueva || '',
      cubreRepuesto: true,
    });
  }

  selectGarantiaCard(item: VehGarantia): void {
    this.selectedGarantiaState.set(item);
    this.selectGarantia.emit(item);
    this.loadSelectedGarantiaDetail(item.idVehGarantia);
  }

  openNuevaGarantia(): void {
    if (!this.orden || this.readonlyMode) return;
    this.editingGarantiaId.set(null);
    this.garantiaForm.reset({
      tipoGarantia: 'REPUESTO',
      modalidadVencimiento: 'TIEMPO_O_KM',
      fechaBase: this.toInputDate(this.orden.fechaIngreso) || this.todayIso(),
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
    this.editingGarantiaId.set(item.idVehGarantia);
    this.garantiaForm.reset({
      tipoGarantia: item.tipoGarantia || 'REPUESTO',
      modalidadVencimiento: item.modalidadVencimiento || 'TIEMPO_O_KM',
      fechaBase: this.toInputDate(item.fechaBase),
      kmBase: Number(item.kmBase || 0),
      diasGarantia: item.diasGarantia ?? null,
      mesesGarantia: item.mesesGarantia ?? null,
      kmGarantia: Number(item.kmGarantia || 0),
      fechaVence: this.toInputDate(item.fechaVence),
      kmVence: item.kmVence != null ? Number(item.kmVence) : null,
      estadoGarantia: item.estadoGarantia || 'ACTIVA',
      responsableCosto: item.responsableCosto || 'TALLER',
      observaciones: item.observaciones || '',
    });
    this.garantiaDialogVisible.set(true);
  }

  openNuevaCobertura(): void {
    const garantia = this.selectedGarantiaView();
    if (!garantia || this.readonlyMode) return;
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
    this.editingDetalleId.set(item.idVehGarantiaDetalle);
    this.coberturaForm.reset({
      tipoCobertura: (String(item.tipoCobertura || 'REPUESTO').toUpperCase() as CoverageType),
      idVehOrdenTrabajoTrabajoFk: item.idVehOrdenTrabajoTrabajoFk ?? null,
      idVehOrdenTrabajoRepuestoFk: item.idVehOrdenTrabajoRepuestoFk ?? null,
      art: item.art ?? null,
      cubreManoObra: this.toBool(item.cubreManoObra),
      cubreRepuesto: this.toBool(item.cubreRepuesto),
      montoMaximo: Number(item.montoMaximo || 0),
      cantidadMaxima: Number(item.cantidadMaxima || 1),
      serieAnterior: item.serieAnterior || '',
      serieNueva: item.serieNueva || '',
      observaciones: item.observaciones || '',
    });
    this.coberturaDialogVisible.set(true);
  }

  openNuevoReclamo(): void {
    const garantia = this.selectedGarantiaView();
    if (!garantia || this.readonlyMode) return;
    this.resetReclamoTransientState();
    this.editingMovimientoId.set(null);
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
    this.resetReclamoTransientState();
    this.editingMovimientoId.set(item.idVehGarantiaMovimiento);
    this.reclamoForm.reset({
      idVehOrdenTrabajoFk: item.idVehOrdenTrabajoFk ?? null,
      fechaReclamo: this.toInputDate(item.fechaReclamo),
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
    if (this.otGarantiaPendienteGuardar()) {
      this.notify.warn(
        'Guarda el reclamo',
        `Ya se creó la OT #${this.otGarantiaPendienteGuardar()}. Guarda el reclamo antes de cerrar para dejar el vínculo correcto.`,
      );
      return;
    }
    this.reclamoDialogVisible.set(false);
    this.resetReclamoTransientState();
  }

  onReclamoDialogVisibleChange(visible: boolean): void {
    if (visible) {
      this.reclamoDialogVisible.set(true);
      return;
    }
    this.closeReclamoDialog();
  }

  saveGarantia(): void {
    const orden = this.orden;
    if (!orden) return;
    if (this.garantiaForm.invalid) {
      this.garantiaForm.markAllAsTouched();
      this.notify.warn('Completa la garantía', 'Tipo, modalidad, estado y responsable son obligatorios.');
      return;
    }

    const raw = this.garantiaForm.getRawValue();
    const fechaVence = raw.fechaVence || this.garantiaVencimientoPreview().fecha || null;
    const kmVence = raw.kmVence != null ? Number(raw.kmVence) : this.garantiaVencimientoPreview().km;

    const payload: VehGarantiaGuardarRequest = {
      idVehOrdenTrabajoOrigenFk: orden.idVehOrdenTrabajo,
      tipoGarantia: raw.tipoGarantia,
      modalidadVencimiento: raw.modalidadVencimiento,
      fechaBase: this.toTimestamp(raw.fechaBase),
      kmBase: Number(raw.kmBase || 0),
      diasGarantia: raw.diasGarantia ?? null,
      mesesGarantia: raw.mesesGarantia ?? null,
      kmGarantia: Number(raw.kmGarantia || 0),
      fechaVence: this.toTimestamp(fechaVence),
      kmVence,
      estadoGarantia: raw.estadoGarantia,
      responsableCosto: raw.responsableCosto,
      observaciones: raw.observaciones?.trim() || null,
      atributos: null,
    };

    const editingId = this.editingGarantiaId();
    const request$ = editingId
      ? this.repo.editarGarantia({
          idVehGarantia: editingId,
          cambios: payload,
        } as VehGarantiaEditarRequest)
      : this.repo.crearGarantia(payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(editingId ? 'Garantía actualizada' : 'Garantía creada', 'La cabecera de garantía quedó guardada.');
        this.garantiaDialogVisible.set(false);
        this.loadGarantias(orden.idVehOrdenTrabajo, editingId ?? undefined);
      },
      error: (err) => this.notify.error('No se pudo guardar la garantía', err?.message),
    });
  }

  saveCobertura(): void {
    const garantia = this.selectedGarantiaView();
    if (!garantia) return;
    if (this.coberturaForm.invalid) {
      this.coberturaForm.markAllAsTouched();
      this.notify.warn('Completa la cobertura', 'Debes definir al menos qué cubre la garantía.');
      return;
    }

    const raw = this.coberturaForm.getRawValue();
    const isTrabajo = this.isTrabajoCoverage(raw.tipoCobertura);
    const isRepuesto = this.isRepuestoCoverage(raw.tipoCobertura);

    if (isTrabajo && !raw.idVehOrdenTrabajoTrabajoFk) {
      this.notify.warn('Selecciona un trabajo', 'Elige el trabajo de la OT que queda cubierto.');
      return;
    }

    if (isRepuesto && !raw.idVehOrdenTrabajoRepuestoFk && !raw.art) {
      this.notify.warn('Selecciona un repuesto', 'Elige el repuesto de la OT o el artículo cubierto por esta garantía.');
      return;
    }

    const payload: VehGarantiaDetalleGuardarRequest = {
      idVehGarantiaFk: garantia.idVehGarantia,
      tipoCobertura: raw.tipoCobertura,
      idVehOrdenTrabajoTrabajoFk: isTrabajo ? raw.idVehOrdenTrabajoTrabajoFk : null,
      idVehOrdenTrabajoRepuestoFk: isRepuesto ? raw.idVehOrdenTrabajoRepuestoFk : null,
      art: isRepuesto ? (raw.art ?? null) : null,
      cubreManoObra: raw.cubreManoObra ? 1 : 0,
      cubreRepuesto: raw.cubreRepuesto ? 1 : 0,
      montoMaximo: Number(raw.montoMaximo || 0),
      cantidadMaxima: Number(raw.cantidadMaxima || 1),
      serieAnterior: this.shouldShowSeries(raw.tipoCobertura) ? raw.serieAnterior?.trim() || null : null,
      serieNueva: this.shouldShowSeries(raw.tipoCobertura) ? raw.serieNueva?.trim() || null : null,
      observaciones: raw.observaciones?.trim() || null,
      atributos: null,
    };

    const editingId = this.editingDetalleId();
    const request$ = editingId
      ? this.repo.editarGarantiaDetalle({
          idVehGarantiaDetalle: editingId,
          cambios: payload,
        } as VehGarantiaDetalleEditarRequest)
      : this.repo.crearGarantiaDetalle(payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(editingId ? 'Cobertura actualizada' : 'Cobertura creada', 'La cobertura quedó registrada en la garantía.');
        this.coberturaDialogVisible.set(false);
        this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
      },
      error: (err) => this.notify.error('No se pudo guardar la cobertura', err?.message),
    });
  }

  saveReclamo(): void {
    const garantia = this.selectedGarantiaView();
    if (!garantia) return;
    if (!this.validateReclamoBeforeSave()) return;

    const raw = this.reclamoForm.getRawValue();
    const idOtAtencion = this.normalizeNullableNumber(raw.idVehOrdenTrabajoFk);
    const payload: VehGarantiaMovimientoGuardarRequest = {
      idVehGarantiaFk: garantia.idVehGarantia,
      idVehOrdenTrabajoFk: idOtAtencion,
      fechaReclamo: this.toTimestamp(raw.fechaReclamo),
      kmReclamo: Number(raw.kmReclamo || 0),
      diagnostico: raw.diagnostico?.trim() || null,
      resultado: raw.resultado,
      valorCliente: Number(raw.valorCliente || 0),
      valorTaller: Number(raw.valorTaller || 0),
      valorProveedor: Number(raw.valorProveedor || 0),
      motivoRechazo: raw.resultado === 'RECHAZADO' ? raw.motivoRechazo?.trim() || null : null,
      observaciones: raw.observaciones?.trim() || null,
      atributos: null,
    };

    const editingId = this.editingMovimientoId();
    const request$ = editingId
      ? this.repo.editarGarantiaMovimiento({
          idVehGarantiaMovimiento: editingId,
          cambios: payload,
        } as VehGarantiaMovimientoEditarRequest)
      : this.repo.crearGarantiaMovimiento(payload);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        const estadoSugerido = this.mapResultadoToGarantiaEstado(raw.resultado);
        this.syncGarantiaAfterMovimiento(garantia, idOtAtencion, estadoSugerido);
        this.notify.success(editingId ? 'Reclamo actualizado' : 'Reclamo registrado', 'El movimiento quedó guardado en el historial de la garantía.');
        this.otGarantiaPendienteGuardar.set(null);
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
    if (!orden || !garantia || this.readonlyMode) return;
    if (!this.validateReclamoBeforeCreateOt()) return;

    const raw = this.reclamoForm.getRawValue();
    const km = Number(raw.kmReclamo || orden.kilometrajeIngreso || 0);

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
          tipoGarantia: garantia.tipoGarantia || null,
          modalidadVencimiento: garantia.modalidadVencimiento || null,
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
          if (!idOt) {
            this.notify.success('OT de garantía creada', 'Se creó la OT, pero no se pudo recuperar el número. Vincúlala manualmente antes de guardar el reclamo.');
            return;
          }

          this.reclamoForm.patchValue({ idVehOrdenTrabajoFk: idOt });
          this.otGarantiaPendienteGuardar.set(idOt);
          this.notify.success('OT de garantía creada', `Se generó la OT #${idOt}. Ahora guarda el reclamo para dejar el vínculo completo.`);
        },
        error: (err) => this.notify.error('No se pudo crear la OT de garantía', err?.message),
      });
  }

  deleteGarantia(item: VehGarantia): void {
    if (this.readonlyMode) return;
    const ok = window.confirm(`¿Eliminar la garantía #${item.idVehGarantia}?`);
    if (!ok || !this.orden) return;

    this.saving.set(true);
    this.repo.eliminarGarantia(item.idVehGarantia)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Garantía eliminada', 'La garantía fue retirada de la OT.');
          this.loadGarantias(this.orden!.idVehOrdenTrabajo);
        },
        error: (err) => this.notify.error('No se pudo eliminar la garantía', err?.message),
      });
  }

  deleteCobertura(item: VehGarantiaDetalle): void {
    if (this.readonlyMode) return;
    const ok = window.confirm('¿Eliminar esta cobertura de la garantía?');
    if (!ok) return;

    const garantia = this.selectedGarantiaView();
    if (!garantia) return;

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
    const ok = window.confirm('¿Eliminar este reclamo o movimiento?');
    if (!ok) return;

    const garantia = this.selectedGarantiaView();
    if (!garantia) return;

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
          <title>Garantía #${item.idVehGarantia}</title>
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
          <h1>Garantía #${item.idVehGarantia}</h1>
          <div class="meta">
            <div class="chip">Tipo: ${item.tipoGarantia || '-'}</div>
            <div class="chip">Modalidad: ${this.modalidadLabel(item.modalidadVencimiento)}</div>
            <div class="chip">Estado: ${item.estadoGarantia || '-'}</div>
            <div class="chip">Responsable: ${this.responsableLabel(item.responsableCosto)}</div>
          </div>
          <div class="block">
            <h3>Vigencia</h3>
            <div>Base: ${this.formatDate(item.fechaBase)} · Km ${item.kmBase || 0}</div>
            <div>Vence: ${this.formatDate(item.fechaVence)} · Km ${item.kmVence || 0}</div>
            <div class="muted">Cobertura: ${this.garantiaResumenLabel(item)}</div>
          </div>
          <div class="block">
            <h3>Observaciones</h3>
            <div>${item.observaciones || 'Sin observaciones'}</div>
          </div>
          <div class="block">
            <h3>Coberturas</h3>
            ${detalles.length ? `
              <table>
                <thead>
                  <tr><th>Qué cubre</th><th>Detalle</th><th>Monto/Cantidad</th><th>Series</th></tr>
                </thead>
                <tbody>
                  ${detalles.map((d) => `
                    <tr>
                      <td>${d.tipoCobertura || '-'}</td>
                      <td>${this.detalleLabel(d)}<br><span class="muted">${d.observaciones || ''}</span></td>
                      <td>Monto: ${this.money(d.montoMaximo)}<br>Cantidad: ${d.cantidadMaxima || 0}</td>
                      <td>Retirada: ${d.serieAnterior || '-'}<br>Instalada: ${d.serieNueva || '-'}</td>
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
                <thead>
                  <tr><th>Resultado</th><th>Fecha / Km</th><th>Diagnóstico</th><th>Costos</th></tr>
                </thead>
                <tbody>
                  ${movimientos.map((m) => `
                    <tr>
                      <td>${m.resultado || '-'}</td>
                      <td>${this.formatDate(m.fechaReclamo)} · Km ${m.kmReclamo || 0}<br>OT: ${m.idVehOrdenTrabajoFk ? '#' + m.idVehOrdenTrabajoFk : '-'}</td>
                      <td>${m.diagnostico || '-'}<br><span class="muted">${m.motivoRechazo || ''}</span></td>
                      <td>Cliente: ${this.money(m.valorCliente)}<br>Taller: ${this.money(m.valorTaller)}<br>Proveedor: ${this.money(m.valorProveedor)}</td>
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

  private loadGarantias(idVehOrdenTrabajo: number, focusId?: number): void {
    this.loading.set(true);
    this.repo.listarGarantias({ idVehOrdenTrabajoOrigenFk: idVehOrdenTrabajo })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          const items = (result?.items ?? []) as VehGarantia[];
          const sorted = [...items].sort((a, b) => Number(b.idVehGarantia || 0) - Number(a.idVehGarantia || 0));
          this.garantiasState.set(sorted);

          const selected = focusId
            ? sorted.find((x) => x.idVehGarantia === focusId) ?? null
            : this.resolveSelectedGarantia(sorted);

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
        next: (detalleResult) => {
          this.detallesState.set((detalleResult?.items ?? []) as VehGarantiaDetalle[]);
        },
        error: (err) => {
          this.detallesState.set([]);
          this.notify.error('No se pudieron cargar las coberturas', err?.message);
        },
      });

    this.repo.listarGarantiaMovimientos({ idVehGarantiaFk: idVehGarantia })
      .subscribe({
        next: (movResult) => {
          const items = ((movResult?.items ?? []) as VehGarantiaMovimiento[]).sort((a, b) =>
            Number(b.idVehGarantiaMovimiento || 0) - Number(a.idVehGarantiaMovimiento || 0),
          );
          this.movimientosState.set(items);
        },
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
        this.garantiasState.update((items) => items.map((x) => x.idVehGarantia === updated.idVehGarantia ? updated : x));
      },
      error: () => void 0,
    });
  }

  private resolveSelectedGarantia(items: VehGarantia[]): VehGarantia | null {
    const current = this.selectedGarantiaState() ?? this.selectedGarantia ?? null;
    if (!current) return items[0] ?? null;
    return items.find((x) => x.idVehGarantia === current.idVehGarantia) ?? items[0] ?? null;
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

  private computeFechaVence(fechaBase: string | null, dias: number, meses: number): string | null {
    if (!fechaBase) return null;
    const safe = fechaBase.includes('T') ? fechaBase : `${fechaBase}T00:00:00`;
    const date = new Date(safe);
    if (Number.isNaN(date.getTime())) return null;
    if (meses) date.setMonth(date.getMonth() + meses);
    if (dias) date.setDate(date.getDate() + dias);
    return this.toInputDate(date.toISOString());
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

  private validateReclamoBeforeCreateOt(): boolean {
    if (!this.canCreateOtGarantia()) {
      const existingOt = this.currentOtGarantiaId();
      if (existingOt) {
        this.notify.warn('OT ya creada', `La garantía ya tiene asociada la OT #${existingOt}. No se puede crear otra desde este diálogo.`);
      }
      return false;
    }

    const raw = this.reclamoForm.getRawValue();
    const diagnostico = String(raw.diagnostico || '').trim();
    if (!diagnostico) {
      this.reclamoForm.controls.diagnostico.markAsTouched();
      this.notify.warn('Falta diagnóstico', 'Escribe el diagnóstico antes de crear la OT de garantía.');
      return false;
    }

    if (!raw.fechaReclamo) {
      this.reclamoForm.controls.fechaReclamo.markAsTouched();
      this.notify.warn('Falta fecha', 'Selecciona la fecha del reclamo antes de crear la OT de garantía.');
      return false;
    }

    const km = this.normalizeNullableNumber(raw.kmReclamo);
    if (km == null || km < 0) {
      this.reclamoForm.controls.kmReclamo.markAsTouched();
      this.notify.warn('Kilometraje inválido', 'Ingresa un kilometraje válido antes de crear la OT de garantía.');
      return false;
    }

    return true;
  }

  private validateReclamoBeforeSave(): boolean {
    if (this.reclamoForm.invalid) {
      this.reclamoForm.markAllAsTouched();
      this.notify.warn('Completa el reclamo', 'El diagnóstico es obligatorio para guardar el movimiento.');
      return false;
    }

    const garantia = this.selectedGarantiaView();
    const raw = this.reclamoForm.getRawValue();
    const resultado = raw.resultado;
    const idOtForm = this.normalizeNullableNumber(raw.idVehOrdenTrabajoFk);
    const idOtGarantia = this.normalizeNullableNumber(garantia?.idVehOrdenTrabajoReclamoFk ?? null);

    if (resultado === 'RECHAZADO' && !String(raw.motivoRechazo || '').trim()) {
      this.reclamoForm.controls.motivoRechazo.markAsTouched();
      this.notify.warn('Falta motivo de rechazo', 'Cuando el reclamo se rechaza, debes registrar el motivo.');
      return false;
    }

    if (this.shouldRequireOtAtencion() && !idOtForm) {
      this.reclamoForm.controls.idVehOrdenTrabajoFk.markAsTouched();
      this.notify.warn('Falta OT de atención', 'Para un reclamo aprobado o parcial debes vincular una OT de garantía.');
      return false;
    }

    if (idOtGarantia != null && idOtForm != null && idOtGarantia !== idOtForm) {
      this.notify.warn('OT inconsistente', `La garantía ya está vinculada a la OT #${idOtGarantia}. No puedes guardar este reclamo con la OT #${idOtForm}.`);
      return false;
    }

    if (this.otGarantiaPendienteGuardar() != null && idOtForm !== this.otGarantiaPendienteGuardar()) {
      this.notify.warn('OT pendiente inconsistente', `Ya se creó la OT #${this.otGarantiaPendienteGuardar()}. Guarda el reclamo con esa OT o cierra el caso correctamente.`);
      return false;
    }

    return true;
  }

  private normalizeNullableNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resetReclamoTransientState(): void {
    this.otGarantiaPendienteGuardar.set(null);
    this.editingMovimientoId.set(null);
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
}
