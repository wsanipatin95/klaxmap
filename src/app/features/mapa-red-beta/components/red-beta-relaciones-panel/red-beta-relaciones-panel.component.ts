import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import { RbScrollSelectedDirective } from '../../util/rb-scroll-selected.directive';
import type { RedAccionEvento, RedElementoRelacion } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 2: relaciones NAP N1 -> NAP N2 (y demas relaciones fisicas) con acciones rapidas. */
@Component({
  selector: 'app-red-beta-relaciones-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent, RbScrollSelectedDirective],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 text-xs mb-1.5">Relaciones fisicas ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin relaciones. Ejecuta "Relaciones NAP".</p>
      }
      <ul class="space-y-1 max-h-[calc(100vh-11rem)] overflow-auto pr-1">
        @for (r of items; track r.idRedElementoRelacion) {
          <li class="border rounded p-1.5 hover:bg-slate-50 cursor-pointer text-xs"
              [class.border-slate-200]="!isSel(r.idRedElementoRelacion)"
              [class.border-2]="isSel(r.idRedElementoRelacion)"
              [class.border-blue-500]="isSel(r.idRedElementoRelacion)"
              [class.bg-blue-50]="isSel(r.idRedElementoRelacion)"
              [rbScrollSelected]="isSel(r.idRedElementoRelacion)"
              (click)="seleccionar.emit({ tipo: 'relacion', data: r })">
            @if (isSel(r.idRedElementoRelacion)) {
              <div class="text-[10px] font-bold text-blue-600 mb-1">● Seleccionado</div>
            }
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-slate-700 truncate">{{ r.origenNombre }} → {{ r.destinoNombre }}</span>
              <span class="text-xs text-slate-500 shrink-0">{{ r.confianzaIa }}%</span>
            </div>
            <div class="flex items-center justify-between gap-1.5 mt-0.5">
              <app-red-beta-estado-badge [estado]="r.estadoRelacion" />
              <span class="text-[11px] text-slate-400 truncate">{{ r.tipoRelacion }}</span>
            </div>
            <div class="flex gap-1 mt-1.5">
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
  @Input() selectedKey: string | null = null;
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
  @Output() accionEmit = new EventEmitter<RedAccionEvento>();

  isSel(id: number): boolean { return this.selectedKey === 'relacion:' + id; }

  accion(ev: Event, kind: RedAccionEvento['kind'], r: RedElementoRelacion) {
    ev.stopPropagation();
    this.accionEmit.emit({ kind, id: r.idRedElementoRelacion });
  }
}
