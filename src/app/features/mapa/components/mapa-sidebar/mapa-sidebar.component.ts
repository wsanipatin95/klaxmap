import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaElemento,
  MapaLegendItem,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import {
  MapaTreeComponent,
  TreeCreateNodeRequest,
  TreeDrawElementRequest,
  TreeElementoVisibilityChange,
  TreeNodeVisibilityChange,
} from '../mapa-tree/mapa-tree.component';
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
  @Input() elementos: MapaElemento[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() selectedNodoId: number | null = null;
  @Input() selectedTipoId: number | null = null;
  @Input() selectedElementoId: number | null = null;
  @Input() searchValue = '';
  @Input() searchLoading = false;
  @Input() searchResultCount = 0;
  @Input() hiddenNodeIds: number[] = [];
  @Input() hiddenElementoIds: number[] = [];

  @Output() searchChange = new EventEmitter<string>();
  @Output() searchClear = new EventEmitter<void>();
  @Output() nodoSelected = new EventEmitter<MapaNodo | null>();
  @Output() tipoSelected = new EventEmitter<number | null>();
  @Output() treeElementoSelected = new EventEmitter<MapaElemento>();
  @Output() treeNodeVisibilityChange = new EventEmitter<TreeNodeVisibilityChange>();
  @Output() treeElementoVisibilityChange = new EventEmitter<TreeElementoVisibilityChange>();
  @Output() treeCreateNodeRequested = new EventEmitter<TreeCreateNodeRequest>();
  @Output() treeEditNodeRequested = new EventEmitter<MapaNodo>();
  @Output() treeDeleteNodeRequested = new EventEmitter<MapaNodo>();
  @Output() treeDrawElementRequested = new EventEmitter<TreeDrawElementRequest>();
  @Output() treeCenterElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeEditDataElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeEditGeometryElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeDeleteElementoRequested = new EventEmitter<MapaElemento>();

  get legendItems(): MapaLegendItem[] {
    return this.tipos.map((t) => ({
      idGeoTipoElemento: t.idGeoTipoElemento,
      nombre: t.nombre,
      colorStroke: t.colorStroke,
      colorFill: t.colorFill,
      iconoFuente: t.iconoFuente,
      geometriaPermitida: t.geometriaPermitida,
      visible: this.capas.isVisible(t.idGeoTipoElemento),
    }));
  }
}