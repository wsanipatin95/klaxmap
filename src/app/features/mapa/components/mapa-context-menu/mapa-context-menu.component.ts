import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { MapaElemento } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-context-menu.component.html',
  styleUrl: './mapa-context-menu.component.scss',
})
export class MapaContextMenuComponent {
  @Input() visible = false;
  @Input() x = 0;
  @Input() y = 0;
  @Input() elemento: MapaElemento | null = null;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() editDataRequested = new EventEmitter<MapaElemento>();
  @Output() editGeometryRequested = new EventEmitter<MapaElemento>();
  @Output() deleteRequested = new EventEmitter<MapaElemento>();
  @Output() centerRequested = new EventEmitter<MapaElemento>();

  close() {
    this.closeRequested.emit();
  }

  onEditData(item: MapaElemento) {
    this.editDataRequested.emit(item);
    this.close();
  }

  onEditGeometry(item: MapaElemento) {
    this.editGeometryRequested.emit(item);
    this.close();
  }

  onCenter(item: MapaElemento) {
    this.centerRequested.emit(item);
    this.close();
  }

  onDelete(item: MapaElemento) {
    this.deleteRequested.emit(item);
    this.close();
  }

  geomLabel(value: string | null | undefined): string {
    const geom = String(value || '').toLowerCase();

    if (geom === 'point') return 'punto';
    if (geom === 'linestring') return 'línea';
    if (geom === 'polygon') return 'polígono';

    return value || 'elemento';
  }

  estadoLabel(value: string | null | undefined): string {
    const text = String(value || '').trim();
    if (!text) return 'sin estado';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}