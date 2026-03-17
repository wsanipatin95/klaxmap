import { CommonModule } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';

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

  readonly contextVisible = signal(false);
  readonly contextX = signal(0);
  readonly contextY = signal(0);
  readonly contextElemento = signal<MapaElemento | null>(null);

  readonly hiddenNodeIds = this.visibility.hiddenNodeIds;
  readonly hiddenElementoIds = this.visibility.hiddenElementoIds;

  readonly editSessionActive = signal(false);
  readonly editSessionDirty = signal(false);
  readonly editSessionElementId = signal<number | null>(null);
  readonly editSessionElementName = signal<string | null>(null);
  readonly editSessionGeomTipo = signal<MapaGeomTipo | null>(null);

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

  readonly quickInfo = computed(() => {
    const q = (this.filtros.q() || '').trim();
    const nodo = this.selectedNodo();
    const elemento = this.selectedElemento();

    if (this.editSessionActive()) {
      return this.editSessionDirty()
        ? `Editando forma de "${this.editSessionElementName() || 'elemento'}". Tienes cambios pendientes.`
        : `Editando forma de "${this.editSessionElementName() || 'elemento'}".`;
    }

    if (this.ui.loading()) {
      return 'Buscando y actualizando resultados del mapa...';
    }

    if (q) {
      return `Búsqueda actual: "${q}" · ${this.elementosCanvas().length} resultado(s) visibles en el mapa.`;
    }

    if (elemento) {
      return `Elemento activo: "${elemento.nombre}". Puedes editar sus datos en el panel derecho o desde el árbol.`;
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
    this.runWithPendingEditGuard(() => {
      this.filtros.setQ(q);
      this.closeContextMenu();
      this.reloadElementosAndCenterFirstIfSearching();
    });
  }

  clearSearch() {
    this.runWithPendingEditGuard(() => {
      this.filtros.setQ('');
      this.crud.loadElementos();
    });
  }

  onNodoSelect(nodo: MapaNodo | null) {
    this.runWithPendingEditGuard(() => {
      this.selection.setNodo(nodo);
      this.filtros.setNodo(nodo?.idRedNodo ?? null);
      this.closeContextMenu();
      this.crud.loadElementos();
    });
  }

  onTipoSelect(tipoId: number | null) {
    this.runWithPendingEditGuard(() => {
      this.filtros.setTipo(tipoId);
      this.closeContextMenu();
      this.crud.loadElementos();
    });
  }

  onElementoSelect(item: MapaElemento | null) {
    this.selectElementoWithPendingGuard(item);
  }

  onTreeElementoSelected(item: MapaElemento) {
    this.selectElementoWithPendingGuard(item, () => {
      setTimeout(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento), 0);
    });
  }

  onElementoUpdated(item: MapaElemento) {
    this.selection.setElemento(item);
    this.crud.loadElementos();
  }

  onElementoDeleted(id: number) {
    if (this.selection.selectedElemento()?.idGeoElemento === id) {
      this.selection.setElemento(null);
    }

    if (this.contextElemento()?.idGeoElemento === id) {
      this.closeContextMenu();
    }

    if (this.editSessionElementId() === id) {
      this.resetEditSessionState();
      this.ui.setSelectMode();
    }

    this.visibility.clearElemento(id);
    this.crud.loadElementos();
  }

  onRefresh() {
    this.runWithPendingEditGuard(() => {
      this.crud.refreshAll((items) => {
        this.centerFirstSearchResultIfNeeded(items);
      });
    });
  }

  abrirImportacion() {
    this.runWithPendingEditGuard(() => {
      this.importDialog?.open();
    });
  }

  abrirExportacion() {
    this.runWithPendingEditGuard(() => {
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
    this.crud.createElemento(payload);
  }

  onEditSessionStateChanged(state: MapaEditSessionState) {
    this.editSessionActive.set(state.active && !!state.elementId);
    this.editSessionDirty.set(state.active && !!state.elementId ? state.dirty : false);
    this.editSessionElementId.set(state.active ? state.elementId : null);
    this.editSessionElementName.set(state.active ? state.elementName : null);
    this.editSessionGeomTipo.set(state.active ? state.geomTipo : null);
  }

  onToolbarSelectMode() {
    this.runWithPendingEditGuard(() => {
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
      this.runWithPendingEditGuard(() => {
        this.ui.setEditGeometryMode();
        setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
      });
      return;
    }

    this.ui.setEditGeometryMode();
    setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
  }

  onToolbarDrawPointMode() {
    this.runWithPendingEditGuard(() => {
      this.ui.setDrawPointMode();
    });
  }

  onToolbarDrawLineMode() {
    this.runWithPendingEditGuard(() => {
      this.ui.setDrawLineMode();
    });
  }

  onToolbarDrawPolygonMode() {
    this.runWithPendingEditGuard(() => {
      this.ui.setDrawPolygonMode();
    });
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
        this.resetEditSessionState();
        this.ui.setSelectMode();
      }
    );
  }

  cancelGeometryEdition() {
    this.confirmDiscardChanges();
  }

  openContextMenu(event: { elemento: MapaElemento; x: number; y: number }) {
    this.contextElemento.set(event.elemento);
    this.contextX.set(event.x);
    this.contextY.set(event.y);
    this.contextVisible.set(true);
    this.selection.setElemento(event.elemento);
  }

  closeContextMenu() {
    this.contextVisible.set(false);
  }

  centerContextElemento(item: MapaElemento) {
    this.runWithPendingEditGuard(() => {
      this.selection.setElemento(item);
      this.mapCanvas?.centerOnElemento(item.idGeoElemento);
      this.closeContextMenu();
    });
  }

  editDataContextElemento(item: MapaElemento) {
    this.runWithPendingEditGuard(() => {
      this.selection.setElemento(item);
      this.ui.setSelectMode();
      this.closeContextMenu();
    });
  }

  editGeometryContextElemento(item: MapaElemento) {
    if (this.editSessionActive() && this.editSessionElementId() !== item.idGeoElemento) {
      this.runWithPendingEditGuard(() => {
        this.selection.setElemento(item);
        this.ui.setEditGeometryMode();
        this.closeContextMenu();

        setTimeout(() => {
          this.mapCanvas?.centerOnElemento(item.idGeoElemento);
        }, 0);
      });
      return;
    }

    this.selection.setElemento(item);
    this.ui.setEditGeometryMode();
    this.closeContextMenu();

    setTimeout(() => {
      this.mapCanvas?.centerOnElemento(item.idGeoElemento);
    }, 0);
  }

  deleteContextElemento(item: MapaElemento) {
    this.runWithPendingEditGuard(() => {
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
  }

  onTreeElementoVisibilityChange(event: TreeElementoVisibilityChange) {
    this.visibility.setElementoVisible(event.elemento.idGeoElemento, event.visible);
  }

  onTreeCreateNodeRequested(event: TreeCreateNodeRequest) {
    this.runWithPendingEditGuard(() => {
      this.nodeDialog?.openCreate(event.parent, event.tipo);
    });
  }

  onTreeEditNodeRequested(node: MapaNodo) {
    this.runWithPendingEditGuard(() => {
      this.nodeDialog?.openEdit(node);
    });
  }

  onTreeDeleteNodeRequested(node: MapaNodo) {
    this.runWithPendingEditGuard(() => {
      this.confirmDeleteNode(node);
    });
  }

  onTreeDrawElementRequested(event: TreeDrawElementRequest) {
    this.runWithPendingEditGuard(() => {
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
    this.selectElementoWithPendingGuard(elemento, () => {
      setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
    });
  }

  onTreeEditDataElementoRequested(elemento: MapaElemento) {
    this.selectElementoWithPendingGuard(elemento, () => {
      this.ui.setSelectMode();
    });
  }

  onTreeEditGeometryElementoRequested(elemento: MapaElemento) {
    this.selectElementoWithPendingGuard(elemento, () => {
      this.ui.setEditGeometryMode();
      setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
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

  private resetEditSessionState() {
    this.editSessionActive.set(false);
    this.editSessionDirty.set(false);
    this.editSessionElementId.set(null);
    this.editSessionElementName.set(null);
    this.editSessionGeomTipo.set(null);
  }

  private runWithPendingEditGuard(action: () => void) {
    if (!this.editSessionActive() || !this.editSessionDirty()) {
      action();
      return;
    }

    this.confirmDiscardChanges(action);
  }

  private confirmDiscardChanges(onConfirm?: () => void) {
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
        this.resetEditSessionState();
        this.ui.setSelectMode();
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
          this.closeContextMenu();

          if (this.editSessionElementId() === item.idGeoElemento) {
            this.resetEditSessionState();
            this.ui.setSelectMode();
          }
        });
      }
    );
  }

  private selectElementoWithPendingGuard(
    item: MapaElemento | null,
    afterSelect?: () => void
  ) {
    const currentEditId = this.editSessionElementId();
    const sameElement = item?.idGeoElemento === currentEditId;

    if (this.editSessionActive() && this.editSessionDirty() && !sameElement) {
      this.confirmDiscardChanges(() => {
        this.applyElementoSelection(item);
        afterSelect?.();
      });
      return;
    }

    this.applyElementoSelection(item);
    afterSelect?.();
  }

  private applyElementoSelection(item: MapaElemento | null) {
    this.selection.setElemento(item);
    this.closeContextMenu();

    if (!item) {
      this.resetEditSessionState();
      this.ui.setSelectMode();
      return;
    }

    const nodo = this.nodos().find((n) => n.idRedNodo === item.idRedNodoFk) ?? null;
    if (nodo) {
      this.selection.setNodo(nodo);
    }

    if (this.ui.toolMode() === 'edit-geometry') {
      setTimeout(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento), 0);
      return;
    }

    this.ui.setSelectMode();
  }
}