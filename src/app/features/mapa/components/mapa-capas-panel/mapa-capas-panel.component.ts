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

  visible(tipoId: number): boolean {
    return this.capas.isVisible(tipoId);
  }

  toggle(tipoId: number) {
    this.capas.toggle(tipoId);
  }
}