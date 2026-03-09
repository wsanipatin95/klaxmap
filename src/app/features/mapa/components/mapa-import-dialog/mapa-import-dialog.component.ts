import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MapaImportRepository } from '../../data-access/importacion/mapa-import.repository';
import type { MapaImportResult } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-import-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './mapa-import-dialog.component.html',
  styleUrl: './mapa-import-dialog.component.scss',
})
export class MapaImportDialogComponent {
  private repo = inject(MapaImportRepository);

  visible = signal(false);
  loading = signal(false);
  selectedFile = signal<File | null>(null);
  error = signal<string | null>(null);
  result = signal<MapaImportResult | null>(null);

  @Output() imported = new EventEmitter<MapaImportResult>();

  open() {
    this.visible.set(true);
    this.error.set(null);
    this.result.set(null);
    this.selectedFile.set(null);
  }

  close() {
    this.visible.set(false);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  importar() {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Debe seleccionar un archivo KML');
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    this.repo.importarKml(file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.result.set(resp.data);
          this.imported.emit(resp.data);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo importar el archivo');
        },
      });
  }
}