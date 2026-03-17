import { Injectable, signal } from '@angular/core';

export type MapaToolMode =
  | 'select'
  | 'move'
  | 'draw-point'
  | 'draw-line'
  | 'draw-polygon'
  | 'edit-geometry';

@Injectable({ providedIn: 'root' })
export class MapaUiStore {
  readonly toolMode = signal<MapaToolMode>('select');
  readonly sidebarOpen = signal(true);
  readonly propertiesOpen = signal(false);
  readonly loading = signal(false);

  setToolMode(mode: MapaToolMode) {
    this.toolMode.set(mode);
  }

  setSelectMode() {
    this.toolMode.set('select');
  }

  setEditGeometryMode() {
    this.toolMode.set('edit-geometry');
  }

  setDrawPointMode() {
    this.toolMode.set('draw-point');
  }

  setDrawLineMode() {
    this.toolMode.set('draw-line');
  }

  setDrawPolygonMode() {
    this.toolMode.set('draw-polygon');
  }

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  toggleProperties() {
    this.propertiesOpen.update((v) => !v);
  }

  openProperties() {
    this.propertiesOpen.set(true);
  }

  closeProperties() {
    this.propertiesOpen.set(false);
  }

  setLoading(v: boolean) {
    this.loading.set(v);
  }
}