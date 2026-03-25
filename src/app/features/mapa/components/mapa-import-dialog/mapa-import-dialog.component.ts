import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Output, ViewChild, inject, signal } from '@angular/core';
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

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  visible = signal(false);
  loading = signal(false);
  selectedFile = signal<File | null>(null);
  error = signal<string | null>(null);
  result = signal<MapaImportResult | null>(null);

  @Output() imported = new EventEmitter<MapaImportResult>();

  get fileName(): string {
    return this.selectedFile()?.name || 'Sin archivo';
  }

  open() {
    if (this.loading()) return;

    this.visible.set(true);
    this.resetState();
  }

  close() {
    if (this.loading()) return;

    this.visible.set(false);
    this.resetState();
  }

  onDialogVisibilityChange(next: boolean) {
    if (this.loading()) {
      this.visible.set(true);
      return;
    }

    this.visible.set(next);

    if (!next) {
      this.resetState();
    }
  }

  onFileSelected(event: Event) {
    if (this.loading()) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.error.set(null);
    this.result.set(null);

    if (!file) {
      this.selectedFile.set(null);
      return;
    }

    const fileName = file.name.toLowerCase();
    const validExtension = fileName.endsWith('.kml') || fileName.endsWith('.kmz');

    if (!validExtension) {
      this.selectedFile.set(null);
      this.error.set('Selecciona un archivo válido .kml o .kmz.');
      this.clearNativeFileInput();
      return;
    }

    this.selectedFile.set(file);
  }

  importar() {
    if (this.loading()) return;

    const file = this.selectedFile();
    if (!file) {
      this.error.set('Selecciona un archivo KML o KMZ.');
      return;
    }

    this.error.set(null);
    this.result.set(null);
    this.loading.set(true);

    this.repo
      .importarKml(file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.result.set(resp.data);
          this.imported.emit(resp.data);
          this.clearNativeFileInput();
          this.selectedFile.set(null);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo importar.');
        },
      });
  }

  private resetState() {
    this.error.set(null);
    this.result.set(null);
    this.selectedFile.set(null);
    this.clearNativeFileInput();
  }

  private clearNativeFileInput() {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}