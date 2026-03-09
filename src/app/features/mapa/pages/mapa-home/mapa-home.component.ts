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
  MapaGeometryEditedEvent,
  MapaNodo,
  MapaTipoElemento,
  PagedResponse,
  MapaGeomTipo,
} from '../../data-access/mapa.models';

import { MapaLayoutComponent } from '../../components/mapa-layout/mapa-layout.component';
import { MapaToolbarComponent } from '../../components/mapa-toolbar/mapa-toolbar.component';
import { MapaSidebarComponent } from '../../components/mapa-sidebar/mapa-sidebar.component';
import { MapaCanvasComponent } from '../../components/mapa-canvas/mapa-canvas.component';
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

  readonly selectedElemento = this.selection.selectedElemento;
  readonly selectedNodo = this.selection.selectedNodo;
  readonly selectedTipo = this.selection.selectedTipo;

  readonly totalElementos = computed(() => this.elementos().length);

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
    this.filtros.setQ(q);
    this.cargarElementos();
  }

  onNodoSelect(nodo: MapaNodo | null) {
    this.selection.setNodo(nodo);
    this.filtros.setNodo(nodo?.idRedNodo ?? null);
    this.cargarElementos();
  }

  onTipoSelect(tipoId: number | null) {
    this.filtros.setTipo(tipoId);
    this.cargarElementos();
  }

  onElementoSelect(item: MapaElemento | null) {
    this.selection.setElemento(item);
    this.closeContextMenu();
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
    this.cargarElementos();
  }

  onRefresh() {
    this.cargarNodos();
    this.cargarTipos();
    this.cargarElementos();
  }

  abrirImportacion() {
    this.importDialog?.open();
  }

  abrirExportacion() {
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
    this.ui.setToolMode('select');
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

  onGeometryEdited(event: MapaGeometryEditedEvent) {
    this.elementosRepo.editarGeometria({
      id: event.idGeoElemento,
      wkt: event.wkt,
    }).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.cargarElementos();
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo guardar la geometría');
      },
    });
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
    this.selection.setElemento(item);
    this.mapCanvas?.centerOnElemento(item.idGeoElemento);
    this.closeContextMenu();
  }

  editContextElemento(item: MapaElemento) {
    this.selection.setElemento(item);
    this.ui.setToolMode('edit-geometry');
    this.closeContextMenu();
  }

  deleteContextElemento(item: MapaElemento) {
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
}