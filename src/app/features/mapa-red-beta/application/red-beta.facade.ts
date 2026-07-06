import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { RedBetaRepository } from '../data-access/red-beta.repository';
import { parseLatLon } from '../util/red-beta-estado.util';
import type {
  RedAccionEvento,
  RedBaseElemento,
  RedDispositivoPasivo,
  RedDispositivoPuerto,
  RedElementoRelacion,
  RedFoHilo,
  RedPonElementoRelacion,
  RedResumenItem,
  RedAnillo,
  RedAnilloLinea,
  RedAnilloNav,
} from '../data-access/red-beta.models';

export type RedSeleccionTipo = 'base' | 'relacion' | 'splitter' | 'ponfo' | 'hilo' | 'puerto';

export interface RedSeleccion {
  tipo: RedSeleccionTipo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

/**
 * Orquestador de la beta de red operativa: carga las vistas kxvp_, mantiene el estado con signals
 * y ejecuta las acciones de validacion / procesos contra el backend /api/erp/red.
 */
@Injectable()
export class RedBetaFacade {
  private repo = inject(RedBetaRepository);

  // -------- estado
  readonly resumen = signal<RedResumenItem[]>([]);
  readonly relaciones = signal<RedElementoRelacion[]>([]);
  readonly splitters = signal<RedDispositivoPasivo[]>([]);
  readonly hilos = signal<RedFoHilo[]>([]);
  readonly puertos = signal<RedDispositivoPuerto[]>([]);
  readonly ponFo = signal<RedPonElementoRelacion[]>([]);
  readonly baseElementos = signal<RedBaseElemento[]>([]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly seleccion = signal<RedSeleccion | null>(null);

  /** Conflictos agregados de todos los bloques (para el panel de conflictos). */
  readonly conflictos = computed(() => {
    const rel = this.relaciones().filter((r) => r.estadoRelacion === 'Conflicto');
    const spl = this.splitters().filter((s) => s.estadoDispositivo === 'Conflicto');
    const pue = this.puertos().filter((p) => p.estadoPuerto === 'Conflicto');
    const hil = this.hilos().filter((h) => h.estadoHilo === 'Conflicto');
    return { rel, spl, pue, hil, total: rel.length + spl.length + pue.length + hil.length };
  });

  /** Id del elemento geografico de la seleccion actual (para resaltar sus conexiones). */
  readonly selectedGeoId = computed<number | null>(() => {
    const sel = this.seleccion();
    if (!sel) return null;
    const d = sel.data;
    switch (sel.tipo) {
      case 'base': return d?.idGeoElemento ?? null;
      case 'relacion': return d?.idOrigen ?? null;
      case 'splitter': return d?.idContenedor ?? null;
      case 'ponfo': return d?.idGeoElementoFk ?? null;
      default: return null;
    }
  });

  /** Relaciones fisicas que tocan al elemento seleccionado (sus conexiones). */
  readonly conexiones = computed<RedElementoRelacion[]>(() => {
    const id = this.selectedGeoId();
    if (id == null) return [];
    return this.relaciones().filter((r) => r.idOrigen === id || r.idDestino === id);
  });

  /** Puertos del splitter seleccionado (para estadisticas en el detalle). */
  readonly puertosSeleccion = computed<RedDispositivoPuerto[]>(() => {
    const sel = this.seleccion();
    if (!sel || sel.tipo !== 'splitter') return [];
    const id = sel.data?.idDispositivoPasivo;
    if (id == null) return [];
    return this.puertos().filter((p) => p.idDispositivoPasivoFk === id);
  });

  // -------- modo inspector / anillo
  readonly soloAnillo = signal(false);
  readonly centrarReq = signal(0);
  toggleSoloAnillo() { this.soloAnillo.set(!this.soloAnillo()); }
  centrar() { this.centrarReq.set(this.centrarReq() + 1); }

  /** Clave del item seleccionado (tipo:id) para marcarlo en las listas. */
  readonly selectedKey = computed<string | null>(() => {
    const sel = this.seleccion();
    if (!sel) return null;
    const d = sel.data;
    const id =
      sel.tipo === 'relacion' ? d?.idRedElementoRelacion :
      sel.tipo === 'splitter' ? d?.idDispositivoPasivo :
      sel.tipo === 'ponfo' ? d?.idRedPonElementoRelacion :
      sel.tipo === 'hilo' ? d?.idFoHilo :
      sel.tipo === 'puerto' ? d?.idDispositivoPuerto :
      sel.tipo === 'base' ? d?.idGeoElemento : null;
    return id == null ? null : `${sel.tipo}:${id}`;
  });

  // indices reutilizables
  private readonly baseById = computed(() => {
    const m = new Map<number, RedBaseElemento>();
    for (const e of this.baseElementos()) m.set(e.idGeoElemento, e);
    return m;
  });
  private readonly hilosByFo = computed(() => {
    const m = new Map<number, RedFoHilo[]>();
    for (const h of this.hilos()) { const a = m.get(h.idGeoElementoFoFk) ?? []; a.push(h); m.set(h.idGeoElementoFoFk, a); }
    return m;
  });
  private readonly puertosBySplit = computed(() => {
    const m = new Map<number, RedDispositivoPuerto[]>();
    for (const p of this.puertos()) { const a = m.get(p.idDispositivoPasivoFk) ?? []; a.push(p); m.set(p.idDispositivoPasivoFk, a); }
    return m;
  });
  private readonly puertosByHilo = computed(() => {
    const m = new Map<number, RedDispositivoPuerto[]>();
    for (const p of this.puertos()) { if (p.idFoHiloFk != null) { const a = m.get(p.idFoHiloFk) ?? []; a.push(p); m.set(p.idFoHiloFk, a); } }
    return m;
  });
  private readonly splittersByCont = computed(() => {
    const m = new Map<number, RedDispositivoPasivo[]>();
    for (const s of this.splitters()) { if (s.idContenedor != null) { const a = m.get(s.idContenedor) ?? []; a.push(s); m.set(s.idContenedor, a); } }
    return m;
  });
  private readonly splitterById = computed(() => {
    const m = new Map<number, RedDispositivoPasivo>();
    for (const s of this.splitters()) m.set(s.idDispositivoPasivo, s);
    return m;
  });

  /** Ids geograficos relacionados con la seleccion (para atenuar / ver-solo-anillo en el mapa). */
  readonly relatedGeoIds = computed<Set<number>>(() => {
    const sel = this.seleccion();
    const set = new Set<number>();
    if (!sel) return set;
    const d = sel.data;
    const add = (x: unknown) => { if (typeof x === 'number') set.add(x); };
    switch (sel.tipo) {
      case 'base':
        add(d.idGeoElemento);
        for (const r of this.relaciones()) { if (r.idOrigen === d.idGeoElemento) add(r.idDestino); if (r.idDestino === d.idGeoElemento) add(r.idOrigen); }
        break;
      case 'relacion':
        add(d.idOrigen); add(d.idDestino);
        for (const r of this.relaciones()) if (r.idOrigen === d.idOrigen) add(r.idDestino);
        break;
      case 'splitter': {
        add(d.idContenedor);
        for (const p of (this.puertosBySplit().get(d.idDispositivoPasivo) ?? [])) add(p.idGeoElementoDestinoFk);
        break;
      }
      case 'ponfo': add(d.idGeoElementoFk); break;
      case 'hilo': add(d.idGeoElementoFoFk); break;
      case 'puerto': {
        const sp = this.splitterById().get(d.idDispositivoPasivoFk);
        if (sp) add(sp.idContenedor);
        add(d.idGeoElementoDestinoFk);
        break;
      }
    }
    return set;
  });

  /** Anillo operativo del elemento seleccionado. */
  readonly anillo = computed<RedAnillo | null>(() => {
    const sel = this.seleccion();
    if (!sel) return null;
    const d = sel.data;
    const L = (label: string, nombre?: string | null, estado?: string | null, vacio?: string, nav?: RedAnilloNav, color?: string | null): RedAnilloLinea =>
      ({ label, nombre: nombre ?? undefined, estado: estado ?? undefined, vacio, sel: nav, color: color ?? undefined });

    if (sel.tipo === 'relacion') {
      const sal = this.relaciones().filter((r) => r.idOrigen === d.idOrigen);
      const falt = sal.length <= 1 ? ['El origen solo tiene esta conexion registrada.'] : [];
      return {
        arribaLabel: 'Origen', arriba: [L('Origen', d.origenNombre, d.origenTipo)],
        centro: `${d.origenNombre} -> ${d.destinoNombre}`,
        abajoLabel: 'El origen alimenta a',
        abajo: sal.map((r) => L('->', r.destinoNombre, r.estadoRelacion, undefined, { tipo: 'relacion', data: r })),
        faltantes: falt,
      };
    }
    if (sel.tipo === 'base') {
      const ent = this.relaciones().filter((r) => r.idDestino === d.idGeoElemento);
      const sal = this.relaciones().filter((r) => r.idOrigen === d.idGeoElemento);
      const spl = this.splittersByCont().get(d.idGeoElemento) ?? [];
      const hil = this.hilosByFo().get(d.idGeoElemento) ?? [];
      const falt: string[] = [];
      if (spl.length === 0) falt.push('No hay splitter asociado a este elemento.');
      if (hil.length === 0) falt.push('No hay hilos asociados a esta FO/elemento.');
      if (ent.length === 0 && sal.length === 0 && spl.length === 0 && hil.length === 0)
        falt.push('Este elemento todavia no tiene relaciones operativas (sin procesar / aislado / falta proceso o validacion).');
      return {
        arribaLabel: 'Padres / entrada',
        arriba: ent.length ? ent.map((r) => L('Padre', r.origenNombre, r.estadoRelacion, undefined, { tipo: 'relacion', data: r })) : [L('Padres', null, null, 'No registrados')],
        centro: d.etiqueta || d.nombre || `#${d.idGeoElemento}`,
        abajoLabel: 'Hijos / salidas / destinos',
        abajo: [
          ...sal.map((r) => L('Hijo', r.destinoNombre, r.estadoRelacion, undefined, { tipo: 'relacion', data: r })),
          ...spl.map((s) => L('Splitter', s.nombreOperativo, s.estadoDispositivo, undefined, { tipo: 'splitter', data: s })),
          ...hil.slice(0, 8).map((h) => L('Hilo', `${h.numeroHilo} ${h.colorHilo}`, h.estadoHilo, undefined, { tipo: 'hilo', data: h }, h.colorHilo)),
        ],
        faltantes: falt,
      };
    }
    if (sel.tipo === 'splitter') {
      const ps = this.puertosBySplit().get(d.idDispositivoPasivo) ?? [];
      const entrada = ps.filter((p) => p.tipoPuerto === 'ENTRADA');
      const salidas = ps.filter((p) => p.tipoPuerto === 'SALIDA');
      const falt: string[] = [];
      if (!entrada.some((p) => p.idFoHiloFk != null)) falt.push('No hay FO/hilo de entrada conectado todavia.');
      if (!salidas.some((p) => p.idGeoElementoDestinoFk != null)) falt.push('Ninguna salida tiene destino fisico todavia.');
      return {
        arribaLabel: 'Contenedor / entrada',
        arriba: [
          L('Contenedor', d.contenedorNombre, d.contenedorTipo),
          ...entrada.map((p) => L('Entrada ' + p.numeroPuerto, p.colorHilo ? `Hilo ${p.numeroHilo} ${p.colorHilo}` : null, p.estadoPuerto, p.idFoHiloFk ? undefined : 'Sin hilo de entrada', { tipo: 'puerto', data: p }, p.colorHilo)),
        ],
        centro: d.nombreOperativo,
        abajoLabel: 'Salidas',
        abajo: salidas.map((p) => L('Salida ' + p.numeroPuerto, p.destinoNombre, p.estadoPuerto, p.destinoNombre ? undefined : 'Sin destino', { tipo: 'puerto', data: p })),
        faltantes: falt,
      };
    }
    if (sel.tipo === 'ponfo') {
      const hil = this.hilosByFo().get(d.idGeoElementoFk) ?? [];
      const falt: string[] = [];
      if (hil.length === 0) falt.push('No hay hilos conectados a esta FO.');
      falt.push('No hay contrato path construido todavia.');
      return {
        arribaLabel: 'Logico (OLT / LPU / PON)',
        arriba: [L('VLAN/PON', String(d.idRedVlanFk))],
        centro: `VLAN ${d.idRedVlanFk} -> ${d.elementoNombre}`,
        abajoLabel: 'Fisico',
        abajo: [
          L('FO', d.elementoNombre, d.elementoTipo),
          ...hil.slice(0, 12).map((h) => L('Hilo', `${h.numeroHilo} ${h.colorHilo}`, h.estadoHilo, undefined, { tipo: 'hilo', data: h }, h.colorHilo)),
        ],
        faltantes: falt,
      };
    }
    if (sel.tipo === 'hilo') {
      const pe = this.puertosByHilo().get(d.idFoHilo) ?? [];
      const falt: string[] = [];
      if (pe.length === 0) { falt.push('No conectado a ningun puerto de splitter todavia.'); falt.push('Destino no identificado.'); falt.push('No asociado a contrato/drop.'); }
      return {
        arribaLabel: 'FO',
        arriba: [L('FO', d.foNombre)],
        centro: `Hilo ${d.numeroHilo} ${d.colorHilo} de ${d.foNombre}`,
        abajoLabel: 'Conexion',
        abajo: pe.map((p) => L('Puerto', `${p.dispositivoNombre} ${p.nombrePuerto}`, p.estadoPuerto, undefined, { tipo: 'puerto', data: p })),
        faltantes: falt,
      };
    }
    if (sel.tipo === 'puerto') {
      const falt: string[] = [];
      if (d.idFoHiloFk == null) falt.push('Sin hilo de entrada asociado.');
      if (d.idGeoElementoDestinoFk == null) falt.push('Sin destino fisico asociado.');
      falt.push('Sin drop/cliente asociado.');
      const hiloEntrada = d.idFoHiloFk != null ? this.hilos().find((h) => h.idFoHilo === d.idFoHiloFk) : null;
      return {
        arribaLabel: 'Entrada / splitter',
        arriba: [
          L('Splitter', d.dispositivoNombre, null, undefined, this.splitterById().get(d.idDispositivoPasivoFk) ? { tipo: 'splitter', data: this.splitterById().get(d.idDispositivoPasivoFk) } : undefined),
          d.idFoHiloFk != null
            ? L('Hilo', `${d.numeroHilo ?? ''} ${d.colorHilo ?? ''}`, null, undefined, hiloEntrada ? { tipo: 'hilo', data: hiloEntrada } : undefined, d.colorHilo)
            : L('Hilo', null, null, 'No conectado'),
        ],
        centro: `${d.nombrePuerto} de ${d.dispositivoNombre}`,
        abajoLabel: 'Destino',
        abajo: [d.idGeoElementoDestinoFk != null ? L('Destino', d.destinoNombre, d.destinoTipo) : L('Destino', null, null, 'No identificado')],
        faltantes: falt,
      };
    }
    return null;
  });

  /** Distancia (al cuadrado) entre dos lat/lon string para ordenar por cercania. */
  private dist2(a: string | null | undefined, c: [number, number] | null): number {
    if (!c) return Number.POSITIVE_INFINITY;
    const ll = parseLatLon(a ?? null);
    return ll ? (ll[0] - c[0]) * (ll[0] - c[0]) + (ll[1] - c[1]) * (ll[1] - c[1]) : Number.POSITIVE_INFINITY;
  }

  /** Punto del splitter del puerto seleccionado (para buscar candidatos cercanos). */
  private splitterPointOf(d: { idDispositivoPasivoFk?: number }): [number, number] | null {
    const sp = d.idDispositivoPasivoFk != null ? this.splitterById().get(d.idDispositivoPasivoFk) : null;
    if (!sp) return null;
    return parseLatLon(sp.contenedorLatLon) ?? parseLatLon(sp.splitterOrigenLatLon);
  }

  /**
   * Hilos candidatos para asociar a un PUERTO: 1) los de la FO que ya alimenta el splitter;
   * 2) si no hay, los hilos cuyas FO estan mas CERCA del splitter (no toda la lista).
   */
  readonly hilosCandidatos = computed<RedFoHilo[]>(() => {
    const sel = this.seleccion();
    if (!sel || sel.tipo !== 'puerto') return [];
    const d = sel.data;
    // Para una SALIDA: hilos de la FO que ya entra al splitter. Para una ENTRADA: estas eligiendo la
    // fibra de subida, asi que se ofrecen los hilos mas cercanos (no se encierra en una sola FO).
    if (d.tipoPuerto === 'SALIDA') {
      const ent = (this.puertosBySplit().get(d.idDispositivoPasivoFk) ?? []).find((p) => p.tipoPuerto === 'ENTRADA' && p.idFoHiloFk != null);
      if (ent?.idFoHiloFk != null) {
        const h = this.hilos().find((x) => x.idFoHilo === ent.idFoHiloFk);
        if (h) {
          const ofFo = this.hilosByFo().get(h.idGeoElementoFoFk) ?? [];
          if (ofFo.length) return ofFo;
        }
      }
    }
    const c = this.splitterPointOf(d);
    const base = this.baseById();
    const conPos = this.hilos()
      .map((h) => ({ h, dist: this.dist2(h.foLatLon ?? base.get(h.idGeoElementoFoFk)?.latLon, c) }))
      .filter((x) => Number.isFinite(x.dist));
    conPos.sort((a, b) => a.dist - b.dist);
    return conPos.slice(0, 40).map((x) => x.h);
  });

  /** Elementos candidatos como destino de un PUERTO: NAPs/cajas (punto) mas CERCANAS al splitter. */
  readonly destinoCandidatos = computed<RedBaseElemento[]>(() => {
    const sel = this.seleccion();
    if (!sel || sel.tipo !== 'puerto') return [];
    const d = sel.data;
    const c = this.splitterPointOf(d);
    const puntos = this.baseElementos().filter((e) => {
      const t = (e.geomTipo || '').toLowerCase();
      return t.includes('point') || (!e.wkt && !!e.latLon);
    });
    if (!c) return puntos.slice(0, 40);
    return puntos
      .map((e) => ({ e, dist: this.dist2(e.latLon, c) }))
      .filter((x) => Number.isFinite(x.dist))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 40)
      .map((x) => x.e);
  });

  // -------- carga
  cargarTodo() {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      resumen: this.repo.resumen(),
      relaciones: this.repo.listarRelaciones(),
      splitters: this.repo.listarSplitters(),
      hilos: this.repo.listarHilos(),
      puertos: this.repo.listarPuertos(),
      ponFo: this.repo.listarPonFo(),
      base: this.repo.listarBaseElementos(),
    }).subscribe({
      next: (r) => {
        this.resumen.set(r.resumen ?? []);
        this.relaciones.set(r.relaciones ?? []);
        this.splitters.set(r.splitters ?? []);
        this.hilos.set(r.hilos ?? []);
        this.puertos.set(r.puertos ?? []);
        this.ponFo.set(r.ponFo ?? []);
        this.baseElementos.set(r.base ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.message ?? 'Error al cargar la red operativa');
        this.loading.set(false);
      },
    });
  }

  seleccionar(sel: RedSeleccion | null) {
    this.seleccion.set(sel);
  }

  // -------- acciones sobre relaciones / splitters
  ejecutarAccion(ev: RedAccionEvento) {
    const done = (msg: string) => {
      this.error.set(null);
      this.mensaje.set('\u2713 Guardado. ' + msg + ' (asi quedo el elemento)');
      this.recargarListas();
    };
    const fail = (e: unknown) => {
      this.mensaje.set(null);
      this.error.set((e as Error)?.message ?? 'Error al ejecutar la accion');
    };

    switch (ev.kind) {
      case 'validar-oficina':
        this.repo.validarRelacionOficina(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'validar-campo':
        this.repo.validarRelacionCampo(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'rechazar':
        this.repo.rechazarRelacion(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'pendiente-campo':
        this.repo.relacionPendienteCampo(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'confirmar-ratio':
        this.repo
          .confirmarRatio(ev.id, ev.ratioSplitter ?? '1:8', ev.validadoEnCampo ?? true, ev.observacion)
          .subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'no-encontrado':
        if (!ev.observacion || !ev.observacion.trim()) {
          this.error.set('Para marcar "No encontrado en campo" agrega una observacion en el panel de Detalle.');
          return;
        }
        this.repo.noEncontradoSplitter(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'hilo-estado':
        this.repo.hiloEstado(ev.id, ev.estadoNuevo ?? '', ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'puerto-estado':
        this.repo.puertoEstado(ev.id, ev.estadoNuevo ?? '', ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'asociar-hilo':
        this.repo.puertoAsociarHilo(ev.id, ev.idFoHilo ?? null, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'asociar-destino':
        this.repo.puertoAsociarDestino(ev.id, ev.idGeoElementoDestino ?? null, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'reasignar-destino':
        this.repo.relacionReasignarDestino(ev.id, ev.idGeoElementoDestino ?? null, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'crear-relacion':
        if (ev.idGeoElementoDestino != null) {
          this.repo.crearRelacion(ev.id, ev.idGeoElementoDestino, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        }
        break;
      case 'pon-validar-oficina':
        this.repo.ponValidarOficina(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'pon-validar-campo':
        this.repo.ponValidarCampo(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'pon-pendiente-campo':
        this.repo.ponPendienteCampo(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
      case 'pon-rechazar':
        this.repo.ponRechazar(ev.id, ev.observacion).subscribe({ next: (r) => done(r.mensaje), error: fail });
        break;
    }
  }

  rechazarSplitter(id: number, observacion?: string) {
    this.repo.rechazarSplitter(id, observacion).subscribe({
      next: (r) => {
        this.mensaje.set(r.mensaje);
        this.recargarListas();
      },
      error: (e) => this.error.set(e?.message ?? 'Error al rechazar splitter'),
    });
  }

  // -------- procesos (cursores kxfp_)
  generar(
    kind: 'nap' | 'splitters' | 'puertos' | 'hilos' | 'ponfo',
    params: { idRedNodo?: number; minConfianza?: number; radioM?: number; idDispositivoPasivo?: number; idGeoElementoFo?: number } = {}
  ) {
    this.error.set(null);
    const after = (res: { data: number; mensaje: string }) => {
      const n = res?.data ?? 0;
      this.mensaje.set(
        n > 0
          ? `Proceso ejecutado. Generados: ${n}. Los registros nacieron como sugeridos/supuestos/pendientes. Revise los paneles correspondientes.`
          : 'No se generaron registros nuevos. Puede deberse a que ya existian, no hubo candidatos o los filtros fueron muy restrictivos.'
      );
      this.cargarTodo();
    };
    const fail = (e: unknown) => this.error.set((e as Error)?.message ?? 'Error en el proceso');
    switch (kind) {
      case 'nap':
        this.repo.generarRelacionesNap(params.idRedNodo, params.minConfianza ?? 70).subscribe({ next: after, error: fail });
        break;
      case 'splitters':
        this.repo.generarSplittersContenidos(params.radioM ?? 10, params.minConfianza ?? 65).subscribe({ next: after, error: fail });
        break;
      case 'puertos':
        this.repo.generarPuertosSplitters(params.idDispositivoPasivo).subscribe({ next: after, error: fail });
        break;
      case 'hilos':
        this.repo.generarHilosFo(params.idGeoElementoFo).subscribe({ next: after, error: fail });
        break;
      case 'ponfo':
        this.repo.generarPonFoSugerido(params.minConfianza ?? 70).subscribe({ next: after, error: fail });
        break;
    }
  }

  private recargarListas() {
    forkJoin({
      relaciones: this.repo.listarRelaciones(),
      splitters: this.repo.listarSplitters(),
      hilos: this.repo.listarHilos(),
      puertos: this.repo.listarPuertos(),
      ponFo: this.repo.listarPonFo(),
    }).subscribe((r) => {
      this.relaciones.set(r.relaciones ?? []);
      this.splitters.set(r.splitters ?? []);
      this.hilos.set(r.hilos ?? []);
      this.puertos.set(r.puertos ?? []);
      this.ponFo.set(r.ponFo ?? []);
      this.resyncSeleccion();
    });
  }

  /** Tras recargar, re-apunta la seleccion al registro fresco (para reflejar lo recien guardado). */
  private resyncSeleccion() {
    const sel = this.seleccion();
    if (!sel) return;
    const d = sel.data;
    let fresh: unknown = null;
    switch (sel.tipo) {
      case 'relacion': fresh = this.relaciones().find((x) => x.idRedElementoRelacion === d.idRedElementoRelacion); break;
      case 'splitter': fresh = this.splitters().find((x) => x.idDispositivoPasivo === d.idDispositivoPasivo); break;
      case 'hilo': fresh = this.hilos().find((x) => x.idFoHilo === d.idFoHilo); break;
      case 'puerto': fresh = this.puertos().find((x) => x.idDispositivoPuerto === d.idDispositivoPuerto); break;
      case 'ponfo': fresh = this.ponFo().find((x) => x.idRedPonElementoRelacion === d.idRedPonElementoRelacion); break;
    }
    if (fresh) this.seleccion.set({ tipo: sel.tipo, data: fresh });
  }
}
