import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { MapaImportRepository } from '../../data-access/importacion/mapa-import.repository';

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
  result = signal<any | null>(null);
  error = signal<string | null>(null);
  selectedFile = signal<File | null>(null);

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
  }

  importar() {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Seleccione un archivo KML');
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    this.repo.importarKml(file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.result.set(resp),
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo importar');
        },
      });
  }
}