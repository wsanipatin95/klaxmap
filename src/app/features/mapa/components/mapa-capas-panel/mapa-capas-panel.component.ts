import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import type { MapaTipoElemento } from '../../data-access/mapa.models';
import { MapaCapasStore } from '../../store/mapa-capas.store';
import {
  MapaItemVisualPreview,
  previewClassForVisual,
  previewImageUrlForVisual,
  previewMaterialFamilyForVisual,
  previewMaterialGlyphForVisual,
  previewShapeClassForVisual,
  previewStyleForVisual,
  resolveMapaTipoVisual,
  showClassPreviewForVisual,
  showMaterialPreviewForVisual,
  showUrlPreviewForVisual,
} from '../../utils/mapa-element-visual.utils';

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

  visual(tipo: MapaTipoElemento): MapaItemVisualPreview {
    return resolveMapaTipoVisual(tipo);
  }

  previewShapeClass(tipo: MapaTipoElemento): string {
    return previewShapeClassForVisual(this.visual(tipo));
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    return previewStyleForVisual(this.visual(tipo));
  }

  previewMaterialFamily(tipo: MapaTipoElemento): string {
    return previewMaterialFamilyForVisual(this.visual(tipo));
  }

  previewMaterialGlyph(tipo: MapaTipoElemento): string {
    return previewMaterialGlyphForVisual(this.visual(tipo));
  }

  previewClass(tipo: MapaTipoElemento): string {
    return previewClassForVisual(this.visual(tipo));
  }

  previewImageUrl(tipo: MapaTipoElemento): string {
    return previewImageUrlForVisual(this.visual(tipo));
  }

  showMaterialPreview(tipo: MapaTipoElemento): boolean {
    return showMaterialPreviewForVisual(this.visual(tipo));
  }

  showClassPreview(tipo: MapaTipoElemento): boolean {
    return showClassPreviewForVisual(this.visual(tipo));
  }

  showUrlPreview(tipo: MapaTipoElemento): boolean {
    return showUrlPreviewForVisual(this.visual(tipo));
  }
}
