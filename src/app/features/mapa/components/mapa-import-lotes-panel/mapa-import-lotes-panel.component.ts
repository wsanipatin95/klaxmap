import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MapaImportLotesRepository } from '../../data-access/importacion/mapa-import-lotes.repository';
import type { MapaImportLoteResumen, PagedResponse } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-import-lotes-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-import-lotes-panel.component.html',
  styleUrl: './mapa-import-lotes-panel.component.scss',
})
export class MapaImportLotesPanelComponent {
  private repo = inject(MapaImportLotesRepository);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<MapaImportLoteResumen[]>([]);

  constructor() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    this.repo.listar({ all: true })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.items.set(
            Array.isArray(data)
              ? data
              : (data as PagedResponse<MapaImportLoteResumen>).content ?? []
          );
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar lotes');
        },
      });
  }

  estadoClass(estado: string): string {
    switch (estado) {
      case 'completado':
        return 'ok';
      case 'completado_con_observaciones':
        return 'warn';
      case 'fallido':
        return 'error';
      default:
        return 'info';
    }
  }
}