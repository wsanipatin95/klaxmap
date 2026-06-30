import { Component, EventEmitter, Input, Output } from '@angular/core';

export type RedProcesoKind = 'nap' | 'splitters' | 'puertos' | 'hilos' | 'ponfo';

/** Acciones como botones-icono con tooltip (recarga y procesos kxfp_). Sin titulo: va en la barra del mapa. */
@Component({
  selector: 'app-red-beta-toolbar',
  standalone: true,
  template: `
    <div class="flex items-center gap-1.5">
      <button class="ic ic-primary" [disabled]="loading" (click)="recargar.emit()"
              [title]="loading ? 'Cargando datos...' : 'Recargar datos'" aria-label="Recargar">
        <span class="leading-none" [class.spin]="loading">&#8635;</span>
      </button>
      <div class="h-5 w-px bg-slate-200 mx-0.5"></div>
      <span class="text-[10px] text-slate-400 mr-0.5">Procesos</span>
      <button class="ic" (click)="proceso.emit('nap')" title="Proceso: generar Relaciones NAP" aria-label="Relaciones NAP">&#8644;</button>
      <button class="ic" (click)="proceso.emit('splitters')" title="Proceso: generar Splitters" aria-label="Splitters">&#9094;</button>
      <button class="ic" (click)="proceso.emit('puertos')" title="Proceso: generar Puertos" aria-label="Puertos">&#9638;</button>
      <button class="ic" (click)="proceso.emit('hilos')" title="Proceso: generar Hilos" aria-label="Hilos">&#12316;</button>
      <button class="ic" (click)="proceso.emit('ponfo')" title="Proceso: generar PON&#8594;FO" aria-label="PON a FO">&#9673;</button>
    </div>
  `,
  styles: [
    `.ic{width:1.85rem;height:1.85rem;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;line-height:1;border-radius:.5rem;border:1px solid #cbd5e1;color:#475569;background:#fff;cursor:pointer;transition:all .12s;}
     .ic:hover{background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;}
     .ic:disabled{opacity:.5;cursor:default;}
     .ic-primary{background:#2563eb;border-color:#2563eb;color:#fff;font-size:1.15rem;}
     .ic-primary:hover{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}
     .spin{display:inline-block;animation:rb-spin 0.9s linear infinite;}
     @keyframes rb-spin{to{transform:rotate(360deg);}}`,
  ],
})
export class RedBetaToolbarComponent {
  @Input() loading = false;
  @Output() recargar = new EventEmitter<void>();
  @Output() proceso = new EventEmitter<RedProcesoKind>();
}
