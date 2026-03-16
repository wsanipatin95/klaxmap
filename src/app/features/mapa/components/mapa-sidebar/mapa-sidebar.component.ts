import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaElemento,
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
import { MapaImportLotesPanelComponent } from '../mapa-import-lotes-panel/mapa-import-lotes-panel.component';
import {
  MapaSidebarSectionKey,
  MapaSidebarSectionsStore,
} from '../../store/mapa-sidebar-sections.store';

@Component({
  selector: 'app-mapa-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapaTreeComponent,
    MapaSearchComponent,
    MapaCapasPanelComponent,
    MapaImportLotesPanelComponent,
  ],
  templateUrl: './mapa-sidebar.component.html',
  styleUrl: './mapa-sidebar.component.scss',
})
export class MapaSidebarComponent {
  readonly sections = inject(MapaSidebarSectionsStore);

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

  isExpanded(key: MapaSidebarSectionKey): boolean {
    return this.sections.isExpanded(key);
  }

  toggleSection(key: MapaSidebarSectionKey) {
    this.sections.toggle(key);
  }

  get hiddenSummary(): string {
    const hiddenNodes = this.hiddenNodeIds.length;
    const hiddenElements = this.hiddenElementoIds.length;

    if (!hiddenNodes && !hiddenElements) {
      return 'Todo visible';
    }

    return `${hiddenNodes} nodo(s) y ${hiddenElements} elemento(s) ocultos`;
  }
}