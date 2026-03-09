import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { MapaImportApi } from './mapa-import.api';
import type { MapaImportResult } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaImportRepository {
  private api = inject(MapaImportApi);

  importarKml(file: File) {
    return this.api.importarKml(file).pipe(
      map((r) => unwrapWithMsg<MapaImportResult>(r))
    );
  }
}