import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { RedBetaApi } from './red-beta.api';
import type {
  RedResumenItem,
  RedElementoRelacion,
  RedPonElementoRelacion,
  RedDispositivoPasivo,
  RedFoHilo,
  RedDispositivoPuerto,
  RedBaseElemento,
} from './red-beta.models';

/**
 * Repositorio: desempaqueta el sobre ApiResponse ({codigo,mensaje,data}) y devuelve datos planos.
 */
@Injectable({ providedIn: 'root' })
export class RedBetaRepository {
  private api = inject(RedBetaApi);

  resumen() {
    return this.api.resumen().pipe(map((r) => unwrapOrThrow<RedResumenItem[]>(r)));
  }

  listarRelaciones(params: { estado?: string; tipoRelacion?: string; idRedNodo?: number; q?: string } = {}) {
    return this.api.listarRelaciones(params).pipe(map((r) => unwrapOrThrow<RedElementoRelacion[]>(r)));
  }

  listarPonFo(params: { estado?: string; q?: string } = {}) {
    return this.api.listarPonFo(params).pipe(map((r) => unwrapOrThrow<RedPonElementoRelacion[]>(r)));
  }

  listarSplitters(params: { estado?: string; ratio?: string; q?: string } = {}) {
    return this.api.listarSplitters(params).pipe(map((r) => unwrapOrThrow<RedDispositivoPasivo[]>(r)));
  }

  listarHilos(params: { estado?: string; idGeoElementoFo?: number; q?: string } = {}) {
    return this.api.listarHilos(params).pipe(map((r) => unwrapOrThrow<RedFoHilo[]>(r)));
  }

  listarPuertos(params: { estado?: string; idDispositivoPasivo?: number; q?: string } = {}) {
    return this.api.listarPuertos(params).pipe(map((r) => unwrapOrThrow<RedDispositivoPuerto[]>(r)));
  }

  listarBaseElementos(params: { idRedNodo?: number; idGeoTipoElemento?: number; q?: string; bbox?: string; limit?: number } = {}) {
    return this.api.listarBaseElementos(params).pipe(map((r) => unwrapOrThrow<RedBaseElemento[]>(r)));
  }

  // Acciones
  validarRelacionOficina(id: number, observacion?: string) {
    return this.api.validarRelacionOficina(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  validarRelacionCampo(id: number, observacion?: string) {
    return this.api.validarRelacionCampo(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  rechazarRelacion(id: number, observacion?: string) {
    return this.api.rechazarRelacion(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  relacionPendienteCampo(id: number, observacion?: string) {
    return this.api.relacionPendienteCampo(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }

  ponValidarOficina(id: number, observacion?: string) {
    return this.api.ponValidarOficina(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  ponValidarCampo(id: number, observacion?: string) {
    return this.api.ponValidarCampo(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  ponPendienteCampo(id: number, observacion?: string) {
    return this.api.ponPendienteCampo(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  ponRechazar(id: number, observacion?: string) {
    return this.api.ponRechazar(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  confirmarRatio(id: number, ratio: string, campo: boolean, observacion?: string) {
    return this.api.confirmarRatio(id, ratio, campo, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  rechazarSplitter(id: number, observacion?: string) {
    return this.api.rechazarSplitter(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  splitterPendienteCampo(id: number, observacion?: string) {
    return this.api.splitterPendienteCampo(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  noEncontradoSplitter(id: number, observacion?: string) {
    return this.api.noEncontradoSplitter(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }

  hiloEstado(id: number, estado: string, observacion?: string) {
    return this.api.hiloEstado(id, estado, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  puertoEstado(id: number, estado: string, observacion?: string) {
    return this.api.puertoEstado(id, estado, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  puertoAsociarHilo(id: number, idFoHilo: number | null, observacion?: string) {
    return this.api.puertoAsociarHilo(id, idFoHilo, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  puertoAsociarDestino(id: number, idGeoElementoDestino: number | null, observacion?: string) {
    return this.api.puertoAsociarDestino(id, idGeoElementoDestino, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  relacionReasignarDestino(id: number, idGeoElementoDestino: number | null, observacion?: string) {
    return this.api.elementoRelacionReasignarDestino(id, idGeoElementoDestino, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  crearRelacion(idOrigen: number, idDestino: number, observacion?: string) {
    return this.api.crearRelacion(idOrigen, idDestino, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }

  // Procesos
  generarRelacionesNap(idRedNodo?: number, minConfianza?: number) {
    return this.api.generarRelacionesNap(idRedNodo, minConfianza).pipe(map((r) => unwrapWithMsg<number>(r)));
  }
  generarSplittersContenidos(radioM?: number, minConfianza?: number) {
    return this.api.generarSplittersContenidos(radioM, minConfianza).pipe(map((r) => unwrapWithMsg<number>(r)));
  }
  generarPuertosSplitters(idDispositivoPasivo?: number) {
    return this.api.generarPuertosSplitters(idDispositivoPasivo).pipe(map((r) => unwrapWithMsg<number>(r)));
  }
  generarHilosFo(idGeoElementoFo?: number) {
    return this.api.generarHilosFo(idGeoElementoFo).pipe(map((r) => unwrapWithMsg<number>(r)));
  }
  generarPonFoSugerido(minConfianza?: number) {
    return this.api.generarPonFoSugerido(minConfianza).pipe(map((r) => unwrapWithMsg<number>(r)));
  }
}
