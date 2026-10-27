import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { MapaAccesosApi } from './mapa-accesos.api';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import type { MapaAcceso } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaAccesosRepository {
  private api = inject(MapaAccesosApi);

  listar(q?: string | null) {
    return this.api.listar(q).pipe(map((r) => unwrapOrThrow<MapaAcceso[]>(r)));
  }

  detalle(id: number) {
    return this.api.detalle(id).pipe(map((r) => unwrapOrThrow<MapaAcceso>(r)));
  }

  guardar(req: MapaAcceso) {
    return this.api.guardar(req).pipe(map((r) => unwrapWithMsg<MapaAcceso>(r)));
  }

  eliminar(id: number) {
    return this.api.eliminar(id).pipe(map((r) => unwrapWithMsg<unknown>(r)));
  }
}
