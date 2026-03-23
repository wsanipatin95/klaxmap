import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { finalize } from 'rxjs/operators';
import { MapaExportRepository } from '../../data-access/exportacion/mapa-export.repository';
import type { MapaExportRequest, MapaNodo, MapaTipoElemento } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-export-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule],
  templateUrl: './mapa-export-dialog.component.html',
  styleUrl: './mapa-export-dialog.component.scss',
})
export class MapaExportDialogComponent {
  private repo = inject(MapaExportRepository);

  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];

  @Output() exported = new EventEmitter<void>();

  visible = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  resultCount = signal(0);
  filterSummary = signal('Sin filtros');

  form: MapaExportRequest = {
    q: '',
    idRedNodoFk: null,
    idGeoTipoElementoFk: null,
    visible: true,
    nombreDocumento: 'mapa_red_isp',
  };

  open(
    prefill?: Partial<MapaExportRequest>,
    meta?: { resultCount?: number; filterSummary?: string }
  ) {
    this.visible.set(true);
    this.error.set(null);
    this.resultCount.set(meta?.resultCount ?? 0);
    this.filterSummary.set(meta?.filterSummary ?? 'Sin filtros');

    this.form = {
      q: prefill?.q ?? '',
      idRedNodoFk: prefill?.idRedNodoFk ?? null,
      idGeoTipoElementoFk: prefill?.idGeoTipoElementoFk ?? null,
      visible: prefill?.visible ?? true,
      nombreDocumento: prefill?.nombreDocumento ?? 'mapa_red_isp',
    };
  }

  close() {
    this.visible.set(false);
  }

  exportar() {
    this.loading.set(true);
    this.error.set(null);

    this.repo.exportarKml(this.form)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (blob) => {
          const name = (this.form.nombreDocumento || 'mapa_red_isp') + '.kml';
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
          this.exported.emit();
          this.close();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo exportar.');
        },
      });
  }
}