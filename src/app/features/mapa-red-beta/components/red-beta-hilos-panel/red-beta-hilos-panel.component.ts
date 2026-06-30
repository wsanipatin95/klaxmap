import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import { RbScrollSelectedDirective } from '../../util/rb-scroll-selected.directive';
import type { RedFoHilo } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/** Panel 5: hilos de FO generados (supuestos ERP). */
@Component({
  selector: 'app-red-beta-hilos-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent, RbScrollSelectedDirective],
  template: `
    <div>
      <h3 class="font-semibold text-slate-700 text-xs mb-1.5">Hilos de FO ({{ items.length }})</h3>
      @if (items.length === 0) {
        <p class="text-sm text-slate-400">Sin hilos. Ejecuta "Hilos".</p>
      }
      <ul class="space-y-1 max-h-[calc(100vh-11rem)] overflow-auto pr-1">
        @for (h of items; track h.idFoHilo) {
          <li class="border rounded p-1.5 hover:bg-slate-50 cursor-pointer text-xs"
              [class.border-slate-200]="!isSel(h.idFoHilo)"
              [class.border-2]="isSel(h.idFoHilo)"
              [class.border-blue-500]="isSel(h.idFoHilo)"
              [class.bg-blue-50]="isSel(h.idFoHilo)"
              [rbScrollSelected]="isSel(h.idFoHilo)"
              (click)="seleccionar.emit({ tipo: 'hilo', data: h })">
            @if (isSel(h.idFoHilo)) { <div class="text-[10px] font-bold text-blue-600 mb-1">● Seleccionado</div> }
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-slate-700 truncate">{{ h.foNombre }}</span>
              <span class="text-xs text-slate-500 shrink-0">tubo {{ h.grupoTubo }} · hilo {{ h.numeroHilo }}</span>
            </div>
            <div class="flex items-center justify-between gap-1.5 mt-0.5">
              <span class="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span class="inline-block w-2.5 h-2.5 rounded-full border border-slate-300" [style.background]="colorCss(h.colorHilo)"></span>
                {{ h.colorHilo }}
              </span>
              <app-red-beta-estado-badge [estado]="h.estadoHilo" />
            </div>
          </li>
        }
      </ul>
    </div>
  `,
})
export class RedBetaHilosPanelComponent {
  @Input() items: RedFoHilo[] = [];
  @Input() selectedKey: string | null = null;
  isSel(id: number): boolean { return this.selectedKey === 'hilo:' + id; }
  @Output() seleccionar = new EventEmitter<RedSeleccion>();

  colorCss(color: string | null | undefined): string {
    const m: Record<string, string> = {
      Azul: '#2563eb',
      'Tomate / Naranja': '#fb923c',
      Verde: '#16a34a',
      Cafe: '#92400e',
      Gris: '#9ca3af',
      Blanco: '#f8fafc',
      Rojo: '#dc2626',
      Negro: '#111827',
      Amarillo: '#facc15',
      Violeta: '#7c3aed',
      Rosado: '#f472b6',
      'Aqua / Celeste': '#22d3ee',
    };
    return (color && m[color]) || '#e2e8f0';
  }
}
