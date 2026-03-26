import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ImportacionApi } from './importacion.api';
import { ActInventarioUnidad, CiuPais, GenMoneda, ImpResumenSolicitud } from './importacion.models';

@Injectable({ providedIn: 'root' })
export class ImportacionRepository {
  private readonly api = inject(ImportacionApi);

  private unwrap<T = any>(obs: Observable<any>): Observable<T> {
    return obs.pipe(map((res) => res?.data as T));
  }

  listarPaises(all = true) {
    return this.unwrap<{ items: CiuPais[] }>(this.api.paises({ all })).pipe(
      map((x) => x?.items ?? [])
    );
  }

  listarMonedas(all = true) {
    return this.unwrap<{ items: GenMoneda[] }>(this.api.monedas({ all, soloActivos: true })).pipe(
      map((x) => x?.items ?? [])
    );
  }

  listarUnidades(all = true) {
    return this.unwrap<{ items: ActInventarioUnidad[] }>(this.api.unidades({ all, soloActivos: true })).pipe(
      map((x) => x?.items ?? [])
    );
  }

  cargarCatalogosBase() {
    return forkJoin({
      paises: this.listarPaises(true),
      monedas: this.listarMonedas(true),
      unidades: this.listarUnidades(true),
    });
  }

  listarProveedorProspectos(q = '', page = 0, size = 20, all = false) {
    return this.unwrap<any>(this.api.proveedorProspectos({ q, page, size, all }));
  }

  listarProveedorArticulosProspecto(q = '', page = 0, size = 20, all = false) {
    return this.unwrap<any>(this.api.proveedorArticulosProspecto({ q, page, size, all }));
  }

  listarOfertas(q = '', page = 0, size = 20, all = false) {
    return this.unwrap<any>(this.api.ofertas({ q, page, size, all }));
  }

  listarSolicitudes(q = '', page = 0, size = 20, all = false) {
    return this.unwrap<any>(this.api.solicitudes({ q, page, size, all }));
  }

  resumenSolicitud(id: number) {
    return this.unwrap<ImpResumenSolicitud>(this.api.resumenSolicitud(id));
  }
}
