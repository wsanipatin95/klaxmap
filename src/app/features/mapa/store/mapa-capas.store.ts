import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MapaCapasStore {
  private readonly _hiddenTipoIds = signal<number[]>([]);

  readonly hiddenTipoIds = computed(() => this._hiddenTipoIds());
  readonly hiddenTipoIdSet = computed(() => new Set(this._hiddenTipoIds()));

  isVisible(tipoId: number): boolean {
    return !this._hiddenTipoIds().includes(tipoId);
  }

  setVisible(tipoId: number, visible: boolean) {
    const current = this._hiddenTipoIds();
    if (visible) {
      this._hiddenTipoIds.set(current.filter((x) => x !== tipoId));
    } else if (!current.includes(tipoId)) {
      this._hiddenTipoIds.set([...current, tipoId]);
    }
  }

  toggle(tipoId: number) {
    this.setVisible(tipoId, !this.isVisible(tipoId));
  }

  reset() {
    this._hiddenTipoIds.set([]);
  }
}