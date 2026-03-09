import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { MapaNodosRepository } from '../../data-access/nodo/mapa-nodos.repository';
import type { MapaNodo, MapaNodoSaveRequest, MapaPatchRequest, PagedResponse } from '../../data-access/mapa.models';
import { MapaNodoFormComponent } from '../../components/mapa-nodo-form/mapa-nodo-form.component';

@Component({
  selector: 'app-mapa-nodos',
  standalone: true,
  imports: [CommonModule, MapaNodoFormComponent],
  templateUrl: './mapa-nodos.component.html',
  styleUrl: './mapa-nodos.component.scss',
})
export class MapaNodosComponent {
  private repo = inject(MapaNodosRepository);

  loading = signal(false);
  error = signal<string | null>(null);
  nodos = signal<MapaNodo[]>([]);
  selected = signal<MapaNodo | null>(null);

  constructor() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.repo.listar({ all: true })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.nodos.set(Array.isArray(data) ? data : (data as PagedResponse<MapaNodo>).content ?? []);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar nodos');
        },
      });
  }

  seleccionar(n: MapaNodo) {
    this.selected.set(n);
  }

  crear(payload: MapaNodoSaveRequest) {
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