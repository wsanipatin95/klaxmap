import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RedBetaEstadoBadgeComponent } from '../red-beta-estado-badge/red-beta-estado-badge.component';
import type { RedAccionEvento, RedAnillo, RedAnilloLinea, RedBaseElemento, RedDispositivoPuerto, RedElementoRelacion, RedFoHilo } from '../../data-access/red-beta.models';
import type { RedSeleccion } from '../../application/red-beta.facade';

/**
 * Inspector del elemento enfocado. Muestra, sin redundar: cabecera (que es + estado + recomendacion),
 * un ARBOL de descendencia (de donde viene -> elemento -> a donde va) con nodos clicables,
 * pendientes y acciones claras. Las asociaciones de hilo/destino se eligen por combobox (no por id).
 */
@Component({
  selector: 'app-red-beta-detalle-panel',
  standalone: true,
  imports: [RedBetaEstadoBadgeComponent],
  template: `
    @if (!seleccion) {
      <p class="text-sm text-slate-400">Toca un elemento en el mapa o en una lista para inspeccionarlo.</p>
    } @else {
      <!-- Cabecera: que es + estado + recomendacion -->
      <div class="rounded-md border border-blue-200 bg-blue-50 p-2 mb-2">
        <div class="text-[10px] uppercase tracking-wide text-blue-500">Trabajando en</div>
        <div class="text-sm font-semibold text-slate-800 leading-tight">{{ nombre() }}</div>
        <div class="flex items-center gap-2 flex-wrap mt-1">
          <span class="text-[11px] text-slate-500">{{ tipoTecnico() }}</span>
          <app-red-beta-estado-badge [estado]="estado()" />
          @if (confianza() !== null) { <span class="text-[11px] text-slate-500">{{ confianza() }}%</span> }
        </div>
        <div class="text-[11px] text-slate-600 mt-1">{{ recomendacion() }}</div>
        <div class="flex gap-1.5 mt-2 flex-wrap">
          @if (puedeVolver) { <button class="b back" (click)="volver.emit()" title="Volver al elemento anterior">← Volver</button> }
          <button class="b alt" (click)="centrar.emit()">Centrar</button>
          <button class="b alt" (click)="verAnillo.emit()">{{ soloAnillo ? 'Salir del anillo' : 'Ver solo este anillo' }}</button>
        </div>
      </div>

      <div class="space-y-2 text-sm">
        <!-- ARBOL DE DESCENDENCIA -->
        @if (anillo) {
          <section>
            <button class="sec" (click)="toggle('estr')">{{ open('estr') ? '▾' : '▸' }} Estructura (arbol)</button>
            @if (open('estr')) {
              <div class="rb-tree">
                <div class="rb-tier">▲ {{ anillo.arribaLabel }} · de donde viene</div>
                <div class="rb-group">
                  @if (anillo.arriba.length === 0) { <div class="rb-empty">Sin origen registrado.</div> }
                  @for (a of anillo.arriba; track $index) {
                    <div class="rb-node" [class.rb-click]="!!a.sel" (click)="goLinea(a)">
                      <span class="rb-nlabel">{{ a.label }}</span>
                      @if (a.color) { <span class="rb-dot" [style.background]="colorCss(a.color)" [title]="a.color"></span> }
                      <b class="truncate">{{ a.nombre || a.vacio || '—' }}</b>
                      @if (a.estado) { <app-red-beta-estado-badge [estado]="a.estado" /> }
                      @if (a.sel) { <span class="rb-open">Abrir ›</span> }
                    </div>
                  }
                </div>

                <div class="rb-center">◉ {{ anillo.centro }}</div>

                <div class="rb-tier">▼ {{ anillo.abajoLabel }} · a donde va</div>
                <div class="rb-group">
                  @if (anillo.abajo.length === 0) { <div class="rb-empty">Sin destinos/hijos todavia.</div> }
                  @for (a of anillo.abajo; track $index) {
                    <div class="rb-node" [class.rb-click]="!!a.sel" (click)="goLinea(a)">
                      <span class="rb-nlabel">{{ a.label }}</span>
                      @if (a.color) { <span class="rb-dot" [style.background]="colorCss(a.color)" [title]="a.color"></span> }
                      <b class="truncate">{{ a.nombre || a.vacio || '—' }}</b>
                      @if (a.estado) { <app-red-beta-estado-badge [estado]="a.estado" /> }
                      @if (a.sel) { <span class="rb-open">Abrir ›</span> }
                    </div>
                  }
                </div>
              </div>
            }
          </section>
        }

        <!-- PENDIENTES -->
        @if (anillo && anillo.faltantes.length > 0) {
          <section>
            <button class="sec" (click)="toggle('pend')">{{ open('pend') ? '▾' : '▸' }} Pendientes ({{ anillo.faltantes.length }})</button>
            @if (open('pend')) {
              <ul class="pl-2 pt-1 space-y-0.5 text-xs text-amber-700">
                @for (f of anillo.faltantes; track $index) { <li>• {{ f }}</li> }
              </ul>
            }
          </section>
        }

        <!-- ACCIONES -->
        <section>
          <button class="sec" (click)="toggle('acc')">{{ open('acc') ? '▾' : '▸' }} Acciones</button>
          @if (open('acc')) {
            <div class="pl-1 pt-1 space-y-2">
              @if (seleccion.tipo === 'relacion') {
                <p class="rb-help">¿La relacion origen → destino es correcta?</p>
                <div class="flex flex-wrap gap-1.5">
                  <button class="b ok" (click)="emit('validar-oficina')">Validar oficina</button>
                  <button class="b ok2" (click)="emit('validar-campo')">Validar campo</button>
                  <button class="b campo" (click)="emit('pendiente-campo')">Mandar a campo</button>
                  <button class="b no" (click)="emit('rechazar')">Rechazar</button>
                  <button class="b alt" (click)="conectarMapa.emit({ kind: 'destino', action: 'relacion' })" title="Elegir el destino correcto tocandolo en el mapa">Corregir destino en el mapa</button>
                </div>
              }
              @if (seleccion.tipo === 'splitter') {
                <p class="rb-help">Confirma el ratio real (define cuantas salidas tiene).</p>
                <div class="flex flex-wrap gap-1.5">
                  <button class="b ok" (click)="emitRatio('1:8')">Confirmar 1:8</button>
                  <button class="b alt" (click)="emitRatio('1:4')">1:4</button>
                  <button class="b alt" (click)="emitRatio('1:16')">1:16</button>
                  <button class="b campo" (click)="emit('pendiente-campo')">A campo</button>
                  <button class="b no" (click)="emit('no-encontrado')">No encontrado</button>
                </div>
              }
              @if (seleccion.tipo === 'hilo') {
                <p class="rb-help">Confirma el estado real de la fibra.</p>
                <div class="flex flex-wrap gap-1.5">
                  <button class="b ok" (click)="emitHilo('Libre confirmado')">Libre</button>
                  <button class="b ok2" (click)="emitHilo('Ocupado confirmado')">Ocupado</button>
                  <button class="b alt" (click)="emitHilo('Reservado')">Reservado</button>
                  <button class="b no" (click)="emitHilo('Averiado')">Averiado</button>
                  <button class="b campo" (click)="emitHilo('Pendiente validar')">A campo</button>
                  <button class="b alt" (click)="conectarMapa.emit({ kind: 'splitter', action: 'hilo-splitter' })" title="Conectar este hilo a un splitter tocandolo en el mapa">Conectar a un splitter</button>
                </div>
              }
              @if (seleccion.tipo === 'puerto') {
                <p class="rb-help"><b>1.</b> Estado del puerto:</p>
                <div class="flex flex-wrap gap-1.5">
                  <button class="b ok" (click)="emitPuerto('Libre')">Libre</button>
                  <button class="b ok2" (click)="emitPuerto('Ocupado')">Ocupado</button>
                  <button class="b campo" (click)="emitPuerto('Pendiente validar')">Pendiente</button>
                  <button class="b no" (click)="emitPuerto('Conflicto')">Conflicto</button>
                </div>

                <p class="rb-help"><b>2.</b> Conectar a un hilo de FO (ordenados del mas cercano al mas lejano):</p>
                <div class="flex items-center gap-1.5">
                  <select class="sel" (change)="hiloSel.set($any($event.target).value)">
                    <option value="" [selected]="hiloSel() === ''">— elige un hilo —</option>
                    @for (h of hilosCandidatos; track h.idRedFoHilo) {
                      <option [value]="h.idRedFoHilo" [selected]="hiloSel() === (h.idRedFoHilo + '')">{{ h.foNombre }} · Hilo {{ h.numeroHilo }} {{ h.colorHilo }} · {{ h.estadoHilo }}</option>
                    }
                  </select>
                  <button class="b alt" (click)="pedirAsociar('hilo')" [disabled]="!hiloSel()">Asociar</button>
                  <button class="b no" (click)="quitarHilo()" title="Quitar el hilo del puerto">Quitar</button>
                  <button class="b alt" (click)="conectarMapa.emit({ kind: 'hilo', action: 'puerto' })" title="Elegir el hilo tocandolo en el mapa">Conectar en el mapa</button>
                </div>
                @if (hilosCandidatos.length === 0) { <p class="rb-help">No hay hilos candidatos (revisa la FO de entrada del splitter).</p> }
                @if (confirmar()?.kind === 'hilo') {
                  <div class="rb-confirm">
                    Vas a conectar este puerto a <b>{{ confirmar()!.label }}</b>. ¿Confirmas?
                    <div class="flex gap-1.5 mt-1">
                      <button class="b ok2" (click)="confirmarAsociar()">Si, conectar</button>
                      <button class="b no" (click)="confirmar.set(null)">Cancelar</button>
                    </div>
                  </div>
                }

                <p class="rb-help"><b>3.</b> Conectar a un destino fisico (NAPs/cajas mas cercanas primero):</p>
                <div class="flex items-center gap-1.5">
                  <select class="sel" (change)="destSel.set($any($event.target).value)">
                    <option value="" [selected]="destSel() === ''">— elige un destino —</option>
                    @for (e of destinoCandidatos; track e.idGeoElemento) {
                      <option [value]="e.idGeoElemento" [selected]="destSel() === (e.idGeoElemento + '')">{{ e.etiqueta || e.nombre }}</option>
                    }
                  </select>
                  <button class="b alt" (click)="pedirAsociar('destino')" [disabled]="!destSel()">Asociar</button>
                  <button class="b no" (click)="quitarDestino()" title="Quitar el destino del puerto">Quitar</button>
                  <button class="b alt" (click)="conectarMapa.emit({ kind: 'destino', action: 'puerto' })" title="Elegir el destino tocandolo en el mapa">Conectar en el mapa</button>
                </div>
                @if (confirmar()?.kind === 'destino') {
                  <div class="rb-confirm">
                    Vas a conectar este puerto al destino <b>{{ confirmar()!.label }}</b>. ¿Confirmas?
                    <div class="flex gap-1.5 mt-1">
                      <button class="b ok2" (click)="confirmarAsociar()">Si, conectar</button>
                      <button class="b no" (click)="confirmar.set(null)">Cancelar</button>
                    </div>
                  </div>
                }
              }
              @if (seleccion.tipo === 'ponfo') {
                <p class="rb-help">Relación PON/VLAN → FO <b>derivada</b> (contrato→vlan + equipo→geo + grafo). Es de <b>solo lectura</b>: no se valida a mano; si algo no cuadra se corrige el dato de origen.</p>
              }
              @if (seleccion.tipo === 'base') {
                <p class="rb-help">Elemento fisico base: valida sus relaciones/splitters desde el arbol o ejecuta procesos.</p>
                <button class="b alt" (click)="conectarMapa.emit({ kind: 'destino', action: 'crear' })" title="Crear una conexion tocando la caja destino en el mapa">Conectar a otra caja</button>
              }

              @if (seleccion.tipo !== 'base') {
                <textarea class="w-full border border-slate-300 rounded-md p-2 text-xs" rows="2"
                  placeholder="Observacion (opcional; obligatoria para 'No encontrado')"
                  [value]="obs()" (input)="obs.set($any($event.target).value)"></textarea>
              }
            </div>
          }
        </section>

        <!-- QUE ES (secundario, colapsado) -->
        <section>
          <button class="sec" (click)="toggle('que')">{{ open('que') ? '▾' : '▸' }} Por que / que significa</button>
          @if (open('que')) {
            <div class="pl-2 pt-1 space-y-1 text-slate-600 text-xs">
              <div><span class="lbl">Por que:</span> {{ motivo() }}</div>
              <div><span class="lbl">Significa:</span> {{ significa() }}</div>
              @if (d().nodo || d().pathCache || d().path) { <div><span class="lbl">Nodo/carpeta:</span> {{ d().pathCache || d().path || d().nodo }}</div> }
            </div>
          }
        </section>

        <!-- PAYLOAD -->
        @if (payload()) {
          <section>
            <button class="sec" (click)="toggle('pay')">{{ open('pay') ? '▾' : '▸' }} Payload tecnico</button>
            @if (open('pay')) {
              <pre class="pl-2 pt-1 text-[10px] text-slate-500 whitespace-pre-wrap break-all max-h-40 overflow-auto">{{ payload() }}</pre>
            }
          </section>
        }
      </div>
    }
  `,
  styles: [
    `.sec{width:100%;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1f3864;padding:.25rem 0;border-top:1px solid #f1f5f9;}
     .lbl{color:#94a3b8;}
     .sel{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:.375rem;padding:.25rem .4rem;font-size:.74rem;background:#fff;}
     .b{font-size:.72rem;padding:.25rem .55rem;border-radius:.375rem;border:1px solid transparent;cursor:pointer;}
     .b:disabled{opacity:.4;cursor:default;}
     .ok{background:#dcfce7;color:#166534;} .ok2{background:#bbf7d0;color:#14532d;}
     .alt{background:#e0e7ff;color:#3730a3;} .campo{background:#ffedd5;color:#9a3412;} .no{background:#fee2e2;color:#991b1b;}
     .dis{background:#f1f5f9;color:#94a3b8;cursor:not-allowed;}
     .back{background:#fff7ed;color:#9a3412;border-color:#fed7aa;}
     .rb-help{font-size:.7rem;color:#475569;margin:.15rem 0;line-height:1.3;}
     .rb-confirm{font-size:.74rem;color:#713f12;background:#fefce8;border:1px solid #fde68a;border-radius:.4rem;padding:.4rem .5rem;margin-top:.25rem;}
     .rb-tree{padding:.15rem 0;font-size:.78rem;}
     .rb-tier{font-size:.6rem;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin:.3rem 0 .1rem;}
     .rb-center{display:flex;align-items:center;gap:.4rem;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:.4rem;padding:.25rem .5rem;margin:.15rem 0;}
     .rb-group{border-left:2px solid #e2e8f0;margin-left:.5rem;padding-left:.5rem;}
     .rb-node{display:flex;align-items:center;gap:.35rem;padding:.18rem .3rem;border-radius:.35rem;}
     .rb-click{cursor:pointer;}
     .rb-click:hover{background:#eff6ff;}
     .rb-nlabel{color:#64748b;font-size:.66rem;white-space:nowrap;}
     .rb-open{font-size:.62rem;color:#2563eb;font-weight:600;white-space:nowrap;margin-left:auto;}
     .rb-empty{color:#94a3b8;font-style:italic;font-size:.72rem;padding:.15rem .3rem;}
     .rb-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:9999px;border:1px solid #cbd5e1;flex:none;}`,
  ],
})
export class RedBetaDetallePanelComponent {
  private _sel = signal<RedSeleccion | null>(null);
  @Input() set seleccionInput(v: RedSeleccion | null) {
    this._sel.set(v);
    this.obs.set('');
    const d = v?.data ?? {};
    this.hiloSel.set(v?.tipo === 'puerto' && d.idRedFoHiloFk != null ? String(d.idRedFoHiloFk) : '');
    this.destSel.set(v?.tipo === 'puerto' && d.idGeoElementoDestinoFk != null ? String(d.idGeoElementoDestinoFk) : '');
    this.confirmar.set(null);
  }
  get seleccion(): RedSeleccion | null { return this._sel(); }

  goLinea(a: RedAnilloLinea) { if (a.sel) this.irA.emit(a.sel as unknown as RedSeleccion); }

  @Input() conexiones: RedElementoRelacion[] = [];
  @Input() puertos: RedDispositivoPuerto[] = [];
  @Input() anillo: RedAnillo | null = null;
  @Input() soloAnillo = false;
  @Input() puedeVolver = false;
  @Input() hilosCandidatos: RedFoHilo[] = [];
  @Input() destinoCandidatos: RedBaseElemento[] = [];

  @Output() accionEmit = new EventEmitter<RedAccionEvento>();
  @Output() irA = new EventEmitter<RedSeleccion>();
  @Output() centrar = new EventEmitter<void>();
  @Output() verAnillo = new EventEmitter<void>();
  @Output() volver = new EventEmitter<void>();
  @Output() conectarMapa = new EventEmitter<{ kind: 'hilo' | 'destino' | 'splitter'; action: 'puerto' | 'relacion' | 'crear' | 'hilo-splitter' }>();

  readonly obs = signal('');
  readonly hiloSel = signal('');
  readonly destSel = signal('');
  readonly confirmar = signal<{ kind: 'hilo' | 'destino'; label: string } | null>(null);

  private hiloLabel(): string {
    const id = Number(this.hiloSel());
    const h = this.hilosCandidatos.find((x) => x.idRedFoHilo === id);
    return h ? `${h.foNombre} · Hilo ${h.numeroHilo} ${h.colorHilo}` : 'el hilo elegido';
  }
  private destinoLabel(): string {
    const id = Number(this.destSel());
    const e = this.destinoCandidatos.find((x) => x.idGeoElemento === id);
    return e ? (e.etiqueta || e.nombre) : 'el destino elegido';
  }
  pedirAsociar(kind: 'hilo' | 'destino'): void {
    this.confirmar.set({ kind, label: kind === 'hilo' ? this.hiloLabel() : this.destinoLabel() });
  }
  confirmarAsociar(): void {
    const c = this.confirmar();
    if (!c) return;
    if (c.kind === 'hilo') this.asociarHilo(); else this.asociarDestino();
    this.confirmar.set(null);
  }
  private readonly secciones = signal<Set<string>>(new Set(['estr', 'pend', 'acc']));

  open(s: string): boolean { return this.secciones().has(s); }
  toggle(s: string): void {
    const next = new Set(this.secciones());
    if (next.has(s)) next.delete(s); else next.add(s);
    this.secciones.set(next);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d(): any { return this._sel()?.data ?? {}; }

  nombre(): string {
    const s = this._sel(); const d = this.d();
    switch (s?.tipo) {
      case 'base': return d.etiqueta || d.nombre || `#${d.idGeoElemento}`;
      case 'relacion': return `${d.origenNombre} → ${d.destinoNombre}`;
      case 'splitter': return d.nombreOperativo;
      case 'ponfo': return `VLAN ${d.idRedVlanFk} → ${d.elementoNombre}`;
      case 'hilo': return `Hilo ${d.numeroHilo} ${d.colorHilo} (${d.foNombre})`;
      case 'puerto': return `${d.nombrePuerto} de ${d.dispositivoNombre}`;
      default: return '';
    }
  }

  tipoTecnico(): string {
    const s = this._sel(); const d = this.d();
    switch (s?.tipo) {
      case 'base': return d.tipoCodigo || d.geomTipo || 'Elemento fisico';
      case 'relacion': return 'Relacion · ' + d.tipoRelacion;
      case 'splitter': return 'Splitter · ' + d.ratioSplitter;
      case 'ponfo': return 'PON/VLAN → FO';
      case 'hilo': return 'Hilo de FO';
      case 'puerto': return 'Puerto · ' + d.tipoPuerto;
      default: return '';
    }
  }

  estado(): string {
    const s = this._sel(); const d = this.d();
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
    if (s?.tipo === 'base') return 'Elemento fisico del mapa. Sus relaciones operativas se construyen con los procesos y la validacion.';
    if (s?.tipo === 'hilo') return 'Hilo creado automaticamente segun la capacidad del cable FO.';
    if (s?.tipo === 'puerto') return 'Puerto generado por el ERP segun el ratio del splitter.';
    const d = this.d();
    const p = d.payloadSugerencia as Record<string, unknown> | undefined;
    const m = p && typeof p['motivo'] === 'string' ? (p['motivo'] as string) : null;
    if (m) return m;
    if (d.observacion) return d.observacion as string;
    return 'Sugerencia generada por el cursor/IA segun carpeta, prefijo, tipo o cercania.';
  }

  significa(): string {
    const s = this._sel(); const d = this.d();
    switch (s?.tipo) {
      case 'relacion': return `El sistema cree que ${d.origenNombre} alimenta fisicamente a ${d.destinoNombre}.`;
      case 'ponfo': return 'Relacion PON/VLAN → FO DERIVADA del dato (contrato→vlan + equipo→geo + grafo). Es de solo lectura.';
      case 'splitter': return 'Dispositivo pasivo que reparte una entrada en varias salidas.';
      case 'hilo': return 'Una fibra individual dentro del cable FO; debe confirmarse si esta libre, ocupada, averiada o reservada.';
      case 'puerto': return 'Punto de conexion del splitter; debe confirmarse a que hilo/destino/drop se conecta.';
      case 'base': return 'Elemento fisico de la planta (NAP, manga, FO, splitter, reserva...).';
      default: return '';
    }
  }

  recomendacion(): string {
    switch (this._sel()?.tipo) {
      case 'relacion': return 'Valida en oficina si el nombre/carpeta es correcto; manda a campo si hay duda; rechaza si es incorrecta.';
      case 'splitter': return 'Confirma el ratio si es correcto; a campo si necesita validacion fisica.';
      case 'ponfo': return 'Solo lectura: si algo no cuadra, se corrige en el dato de origen (vlan / equipo / grafo), no aqui.';
      case 'hilo': return 'Campo confirma si esta libre/ocupado/averiado/reservado.';
      case 'puerto': return 'Confirma estado y a que hilo/destino se conecta.';
      case 'base': return 'Revisa el arbol; valida relaciones o ejecuta procesos si esta sin procesar.';
      default: return '';
    }
  }

  payload(): string | null {
    const p = this.d().payloadSugerencia;
    if (!p || (typeof p === 'object' && Object.keys(p).length === 0)) return null;
    try { return JSON.stringify(p, null, 2); } catch { return null; }
  }

  private id(): number {
    const s = this._sel(); const d = this.d();
    switch (s?.tipo) {
      case 'splitter': return d.idRedDispositivoPasivo;
      case 'hilo': return d.idRedFoHilo;
      case 'puerto': return d.idRedDispositivoPuerto;
      case 'ponfo': return d.idRedPonElementoRelacion;
      default: return d.idRedElementoRelacion;
    }
  }

  emit(kind: RedAccionEvento['kind']): void {
    this.accionEmit.emit({ kind, id: this.id(), observacion: this.obs() || undefined });
  }
  emitRatio(ratio: string): void {
    this.accionEmit.emit({ kind: 'confirmar-ratio', id: this.id(), ratioSplitter: ratio, validadoEnCampo: true, observacion: this.obs() || undefined });
  }
  emitHilo(estado: string): void {
    this.accionEmit.emit({ kind: 'hilo-estado', id: this.id(), estadoNuevo: estado, observacion: this.obs() || undefined });
  }
  emitPuerto(estado: string): void {
    this.accionEmit.emit({ kind: 'puerto-estado', id: this.id(), estadoNuevo: estado, observacion: this.obs() || undefined });
  }
  asociarHilo(): void {
    const v = this.hiloSel().trim();
    this.accionEmit.emit({ kind: 'asociar-hilo', id: this.id(), idRedFoHilo: v ? Number(v) : null, observacion: this.obs() || undefined });
  }
  quitarHilo(): void {
    this.hiloSel.set('');
    this.accionEmit.emit({ kind: 'asociar-hilo', id: this.id(), idRedFoHilo: null, observacion: this.obs() || undefined });
  }
  asociarDestino(): void {
    const v = this.destSel().trim();
    this.accionEmit.emit({ kind: 'asociar-destino', id: this.id(), idGeoElementoDestino: v ? Number(v) : null, observacion: this.obs() || undefined });
  }
  quitarDestino(): void {
    this.destSel.set('');
    this.accionEmit.emit({ kind: 'asociar-destino', id: this.id(), idGeoElementoDestino: null, observacion: this.obs() || undefined });
  }

  colorCss(color: string | null | undefined): string {
    const m: Record<string, string> = {
      Azul: '#2563eb', 'Tomate / Naranja': '#fb923c', Verde: '#16a34a', Cafe: '#92400e',
      Gris: '#9ca3af', Blanco: '#f8fafc', Rojo: '#dc2626', Negro: '#111827',
      Amarillo: '#facc15', Violeta: '#7c3aed', Rosado: '#f472b6', 'Aqua / Celeste': '#22d3ee',
    };
    return (color && m[color]) || '#e2e8f0';
  }
}
