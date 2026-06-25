import { Component, EventEmitter, Input, Output } from '@angular/core';

export type RedProcesoKind = 'nap' | 'splitters' | 'puertos' | 'hilos' | 'ponfo';

/** Barra superior: titulo, recarga y disparo de procesos (cursores kxfp_). */
@Component({
  selector: 'app-red-beta-toolbar',
  standalone: true,
  template: `
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-lg font-bold text-slate-800">Red operativa <span class="text-blue-600">(beta)</span></h1>
        <p class="text-xs text-slate-500">Auditoria inteligente de red sobre el mapa fisico. Todo lo automatico es sugerido o pendiente.</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button
          class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          [disabled]="loading"
          (click)="recargar.emit()"
        >
          {{ loading ? 'Cargando...' : 'Recargar' }}
        </button>
        <div class="h-6 w-px bg-slate-200"></div>
        <span class="text-xs text-slate-500">Procesos:</span>
        <button class="proc" (click)="proceso.emit('nap')">Relaciones NAP</button>
        <button class="proc" (click)="proceso.emit('splitters')">Splitters</button>
        <button class="proc" (click)="proceso.emit('puertos')">Puertos</button>
        <button class="proc" (click)="proceso.emit('hilos')">Hilos</button>
        <button class="proc" (click)="proceso.emit('ponfo')">PON→FO</button>
      </div>
    </div>
  `,
  styles: [
    `.proc{font-size:.75rem;padding:.25rem .5rem;border-radius:.375rem;border:1px solid #cbd5e1;color:#475569;}
     .proc:hover{background:#f1f5f9;}`,
  ],
})
export class RedBetaToolbarComponent {
  @Input() loading = false;
  @Output() recargar = new EventEmitter<void>();
  @Output() proceso = new EventEmitter<RedProcesoKind>();
}
