import { Injectable, computed, inject } from '@angular/core';

import { MapaUiStore } from '../store/mapa-ui.store';
import { MapaSelectionStore } from '../store/mapa-selection.store';
import { MapaFiltrosStore } from '../store/mapa-filtros.store';
import { MapaCapasStore } from '../store/mapa-capas.store';
import { MapaVisibilityStore } from '../store/mapa-visibility.store';
import { MapaCrudFacade } from './mapa-crud.facade';
import { MapaInteractionFacade } from './mapa-interaction.facade';

import type { MapaElemento } from '../data-access/mapa.models';
import { getBranchElementos } from '../utils/mapa-visibility.utils';

@Injectable({ providedIn: 'root' })
export class MapaHomeViewFacade {
  private readonly ui = inject(MapaUiStore);
  private readonly selection = inject(MapaSelectionStore);
  private readonly filtros = inject(MapaFiltrosStore);
  private readonly capas = inject(MapaCapasStore);
  private readonly visibility = inject(MapaVisibilityStore);
  private readonly crud = inject(MapaCrudFacade);
  private readonly interaction = inject(MapaInteractionFacade);

  readonly elementosCanvas = computed(() => {
    const hiddenTipoIds = new Set(this.capas.hiddenTipoIds());

    return this.crud.elementos().filter((el) => {
      if (hiddenTipoIds.has(el.idGeoTipoElementoFk)) {
        return false;
      }

      return this.visibility.isElementoVisible(el, this.crud.nodos());
    });
  });

  readonly searchResultIndex = computed(() => {
    const results = this.getSearchNavigableItems();
    const selectedId = this.selection.selectedElemento()?.idGeoElemento ?? null;

    if (!results.length || selectedId == null) {
      return -1;
    }

    return results.findIndex((item) => item.idGeoElemento === selectedId);
  });

  readonly quickInfo = computed(() => {
    const q = (this.filtros.q() || '').trim();
    const nodo = this.selection.selectedNodo();
    const elemento = this.selection.selectedElemento();

    if (this.interaction.editSessionActive()) {
      return this.interaction.editSessionDirty()
        ? `Editando forma: ${this.interaction.editSessionElementName() || 'elemento'} · cambios pendientes`
        : `Editando forma: ${this.interaction.editSessionElementName() || 'elemento'}`;
    }

    if (this.ui.toolMode() === 'measure') {
      return 'Modo medición activo · haz clic para marcar puntos y doble clic para terminar';
    }

    if (this.ui.propertiesOpen()) {
      return this.interaction.infoPanelDirty()
        ? `Editando datos: ${elemento?.nombre || 'elemento'} · cambios pendientes`
        : `Editando datos: ${elemento?.nombre || 'elemento'}`;
    }

    if (this.ui.loading()) {
      return 'Actualizando mapa...';
    }

    if (q) {
      return `Búsqueda: "${q}" · ${this.elementosCanvas().length} resultado(s)`;
    }

    if (elemento) {
      return `Activo: ${elemento.nombre}`;
    }

    if (nodo) {
      return `Nodo: ${nodo.nodo}`;
    }

    return 'Selecciona o dibuja un elemento';
  });

  filterCanvasVisible(items: MapaElemento[]): MapaElemento[] {
    const hiddenTipoIds = new Set(this.capas.hiddenTipoIds());

    return items.filter((el) => {
      if (hiddenTipoIds.has(el.idGeoTipoElementoFk)) {
        return false;
      }

      return this.visibility.isElementoVisible(el, this.crud.nodos());
    });
  }

  getVisibleBranchElementos(nodeId: number, items = this.elementosCanvas()): MapaElemento[] {
    return getBranchElementos(nodeId, this.crud.nodos(), items);
  }

  centerFirstVisibleSearchResultIfNeeded(
    items: MapaElemento[],
    callbacks: {
      onSelect: (item: MapaElemento | null) => void;
      centerOnElemento: (id: number) => void;
    }
  ): boolean {
    if (!(this.filtros.q() || '').trim()) {
      return false;
    }

    const visibles = this.filterCanvasVisible(items);
    if (visibles.length === 0) {
      callbacks.onSelect(null);
      return true;
    }

    const first = visibles[0];
    callbacks.onSelect(first);
    callbacks.centerOnElemento(first.idGeoElemento);
    return true;
  }

  getNextSearchNavigationItem(direction: 1 | -1): MapaElemento | null {
    const results = this.getSearchNavigableItems();

    if (!results.length) {
      return null;
    }

    const currentId = this.selection.selectedElemento()?.idGeoElemento ?? null;
    const currentIndex =
      currentId == null
        ? -1
        : results.findIndex((item) => item.idGeoElemento === currentId);

    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : results.length - 1
        : (currentIndex + direction + results.length) % results.length;

    return results[nextIndex] ?? null;
  }

  buildExportSummary(): string {
    const parts: string[] = [];

    if ((this.filtros.q() || '').trim()) {
      parts.push(`Búsqueda: "${this.filtros.q()}"`);
    }

    const nodoId = this.filtros.idRedNodoFk();
    if (nodoId != null) {
      const nodo = this.crud.nodos().find((n) => n.idRedNodo === nodoId);
      parts.push(`Nodo: ${nodo?.nodo ?? nodoId}`);
    } else {
      parts.push('Nodo: todos');
    }

    const tipoId = this.filtros.idGeoTipoElementoFk();
    if (tipoId != null) {
      const tipo = this.crud.tipos().find((t) => t.idGeoTipoElemento === tipoId);
      parts.push(`Tipo: ${tipo?.nombre ?? tipoId}`);
    } else {
      parts.push('Tipo: todos');
    }

    const visible = this.filtros.visible();
    if (visible === true) {
      parts.push('Visibilidad: sólo visibles');
    } else if (visible === false) {
      parts.push('Visibilidad: sólo no visibles');
    } else {
      parts.push('Visibilidad: todos');
    }

    return parts.join(' · ');
  }

  private getSearchNavigableItems(): MapaElemento[] {
    if (!(this.filtros.q() || '').trim()) {
      return [];
    }

    return this.elementosCanvas();
  }
}
