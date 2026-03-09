
import { Injectable, signal } from '@angular/core';
import type { MapaElemento, MapaNodo, MapaTipoElemento } from '../data-access/mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaSelectionStore {
  readonly selectedElemento = signal<MapaElemento | null>(null);
  readonly selectedNodo = signal<MapaNodo | null>(null);
  readonly selectedTipo = signal<MapaTipoElemento | null>(null);

  setElemento(item: MapaElemento | null) {
    this.selectedElemento.set(item);
  }

  setNodo(item: MapaNodo | null) {
    this.selectedNodo.set(item);
  }

  setTipo(item: MapaTipoElemento | null) {
    this.selectedTipo.set(item);
  }

  clearAll() {
    this.selectedElemento.set(null);
    this.selectedNodo.set(null);
    this.selectedTipo.set(null);
  }
}