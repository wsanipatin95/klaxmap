import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
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
 * Cliente HTTP de la beta de red operativa. Usa exclusivamente los endpoints ya creados
 * en el backend bajo /api/erp/red. La capa base se lee del modulo mapa existente
 * (/api/erp/mapa/elemento) sin modificarlo.
 */
@Injectable({ providedIn: 'root' })
export class RedBetaApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private base = `${this.env.apiBaseUrl}/api/erp/red`;
  private mapaBase = `${this.env.apiBaseUrl}/api/erp/mapa`;

  // ---------------------------------------------------------------- Lecturas

  resumen() {
    return this.http.get<ApiEnvelope<RedResumenItem[]>>(`${this.base}/resumen-operativo`);
  }

  listarRelaciones(params: { estado?: string; tipoRelacion?: string; idRedNodo?: number; q?: string } = {}) {
    return this.http.get<ApiEnvelope<RedElementoRelacion[]>>(`${this.base}/elemento-relacion/listar`, {
      params: this.toParams({ ...params, all: true }),
    });
  }

  listarPonFo(params: { estado?: string; q?: string } = {}) {
    return this.http.get<ApiEnvelope<RedPonElementoRelacion[]>>(`${this.base}/pon-elemento-relacion/listar`, {
      params: this.toParams({ ...params, all: true }),
    });
  }

  listarSplitters(params: { estado?: string; ratio?: string; q?: string } = {}) {
    return this.http.get<ApiEnvelope<RedDispositivoPasivo[]>>(`${this.base}/dispositivo-pasivo/listar`, {
      params: this.toParams({ ...params, all: true }),
    });
  }

  listarHilos(params: { estado?: string; idGeoElementoFo?: number; q?: string } = {}) {
    return this.http.get<ApiEnvelope<RedFoHilo[]>>(`${this.base}/fo-hilo/listar`, {
      params: this.toParams({ ...params, all: true }),
    });
  }

  listarPuertos(params: { estado?: string; idDispositivoPasivo?: number; q?: string } = {}) {
    return this.http.get<ApiEnvelope<RedDispositivoPuerto[]>>(`${this.base}/dispositivo-puerto/listar`, {
      params: this.toParams({ ...params, all: true }),
    });
  }

  /** Capa fisica base: endpoint liviano dedicado de la beta (/api/erp/red/base-elemento/listar). */
  listarBaseElementos(params: { idRedNodo?: number; idGeoTipoElemento?: number; q?: string; bbox?: string; limit?: number } = {}) {
    return this.http.get<ApiEnvelope<RedBaseElemento[]>>(`${this.base}/base-elemento/listar`, {
      params: this.toParams({ ...params }),
    });
  }

  // ---------------------------------------------------------------- Acciones relacion fisica

  validarRelacionOficina(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/elemento-relacion/${id}/validar-oficina`, { observacion });
  }
  validarRelacionCampo(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/elemento-relacion/${id}/validar-campo`, { observacion });
  }
  rechazarRelacion(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/elemento-relacion/${id}/rechazar`, { observacion });
  }
  relacionPendienteCampo(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/elemento-relacion/${id}/pendiente-campo`, { observacion });
  }

  ponValidarOficina(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/pon-elemento-relacion/${id}/validar-oficina`, { observacion });
  }
  ponValidarCampo(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/pon-elemento-relacion/${id}/validar-campo`, { observacion });
  }
  ponPendienteCampo(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/pon-elemento-relacion/${id}/pendiente-campo`, { observacion });
  }
  ponRechazar(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/pon-elemento-relacion/${id}/rechazar`, { observacion });
  }

  // ---------------------------------------------------------------- Acciones splitter

  confirmarRatio(id: number, ratioSplitter: string, validadoEnCampo: boolean, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-pasivo/${id}/confirmar-ratio`, {
      ratioSplitter,
      validadoEnCampo,
      observacion,
    });
  }
  rechazarSplitter(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-pasivo/${id}/rechazar`, { observacion });
  }
  splitterPendienteCampo(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-pasivo/${id}/pendiente-campo`, { observacion });
  }
  noEncontradoSplitter(id: number, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-pasivo/${id}/no-encontrado`, { observacion });
  }

  // ---------------------------------------------------------------- Edicion hilos / puertos
  hiloEstado(id: number, estado: string, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/fo-hilo/${id}/estado`, { estado, observacion });
  }
  puertoEstado(id: number, estado: string, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-puerto/${id}/estado`, { estado, observacion });
  }
  puertoAsociarHilo(id: number, idFoHilo: number | null, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-puerto/${id}/asociar-hilo`, { idFoHilo, observacion });
  }
  puertoAsociarDestino(id: number, idGeoElementoDestino: number | null, observacion?: string) {
    return this.http.patch<ApiEnvelope<unknown>>(`${this.base}/dispositivo-puerto/${id}/asociar-destino`, { idGeoElementoDestino, observacion });
  }

  // ---------------------------------------------------------------- Procesos (cursores kxfp_)

  generarRelacionesNap(idRedNodo?: number, minConfianza?: number) {
    return this.http.post<ApiEnvelope<number>>(`${this.base}/proceso/generar-relaciones-nap`, { idRedNodo, minConfianza });
  }
  generarSplittersContenidos(radioM?: number, minConfianza?: number) {
    return this.http.post<ApiEnvelope<number>>(`${this.base}/proceso/generar-splitters-contenidos`, { radioM, minConfianza });
  }
  generarPuertosSplitters(idDispositivoPasivo?: number) {
    return this.http.post<ApiEnvelope<number>>(`${this.base}/proceso/generar-puertos-splitters`, { idDispositivoPasivo });
  }
  generarHilosFo(idGeoElementoFo?: number) {
    return this.http.post<ApiEnvelope<number>>(`${this.base}/proceso/generar-hilos-fo`, { idGeoElementoFo });
  }
  generarPonFoSugerido(minConfianza?: number) {
    return this.http.post<ApiEnvelope<number>>(`${this.base}/proceso/generar-pon-fo-sugerido`, { minConfianza });
  }

  // ---------------------------------------------------------------- helpers

  private toParams(obj: Record<string, unknown>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') {
        p = p.set(k, String(v));
      }
    }
    return p;
  }
}
