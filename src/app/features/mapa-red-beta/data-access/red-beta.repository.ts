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

  listarBaseElementos() {
    return this.api.listarBaseElementos().pipe(
      map((r) => {
        const data = unwrapOrThrow<RedBaseElemento[] | { content: RedBaseElemento[] }>(r);
        return Array.isArray(data) ? data : data?.content ?? [];
      })
    );
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
  confirmarRatio(id: number, ratio: string, campo: boolean, observacion?: string) {
    return this.api.confirmarRatio(id, ratio, campo, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  rechazarSplitter(id: number, observacion?: string) {
    return this.api.rechazarSplitter(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
  splitterPendienteCampo(id: number, observacion?: string) {
    return this.api.splitterPendienteCampo(id, observacion).pipe(map((r) => unwrapWithMsg<unknown>(r)));
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
