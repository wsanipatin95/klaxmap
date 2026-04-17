import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import type {
  MapaElemento,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import type { MapaGeoSearchResult } from '../../models/mapa-geo-search.models';
import {
  MapaTreeComponent,
  TreeCreateNodeRequest,
  TreeDrawElementRequest,
  TreeElementoVisibilityChange,
  TreeNodeVisibilityChange,
} from '../mapa-tree/mapa-tree.component';
import { MapaGeoSearchComponent } from '../mapa-geo-search/mapa-geo-search.component';
import { MapaSearchComponent } from '../mapa-search/mapa-search.component';
import { MapaCapasPanelComponent } from '../mapa-capas-panel/mapa-capas-panel.component';
import {
  MapaSidebarSectionKey,
  MapaSidebarSectionsStore,
} from '../../store/mapa-sidebar-sections.store';

@Component({
  selector: 'app-mapa-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MapaTreeComponent,
    MapaGeoSearchComponent,
    MapaSearchComponent,
    MapaCapasPanelComponent,
  ],
  templateUrl: './mapa-sidebar.component.html',
  styleUrl: './mapa-sidebar.component.scss',
})
export class MapaSidebarComponent {
  readonly sections = inject(MapaSidebarSectionsStore);

  @ViewChild('shell', { static: true }) shell?: ElementRef<HTMLDivElement>;

  @Input() nodos: MapaNodo[] = [];
  @Input() elementos: MapaElemento[] = [];
  @Input() deletedElementos: MapaElemento[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() selectedNodoId: number | null = null;
  @Input() selectedElementoId: number | null = null;
  @Input() searchValue = '';
  @Input() searchLoading = false;
  @Input() searchResultCount = 0;
  @Input() searchResultIndex = -1;
  @Input() geoSearchValue = '';
  @Input() geoSearchLoading = false;
  @Input() geoSearchHasSearched = false;
  @Input() geoSearchError: string | null = null;
  @Input() geoSearchResults: MapaGeoSearchResult[] = [];
  @Input() hiddenNodeIds: number[] = [];
  @Input() hiddenElementoIds: number[] = [];
  @Input() deletedElementsVisible = false;

  @Output() geoSearchRequested = new EventEmitter<string>();
  @Output() geoSearchClear = new EventEmitter<void>();
  @Output() geoSearchResultSelected = new EventEmitter<MapaGeoSearchResult>();
  @Output() searchRequested = new EventEmitter<string>();
  @Output() searchClear = new EventEmitter<void>();
  @Output() searchPrev = new EventEmitter<void>();
  @Output() searchNext = new EventEmitter<void>();
  @Output() nodoSelected = new EventEmitter<MapaNodo | null>();
  @Output() treeElementoSelected = new EventEmitter<MapaElemento>();
  @Output() treeNodeVisibilityChange = new EventEmitter<TreeNodeVisibilityChange>();
  @Output() treeElementoVisibilityChange = new EventEmitter<TreeElementoVisibilityChange>();
  @Output() treeCreateNodeRequested = new EventEmitter<TreeCreateNodeRequest>();
  @Output() treeEditNodeRequested = new EventEmitter<MapaNodo>();
  @Output() treeAuditNodeRequested = new EventEmitter<MapaNodo>();
  @Output() treeDeleteNodeRequested = new EventEmitter<MapaNodo>();
  @Output() treeDrawElementRequested = new EventEmitter<TreeDrawElementRequest>();
  @Output() treeCenterElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeEditDataElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeAuditElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeEditGeometryElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeDeleteElementoRequested = new EventEmitter<MapaElemento>();
  @Output() treeRestoreDeletedElementoRequested = new EventEmitter<MapaElemento>();
  @Output() deletedElementsVisibilityChange = new EventEmitter<boolean>();

  readonly topPanePercent = signal(68);
  private resizing = false;

  isExpanded(key: MapaSidebarSectionKey): boolean {
    return this.sections.isExpanded(key);
  }

  toggleSection(key: MapaSidebarSectionKey) {
    this.sections.toggle(key);
  }

  startResize(event: PointerEvent) {
    if (!this.isExpanded('lugares') || !this.isExpanded('capas')) {
      return;
    }

    this.resizing = true;
    event.preventDefault();
  }

  @HostListener('window:pointerup')
  stopResize() {
    this.resizing = false;
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent) {
    if (!this.resizing || !this.shell?.nativeElement) {
      return;
    }

    const rect = this.shell.nativeElement.getBoundingClientRect();
    if (!rect.height) {
      return;
    }

    const rawPercent = ((event.clientY - rect.top) / rect.height) * 100;
    const clamped = Math.max(24, Math.min(82, rawPercent));
    this.topPanePercent.set(clamped);
  }
}