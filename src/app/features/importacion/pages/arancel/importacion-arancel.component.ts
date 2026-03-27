import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ImportacionPageHeaderComponent } from '../../components/page-header/page-header.component';
import { ImportacionEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { NotifyService } from 'src/app/core/services/notify.service';
import { ImportacionArancelRepository } from '../../data-access/arancel.repository';
import { ReglaArancelaria } from '../../data-access/arancel.models';

@Component({
  selector: 'app-importacion-arancel',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, TableModule, InputTextModule, TextareaModule, CardModule, TagModule, ImportacionPageHeaderComponent, ImportacionEmptyStateComponent],
  templateUrl: './importacion-arancel.component.html',
  styleUrl: './importacion-arancel.component.scss',
})
export class ImportacionArancelComponent {
  private repo = inject(ImportacionArancelRepository);
  private notify = inject(NotifyService);
  private fb = inject(FormBuilder);

  q = '';
  loading = signal(false);
  items = signal<ReglaArancelaria[]>([]);
  seleccionada = signal<ReglaArancelaria | null>(null);
  requisitos = signal<any[]>([]);

  form = this.fb.group({
    idImpCodigoArancelarioFk: [null as number | null, Validators.required],
    regimenAduanero: ['IMPORTACION'],
    acuerdoComercial: [''],
    requiereCertificadoOrigen: [false],
    adValoremPct: [0],
    ivaPct: [0],
    fodinfaPct: [0],
    icePct: [0],
    prioridad: [1],
    estadoRegla: ['BORRADOR'],
    baseLegal: [''],
    observacion: [''],
  });

  constructor() { this.cargar(); }

  cargar() {
    this.loading.set(true);
    this.repo.listarReglas(this.q, 0, 100, true).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (paged) => this.items.set(paged.items ?? []),
      error: (err) => this.notify.error('No se pudo cargar reglas arancelarias', err?.message),
    });
  }

  seleccionar(item: ReglaArancelaria) {
    this.seleccionada.set(item);
    if (!item.idImpReglaArancelaria) return;
    this.repo.listarRequisitos(item.idImpReglaArancelaria).subscribe({
      next: (paged) => this.requisitos.set(paged.items ?? []),
      error: (err) => this.notify.error('No se pudieron cargar requisitos', err?.message),
    });
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue() as any;
    this.repo.crearRegla(raw).subscribe({ next: (res) => { this.notify.success('Regla creada', res.mensaje); this.form.reset({ regimenAduanero: 'IMPORTACION', prioridad: 1, estadoRegla: 'BORRADOR', requiereCertificadoOrigen: false, adValoremPct: 0, ivaPct: 0, fodinfaPct: 0, icePct: 0 }); this.cargar(); }, error: (err) => this.notify.error('No se pudo crear regla', err?.message) });
  }
}
