import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
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
  | 'trabajos'
  | 'hallazgos'
  | 'repuestos'
  | 'autorizaciones'
  | 'comercial';

export type ChecklistBulkRow = {
  relationId: number;
  label: string;
  checked: boolean;
  observaciones: string;
  existingChecklistId: number | null;
  changed: boolean;
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

@Component({
  selector: 'app-orden-detail-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
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
  @Output() openTrabajo = new EventEmitter<void>();
  @Output() openHallazgo = new EventEmitter<void>();
  @Output() openRepuesto = new EventEmitter<void>();
  @Output() openAutorizacion = new EventEmitter<void>();
  @Output() openFoto = new EventEmitter<void>();

  @Output() openWorkflow = new EventEmitter<void>();
  @Output() openFactura = new EventEmitter<void>();
  @Output() openCobro = new EventEmitter<void>();
  @Output() openContabilizar = new EventEmitter<void>();

  @Output() selectHallazgo = new EventEmitter<VehOrdenTrabajoHallazgo>();
  @Output() selectVista = new EventEmitter<VehTipoVehiculoVista>();
  @Output() selectFactura = new EventEmitter<VehFactura>();
  @Output() pointMarked = new EventEmitter<{ x: number; y: number }>();

  activeTab = signal<OrdenDetailTab>('resumen');
  checklistRows = signal<ChecklistEditorRow[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['checklist'] || changes['checklistOpciones'] || changes['checklistLabelMap']) {
      this.rebuildChecklistRows();
    }
  }

  setTab(tab: OrdenDetailTab) {
    this.activeTab.set(tab);
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

  private guessMimeType(base64: string) {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWw')) return 'image/svg+xml';
    return 'image/png';
  }
}