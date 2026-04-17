import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
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

  private pendingLoads = 0;
  private nodosSeq = 0;
  private tiposSeq = 0;
  private elementosSeq = 0;
  private deletedElementosSeq = 0;
  private refreshSeq = 0;

  readonly nodos = signal<MapaNodo[]>([]);
  readonly tipos = signal<MapaTipoElemento[]>([]);
  readonly elementos = signal<MapaElemento[]>([]);
  readonly deletedElementos = signal<MapaElemento[]>([]);
  readonly error = signal<string | null>(null);

  readonly totalElementos = computed(() => this.elementos().length);

  loadAll() {
    this.refreshAll();
  }

  loadNodos() {
    const seq = ++this.nodosSeq;
    this.beginLoading();

    this.nodosRepo
      .listar({ all: true })
      .pipe(finalize(() => this.endLoading()))
      .subscribe({
        next: (data) => {
          if (seq !== this.nodosSeq) {
            return;
          }

          const items = this.parseListResult<MapaNodo>(data);
          this.nodos.set(items);
          this.visibility.prune(items, this.getAllKnownElementos());
          this.syncSelectionWithData(items, this.getAllKnownElementos());
        },
        error: (err) => {
          console.error('[MAPA][NODOS] error:', err);
          this.error.set(err?.message || 'No se pudo cargar nodos');
        },
      });
  }

  loadTipos() {
    const seq = ++this.tiposSeq;
    this.beginLoading();

    this.tiposRepo
      .listar({ all: true })
      .pipe(finalize(() => this.endLoading()))
      .subscribe({
        next: (data) => {
          if (seq !== this.tiposSeq) {
            return;
          }

          this.tipos.set(this.parseListResult<MapaTipoElemento>(data));
        },
        error: (err) => {
          console.error('[MAPA][TIPOS] error:', err);
          this.error.set(err?.message || 'No se pudo cargar tipos');
        },
      });
  }

  loadElementos(onLoaded?: (items: MapaElemento[]) => void) {
    const seq = ++this.elementosSeq;
    this.beginLoading();

    this.elementosRepo
      .listar(this.buildElementosFilters())
      .pipe(finalize(() => this.endLoading()))
      .subscribe({
        next: (data) => {
          if (seq !== this.elementosSeq) {
            return;
          }

          const items = this.parseListResult<MapaElemento>(data);
          this.elementos.set(items);
          this.visibility.prune(this.nodos(), [...items, ...this.deletedElementos()]);
          this.syncSelectionWithData(this.nodos(), [...items, ...this.deletedElementos()]);
          onLoaded?.(items);
        },
        error: (err) => {
          console.error('[MAPA][ELEMENTOS] error:', err);
          this.error.set(err?.message || 'No se pudo cargar elementos');
        },
      });
  }

  loadDeletedElementos(onLoaded?: (items: MapaElemento[]) => void) {
    const seq = ++this.deletedElementosSeq;
    this.beginLoading();

    this.elementosRepo
      .listar(this.buildDeletedElementosFilters())
      .pipe(finalize(() => this.endLoading()))
      .subscribe({
        next: (data) => {
          if (seq !== this.deletedElementosSeq) {
            return;
          }

          const items = this.parseListResult<MapaElemento>(data);
          this.deletedElementos.set(items);
          this.visibility.prune(this.nodos(), [...this.elementos(), ...items]);
          this.syncSelectionWithData(this.nodos(), [...this.elementos(), ...items]);
          onLoaded?.(items);
        },
        error: (err) => {
          console.error('[MAPA][ELEMENTOS ELIMINADOS] error:', err);
          this.error.set(err?.message || 'No se pudo cargar elementos eliminados');
        },
      });
  }

  refreshAll(onElementosLoaded?: (items: MapaElemento[]) => void) {
    const refreshSeq = ++this.refreshSeq;
    const nodosSeq = ++this.nodosSeq;
    const tiposSeq = ++this.tiposSeq;
    const elementosSeq = ++this.elementosSeq;
    const deletedElementosSeq = ++this.deletedElementosSeq;

    this.beginLoading();

    forkJoin({
      nodos: this.nodosRepo.listar({ all: true }),
      tipos: this.tiposRepo.listar({ all: true }),
      elementos: this.elementosRepo.listar(this.buildElementosFilters()),
      deletedElementos: this.elementosRepo.listar(this.buildDeletedElementosFilters()),
    })
      .pipe(finalize(() => this.endLoading()))
      .subscribe({
        next: ({ nodos, tipos, elementos, deletedElementos }) => {
          const requestStillCurrent =
            refreshSeq === this.refreshSeq &&
            nodosSeq === this.nodosSeq &&
            tiposSeq === this.tiposSeq &&
            elementosSeq === this.elementosSeq &&
            deletedElementosSeq === this.deletedElementosSeq;

          if (!requestStillCurrent) {
            return;
          }

          const nextNodos = this.parseListResult<MapaNodo>(nodos);
          const nextTipos = this.parseListResult<MapaTipoElemento>(tipos);
          const nextElementos = this.parseListResult<MapaElemento>(elementos);
          const nextDeletedElementos = this.parseListResult<MapaElemento>(deletedElementos);

          this.nodos.set(nextNodos);
          this.tipos.set(nextTipos);
          this.elementos.set(nextElementos);
          this.deletedElementos.set(nextDeletedElementos);

          this.visibility.prune(nextNodos, [...nextElementos, ...nextDeletedElementos]);
          this.syncSelectionWithData(nextNodos, [...nextElementos, ...nextDeletedElementos]);

          onElementosLoaded?.(nextElementos);
        },
        error: (err) => {
          console.error('[MAPA][REFRESH] error:', err);
          this.error.set(err?.message || 'No se pudo actualizar la información del mapa');
        },
      });
  }

  createElemento(
    payload: MapaElementoSaveRequest,
    onDone?: (created: MapaElemento) => void,
    onError?: (message: string) => void
  ) {
    this.elementosRepo.crear(payload).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.refreshAll(() => {
          onDone?.(resp.data);
        });
      },
      error: (err) => {
        console.error('[MAPA][CREATE ELEMENTO] error:', err);
        const message = err?.message || 'No se pudo crear el elemento';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  saveElementoGeometria(
    payload: MapaElementoGeometriaRequest,
    onDone?: (updated: MapaElemento) => void,
    onError?: (message: string) => void
  ) {
    this.elementosRepo.editarGeometria(payload).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.refreshAll(() => {
          onDone?.(resp.data);
        });
      },
      error: (err) => {
        console.error('[MAPA][EDIT GEOMETRY] error:', err);
        const message = err?.message || 'No se pudo guardar la geometría';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  deleteElemento(
    id: number,
    onDone?: (deleted: MapaElemento) => void,
    onError?: (message: string) => void
  ) {
    this.elementosRepo.eliminar(id).subscribe({
      next: (resp) => {
        if (this.selection.selectedElemento()?.idGeoElemento === id) {
          this.selection.setElemento(null);
        }

        this.visibility.clearElemento(id);
        this.refreshAll(() => {
          onDone?.(resp.data);
        });
      },
      error: (err) => {
        console.error('[MAPA][DELETE ELEMENTO] error:', err);
        const message = err?.message || 'No se pudo eliminar el elemento';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  restoreElemento(
    id: number,
    onDone?: (restored: MapaElemento) => void,
    onError?: (message: string) => void
  ) {
    this.elementosRepo.restaurar(id).subscribe({
      next: (resp) => {
        this.selection.setElemento(resp.data);
        this.refreshAll(() => {
          onDone?.(resp.data);
        });
      },
      error: (err) => {
        console.error('[MAPA][RESTORE ELEMENTO] error:', err);
        const message = err?.message || 'No se pudo restaurar el elemento';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  createNodo(
    payload: MapaNodoSaveRequest,
    onDone?: (created: MapaNodo) => void,
    onError?: (message: string) => void
  ) {
    this.nodosRepo.crear(payload).subscribe({
      next: (resp) => {
        this.selection.setNodo(resp.data);
        this.refreshAll();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][CREATE NODO] error:', err);
        const message = err?.message || 'No se pudo crear el nodo';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  editNodo(
    payload: MapaPatchRequest,
    onDone?: (updated: MapaNodo) => void,
    onError?: (message: string) => void
  ) {
    this.nodosRepo.editar(payload).subscribe({
      next: (resp) => {
        if (this.selection.selectedNodo()?.idRedNodo === resp.data.idRedNodo) {
          this.selection.setNodo(resp.data);
        }

        this.refreshAll();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][EDIT NODO] error:', err);
        const message = err?.message || 'No se pudo editar el nodo';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  deleteNodo(
    id: number,
    onDone?: (deleted: MapaNodo) => void,
    onError?: (message: string) => void
  ) {
    this.nodosRepo.eliminar(id).subscribe({
      next: (resp) => {
        if (this.selection.selectedNodo()?.idRedNodo === id) {
          this.selection.setNodo(null);
        }

        this.refreshAll();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][DELETE NODO] error:', err);
        const message = err?.message || 'No se pudo eliminar el nodo';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  restoreNodo(
    id: number,
    onDone?: (restored: MapaNodo) => void,
    onError?: (message: string) => void
  ) {
    this.nodosRepo.restaurar(id).subscribe({
      next: (resp) => {
        this.selection.setNodo(resp.data);
        this.refreshAll();
        onDone?.(resp.data);
      },
      error: (err) => {
        console.error('[MAPA][RESTORE NODO] error:', err);
        const message = err?.message || 'No se pudo restaurar el nodo';
        this.error.set(message);
        onError?.(message);
      },
    });
  }

  clearError() {
    this.error.set(null);
  }

  setError(message: string) {
    this.error.set(message);
  }

  private buildElementosFilters() {
    return {
      q: this.filtros.q(),
      idRedNodoFk: this.filtros.idRedNodoFk(),
      idGeoTipoElementoFk: this.filtros.idGeoTipoElementoFk(),
      visible: this.filtros.visible(),
      all: true,
      includeDeleted: false,
      onlyDeleted: false,
    };
  }

  private buildDeletedElementosFilters() {
    return {
      q: this.filtros.q(),
      idRedNodoFk: this.filtros.idRedNodoFk(),
      idGeoTipoElementoFk: this.filtros.idGeoTipoElementoFk(),
      all: true,
      onlyDeleted: true,
    };
  }

  private parseListResult<T>(data: PagedResponse<T> | T[]): T[] {
    return Array.isArray(data) ? data : data.content ?? [];
  }

  private syncSelectionWithData(nodos: MapaNodo[], elementos: MapaElemento[]) {
    const selectedNodoId = this.selection.selectedNodo()?.idRedNodo ?? null;
    if (selectedNodoId != null) {
      const refreshedNodo = nodos.find((item) => item.idRedNodo === selectedNodoId) ?? null;
      this.selection.setNodo(refreshedNodo);
    }

    const selectedElementoId = this.selection.selectedElemento()?.idGeoElemento ?? null;
    if (selectedElementoId != null) {
      const refreshedElemento =
        elementos.find((item) => item.idGeoElemento === selectedElementoId) ?? null;
      this.selection.setElemento(refreshedElemento);
    }
  }

  private getAllKnownElementos(): MapaElemento[] {
    return [...this.elementos(), ...this.deletedElementos()];
  }

  private beginLoading() {
    this.pendingLoads += 1;
    this.ui.setLoading(true);
  }

  private endLoading() {
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    this.ui.setLoading(this.pendingLoads > 0);
  }
}
