import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { ImportacionSolicitudesApi } from './solicitudes.api';
import {
  SolicitudGeneralGuardarRequest,
  SolicitudGeneralEditarRequest,
  SolicitudAgregarOfertaRequest,
  SolicitudSeleccionDetalleRequest,
  SolicitudCerrarRequest,
  SolicitudReabrirRequest,
  SolicitudCrearVersionRequest,
} from './solicitudes.models';

@Injectable({ providedIn: 'root' })
export class ImportacionSolicitudesRepository {
  private api = inject(ImportacionSolicitudesApi);

  listar(q = '', page = 0, size = 20, all = false) {
    return this.api.listar(q, page, size, all).pipe(map((r) => unwrapOrThrow(r)));
  }

  crear(payload: SolicitudGeneralGuardarRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editar(payload: SolicitudGeneralEditarRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  agregarOferta(payload: SolicitudAgregarOfertaRequest) {
    return this.api.agregarOferta(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  seleccionarDetalle(payload: SolicitudSeleccionDetalleRequest) {
    return this.api.seleccionarDetalle(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  cerrar(payload: SolicitudCerrarRequest) {
    return this.api.cerrar(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  reabrir(payload: SolicitudReabrirRequest) {
    return this.api.reabrir(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  resumen(id: number) {
    return this.api.resumen(id).pipe(map((r) => unwrapOrThrow(r)));
  }

  resumenDetallado(id: number) {
    return this.api.resumenDetallado(id).pipe(map((r) => unwrapOrThrow(r)));
  }

  validarCierre(id: number) {
    return this.api.validarCierre(id).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearVersion(payload: SolicitudCrearVersionRequest) {
    return this.api.crearVersion(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  historialVersiones(id: number) {
    return this.api.historialVersiones(id).pipe(map((r) => unwrapOrThrow(r)));
  }

  resumenFicha(idImpFichaProveedorFinal: number) {
    return this.api.resumenFicha(idImpFichaProveedorFinal).pipe(map((r) => unwrapOrThrow(r)));
  }
}
