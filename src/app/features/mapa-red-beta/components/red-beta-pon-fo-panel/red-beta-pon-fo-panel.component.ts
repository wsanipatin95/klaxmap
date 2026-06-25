import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedPonElementoRelacion } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 4: relaciones PON/VLAN -> FO sugeridas. */
@Component({
  selector: 'app-red-beta-pon-fo-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 mb-2">PON/VLAN → FO ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin relaciones PON→FO. Ejecuta "PON→FO" (requiere tablas logicas).</p>
      }
      <ul class="space-y-2 max-h-[420px] overflow-auto pr-1">
        @for (p of items; track p.idRedPonElementoRelacion) {
          <li class="border border-slate-200 rounded-md p-2 hover:bg-slate-50 cursor-pointer"
              (click)="seleccionar.emit({ tipo: 'ponfo', data: p })">
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
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
}
