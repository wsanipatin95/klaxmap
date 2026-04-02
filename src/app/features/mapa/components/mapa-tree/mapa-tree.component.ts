import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';

import type {
  MapaElemento,
  MapaGeomTipo,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import {
  getAncestorNodeIds,
  getBranchNodeIds,
  getRootNodeIds,
  isNodeHidden,
  sortNodes,
} from '../../utils/mapa-visibility.utils';
import { SessionStore } from '../../../seg/store/session.store';

interface TreeNodeVm {
  node: MapaNodo;
  children: TreeNodeVm[];
  elementos: MapaElemento[];
  visible: boolean;
  hiddenElementCount: number;
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

interface TreeElementVisual {
  mode: 'shape' | 'material' | 'class' | 'url';
  iconoFuente: string | null;
  icono: string | null;
  iconoClase: string | null;
  colorFill: string;
  colorStroke: string;
  colorTexto: string | null;
  tamanoIcono: number;
}

@Component({
  selector: 'app-mapa-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-tree.component.html',
  styleUrl: './mapa-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaTreeComponent implements OnChanges {
  @ViewChild('treeScroll') treeScroll?: ElementRef<HTMLDivElement>;

  @Input() nodos: MapaNodo[] = [];
  @Input() elementos: MapaElemento[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
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

  private readonly sessionStore = inject(SessionStore);

  readonly editarElemento = computed(() =>
    this.sessionStore.hasCompanyPrivilege('eem_red_red')
  );

  tree: TreeNodeVm[] = [];

  performanceMode = false;
  performanceNotice = '';

  private readonly TREE_PERFORMANCE_THRESHOLD = 2500;
  private readonly TREE_LIMIT_NO_SEARCH = 2500;
  private readonly TREE_LIMIT_SEARCH = 1500;
  private readonly MAX_ELEMENTS_PER_NODE = 150;

  private treeElementos: MapaElemento[] = [];
  private hiddenNodeSet = new Set<number>();
  private hiddenElementoSet = new Set<number>();
  private tipoMap = new Map<number, MapaTipoElemento>();
  private pendingScrollToSelection = false;

  ngOnChanges(changes: SimpleChanges): void {
    const nodosChanged = !!changes['nodos'];
    const searchChanged = !!changes['searchValue'];
    const selectedNodoChanged = !!changes['selectedNodoId'];
    const selectedElementoChanged = !!changes['selectedElementoId'];

    this.hiddenNodeSet = new Set(this.hiddenNodeIds);
    this.hiddenElementoSet = new Set(this.hiddenElementoIds);
    this.tipoMap = new Map(this.tipos.map((t) => [t.idGeoTipoElemento, t]));
    this.performanceMode = this.elementos.length >= this.TREE_PERFORMANCE_THRESHOLD;
    this.treeElementos = this.selectElementosForTree();

    if (nodosChanged) {
      this.pruneExpandedIds();
    }

    this.rebuildTree();

    if (nodosChanged) {
      this.ensureRootNodesExpanded();
    }

    if (searchChanged && this.searchValue.trim()) {
      this.expandVisibleBranches();
    }

    if ((selectedNodoChanged || selectedElementoChanged) && !this.searchValue.trim()) {
      this.ensureSelectionPathExpanded();
    }

    if (nodosChanged || searchChanged || selectedNodoChanged || selectedElementoChanged) {
      this.requestScrollSelectionIntoView();
    }
  }

  get hasAnyTreeData(): boolean {
    return this.nodos.length > 0 || this.treeElementos.length > 0;
  }

  get hasVisibleTreeData(): boolean {
    return this.tree.length > 0;
  }

  selectAll() {
    this.nodoSelected.emit(null);
    this.expandVisibleBranches();
  }

  expandAll() {
    this.expandVisibleBranches();
  }

  collapseAll() {
    this.expandedIds.set([]);
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
    this.requestScrollSelectionIntoView();
  }

  isExpanded(node: MapaNodo): boolean {
    if (this.searchValue.trim()) return true;
    return this.expandedIds().includes(node.idRedNodo);
  }

  previewShapeClassForNode(node: MapaNodo): string {
    switch (node.tipoNodo) {
      case 'carpeta':
        return 'is-folder';
      case 'zona':
        return 'is-zone';
      case 'sitio':
        return 'is-site';
      case 'nodo_fisico':
        return 'is-physical-node';
      default:
        return 'is-folder';
    }
  }

  tipoDeElemento(elemento: MapaElemento): MapaTipoElemento | null {
    return this.tipoMap.get(elemento.idGeoTipoElementoFk) ?? null;
  }

  previewShapeClassForElemento(elemento: MapaElemento): string {
    const visual = this.resolveTreeElementVisual(elemento);

    if (elemento.geomTipo === 'linestring') return 'is-line';
    if (elemento.geomTipo === 'polygon') return 'is-polygon';

    if (visual.mode === 'material' || visual.mode === 'class' || visual.mode === 'url') {
      return 'is-icon-host';
    }

    const iconoFuente = String(visual.iconoFuente || '').toLowerCase();

    if (iconoFuente.includes('triangle')) return 'is-triangle';
    if (iconoFuente.includes('target')) return 'is-target';
    if (iconoFuente.includes('donut')) return 'is-donut';

    return 'is-point';
  }

  previewStyleForElemento(elemento: MapaElemento): Record<string, string> {
    const visual = this.resolveTreeElementVisual(elemento);

    return {
      '--preview-stroke': visual.colorStroke,
      '--preview-fill': visual.colorFill,
      '--preview-text': visual.colorTexto || visual.colorStroke,
      '--preview-size': `${visual.tamanoIcono}px`,
    };
  }

  previewMaterialFamilyForElemento(elemento: MapaElemento): string {
    const visual = this.resolveTreeElementVisual(elemento);
    const source = String(visual.iconoFuente || '').toLowerCase();

    if (source.includes('rounded')) return 'material-symbols-rounded';
    if (source.includes('sharp')) return 'material-symbols-sharp';
    return 'material-symbols-outlined';
  }

  previewMaterialGlyphForElemento(elemento: MapaElemento): string {
    const visual = this.resolveTreeElementVisual(elemento);
    return visual.icono || 'radio_button_checked';
  }

  previewClassForElemento(elemento: MapaElemento): string {
    const visual = this.resolveTreeElementVisual(elemento);
    return visual.iconoClase || visual.icono || '';
  }

  previewImageUrlForElemento(elemento: MapaElemento): string {
    const visual = this.resolveTreeElementVisual(elemento);
    return visual.icono || '';
  }

  showMaterialPreviewForElemento(elemento: MapaElemento): boolean {
    return this.resolveTreeElementVisual(elemento).mode === 'material';
  }

  showClassPreviewForElemento(elemento: MapaElemento): boolean {
    return this.resolveTreeElementVisual(elemento).mode === 'class';
  }

  showUrlPreviewForElemento(elemento: MapaElemento): boolean {
    return this.resolveTreeElementVisual(elemento).mode === 'url';
  }

  nodeOverflowLabel(item: TreeNodeVm): string {
    const hidden = Math.max(0, item.hiddenElementCount || 0);
    return `+${hidden} elemento(s) no listados para proteger el rendimiento`;
  }

  private resolveTreeElementVisual(elemento: MapaElemento): TreeElementVisual {
    const tipo = this.tipoDeElemento(elemento);

    const iconoFuente = (elemento.iconoFuente || tipo?.iconoFuente || null) as string | null;
    const icono = (elemento.icono || tipo?.icono || null) as string | null;
    const iconoClase = (elemento.iconoClase || tipo?.iconoClase || null) as string | null;

    const colorStroke =
      (elemento.colorStroke || tipo?.colorStroke || '#93c5fd') as string;
    const colorFill =
      (elemento.colorFill || tipo?.colorFill || colorStroke) as string;
    const colorTexto =
      (elemento.colorTexto || tipo?.colorTexto || colorStroke || null) as string | null;

    const tamanoIconoRaw = Number(elemento.tamanoIcono ?? tipo?.tamanoIcono ?? 16);
    const tamanoIcono =
      Number.isFinite(tamanoIconoRaw) && tamanoIconoRaw > 0
        ? Math.max(12, Math.min(24, Math.round(tamanoIconoRaw)))
        : 16;

    const source = String(iconoFuente || '').trim().toLowerCase();

    let mode: TreeElementVisual['mode'] = 'shape';

    if (this.isMaterialSource(source)) {
      mode = 'material';
    } else if (this.isCssClassSource(source) && !!(iconoClase || icono)) {
      mode = 'class';
    } else if (this.isUrlSource(source) && !!icono) {
      mode = 'url';
    }

    return {
      mode,
      iconoFuente,
      icono,
      iconoClase,
      colorFill,
      colorStroke,
      colorTexto,
      tamanoIcono,
    };
  }

  private isMaterialSource(source: string): boolean {
    return (
      source === 'material-symbols-outlined' ||
      source === 'material-symbols-rounded' ||
      source === 'material-symbols-sharp' ||
      source === 'material-symbols' ||
      source === 'material symbols' ||
      source === 'google' ||
      source === 'google-icons'
    );
  }

  private isCssClassSource(source: string): boolean {
    return (
      source === 'class' ||
      source === 'css' ||
      source === 'primeicons' ||
      source === 'fontawesome' ||
      source === 'mdi' ||
      source === 'fa'
    );
  }

  private isUrlSource(source: string): boolean {
    return source === 'url' || source === 'image' || source === 'img';
  }

  isNodeVisible(node: MapaNodo): boolean {
    return !isNodeHidden(node.idRedNodo, this.nodos, this.hiddenNodeIds);
  }

  isElementoVisible(elemento: MapaElemento): boolean {
    return (
      !this.hiddenElementoSet.has(elemento.idGeoElemento) &&
      !isNodeHidden(elemento.idRedNodoFk, this.nodos, this.hiddenNodeIds)
    );
  }

  isNodeIndeterminate(node: MapaNodo): boolean {
    if (!this.isNodeVisible(node)) return false;

    const branchNodeIds = getBranchNodeIds(node.idRedNodo, this.nodos);
    const hasHiddenDescendantNode = [...branchNodeIds].some(
      (id) => id !== node.idRedNodo && this.hiddenNodeSet.has(id)
    );

    if (hasHiddenDescendantNode) {
      return true;
    }

    for (const elemento of this.elementos) {
      if (branchNodeIds.has(elemento.idRedNodoFk) && this.hiddenElementoSet.has(elemento.idGeoElemento)) {
        return true;
      }
    }

    return false;
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

  private selectElementosForTree(): MapaElemento[] {
    const q = this.searchValue.trim().toLowerCase();
    let source = this.elementos.slice();

    if (!this.performanceMode) {
      this.performanceNotice = '';
      return source;
    }

    if (!q) {
      const focusNodeId = this.resolveFocusNodeId();
      if (focusNodeId != null) {
        const branchIds = getBranchNodeIds(focusNodeId, this.nodos);
        source = source.filter((el) => branchIds.has(el.idRedNodoFk));
      }
    } else {
      source = source.filter((el) => this.matchesElementoWithQuery(el, q));
    }

    const limit = q ? this.TREE_LIMIT_SEARCH : this.TREE_LIMIT_NO_SEARCH;

    if (source.length <= limit) {
      this.performanceNotice = '';
      return source;
    }

    const trimmed = source.slice(0, limit);
    const selected = this.selectedElementoId != null
      ? source.find((el) => el.idGeoElemento === this.selectedElementoId) ?? null
      : null;

    if (
      selected &&
      !trimmed.some((el) => el.idGeoElemento === selected.idGeoElemento)
    ) {
      trimmed[trimmed.length - 1] = selected;
    }

    this.performanceNotice = '';
    return trimmed;
  }

  private resolveFocusNodeId(): number | null {
    if (this.selectedNodoId != null) {
      return this.selectedNodoId;
    }

    if (this.selectedElementoId != null) {
      const selected = this.elementos.find((el) => el.idGeoElemento === this.selectedElementoId);
      if (selected) {
        return selected.idRedNodoFk;
      }
    }

    return null;
  }

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

    for (const el of this.treeElementos) {
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
        .sort((a, b) => {
          return (
            Number(a.ordenDibujo ?? 0) - Number(b.ordenDibujo ?? 0) ||
            a.nombre.localeCompare(b.nombre) ||
            a.idGeoElemento - b.idGeoElemento
          );
        });

      const elementLimit =
        this.performanceMode && !q ? this.MAX_ELEMENTS_PER_NODE : Number.MAX_SAFE_INTEGER;

      const elementos =
        rawElementos.length > elementLimit
          ? rawElementos.slice(0, elementLimit)
          : rawElementos;

      const hiddenElementCount = Math.max(0, rawElementos.length - elementos.length);

      const childVisible = children.some((c) => c.visible);
      const nodeVisible = this.matchesNode(node);
      const visible = !q || nodeVisible || elementos.length > 0 || childVisible;

      return {
        node,
        children: q ? children.filter((c) => c.visible) : children,
        elementos,
        visible,
        hiddenElementCount,
      };
    };

    this.tree = roots.map(build).filter((n) => n.visible);
  }

  private pruneExpandedIds() {
    const validIds = new Set(this.nodos.map((n) => n.idRedNodo));
    const next = this.expandedIds().filter((id) => validIds.has(id));

    if (next.length !== this.expandedIds().length) {
      this.expandedIds.set(next);
    }
  }

  private ensureRootNodesExpanded() {
    const ids = getRootNodeIds(this.nodos);
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

  private ensureSelectionPathExpanded() {
    const current = new Set(this.expandedIds());
    let changed = false;

    if (this.selectedNodoId != null) {
      for (const id of getAncestorNodeIds(this.selectedNodoId, this.nodos)) {
        if (!current.has(id)) {
          current.add(id);
          changed = true;
        }
      }
      if (!current.has(this.selectedNodoId)) {
        current.add(this.selectedNodoId);
        changed = true;
      }
    }

    if (this.selectedElementoId != null) {
      const el = this.elementos.find((x) => x.idGeoElemento === this.selectedElementoId);
      if (el) {
        for (const id of getAncestorNodeIds(el.idRedNodoFk, this.nodos)) {
          if (!current.has(id)) {
            current.add(id);
            changed = true;
          }
        }
        if (!current.has(el.idRedNodoFk)) {
          current.add(el.idRedNodoFk);
          changed = true;
        }
      }
    }

    if (changed) {
      this.expandedIds.set([...current]);
    }
  }

  private expandVisibleBranches() {
    const visibleIds = new Set<number>();

    const walk = (items: TreeNodeVm[]) => {
      for (const item of items) {
        visibleIds.add(item.node.idRedNodo);
        if (item.children.length) {
          walk(item.children);
        }
      }
    };

    walk(this.tree);
    this.expandedIds.set([...visibleIds]);
  }

  private matchesNode(node: MapaNodo): boolean {
    const q = this.searchValue.trim().toLowerCase();
    if (!q) return true;

    return [
      node.nodo,
      node.descripcion ?? '',
      node.codigo ?? '',
      node.tipoNodo,
    ].some((v) => (v || '').toLowerCase().includes(q));
  }

  private matchesElemento(elemento: MapaElemento): boolean {
    const q = this.searchValue.trim().toLowerCase();
    if (!q) return true;

    return this.matchesElementoWithQuery(elemento, q);
  }

  private matchesElementoWithQuery(elemento: MapaElemento, q: string): boolean {
    return [
      elemento.nombre,
      elemento.descripcion ?? '',
      elemento.codigo ?? '',
      elemento.etiqueta ?? '',
      elemento.observacion ?? '',
      elemento.estado ?? '',
    ].some((v) => (v || '').toLowerCase().includes(q));
  }

  private requestScrollSelectionIntoView() {
    if (this.pendingScrollToSelection) {
      return;
    }

    this.pendingScrollToSelection = true;

    queueMicrotask(() => {
      requestAnimationFrame(() => {
        this.pendingScrollToSelection = false;
        this.scrollSelectionIntoView();
      });
    });
  }

  private scrollSelectionIntoView() {
    const host = this.treeScroll?.nativeElement;
    if (!host) {
      return;
    }

    const selector =
      this.selectedElementoId != null
        ? `.element-row[data-element-id="${this.selectedElementoId}"]`
        : this.selectedNodoId != null
          ? `.node-row[data-node-id="${this.selectedNodoId}"]`
          : null;

    if (!selector) {
      return;
    }

    const target = host.querySelector<HTMLElement>(selector);
    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}
