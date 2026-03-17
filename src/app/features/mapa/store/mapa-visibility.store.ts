import { Injectable, computed, signal } from '@angular/core';
import type { MapaElemento, MapaNodo } from '../data-access/mapa.models';
import {
  getBranchNodeIds,
  isElementoVisible,
  isNodeHidden,
} from '../utils/mapa-visibility.utils';

@Injectable({ providedIn: 'root' })
export class MapaVisibilityStore {
  private readonly _hiddenNodeIds = signal<number[]>([]);
  private readonly _hiddenElementoIds = signal<number[]>([]);

  readonly hiddenNodeIds = computed(() => this._hiddenNodeIds());
  readonly hiddenElementoIds = computed(() => this._hiddenElementoIds());

  reset() {
    this._hiddenNodeIds.set([]);
    this._hiddenElementoIds.set([]);
  }

  prune(nodos: MapaNodo[], elementos: MapaElemento[]) {
    const validNodeIds = new Set(nodos.map((n) => n.idRedNodo));
    const validElementoIds = new Set(elementos.map((e) => e.idGeoElemento));

    this._hiddenNodeIds.update((ids) => ids.filter((id) => validNodeIds.has(id)));
    this._hiddenElementoIds.update((ids) => ids.filter((id) => validElementoIds.has(id)));
  }

  clearElemento(id: number) {
    this._hiddenElementoIds.update((ids) => ids.filter((x) => x !== id));
  }

  setElementoVisible(elementId: number, visible: boolean) {
    this._hiddenElementoIds.update((ids) => {
      const set = new Set(ids);

      if (visible) {
        set.delete(elementId);
      } else {
        set.add(elementId);
      }

      return [...set];
    });
  }

  setNodeVisibleCascade(
    nodeId: number,
    visible: boolean,
    nodos: MapaNodo[],
    elementos: MapaElemento[]
  ) {
    const branchNodeIds = getBranchNodeIds(nodeId, nodos);
    const branchElementIds = elementos
      .filter((e) => branchNodeIds.has(e.idRedNodoFk))
      .map((e) => e.idGeoElemento);

    this._hiddenNodeIds.update((ids) => {
      const set = new Set(ids);

      for (const id of branchNodeIds) {
        if (visible) {
          set.delete(id);
        } else {
          set.add(id);
        }
      }

      return [...set];
    });

    this._hiddenElementoIds.update((ids) => {
      const set = new Set(ids);

      for (const id of branchElementIds) {
        if (visible) {
          set.delete(id);
        } else {
          set.add(id);
        }
      }

      return [...set];
    });
  }

  isNodeVisible(nodeId: number, nodos: MapaNodo[]): boolean {
    return !this.isNodeHidden(nodeId, nodos);
  }

  isNodeHidden(nodeId: number, nodos: MapaNodo[]): boolean {
    return isNodeHidden(nodeId, nodos, this._hiddenNodeIds());
  }

  isElementoVisible(elemento: MapaElemento, nodos: MapaNodo[]): boolean {
    return isElementoVisible(
      elemento,
      nodos,
      this._hiddenNodeIds(),
      this._hiddenElementoIds()
    );
  }

  getBranchNodeIds(rootId: number, nodos: MapaNodo[]): Set<number> {
    return getBranchNodeIds(rootId, nodos);
  }
}