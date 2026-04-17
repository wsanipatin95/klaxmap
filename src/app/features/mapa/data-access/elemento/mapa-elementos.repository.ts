import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { MapaElementosApi } from './mapa-elementos.api';
import type {
  MapaElemento,
  MapaElementoSaveRequest,
  MapaPatchRequest,
  MapaElementoGeometriaRequest,
  PagedResponse,
} from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaElementosRepository {
  private api = inject(MapaElementosApi);

  listar(params: {
    q?: string;
    idRedNodoFk?: number | null;
    idGeoTipoElementoFk?: number | null;
    visible?: boolean | null;
    page?: number;
    size?: number;
    all?: boolean;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  } = {}) {
    return this.api.listar(params).pipe(
      map((r) => unwrapOrThrow<PagedResponse<MapaElemento> | MapaElemento[]>(r))
    );
  }

  crear(payload: MapaElementoSaveRequest) {
    return this.api.crear(payload).pipe(map((r) => unwrapWithMsg<MapaElemento>(r)));
  }

  editar(payload: MapaPatchRequest) {
    return this.api.editar(payload).pipe(map((r) => unwrapWithMsg<MapaElemento>(r)));
  }

  editarGeometria(payload: MapaElementoGeometriaRequest) {
    return this.api.editarGeometria(payload).pipe(
      map((r) => unwrapWithMsg<MapaElemento>(r))
    );
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg<MapaElemento>(r)));
  }

  restaurar(id: number) {
    return this.api.restaurar(id).pipe(map((r) => unwrapWithMsg<MapaElemento>(r)));
  }
}
