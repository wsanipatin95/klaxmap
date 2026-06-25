import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { RedProcesoKind } from '../red-beta-toolbar/red-beta-toolbar.component';

export interface RedProcesoParams {
  idRedNodo?: number;
  minConfianza?: number;
  radioM?: number;
  idDispositivoPasivo?: number;
  idGeoElementoFo?: number;
}

/**
 * Modal de confirmacion antes de ejecutar un proceso/cursor kxfp_.
 * Muestra alcance, parametros y la advertencia obligatoria de que nada queda validado.
 */
@Component({
  selector: 'app-red-beta-proceso-dialog',
  standalone: true,
  template: `
    @if (kind) {
      <div class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" (click)="cancelar.emit()">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-4" (click)="$event.stopPropagation()">
          <h3 class="text-base font-semibold text-slate-800 mb-1">{{ titulo() }}</h3>
          <p class="text-xs text-slate-500 mb-3">{{ subtitulo() }}</p>

          <div class="space-y-3 text-sm">
            @if (kind === 'nap') {
              <div>
                <label class="block text-xs text-slate-500 mb-1">Nodo / carpeta (id) — vacio = toda la red</label>
                <input type="number" class="in" [value]="idRedNodo() ?? ''" (input)="idRedNodo.set(num($event))" placeholder="Toda la red" />
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">Confianza minima</label>
                <input type="number" class="in" [value]="minConfianza()" (input)="minConfianza.set(num($event) ?? 70)" />
              </div>
            }
            @if (kind === 'splitters') {
              <div>
                <label class="block text-xs text-slate-500 mb-1">Radio (metros)</label>
                <input type="number" class="in" [value]="radioM()" (input)="radioM.set(num($event) ?? 10)" />
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">Confianza minima</label>
                <input type="number" class="in" [value]="minConfianza()" (input)="minConfianza.set(num($event) ?? 65)" />
              </div>
            }
            @if (kind === 'puertos') {
              <div>
                <label class="block text-xs text-slate-500 mb-1">Splitter (id) — vacio = todos sin puertos</label>
                <input type="number" class="in" [value]="idDispositivoPasivo() ?? ''" (input)="idDispositivoPasivo.set(num($event))" placeholder="Todos" />
              </div>
            }
            @if (kind === 'hilos') {
              <div>
                <label class="block text-xs text-slate-500 mb-1">FO (id geo elemento) — vacio = todas las FO</label>
                <input type="number" class="in" [value]="idGeoElementoFo() ?? ''" (input)="idGeoElementoFo.set(num($event))" placeholder="Todas" />
              </div>
            }
            @if (kind === 'ponfo') {
              <div>
                <label class="block text-xs text-slate-500 mb-1">Confianza minima</label>
                <input type="number" class="in" [value]="minConfianza()" (input)="minConfianza.set(num($event) ?? 70)" />
              </div>
            }
          </div>

          <div class="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            Este proceso generara datos sugeridos o supuestos. Nada quedara validado automaticamente.
            Bryan o campo deberan validar posteriormente.
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <button class="btn cancel" (click)="cancelar.emit()">Cancelar</button>
            <button class="btn run" (click)="ejecutar()">Ejecutar proceso</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `.in{width:100%;border:1px solid #cbd5e1;border-radius:.375rem;padding:.35rem .5rem;font-size:.85rem;}
     .btn{font-size:.8rem;padding:.4rem .8rem;border-radius:.375rem;}
     .cancel{border:1px solid #cbd5e1;color:#475569;background:#fff;}
     .run{background:#2563eb;color:#fff;}`,
  ],
})
export class RedBetaProcesoDialogComponent {
  private _kind: RedProcesoKind | null = null;
  @Input() set kind(v: RedProcesoKind | null) {
    this._kind = v;
    // valores por defecto por proceso
    this.idRedNodo.set(null);
    this.idDispositivoPasivo.set(null);
    this.idGeoElementoFo.set(null);
    this.radioM.set(10);
    this.minConfianza.set(v === 'splitters' ? 65 : 70);
  }
  get kind(): RedProcesoKind | null {
    return this._kind;
  }

  @Output() confirmar = new EventEmitter<{ kind: RedProcesoKind; params: RedProcesoParams }>();
  @Output() cancelar = new EventEmitter<void>();

  readonly idRedNodo = signal<number | null>(null);
  readonly minConfianza = signal<number>(70);
  readonly radioM = signal<number>(10);
  readonly idDispositivoPasivo = signal<number | null>(null);
  readonly idGeoElementoFo = signal<number | null>(null);

  num(ev: Event): number | null {
    const v = (ev.target as HTMLInputElement).value;
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  titulo(): string {
    switch (this._kind) {
      case 'nap': return 'Generar relaciones NAP N1 -> NAP N2';
      case 'splitters': return 'Generar splitters contenidos';
      case 'puertos': return 'Generar puertos de splitters';
      case 'hilos': return 'Generar hilos de FO';
      case 'ponfo': return 'Generar relacion PON/VLAN -> FO';
      default: return '';
    }
  }

  subtitulo(): string {
    switch (this._kind) {
      case 'nap': return 'Sugerencias por carpeta, prefijo y tipo. Alcance: toda la red o un nodo/carpeta.';
      case 'splitters': return 'Detecta splitters cercanos a NAP/manga por radio.';
      case 'puertos': return 'Genera entrada(s) y salidas segun ratio de cada splitter.';
      case 'hilos': return 'Genera hilos supuestos por tipo de FO.';
      case 'ponfo': return 'Sugiere PON/VLAN -> FO si existen tablas logicas.';
      default: return '';
    }
  }

  ejecutar(): void {
    if (!this._kind) return;
    const params: RedProcesoParams = {};
    switch (this._kind) {
      case 'nap':
        if (this.idRedNodo() != null) params.idRedNodo = this.idRedNodo()!;
        params.minConfianza = this.minConfianza();
        break;
      case 'splitters':
        params.radioM = this.radioM();
        params.minConfianza = this.minConfianza();
        break;
      case 'puertos':
        if (this.idDispositivoPasivo() != null) params.idDispositivoPasivo = this.idDispositivoPasivo()!;
        break;
      case 'hilos':
        if (this.idGeoElementoFo() != null) params.idGeoElementoFo = this.idGeoElementoFo()!;
        break;
      case 'ponfo':
        params.minConfianza = this.minConfianza();
        break;
    }
    this.confirmar.emit({ kind: this._kind, params });
  }
}
