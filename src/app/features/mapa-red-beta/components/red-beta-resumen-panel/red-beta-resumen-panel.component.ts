import { Component, Input } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedResumenItem } from '../../data-access/red-beta.models';

/** Panel 1: resumen operativo por bloque y estado. */
@Component({
  selector: 'app-red-beta-resumen-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 mb-2">Resumen operativo</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin datos. Ejecuta los procesos o revisa que el SQL haya poblado las vistas.</p>
      } @else {
        @for (g of grupos(); track g.bloque) {
          <div class="mb-3">
            <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">{{ etiquetaBloque(g.bloque) }}</div>
            <ul class="space-y-1">
              @for (it of g.items; track it.estado) {
                <li class="flex items-center justify-between text-sm">
                  <app-red-beta-estado-badge [estado]="it.estado" />
                  <span class="font-semibold text-slate-700">{{ it.total }}</span>
                </li>
              }
            </ul>
          </div>
        }
      }
    </div>
  `,
})
export class RedBetaResumenPanelComponent {
  @Input() items: RedResumenItem[] = [];

  grupos() {
    const map = new Map<string, RedResumenItem[]>();
    for (const it of this.items) {
      const arr = map.get(it.bloque) ?? [];
      arr.push(it);
      map.set(it.bloque, arr);
    }
    return Array.from(map.entries()).map(([bloque, items]) => ({ bloque, items }));
  }

  etiquetaBloque(b: string): string {
    const m: Record<string, string> = {
      relaciones_fisicas: 'Relaciones fisicas',
      splitters: 'Splitters',
      hilos: 'Hilos de FO',
      puertos: 'Puertos',
      pon_fo: 'PON/VLAN -> FO',
    };
    return m[b] ?? b;
  }
}
