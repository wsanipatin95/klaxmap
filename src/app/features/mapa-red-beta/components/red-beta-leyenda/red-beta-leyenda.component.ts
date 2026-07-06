import { Component, signal } from '@angular/core';
import { RED_ESTADOS_LEYENDA, estadoVisual } from '../../util/red-beta-estado.util';

/** Leyenda de estados (colores/trazo) y de tipos de línea, en secciones colapsables. */
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

    <div class="text-sm mt-2">
      <button class="rb-sec-hdr" (click)="openL.set(!openL())" [attr.aria-expanded]="openL()">
        <span class="rb-exp">{{ openL() ? '▾' : '▸' }}</span>
        <span>Leyenda de líneas</span>
      </button>
      @if (openL()) {
        <ul class="space-y-1.5 mt-1.5">
          <li class="flex items-center gap-2">
            <span class="inline-block w-6 border-t-4" style="border-color:#7c3aed"></span>
            <span class="text-slate-600">Cable de fibra (grosor = Nº hilos)</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block w-6 border-t-2 border-dashed" style="border-color:#2563eb"></span>
            <span class="text-slate-600">Conexión / topología (relación)</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block w-6 border-t-2" style="border-color:#22c55e"></span>
            <span class="text-slate-600">Drop a cliente · verde=libre, rojo=ocupado</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block w-4 h-4 rounded-full border-2" style="border-color:#7C0061"></span>
            <span class="text-slate-600">👥N = contratos conectados en la NAP</span>
          </li>
        </ul>
      }
    </div>

    <div class="text-sm mt-2">
      <button class="rb-sec-hdr" (click)="openE.set(!openE())" [attr.aria-expanded]="openE()">
        <span class="rb-exp">{{ openE() ? '▾' : '▸' }}</span>
        <span>Leyenda de elementos</span>
      </button>
      @if (openE()) {
        <ul class="space-y-1.5 mt-1.5">
          <li class="flex items-center gap-2">
            <span class="inline-block w-3.5 h-3.5 rounded-full" style="background:#c7d2fe;border:3px solid #4338ca"></span>
            <span class="text-slate-600">OLT / nodo</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block w-3 h-3 rounded-sm bg-white" style="border:2.5px solid #64748b"></span>
            <span class="text-slate-600">NAP / caja</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5" style="background:#ede9fe;border:2px solid #7c3aed;transform:rotate(45deg)"></span>
            <span class="text-slate-600">Splitter (rombo)</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block bg-white" style="width:16px;height:9px;border-radius:6px;border:2.5px solid #64748b"></span>
            <span class="text-slate-600">Manga (píldora)</span>
          </li>
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
  readonly openL = signal(false);
  readonly openE = signal(false);
  vis(e: string) { return estadoVisual(e); }
}
