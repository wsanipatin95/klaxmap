import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { ImportacionArticulosApi } from './articulos.api';
import {
  ArticuloProspectoGuardarRequest,
  ArticuloProspectoEditarRequest,
  ArticuloImagenGuardarRequest,
  ArticuloAtributoGuardarRequest,
  ArticuloHomologacionGuardarRequest,
  ArticuloClasificacionGuardarRequest,
} from './articulos.models';

@Injectable({ providedIn: 'root' })
export class ImportacionArticulosRepository {
  private api = inject(ImportacionArticulosApi);

  listar(q = '', page = 0, size = 20, all = false) {
    return this.api.listar({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));
  }

  crear(payload: ArticuloProspectoGuardarRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editar(payload: ArticuloProspectoEditarRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarImagenes(idImpProveedorArticuloProspectoFk: number) {
    return this.api.listarImagenes(idImpProveedorArticuloProspectoFk).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearImagen(payload: ArticuloImagenGuardarRequest) {
    return this.api.crearImagen(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarImagen(payload: { idImpProveedorArticuloProspectoImagen: number; cambios: Partial<ArticuloImagenGuardarRequest> }) {
    return this.api.editarImagen(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarImagen(id: number) {
    return this.api.eliminarImagen(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarAtributos(idImpProveedorArticuloProspectoFk: number) {
    return this.api.listarAtributos(idImpProveedorArticuloProspectoFk).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearAtributo(payload: ArticuloAtributoGuardarRequest) {
    return this.api.crearAtributo(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarAtributo(payload: { idImpProveedorArticuloProspectoAtributo: number; cambios: Partial<ArticuloAtributoGuardarRequest> }) {
    return this.api.editarAtributo(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarAtributo(id: number) {
    return this.api.eliminarAtributo(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarHomologaciones(idImpProveedorArticuloProspectoFk: number) {
    return this.api.listarHomologaciones(idImpProveedorArticuloProspectoFk).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearHomologacion(payload: ArticuloHomologacionGuardarRequest) {
    return this.api.crearHomologacion(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  aprobarHomologacion(payload: { idImpProveedorArticuloHomologacion: number; idActInventarioFk?: number | null; idActInventarioUnidadFk?: number | null; idImpCodigoArancelarioFk?: number | null; clasificacionConfirmada?: boolean | null; observacion?: string | null }) {
    return this.api.aprobarHomologacion(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  rechazarHomologacion(payload: { idImpProveedorArticuloHomologacion: number; observacion?: string | null }) {
    return this.api.rechazarHomologacion(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarClasificaciones(idImpProveedorArticuloProspectoFk: number) {
    return this.api.listarClasificaciones(idImpProveedorArticuloProspectoFk).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearClasificacion(payload: ArticuloClasificacionGuardarRequest) {
    return this.api.crearClasificacion(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  confirmarClasificacion(payload: { idImpArticuloClasificacion: number; observacion?: string | null }) {
    return this.api.confirmarClasificacion(payload).pipe(map((r) => unwrapWithMsg(r)));
  }
}
