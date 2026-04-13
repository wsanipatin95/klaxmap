import type { MapaElemento, MapaNodo } from '../data-access/mapa.models';

export function createNodoByIdMap(nodos: MapaNodo[]): Map<number, MapaNodo> {
  return new Map(nodos.map((n) => [n.idRedNodo, n] as const));
}

export function getAncestorNodeIds(
  nodeId: number,
  nodos: MapaNodo[],
  includeSelf = true
): number[] {
  const byId = createNodoByIdMap(nodos);
  const result: number[] = [];
  const visited = new Set<number>();

  let current = byId.get(nodeId) ?? null;

  while (current) {
    if (visited.has(current.idRedNodo)) {
      break;
    }

    visited.add(current.idRedNodo);

    if (includeSelf || current.idRedNodo !== nodeId) {
      result.push(current.idRedNodo);
    }

    const parentId = current.idRedNodoPadreFk ?? null;
    if (parentId == null) {
      break;
    }

    current = byId.get(parentId) ?? null;
  }

  return result;
}

export function getBranchNodeIds(rootId: number, nodos: MapaNodo[]): Set<number> {
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
    const currentId = stack.pop() as number;
    if (result.has(currentId)) continue;

    result.add(currentId);

    const children = byParent.get(currentId) ?? [];
    for (const child of children) {
      stack.push(child.idRedNodo);
    }
  }

  return result;
}

export function getBranchElementos(
  rootId: number,
  nodos: MapaNodo[],
  elementos: MapaElemento[]
): MapaElemento[] {
  const branchNodeIds = getBranchNodeIds(rootId, nodos);
  return elementos.filter((elemento) => branchNodeIds.has(elemento.idRedNodoFk));
}

export function isNodeHidden(
  nodeId: number,
  nodos: MapaNodo[],
  hiddenNodeIds: number[]
): boolean {
  const hidden = new Set(hiddenNodeIds);
  if (hidden.has(nodeId)) return true;

  const byId = createNodoByIdMap(nodos);
  const visited = new Set<number>();

  let current = byId.get(nodeId) ?? null;

  while (current?.idRedNodoPadreFk != null) {
    if (visited.has(current.idRedNodo)) {
      break;
    }

    visited.add(current.idRedNodo);

    const parent = byId.get(current.idRedNodoPadreFk) ?? null;
    if (!parent) {
      break;
    }

    if (hidden.has(parent.idRedNodo)) {
      return true;
    }

    current = parent;
  }

  return false;
}

export function isElementoVisible(
  elemento: MapaElemento,
  nodos: MapaNodo[],
  hiddenNodeIds: number[],
  hiddenElementoIds: number[]
): boolean {
  if (hiddenElementoIds.includes(elemento.idGeoElemento)) {
    return false;
  }

  return !isNodeHidden(elemento.idRedNodoFk, nodos, hiddenNodeIds);
}

export function getRootNodeIds(nodos: MapaNodo[]): number[] {
  const allNodeIds = new Set(nodos.map((n) => n.idRedNodo));

  const roots = nodos
    .filter((n) => {
      const parent = n.idRedNodoPadreFk ?? null;
      return parent == null || !allNodeIds.has(parent);
    })
    .sort(sortNodes)
    .map((n) => n.idRedNodo);

  if (roots.length > 0) {
    return roots;
  }

  if (!nodos.length) {
    return [];
  }

  const minNivel = Math.min(...nodos.map((n) => n.nivel ?? 0));

  return nodos
    .filter((n) => (n.nivel ?? 0) === minNivel)
    .sort(sortNodes)
    .map((n) => n.idRedNodo);
}

export function sortNodes(a: MapaNodo, b: MapaNodo): number {
  const orderDiff = (a.orden ?? 0) - (b.orden ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return a.nodo.localeCompare(b.nodo);
}
