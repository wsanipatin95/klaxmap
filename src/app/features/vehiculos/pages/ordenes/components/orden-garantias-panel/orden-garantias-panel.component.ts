import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import {
  VehGarantia,
  VehGarantiaDetalle,
  VehGarantiaMovimiento,
  VehOrdenTrabajo,
} from '../../../../data-access/vehiculos.models';
import { VehiculosEmptyStateComponent } from '../../../../components/empty-state/empty-state.component';

@Component({
  selector: 'app-orden-garantias-panel',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, VehiculosEmptyStateComponent],
  templateUrl: './orden-garantias-panel.component.html',
  styleUrl: './orden-garantias-panel.component.scss',
})
export class OrdenGarantiasPanelComponent {
  @Input() orden: VehOrdenTrabajo | null = null;
  @Input() garantias: VehGarantia[] = [];
  @Input() selectedGarantia: VehGarantia | null = null;
  @Input() garantiaDetalles: VehGarantiaDetalle[] = [];
  @Input() garantiaMovimientos: VehGarantiaMovimiento[] = [];
  @Input() trabajoLabelMap: Record<number, string> = {};
  @Input() articuloLabelMap: Record<number, string> = {};
  @Input() readonlyMode = false;

  @Output() selectGarantia = new EventEmitter<VehGarantia>();
  @Output() openGarantia = new EventEmitter<void>();
  @Output() openGarantiaDetalle = new EventEmitter<void>();
  @Output() openGarantiaMovimiento = new EventEmitter<void>();

  estadoSeverity(estado?: string | null) {
    const v = String(estado || '').toUpperCase();
    if (v.includes('ACTIVA') || v.includes('APROB')) return 'success';
    if (v.includes('RECLAM') || v.includes('REVISION')) return 'warn';
    if (v.includes('RECHAZ') || v.includes('ANUL')) return 'danger';
    if (v.includes('VENC')) return 'secondary';
    return 'secondary';
  }

  formatDate(value?: string | null): string {
    if (!value) return '-';
    const safe = value.includes('T') ? value : `${value}T00:00:00`;
    const dt = new Date(safe);
    if (Number.isNaN(dt.getTime())) return value;
    return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(dt);
  }

  money(value?: number | null): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }

  detalleLabel(item: VehGarantiaDetalle): string {
    if (item.idVehOrdenTrabajoTrabajoFk && this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk]) {
      return this.trabajoLabelMap[item.idVehOrdenTrabajoTrabajoFk];
    }
    if (item.art && this.articuloLabelMap[item.art]) {
      return this.articuloLabelMap[item.art];
    }
    if (item.idVehOrdenTrabajoRepuestoFk) return `Repuesto OT #${item.idVehOrdenTrabajoRepuestoFk}`;
    return item.tipoCobertura || 'Cobertura';
  }
}
