import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { VehOrdenTrabajo } from '../../data-access/vehiculos.models';

@Component({
  selector: 'app-orden-resumen-panel',
  standalone: true,
  imports: [CommonModule, TagModule],
  templateUrl: './orden-resumen-panel.component.html',
  styleUrl: './orden-resumen-panel.component.scss',
})
export class OrdenResumenPanelComponent {
  @Input() orden: VehOrdenTrabajo | null = null;

  severity(estado?: string | null) {
    const v = (estado || '').toUpperCase();
    if (v.includes('ENTREG')) return 'success';
    if (v.includes('FACTUR')) return 'info';
    if (v.includes('ESPERA') || v.includes('PEND')) return 'warn';
    if (v.includes('ANUL')) return 'danger';
    return 'secondary';
  }
}
