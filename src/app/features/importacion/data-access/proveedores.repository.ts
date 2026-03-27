import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { emptyPaged } from './importacion.shared';
import { ImportacionProveedoresApi } from './proveedores.api';
import {
  ProveedorProspecto,
  ProveedorProspectoGuardarRequest,
  ProveedorProspectoEditarRequest,
  ProveedorProspectoContacto,
  ProveedorProspectoContactoGuardarRequest,
  ProveedorProspectoContactoEditarRequest,
  ProveedorProspectoDocumento,
  ProveedorProspectoDocumentoGuardarRequest,
  ProveedorProspectoDocumentoEditarRequest,
} from './proveedores.models';

@Injectable({ providedIn: 'root' })
export class ImportacionProveedoresRepository {
  private api = inject(ImportacionProveedoresApi);

  listar(q = '', page = 0, size = 20, all = false) {
    return this.api.listar({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));
  }

  crear(payload: ProveedorProspectoGuardarRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editar(payload: ProveedorProspectoEditarRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarContactos(idImpProveedorProspectoFk: number) {
    return this.api.listarContactos({ all: true }).pipe(
      map((r) => unwrapOrThrow(r)),
      map((paged) => ({ ...paged, items: (paged.items ?? []).filter((x: ProveedorProspectoContacto) => x.idImpProveedorProspectoFk === idImpProveedorProspectoFk) })),
    );
  }

  crearContacto(payload: ProveedorProspectoContactoGuardarRequest) {
    return this.api.crearContacto(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarContacto(payload: ProveedorProspectoContactoEditarRequest) {
    return this.api.editarContacto(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarContacto(id: number) {
    return this.api.eliminarContacto(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarDocumentos(idImpProveedorProspectoFk: number) {
    return this.api.listarDocumentos(idImpProveedorProspectoFk, { all: true }).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearDocumento(payload: ProveedorProspectoDocumentoGuardarRequest) {
    return this.api.crearDocumento(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarDocumento(payload: ProveedorProspectoDocumentoEditarRequest) {
    return this.api.editarDocumento(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarDocumento(id: number) {
    return this.api.eliminarDocumento(id).pipe(map((r) => unwrapWithMsg(r)));
  }
}
