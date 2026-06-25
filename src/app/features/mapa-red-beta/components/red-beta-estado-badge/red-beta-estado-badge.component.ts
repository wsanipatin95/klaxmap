import { Component, Input, computed, signal } from '@angular/core';
import { estadoVisual } from '../../util/red-beta-estado.util';

/** Chip de estado con el color exacto de la leyenda. */
@Component({
  selector: 'app-red-beta-estado-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
      [style.borderColor]="vis().color"
      [style.color]="vis().color"
      [class.line-through]="vis().strike"
      [class.opacity-60]="vis().strike"
    >
      <span class="inline-block w-2 h-2 rounded-full" [style.background]="vis().color"></span>
      {{ estado || 'Desconocido' }}
    </span>
  `,
})
export class RedBetaEstadoBadgeComponent {
  private _estado = signal<string | null | undefined>(null);
  @Input() set estado(v: string | null | undefined) {
    this._estado.set(v);
  }
  get estado() {
    return this._estado();
  }
  readonly vis = computed(() => estadoVisual(this._estado()));
}
