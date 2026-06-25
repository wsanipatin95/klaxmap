import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedAccionEvento, RedElementoRelacion } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 2: relaciones NAP N1 -> NAP N2 (y demas relaciones fisicas) con acciones rapidas. */
@Component({
  selector: 'app-red-beta-relaciones-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 mb-2">Relaciones fisicas ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin relaciones. Ejecuta "Relaciones NAP".</p>
      }
      <ul class="space-y-2 max-h-[420px] overflow-auto pr-1">
        @for (r of items; track r.idRedElementoRelacion) {
          <li class="border border-slate-200 rounded-md p-2 hover:bg-slate-50 cursor-pointer"
              (click)="seleccionar.emit({ tipo: 'relacion', data: r })">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-slate-700 truncate">
                {{ r.origenNombre }} → {{ r.destinoNombre }}
              </span>
              <span class="text-xs text-slate-500 shrink-0">{{ r.confianzaIa }}%</span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-1">
              <app-red-beta-estado-badge [estado]="r.estadoRelacion" />
              <span class="text-[11px] text-slate-400 truncate">{{ r.tipoRelacion }}</span>
            </div>
            <div class="flex gap-1 mt-2">
              <button class="act ok" (click)="accion($event, 'validar-oficina', r)">Aceptar</button>
              <button class="act campo" (click)="accion($event, 'pendiente-campo', r)">A campo</button>
              <button class="act no" (click)="accion($event, 'rechazar', r)">Rechazar</button>
            </div>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `.act{font-size:.7rem;padding:.15rem .5rem;border-radius:.375rem;border:1px solid transparent;}
     .ok{background:#dcfce7;color:#166534;} .campo{background:#ffedd5;color:#9a3412;} .no{background:#fee2e2;color:#991b1b;}`,
  ],
})
export class RedBetaRelacionesPanelComponent {
  @Input() items: RedElementoRelacion[] = [];
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
  @Output() accionEmit = new EventEmitter<RedAccionEvento>();

  accion(ev: Event, kind: RedAccionEvento['kind'], r: RedElementoRelacion) {
    ev.stopPropagation();
    this.accionEmit.emit({ kind, id: r.idRedElementoRelacion });
  }
}
