import { Component, signal } from '@angular/core';
import { RED_ESTADOS_LEYENDA, estadoVisual } from '../../util/red-beta-estado.util';

/** Leyenda de estados visuales (colores y trazo), en seccion colapsable. */
@Component({
  selector: 'app-red-beta-leyenda',
  standalone: true,
  template: `
    <div class="text-sm">
      <button class="rb-sec-hdr" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        <span class="rb-exp">{{ open() ? '▾' : '▸' }}</span>
        <span>Leyenda de estados</span>
      </button>
      @if (open()) {
        <ul class="space-y-1.5 mt-1.5">
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
      }
    </div>
  `,
  styles: [
    `.rb-sec-hdr{display:flex;align-items:center;gap:.4rem;width:100%;font-weight:600;color:#334155;cursor:pointer;background:none;border:none;padding:.15rem 0;}
     .rb-sec-hdr:hover{color:#1d4ed8;}
     .rb-exp{font-size:.7rem;width:.8rem;display:inline-block;}`,
  ],
})
export class RedBetaLeyendaComponent {
  readonly estados = RED_ESTADOS_LEYENDA;
  readonly open = signal(false);
  vis(e: string) { return estadoVisual(e); }
}
