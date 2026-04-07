import { CommonModule } from '@angular/common';
import { Component, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { MapaUiStore } from '../../store/mapa-ui.store';
import { MapaSelectionStore } from '../../store/mapa-selection.store';
import { MapaFiltrosStore } from '../../store/mapa-filtros.store';
import { MapaCapasStore } from '../../store/mapa-capas.store';
import { MapaVisibilityStore } from '../../store/mapa-visibility.store';

import type {
  MapaElemento,
  MapaElementoSaveRequest,
  MapaExportRequest,
  MapaNodo,
  MapaNodoSaveRequest,
  MapaPatchRequest,
  MapaGeomTipo,
} from '../../data-access/mapa.models';

import { MapaLayoutComponent } from '../../components/mapa-layout/mapa-layout.component';
import { MapaToolbarComponent } from '../../components/mapa-toolbar/mapa-toolbar.component';
import { MapaSidebarComponent } from '../../components/mapa-sidebar/mapa-sidebar.component';
import {
  MapaCanvasComponent,
  MapaEditSessionState,
} from '../../components/mapa-canvas/mapa-canvas.component';
import { MapaPropertiesPanelComponent } from '../../components/mapa-properties-panel/mapa-properties-panel.component';
import { MapaStatusbarComponent } from '../../components/mapa-statusbar/mapa-statusbar.component';
import { MapaImportDialogComponent } from '../../components/mapa-import-dialog/mapa-import-dialog.component';
import { MapaExportDialogComponent } from '../../components/mapa-export-dialog/mapa-export-dialog.component';
import { MapaCreateElementDialogComponent } from '../../components/mapa-create-element-dialog/mapa-create-element-dialog.component';
import { MapaContextMenuComponent } from '../../components/mapa-context-menu/mapa-context-menu.component';
import { MapaNodeDialogComponent } from '../../components/mapa-node-dialog/mapa-node-dialog.component';
import { MapaConfirmDialogComponent } from '../../components/mapa-confirm-dialog/mapa-confirm-dialog.component';

import { MapaCrudFacade } from '../../application/mapa-crud.facade';
import { MapaInteractionFacade } from '../../application/mapa-interaction.facade';
import { MapaGeocodeService } from '../../services/mapa-geocode.service';

import type {
  TreeCreateNodeRequest,
  TreeDrawElementRequest,
  TreeElementoVisibilityChange,
  TreeNodeVisibilityChange,
} from '../../components/mapa-tree/mapa-tree.component';
import type { MapaGeoSearchResult } from '../../models/mapa-geo-search.models';

@Component({
  selector: 'app-mapa-home',
  standalone: true,
  imports: [
    CommonModule,
    MapaLayoutComponent,
    MapaToolbarComponent,
    MapaSidebarComponent,
    MapaCanvasComponent,
    MapaPropertiesPanelComponent,
    MapaStatusbarComponent,
    MapaImportDialogComponent,
    MapaExportDialogComponent,
    MapaCreateElementDialogComponent,
    MapaContextMenuComponent,
    MapaNodeDialogComponent,
    MapaConfirmDialogComponent,
  ],
  templateUrl: './mapa-home.component.html',
  styleUrl: './mapa-home.component.scss',
})
export class MapaHomeComponent {
  readonly ui = inject(MapaUiStore);
  readonly selection = inject(MapaSelectionStore);
  readonly filtros = inject(MapaFiltrosStore);
  readonly capas = inject(MapaCapasStore);
  readonly visibility = inject(MapaVisibilityStore);
  readonly crud = inject(MapaCrudFacade);
  readonly interaction = inject(MapaInteractionFacade);
  readonly router = inject(Router);
  readonly geocode = inject(MapaGeocodeService);

  @ViewChild('importDialog') importDialog?: MapaImportDialogComponent;
  @ViewChild('exportDialog') exportDialog?: MapaExportDialogComponent;
  @ViewChild('createDialog') createDialog?: MapaCreateElementDialogComponent;
  @ViewChild('mapCanvas') mapCanvas?: MapaCanvasComponent;
  @ViewChild('nodeDialog') nodeDialog?: MapaNodeDialogComponent;
  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;

  readonly nodos = this.crud.nodos;
  readonly tipos = this.crud.tipos;
  readonly elementos = this.crud.elementos;
  readonly error = this.crud.error;

  readonly contextVisible = this.interaction.contextVisible;
  readonly contextX = this.interaction.contextX;
  readonly contextY = this.interaction.contextY;
  readonly contextElemento = this.interaction.contextElemento;

  readonly hiddenNodeIds = this.visibility.hiddenNodeIds;
  readonly hiddenElementoIds = this.visibility.hiddenElementoIds;

  readonly editSessionActive = this.interaction.editSessionActive;
  readonly editSessionDirty = this.interaction.editSessionDirty;
  readonly editSessionElementId = this.interaction.editSessionElementId;
  readonly editSessionElementName = this.interaction.editSessionElementName;
  readonly editSessionGeomTipo = this.interaction.editSessionGeomTipo;
  readonly infoPanelDirty = this.interaction.infoPanelDirty;

  readonly selectedElemento = this.selection.selectedElemento;
  readonly selectedNodo = this.selection.selectedNodo;
  readonly selectedTipo = this.selection.selectedTipo;

  readonly totalElementos = this.crud.totalElementos;

  readonly actionBusy = signal(false);
  readonly actionBusyTitle = signal('Guardando cambios');
  readonly actionBusyText = signal('Espera un momento mientras se procesa la información.');

  readonly successVisible = signal(false);
  readonly successTitle = signal('');
  readonly successText = signal('');

  readonly geoSearchValue = signal('');
  readonly geoSearchLoading = signal(false);
  readonly geoSearchHasSearched = signal(false);
  readonly geoSearchResults = signal<MapaGeoSearchResult[]>([]);
  readonly geoSearchError = signal<string | null>(null);

  readonly elementosCanvas = computed(() => {
    const hiddenTipoIds = new Set(this.capas.hiddenTipoIds());

    return this.elementos().filter((el) => {
      if (hiddenTipoIds.has(el.idGeoTipoElementoFk)) {
        return false;
      }

      return this.visibility.isElementoVisible(el, this.nodos());
    });
  });

  readonly searchResultIndex = computed(() => {
    const results = this.getSearchNavigableItems();
    const selectedId = this.selectedElemento()?.idGeoElemento ?? null;

    if (!results.length || selectedId == null) {
      return -1;
    }

    return results.findIndex((item) => item.idGeoElemento === selectedId);
  });

  readonly quickInfo = computed(() => {
    const q = (this.filtros.q() || '').trim();
    const nodo = this.selectedNodo();
    const elemento = this.selectedElemento();

    if (this.editSessionActive()) {
      return this.editSessionDirty()
        ? `Editando forma: ${this.editSessionElementName() || 'elemento'} · cambios pendientes`
        : `Editando forma: ${this.editSessionElementName() || 'elemento'}`;
    }

    if (this.ui.toolMode() === 'measure') {
      return 'Modo medición activo · haz clic para marcar puntos y doble clic para terminar';
    }

    if (this.ui.propertiesOpen()) {
      return this.infoPanelDirty()
        ? `Editando datos: ${elemento?.nombre || 'elemento'} · cambios pendientes`
        : `Editando datos: ${elemento?.nombre || 'elemento'}`;
    }

    if (this.ui.loading()) {
      return 'Actualizando mapa...';
    }

    if (q) {
      return `Búsqueda: "${q}" · ${this.elementosCanvas().length} resultado(s)`;
    }

    if (elemento) {
      return `Activo: ${elemento.nombre}`;
    }

    if (nodo) {
      return `Nodo: ${nodo.nodo}`;
    }

    return 'Selecciona o dibuja un elemento';
  });

  constructor() {
    this.crud.loadAll();

    if (typeof window !== 'undefined' && window.innerWidth < 860) {
      this.ui.setSidebarHidden(true);
      this.scheduleMapLayoutRefresh(120);
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.scheduleMapLayoutRefresh(120);
  }

  async onGeoSearchRequested(query: string) {
    const trimmed = (query || '').trim();

    this.geoSearchValue.set(trimmed);
    this.geoSearchHasSearched.set(false);
    this.geoSearchResults.set([]);
    this.geoSearchError.set(null);

    if (!trimmed) {
      this.mapCanvas?.clearTemporarySearchMarker();
      return;
    }

    this.geoSearchLoading.set(true);
    this.geoSearchHasSearched.set(true);

    try {
      const results = await firstValueFrom(this.geocode.search(trimmed));
      this.geoSearchResults.set(results);

      if (!results.length) {
        this.geoSearchError.set('No se encontraron ubicaciones para la búsqueda ingresada.');
        return;
      }

      if (results.length === 1 && results[0].source === 'coordinates') {
        this.onGeoSearchResultSelected(results[0]);
      }
    } catch {
      this.geoSearchError.set('No se pudo consultar la ubicación en este momento.');
    } finally {
      this.geoSearchLoading.set(false);
    }
  }

  onGeoSearchResultSelected(result: MapaGeoSearchResult) {
    this.geoSearchValue.set(result.label);
    this.geoSearchError.set(null);
    this.mapCanvas?.focusOnSearchResult(result);
    this.closeSidebarIfMobile();
  }

  clearGeoSearch() {
    this.geoSearchValue.set('');
    this.geoSearchLoading.set(false);
    this.geoSearchHasSearched.set(false);
    this.geoSearchResults.set([]);
    this.geoSearchError.set(null);
    this.mapCanvas?.clearTemporarySearchMarker();
  }

  onToolbarSidebarToggle() {
    this.ui.toggleSidebar();
    this.scheduleMapLayoutRefresh();
    this.scheduleMapLayoutRefresh(280);
  }

  onToolbarSidebarCompactToggle() {
    this.ui.toggleSidebarCompact();
    this.scheduleMapLayoutRefresh();
    this.scheduleMapLayoutRefresh(280);
  }

  onSidebarBackdropRequested() {
    this.ui.setSidebarHidden(true);
    this.scheduleMapLayoutRefresh();
    this.scheduleMapLayoutRefresh(280);
  }

  onSearchRequested(q: string) {
    this.interaction.runWithPendingGuards(
      () => {
        this.filtros.setQ(q);
        this.selection.setElemento(null);
        this.interaction.closeContextMenu();
        this.reloadElementosAndCenterFirstIfSearching();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  clearSearch() {
    this.interaction.runWithPendingGuards(
      () => {
        this.filtros.setQ('');
        this.selection.setElemento(null);
        this.interaction.closeContextMenu();
        this.crud.loadElementos((items) => {
          setTimeout(() => this.mapCanvas?.centerOnElementos(items), 0);
        });
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onSearchPrev() {
    this.navigateSearchResults(-1);
  }

  onSearchNext() {
    this.navigateSearchResults(1);
  }

  onNodoSelect(nodo: MapaNodo | null) {
    this.interaction.runWithPendingGuards(
      () => {
        this.selection.setNodo(nodo);
        this.interaction.closeContextMenu();

        setTimeout(() => {
          if (!nodo) {
            this.mapCanvas?.centerOnElementos(this.elementosCanvas());
            return;
          }

          const branchNodeIds = this.getBranchNodeIds(nodo.idRedNodo);
          const branchElementos = this.elementosCanvas().filter((el) =>
            branchNodeIds.has(el.idRedNodoFk)
          );

          this.mapCanvas?.centerOnElementos(branchElementos);
        }, 0);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTipoSelect(tipoId: number | null) {
    this.interaction.runWithPendingGuards(
      () => {
        this.filtros.setTipo(tipoId);
        this.selection.setElemento(null);
        this.interaction.closeContextMenu();
        this.crud.loadElementos((items) => {
          const visibles = this.filterCanvasVisible(items);
          if (visibles.length) {
            setTimeout(() => this.mapCanvas?.centerOnElementos(visibles), 0);
          }
        });
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onElementoSelect(item: MapaElemento | null) {
    this.interaction.selectElementoWithPendingGuard({
      item,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => setTimeout(() => this.mapCanvas?.centerOnElemento(id), 0),
    });
  }

  onTreeElementoSelected(item: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => setTimeout(() => this.mapCanvas?.centerOnElemento(id), 0),
      afterSelect: () => {
        setTimeout(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento), 0);
      },
    });
  }

  onElementoUpdated(item: MapaElemento) {
    this.selection.setElemento(item);
    this.interaction.setInfoPanelDirty(false);
    this.crud.loadElementos(() => {
      setTimeout(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento), 0);
    });
    this.showSuccess('Información guardada', `Se actualizó "${item.nombre}" correctamente.`);
  }

  onElementoDeleted(id: number) {
    this.interaction.onElementoDeleted(id);
    this.visibility.clearElemento(id);
    this.crud.loadElementos((items) => {
      setTimeout(() => this.mapCanvas?.centerOnElementos(this.filterCanvasVisible(items)), 0);
    });
  }

  onRefresh() {
    this.interaction.runWithPendingGuards(
      () => {
        this.crud.refreshAll((items) => {
          this.centerFirstSearchResultIfNeeded(items);

          if (!(this.filtros.q() || '').trim()) {
            setTimeout(() => {
              this.mapCanvas?.centerOnElementos(this.filterCanvasVisible(items));
            }, 0);
          }
        });
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  abrirImportacion() {
    this.interaction.runWithPendingGuards(
      () => {
        this.importDialog?.open();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  abrirExportacion() {
    this.interaction.runWithPendingGuards(
      () => {
        const prefill: Partial<MapaExportRequest> = {
          q: this.filtros.q(),
          idRedNodoFk: this.filtros.idRedNodoFk(),
          idGeoTipoElementoFk: this.filtros.idGeoTipoElementoFk(),
          visible: this.filtros.visible(),
          nombreDocumento: 'mapa_red_isp',
        };

        this.exportDialog?.open(prefill, {
          resultCount: this.elementosCanvas().length,
          filterSummary: this.buildExportSummary(),
        });
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  irATiposElemento() {
    this.interaction.runWithPendingGuards(
      () => {
        this.router.navigate(['/app/mapa/tipos']);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onImported() {
    this.onRefresh();
  }

  onGeometryCreated(payload: { wkt: string; geomTipo: MapaGeomTipo }) {
    this.createDialog?.open({
      wkt: payload.wkt,
      geomTipo: payload.geomTipo,
      nodoId: this.selectedNodo()?.idRedNodo ?? null,
    });

    this.ui.setSelectMode();
  }

  crearElemento(payload: MapaElementoSaveRequest) {
    this.createDialog?.markSaving();

    this.crud.createElemento(
      payload,
      (created) => {
        this.createDialog?.handleSaveSuccess();
        this.showSuccess('Elemento guardado', `Se creó "${created.nombre}" correctamente.`);
        setTimeout(() => this.mapCanvas?.centerOnElemento(created.idGeoElemento), 0);
      },
      (message) => {
        this.createDialog?.handleSaveError(message);
      }
    );
  }

  onEditSessionStateChanged(state: MapaEditSessionState) {
    this.interaction.onEditSessionStateChanged(state);
  }

  onPropertiesDirtyChange(dirty: boolean) {
    this.interaction.setInfoPanelDirty(dirty);
  }

  onPropertiesCloseRequested() {
    if (!this.ui.propertiesOpen()) return;

    if (!this.infoPanelDirty()) {
      this.interaction.closeInfoPanel();
      return;
    }

    this.confirmDiscardInfoChanges(() => {
      this.interaction.closeInfoPanel();
    });
  }

  onToolbarSelectMode() {
    this.interaction.runWithPendingGuards(
      () => {
        this.ui.setSelectMode();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onToolbarEditGeometryMode() {
    const elemento = this.selectedElemento();

    if (!elemento) {
      this.crud.setError('Primero selecciona un elemento para editar su forma.');
      return;
    }

    if (this.editSessionActive() && this.editSessionElementId() !== elemento.idGeoElemento) {
      this.interaction.runWithPendingGuards(
        () => {
          this.ui.closeProperties();
          this.interaction.setInfoPanelDirty(false);
          this.ui.setEditGeometryMode();
          setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
        },
        (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
        (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
      );
      return;
    }

    this.ui.closeProperties();
    this.interaction.setInfoPanelDirty(false);
    this.ui.setEditGeometryMode();
    setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
  }

  onToolbarDrawPointMode() {
    this.interaction.runWithPendingGuards(
      () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setDrawPointMode();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onToolbarDrawLineMode() {
    this.interaction.runWithPendingGuards(
      () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setDrawLineMode();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onToolbarDrawPolygonMode() {
    this.interaction.runWithPendingGuards(
      () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setDrawPolygonMode();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onToolbarMeasureMode() {
    this.interaction.runWithPendingGuards(
      () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setMeasureMode();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  saveGeometryEdition() {
    if (!this.editSessionActive()) {
      return;
    }

    if (!this.editSessionDirty()) {
      this.ui.setSelectMode();
      return;
    }

    const elementName = this.editSessionElementName() || 'elemento';

    this.confirmDialog?.open(
      {
        title: 'Guardar cambios de forma',
        message: `Se guardará la geometría de "${elementName}".\n\n¿Deseas continuar?`,
        confirmLabel: 'Guardar',
        cancelLabel: 'Seguir editando',
        alternateLabel: 'Descartar',
        severity: 'info',
      },
      () => {
        const payload = this.mapCanvas?.saveEditSession();
        if (!payload) return;

        this.actionBusyTitle.set('Guardando forma');
        this.actionBusyText.set('Espera un momento mientras se actualiza la geometría.');
        this.actionBusy.set(true);

        this.crud.saveElementoGeometria(
          {
            id: payload.idGeoElemento,
            wkt: payload.wkt,
          },
          (updated) => {
            this.actionBusy.set(false);
            this.interaction.resetEditSessionState();
            this.ui.setSelectMode();
            this.showSuccess('Forma guardada', `Se actualizó la geometría de "${elementName}".`);
            setTimeout(() => this.mapCanvas?.centerOnElemento(updated.idGeoElemento), 0);
          },
          () => {
            this.actionBusy.set(false);
          }
        );
      },
      undefined,
      () => {
        this.mapCanvas?.cancelEditSession();
        this.interaction.resetEditSessionState();
        this.ui.setSelectMode();
      }
    );
  }

  cancelGeometryEdition() {
    this.confirmDiscardGeometryChanges();
  }

  openContextMenu(event: { elemento: MapaElemento; x: number; y: number }) {
    this.interaction.openContextMenu(event);
  }

  closeContextMenu() {
    this.interaction.closeContextMenu();
  }

  centerContextElemento(item: MapaElemento) {
    this.interaction.runWithPendingGuards(
      () => {
        this.selection.setElemento(item);
        this.mapCanvas?.centerOnElemento(item.idGeoElemento);
        this.interaction.closeContextMenu();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  editDataContextElemento(item: MapaElemento) {
    this.interaction.runWithPendingGuards(
      () => {
        this.interaction.openInfoPanelForElemento(item, this.nodos());
        this.ui.setSelectMode();
        this.interaction.closeContextMenu();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  editGeometryContextElemento(item: MapaElemento) {
    this.interaction.runWithPendingGuards(
      () => {
        this.selection.setElemento(item);
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setEditGeometryMode();
        this.interaction.closeContextMenu();

        setTimeout(() => {
          this.mapCanvas?.centerOnElemento(item.idGeoElemento);
        }, 0);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  deleteContextElemento(item: MapaElemento) {
    this.interaction.runWithPendingGuards(
      () => {
        this.confirmDeleteElemento(item);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTreeNodeVisibilityChange(event: TreeNodeVisibilityChange) {
    this.visibility.setNodeVisibleCascade(
      event.node.idRedNodo,
      event.visible,
      this.nodos(),
      this.elementos()
    );

    if (event.visible) {
      return;
    }

    const hiddenBranchIds = this.getBranchNodeIds(event.node.idRedNodo);
    const selectedNodo = this.selectedNodo();
    const selectedElemento = this.selectedElemento();

    if (selectedNodo && hiddenBranchIds.has(selectedNodo.idRedNodo)) {
      this.selection.setNodo(null);
    }

    if (
      selectedElemento &&
      (!this.visibility.isElementoVisible(selectedElemento, this.nodos()) ||
        hiddenBranchIds.has(selectedElemento.idRedNodoFk))
    ) {
      this.selection.setElemento(null);

      if (this.ui.propertiesOpen()) {
        this.interaction.closeInfoPanel();
      }
    }

    const contextElemento = this.contextElemento();
    if (
      contextElemento &&
      (!this.visibility.isElementoVisible(contextElemento, this.nodos()) ||
        hiddenBranchIds.has(contextElemento.idRedNodoFk))
    ) {
      this.interaction.closeContextMenu();
    }
  }

  onTreeElementoVisibilityChange(event: TreeElementoVisibilityChange) {
    this.visibility.setElementoVisible(event.elemento.idGeoElemento, event.visible);

    if (!event.visible && this.selectedElemento()?.idGeoElemento === event.elemento.idGeoElemento) {
      this.selection.setElemento(null);
    }
  }

  onTreeCreateNodeRequested(event: TreeCreateNodeRequest) {
    this.interaction.runWithPendingGuards(
      () => {
        this.nodeDialog?.openCreate(event.parent, event.tipo);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTreeEditNodeRequested(node: MapaNodo) {
    this.interaction.runWithPendingGuards(
      () => {
        this.nodeDialog?.openEdit(node);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTreeDeleteNodeRequested(node: MapaNodo) {
    this.interaction.runWithPendingGuards(
      () => {
        this.confirmDeleteNode(node);
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTreeDrawElementRequested(event: TreeDrawElementRequest) {
    this.interaction.runWithPendingGuards(
      () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.selection.setNodo(event.node);
        this.selection.setElemento(null);

        if (event.geomTipo === 'point') {
          this.ui.setDrawPointMode();
          return;
        }

        if (event.geomTipo === 'linestring') {
          this.ui.setDrawLineMode();
          return;
        }

        this.ui.setDrawPolygonMode();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTreeCenterElementoRequested(elemento: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item: elemento,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => setTimeout(() => this.mapCanvas?.centerOnElemento(id), 0),
      afterSelect: () => {
        setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
      },
    });
  }

  onTreeEditDataElementoRequested(elemento: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item: elemento,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => setTimeout(() => this.mapCanvas?.centerOnElemento(id), 0),
      afterSelect: () => {
        this.interaction.openInfoPanelForElemento(elemento, this.nodos());
        this.ui.setSelectMode();
      },
    });
  }

  onTreeEditGeometryElementoRequested(elemento: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item: elemento,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => setTimeout(() => this.mapCanvas?.centerOnElemento(id), 0),
      afterSelect: () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setEditGeometryMode();
        setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
      },
    });
  }

  onTreeDeleteElementoRequested(elemento: MapaElemento) {
    this.deleteContextElemento(elemento);
  }

  onCreateNodeSubmitted(payload: MapaNodoSaveRequest) {
    this.nodeDialog?.markSaving();

    this.crud.createNodo(
      payload,
      (created) => {
        this.nodeDialog?.handleSaveSuccess();
        this.showSuccess('Nodo guardado', `Se creó "${created.nodo}" correctamente.`);
        this.selection.setNodo(created);

        setTimeout(() => {
          const branchNodeIds = this.getBranchNodeIds(created.idRedNodo);
          const branchElementos = this.elementosCanvas().filter((el) =>
            branchNodeIds.has(el.idRedNodoFk)
          );
          this.mapCanvas?.centerOnElementos(branchElementos);
        }, 0);
      },
      (message) => {
        this.nodeDialog?.handleSaveError(message);
      }
    );
  }

  onEditNodeSubmitted(payload: MapaPatchRequest) {
    this.nodeDialog?.markSaving();

    this.crud.editNodo(
      payload,
      (updated) => {
        this.nodeDialog?.handleSaveSuccess();
        this.showSuccess('Nodo actualizado', `Se actualizó "${updated.nodo}" correctamente.`);
        this.selection.setNodo(updated);

        setTimeout(() => {
          const branchNodeIds = this.getBranchNodeIds(updated.idRedNodo);
          const branchElementos = this.elementosCanvas().filter((el) =>
            branchNodeIds.has(el.idRedNodoFk)
          );
          this.mapCanvas?.centerOnElementos(branchElementos);
        }, 0);
      },
      (message) => {
        this.nodeDialog?.handleSaveError(message);
      }
    );
  }

  clearError() {
    this.crud.clearError();
  }

  clearSuccess() {
    this.successVisible.set(false);
    this.successTitle.set('');
    this.successText.set('');
  }

  private showSuccess(title: string, text: string) {
    this.successTitle.set(title);
    this.successText.set(text);
    this.successVisible.set(true);
  }

  private reloadElementosAndCenterFirstIfSearching() {
    this.crud.loadElementos((items) => {
      this.centerFirstSearchResultIfNeeded(items);
    });
  }

  private centerFirstSearchResultIfNeeded(items: MapaElemento[]) {
    if (!(this.filtros.q() || '').trim()) {
      return;
    }

    const visibles = this.filterCanvasVisible(items);
    if (visibles.length === 0) {
      this.selection.setElemento(null);
      return;
    }

    const first = visibles[0];
    this.selection.setElemento(first);
    setTimeout(() => this.mapCanvas?.centerOnElemento(first.idGeoElemento), 0);
  }

  private navigateSearchResults(direction: 1 | -1) {
    const results = this.getSearchNavigableItems();

    if (!results.length) {
      return;
    }

    const currentId = this.selectedElemento()?.idGeoElemento ?? null;
    const currentIndex =
      currentId == null
        ? -1
        : results.findIndex((item) => item.idGeoElemento === currentId);

    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : results.length - 1
        : (currentIndex + direction + results.length) % results.length;

    const nextItem = results[nextIndex];

    this.interaction.selectElementoWithPendingGuard({
      item: nextItem,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => setTimeout(() => this.mapCanvas?.centerOnElemento(id), 0),
      afterSelect: () => {
        setTimeout(() => this.mapCanvas?.centerOnElemento(nextItem.idGeoElemento), 0);
      },
    });
  }

  private getSearchNavigableItems(): MapaElemento[] {
    if (!(this.filtros.q() || '').trim()) {
      return [];
    }

    return this.elementosCanvas();
  }

  private filterCanvasVisible(items: MapaElemento[]): MapaElemento[] {
    const hiddenTipoIds = new Set(this.capas.hiddenTipoIds());

    return items.filter((el) => {
      if (hiddenTipoIds.has(el.idGeoTipoElementoFk)) {
        return false;
      }

      return this.visibility.isElementoVisible(el, this.nodos());
    });
  }

  private getBranchNodeIds(rootId: number): Set<number> {
    const ids = new Set<number>();
    const queue = [rootId];

    while (queue.length) {
      const current = queue.shift()!;
      if (ids.has(current)) continue;

      ids.add(current);

      for (const node of this.nodos()) {
        if ((node.idRedNodoPadreFk ?? null) === current) {
          queue.push(node.idRedNodo);
        }
      }
    }

    return ids;
  }

  private buildExportSummary(): string {
    const parts: string[] = [];

    if ((this.filtros.q() || '').trim()) {
      parts.push(`Búsqueda: "${this.filtros.q()}"`);
    }

    const nodoId = this.filtros.idRedNodoFk();
    if (nodoId != null) {
      const nodo = this.nodos().find((n) => n.idRedNodo === nodoId);
      parts.push(`Nodo: ${nodo?.nodo ?? nodoId}`);
    } else {
      parts.push('Nodo: todos');
    }

    const tipoId = this.filtros.idGeoTipoElementoFk();
    if (tipoId != null) {
      const tipo = this.tipos().find((t) => t.idGeoTipoElemento === tipoId);
      parts.push(`Tipo: ${tipo?.nombre ?? tipoId}`);
    } else {
      parts.push('Tipo: todos');
    }

    const visible = this.filtros.visible();
    if (visible === true) {
      parts.push('Visibilidad: sólo visibles');
    } else if (visible === false) {
      parts.push('Visibilidad: sólo no visibles');
    } else {
      parts.push('Visibilidad: todos');
    }

    return parts.join(' · ');
  }

  private closeSidebarIfMobile() {
    if (typeof window !== 'undefined' && window.innerWidth < 860) {
      this.ui.setSidebarHidden(true);
      this.scheduleMapLayoutRefresh();
      this.scheduleMapLayoutRefresh(280);
    }
  }

  private scheduleMapLayoutRefresh(delay = 0) {
    if (typeof window === 'undefined') {
      return;
    }

    const run = () => {
      window.dispatchEvent(new Event('resize'));
      this.mapCanvas?.refreshMapLayout?.();

      window.requestAnimationFrame(() => {
        this.mapCanvas?.refreshMapLayout?.();
      });
    };

    if (delay > 0) {
      window.setTimeout(run, delay);
      return;
    }

    run();
  }

  private confirmDiscardGeometryChanges(onConfirm?: () => void) {
    this.confirmDialog?.open(
      {
        title: 'Hay cambios sin guardar',
        message:
          'La forma fue modificada.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.mapCanvas?.cancelEditSession();
        this.interaction.resetEditSessionState();
        this.ui.setSelectMode();
        onConfirm?.();
      }
    );
  }

  private confirmDiscardInfoChanges(onConfirm?: () => void) {
    this.confirmDialog?.open(
      {
        title: 'Hay cambios sin guardar',
        message:
          'Los datos del elemento fueron modificados.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.interaction.closeInfoPanel();
        onConfirm?.();
      }
    );
  }

  private confirmDeleteNode(node: MapaNodo) {
    this.confirmDialog?.open(
      {
        title: 'Eliminar nodo',
        message: `Vas a eliminar el nodo "${node.nodo}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar nodo',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.crud.deleteNodo(node.idRedNodo, () => {
          setTimeout(() => this.mapCanvas?.centerOnElementos(this.elementosCanvas()), 0);
        });
      }
    );
  }

  private confirmDeleteElemento(item: MapaElemento) {
    this.confirmDialog?.open(
      {
        title: 'Eliminar elemento',
        message: `Vas a eliminar el elemento "${item.nombre}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar elemento',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.crud.deleteElemento(item.idGeoElemento, () => {
          this.interaction.closeContextMenu();

          if (this.editSessionElementId() === item.idGeoElemento) {
            this.interaction.resetEditSessionState();
            this.ui.setSelectMode();
          }

          if (this.selectedElemento()?.idGeoElemento === item.idGeoElemento) {
            this.interaction.closeInfoPanel();
          }

          setTimeout(() => this.mapCanvas?.centerOnElementos(this.elementosCanvas()), 0);
        });
      }
    );
  }
}
