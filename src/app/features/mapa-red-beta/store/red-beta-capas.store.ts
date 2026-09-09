import { Injectable, computed, signal } from '@angular/core';
import type { RedCapaKey } from '../data-access/red-beta.models';

export interface RedCapaDef {
  key: RedCapaKey;
  label: string;
}

/** Definicion ordenada de las capas de la beta. */
export const RED_CAPAS: RedCapaDef[] = [
  { key: 'base', label: 'Mapa fisico base' },
  { key: 'relSugeridas', label: 'Relaciones fisicas sugeridas' },
  { key: 'relValidadas', label: 'Relaciones fisicas validadas' },
  { key: 'splitters', label: 'Splitters supuestos' },
  { key: 'hilos', label: 'Hilos de FO' },
  { key: 'puertos', label: 'Puertos de splitter' },
  { key: 'ponFo', label: 'PON/VLAN -> FO' },
  { key: 'conflictos', label: 'Conflictos' },
  { key: 'pendienteCampo', label: 'Pendiente campo' },
  { key: 'cobertura', label: 'Cobertura clientes' },
];

/**
 * Estado de visibilidad de capas de la beta. La capa de cobertura arranca OCULTA
 * (es una vista comercial/operativa aparte); el resto visibles por defecto.
 */
@Injectable()
export class RedBetaCapasStore {
  private readonly _ocultas = signal<Set<RedCapaKey>>(new Set<RedCapaKey>(['cobertura']));

  readonly ocultas = computed(() => this._ocultas());

  isVisible(key: RedCapaKey): boolean {
    return !this._ocultas().has(key);
  }

  toggle(key: RedCapaKey) {
    const next = new Set(this._ocultas());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._ocultas.set(next);
  }

  reset() {
    this._ocultas.set(new Set<RedCapaKey>(['cobertura']));
  }
}
