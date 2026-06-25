import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { RedBetaRepository } from '../data-access/red-beta.repository';
import type {
  RedAccionEvento,
  RedBaseElemento,
  RedDispositivoPasivo,
  RedDispositivoPuerto,
  RedElementoRelacion,
  RedFoHilo,
  RedPonElementoRelacion,
  RedResumenItem,
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
      this.mensaje.set(msg);
      this.recargarListas();
    };
    const fail = (e: unknown) => this.error.set((e as Error)?.message ?? 'Error al ejecutar la accion');

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
    this.repo.listarRelaciones().subscribe((d) => this.relaciones.set(d ?? []));
    this.repo.listarSplitters().subscribe((d) => this.splitters.set(d ?? []));
    this.repo.listarPuertos().subscribe((d) => this.puertos.set(d ?? []));
    this.repo.listarPonFo().subscribe((d) => this.ponFo.set(d ?? []));
    this.repo.resumen().subscribe((d) => this.resumen.set(d ?? []));
  }
}
