import { CommonModule } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { MapaUiStore } from '../../store/mapa-ui.store';
import { MapaSelectionStore } from '../../store/mapa-selection.store';
import { MapaFiltrosStore } from '../../store/mapa-filtros.store';
import { MapaCapasStore } from '../../store/mapa-capas.store';

import { MapaNodosRepository } from '../../data-access/nodo/mapa-nodos.repository';
import { MapaTiposRepository } from '../../data-access/tipo-elemento/mapa-tipos.repository';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';

import type {
  MapaElemento,
  MapaElementoSaveRequest,
  MapaExportRequest,
  MapaNodo,
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
  ],
  templateUrl: './mapa-home.component.html',
  styleUrl: './mapa-home.component.scss',
})
export class MapaHomeComponent {
  readonly ui = inject(MapaUiStore);
  readonly selection = inject(MapaSelectionStore);
  readonly filtros = inject(MapaFiltrosStore);
  readonly capas = inject(MapaCapasStore);

  private nodosRepo = inject(MapaNodosRepository);
  private tiposRepo = inject(MapaTiposRepository);
  private elementosRepo = inject(MapaElementosRepository);

  @ViewChild('importDialog') importDialog?: MapaImportDialogComponent;
  @ViewChild('exportDialog') exportDialog?: MapaExportDialogComponent;
  @ViewChild('createDialog') createDialog?: MapaCreateElementDialogComponent;
  @ViewChild('mapCanvas') mapCanvas?: MapaCanvasComponent;

  readonly nodos = signal<MapaNodo[]>([]);
  readonly tipos = signal<MapaTipoElemento[]>([]);
  readonly elementos = signal<MapaElemento[]>([]);
  readonly error = signal<string | null>(null);

  readonly contextVisible = signal(false);
  readonly contextX = signal(0);
  readonly contextY = signal(0);
  readonly contextElemento = signal<MapaElemento | null>(null);

  readonly editSessionActive = signal(false);
  readonly editSessionDirty = signal(false);
  readonly editSessionElementId = signal<number | null>(null);
  readonly editSessionElementName = signal<string | null>(null);
  readonly editSessionGeomTipo = signal<MapaGeomTipo | null>(null);

  readonly selectedElemento = this.selection.selectedElemento;
  readonly selectedNodo = this.selection.selectedNodo;
  readonly selectedTipo = this.selection.selectedTipo;

  readonly totalElementos = computed(() => this.elementos().length);

  readonly quickInfo = computed(() => {
    const q = (this.filtros.q() || '').trim();
    const nodo = this.selectedNodo();
    const elemento = this.selectedElemento();

    if (this.editSessionActive()) {
      return this.editSessionDirty()
        ? `Editando forma de "${this.editSessionElementName() || 'elemento'}". Tienes cambios pendientes.`
        : `Editando forma de "${this.editSessionElementName() || 'elemento'}".`;
    }

    if (q) {
      return `Búsqueda actual: "${q}" · ${this.totalElementos()} resultado(s) visibles.`;
    }

    if (elemento) {
      return `Elemento activo: "${elemento.nombre}". Puedes editar sus datos en el panel derecho.`;
    }

    if (nodo) {
      return `Nodo activo: "${nodo.nodo}". Los nuevos elementos se crearán en este nodo si dibujas uno.`;
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
        this.nodos.set(Array.isArray(data) ? data : (data as PagedResponse<MapaNodo>).content ?? []);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo cargar nodos');
      },
    });
  }

  cargarTipos() {
    this.tiposRepo.listar({ all: true }).subscribe({
      next: (data) => {
        this.tipos.set(Array.isArray(data) ? data : (data as PagedResponse<MapaTipoElemento>).content ?? []);
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
          this.elementos.set(Array.isArray(data) ? data : (data as PagedResponse<MapaElemento>).content ?? []);
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

    if (this.ui.toolMode() === 'edit-geometry') {
      queueMicrotask(() => {
        this.mapCanvas?.centerOnElemento(item.idGeoElemento);
      });
      return;
    }

    this.ui.setSelectMode();
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

    this.exportDialog?.open(prefill);
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

    queueMicrotask(() => {
      this.mapCanvas?.centerOnElemento(elemento.idGeoElemento);
    });
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

    this.elementosRepo.editarGeometria({
      id: payload.idGeoElemento,
      wkt: payload.wkt,
    }).subscribe({
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

    queueMicrotask(() => {
      this.mapCanvas?.centerOnElemento(item.idGeoElemento);
    });
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

  clearError() {
    this.error.set(null);
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