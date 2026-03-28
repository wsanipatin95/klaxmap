import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VehOrdenTrabajoHallazgoMarca, VehTipoVehiculoVista } from '../../data-access/vehiculos.models';

@Component({
  selector: 'app-vehiculo-vista-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehiculo-vista-canvas.component.html',
  styleUrl: './vehiculo-vista-canvas.component.scss',
})
export class VehiculoVistaCanvasComponent {
  @Input() vista: VehTipoVehiculoVista | null = null;
  @Input() marcas: VehOrdenTrabajoHallazgoMarca[] = [];
  @Input() interactive = false;
  @Output() pointMarked = new EventEmitter<{ x: number; y: number }>();

  onSurfaceClick(event: MouseEvent) {
    if (!this.interactive) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = Number(((event.clientX - rect.left) / rect.width).toFixed(4));
    const y = Number(((event.clientY - rect.top) / rect.height).toFixed(4));
    this.pointMarked.emit({ x, y });
  }

  resolvePosition(marca: VehOrdenTrabajoHallazgoMarca) {
    const geo = (marca.geometria ?? {}) as Record<string, unknown>;
    const x = Number(geo['x'] ?? 0.5) * 100;
    const y = Number(geo['y'] ?? 0.5) * 100;
    return { left: `${x}%`, top: `${y}%` };
  }
}
