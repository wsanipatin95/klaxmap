import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { VehiculosEmptyStateComponent } from '../../../../components/empty-state/empty-state.component';
import { VehiculoVistaCanvasComponent } from '../../../../components/vehiculo-vista-canvas/vehiculo-vista-canvas.component';
import {
  FacturaComercialSavePayload,
  OrdenComercialPanelComponent,
} from '../orden-comercial-panel/orden-comercial-panel.component';
import {
  VehArticuloCatalogo,
  VehCheckListVehiculo,
  VehCobro,
  VehFactura,
  VehFacturacionWorkflowResultado,
  VehOrdenTrabajo,
  VehOrdenTrabajoAutorizacion,
  VehOrdenTrabajoCheckList,
  VehOrdenTrabajoFactura,
  VehOrdenTrabajoHallazgo,
  VehOrdenTrabajoHallazgoFoto,
  VehOrdenTrabajoHallazgoMarca,
  VehOrdenTrabajoRepuesto,
  VehOrdenTrabajoTrabajo,
  VehTipoVehiculoVista,
} from '../../../../data-access/vehiculos.models';

type OrdenDetailTab =
  | 'resumen'
  | 'checklist'
  | 'ejecucion'
  | 'repuestos'
  | 'comercial';

type ExecutionTab = 'detalle' | 'hallazgos';
type HallazgoInnerTab = 'marcas' | 'fotos';

export type ChecklistBulkRow = {
  relationId: number;
  label: string;
  checked: boolean;
  observaciones: string;
  existingChecklistId: number | null;
  changed: boolean;
};

export type TrabajoWorkbenchSavePayload = {
  idVehOrdenTrabajoTrabajo?: number | null;
  tipoTrabajo: string;
  descripcionInicial: string;
  descripcionRealizada?: string | null;
  resultado?: string | null;
  estadoTrabajo?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
};

export type HallazgoWorkbenchSavePayload = {
  idVehOrdenTrabajoHallazgo?: number | null;
  idVehOrdenTrabajoTrabajoFk?: number | null;
  tipoHallazgo: string;
  categoria: string;
  descripcion: string;
  severidad: string;
  estadoHallazgo: string;
  requiereCambio: number;
  motivoCambio?: string | null;
  aprobadoCliente: number;
  fechaAprobacion?: string | null;
  observaciones?: string | null;
};

export type FotoWorkbenchSavePayload = {
  idVehOrdenTrabajoHallazgoFk: number;
  etapa: string;
  descripcion?: string | null;
  principal: boolean;
  foto: string;
};
export type RepuestoWorkbenchSavePayload = {
  idVehOrdenTrabajoRepuesto?: number | null;
  art: number;
  cantidad: number;
  precioUnitario: number;
  motivoCambio?: string | null;
  detalleInstalacion?: string | null;
  serieAnterior?: string | null;
  serieNueva?: string | null;
  observaciones?: string | null;
};

type RepuestoDraft = {
  art: number | null;
  cantidad: number;
  precioUnitario: number;
  motivoCambio: string;
  detalleInstalacion: string;
  serieAnterior: string;
  serieNueva: string;
  observaciones: string;
};

type ChecklistEditorRow = {
  relationId: number;
  label: string;
  checked: boolean;
  observaciones: string;
  existingChecklistId: number | null;
  originalChecked: boolean;
  originalObservaciones: string;
};

type TrabajoDraft = {
  tipoTrabajo: string;
  descripcionInicial: string;
  descripcionRealizada: string;
  resultado: string;
  estadoTrabajo: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  observaciones: string;
};

type HallazgoDraft = {
  tipoHallazgo: string;
  categoria: string;
  descripcion: string;
  severidad: string;
  estadoHallazgo: string;
  requiereCambio: boolean;
  motivoCambio: string;
  aprobadoCliente: boolean;
  fechaAprobacion: string;
  observaciones: string;
};

type FotoDraft = {
  etapa: string;
  descripcion: string;
  principal: boolean;
  fotoBase64: string | null;
  fotoPreview: string | null;
};

@Component({
  selector: 'app-orden-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    VehiculosEmptyStateComponent,
    VehiculoVistaCanvasComponent,
    OrdenComercialPanelComponent,
  ],
  templateUrl: './orden-detail-panel.component.html',
  styleUrl: './orden-detail-panel.component.scss',
})
export class OrdenDetailPanelComponent implements OnChanges {
  @Input() orden: VehOrdenTrabajo | null = null;
  @Input() clienteNombre = 'Cliente';
  @Input() vehiculoNombre = 'Vehículo';
  @Input() responsableRecepcionNombre = 'No asignado';
  @Input() responsableTecnicoNombre = 'No asignado';

  @Input() checklist: VehOrdenTrabajoCheckList[] = [];
  @Input() checklistOpciones: VehCheckListVehiculo[] = [];
  @Input() trabajos: VehOrdenTrabajoTrabajo[] = [];
  @Input() hallazgos: VehOrdenTrabajoHallazgo[] = [];
  @Input() selectedHallazgo: VehOrdenTrabajoHallazgo | null = null;
  @Input() marcas: VehOrdenTrabajoHallazgoMarca[] = [];
  @Input() fotos: VehOrdenTrabajoHallazgoFoto[] = [];
  @Input() repuestos: VehOrdenTrabajoRepuesto[] = [];
  @Input() autorizaciones: VehOrdenTrabajoAutorizacion[] = [];
  @Input() ordenFacturas: VehOrdenTrabajoFactura[] = [];
  @Input() vistas: VehTipoVehiculoVista[] = [];
  @Input() selectedVista: VehTipoVehiculoVista | null = null;
  @Input() facturasOt: VehFactura[] = [];
  @Input() selectedFacturaOt: VehFactura | null = null;
  @Input() facturaDetalle: Record<string, unknown> | null = null;
  @Input() cobrosFactura: VehCobro[] = [];
  @Input() workflowResultado: VehFacturacionWorkflowResultado | null = null;

  @Input() checklistLabelMap: Record<number, string> = {};
  @Input() trabajoLabelMap: Record<number, string> = {};
  @Input() articuloLabelMap: Record<number, string> = {};
  @Input() articulosCatalogo: VehArticuloCatalogo[] = [];
  @Output() saveChecklist = new EventEmitter<ChecklistBulkRow[]>();
  @Output() saveTrabajo = new EventEmitter<TrabajoWorkbenchSavePayload>();
  @Output() saveHallazgo = new EventEmitter<HallazgoWorkbenchSavePayload>();
  @Output() saveFoto = new EventEmitter<FotoWorkbenchSavePayload>();
  @Output() saveRepuesto = new EventEmitter<RepuestoWorkbenchSavePayload>();
  @Output() deleteRepuesto = new EventEmitter<VehOrdenTrabajoRepuesto>();
  @Output() articuloQueryChange = new EventEmitter<string>();
  @Output() articuloSelected = new EventEmitter<VehArticuloCatalogo>();
  @Output() createFactura = new EventEmitter<FacturaComercialSavePayload>();
  @Output() openCobro = new EventEmitter<void>();
  @Output() openContabilizar = new EventEmitter<void>();

  @Output() selectHallazgo = new EventEmitter<VehOrdenTrabajoHallazgo>();
  @Output() clearHallazgoSelection = new EventEmitter<void>();
  @Output() selectVista = new EventEmitter<VehTipoVehiculoVista>();
  @Output() selectFactura = new EventEmitter<VehFactura>();
  @Output() pointMarked = new EventEmitter<{ x: number; y: number }>();

  activeTab = signal<OrdenDetailTab>('resumen');
  executionTab = signal<ExecutionTab>('detalle');
  hallazgoInnerTab = signal<HallazgoInnerTab>('marcas');
  hallazgoMediaModalVisible = signal(false);
  checklistRows = signal<ChecklistEditorRow[]>([]);

  selectedTrabajoId: number | null = null;
  editingTrabajoId: number | null = null;
  editingHallazgoId: number | null = null;
  selectedFotoId: number | null = null;
  selectedRepuestoId: number | null = null;
  editingRepuestoId: number | null = null;
  repuestoQuery = '';

  trabajoDraft: TrabajoDraft = this.createEmptyTrabajoDraft();
  hallazgoDraft: HallazgoDraft = this.createEmptyHallazgoDraft();
  fotoDraft: FotoDraft = this.createEmptyFotoDraft();
  repuestoDraft: RepuestoDraft = this.createEmptyRepuestoDraft();
  repuestoArticuloModalVisible = signal(false);

  readonly trabajoTipoOptions = [
    'DIAGNOSTICO',
    'REPARACION',
    'MANTENIMIENTO',
    'INSTALACION',
    'PRUEBA',
    'OTRO',
  ];

  readonly trabajoEstadoOptions = [
    'PENDIENTE',
    'EN_PROCESO',
    'PAUSADO',
    'FINALIZADO',
    'ANULADO',
  ];

  readonly hallazgoTipoOptions = [
    'RECEPCION',
    'DIAGNOSTICO',
    'DESMONTAJE',
    'PRUEBA',
    'ENTREGA',
    'OTRO',
  ];

  readonly hallazgoCategoriaOptions = [
    'GENERAL',
    'MECANICO',
    'ELECTRICO',
    'CARROCERIA',
    'PINTURA',
    'INTERIOR',
    'SEGURIDAD',
  ];

  readonly hallazgoSeveridadOptions = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

  readonly hallazgoEstadoOptions = [
    'REPORTADO',
    'VALIDADO',
    'APROBADO',
    'RECHAZADO',
    'RESUELTO',
  ];

  readonly evidenciaEtapaOptions = ['ANTES', 'DURANTE', 'DESPUES'];

  private pendingResetKind: 'trabajo' | 'hallazgo' | 'foto' | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['checklist'] || changes['checklistOpciones'] || changes['checklistLabelMap']) {
      this.rebuildChecklistRows();
    }

    if (changes['trabajos'] || changes['hallazgos'] || changes['selectedHallazgo']) {
      this.reconcileSelectedTrabajo();
    }

    if (changes['trabajos']) {
      if (this.pendingResetKind === 'trabajo') {
        const currentTrabajo = this.selectedTrabajoActual();
        if (currentTrabajo) {
          this.loadTrabajoDraft(currentTrabajo);
        } else {
          this.cancelTrabajoDraft();
        }
        this.pendingResetKind = null;
      } else if (!this.editingTrabajoId && !this.trabajoDraft.descripcionInicial.trim()) {
        const currentTrabajo = this.selectedTrabajoActual();
        if (currentTrabajo) {
          this.loadTrabajoDraft(currentTrabajo);
        }
      }
    }

    if (changes['hallazgos'] || changes['selectedHallazgo']) {
      if (this.pendingResetKind === 'hallazgo') {
        const currentHallazgo = this.selectedHallazgoEnContexto();
        if (currentHallazgo) {
          this.loadHallazgoDraft(currentHallazgo);
        } else {
          this.cancelHallazgoDraft();
        }
        this.pendingResetKind = null;
      } else if (!this.editingHallazgoId && !this.hallazgoDraft.descripcion.trim()) {
        const currentHallazgo = this.selectedHallazgoEnContexto();
        if (currentHallazgo) {
          this.loadHallazgoDraft(currentHallazgo);
        }
      }
    }

    if (changes['fotos'] && this.pendingResetKind === 'foto') {
      this.cancelFotoDraft();
      this.pendingResetKind = null;
    }

    if (changes['fotos']) {
      const currentFoto = this.selectedFotoActual();
      if (!currentFoto) {
        this.selectedFotoId = this.fotos[0]?.idVehOrdenTrabajoHallazgoFoto ?? null;
      }
    }
    if (changes['repuestos']) {
      const current = this.selectedRepuestoActual();
      if (!current) {
        const first = this.repuestos[0] ?? null;
        if (first) {
          this.loadRepuestoDraft(first);
        } else {
          this.selectedRepuestoId = null;
          this.editingRepuestoId = null;
          this.repuestoDraft = this.createEmptyRepuestoDraft();
        }
      }
    }
  }

  setTab(tab: OrdenDetailTab) {
    this.activeTab.set(tab);
  }

  setExecutionTab(tab: ExecutionTab) {
    this.executionTab.set(tab);
  }

  setHallazgoInnerTab(tab: HallazgoInnerTab) {
    this.hallazgoInnerTab.set(tab);
  }

  openHallazgoMediaModal(tab: HallazgoInnerTab) {
    this.hallazgoInnerTab.set(tab);
    this.hallazgoMediaModalVisible.set(true);

    if (tab === 'marcas' && !this.selectedVista && this.vistas.length) {
      this.selectVista.emit(this.vistas[0]);
    }
  }

  closeHallazgoMediaModal() {
    this.hallazgoMediaModalVisible.set(false);
  }

  severityEstado(estado?: string | null) {
    const v = (estado || '').toUpperCase();
    if (v.includes('ENTREG') || v.includes('FINALIZ') || v.includes('RESUELT') || v.includes('APROB')) return 'success';
    if (v.includes('FACTUR')) return 'info';
    if (v.includes('PEND') || v.includes('ESPERA') || v.includes('PAUS')) return 'warn';
    if (v.includes('ANUL') || v.includes('RECHAZ')) return 'danger';
    return 'secondary';
  }

  checklistLabel(idRel?: number | null): string {
    if (!idRel) return 'Checklist';
    return this.checklistLabelMap[idRel] || 'Checklist configurado';
  }

  trabajoLabel(idTrabajo?: number | null): string {
    if (!idTrabajo) return 'Sin trabajo relacionado';
    return this.trabajoLabelMap[idTrabajo] || 'Trabajo relacionado';
  }

  articuloLabel(art?: number | null): string {
    if (!art) return 'Repuesto';

    const repuesto = this.repuestos.find((x) => x.art === art);
    if (repuesto?.articulo || repuesto?.artcod) {
      return [repuesto.artcod || `ART-${repuesto.art}`, repuesto.articulo || '']
        .filter(Boolean)
        .join(' · ');
    }

    return this.articuloLabelMap[art] || `ART-${art}`;
  }

  facturaNumber(item?: VehFactura | null): string {
    if (!item) return 'Factura';
    return `${item.estab || '-'}-${item.ptoemi || '-'}-${item.secuencial || item.idFacVenta}`;
  }

  facturaActual(): any {
    const data = this.facturaDetalle as any;
    return data?.factura ?? this.selectedFacturaOt ?? null;
  }

  facturaDetalleItems(): any[] {
    const data = this.facturaDetalle as any;
    return Array.isArray(data?.detalle) ? data.detalle : [];
  }

  facturaCxcItems(): any[] {
    const data = this.facturaDetalle as any;
    return Array.isArray(data?.cxc) ? data.cxc : [];
  }

  workflowDetalles(): any[] {
    const data = this.workflowResultado as any;
    const items = data?.detallesFacturados ?? data?.detailsFacturados;
    return Array.isArray(items) ? items : [];
  }

  repuestosPendientesCount(): number {
    return this.repuestos.filter((x) => !x.idFacVentaFk).length;
  }

  resolveBinarySrc(binary?: string | null) {
    if (!binary) return null;
    const value = String(binary).trim();
    if (!value) return null;

    if (
      value.startsWith('data:') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('blob:')
    ) {
      return value;
    }

    return `data:${this.guessMimeType(value)};base64,${value}`;
  }

  esVerdadero(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
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

  formatDateTimeShort(value?: string | null): string {
    if (!value) return 'Sin fecha';

    const raw = String(value).trim();
    if (!raw) return 'Sin fecha';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return this.formatDateShort(raw);
    }

    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  allChecklistChecked(): boolean {
    const rows = this.checklistRows();
    return rows.length > 0 && rows.every((row) => row.checked);
  }

  onToggleAllChecklist(checked: boolean) {
    const next = this.checklistRows().map((row) => ({ ...row, checked }));
    this.checklistRows.set(next);
  }

  onToggleChecklistRow(relationId: number, checked: boolean) {
    const next = this.checklistRows().map((row) =>
      row.relationId === relationId ? { ...row, checked } : row,
    );
    this.checklistRows.set(next);
  }

  onChecklistObservationChange(relationId: number, observaciones: string) {
    const next = this.checklistRows().map((row) =>
      row.relationId === relationId ? { ...row, observaciones } : row,
    );
    this.checklistRows.set(next);
  }

  saveChecklistTable() {
    const payload: ChecklistBulkRow[] = this.checklistRows().map((row) => ({
      relationId: row.relationId,
      label: row.label,
      checked: row.checked,
      observaciones: row.observaciones,
      existingChecklistId: row.existingChecklistId,
      changed:
        row.checked !== row.originalChecked ||
        row.observaciones.trim() !== row.originalObservaciones.trim(),
    }));

    this.saveChecklist.emit(payload);
  }

  trabajosListado(): VehOrdenTrabajoTrabajo[] {
    return this.trabajos ?? [];
  }

  selectedTrabajoActual(): VehOrdenTrabajoTrabajo | null {
    if (!this.selectedTrabajoId) return null;
    return this.trabajos.find((item) => item.idVehOrdenTrabajoTrabajo === this.selectedTrabajoId) ?? null;
  }

  hallazgosDelTrabajoSeleccionado(): VehOrdenTrabajoHallazgo[] {
    if (!this.selectedTrabajoId) return [];
    return this.hallazgos.filter(
      (item) => Number(item.idVehOrdenTrabajoTrabajoFk ?? 0) === Number(this.selectedTrabajoId ?? 0),
    );
  }

  selectedHallazgoEnContexto(): VehOrdenTrabajoHallazgo | null {
    const current = this.selectedHallazgo;
    if (!current || !this.selectedTrabajoId) return null;

    if (Number(current.idVehOrdenTrabajoTrabajoFk ?? 0) !== Number(this.selectedTrabajoId ?? 0)) {
      return null;
    }

    return current;
  }

  marcasDeVistaSeleccionada(): VehOrdenTrabajoHallazgoMarca[] {
    const vistaId = this.selectedVista?.idVehTipoVehiculoVista ?? null;
    if (!vistaId) return this.marcas ?? [];

    return (this.marcas ?? []).filter(
      (item) => Number(item.idVehTipoVehiculoVistaFk ?? 0) === Number(vistaId),
    );
  }

  selectedFotoActual(): VehOrdenTrabajoHallazgoFoto | null {
    if (!this.selectedFotoId) return null;
    return this.fotos.find((item) => item.idVehOrdenTrabajoHallazgoFoto === this.selectedFotoId) ?? null;
  }

  seleccionarTrabajoWorkbench(item: VehOrdenTrabajoTrabajo) {
    this.loadTrabajoDraft(item);
    this.executionTab.set('detalle');

    const hallazgos = this.hallazgos.filter(
      (hallazgo) => Number(hallazgo.idVehOrdenTrabajoTrabajoFk ?? 0) === Number(item.idVehOrdenTrabajoTrabajo),
    );

    const currentHallazgo = this.selectedHallazgoEnContexto();
    if (currentHallazgo) {
      return;
    }

    if (hallazgos.length) {
      this.selectHallazgo.emit(hallazgos[0]);
      this.loadHallazgoDraft(hallazgos[0]);
      this.hallazgoInnerTab.set('marcas');
      return;
    }

    this.clearHallazgoSelection.emit();
    this.loadHallazgoDraft(null);
  }

  iniciarNuevoTrabajo() {
    this.selectedTrabajoId = null;
    this.editingTrabajoId = null;
    this.trabajoDraft = this.createEmptyTrabajoDraft();
    this.clearHallazgoSelection.emit();
    this.loadHallazgoDraft(null);
    this.executionTab.set('detalle');
  }

  editarTrabajo(item: VehOrdenTrabajoTrabajo) {
    this.loadTrabajoDraft(item);
    this.executionTab.set('detalle');
  }

  guardarTrabajo() {
    if (!this.trabajoDraft.descripcionInicial.trim()) return;

    this.pendingResetKind = 'trabajo';
    this.saveTrabajo.emit({
      idVehOrdenTrabajoTrabajo: this.editingTrabajoId,
      tipoTrabajo: this.trabajoDraft.tipoTrabajo,
      descripcionInicial: this.trabajoDraft.descripcionInicial,
      descripcionRealizada: this.trabajoDraft.descripcionRealizada || null,
      resultado: this.trabajoDraft.resultado || null,
      estadoTrabajo: this.trabajoDraft.estadoTrabajo,
      fechaInicio: this.toTimestamp(this.trabajoDraft.fechaInicio),
      fechaFin: this.toTimestamp(this.trabajoDraft.fechaFin),
      motivo: this.trabajoDraft.motivo || null,
      observaciones: this.trabajoDraft.observaciones || null,
    });
  }

  cancelTrabajoDraft() {
    const currentTrabajo = this.selectedTrabajoActual();
    if (currentTrabajo) {
      this.loadTrabajoDraft(currentTrabajo);
      return;
    }

    const firstTrabajo = this.trabajos[0] ?? null;
    if (firstTrabajo) {
      this.loadTrabajoDraft(firstTrabajo);
      return;
    }

    this.selectedTrabajoId = null;
    this.editingTrabajoId = null;
    this.trabajoDraft = this.createEmptyTrabajoDraft();
  }

  iniciarNuevoHallazgo() {
    if (!this.selectedTrabajoId) return;
    this.editingHallazgoId = null;
    this.hallazgoDraft = this.createEmptyHallazgoDraft();
    this.clearHallazgoSelection.emit();
    this.executionTab.set('hallazgos');
    this.hallazgoInnerTab.set('marcas');
  }

  editarHallazgo(item: VehOrdenTrabajoHallazgo) {
    this.loadHallazgoDraft(item);
    this.selectHallazgo.emit(item);
    this.executionTab.set('hallazgos');
    this.hallazgoInnerTab.set('marcas');
  }

  guardarHallazgo() {
    if (!this.selectedTrabajoId) return;
    if (!this.hallazgoDraft.descripcion.trim()) return;

    this.pendingResetKind = 'hallazgo';
    this.saveHallazgo.emit({
      idVehOrdenTrabajoHallazgo: this.editingHallazgoId,
      idVehOrdenTrabajoTrabajoFk: this.selectedTrabajoId,
      tipoHallazgo: this.hallazgoDraft.tipoHallazgo,
      categoria: this.hallazgoDraft.categoria,
      descripcion: this.hallazgoDraft.descripcion,
      severidad: this.hallazgoDraft.severidad,
      estadoHallazgo: this.hallazgoDraft.estadoHallazgo,
      motivoCambio: this.hallazgoDraft.motivoCambio || null,
      requiereCambio: this.hallazgoDraft.requiereCambio ? 1 : 0,
      aprobadoCliente: this.hallazgoDraft.aprobadoCliente ? 1 : 0,
      fechaAprobacion: this.toTimestamp(this.hallazgoDraft.fechaAprobacion),
      observaciones: this.hallazgoDraft.observaciones || null,
    });
  }

  cancelHallazgoDraft() {
    const currentHallazgo = this.selectedHallazgoEnContexto();
    if (currentHallazgo) {
      this.loadHallazgoDraft(currentHallazgo);
      return;
    }

    const firstHallazgo = this.hallazgosDelTrabajoSeleccionado()[0] ?? null;
    if (firstHallazgo) {
      this.selectHallazgo.emit(firstHallazgo);
      this.loadHallazgoDraft(firstHallazgo);
      return;
    }

    this.editingHallazgoId = null;
    this.hallazgoDraft = this.createEmptyHallazgoDraft();
  }

  seleccionarHallazgoWorkbench(item: VehOrdenTrabajoHallazgo) {
    if (item.idVehOrdenTrabajoTrabajoFk) {
      this.selectedTrabajoId = item.idVehOrdenTrabajoTrabajoFk;
    }

    this.selectHallazgo.emit(item);
    this.loadHallazgoDraft(item);

    if (!this.selectedVista && this.vistas.length) {
      this.selectVista.emit(this.vistas[0]);
    }

    this.executionTab.set('hallazgos');
    this.hallazgoInnerTab.set('marcas');
  }

  seleccionarFoto(item: VehOrdenTrabajoHallazgoFoto) {
    this.selectedFotoId = item.idVehOrdenTrabajoHallazgoFoto;
  }

  editarFotoLocal(item: VehOrdenTrabajoHallazgoFoto) {
    this.selectedFotoId = item.idVehOrdenTrabajoHallazgoFoto;
    this.fotoDraft = {
      etapa: item.etapa || 'ANTES',
      descripcion: item.descripcion || '',
      principal: this.esVerdadero((item as any).principal),
      fotoBase64: null,
      fotoPreview: this.resolveBinarySrc((item.foto || (item as any).urlArchivo) ?? null),
    };

    this.executionTab.set('hallazgos');
    this.hallazgoInnerTab.set('fotos');
  }

  onFotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      this.fotoDraft = {
        ...this.fotoDraft,
        fotoBase64: base64 || '',
        fotoPreview: dataUrl || null,
      };
    };
    reader.readAsDataURL(file);
  }

  guardarFoto() {
    const hallazgo = this.selectedHallazgoEnContexto();
    if (!hallazgo) return;
    if (!this.fotoDraft.fotoBase64) return;

    this.pendingResetKind = 'foto';
    this.saveFoto.emit({
      idVehOrdenTrabajoHallazgoFk: hallazgo.idVehOrdenTrabajoHallazgo,
      etapa: this.fotoDraft.etapa,
      descripcion: this.fotoDraft.descripcion || null,
      principal: !!this.fotoDraft.principal,
      foto: this.fotoDraft.fotoBase64,
    });
  }

  cancelFotoDraft() {
    this.selectedFotoId = null;
    this.fotoDraft = this.createEmptyFotoDraft();
  }

  checklistChangedCount(): number {
    return this.checklistRows().filter(
      (row) =>
        row.checked !== row.originalChecked ||
        row.observaciones.trim() !== row.originalObservaciones.trim(),
    ).length;
  }

  private reconcileSelectedTrabajo() {
    const currentTrabajoIds = new Set(this.trabajos.map((item) => item.idVehOrdenTrabajoTrabajo));
    const hallazgoTrabajoId = this.selectedHallazgo?.idVehOrdenTrabajoTrabajoFk ?? null;

    if (hallazgoTrabajoId && currentTrabajoIds.has(hallazgoTrabajoId)) {
      this.selectedTrabajoId = hallazgoTrabajoId;
      return;
    }

    if (this.selectedTrabajoId && currentTrabajoIds.has(this.selectedTrabajoId)) {
      return;
    }

    this.selectedTrabajoId = this.trabajos[0]?.idVehOrdenTrabajoTrabajo ?? null;
  }
  repuestosListado(): VehOrdenTrabajoRepuesto[] {
    return this.repuestos ?? [];
  }

  selectedRepuestoActual(): VehOrdenTrabajoRepuesto | null {
    if (!this.selectedRepuestoId) return null;
    return this.repuestos.find((item) => item.idVehOrdenTrabajoRepuesto === this.selectedRepuestoId) ?? null;
  }

  selectedArticuloCatalogo(): VehArticuloCatalogo | null {
    const art = this.repuestoDraft.art;
    if (!art) return null;

    const fromCatalog = this.articulosCatalogo.find((item) => item.idActInventario === art) ?? null;
    if (fromCatalog) return fromCatalog;

    const repuesto = this.repuestos.find((item) => item.art === art);
    if (!repuesto) return null;

    return {
      idActInventario: repuesto.art,
      artcod: repuesto.artcod ?? null,
      articulo: repuesto.articulo ?? `ART-${repuesto.art}`,
      precio4: repuesto.precio4 ?? repuesto.precioUnitario ?? 0,
      saldo: repuesto.saldo ?? null,
      subtipo: repuesto.subtipo ?? null,
      tipoArticulo: repuesto.tipoArticulo ?? null,
      categoriaArticulo: repuesto.categoriaArticulo ?? null,
    };
  }

  repuestoEditable(item?: VehOrdenTrabajoRepuesto | null): boolean {
    if (!item) return true;
    return !item.idFacVentaFk;
  }

  onRepuestoQueryInput(value: string) {
    this.repuestoQuery = value ?? '';
    this.articuloQueryChange.emit(this.repuestoQuery.trim());
  }

  seleccionarArticuloCatalogo(item: VehArticuloCatalogo) {
    this.repuestoDraft = {
      ...this.repuestoDraft,
      art: item.idActInventario,
      precioUnitario: Number(item.precio4 ?? item.artmay ?? item.artcom ?? item.artmen ?? 0),
    };
    this.articuloSelected.emit(item);
  }

  iniciarNuevoRepuesto() {
    this.selectedRepuestoId = null;
    this.editingRepuestoId = null;
    this.repuestoDraft = this.createEmptyRepuestoDraft();
    this.repuestoQuery = '';
  }

  seleccionarRepuesto(item: VehOrdenTrabajoRepuesto) {
    this.loadRepuestoDraft(item);
  }

  guardarRepuesto() {
    if (!this.repuestoDraft.art) return;
    if (!this.repuestoDraft.cantidad || this.repuestoDraft.cantidad <= 0) return;

    this.saveRepuesto.emit({
      idVehOrdenTrabajoRepuesto: this.editingRepuestoId,
      art: Number(this.repuestoDraft.art),
      cantidad: Number(this.repuestoDraft.cantidad || 0),
      precioUnitario: Number(this.repuestoDraft.precioUnitario || 0),
      motivoCambio: this.repuestoDraft.motivoCambio?.trim() || null,
      detalleInstalacion: this.repuestoDraft.detalleInstalacion?.trim() || null,
      serieAnterior: this.repuestoDraft.serieAnterior?.trim() || null,
      serieNueva: this.repuestoDraft.serieNueva?.trim() || null,
      observaciones: this.repuestoDraft.observaciones?.trim() || null,
    });
  }

  eliminarRepuestoSeleccionado() {
    const repuesto = this.selectedRepuestoActual();
    if (!repuesto) return;
    if (!this.repuestoEditable(repuesto)) return;
    this.deleteRepuesto.emit(repuesto);
  }

  cancelRepuestoDraft() {
    const current = this.selectedRepuestoActual();
    if (current) {
      this.loadRepuestoDraft(current);
      return;
    }

    const first = this.repuestos[0] ?? null;
    if (first) {
      this.loadRepuestoDraft(first);
      return;
    }

    this.selectedRepuestoId = null;
    this.editingRepuestoId = null;
    this.repuestoDraft = this.createEmptyRepuestoDraft();
    this.repuestoQuery = '';
  }

  private loadRepuestoDraft(item: VehOrdenTrabajoRepuesto | null) {
    if (!item) {
      this.selectedRepuestoId = null;
      this.editingRepuestoId = null;
      this.repuestoDraft = this.createEmptyRepuestoDraft();
      this.repuestoQuery = '';
      return;
    }

    this.selectedRepuestoId = item.idVehOrdenTrabajoRepuesto;
    this.editingRepuestoId = item.idVehOrdenTrabajoRepuesto;
    this.repuestoDraft = {
      art: item.art ?? null,
      cantidad: Number(item.cantidad ?? 1),
      precioUnitario: Number(item.precioUnitario ?? 0),
      motivoCambio: item.motivoCambio || '',
      detalleInstalacion: item.detalleInstalacion || '',
      serieAnterior: item.serieAnterior || '',
      serieNueva: item.serieNueva || '',
      observaciones: item.observaciones || '',
    };
    this.repuestoQuery = '';
  }

  private createEmptyRepuestoDraft(): RepuestoDraft {
    return {
      art: null,
      cantidad: 1,
      precioUnitario: 0,
      motivoCambio: '',
      detalleInstalacion: '',
      serieAnterior: '',
      serieNueva: '',
      observaciones: '',
    };
  }

  private rebuildChecklistRows() {
    const existingByRelation = new Map<number, VehOrdenTrabajoCheckList>();

    for (const item of this.checklist) {
      existingByRelation.set(item.idVehVehiculoCheckListVehiculoFk, item);
    }

    const rows: ChecklistEditorRow[] = (this.checklistOpciones ?? []).map((rel) => {
      const existing = existingByRelation.get(rel.idVehVehiculoCheckListVehiculo);
      const checked = (existing?.estadoCheckList || '').toUpperCase() === 'OK';
      const observaciones = existing?.observaciones || '';

      return {
        relationId: rel.idVehVehiculoCheckListVehiculo,
        label: this.checklistLabel(rel.idVehVehiculoCheckListVehiculo),
        checked,
        observaciones,
        existingChecklistId: existing?.idVehOrdenTrabajoCheckList ?? null,
        originalChecked: checked,
        originalObservaciones: observaciones,
      };
    });

    this.checklistRows.set(rows);
  }

  private loadTrabajoDraft(item: VehOrdenTrabajoTrabajo | null) {
    if (!item) {
      this.selectedTrabajoId = null;
      this.editingTrabajoId = null;
      this.trabajoDraft = this.createEmptyTrabajoDraft();
      return;
    }

    this.selectedTrabajoId = item.idVehOrdenTrabajoTrabajo;
    this.editingTrabajoId = item.idVehOrdenTrabajoTrabajo;
    this.trabajoDraft = {
      tipoTrabajo: item.tipoTrabajo || 'DIAGNOSTICO',
      descripcionInicial: item.descripcionInicial || '',
      descripcionRealizada: item.descripcionRealizada || '',
      resultado: item.resultado || '',
      estadoTrabajo: item.estadoTrabajo || 'PENDIENTE',
      fechaInicio: this.toDate(item.fechaInicio),
      fechaFin: this.toDate(item.fechaFin),
      motivo: item.motivo || '',
      observaciones: item.observaciones || '',
    };
  }

  private loadHallazgoDraft(item: VehOrdenTrabajoHallazgo | null) {
    if (!item) {
      this.editingHallazgoId = null;
      this.hallazgoDraft = this.createEmptyHallazgoDraft();
      return;
    }

    this.editingHallazgoId = item.idVehOrdenTrabajoHallazgo;
    if (item.idVehOrdenTrabajoTrabajoFk) {
      this.selectedTrabajoId = item.idVehOrdenTrabajoTrabajoFk;
    }

    this.hallazgoDraft = {
      tipoHallazgo: item.tipoHallazgo || 'RECEPCION',
      categoria: item.categoria || 'GENERAL',
      descripcion: item.descripcion || '',
      severidad: item.severidad || 'MEDIA',
      estadoHallazgo: item.estadoHallazgo || 'REPORTADO',
      requiereCambio: this.esVerdadero(item.requiereCambio),
      motivoCambio: item.motivoCambio || '',
      aprobadoCliente: this.esVerdadero(item.aprobadoCliente),
      fechaAprobacion: this.toDate(item.fechaAprobacion),
      observaciones: item.observaciones || '',
    };
  }

  private createEmptyTrabajoDraft(): TrabajoDraft {
    return {
      tipoTrabajo: 'DIAGNOSTICO',
      descripcionInicial: '',
      descripcionRealizada: '',
      resultado: '',
      estadoTrabajo: 'PENDIENTE',
      fechaInicio: '',
      fechaFin: '',
      motivo: '',
      observaciones: '',
    };
  }

  private createEmptyHallazgoDraft(): HallazgoDraft {
    return {
      tipoHallazgo: 'RECEPCION',
      categoria: 'GENERAL',
      descripcion: '',
      severidad: 'MEDIA',
      estadoHallazgo: 'REPORTADO',
      requiereCambio: true,
      motivoCambio: '',
      aprobadoCliente: false,
      fechaAprobacion: '',
      observaciones: '',
    };
  }

  private createEmptyFotoDraft(): FotoDraft {
    return {
      etapa: 'ANTES',
      descripcion: '',
      principal: false,
      fotoBase64: null,
      fotoPreview: null,
    };
  }

  private toDate(value?: string | null) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  private toTimestamp(value?: string | null) {
    if (!value) return null;
    if (String(value).includes('T')) return value;
    return `${value}T00:00:00-05:00`;
  }

  private guessMimeType(base64: string) {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    return 'image/png';
  }

  fotoFechaGeneracion(foto: VehOrdenTrabajoHallazgoFoto | null | undefined): string | null {
    if (!foto) return null;
    return (foto as any).fecGen ?? null;
  }

  openRepuestoArticuloModal() {
    this.repuestoArticuloModalVisible.set(true);
    this.articuloQueryChange.emit((this.repuestoQuery || '').trim());
  }

  closeRepuestoArticuloModal() {
    this.repuestoArticuloModalVisible.set(false);
  }

  seleccionarArticuloDesdeModal(item: VehArticuloCatalogo) {
    this.seleccionarArticuloCatalogo(item);
    this.repuestoArticuloModalVisible.set(false);
  }

  repuestoBloqueado(): boolean {
    const repuesto = this.selectedRepuestoActual();
    return !!repuesto && !this.repuestoEditable(repuesto);
  }

  trackByChecklistRow = (_index: number, row: ChecklistEditorRow) => row.relationId;
  trackByTrabajo = (_index: number, item: VehOrdenTrabajoTrabajo) => item.idVehOrdenTrabajoTrabajo;
  trackByHallazgo = (_index: number, item: VehOrdenTrabajoHallazgo) => item.idVehOrdenTrabajoHallazgo;
  trackByVista = (_index: number, item: VehTipoVehiculoVista) => item.idVehTipoVehiculoVista;
  trackByFoto = (_index: number, item: VehOrdenTrabajoHallazgoFoto) => item.idVehOrdenTrabajoHallazgoFoto;
  trackByMarca = (_index: number, item: VehOrdenTrabajoHallazgoMarca) => item.idVehOrdenTrabajoHallazgoMarca;
}
export type { FacturaComercialSavePayload } from '../orden-comercial-panel/orden-comercial-panel.component';