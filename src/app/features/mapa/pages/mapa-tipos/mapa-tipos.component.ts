import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MapaTiposRepository } from '../../data-access/tipo-elemento/mapa-tipos.repository';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
  MapaPatchRequest,
  PagedResponse,
} from '../../data-access/mapa.models';
import { MapaTipoFormComponent } from '../../components/mapa-tipo-form/mapa-tipo-form.component';

@Component({
  selector: 'app-mapa-tipos',
  standalone: true,
  imports: [CommonModule, MapaTipoFormComponent],
  templateUrl: './mapa-tipos.component.html',
  styleUrl: './mapa-tipos.component.scss',
})
export class MapaTiposComponent {
  private repo = inject(MapaTiposRepository);

  loading = signal(false);
  error = signal<string | null>(null);
  tipos = signal<MapaTipoElemento[]>([]);
  selected = signal<MapaTipoElemento | null>(null);

  constructor() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.repo.listar({ all: true })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.tipos.set(Array.isArray(data) ? data : (data as PagedResponse<MapaTipoElemento>).content ?? []);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar tipos');
        },
      });
  }

  seleccionar(t: MapaTipoElemento) {
    this.selected.set(t);
  }

  crear(payload: MapaTipoElementoSaveRequest) {
    this.repo.crear(payload).subscribe({
      next: () => this.cargar(),
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo crear');
      },
    });
  }

  editar(payload: MapaPatchRequest) {
    this.repo.editar(payload).subscribe({
      next: () => this.cargar(),
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo editar');
      },
    });
  }

  eliminar(id: number) {
    this.repo.eliminar(id).subscribe({
      next: () => {
        this.selected.set(null);
        this.cargar();
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo eliminar');
      },
    });
  }
}