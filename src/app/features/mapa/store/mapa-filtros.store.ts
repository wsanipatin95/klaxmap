import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MapaFiltrosStore {
  readonly q = signal('');
  readonly idRedNodoFk = signal<number | null>(null);
  readonly idGeoTipoElementoFk = signal<number | null>(null);
  readonly visible = signal<boolean | null>(true);

  setQ(v: string) {
    this.q.set(v);
  }

  setNodo(v: number | null) {
    this.idRedNodoFk.set(v);
  }

  setTipo(v: number | null) {
    this.idGeoTipoElementoFk.set(v);
  }

  setVisible(v: boolean | null) {
    this.visible.set(v);
  }

  reset() {
    this.q.set('');
    this.idRedNodoFk.set(null);
    this.idGeoTipoElementoFk.set(null);
    this.visible.set(true);
  }
}