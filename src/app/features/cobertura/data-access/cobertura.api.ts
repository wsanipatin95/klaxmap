import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import type { ApiEnvelope } from 'src/app/core/api/api-envelope';
import type { CoberturaNap, CoberturaNapClientes, CoberturaClienteGeo, CoberturaElementoMeta, CoberturaOlt, CoberturaNapPon, CoberturaLpuPon, CoberturaZona } from './cobertura.models';

/**
 * Cliente HTTP de la vista de Cobertura. Reusa endpoints existentes:
 *  - NAP con clientes: /api/erp/red/cobertura/naps
 *  - detalle por puerto: /api/erp/mapa/elemento/{id}/clientes  (el del mapa viejo)
 */
@Injectable({ providedIn: 'root' })
export class CoberturaApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private base = `${this.env.apiBaseUrl}/api/erp`;

  listarNaps(radioM = 500) {
    const params = new HttpParams().set('radioM', String(radioM));
    return this.http
      .get<ApiEnvelope<CoberturaNap[]>>(`${this.base}/red/cobertura/naps`, { params })
      .pipe(map((r) => unwrapOrThrow<CoberturaNap[]>(r)));
  }

  /** Todos los clientes atachados por GPS (para agrupar por NAP en el front). */
  listarClientesGeo(radioM = 500) {
    const params = new HttpParams().set('radioM', String(radioM));
    return this.http
      .get<ApiEnvelope<CoberturaClienteGeo[]>>(`${this.base}/red/cobertura/clientes`, { params })
      .pipe(map((r) => unwrapOrThrow<CoberturaClienteGeo[]>(r)));
  }

  /** Zonas (barrios) para el coroplético. */
  listarZonas(eps = 300) {
    const params = new HttpParams().set('eps', String(eps));
    return this.http
      .get<ApiEnvelope<CoberturaZona[]>>(`${this.base}/red/cobertura/zonas`, { params })
      .pipe(map((r) => unwrapOrThrow<CoberturaZona[]>(r)));
  }

  /** Metadatos visuales de los elementos base (etiqueta corta, icono, colores) — mismo endpoint del mapa real. */
  listarBaseElementos() {
    return this.http
      .get<ApiEnvelope<CoberturaElementoMeta[]>>(`${this.base}/red/base-elemento/listar`)
      .pipe(map((r) => unwrapOrThrow<CoberturaElementoMeta[]>(r)));
  }

  clientesNap(idGeoElemento: number) {
    return this.http
      .get<ApiEnvelope<CoberturaNapClientes>>(`${this.base}/mapa/elemento/${idGeoElemento}/clientes`)
      .pipe(map((r) => unwrapOrThrow<CoberturaNapClientes>(r)));
  }

  // ---- Confirmador de PON (wizard) ----

  /** OLTs para el combo. */
  listarOlts() {
    return this.http
      .get<ApiEnvelope<CoberturaOlt[]>>(`${this.base}/red/cobertura/olts`)
      .pipe(map((r) => unwrapOrThrow<CoberturaOlt[]>(r)));
  }

  /** LPU-PON reales de una OLT (tarjeta/puerto). */
  listarPons(idRedOlt: number) {
    return this.http
      .get<ApiEnvelope<CoberturaLpuPon[]>>(`${this.base}/red/cobertura/olts/${idRedOlt}/pons`)
      .pipe(map((r) => unwrapOrThrow<CoberturaLpuPon[]>(r)));
  }

  /** Amarres confirmados de una NAP. */
  napPons(idGeoElemento: number) {
    return this.http
      .get<ApiEnvelope<CoberturaNapPon[]>>(`${this.base}/red/cobertura/nap/${idGeoElemento}/pons`)
      .pipe(map((r) => unwrapOrThrow<CoberturaNapPon[]>(r)));
  }

  /** Guarda un amarre NAP <-> (OLT, PON). */
  guardarNapPon(body: CoberturaNapPon) {
    return this.http
      .post<ApiEnvelope<CoberturaNapPon>>(`${this.base}/red/cobertura/nap-pon`, body)
      .pipe(map((r) => unwrapOrThrow<CoberturaNapPon>(r)));
  }

  /** Elimina un amarre. */
  eliminarNapPon(idRedNapPon: number) {
    return this.http
      .delete<ApiEnvelope<number>>(`${this.base}/red/cobertura/nap-pon/${idRedNapPon}`)
      .pipe(map((r) => unwrapOrThrow<number>(r)));
  }
}
