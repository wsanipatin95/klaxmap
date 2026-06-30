import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import { RbScrollSelectedDirective } from '../../util/rb-scroll-selected.directive';
import type { RedPonElementoRelacion } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 4: relaciones PON/VLAN -> FO sugeridas. */
@Component({
  selector: 'app-red-beta-pon-fo-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent, RbScrollSelectedDirective],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 text-xs mb-1.5">PON/VLAN → FO ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin relaciones PON→FO. Ejecuta "PON→FO" (requiere tablas logicas).</p>
      }
      <ul class="space-y-1 max-h-[calc(100vh-11rem)] overflow-auto pr-1">
        @for (p of items; track p.idRedPonElementoRelacion) {
          <li class="border rounded p-1.5 hover:bg-slate-50 cursor-pointer text-xs"
              [class.border-slate-200]="!isSel(p.idRedPonElementoRelacion)"
              [class.border-2]="isSel(p.idRedPonElementoRelacion)"
              [class.border-blue-500]="isSel(p.idRedPonElementoRelacion)"
              [class.bg-blue-50]="isSel(p.idRedPonElementoRelacion)"
              [rbScrollSelected]="isSel(p.idRedPonElementoRelacion)"
              (click)="seleccionar.emit({ tipo: 'ponfo', data: p })">
            @if (isSel(p.idRedPonElementoRelacion)) { <div class="text-[10px] font-bold text-blue-600 mb-1">● Seleccionado</div> }
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-slate-700 truncate">VLAN {{ p.idRedVlanFk }} → {{ p.elementoNombre }}</span>
              <span class="text-xs text-slate-500 shrink-0">{{ p.confianzaIa }}%</span>
            </div>
            <div class="mt-1"><app-red-beta-estado-badge [estado]="p.estadoRelacion" /></div>
          </li>
        }
      </ul>
    </div>
  `,
})
export class RedBetaPonFoPanelComponent {
  @Input() items: RedPonElementoRelacion[] = [];
  @Input() selectedKey: string | null = null;
  isSel(id: number): boolean { return this.selectedKey === 'ponfo:' + id; }
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
}
