import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import { MapaImportLotesApi } from './mapa-import-lotes.api';
import type { MapaImportLoteResumen, PagedResponse } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaImportLotesRepository {
  private api = inject(MapaImportLotesApi);

  listar(params: {
    q?: string;
    page?: number;
    size?: number;
    all?: boolean;
  } = {}) {
    return this.api.listar(params).pipe(
      map((r) => unwrapOrThrow<PagedResponse<MapaImportLoteResumen> | MapaImportLoteResumen[]>(r))
    );
  }
}