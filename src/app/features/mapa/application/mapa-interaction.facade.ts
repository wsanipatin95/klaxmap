import { Injectable, inject, signal } from '@angular/core';
import { MapaUiStore } from '../store/mapa-ui.store';
import { MapaSelectionStore } from '../store/mapa-selection.store';
import type { MapaElemento, MapaGeomTipo, MapaNodo } from '../data-access/mapa.models';
import type { MapaEditSessionState } from '../components/mapa-canvas/mapa-canvas.component';

@Injectable({ providedIn: 'root' })
export class MapaInteractionFacade {
  private readonly ui = inject(MapaUiStore);
  private readonly selection = inject(MapaSelectionStore);

  readonly contextVisible = signal(false);
  readonly contextX = signal(0);
  readonly contextY = signal(0);
  readonly contextElemento = signal<MapaElemento | null>(null);

  readonly editSessionActive = signal(false);
  readonly editSessionDirty = signal(false);
  readonly editSessionElementId = signal<number | null>(null);
  readonly editSessionElementName = signal<string | null>(null);
  readonly editSessionGeomTipo = signal<MapaGeomTipo | null>(null);

  readonly infoPanelDirty = signal(false);

  onEditSessionStateChanged(state: MapaEditSessionState) {
    this.editSessionActive.set(state.active && !!state.elementId);
    this.editSessionDirty.set(state.active && !!state.elementId ? state.dirty : false);
    this.editSessionElementId.set(state.active ? state.elementId : null);
    this.editSessionElementName.set(state.active ? state.elementName : null);
    this.editSessionGeomTipo.set(state.active ? state.geomTipo : null);
  }

  setInfoPanelDirty(dirty: boolean) {
    this.infoPanelDirty.set(dirty);
  }

  openInfoPanelForElemento(item: MapaElemento | null, nodos: MapaNodo[]) {
    this.applyElementoSelection(item, nodos);
    this.ui.openProperties();
  }

  closeInfoPanel() {
    this.ui.closeProperties();
    this.infoPanelDirty.set(false);
  }

  hasPendingInfoChanges(): boolean {
    return this.ui.propertiesOpen() && this.infoPanelDirty();
  }

  openContextMenu(event: { elemento: MapaElemento; x: number; y: number }) {
    this.contextElemento.set(event.elemento);
    this.contextX.set(event.x);
    this.contextY.set(event.y);
    this.contextVisible.set(true);
    this.selection.setElemento(event.elemento);
  }

  closeContextMenu() {
    this.contextVisible.set(false);
  }

  resetEditSessionState() {
    this.editSessionActive.set(false);
    this.editSessionDirty.set(false);
    this.editSessionElementId.set(null);
    this.editSessionElementName.set(null);
    this.editSessionGeomTipo.set(null);
  }

  runWithPendingGuards(
    action: () => void,
    requestGeometryDiscardConfirmation: (onConfirm: () => void) => void,
    requestInfoDiscardConfirmation: (onConfirm: () => void) => void
  ) {
    if (this.hasPendingGeometryChanges()) {
      requestGeometryDiscardConfirmation(action);
      return;
    }

    if (this.hasPendingInfoChanges()) {
      requestInfoDiscardConfirmation(action);
      return;
    }

    action();
  }

  selectElementoWithPendingGuard(
    params: {
      item: MapaElemento | null;
      nodos: MapaNodo[];
      afterSelect?: () => void;
      onGeometryDiscardRequested: (onConfirm: () => void) => void;
      onInfoDiscardRequested: (onConfirm: () => void) => void;
      centerOnElemento?: (id: number | null) => void;
    }
  ) {
    const {
      item,
      nodos,
      afterSelect,
      onGeometryDiscardRequested,
      onInfoDiscardRequested,
      centerOnElemento,
    } = params;

    const currentEditId = this.editSessionElementId();
    const sameElement = item?.idGeoElemento === currentEditId;
    const sameInfoElement = item?.idGeoElemento === this.selection.selectedElemento()?.idGeoElemento;

    if (this.editSessionActive() && this.editSessionDirty() && !sameElement) {
      onGeometryDiscardRequested(() => {
        this.applyElementoSelection(item, nodos, centerOnElemento);
        afterSelect?.();
      });
      return;
    }

    if (this.hasPendingInfoChanges() && !sameInfoElement) {
      onInfoDiscardRequested(() => {
        this.applyElementoSelection(item, nodos, centerOnElemento);
        afterSelect?.();
      });
      return;
    }

    this.applyElementoSelection(item, nodos, centerOnElemento);
    afterSelect?.();
  }

  onElementoDeleted(id: number) {
    if (this.selection.selectedElemento()?.idGeoElemento === id) {
      this.selection.setElemento(null);
      this.ui.closeProperties();
      this.infoPanelDirty.set(false);
    }

    if (this.contextElemento()?.idGeoElemento === id) {
      this.closeContextMenu();
    }

    if (this.editSessionElementId() === id) {
      this.resetEditSessionState();
      this.ui.setSelectMode();
    }
  }

  private hasPendingGeometryChanges(): boolean {
    return this.editSessionActive() && this.editSessionDirty();
  }

  private applyElementoSelection(
    item: MapaElemento | null,
    nodos: MapaNodo[],
    centerOnElemento?: (id: number | null) => void
  ) {
    this.selection.setElemento(item);
    this.closeContextMenu();

    if (!item) {
      this.resetEditSessionState();
      this.ui.setSelectMode();
      return;
    }

    const nodo = nodos.find((n) => n.idRedNodo === item.idRedNodoFk) ?? null;
    if (nodo) {
      this.selection.setNodo(nodo);
    }

    if (this.ui.toolMode() === 'edit-geometry') {
      centerOnElemento?.(item.idGeoElemento);
      return;
    }

    this.ui.setSelectMode();
  }
}