import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { MapaImportRepository } from '../../data-access/importacion/mapa-import.repository';
import type { MapaImportResult } from '../../data-access/mapa.models';

const EXTENSIONES_VALIDAS = ['.kml', '.kmz'];

@Component({
  selector: 'app-mapa-importar',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './mapa-importar.component.html',
  styleUrl: './mapa-importar.component.scss',
})
export class MapaImportarComponent {
  private repo = inject(MapaImportRepository);

  loading = signal(false);
  result = signal<MapaImportResult | null>(null);
  mensaje = signal<string | null>(null);
  error = signal<string | null>(null);
  selectedFile = signal<File | null>(null);

  private extensionValida(file: File): boolean {
    const nombre = file.name.toLowerCase();
    return EXTENSIONES_VALIDAS.some((ext) => nombre.endsWith(ext));
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.result.set(null);
    this.mensaje.set(null);
    if (file && !this.extensionValida(file)) {
      this.error.set('El archivo debe ser .kml o .kmz');
      this.selectedFile.set(null);
      return;
    }
    this.error.set(null);
    this.selectedFile.set(file);
  }

  importar() {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Seleccione un archivo KML o KMZ');
      return;
    }
    if (!this.extensionValida(file)) {
      this.error.set('El archivo debe ser .kml o .kmz');
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    this.repo.importarKml(file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.result.set(resp.data);
          this.mensaje.set(resp.mensaje || null);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo importar');
        },
      });
  }
}
