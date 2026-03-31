import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { VehiculosEmptyStateComponent } from '../../../../components/empty-state/empty-state.component';
import { VehiculoVistaCanvasComponent } from '../../../../components/vehiculo-vista-canvas/vehiculo-vista-canvas.component';
import {
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
  | 'autorizaciones'
  | 'comercial';

type ExecutionTab = 'hallazgos' | 'marcas' | 'evidencias';

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
    InputTextModule,
    TextareaModule,
    TagModule,
    VehiculosEmptyStateComponent,
    VehiculoVistaCanvasComponent,
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

  @Output() saveChecklist = new EventEmitter<ChecklistBulkRow[]>();
  @Output() saveTrabajo = new EventEmitter<TrabajoWorkbenchSavePayload>();
  @Output() saveHallazgo = new EventEmitter<HallazgoWorkbenchSavePayload>();
  @Output() saveFoto = new EventEmitter<FotoWorkbenchSavePayload>();

  @Output() openWorkflow = new EventEmitter<void>();
  @Output() openFactura = new EventEmitter<void>();
  @Output() openCobro = new EventEmitter<void>();
  @Output() openContabilizar = new EventEmitter<void>();

  @Output() selectHallazgo = new EventEmitter<VehOrdenTrabajoHallazgo>();
  @Output() clearHallazgoSelection = new EventEmitter<void>();
  @Output() selectVista = new EventEmitter<VehTipoVehiculoVista>();
  @Output() selectFactura = new EventEmitter<VehFactura>();
  @Output() pointMarked = new EventEmitter<{ x: number; y: number }>();

  activeTab = signal<OrdenDetailTab>('resumen');
  executionTab = signal<ExecutionTab>('hallazgos');

  checklistRows = signal<ChecklistEditorRow[]>([]);

  selectedTrabajoId: number | null = null;
  editingTrabajoId: number | null = null;
  editingHallazgoId: number | null = null;

  trabajoDraft: TrabajoDraft = this.createEmptyTrabajoDraft();
  hallazgoDraft: HallazgoDraft = this.createEmptyHallazgoDraft();
  fotoDraft: FotoDraft = this.createEmptyFotoDraft();

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
        if (currentTrabajo) this.loadTrabajoDraft(currentTrabajo);
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
        if (currentHallazgo) this.loadHallazgoDraft(currentHallazgo);
      }
    }

    if (changes['fotos'] && this.pendingResetKind === 'foto') {
      this.cancelFotoDraft();
      this.pendingResetKind = null;
    }
  }

  setTab(tab: OrdenDetailTab) {
    this.activeTab.set(tab);
  }

  setExecutionTab(tab: ExecutionTab) {
    this.executionTab.set(tab);
  }

  severityEstado(estado?: string | null) {
    const v = (estado || '').toUpperCase();
    if (v.includes('ENTREG')) return 'success';
    if (v.includes('FACTUR')) return 'info';
    if (v.includes('PEND') || v.includes('ESPERA')) return 'warn';
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
    return this.articuloLabelMap[art] || 'Repuesto de inventario';
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

  allChecklistChecked(): boolean {
    const rows = this.checklistRows();
    return rows.length > 0 && rows.every((row) => row.checked);
  }

  onToggleAllChecklist(checked: boolean) {
    const next = this.checklistRows().map((row) => ({
      ...row,
      checked,
    }));
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

  trackByChecklistRow = (_index: number, row: ChecklistEditorRow) => row.relationId;
  trackByTrabajo = (_index: number, item: VehOrdenTrabajoTrabajo) => item.idVehOrdenTrabajoTrabajo;
  trackByHallazgo = (_index: number, item: VehOrdenTrabajoHallazgo) => item.idVehOrdenTrabajoHallazgo;
  trackByVista = (_index: number, item: VehTipoVehiculoVista) => item.idVehTipoVehiculoVista;
  trackByFoto = (_index: number, item: VehOrdenTrabajoHallazgoFoto) => item.idVehOrdenTrabajoHallazgoFoto;

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

  seleccionarTrabajoWorkbench(item: VehOrdenTrabajoTrabajo) {
    this.loadTrabajoDraft(item);

    const hallazgos = this.hallazgos.filter(
      (hallazgo) => Number(hallazgo.idVehOrdenTrabajoTrabajoFk ?? 0) === Number(item.idVehOrdenTrabajoTrabajo),
    );

    const currentHallazgo = this.selectedHallazgoEnContexto();
    if (currentHallazgo) return;

    if (hallazgos.length) {
      this.selectHallazgo.emit(hallazgos[0]);
      this.loadHallazgoDraft(hallazgos[0]);
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
  }

  editarTrabajo(item: VehOrdenTrabajoTrabajo) {
    this.loadTrabajoDraft(item);
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
  }

  editarHallazgo(item: VehOrdenTrabajoHallazgo) {
    this.loadHallazgoDraft(item);
    this.selectHallazgo.emit(item);
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
    this.fotoDraft = this.createEmptyFotoDraft();
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
    if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWw')) return 'image/svg+xml';
    return 'image/png';
  }
}