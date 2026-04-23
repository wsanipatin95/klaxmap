import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { finalize } from 'rxjs/operators';
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

  // Compatibilidad con el panel anterior
  @Input() garantias: VehGarantia[] = [];
  @Input() selectedGarantia: VehGarantia | null = null;
  @Input() garantiaDetalles: VehGarantiaDetalle[] = [];
  @Input() garantiaMovimientos: VehGarantiaMovimiento[] = [];
  @Input() trabajoLabelMap: Record<number, string> = {};
  @Input() articuloLabelMap: Record<number, string> = {};
  @Input() readonlyMode = false;

  // Outputs antiguos, se mantienen para no romper el padre.
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
    return Object.entries(this.trabajoLabelMap || {})
      .map(([id, label]) => ({ id: Number(id), label }))
      .filter((item) => Number.isFinite(item.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  articuloOptions(): Array<{ art: number; label: string }> {
    return Object.entries(this.articuloLabelMap || {})
      .map(([art, label]) => ({ art: Number(art), label }))
      .filter((item) => Number.isFinite(item.art))
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


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['garantias'] && !this.garantiasState().length && this.garantias?.length) {
      this.garantiasState.set(this.garantias);
    }
    if (changes['garantiaDetalles'] && !this.detallesState().length && this.garantiaDetalles?.length) {
      this.detallesState.set(this.garantiaDetalles);
    }
    if (changes['garantiaMovimientos'] && !this.movimientosState().length && this.garantiaMovimientos?.length) {
      this.movimientosState.set(this.garantiaMovimientos);
    }
    if (changes['selectedGarantia'] && this.selectedGarantia) {
      this.selectedGarantiaState.set(this.selectedGarantia);
    }

    if (changes['orden']) {
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
    if (item.idVehOrdenTrabajoTrabajoFk && this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk]) {
      return this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk];
    }
    if (item.art && this.articuloLabelMap[item.art]) {
      return this.articuloLabelMap[item.art];
    }
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
    const value = String(tipo || '').toUpperCase();
    return value === 'TRABAJO';
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

  selectedTrabajoLabel(): string {
    const id = this.coberturaForm.controls.idVehOrdenTrabajoTrabajoFk.value;
    if (!id) return 'Selecciona un trabajo cubierto';
    return this.trabajoLabelMap[id] || `Trabajo OT #${id}`;
  }

  selectedArticuloLabel(): string {
    const art = this.coberturaForm.controls.art.value;
    if (!art) return 'Selecciona el artículo o repuesto cubierto';
    return this.articuloLabelMap[art] || `Artículo #${art}`;
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
    this.editingMovimientoId.set(null);
    this.reclamoForm.reset({
      idVehOrdenTrabajoFk: garantia.idVehOrdenTrabajoReclamoFk ?? null,
      fechaReclamo: this.todayIso(),
      kmReclamo: Number(garantia.kmBase || 0),
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

    if (isRepuesto && !raw.art) {
      this.notify.warn('Selecciona un repuesto', 'Elige el artículo o repuesto cubierto por esta garantía.');
      return;
    }

    const payload: VehGarantiaDetalleGuardarRequest = {
      idVehGarantiaFk: garantia.idVehGarantia,
      tipoCobertura: raw.tipoCobertura,
      idVehOrdenTrabajoTrabajoFk: isTrabajo ? raw.idVehOrdenTrabajoTrabajoFk : null,
      idVehOrdenTrabajoRepuestoFk: null,
      art: isRepuesto ? raw.art : null,
      cubreManoObra: raw.cubreManoObra ? 1 : 0,
      cubreRepuesto: raw.cubreRepuesto ? 1 : 0,
      montoMaximo: Number(raw.montoMaximo || 0),
      cantidadMaxima: Number(raw.cantidadMaxima || 1),
      serieAnterior: this.shouldShowSeries(raw.tipoCobertura) ? raw.serieAnterior?.trim() || null : null,
      serieNueva: this.shouldShowSeries(raw.tipoCobertura) ? raw.serieNueva?.trim() || null : null,
      observaciones: raw.observaciones?.trim() || null,
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
    if (this.reclamoForm.invalid) {
      this.reclamoForm.markAllAsTouched();
      this.notify.warn('Completa el reclamo', 'El diagnóstico es obligatorio para guardar el movimiento.');
      return;
    }

    const raw = this.reclamoForm.getRawValue();
    const payload: VehGarantiaMovimientoGuardarRequest = {
      idVehGarantiaFk: garantia.idVehGarantia,
      idVehOrdenTrabajoFk: raw.idVehOrdenTrabajoFk ?? null,
      fechaReclamo: this.toTimestamp(raw.fechaReclamo),
      kmReclamo: Number(raw.kmReclamo || 0),
      diagnostico: raw.diagnostico?.trim() || null,
      resultado: raw.resultado,
      valorCliente: Number(raw.valorCliente || 0),
      valorTaller: Number(raw.valorTaller || 0),
      valorProveedor: Number(raw.valorProveedor || 0),
      motivoRechazo: raw.resultado === 'RECHAZADO' ? raw.motivoRechazo?.trim() || null : null,
      observaciones: raw.observaciones?.trim() || null,
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
        this.notify.success(editingId ? 'Reclamo actualizado' : 'Reclamo registrado', 'El movimiento quedó guardado en el historial de la garantía.');
        this.reclamoDialogVisible.set(false);
        this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
      },
      error: (err) => this.notify.error('No se pudo guardar el reclamo', err?.message),
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
          this.notify.success('Movimiento eliminado', 'El evento fue retirado del historial de garantía.');
          this.loadSelectedGarantiaDetail(garantia.idVehGarantia);
        },
        error: (err) => this.notify.error('No se pudo eliminar el movimiento', err?.message),
      });
  }

  printGarantia(item?: VehGarantia | null): void {
    const garantia = item || this.selectedGarantiaView();
    if (!garantia) return;

    const popup = window.open('', '_blank', 'width=960,height=720');
    if (!popup) {
      this.notify.warn('No se pudo abrir la impresión', 'Permite ventanas emergentes para imprimir el resumen.');
      return;
    }

    const detalles = this.detallesView()
      .map((d) => `
        <tr>
          <td>${this.escapeHtml(this.detalleLabel(d))}</td>
          <td>${this.escapeHtml(this.detalleSubLabel(d))}</td>
          <td>${this.escapeHtml(this.coberturaBadge(d))}</td>
          <td>${this.money(d.montoMaximo)}</td>
          <td>${Number(d.cantidadMaxima || 0)}</td>
        </tr>`)
      .join('');

    const movimientos = this.movimientosView()
      .map((m) => `
        <tr>
          <td>${this.escapeHtml(this.formatDate(m.fechaReclamo))}</td>
          <td>${Number(m.kmReclamo || 0)}</td>
          <td>${this.escapeHtml(m.resultado || 'PENDIENTE')}</td>
          <td>${this.escapeHtml(m.diagnostico || '-')}</td>
          <td>${this.money(m.valorCliente)} / ${this.money(m.valorTaller)} / ${this.money(m.valorProveedor)}</td>
        </tr>`)
      .join('');

    popup.document.write(`
      <html>
        <head>
          <title>Garantía #${garantia.idVehGarantia}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1, h2 { margin: 0 0 12px; }
            .meta { margin-bottom: 16px; }
            .meta strong { display: inline-block; min-width: 160px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            .section { margin-top: 28px; }
          </style>
        </head>
        <body>
          <h1>Resumen de garantía #${garantia.idVehGarantia}</h1>
          <div class="meta"><strong>OT origen:</strong> ${this.orden?.idVehOrdenTrabajo || '-'} </div>
          <div class="meta"><strong>Tipo:</strong> ${this.escapeHtml(garantia.tipoGarantia || '-')}</div>
          <div class="meta"><strong>Modalidad:</strong> ${this.escapeHtml(this.modalidadLabel(garantia.modalidadVencimiento))}</div>
          <div class="meta"><strong>Estado:</strong> ${this.escapeHtml(garantia.estadoGarantia || '-')}</div>
          <div class="meta"><strong>Responsable:</strong> ${this.escapeHtml(this.responsableLabel(garantia.responsableCosto))}</div>
          <div class="meta"><strong>Base:</strong> ${this.escapeHtml(this.formatDate(garantia.fechaBase))} · Km ${Number(garantia.kmBase || 0)}</div>
          <div class="meta"><strong>Vence:</strong> ${this.escapeHtml(this.formatDate(garantia.fechaVence))} · Km ${Number(garantia.kmVence || 0)}</div>
          <div class="meta"><strong>Observaciones:</strong> ${this.escapeHtml(garantia.observaciones || 'Sin observaciones')}</div>

          <div class="section">
            <h2>Coberturas</h2>
            <table>
              <thead>
                <tr>
                  <th>Elemento</th>
                  <th>Tipo</th>
                  <th>Cubre</th>
                  <th>Monto máximo</th>
                  <th>Cantidad máxima</th>
                </tr>
              </thead>
              <tbody>
                ${detalles || '<tr><td colspan="5">Sin coberturas registradas.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Reclamos / movimientos</h2>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Km</th>
                  <th>Resultado</th>
                  <th>Diagnóstico</th>
                  <th>Costos</th>
                </tr>
              </thead>
              <tbody>
                ${movimientos || '<tr><td colspan="5">Sin movimientos registrados.</td></tr>'}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  selectGarantiaCard(item: VehGarantia): void {
    this.selectedGarantiaState.set(item);
    this.selectGarantia.emit(item);
    this.loadSelectedGarantiaDetail(item.idVehGarantia);
  }

  private loadGarantias(idVehOrdenTrabajoOrigenFk: number, preferredId?: number): void {
    this.loading.set(true);
    this.repo.listarGarantias({ idVehOrdenTrabajoOrigenFk })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.garantiasState.set(items);

          const currentSelected = preferredId
            ? items.find((x) => x.idVehGarantia === preferredId) || null
            : this.selectedGarantiaState()
              ? items.find((x) => x.idVehGarantia === this.selectedGarantiaState()!.idVehGarantia) || null
              : items[0] || null;

          this.selectedGarantiaState.set(currentSelected);
          if (currentSelected) {
            this.loadSelectedGarantiaDetail(currentSelected.idVehGarantia);
          } else {
            this.detallesState.set([]);
            this.movimientosState.set([]);
          }
        },
        error: (err) => this.notify.error('No se pudieron cargar las garantías', err?.message),
      });
  }

  private loadSelectedGarantiaDetail(idVehGarantia: number): void {
    this.loading.set(true);
    this.repo.listarGarantiaDetalles({ idVehGarantiaFk: idVehGarantia })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (det) => {
          this.detallesState.set(det.items ?? []);
        },
        error: (err) => this.notify.error('No se pudo cargar la cobertura', err?.message),
      });

    this.repo.listarGarantiaMovimientos({ idVehGarantiaFk: idVehGarantia }).subscribe({
      next: (mov) => this.movimientosState.set(mov.items ?? []),
      error: (err) => this.notify.error('No se pudo cargar el historial del reclamo', err?.message),
    });
  }

  private computeFechaVence(fechaBase: string | null, dias: number, meses: number): string | null {
    if (!fechaBase) return null;
    const base = new Date(`${fechaBase}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    const dt = new Date(base);
    if (meses > 0) dt.setMonth(dt.getMonth() + meses);
    if (dias > 0) dt.setDate(dt.getDate() + dias);
    return dt.toISOString().slice(0, 10);
  }

  private toTimestamp(value?: string | null): string | null {
    if (!value) return null;
    if (value.includes('T')) return value;
    return `${value}T00:00:00-05:00`;
  }

  private toInputDate(value?: string | null): string {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
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
