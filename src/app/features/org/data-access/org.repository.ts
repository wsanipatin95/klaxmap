import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { OrgApi } from './org.api';

import { EmpresaCreateRequest, EmpresaEditRequest, Paged, EmpresaDto } from './org.models';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';

@Injectable({ providedIn: 'root' })
export class OrgRepository {
  private api = inject(OrgApi);

  listarEmpresas(idOrganizacion: number, page = 0, size = 20, all = false) {
    return this.api.listarEmpresas({ idOrganizacion, page, size, all }).pipe(
      map((r) => unwrapOrThrow<Paged<EmpresaDto>>(r)),
    );
  }

  registrarEmpresa(payload: EmpresaCreateRequest) {
    return this.api.registrarEmpresa(payload).pipe(
      map((r) => unwrapWithMsg<{ id: string }>(r)),
    );
  }

  editarEmpresa(payload: EmpresaEditRequest) {
    return this.api.editarEmpresa(payload).pipe(
      map((r) => unwrapWithMsg<{ id: string }>(r)),
    );
  }
}
