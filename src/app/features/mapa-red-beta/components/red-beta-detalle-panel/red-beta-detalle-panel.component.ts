import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedAccionEvento, RedElementoRelacion } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/**
 * Panel de detalle / explicacion. Responde: que encontro el sistema, por que, confianza,
 * que falta, que accion tomar y que pasa despues. Ademas lista las CONEXIONES del elemento
 * seleccionado (relaciones que lo tocan), cada una navegable.
 */
@Component({
  selector: 'app-red-beta-detalle-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    @if (!seleccion) {
      <p class="text-sm text-slate-400">Toca un elemento en el mapa o en un panel para ver su explicacion, sus conexiones y las acciones.</p>
    } @else {
      <div class="space-y-3 text-sm">
        <div>
          <div class="text-xs uppercase tracking-wide text-slate-400">Que encontro el sistema</div>
          <div class="font-medium text-slate-800">{{ titulo() }}</div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          @if (esBase()) {
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-slate-300 text-slate-600">
              {{ d().tipoCodigo || d().geomTipo || 'Elemento' }}
            </span>
          } @else {
            <app-red-beta-estado-badge [estado]="estado()" />
          }
          @if (confianza() !== null) {
            <span class="text-xs text-slate-500">Confianza: <b>{{ confianza() }}%</b></span>
          }
        </div>

        <div>
          <div class="text-xs uppercase tracking-wide text-slate-400">Por que lo propuso</div>
          <p class="text-slate-600">{{ motivo() }}</p>
        </div>

        @if (conexiones.length > 0) {
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Conexiones ({{ conexiones.length }})</div>
            <ul class="space-y-1 max-h-44 overflow-auto pr-1">
              @for (c of conexiones; track c.idRedElementoRelacion) {
                <li class="flex items-center justify-between gap-2 border border-slate-100 rounded px-2 py-1 cursor-pointer hover:bg-slate-50"
                    (click)="irA.emit({ tipo: 'relacion', data: c })">
                  <span class="truncate text-slate-700">{{ c.origenNombre }} → {{ c.destinoNombre }}</span>
                  <app-red-beta-estado-badge [estado]="c.estadoRelacion" />
                </li>
              }
            </ul>
          </div>
        } @else if (!esBase()) {
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400">Que falta validar</div>
            <p class="text-slate-600">{{ queFalta() }}</p>
          </div>
        }

        @if (accionable()) {
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Observacion (opcional)</div>
            <textarea class="w-full border border-slate-300 rounded-md p-2 text-sm" rows="2" placeholder="Nota del usuario..."
              [value]="obs()" (input)="obs.set($any($event.target).value)"></textarea>
          </div>

          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Que accion tomar</div>
            @if (seleccion.tipo === 'relacion') {
              <div class="flex flex-wrap gap-1.5">
                <button class="b ok" (click)="emit('validar-oficina')">Validar oficina</button>
                <button class="b ok2" (click)="emit('validar-campo')">Validar campo</button>
                <button class="b campo" (click)="emit('pendiente-campo')">Mandar a campo</button>
                <button class="b no" (click)="emit('rechazar')">Rechazar</button>
              </div>
            }
            @if (seleccion.tipo === 'splitter') {
              <div class="flex flex-wrap gap-1.5">
                <button class="b ok" (click)="emitRatio('1:8')">Confirmar 1:8</button>
                <button class="b alt" (click)="emitRatio('1:4')">Cambiar a 1:4</button>
                <button class="b alt" (click)="emitRatio('1:16')">Cambiar a 1:16</button>
                <button class="b campo" (click)="emit('no-encontrado')">Marcar no encontrado</button>
              </div>
            }
          </div>

          <div class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
            <b>Que pasa despues:</b> {{ quePasa() }}
          </div>
        }
      </div>
    }
  `,
  styles: [
    `.b{font-size:.72rem;padding:.25rem .6rem;border-radius:.375rem;border:1px solid transparent;}
     .ok{background:#dcfce7;color:#166534;} .ok2{background:#bbf7d0;color:#14532d;}
     .alt{background:#e0e7ff;color:#3730a3;} .campo{background:#ffedd5;color:#9a3412;} .no{background:#fee2e2;color:#991b1b;}`,
  ],
})
export class RedBetaDetallePanelComponent {
  private _sel = signal<RedSeleccion | null>(null);
  @Input() set seleccionInput(v: RedSeleccion | null) {
    this._sel.set(v);
    this.obs.set('');
  }
  get seleccion(): RedSeleccion | null {
    return this._sel();
  }

  @Input() conexiones: RedElementoRelacion[] = [];

  @Output() accionEmit = new EventEmitter<RedAccionEvento>();
  @Output() irA = new EventEmitter<RedSeleccion>();

  readonly obs = signal('');

  readonly accionable = computed(() => {
    const t = this._sel()?.tipo;
    return t === 'relacion' || t === 'splitter';
  });

  esBase(): boolean {
    return this._sel()?.tipo === 'base';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d(): any {
    return this._sel()?.data ?? {};
  }

  titulo(): string {
    const s = this._sel();
    if (!s) return '';
    const d = this.d();
    switch (s.tipo) {
      case 'base': return 'Elemento ' + (d.etiqueta || d.nombre || '');
      case 'relacion': return 'Relacion ' + d.tipoRelacion + ': ' + d.origenNombre + ' -> ' + d.destinoNombre;
      case 'splitter': return 'Splitter ' + d.nombreOperativo + ' (' + d.ratioSplitter + ') en ' + d.contenedorNombre;
      case 'ponfo': return 'PON/VLAN ' + d.idRedVlanFk + ' -> ' + d.elementoNombre;
      case 'hilo': return 'Hilo ' + d.numeroHilo + ' (' + d.colorHilo + ') de ' + d.foNombre;
      case 'puerto': return 'Puerto ' + d.nombrePuerto + ' de ' + d.dispositivoNombre;
      default: return '';
    }
  }

  estado(): string {
    const s = this._sel();
    const d = this.d();
    switch (s?.tipo) {
      case 'relacion':
      case 'ponfo': return d.estadoRelacion;
      case 'splitter': return d.estadoDispositivo;
      case 'hilo': return d.estadoHilo;
      case 'puerto': return d.estadoPuerto;
      default: return '';
    }
  }

  confianza(): number | null {
    const d = this.d();
    return typeof d.confianzaIa === 'number' ? d.confianzaIa : null;
  }

  motivo(): string {
    const s = this._sel();
    if (s?.tipo === 'base') {
      return 'Elemento fisico del mapa. Toca una de sus conexiones para revisarla o validarla.';
    }
    const d = this.d();
    const p = d.payloadSugerencia as Record<string, unknown> | undefined;
    const m = p && typeof p['motivo'] === 'string' ? (p['motivo'] as string) : null;
    if (m) return m;
    if (d.observacion) return d.observacion as string;
    return 'Sugerencia generada por el cursor/IA segun carpeta, prefijo, tipo o cercania.';
  }

  queFalta(): string {
    const e = this.estado();
    if (e === 'Conflicto') return 'Resolver el conflicto: revisar contra campo o corregir el dato.';
    if (e && e.startsWith('Validado')) return 'Nada: ya esta validado. Puede re-validarse en campo si cambia.';
    return 'Confirmar en oficina o en campo. Mientras tanto es un supuesto, no un dato verificado.';
  }

  quePasa(): string {
    const t = this._sel()?.tipo;
    if (t === 'relacion')
      return 'Al validar, la relacion pasa a validado (verde) y deja de ser sugerencia. Al rechazar queda marcada como rechazada (gris) sin borrarse.';
    if (t === 'splitter')
      return 'Al confirmar el ratio se ajustan los puertos: se crean las salidas faltantes y las sobrantes libres se anulan (las ocupadas pasan a conflicto). Nunca se borran puertos con uso.';
    return '';
  }

  private id(): number {
    const s = this._sel();
    const d = this.d();
    return s?.tipo === 'splitter' ? d.idDispositivoPasivo : d.idRedElementoRelacion;
  }

  emit(kind: RedAccionEvento['kind']): void {
    this.accionEmit.emit({ kind, id: this.id(), observacion: this.obs() || undefined });
  }

  emitRatio(ratio: string): void {
    this.accionEmit.emit({ kind: 'confirmar-ratio', id: this.id(), ratioSplitter: ratio, validadoEnCampo: true, observacion: this.obs() || undefined });
  }
}
