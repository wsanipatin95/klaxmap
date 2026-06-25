import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RED_CAPAS } from '../../store/red-beta-capas.store';
import type { RedCapaKey } from '../../data-access/red-beta.models';

/** Panel de control de visibilidad de las 9 capas. */
@Component({
  selector: 'app-red-beta-layer-panel',
  standalone: true,
  template: `
    <div class="text-sm">
      <h3 class="font-semibold text-slate-700 mb-2">Capas</h3>
      <ul class="space-y-1">
        @for (c of capas; track c.key) {
          <li>
            <label class="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900">
              <input
                type="checkbox"
                class="accent-blue-600"
                [checked]="!hidden.has(c.key)"
                (change)="toggle.emit(c.key)"
              />
              {{ c.label }}
            </label>
          </li>
        }
      </ul>
      <p class="mt-2 text-xs text-slate-400">Hilos y puertos se gestionan en sus paneles (no tienen coordenada propia).</p>
    </div>
  `,
})
export class RedBetaLayerPanelComponent {
  readonly capas = RED_CAPAS;
  @Input() hidden: Set<RedCapaKey> = new Set();
  @Output() toggle = new EventEmitter<RedCapaKey>();
}
