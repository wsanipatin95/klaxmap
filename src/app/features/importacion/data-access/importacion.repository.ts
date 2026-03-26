import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ImportacionApi } from './importacion.api';
import { ActInventarioUnidad, CiuPais, GenMoneda, ImpResumenSolicitud } from './importacion.models';

@Injectable({ providedIn: 'root' })
export class ImportacionRepository {
  private api = inject(ImportacionApi);

  private unwrap<T = any>(obs: Observable<any>): Observable<T> {
    return obs.pipe(map((res) => res?.data as T));
  }

  listarPaises(all = true) {
    return this.unwrap<{ items: CiuPais[] }>(this.api.paises({ all })).pipe(map((x) => x?.items ?? []));
  }

  listarMonedas(all = true) {
    return this.unwrap<{ items: GenMoneda[] }>(this.api.monedas({ all, soloActivos: true })).pipe(map((x) => x?.items ?? []));
  }

  listarUnidades(all = true) {
    return this.unwrap<{ items: ActInventarioUnidad[] }>(this.api.unidades({ all, soloActivos: true })).pipe(map((x) => x?.items ?? []));
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

  crearProveedorProspecto(payload: any) {
    return this.unwrap(this.api.crearProveedorProspecto(payload));
  }

  editarProveedorProspecto(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarProveedorProspecto(id, cambios));
  }

  eliminarProveedorProspecto(id: number) {
    return this.unwrap(this.api.eliminarProveedorProspecto(id));
  }

  listarProveedorProspectoContactos(idImpProveedorProspectoFk: number) {
    return this.unwrap<any>(this.api.proveedorProspectoContactos({ idImpProveedorProspectoFk, all: true })).pipe(
      map((x) => x?.items ?? [])
    );
  }

  crearProveedorProspectoContacto(payload: any) {
    return this.unwrap(this.api.crearProveedorProspectoContacto(payload));
  }

  editarProveedorProspectoContacto(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarProveedorProspectoContacto(id, cambios));
  }

  eliminarProveedorProspectoContacto(id: number) {
    return this.unwrap(this.api.eliminarProveedorProspectoContacto(id));
  }

  listarProveedorArticulosProspecto(q = '', page = 0, size = 20, idImpProveedorProspectoFk?: number | null) {
    return this.unwrap<any>(this.api.proveedorArticulosProspecto({
      q,
      page,
      size,
      all: false,
      ...(idImpProveedorProspectoFk ? { idImpProveedorProspectoFk } : {}),
    }));
  }

  crearProveedorArticuloProspecto(payload: any) {
    return this.unwrap(this.api.crearProveedorArticuloProspecto(payload));
  }

  editarProveedorArticuloProspecto(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarProveedorArticuloProspecto(id, cambios));
  }

  eliminarProveedorArticuloProspecto(id: number) {
    return this.unwrap(this.api.eliminarProveedorArticuloProspecto(id));
  }

  listarOfertas(q = '', page = 0, size = 20) {
    return this.unwrap<any>(this.api.ofertas({ q, page, size, all: false }));
  }

  crearOferta(payload: any) {
    return this.unwrap(this.api.crearOferta(payload));
  }

  editarOferta(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarOferta(id, cambios));
  }

  eliminarOferta(id: number) {
    return this.unwrap(this.api.eliminarOferta(id));
  }

  listarOfertaDetalles(idImpOfertaProveedorFk: number) {
    return this.unwrap<any>(this.api.ofertaDetalles({ idImpOfertaProveedorFk, all: true })).pipe(map((x) => x?.items ?? []));
  }

  crearOfertaDetalle(payload: any) {
    return this.unwrap(this.api.crearOfertaDetalle(payload));
  }

  editarOfertaDetalle(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarOfertaDetalle(id, cambios));
  }

  eliminarOfertaDetalle(id: number) {
    return this.unwrap(this.api.eliminarOfertaDetalle(id));
  }

  listarSolicitudes(q = '', page = 0, size = 20) {
    return this.unwrap<any>(this.api.solicitudes({ q, page, size, all: false }));
  }

  crearSolicitud(payload: any) {
    return this.unwrap(this.api.crearSolicitud(payload));
  }

  editarSolicitud(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarSolicitud(id, cambios));
  }

  eliminarSolicitud(id: number) {
    return this.unwrap(this.api.eliminarSolicitud(id));
  }

  listarSolicitudDetalles(idImpSolicitudGeneralFk: number) {
    return this.unwrap<any>(this.api.solicitudDetalles({ idImpSolicitudGeneralFk, all: true })).pipe(map((x) => x?.items ?? []));
  }

  crearSolicitudDetalle(payload: any) {
    return this.unwrap(this.api.crearSolicitudDetalle(payload));
  }

  editarSolicitudDetalle(id: number, cambios: Record<string, any>) {
    return this.unwrap(this.api.editarSolicitudDetalle(id, cambios));
  }

  eliminarSolicitudDetalle(id: number) {
    return this.unwrap(this.api.eliminarSolicitudDetalle(id));
  }

  agregarOferta(payload: any) {
    return this.unwrap(this.api.agregarOferta(payload));
  }

  seleccionarDetalle(payload: any) {
    return this.unwrap(this.api.seleccionarDetalle(payload));
  }

  cerrarSolicitud(payload: any) {
    return this.unwrap(this.api.cerrarSolicitud(payload));
  }

  reabrirSolicitud(payload: any) {
    return this.unwrap(this.api.reabrirSolicitud(payload));
  }

  resumenSolicitud(id: number) {
    return this.unwrap<ImpResumenSolicitud>(this.api.resumenSolicitud(id));
  }
}
