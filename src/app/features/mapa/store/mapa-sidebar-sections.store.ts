import { Injectable, signal } from '@angular/core';

export type MapaSidebarSectionKey = 'capas' | 'lotes';

@Injectable({ providedIn: 'root' })
export class MapaSidebarSectionsStore {
  readonly state = signal<Record<MapaSidebarSectionKey, boolean>>({
    capas: false,
    lotes: false,
  });

  isExpanded(key: MapaSidebarSectionKey): boolean {
    return !!this.state()[key];
  }

  toggle(key: MapaSidebarSectionKey) {
    this.state.update((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  setExpanded(key: MapaSidebarSectionKey, expanded: boolean) {
    this.state.update((current) => ({
      ...current,
      [key]: expanded,
    }));
  }
}