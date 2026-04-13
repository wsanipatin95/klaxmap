import { CommonModule } from '@angular/common';
import { Component, HostListener, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

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
import { MapaGeoSearchFacade } from '../../application/mapa-geo-search.facade';
import { MapaHomeViewFacade } from '../../application/mapa-home-view.facade';

import type {
  TreeCreateNodeRequest,
  TreeDrawElementRequest,
  TreeElementoVisibilityChange,
  TreeNodeVisibilityChange,
} from '../../components/mapa-tree/mapa-tree.component';
import type { MapaGeoSearchResult } from '../../models/mapa-geo-search.models';
import { getBranchNodeIds } from '../../utils/mapa-visibility.utils';

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
  readonly geoSearch = inject(MapaGeoSearchFacade);
  readonly view = inject(MapaHomeViewFacade);

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

  readonly elementosCanvas = this.view.elementosCanvas;
  readonly searchResultIndex = this.view.searchResultIndex;
  readonly quickInfo = this.view.quickInfo;

  readonly geoSearchValue = this.geoSearch.value;
  readonly geoSearchLoading = this.geoSearch.loading;
  readonly geoSearchHasSearched = this.geoSearch.hasSearched;
  readonly geoSearchResults = this.geoSearch.results;
  readonly geoSearchError = this.geoSearch.error;

  readonly actionBusy = signal(false);
  readonly actionBusyTitle = signal('Guardando cambios');
  readonly actionBusyText = signal('Espera un momento mientras se procesa la información.');

  readonly successVisible = signal(false);
  readonly successTitle = signal('');
  readonly successText = signal('');

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
    await this.geoSearch.search(query, {
      onClearedEmptyQuery: () => this.mapCanvas?.clearTemporarySearchMarker(),
      onAutoSelectCoordinates: (result) => this.onGeoSearchResultSelected(result),
    });
  }

  onGeoSearchResultSelected(result: MapaGeoSearchResult) {
    this.geoSearch.select(result);
    this.mapCanvas?.focusOnSearchResult(result);
    this.closeSidebarIfMobile();
  }

  clearGeoSearch() {
    this.geoSearch.clear(() => this.mapCanvas?.clearTemporarySearchMarker());
  }

  onToolbarSidebarToggle() {
    this.ui.toggleSidebar();
    this.scheduleLayoutRefreshForSidebarChange();
  }

  onToolbarSidebarCompactToggle() {
    this.ui.toggleSidebarCompact();
    this.scheduleLayoutRefreshForSidebarChange();
  }

  onSidebarBackdropRequested() {
    this.ui.setSidebarHidden(true);
    this.scheduleLayoutRefreshForSidebarChange();
  }

  onSearchRequested(q: string) {
    this.runGuarded(() => {
      this.filtros.setQ(q);
      this.selection.setElemento(null);
      this.interaction.closeContextMenu();
      this.crud.loadElementos((items) => {
        this.view.centerFirstVisibleSearchResultIfNeeded(items, {
          onSelect: (item) => this.selection.setElemento(item),
          centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
        });
      });
    });
  }

  clearSearch() {
    this.runGuarded(() => {
      this.filtros.setQ('');
      this.selection.setElemento(null);
      this.interaction.closeContextMenu();
      this.crud.loadElementos((items) => {
        this.defer(() => this.mapCanvas?.centerOnElementos(this.view.filterCanvasVisible(items)));
      });
    });
  }

  onSearchPrev() {
    this.navigateSearchResults(-1);
  }

  onSearchNext() {
    this.navigateSearchResults(1);
  }

  onNodoSelect(nodo: MapaNodo | null) {
    this.runGuarded(() => {
      this.selection.setNodo(nodo);
      this.interaction.closeContextMenu();

      this.defer(() => {
        if (!nodo) {
          this.mapCanvas?.centerOnElementos(this.elementosCanvas());
          return;
        }

        this.mapCanvas?.centerOnElementos(this.view.getVisibleBranchElementos(nodo.idRedNodo));
      });
    });
  }

  onTipoSelect(tipoId: number | null) {
    this.runGuarded(() => {
      this.filtros.setTipo(tipoId);
      this.selection.setElemento(null);
      this.interaction.closeContextMenu();
      this.crud.loadElementos((items) => {
        const visibles = this.view.filterCanvasVisible(items);
        if (visibles.length) {
          this.defer(() => this.mapCanvas?.centerOnElementos(visibles));
        }
      });
    });
  }

  onElementoSelect(item: MapaElemento | null) {
    this.interaction.selectElementoWithPendingGuard({
      item,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
    });
  }

  onTreeElementoSelected(item: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
      afterSelect: () => {
        this.defer(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento));
      },
    });
  }

  onElementoUpdated(item: MapaElemento) {
    this.selection.setElemento(item);
    this.interaction.setInfoPanelDirty(false);
    this.crud.loadElementos(() => {
      this.defer(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento));
    });
    this.showSuccess('Información guardada', `Se actualizó "${item.nombre}" correctamente.`);
  }

  onElementoDeleted(id: number) {
    this.interaction.onElementoDeleted(id);
    this.visibility.clearElemento(id);
    this.crud.loadElementos((items) => {
      this.defer(() => this.mapCanvas?.centerOnElementos(this.view.filterCanvasVisible(items)));
    });
  }

  onRefresh() {
    this.runGuarded(() => {
      this.crud.refreshAll((items) => {
        const centeredBySearch = this.view.centerFirstVisibleSearchResultIfNeeded(items, {
          onSelect: (item) => this.selection.setElemento(item),
          centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
        });

        if (!centeredBySearch) {
          this.defer(() => {
            this.mapCanvas?.centerOnElementos(this.view.filterCanvasVisible(items));
          });
        }
      });
    });
  }

  abrirImportacion() {
    this.runGuarded(() => {
      this.importDialog?.open();
    });
  }

  abrirExportacion() {
    this.runGuarded(() => {
      const prefill: Partial<MapaExportRequest> = {
        q: this.filtros.q(),
        idRedNodoFk: this.filtros.idRedNodoFk(),
        idGeoTipoElementoFk: this.filtros.idGeoTipoElementoFk(),
        visible: this.filtros.visible(),
        nombreDocumento: 'mapa_red_isp',
      };

      this.exportDialog?.open(prefill, {
        resultCount: this.elementosCanvas().length,
        filterSummary: this.view.buildExportSummary(),
      });
    });
  }

  irATiposElemento() {
    this.runGuarded(() => {
      this.router.navigate(['/app/mapa/tipos']);
    });
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
        this.defer(() => this.mapCanvas?.centerOnElemento(created.idGeoElemento));
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
    this.runGuarded(() => {
      this.ui.setSelectMode();
    });
  }

  onToolbarEditGeometryMode() {
    const elemento = this.selectedElemento();

    if (!elemento) {
      this.crud.setError('Primero selecciona un elemento para editar su forma.');
      return;
    }

    if (this.editSessionActive() && this.editSessionElementId() !== elemento.idGeoElemento) {
      this.runGuarded(() => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setEditGeometryMode();
        this.defer(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento));
      });
      return;
    }

    this.ui.closeProperties();
    this.interaction.setInfoPanelDirty(false);
    this.ui.setEditGeometryMode();
    this.defer(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento));
  }

  onToolbarDrawPointMode() {
    this.runGuarded(() => {
      this.ui.closeProperties();
      this.interaction.setInfoPanelDirty(false);
      this.ui.setDrawPointMode();
    });
  }

  onToolbarDrawLineMode() {
    this.runGuarded(() => {
      this.ui.closeProperties();
      this.interaction.setInfoPanelDirty(false);
      this.ui.setDrawLineMode();
    });
  }

  onToolbarDrawPolygonMode() {
    this.runGuarded(() => {
      this.ui.closeProperties();
      this.interaction.setInfoPanelDirty(false);
      this.ui.setDrawPolygonMode();
    });
  }

  onToolbarMeasureMode() {
    this.runGuarded(() => {
      this.ui.closeProperties();
      this.interaction.setInfoPanelDirty(false);
      this.ui.setMeasureMode();
    });
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
            this.defer(() => this.mapCanvas?.centerOnElemento(updated.idGeoElemento));
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
    this.runGuarded(() => {
      this.selection.setElemento(item);
      this.mapCanvas?.centerOnElemento(item.idGeoElemento);
      this.interaction.closeContextMenu();
    });
  }

  editDataContextElemento(item: MapaElemento) {
    this.runGuarded(() => {
      this.interaction.openInfoPanelForElemento(item, this.nodos());
      this.ui.setSelectMode();
      this.interaction.closeContextMenu();
    });
  }

  editGeometryContextElemento(item: MapaElemento) {
    this.runGuarded(() => {
      this.selection.setElemento(item);
      this.ui.closeProperties();
      this.interaction.setInfoPanelDirty(false);
      this.ui.setEditGeometryMode();
      this.interaction.closeContextMenu();

      this.defer(() => {
        this.mapCanvas?.centerOnElemento(item.idGeoElemento);
      });
    });
  }

  deleteContextElemento(item: MapaElemento) {
    this.runGuarded(() => {
      this.confirmDeleteElemento(item);
    });
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

    const hiddenBranchIds = getBranchNodeIds(event.node.idRedNodo, this.nodos());

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
    this.runGuarded(() => {
      this.nodeDialog?.openCreate(event.parent, event.tipo);
    });
  }

  onTreeEditNodeRequested(node: MapaNodo) {
    this.runGuarded(() => {
      this.nodeDialog?.openEdit(node);
    });
  }

  onTreeDeleteNodeRequested(node: MapaNodo) {
    this.runGuarded(() => {
      this.confirmDeleteNode(node);
    });
  }

  onTreeDrawElementRequested(event: TreeDrawElementRequest) {
    this.runGuarded(() => {
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
    });
  }

  onTreeCenterElementoRequested(elemento: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item: elemento,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
      afterSelect: () => {
        this.defer(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento));
      },
    });
  }

  onTreeEditDataElementoRequested(elemento: MapaElemento) {
    this.interaction.selectElementoWithPendingGuard({
      item: elemento,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
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
      centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
      afterSelect: () => {
        this.ui.closeProperties();
        this.interaction.setInfoPanelDirty(false);
        this.ui.setEditGeometryMode();
        this.defer(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento));
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

        this.defer(() => {
          this.mapCanvas?.centerOnElementos(this.view.getVisibleBranchElementos(created.idRedNodo));
        });
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

        this.defer(() => {
          this.mapCanvas?.centerOnElementos(this.view.getVisibleBranchElementos(updated.idRedNodo));
        });
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

  private runGuarded(action: () => void) {
    this.interaction.runWithPendingGuards(
      action,
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  private showSuccess(title: string, text: string) {
    this.successTitle.set(title);
    this.successText.set(text);
    this.successVisible.set(true);
  }

  private navigateSearchResults(direction: 1 | -1) {
    const nextItem = this.view.getNextSearchNavigationItem(direction);
    if (!nextItem) {
      return;
    }

    this.interaction.selectElementoWithPendingGuard({
      item: nextItem,
      nodos: this.nodos(),
      onGeometryDiscardRequested: (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      onInfoDiscardRequested: (onConfirm) => this.confirmDiscardInfoChanges(onConfirm),
      centerOnElemento: (id) => this.defer(() => this.mapCanvas?.centerOnElemento(id)),
      afterSelect: () => {
        this.defer(() => this.mapCanvas?.centerOnElemento(nextItem.idGeoElemento));
      },
    });
  }

  private closeSidebarIfMobile() {
    if (typeof window !== 'undefined' && window.innerWidth < 860) {
      this.ui.setSidebarHidden(true);
      this.scheduleLayoutRefreshForSidebarChange();
    }
  }

  private scheduleLayoutRefreshForSidebarChange() {
    this.scheduleMapLayoutRefresh();
    this.scheduleMapLayoutRefresh(280);
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
          this.defer(() => this.mapCanvas?.centerOnElementos(this.elementosCanvas()));
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

          this.defer(() => this.mapCanvas?.centerOnElementos(this.elementosCanvas()));
        });
      }
    );
  }

  private defer(action: () => void) {
    setTimeout(action, 0);
  }
}
