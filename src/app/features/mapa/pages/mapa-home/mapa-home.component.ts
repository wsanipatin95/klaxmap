import { CommonModule } from '@angular/common';
import { Component, ViewChild, computed, inject } from '@angular/core';
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

import type {
  TreeCreateNodeRequest,
  TreeDrawElementRequest,
  TreeElementoVisibilityChange,
  TreeNodeVisibilityChange,
} from '../../components/mapa-tree/mapa-tree.component';

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
        ? `Editando forma de "${this.editSessionElementName() || 'elemento'}". Tienes cambios pendientes.`
        : `Editando forma de "${this.editSessionElementName() || 'elemento'}".`;
    }

    if (this.ui.propertiesOpen()) {
      return this.infoPanelDirty()
        ? `Editando información de "${elemento?.nombre || 'elemento'}". Tienes cambios pendientes.`
        : `Editando información de "${elemento?.nombre || 'elemento'}".`;
    }

    if (this.ui.loading()) {
      return 'Buscando y actualizando resultados del mapa...';
    }

    if (q) {
      return `Búsqueda actual: "${q}" · ${this.elementosCanvas().length} resultado(s) visibles en el mapa.`;
    }

    if (elemento) {
      return `Elemento activo: "${elemento.nombre}". Puedes editar sus datos desde el menú o el árbol.`;
    }

    if (nodo) {
      return `Nodo activo: "${nodo.nodo}". Puedes dibujar nuevos elementos dentro de este nodo.`;
    }

    return 'Arrastra el mapa libremente, selecciona un elemento o crea una nueva geometría.';
  });

  constructor() {
    this.crud.loadAll();
  }

  onSearchChange(q: string) {
    this.interaction.runWithPendingGuards(
      () => {
        this.filtros.setQ(q);
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
        this.crud.loadElementos();
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
        this.filtros.setNodo(nodo?.idRedNodo ?? null);
        this.interaction.closeContextMenu();
        this.crud.loadElementos();
      },
      (onConfirm) => this.confirmDiscardGeometryChanges(onConfirm),
      (onConfirm) => this.confirmDiscardInfoChanges(onConfirm)
    );
  }

  onTipoSelect(tipoId: number | null) {
    this.interaction.runWithPendingGuards(
      () => {
        this.filtros.setTipo(tipoId);
        this.interaction.closeContextMenu();
        this.crud.loadElementos();
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
    this.crud.loadElementos();
  }

  onElementoDeleted(id: number) {
    this.interaction.onElementoDeleted(id);
    this.visibility.clearElemento(id);
    this.crud.loadElementos();
  }

  onRefresh() {
    this.interaction.runWithPendingGuards(
      () => {
        this.crud.refreshAll((items) => {
          this.centerFirstSearchResultIfNeeded(items);
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
    this.crud.createElemento(payload);
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

  saveGeometryEdition() {
    const payload = this.mapCanvas?.saveEditSession();
    if (!payload) return;

    this.crud.saveElementoGeometria(
      {
        id: payload.idGeoElemento,
        wkt: payload.wkt,
      },
      () => {
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
  }

  onTreeElementoVisibilityChange(event: TreeElementoVisibilityChange) {
    this.visibility.setElementoVisible(event.elemento.idGeoElemento, event.visible);
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
    this.crud.createNodo(payload);
  }

  onEditNodeSubmitted(payload: MapaPatchRequest) {
    this.crud.editNodo(payload);
  }

  clearError() {
    this.crud.clearError();
  }

  private reloadElementosAndCenterFirstIfSearching() {
    this.crud.loadElementos((items) => {
      this.centerFirstSearchResultIfNeeded(items);
    });
  }

  private centerFirstSearchResultIfNeeded(items: MapaElemento[]) {
    if (!(this.filtros.q() || '').trim() || items.length === 0) {
      return;
    }

    const first = items[0];
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

  private confirmDiscardGeometryChanges(onConfirm?: () => void) {
    this.confirmDialog?.open(
      {
        title: 'Descartar cambios pendientes',
        message:
          'Tienes cambios de geometría sin guardar.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar cambios',
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
        title: 'Descartar cambios de información',
        message:
          'Tienes cambios de información sin guardar.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar cambios',
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
        this.crud.deleteNodo(node.idRedNodo);
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
        });
      }
    );
  }
}