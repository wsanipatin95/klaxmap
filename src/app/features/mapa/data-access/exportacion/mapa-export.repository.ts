import { Injectable, inject } from '@angular/core';
import { MapaExportApi } from './mapa-export.api';
import type { MapaExportRequest } from '../mapa.models';

@Injectable({ providedIn: 'root' })
export class MapaExportRepository {
  private api = inject(MapaExportApi);

  exportarKml(payload: MapaExportRequest) {
    return this.api.exportarKml(payload);
  }
}