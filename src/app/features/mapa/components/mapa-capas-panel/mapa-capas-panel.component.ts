import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import type { MapaTipoElemento } from '../../data-access/mapa.models';
import { MapaCapasStore } from '../../store/mapa-capas.store';

@Component({
  selector: 'app-mapa-capas-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-capas-panel.component.html',
  styleUrl: './mapa-capas-panel.component.scss',
})
export class MapaCapasPanelComponent {
  readonly capas = inject(MapaCapasStore);

  @Input() tipos: MapaTipoElemento[] = [];

  trackByTipo = (_: number, tipo: MapaTipoElemento) => tipo.idGeoTipoElemento;

  visible(tipoId: number): boolean {
    return this.capas.isVisible(tipoId);
  }

  toggle(tipoId: number) {
    this.capas.toggle(tipoId);
  }

  showAll() {
    for (const tipo of this.tipos) {
      this.capas.setVisible(tipo.idGeoTipoElemento, true);
    }
  }

  hideAll() {
    for (const tipo of this.tipos) {
      this.capas.setVisible(tipo.idGeoTipoElemento, false);
    }
  }

  geomLabel(tipo: MapaTipoElemento): string {
    switch (tipo.geometriaPermitida) {
      case 'point':
        return 'point';
      case 'linestring':
        return 'linestring';
      case 'polygon':
        return 'polygon';
      case 'mixed':
      default:
        return 'mixed';
    }
  }

  previewShapeClass(tipo: MapaTipoElemento): string {
    const iconoFuente = String(tipo.iconoFuente || '').toLowerCase();

    if (this.geomLabel(tipo) === 'linestring') return 'is-line';
    if (this.geomLabel(tipo) === 'polygon') return 'is-polygon';
    if (iconoFuente.includes('triangle')) return 'is-triangle';
    if (iconoFuente.includes('target')) return 'is-target';
    if (iconoFuente.includes('donut')) return 'is-donut';

    return 'is-point';
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    const stroke = tipo.colorStroke || '#93c5fd';
    const fill = tipo.colorFill || stroke;

    return {
      '--preview-stroke': stroke,
      '--preview-fill': fill,
    } as Record<string, string>;
  }
}