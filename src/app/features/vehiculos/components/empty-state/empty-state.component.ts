import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-vehiculos-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class VehiculosEmptyStateComponent {
  @Input() icon = 'pi pi-inbox';
  @Input() title = 'Sin resultados';
  @Input() subtitle = 'No hay datos para mostrar con los filtros actuales.';
}
