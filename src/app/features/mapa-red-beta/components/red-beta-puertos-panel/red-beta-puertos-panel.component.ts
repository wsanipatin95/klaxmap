import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedDispositivoPuerto } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 6: puertos de splitter. */
@Component({
  selector: 'app-red-beta-puertos-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 mb-2">Puertos de splitter ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin puertos. Ejecuta "Puertos".</p>
      }
      <ul class="space-y-1.5 max-h-[420px] overflow-auto pr-1">
        @for (p of items; track p.idDispositivoPuerto) {
          <li class="border border-slate-200 rounded-md p-2 hover:bg-slate-50 cursor-pointer text-sm"
              (click)="seleccionar.emit({ tipo: 'puerto', data: p })">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-slate-700 truncate">{{ p.dispositivoNombre }} · {{ p.nombrePuerto }}</span>
              <span class="text-xs text-slate-500 shrink-0">{{ p.tipoPuerto }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-1">
              <app-red-beta-estado-badge [estado]="p.estadoPuerto" />
              @if (p.colorHilo) {
                <span class="text-[11px] text-slate-400">hilo {{ p.numeroHilo }} {{ p.colorHilo }}</span>
              }
            </div>
          </li>
        }
      </ul>
    </div>
  `,
})
export class RedBetaPuertosPanelComponent {
  @Input() items: RedDispositivoPuerto[] = [];
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
}
