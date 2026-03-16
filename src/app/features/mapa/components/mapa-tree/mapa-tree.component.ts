import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { MapaElemento, MapaGeomTipo, MapaNodo } from '../../data-access/mapa.models';

interface TreeNodeVm {
  node: MapaNodo;
  children: TreeNodeVm[];
  elementos: MapaElemento[];
  visible: boolean;
}

export interface TreeNodeVisibilityChange {
  node: MapaNodo;
  visible: boolean;
}

export interface TreeElementoVisibilityChange {
  elemento: MapaElemento;
  visible: boolean;
}

export interface TreeCreateNodeRequest {
  parent: MapaNodo | null;
  tipo: MapaNodo['tipoNodo'];
}

export interface TreeDrawElementRequest {
  node: MapaNodo;
  geomTipo: MapaGeomTipo;
}

type ContextKind = 'node' | 'element' | null;

@Component({
  selector: 'app-mapa-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-tree.component.html',
  styleUrl: './mapa-tree.component.scss',
})
export class MapaTreeComponent {
  @Input() nodos: MapaNodo[] = [];
  @Input() elementos: MapaElemento[] = [];
  @Input() selectedNodoId: number | null = null;
  @Input() selectedElementoId: number | null = null;
  @Input() searchValue = '';
  @Input() hiddenNodeIds: number[] = [];
  @Input() hiddenElementoIds: number[] = [];

  @Output() nodoSelected = new EventEmitter<MapaNodo | null>();
  @Output() elementoSelected = new EventEmitter<MapaElemento>();
  @Output() nodeVisibilityChange = new EventEmitter<TreeNodeVisibilityChange>();
  @Output() elementoVisibilityChange = new EventEmitter<TreeElementoVisibilityChange>();
  @Output() createNodeRequested = new EventEmitter<TreeCreateNodeRequest>();
  @Output() editNodeRequested = new EventEmitter<MapaNodo>();
  @Output() deleteNodeRequested = new EventEmitter<MapaNodo>();
  @Output() drawElementRequested = new EventEmitter<TreeDrawElementRequest>();
  @Output() centerElementoRequested = new EventEmitter<MapaElemento>();
  @Output() editDataElementoRequested = new EventEmitter<MapaElemento>();
  @Output() editGeometryElementoRequested = new EventEmitter<MapaElemento>();
  @Output() deleteElementoRequested = new EventEmitter<MapaElemento>();

  readonly expandedIds = signal<number[]>([]);

  readonly contextVisible = signal(false);
  readonly contextX = signal(0);
  readonly contextY = signal(0);
  readonly contextKind = signal<ContextKind>(null);
  readonly contextNode = signal<MapaNodo | null>(null);
  readonly contextElemento = signal<MapaElemento | null>(null);

  get hasAnyTreeData(): boolean {
    return this.nodos.length > 0 || this.elementos.length > 0;
  }

  get tree(): TreeNodeVm[] {
    return this.buildTree();
  }

  get hasVisibleTreeData(): boolean {
    return this.tree.length > 0;
  }

  selectAll() {
    this.nodoSelected.emit(null);
    this.ensureRootNodesExpanded();
  }

  createRootNode(tipo: MapaNodo['tipoNodo']) {
    this.createNodeRequested.emit({ parent: null, tipo });
  }

  toggleExpanded(nodeId: number, event?: Event) {
    event?.stopPropagation();

    const current = new Set(this.expandedIds());
    if (current.has(nodeId)) {
      current.delete(nodeId);
    } else {
      current.add(nodeId);
    }
    this.expandedIds.set([...current]);
  }

  isExpanded(node: MapaNodo): boolean {
    if (this.searchValue.trim()) return true;
    if (this.isRootNode(node.idRedNodo)) return true;
    if (this.isAncestorOfSelectedNodo(node.idRedNodo)) return true;
    if (this.isAncestorOfSelectedElemento(node.idRedNodo)) return true;

    return this.expandedIds().includes(node.idRedNodo);
  }

  iconFor(tipoNodo: MapaNodo['tipoNodo']): string {
    switch (tipoNodo) {
      case 'carpeta':
        return '📁';
      case 'zona':
        return '🗺️';
      case 'sitio':
        return '📍';
      case 'nodo_fisico':
        return '📡';
      default:
        return '•';
    }
  }

  isNodeVisible(node: MapaNodo): boolean {
    return !this.isNodeHidden(node.idRedNodo);
  }

  isElementoVisible(elemento: MapaElemento): boolean {
    return (
      !this.hiddenElementoIds.includes(elemento.idGeoElemento) &&
      !this.isNodeHidden(elemento.idRedNodoFk)
    );
  }

  isNodeIndeterminate(node: MapaNodo): boolean {
    if (!this.isNodeVisible(node)) return false;

    const branchNodeIds = this.getDescendantNodeIds(node.idRedNodo);
    const branchElementos = this.elementos.filter((e) =>
      branchNodeIds.includes(e.idRedNodoFk)
    );

    const hasHiddenDescendantNode = branchNodeIds.some(
      (id) => id !== node.idRedNodo && this.hiddenNodeIds.includes(id)
    );

    const hasHiddenDescendantElemento = branchElementos.some((e) =>
      this.hiddenElementoIds.includes(e.idGeoElemento)
    );

    return hasHiddenDescendantNode || hasHiddenDescendantElemento;
  }

  onNodeClick(node: MapaNodo, event?: MouseEvent) {
    event?.stopPropagation();
    this.nodoSelected.emit(node);
  }

  onElementoClick(elemento: MapaElemento, event?: MouseEvent) {
    event?.stopPropagation();
    this.elementoSelected.emit(elemento);
    this.centerElementoRequested.emit(elemento);
  }

  onToggleNode(node: MapaNodo, event: Event) {
    event.stopPropagation();
    const checked = (event.target as HTMLInputElement).checked;
    this.nodeVisibilityChange.emit({ node, visible: checked });
  }

  onToggleElemento(elemento: MapaElemento, event: Event) {
    event.stopPropagation();
    const checked = (event.target as HTMLInputElement).checked;
    this.elementoVisibilityChange.emit({ elemento, visible: checked });
  }

  openNodeContext(node: MapaNodo, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.contextKind.set('node');
    this.contextNode.set(node);
    this.contextElemento.set(null);
    this.contextX.set(event.clientX);
    this.contextY.set(event.clientY);
    this.contextVisible.set(true);
  }

  openElementoContext(elemento: MapaElemento, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.contextKind.set('element');
    this.contextElemento.set(elemento);
    this.contextNode.set(null);
    this.contextX.set(event.clientX);
    this.contextY.set(event.clientY);
    this.contextVisible.set(true);
  }

  closeContext() {
    this.contextVisible.set(false);
  }

  trackByNode = (_: number, item: TreeNodeVm) => item.node.idRedNodo;
  trackByElemento = (_: number, item: MapaElemento) => item.idGeoElemento;

  private buildTree(): TreeNodeVm[] {
    const byParent = new Map<number | null, MapaNodo[]>();
    const elementosByNodo = new Map<number, MapaElemento[]>();
    const allNodeIds = new Set(this.nodos.map((n) => n.idRedNodo));
    const q = this.searchValue.trim().toLowerCase();

    for (const n of this.nodos) {
      const rawParent = n.idRedNodoPadreFk ?? null;
      const parentId = rawParent != null && allNodeIds.has(rawParent) ? rawParent : null;
      const arr = byParent.get(parentId) ?? [];
      arr.push(n);
      byParent.set(parentId, arr);
    }

    for (const el of this.elementos) {
      const arr = elementosByNodo.get(el.idRedNodoFk) ?? [];
      arr.push(el);
      elementosByNodo.set(el.idRedNodoFk, arr);
    }

    let roots = (byParent.get(null) ?? []).sort(this.sortNodes);

    if (!roots.length && this.nodos.length > 0) {
      const minNivel = Math.min(...this.nodos.map((n) => n.nivel ?? 0));
      roots = this.nodos
        .filter((n) => (n.nivel ?? 0) === minNivel)
        .sort(this.sortNodes);
    }

    const build = (node: MapaNodo): TreeNodeVm => {
      const rawChildren = (byParent.get(node.idRedNodo) ?? []).sort(this.sortNodes);
      const children = rawChildren.map(build);

      const rawElementos = (elementosByNodo.get(node.idRedNodo) ?? [])
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      const elementos = q
        ? rawElementos.filter((e) => this.matchesElemento(e))
        : rawElementos;

      const childVisible = children.some((c) => c.visible);
      const nodeVisible = this.matchesNode(node);
      const visible = !q || nodeVisible || elementos.length > 0 || childVisible;

      return {
        node,
        children: q ? children.filter((c) => c.visible) : children,
        elementos,
        visible,
      };
    };

    const result = roots.map(build).filter((n) => n.visible);
    this.ensureRootNodesExpanded(result.map((r) => r.node.idRedNodo));
    return result;
  }

  private ensureRootNodesExpanded(rootIds?: number[]) {
    const ids = rootIds ?? this.getRootNodeIds();
    if (!ids.length) return;

    const current = new Set(this.expandedIds());
    let changed = false;

    for (const id of ids) {
      if (!current.has(id)) {
        current.add(id);
        changed = true;
      }
    }

    if (changed) {
      this.expandedIds.set([...current]);
    }
  }

  private getRootNodeIds(): number[] {
    const allNodeIds = new Set(this.nodos.map((n) => n.idRedNodo));
    const roots = this.nodos
      .filter((n) => {
        const parent = n.idRedNodoPadreFk ?? null;
        return parent == null || !allNodeIds.has(parent);
      })
      .sort(this.sortNodes)
      .map((n) => n.idRedNodo);

    if (roots.length > 0) return roots;
    if (!this.nodos.length) return [];

    const minNivel = Math.min(...this.nodos.map((n) => n.nivel ?? 0));
    return this.nodos
      .filter((n) => (n.nivel ?? 0) === minNivel)
      .sort(this.sortNodes)
      .map((n) => n.idRedNodo);
  }

  private isRootNode(nodeId: number): boolean {
    return this.getRootNodeIds().includes(nodeId);
  }

  private isAncestorOfSelectedNodo(nodeId: number): boolean {
    if (this.selectedNodoId == null) return false;
    return this.getAncestorIds(this.selectedNodoId).includes(nodeId);
  }

  private isAncestorOfSelectedElemento(nodeId: number): boolean {
    if (this.selectedElementoId == null) return false;
    const el = this.elementos.find((x) => x.idGeoElemento === this.selectedElementoId);
    if (!el) return false;
    return this.getAncestorIds(el.idRedNodoFk).includes(nodeId);
  }

  private getAncestorIds(nodeId: number): number[] {
    const byId = new Map(this.nodos.map((n) => [n.idRedNodo, n] as const));
    const ids: number[] = [];
    let current = byId.get(nodeId) ?? null;

    while (current) {
      ids.push(current.idRedNodo);
      const parentId = current.idRedNodoPadreFk ?? null;
      if (parentId == null) break;
      current = byId.get(parentId) ?? null;
    }

    return ids;
  }

  private getDescendantNodeIds(rootId: number): number[] {
    const byParent = new Map<number | null, MapaNodo[]>();

    for (const n of this.nodos) {
      const parentId = n.idRedNodoPadreFk ?? null;
      const arr = byParent.get(parentId) ?? [];
      arr.push(n);
      byParent.set(parentId, arr);
    }

    const result: number[] = [];
    const stack = [rootId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      result.push(currentId);

      const children = byParent.get(currentId) ?? [];
      for (const child of children) {
        stack.push(child.idRedNodo);
      }
    }

    return result;
  }

  private matchesNode(node: MapaNodo): boolean {
    const q = this.searchValue.trim().toLowerCase();
    if (!q) return true;

    return [
      node.nodo,
      node.descripcion ?? '',
      node.codigo ?? '',
      node.pathCache ?? '',
      node.tipoNodo,
    ].some((v) => (v || '').toLowerCase().includes(q));
  }

  private matchesElemento(elemento: MapaElemento): boolean {
    const q = this.searchValue.trim().toLowerCase();
    if (!q) return true;

    return [
      elemento.nombre,
      elemento.descripcion ?? '',
      elemento.codigo ?? '',
      elemento.etiqueta ?? '',
      elemento.observacion ?? '',
      elemento.geomTipo ?? '',
      elemento.estado ?? '',
    ].some((v) => (v || '').toLowerCase().includes(q));
  }

  private isNodeHidden(nodeId: number): boolean {
    const hidden = new Set(this.hiddenNodeIds);
    if (hidden.has(nodeId)) return true;

    const byId = new Map(this.nodos.map((n) => [n.idRedNodo, n] as const));
    let current = byId.get(nodeId) ?? null;

    while (current?.idRedNodoPadreFk != null) {
      const parent = byId.get(current.idRedNodoPadreFk) ?? null;
      if (!parent) return false;
      if (hidden.has(parent.idRedNodo)) return true;
      current = parent;
    }

    return false;
  }

  private sortNodes(a: MapaNodo, b: MapaNodo): number {
    const orderDiff = (a.orden ?? 0) - (b.orden ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.nodo.localeCompare(b.nodo);
  }
}