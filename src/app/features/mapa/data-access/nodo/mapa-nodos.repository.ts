import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { MapaNodosApi } from './mapa-nodos.api';
import type {
  MapaNodo,
  MapaNodoSaveRequest,
  MapaPatchRequest,
  PagedResponse,
  ListOrPageOptions,
} from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaNodosRepository {
  private api = inject(MapaNodosApi);

  listar(params: ListOrPageOptions = {}) {
    return this.api.listar(params).pipe(
      map((r) => unwrapOrThrow<PagedResponse<MapaNodo> | MapaNodo[]>(r))
    );
  }

  crear(payload: MapaNodoSaveRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg<MapaNodo>(r)));
  }

  editar(payload: MapaPatchRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg<MapaNodo>(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg<MapaNodo>(r)));
  }

  restaurar(id: number) {
    return this.api.restaurar(id).pipe(map((r) => unwrapWithMsg<MapaNodo>(r)));
  }
}
