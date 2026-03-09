import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import type { MapaElemento, MapaNodo, MapaPatchRequest, MapaTipoElemento } from '../../data-access/mapa.models';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';
import { MapaPropertiesTabsComponent } from '../mapa-properties-tabs/mapa-properties-tabs.component';

@Component({
  selector: 'app-mapa-properties-panel',
  standalone: true,
  imports: [CommonModule, ButtonModule, MapaPropertiesTabsComponent],
  templateUrl: './mapa-properties-panel.component.html',
  styleUrl: './mapa-properties-panel.component.scss',
})
export class MapaPropertiesPanelComponent {
  private repo = inject(MapaElementosRepository);

  @Input() elemento: MapaElemento | null = null;
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() nodos: MapaNodo[] = [];

  @Output() saved = new EventEmitter<MapaElemento>();
  @Output() deleted = new EventEmitter<number>();

  guardar(payload: MapaPatchRequest) {
    this.repo.editar(payload).subscribe({
      next: (resp) => this.saved.emit(resp.data),
      error: (err) => console.error(err),
    });
  }

  eliminar() {
    if (!this.elemento) return;

    this.repo.eliminar(this.elemento.idGeoElemento).subscribe({
      next: () => this.deleted.emit(this.elemento!.idGeoElemento),
      error: (err) => console.error(err),
    });
  }
}