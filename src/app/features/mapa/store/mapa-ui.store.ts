import { Injectable, computed, signal } from '@angular/core';

export type MapaToolMode =
  | 'select'
  | 'move'
  | 'draw-point'
  | 'draw-line'
  | 'draw-polygon'
  | 'edit-geometry'
  | 'measure';

export type MapaSidebarMode = 'expanded' | 'compact' | 'hidden';

@Injectable({ providedIn: 'root' })
export class MapaUiStore {
  readonly toolMode = signal<MapaToolMode>('select');
  readonly sidebarMode = signal<MapaSidebarMode>('expanded');
  readonly sidebarOpen = computed(() => this.sidebarMode() !== 'hidden');
  readonly sidebarCompact = computed(() => this.sidebarMode() === 'compact');
  readonly propertiesOpen = signal(false);
  readonly loading = signal(false);
  readonly deletedElementsVisible = signal(false);

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

  setMeasureMode() {
    this.toolMode.set('measure');
  }

  setSidebarMode(mode: MapaSidebarMode) {
    this.sidebarMode.set(mode);
  }

  setSidebarHidden(hidden: boolean) {
    this.sidebarMode.set(hidden ? 'hidden' : 'expanded');
  }

  toggleSidebar() {
    this.sidebarMode.update((mode) => (mode === 'hidden' ? 'expanded' : 'hidden'));
  }

  toggleSidebarCompact() {
    this.sidebarMode.update((mode) => {
      if (mode === 'hidden') {
        return 'expanded';
      }

      return mode === 'compact' ? 'expanded' : 'compact';
    });
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

  setDeletedElementsVisible(visible: boolean) {
    this.deletedElementsVisible.set(visible);
  }

  toggleDeletedElementsVisible() {
    this.deletedElementsVisible.update((value) => !value);
  }
}
