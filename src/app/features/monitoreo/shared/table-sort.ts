import { signal } from '@angular/core';

export type SortDir = 1 | -1;

/**
 * Ordenamiento reutilizable de tablas. Cada componente crea un TableSort con los
 * "getters" de sus columnas y usa: sort.by(key) en la cabecera, sort.arrow(key) para
 * la flecha, y sort.apply(lista) para ordenar. Los null van siempre al final.
 */
export class TableSort<T> {
  key = signal('');
  dir = signal<SortDir>(1);

  constructor(private getters: Record<string, (o: T) => any>, initialKey = '', initialDir: SortDir = 1) {
    this.key.set(initialKey);
    this.dir.set(initialDir);
  }

  by(k: string) {
    if (this.key() === k) this.dir.set(this.dir() === 1 ? -1 : 1);
    else { this.key.set(k); this.dir.set(1); }
  }

  arrow(k: string): string {
    if (this.key() !== k) return '';
    return this.dir() === 1 ? ' ▲' : ' ▼';
  }

  apply(list: T[]): T[] {
    const g = this.getters[this.key()];
    if (!g) return list;
    const d = this.dir();
    return [...list].sort((a, b) => {
      const va = g(a), vb = g(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;    // null siempre al final
      if (vb == null) return -1;
      const r = (typeof va === 'number' && typeof vb === 'number')
        ? va - vb
        : String(va).localeCompare(String(vb));
      return r * d;
    });
  }
}
