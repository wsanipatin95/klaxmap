import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { MapaTiposApi } from './mapa-tipos.api';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
  MapaPatchRequest,
  PagedResponse,
  ListOrPageOptions,
} from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaTiposRepository {
  private api = inject(MapaTiposApi);

  listar(params: ListOrPageOptions = {}) {
    return this.api.listar(params).pipe(
      map((r) => unwrapOrThrow<PagedResponse<MapaTipoElemento> | MapaTipoElemento[]>(r))
    );
  }

  crear(payload: MapaTipoElementoSaveRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg<MapaTipoElemento>(r)));
  }

  editar(payload: MapaPatchRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg<MapaTipoElemento>(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg<{ id: number }>(r)));
  }
}