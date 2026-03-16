import { CommonModule } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { MapaUiStore } from '../../store/mapa-ui.store';
import { MapaSelectionStore } from '../../store/mapa-selection.store';
import { MapaFiltrosStore } from '../../store/mapa-filtros.store';
import { MapaCapasStore } from '../../store/mapa-capas.store';
import { MapaVisibilityStore } from '../../store/mapa-visibility.store';

import { MapaNodosRepository } from '../../data-access/nodo/mapa-nodos.repository';
import { MapaTiposRepository } from '../../data-access/tipo-elemento/mapa-tipos.repository';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';

import type {
  MapaElemento,
  MapaElementoSaveRequest,
  MapaExportRequest,
  MapaNodo,
  MapaNodoSaveRequest,
  MapaPatchRequest,
  MapaTipoElemento,
  PagedResponse,
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

  private nodosRepo = inject(MapaNodosRepository);
  private tiposRepo = inject(MapaTiposRepository);
  private elementosRepo = inject(MapaElementosRepository);

  @ViewChild('importDialog') importDialog?: MapaImportDialogComponent;
  @ViewChild('exportDialog') exportDialog?: MapaExportDialogComponent;
  @ViewChild('createDialog') createDialog?: MapaCreateElementDialogComponent;
  @ViewChild('mapCanvas') mapCanvas?: MapaCanvasComponent;
  @ViewChild('nodeDialog') nodeDialog?: MapaNodeDialogComponent;

  readonly nodos = signal<MapaNodo[]>([]);
  readonly tipos = signal<MapaTipoElemento[]>([]);
  readonly elementos = signal<MapaElemento[]>([]);
  readonly error = signal<string | null>(null);

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

  readonly totalElementos = computed(() => this.elementos().length);

  readonly elementosCanvas = computed(() => {
    const hiddenNodeIds = new Set(this.hiddenNodeIds());
    const hiddenElementoIds = new Set(this.hiddenElementoIds());
    const hiddenTipoIds = new Set(this.capas.hiddenTipoIds());
    const byId = new Map(this.nodos().map((n) => [n.idRedNodo, n] as const));

    const isNodeHidden = (nodeId: number): boolean => {
      if (hiddenNodeIds.has(nodeId)) return true;

      let current = byId.get(nodeId) ?? null;
      while (current?.idRedNodoPadreFk != null) {
        const parent = byId.get(current.idRedNodoPadreFk) ?? null;
        if (!parent) break;
        if (hiddenNodeIds.has(parent.idRedNodo)) return true;
        current = parent;
      }
      return false;
    };

    return this.elementos().filter((el) => {
      if (hiddenElementoIds.has(el.idGeoElemento)) return false;
      if (hiddenTipoIds.has(el.idGeoTipoElementoFk)) return false;
      if (isNodeHidden(el.idRedNodoFk)) return false;
      return true;
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
    this.cargarNodos();
    this.cargarTipos();
    this.cargarElementos();
  }

  cargarNodos() {
    this.nodosRepo.listar({ all: true }).subscribe({
      next: (data) => {
        const items = Array.isArray(data)
          ? data
          : (data as PagedResponse<MapaNodo>).content ?? [];

        this.nodos.set(items);
        this.visibility.prune(items, this.elementos());
      },
      error: (err) => {
        console.error('[MAPA][NODOS] error:', err);
        this.error.set(err?.message || 'No se pudo cargar nodos');
      },
    });
  }

  cargarTipos() {
    this.tiposRepo.listar({ all: true }).subscribe({
      next: (data) => {
        this.tipos.set(
          Array.isArray(data)
            ? data
            : (data as PagedResponse<MapaTipoElemento>).content ?? []
        );
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo cargar tipos');
      },
    });
  }

  cargarElementos() {
    this.ui.setLoading(true);

    this.elementosRepo
      .listar({
        q: this.filtros.q(),
        idRedNodoFk: this.filtros.idRedNodoFk(),
        idGeoTipoElementoFk: this.filtros.idGeoTipoElementoFk(),
        visible: this.filtros.visible(),
        all: true,
      })
      .pipe(finalize(() => this.ui.setLoading(false)))
      .subscribe({
        next: (data) => {
          const items = Array.isArray(data)
            ? data
            : (data as PagedResponse<MapaElemento>).content ?? [];

          this.elementos.set(items);
          this.visibility.prune(this.nodos(), items);

          if ((this.filtros.q() || '').trim() && items.length > 0) {
            const first = items[0];
            this.selection.setElemento(first);
            setTimeout(() => this.mapCanvas?.centerOnElemento(first.idGeoElemento), 0);
          }
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar elementos');
        },
      });
  }

  onSearchChange(q: string) {
    if (!this.canLeavePendingEdit()) return;

    this.filtros.setQ(q);
    this.closeContextMenu();
    this.cargarElementos();
  }

  clearSearch() {
    if (!this.canLeavePendingEdit()) return;
    this.filtros.setQ('');
    this.cargarElementos();
  }

  onNodoSelect(nodo: MapaNodo | null) {
    if (!this.canLeavePendingEdit()) return;

    this.selection.setNodo(nodo);
    this.filtros.setNodo(nodo?.idRedNodo ?? null);
    this.closeContextMenu();
    this.cargarElementos();
  }

  onTipoSelect(tipoId: number | null) {
    if (!this.canLeavePendingEdit()) return;

    this.filtros.setTipo(tipoId);
    this.closeContextMenu();
    this.cargarElementos();
  }

  onElementoSelect(item: MapaElemento | null) {
    const currentEditId = this.editSessionElementId();

    if (this.editSessionActive() && this.editSessionDirty()) {
      const sameElement = item?.idGeoElemento === currentEditId;
      if (!sameElement && !this.confirmDiscardChanges()) {
        return;
      }
    }

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

  onTreeElementoSelected(item: MapaElemento) {
    this.onElementoSelect(item);
    setTimeout(() => this.mapCanvas?.centerOnElemento(item.idGeoElemento), 0);
  }

  onElementoUpdated(item: MapaElemento) {
    this.selection.setElemento(item);
    this.cargarElementos();
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
    this.cargarElementos();
  }

  onRefresh() {
    if (!this.canLeavePendingEdit()) return;

    this.cargarNodos();
    this.cargarTipos();
    this.cargarElementos();
  }

  abrirImportacion() {
    if (!this.canLeavePendingEdit()) return;
    this.importDialog?.open();
  }

  abrirExportacion() {
    if (!this.canLeavePendingEdit()) return;

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
    this.elementosRepo.crear(payload).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.cargarElementos();
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo crear el elemento');
      },
    });
  }

  onEditSessionStateChanged(state: MapaEditSessionState) {
    this.editSessionActive.set(state.active && !!state.elementId);
    this.editSessionDirty.set(state.active && !!state.elementId ? state.dirty : false);
    this.editSessionElementId.set(state.active ? state.elementId : null);
    this.editSessionElementName.set(state.active ? state.elementName : null);
    this.editSessionGeomTipo.set(state.active ? state.geomTipo : null);
  }

  onToolbarSelectMode() {
    if (!this.canLeavePendingEdit()) return;
    this.ui.setSelectMode();
  }

  onToolbarEditGeometryMode() {
    const elemento = this.selectedElemento();

    if (!elemento) {
      this.error.set('Primero selecciona un elemento para editar su forma.');
      return;
    }

    if (this.editSessionActive() && this.editSessionElementId() !== elemento.idGeoElemento) {
      if (!this.canLeavePendingEdit()) return;
    }

    this.ui.setEditGeometryMode();
    setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
  }

  onToolbarDrawPointMode() {
    if (!this.canLeavePendingEdit()) return;
    this.ui.setDrawPointMode();
  }

  onToolbarDrawLineMode() {
    if (!this.canLeavePendingEdit()) return;
    this.ui.setDrawLineMode();
  }

  onToolbarDrawPolygonMode() {
    if (!this.canLeavePendingEdit()) return;
    this.ui.setDrawPolygonMode();
  }

  saveGeometryEdition() {
    const payload = this.mapCanvas?.saveEditSession();
    if (!payload) return;

    this.elementosRepo
      .editarGeometria({
        id: payload.idGeoElemento,
        wkt: payload.wkt,
      })
      .subscribe({
        next: (resp) => {
          this.selection.setElemento(resp.data);
          this.resetEditSessionState();
          this.ui.setSelectMode();
          this.cargarElementos();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo guardar la geometría');
        },
      });
  }

  cancelGeometryEdition() {
    this.mapCanvas?.cancelEditSession();
    this.resetEditSessionState();
    this.ui.setSelectMode();
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
    if (!this.canLeavePendingEdit()) return;

    this.selection.setElemento(item);
    this.mapCanvas?.centerOnElemento(item.idGeoElemento);
    this.closeContextMenu();
  }

  editDataContextElemento(item: MapaElemento) {
    if (!this.canLeavePendingEdit()) return;

    this.selection.setElemento(item);
    this.ui.setSelectMode();
    this.closeContextMenu();
  }

  editGeometryContextElemento(item: MapaElemento) {
    if (this.editSessionActive() && this.editSessionElementId() !== item.idGeoElemento) {
      if (!this.canLeavePendingEdit()) return;
    }

    this.selection.setElemento(item);
    this.ui.setEditGeometryMode();
    this.closeContextMenu();

    setTimeout(() => {
      this.mapCanvas?.centerOnElemento(item.idGeoElemento);
    }, 0);
  }

  deleteContextElemento(item: MapaElemento) {
    if (!this.canLeavePendingEdit()) return;

    this.elementosRepo.eliminar(item.idGeoElemento).subscribe({
      next: () => {
        this.closeContextMenu();
        this.onElementoDeleted(item.idGeoElemento);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo eliminar');
      },
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
    if (!this.canLeavePendingEdit()) return;
    this.nodeDialog?.openCreate(event.parent, event.tipo);
  }

  onTreeEditNodeRequested(node: MapaNodo) {
    if (!this.canLeavePendingEdit()) return;
    this.nodeDialog?.openEdit(node);
  }

  onTreeDeleteNodeRequested(node: MapaNodo) {
    if (!this.canLeavePendingEdit()) return;

    const ok = window.confirm(`¿Eliminar el nodo "${node.nodo}"?`);
    if (!ok) return;

    this.nodosRepo.eliminar(node.idRedNodo).subscribe({
      next: () => {
        if (this.selectedNodo()?.idRedNodo === node.idRedNodo) {
          this.selection.setNodo(null);
          this.filtros.setNodo(null);
        }
        this.cargarNodos();
        this.cargarElementos();
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo eliminar el nodo');
      },
    });
  }

  onTreeDrawElementRequested(event: TreeDrawElementRequest) {
    if (!this.canLeavePendingEdit()) return;

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
  }

  onTreeCenterElementoRequested(elemento: MapaElemento) {
    this.onElementoSelect(elemento);
    setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
  }

  onTreeEditDataElementoRequested(elemento: MapaElemento) {
    this.onElementoSelect(elemento);
    this.ui.setSelectMode();
  }

  onTreeEditGeometryElementoRequested(elemento: MapaElemento) {
    this.onElementoSelect(elemento);
    this.ui.setEditGeometryMode();
    setTimeout(() => this.mapCanvas?.centerOnElemento(elemento.idGeoElemento), 0);
  }

  onTreeDeleteElementoRequested(elemento: MapaElemento) {
    this.deleteContextElemento(elemento);
  }

  onCreateNodeSubmitted(payload: MapaNodoSaveRequest) {
    this.nodosRepo.crear(payload).subscribe({
      next: (resp) => {
        this.selection.setNodo(resp.data);
        this.cargarNodos();
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo crear el nodo');
      },
    });
  }

  onEditNodeSubmitted(payload: MapaPatchRequest) {
    this.nodosRepo.editar(payload).subscribe({
      next: (resp) => {
        if (this.selectedNodo()?.idRedNodo === resp.data.idRedNodo) {
          this.selection.setNodo(resp.data);
        }
        this.cargarNodos();
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo editar el nodo');
      },
    });
  }

  clearError() {
    this.error.set(null);
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

  private canLeavePendingEdit(): boolean {
    if (!this.editSessionActive() || !this.editSessionDirty()) {
      return true;
    }

    return this.confirmDiscardChanges();
  }

  private confirmDiscardChanges(): boolean {
    const ok = window.confirm(
      'Tienes cambios de geometría sin guardar. ¿Deseas descartarlos?'
    );

    if (ok) {
      this.mapCanvas?.cancelEditSession();
      this.resetEditSessionState();
      this.ui.setSelectMode();
    }

    return ok;
  }
}