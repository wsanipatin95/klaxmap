import { Injectable, computed, signal } from '@angular/core';
import type { MapaElemento, MapaNodo } from '../data-access/mapa.models';

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
    const branchNodeIds = this.getBranchNodeIds(nodeId, nodos);
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
    const hidden = new Set(this._hiddenNodeIds());
    if (hidden.has(nodeId)) return true;

    const byId = new Map(nodos.map((n) => [n.idRedNodo, n] as const));
    let current = byId.get(nodeId) ?? null;

    while (current?.idRedNodoPadreFk != null) {
      const parent = byId.get(current.idRedNodoPadreFk) ?? null;
      if (!parent) break;
      if (hidden.has(parent.idRedNodo)) return true;
      current = parent;
    }

    return false;
  }

  isElementoVisible(elemento: MapaElemento, nodos: MapaNodo[]): boolean {
    const hiddenElements = new Set(this._hiddenElementoIds());
    if (hiddenElements.has(elemento.idGeoElemento)) return false;
    if (this.isNodeHidden(elemento.idRedNodoFk, nodos)) return false;
    return true;
  }

  getBranchNodeIds(rootId: number, nodos: MapaNodo[]): Set<number> {
    const byParent = new Map<number | null, MapaNodo[]>();

    for (const n of nodos) {
      const parentId = n.idRedNodoPadreFk ?? null;
      const arr = byParent.get(parentId) ?? [];
      arr.push(n);
      byParent.set(parentId, arr);
    }

    const result = new Set<number>();
    const stack = [rootId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (result.has(currentId)) continue;

      result.add(currentId);

      const children = byParent.get(currentId) ?? [];
      for (const child of children) {
        stack.push(child.idRedNodo);
      }
    }

    return result;
  }
}