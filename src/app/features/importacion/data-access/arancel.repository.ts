import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { ImportacionArancelApi } from './arancel.api';
import { ReglaArancelaria, ReglaArancelariaEditarRequest, RequisitoArancelario, RequisitoArancelarioEditarRequest } from './arancel.models';

@Injectable({ providedIn: 'root' })
export class ImportacionArancelRepository {
  private api = inject(ImportacionArancelApi);

  listarReglas(q = '', page = 0, size = 20, all = false) {
    return this.api.listarReglas(q, page, size, all).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearRegla(payload: ReglaArancelaria) {
    return this.api.crearRegla(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarRegla(payload: ReglaArancelariaEditarRequest) {
    return this.api.editarRegla(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarRegla(id: number) {
    return this.api.eliminarRegla(id).pipe(map((r) => unwrapWithMsg(r)));
  }

  listarRequisitos(idImpReglaArancelariaFk: number) {
    return this.api.listarRequisitos(idImpReglaArancelariaFk).pipe(map((r) => unwrapOrThrow(r)));
  }

  crearRequisito(payload: RequisitoArancelario) {
    return this.api.crearRequisito(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  editarRequisito(payload: RequisitoArancelarioEditarRequest) {
    return this.api.editarRequisito(payload).pipe(map((r) => unwrapWithMsg(r)));
  }

  eliminarRequisito(id: number) {
    return this.api.eliminarRequisito(id).pipe(map((r) => unwrapWithMsg(r)));
  }
}
