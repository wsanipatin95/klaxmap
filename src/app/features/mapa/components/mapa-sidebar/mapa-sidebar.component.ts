import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MapaLegendItem, MapaNodo, MapaTipoElemento } from '../../data-access/mapa.models';
import { MapaTreeComponent } from '../mapa-tree/mapa-tree.component';
import { MapaSearchComponent } from '../mapa-search/mapa-search.component';
import { MapaCapasPanelComponent } from '../mapa-capas-panel/mapa-capas-panel.component';
import { MapaLegendComponent } from '../mapa-legend/mapa-legend.component';
import { MapaImportLotesPanelComponent } from '../mapa-import-lotes-panel/mapa-import-lotes-panel.component';
import { MapaCapasStore } from '../../store/mapa-capas.store';

@Component({
  selector: 'app-mapa-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapaTreeComponent,
    MapaSearchComponent,
    MapaCapasPanelComponent,
    MapaLegendComponent,
    MapaImportLotesPanelComponent,
  ],
  templateUrl: './mapa-sidebar.component.html',
  styleUrl: './mapa-sidebar.component.scss',
})
export class MapaSidebarComponent {
  private capas = inject(MapaCapasStore);

  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() selectedNodoId: number | null = null;
  @Input() selectedTipoId: number | null = null;
  @Input() searchValue = '';

  @Output() searchChange = new EventEmitter<string>();
  @Output() nodoSelected = new EventEmitter<MapaNodo | null>();
  @Output() tipoSelected = new EventEmitter<number | null>();

  readonly legendItems = computed<MapaLegendItem[]>(() =>
    this.tipos.map((t) => ({
      idGeoTipoElemento: t.idGeoTipoElemento,
      nombre: t.nombre,
      colorStroke: t.colorStroke,
      colorFill: t.colorFill,
      iconoFuente: t.iconoFuente,
      geometriaPermitida: t.geometriaPermitida,
      visible: this.capas.isVisible(t.idGeoTipoElemento),
    }))
  );
}