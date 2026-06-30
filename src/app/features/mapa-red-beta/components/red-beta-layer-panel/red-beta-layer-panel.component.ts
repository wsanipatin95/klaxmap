import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RED_CAPAS } from '../../store/red-beta-capas.store';
import type { RedCapaKey } from '../../data-access/red-beta.models';

/** Panel de visibilidad de capas, en seccion colapsable. */
@Component({
  selector: 'app-red-beta-layer-panel',
  standalone: true,
  template: `
    <div class="text-sm">
      <button class="rb-sec-hdr" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        <span class="rb-exp">{{ open() ? '▾' : '▸' }}</span>
        <span>Capas</span>
        <span class="ml-auto text-[10px] text-slate-400">{{ visiblesCount() }}/{{ capas.length }}</span>
      </button>
      @if (open()) {
        <ul class="space-y-1 mt-1.5">
          @for (c of capas; track c.key) {
            <li>
              <label class="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900">
                <input type="checkbox" class="accent-blue-600" [checked]="!hidden.has(c.key)" (change)="toggle.emit(c.key)" />
                {{ c.label }}
              </label>
            </li>
          }
        </ul>
        <p class="mt-2 text-[11px] text-slate-400">Hilos y puertos se gestionan en sus paneles (no tienen coordenada propia).</p>
      }
    </div>
  `,
  styles: [
    `.rb-sec-hdr{display:flex;align-items:center;gap:.4rem;width:100%;font-weight:600;color:#334155;cursor:pointer;background:none;border:none;padding:.15rem 0;}
     .rb-sec-hdr:hover{color:#1d4ed8;}
     .rb-exp{font-size:.7rem;width:.8rem;display:inline-block;}`,
  ],
})
export class RedBetaLayerPanelComponent {
  readonly capas = RED_CAPAS;
  readonly open = signal(true);
  @Input() hidden: Set<RedCapaKey> = new Set();
  @Output() toggle = new EventEmitter<RedCapaKey>();
  visiblesCount(): number { return this.capas.filter((c) => !this.hidden.has(c.key)).length; }
}
