import { Component } from '@angular/core';
import { RED_ESTADOS_LEYENDA, estadoVisual } from '../../util/red-beta-estado.util';

/** Leyenda de estados visuales (colores y trazo). */
@Component({
  selector: 'app-red-beta-leyenda',
  standalone: true,
  template: `
    <div class="text-sm">
      <h3 class="font-semibold text-slate-700 mb-2">Leyenda de estados</h3>
      <ul class="space-y-1.5">
        @for (e of estados; track e) {
          <li class="flex items-center gap-2">
            @if (vis(e).dashed) {
              <span class="inline-block w-6 border-t-2 border-dashed" [style.borderColor]="vis(e).color"></span>
            } @else {
              <span class="inline-block w-6 border-t-4" [style.borderColor]="vis(e).color"></span>
            }
            <span class="text-slate-600" [class.line-through]="vis(e).strike">{{ e }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class RedBetaLeyendaComponent {
  readonly estados = RED_ESTADOS_LEYENDA;
  vis(e: string) {
    return estadoVisual(e);
  }
}
