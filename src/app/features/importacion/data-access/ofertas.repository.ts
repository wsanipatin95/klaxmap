import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { ImportacionOfertasApi } from './ofertas.api';
import {
  OfertaProveedorGuardarRequest,
  OfertaProveedorVersionarRequest,
  OfertaProveedorEditarRequest,
  OfertaProveedorDocumento,
} from './ofertas.models';

@Injectable({ providedIn: 'root' })
export class ImportacionOfertasRepository {
  private api = inject(ImportacionOfertasApi);

  listar(q = '', page = 0, size = 20, all = false) {
    return this.api.listar(q, page, size, all).pipe(map((r) => unwrapOrThrow(r)));
  }

  crear(payload: OfertaProveedorGuardarRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  versionar(payload: OfertaProveedorVersionarRequest) {
    return this.api.versionar(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editar(payload: OfertaProveedorEditarRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarDocumentos(idImpOfertaProveedorFk: number) {
    return this.api.listarDocumentos(idImpOfertaProveedorFk).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearDocumento(payload: Omit<OfertaProveedorDocumento, 'idImpOfertaProveedorDocumento'>) {
    return this.api.crearDocumento(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarDocumento(payload: { idImpOfertaProveedorDocumento: number; cambios: Partial<Omit<OfertaProveedorDocumento, 'idImpOfertaProveedorDocumento'>> }) {
    return this.api.editarDocumento(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarDocumento(id: number) {
    return this.api.eliminarDocumento(id).pipe(map((r) => unwrapWithMsg(r)));
  }
}
