import { CommonModule } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { MapaUiStore } from '../../store/mapa-ui.store';
import { MapaSelectionStore } from '../../store/mapa-selection.store';
import { MapaFiltrosStore } from '../../store/mapa-filtros.store';

import { MapaNodosRepository } from '../../data-access/nodo/mapa-nodos.repository';
import { MapaTiposRepository } from '../../data-access/tipo-elemento/mapa-tipos.repository';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';

import type {
  MapaElemento,
  MapaNodo,
  MapaTipoElemento,
  MapaExportRequest,
  PagedResponse,
} from '../../data-access/mapa.models';

import { MapaLayoutComponent } from '../../components/mapa-layout/mapa-layout.component';
import { MapaToolbarComponent } from '../../components/mapa-toolbar/mapa-toolbar.component';
import { MapaSidebarComponent } from '../../components/mapa-sidebar/mapa-sidebar.component';
import { MapaCanvasComponent } from '../../components/mapa-canvas/mapa-canvas.component';
import { MapaPropertiesPanelComponent } from '../../components/mapa-properties-panel/mapa-properties-panel.component';
import { MapaStatusbarComponent } from '../../components/mapa-statusbar/mapa-statusbar.component';
import { MapaImportDialogComponent } from '../../components/mapa-import-dialog/mapa-import-dialog.component';
import { MapaExportDialogComponent } from '../../components/mapa-export-dialog/mapa-export-dialog.component';

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
  ],
  templateUrl: './mapa-home.component.html',
  styleUrl: './mapa-home.component.scss',
})
export class MapaHomeComponent {
  readonly ui = inject(MapaUiStore);
  readonly selection = inject(MapaSelectionStore);
  readonly filtros = inject(MapaFiltrosStore);

  private nodosRepo = inject(MapaNodosRepository);
  private tiposRepo = inject(MapaTiposRepository);
  private elementosRepo = inject(MapaElementosRepository);

  @ViewChild('importDialog') importDialog?: MapaImportDialogComponent;
  @ViewChild('exportDialog') exportDialog?: MapaExportDialogComponent;

  readonly nodos = signal<MapaNodo[]>([]);
  readonly tipos = signal<MapaTipoElemento[]>([]);
  readonly elementos = signal<MapaElemento[]>([]);
  readonly error = signal<string | null>(null);

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
    this.nodosRepo.listar({ all: true })
      .subscribe({
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
    this.tiposRepo.listar({ all: true })
      .subscribe({
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
    this.elementosRepo.listar({
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
  }

  onElementoUpdated(item: MapaElemento) {
    this.selection.setElemento(item);
    this.cargarElementos();
  }

  onElementoDeleted(id: number) {
    if (this.selection.selectedElemento()?.idGeoElemento === id) {
      this.selection.setElemento(null);
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
}