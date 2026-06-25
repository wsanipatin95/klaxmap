import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedAccionEvento, RedDispositivoPasivo } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 3: splitters supuestos, con confirmacion / cambio de ratio. */
@Component({
  selector: 'app-red-beta-splitters-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 mb-2">Splitters supuestos ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin splitters. Ejecuta "Splitters".</p>
      }
      <ul class="space-y-2 max-h-[420px] overflow-auto pr-1">
        @for (s of items; track s.idDispositivoPasivo) {
          <li class="border border-slate-200 rounded-md p-2 hover:bg-slate-50 cursor-pointer"
              (click)="seleccionar.emit({ tipo: 'splitter', data: s })">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-slate-700 truncate">{{ s.nombreOperativo }}</span>
              <span class="text-xs font-semibold text-slate-600 shrink-0">{{ s.ratioSplitter }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-1">
              <app-red-beta-estado-badge [estado]="s.estadoDispositivo" />
              <span class="text-[11px] text-slate-400 truncate">en {{ s.contenedorNombre }}</span>
            </div>
            <div class="flex gap-1 mt-2 flex-wrap">
              <button class="act ok" (click)="ratio($event, s, '1:8')">Confirmar 1:8</button>
              <button class="act alt" (click)="ratio($event, s, '1:4')">1:4</button>
              <button class="act alt" (click)="ratio($event, s, '1:16')">1:16</button>
              <button class="act no" (click)="noEncontrado($event, s)">No encontrado</button>
            </div>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `.act{font-size:.7rem;padding:.15rem .5rem;border-radius:.375rem;border:1px solid transparent;}
     .ok{background:#dcfce7;color:#166534;} .alt{background:#e0e7ff;color:#3730a3;} .no{background:#f1f5f9;color:#475569;}`,
  ],
})
export class RedBetaSplittersPanelComponent {
  @Input() items: RedDispositivoPasivo[] = [];
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
  @Output() accionEmit = new EventEmitter<RedAccionEvento>();

  ratio(ev: Event, s: RedDispositivoPasivo, r: string) {
    ev.stopPropagation();
    this.accionEmit.emit({ kind: 'confirmar-ratio', id: s.idDispositivoPasivo, ratioSplitter: r, validadoEnCampo: true });
  }
  noEncontrado(ev: Event, s: RedDispositivoPasivo) {
    ev.stopPropagation();
    this.accionEmit.emit({ kind: 'no-encontrado', id: s.idDispositivoPasivo });
  }
}
