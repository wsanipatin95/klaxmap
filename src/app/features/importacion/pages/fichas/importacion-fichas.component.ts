import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ImportacionPageHeaderComponent } from '../../components/page-header/page-header.component';
import { ImportacionEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { NotifyService } from 'src/app/core/services/notify.service';
import { ImportacionSolicitudesRepository } from '../../data-access/solicitudes.repository';
import { WorkflowResumenFicha } from '../../data-access/solicitudes.models';

@Component({
  selector: 'app-importacion-fichas',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TableModule, CardModule, TagModule, ImportacionPageHeaderComponent, ImportacionEmptyStateComponent],
  templateUrl: './importacion-fichas.component.html',
  styleUrl: './importacion-fichas.component.scss',
})
export class ImportacionFichasComponent {
  private repo = inject(ImportacionSolicitudesRepository);
  private notify = inject(NotifyService);

  idBusqueda: number | null = null;
  loading = signal(false);
  ficha = signal<WorkflowResumenFicha | null>(null);

  buscar() {
    if (!this.idBusqueda) {
      this.notify.warn('Falta ID', 'Ingresa el ID de la ficha proveedor final.');
      return;
    }
    this.loading.set(true);
    this.repo.resumenFicha(this.idBusqueda).subscribe({
      next: (dto) => { this.ficha.set(dto); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.notify.error('No se pudo obtener ficha', err?.message); },
    });
  }
}
