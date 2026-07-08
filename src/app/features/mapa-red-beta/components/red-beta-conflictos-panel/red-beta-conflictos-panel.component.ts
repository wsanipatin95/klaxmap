import { Component, EventEmitter, Input, Output } from '@angular/core';
import type {
  RedDispositivoPasivo,
  RedDispositivoPuerto,
  RedElementoRelacion,
  RedFoHilo,
} from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

export interface RedConflictos {
  rel: RedElementoRelacion[];
  spl: RedDispositivoPasivo[];
  pue: RedDispositivoPuerto[];
  hil: RedFoHilo[];
  total: number;
}

/** Panel 7: conflictos agregados de todos los bloques. */
@Component({
  selector: 'app-red-beta-conflictos-panel',
  standalone: true,
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 mb-2">
        Conflictos <span class="text-red-600">({{ data.total }})</span>
      </h3>
      @if (data.total === 0) {
        <p class="text-sm text-slate-400">Sin conflictos detectados.</p>
      }
      <ul class="space-y-1.5 max-h-[420px] overflow-auto pr-1 text-sm">
        @for (r of data.rel; track r.idRedElementoRelacion) {
          <li class="conf" (click)="seleccionar.emit({ tipo: 'relacion', data: r })">
            Relacion: {{ r.origenNombre }} → {{ r.destinoNombre }}
          </li>
        }
        @for (s of data.spl; track s.idRedDispositivoPasivo) {
          <li class="conf" (click)="seleccionar.emit({ tipo: 'splitter', data: s })">Splitter: {{ s.nombreOperativo }}</li>
        }
        @for (p of data.pue; track p.idRedDispositivoPuerto) {
          <li class="conf" (click)="seleccionar.emit({ tipo: 'puerto', data: p })">Puerto: {{ p.dispositivoNombre }} · {{ p.nombrePuerto }}</li>
        }
        @for (h of data.hil; track h.idRedFoHilo) {
          <li class="conf" (click)="seleccionar.emit({ tipo: 'hilo', data: h })">Hilo: {{ h.foNombre }} #{{ h.numeroHilo }}</li>
        }
      </ul>
    </div>
  `,
  styles: [
    `.conf{border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:.375rem;padding:.35rem .5rem;cursor:pointer;}
     .conf:hover{background:#fee2e2;}`,
  ],
})
export class RedBetaConflictosPanelComponent {
  @Input() data: RedConflictos = { rel: [], spl: [], pue: [], hil: [], total: 0 };
  @Output() seleccionar = new EventEmitter<RedSeleccion>();
}
