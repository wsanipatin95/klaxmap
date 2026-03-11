import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
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

  readonly tree = computed<TreeNodeVm[]>(() => this.buildTree());

  readonly contextVisible = signal(false);
  readonly contextX = signal(0);
  readonly contextY = signal(0);
  readonly contextKind = signal<ContextKind>(null);
  readonly contextNode = signal<MapaNodo | null>(null);
  readonly contextElemento = signal<MapaElemento | null>(null);

  selectAll() {
    this.nodoSelected.emit(null);
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
    if (this.searchValue.trim()) {
      return true;
    }
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
    return !this.hiddenElementoIds.includes(elemento.idGeoElemento) && !this.isNodeHidden(elemento.idRedNodoFk);
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

  private buildTree(): TreeNodeVm[] {
    const byParent = new Map<number | null, MapaNodo[]>();
    const allNodeIds = new Set(this.nodos.map((n) => n.idRedNodo));

    for (const n of this.nodos) {
      const rawParent = n.idRedNodoPadreFk ?? null;
      const parentId = rawParent != null && allNodeIds.has(rawParent) ? rawParent : null;
      const arr = byParent.get(parentId) ?? [];
      arr.push(n);
      byParent.set(parentId, arr);
    }

    const roots = (byParent.get(null) ?? []).sort(this.sortNodes);

    const build = (node: MapaNodo): TreeNodeVm => {
      const children = (byParent.get(node.idRedNodo) ?? []).sort(this.sortNodes).map(build);
      const elementos = this.elementos
        .filter((e) => e.idRedNodoFk === node.idRedNodo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      const visible = this.matchesNode(node) || elementos.length > 0 || children.some((c) => c.visible);

      return {
        node,
        children,
        elementos,
        visible: this.searchValue.trim() ? visible : true,
      };
    };

    return roots.map(build).filter((n) => n.visible);
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