import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { MapaUiStore } from '../store/mapa-ui.store';
import { MapaSelectionStore } from '../store/mapa-selection.store';
import { MapaFiltrosStore } from '../store/mapa-filtros.store';
import { MapaVisibilityStore } from '../store/mapa-visibility.store';

import { MapaNodosRepository } from '../data-access/nodo/mapa-nodos.repository';
import { MapaTiposRepository } from '../data-access/tipo-elemento/mapa-tipos.repository';
import { MapaElementosRepository } from '../data-access/elemento/mapa-elementos.repository';

import type {
  MapaElemento,
  MapaElementoGeometriaRequest,
  MapaElementoSaveRequest,
  MapaNodo,
  MapaNodoSaveRequest,
  MapaPatchRequest,
  MapaTipoElemento,
  PagedResponse,
} from '../data-access/mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaCrudFacade {
  private readonly ui = inject(MapaUiStore);
  private readonly selection = inject(MapaSelectionStore);
  private readonly filtros = inject(MapaFiltrosStore);
  private readonly visibility = inject(MapaVisibilityStore);

  private readonly nodosRepo = inject(MapaNodosRepository);
  private readonly tiposRepo = inject(MapaTiposRepository);
  private readonly elementosRepo = inject(MapaElementosRepository);

  readonly nodos = signal<MapaNodo[]>([]);
  readonly tipos = signal<MapaTipoElemento[]>([]);
  readonly elementos = signal<MapaElemento[]>([]);
  readonly error = signal<string | null>(null);

  readonly totalElementos = computed(() => this.elementos().length);

  loadAll() {
    this.loadNodos();
    this.loadTipos();
    this.loadElementos();
  }

  loadNodos() {
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

  loadTipos() {
    this.tiposRepo.listar({ all: true }).subscribe({
      next: (data) => {
        const items = Array.isArray(data)
          ? data
          : (data as PagedResponse<MapaTipoElemento>).content ?? [];

        this.tipos.set(items);
      },
      error: (err) => {
        console.error('[MAPA][TIPOS] error:', err);
        this.error.set(err?.message || 'No se pudo cargar tipos');
      },
    });
  }

  loadElementos(onLoaded?: (items: MapaElemento[]) => void) {
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
          onLoaded?.(items);
        },
        error: (err) => {
          console.error('[MAPA][ELEMENTOS] error:', err);
          this.error.set(err?.message || 'No se pudo cargar elementos');
        },
      });
  }

  refreshAll(onElementosLoaded?: (items: MapaElemento[]) => void) {
    this.loadNodos();
    this.loadTipos();
    this.loadElementos(onElementosLoaded);
  }

  createElemento(
    payload: MapaElementoSaveRequest,
    onDone?: (created: MapaElemento) => void
  ) {
    this.elementosRepo.crear(payload).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.loadElementos();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][CREATE ELEMENTO] error:', err);
        this.error.set(err?.message || 'No se pudo crear el elemento');
      },
    });
  }

  saveElementoGeometria(
    payload: MapaElementoGeometriaRequest,
    onDone?: (updated: MapaElemento) => void
  ) {
    this.elementosRepo.editarGeometria(payload).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.loadElementos();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][EDIT GEOMETRY] error:', err);
        this.error.set(err?.message || 'No se pudo guardar la geometría');
      },
    });
  }

  deleteElemento(id: number, onDone?: () => void) {
    this.elementosRepo.eliminar(id).subscribe({
      next: () => {
        if (this.selection.selectedElemento()?.idGeoElemento === id) {
          this.selection.setElemento(null);
        }

        this.visibility.clearElemento(id);
        this.loadElementos();
        onDone?.();
      },
      error: (err) => {
        console.error('[MAPA][DELETE ELEMENTO] error:', err);
        this.error.set(err?.message || 'No se pudo eliminar el elemento');
      },
    });
  }

  createNodo(payload: MapaNodoSaveRequest, onDone?: (created: MapaNodo) => void) {
    this.nodosRepo.crear(payload).subscribe({
      next: (resp) => {
        this.selection.setNodo(resp.data);
        this.loadNodos();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][CREATE NODO] error:', err);
        this.error.set(err?.message || 'No se pudo crear el nodo');
      },
    });
  }

  editNodo(payload: MapaPatchRequest, onDone?: (updated: MapaNodo) => void) {
    this.nodosRepo.editar(payload).subscribe({
      next: (resp) => {
        if (this.selection.selectedNodo()?.idRedNodo === resp.data.idRedNodo) {
          this.selection.setNodo(resp.data);
        }

        this.loadNodos();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][EDIT NODO] error:', err);
        this.error.set(err?.message || 'No se pudo editar el nodo');
      },
    });
  }

  deleteNodo(id: number, onDone?: () => void) {
    this.nodosRepo.eliminar(id).subscribe({
      next: () => {
        if (this.selection.selectedNodo()?.idRedNodo === id) {
          this.selection.setNodo(null);
          this.filtros.setNodo(null);
        }

        this.loadNodos();
        this.loadElementos();
        onDone?.();
      },
      error: (err) => {
        console.error('[MAPA][DELETE NODO] error:', err);
        this.error.set(err?.message || 'No se pudo eliminar el nodo');
      },
    });
  }

  clearError() {
    this.error.set(null);
  }

  setError(message: string) {
    this.error.set(message);
  }
}