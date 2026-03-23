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

  allVisible(): boolean {
    if (!this.tipos.length) return true;
    return this.tipos.every((tipo) => this.visible(tipo.idGeoTipoElemento));
  }

  onRootToggle(checked: boolean) {
    if (checked) {
      this.showAll();
      return;
    }

    this.hideAll();
  }

  previewShapeClass(tipo: MapaTipoElemento): string {
    const iconoFuente = String(tipo.iconoFuente || '').toLowerCase();

    if (tipo.geometriaPermitida === 'linestring') return 'is-line';
    if (tipo.geometriaPermitida === 'polygon') return 'is-polygon';
    if (iconoFuente.includes('triangle')) return 'is-triangle';
    if (iconoFuente.includes('target')) return 'is-target';
    if (iconoFuente.includes('donut')) return 'is-donut';

    return 'is-point';
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    const stroke = tipo.colorStroke || '#7b0061';
    const fill = tipo.colorFill || stroke;

    return {
      '--preview-stroke': stroke,
      '--preview-fill': fill,
    } as Record<string, string>;
  }
}