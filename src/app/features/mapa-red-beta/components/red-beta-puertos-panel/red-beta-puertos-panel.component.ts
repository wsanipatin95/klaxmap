import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import { RbScrollSelectedDirective } from '../../util/rb-scroll-selected.directive';
import type { RedDispositivoPuerto } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 6: puertos de splitter. */
@Component({
  selector: 'app-red-beta-puertos-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent, RbScrollSelectedDirective],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 text-xs mb-1.5">Puertos de splitter ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin puertos. Ejecuta "Puertos".</p>
      }
      <ul class="space-y-1 max-h-[calc(100vh-11rem)] overflow-auto pr-1">
        @for (p of items; track p.idDispositivoPuerto) {
          <li class="border rounded p-1.5 hover:bg-slate-50 cursor-pointer text-xs"
              [class.border-slate-200]="!isSel(p.idDispositivoPuerto)"
              [class.border-2]="isSel(p.idDispositivoPuerto)"
              [class.border-blue-500]="isSel(p.idDispositivoPuerto)"
              [class.bg-blue-50]="isSel(p.idDispositivoPuerto)"
              [rbScrollSelected]="isSel(p.idDispositivoPuerto)"
              (click)="seleccionar.emit({ tipo: 'puerto', data: p })">
            @if (isSel(p.idDispositivoPuerto)) { <div class="text-[10px] font-bold text-blue-600 mb-1">● Seleccionado</div> }
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-slate-700 truncate">{{ p.dispositivoNombre }} · {{ p.nombrePuerto }}</span>
              <span class="text-xs text-slate-500 shrink-0">{{ p.tipoPuerto }}</span>
            </div>
            <div class="flex items-center justify-between gap-1.5 mt-0.5">
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
  @Input() selectedKey: string | null = null;
  isSel(id: number): boolean { return this.selectedKey === 'puerto:' + id; }
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
}
