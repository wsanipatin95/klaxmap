import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import type { MapaElemento, MapaGeomTipo, MapaNodo } from '../../data-access/mapa.models';
import {
  getAncestorNodeIds,
  getBranchNodeIds,
  getRootNodeIds,
  isNodeHidden,
  sortNodes,
} from '../../utils/mapa-visibility.utils';

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
export class MapaTreeComponent implements OnChanges {
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

  tree: TreeNodeVm[] = [];

  ngOnChanges(_: SimpleChanges): void {
    this.rebuildTree();
  }

  get hasAnyTreeData(): boolean {
    return this.nodos.length > 0 || this.elementos.length > 0;
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
    return !isNodeHidden(node.idRedNodo, this.nodos, this.hiddenNodeIds);
  }

  isElementoVisible(elemento: MapaElemento): boolean {
    return (
      !this.hiddenElementoIds.includes(elemento.idGeoElemento) &&
      !isNodeHidden(elemento.idRedNodoFk, this.nodos, this.hiddenNodeIds)
    );
  }

  isNodeIndeterminate(node: MapaNodo): boolean {
    if (!this.isNodeVisible(node)) return false;

    const branchNodeIds = [...getBranchNodeIds(node.idRedNodo, this.nodos)];
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

  private rebuildTree() {
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

    let roots = (byParent.get(null) ?? []).slice().sort(sortNodes);

    if (!roots.length && this.nodos.length > 0) {
      const minNivel = Math.min(...this.nodos.map((n) => n.nivel ?? 0));
      roots = this.nodos
        .filter((n) => (n.nivel ?? 0) === minNivel)
        .slice()
        .sort(sortNodes);
    }

    const build = (node: MapaNodo): TreeNodeVm => {
      const rawChildren = (byParent.get(node.idRedNodo) ?? []).slice().sort(sortNodes);
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

    this.tree = roots.map(build).filter((n) => n.visible);
    this.ensureRootNodesExpanded(this.tree.map((r) => r.node.idRedNodo));
  }

  private ensureRootNodesExpanded(rootIds?: number[]) {
    const ids = rootIds ?? getRootNodeIds(this.nodos);
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

  private isRootNode(nodeId: number): boolean {
    return getRootNodeIds(this.nodos).includes(nodeId);
  }

  private isAncestorOfSelectedNodo(nodeId: number): boolean {
    if (this.selectedNodoId == null) return false;
    return getAncestorNodeIds(this.selectedNodoId, this.nodos).includes(nodeId);
  }

  private isAncestorOfSelectedElemento(nodeId: number): boolean {
    if (this.selectedElementoId == null) return false;

    const el = this.elementos.find((x) => x.idGeoElemento === this.selectedElementoId);
    if (!el) return false;

    return getAncestorNodeIds(el.idRedNodoFk, this.nodos).includes(nodeId);
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
}