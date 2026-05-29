import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  BkpEmptyStateComponent,
  BkpPageHeaderComponent,
  BkpStatusBadgeComponent,
} from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpRetentionRun, BkpStorageDestination } from '../../data-access/bkp.models';
import { fmtBytes, fmtDate, jsonPretty } from '../../data-access/bkp.shared';
import { labelStorageType } from '../../data-access/bkp.ux';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({
  selector: 'app-bkp-retention',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ConfirmDialogModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
    BkpStatusBadgeComponent,
  ],
  templateUrl: './retention.component.html',
  styleUrl: './retention.component.scss',
})
export class BkpRetentionComponent implements OnInit {
  private repo = inject(BkpRepository);
  private confirm = inject(BkpConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  loading = signal(false);
  running = signal(false);
  error = signal('');
  success = signal('');

  destinations = signal<BkpStorageDestination[]>([]);
  runs = signal<BkpRetentionRun[]>([]);
  selected = signal<BkpRetentionRun | null>(null);

  ngOnInit() {
    this.cargar();
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar() {
    const selectedId = this.selected()?.idBkpRetentionRun ?? null;

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      destinations: this.repo.listarDestinations('', 0, 100, true),
      runs: this.repo.listarRetentionRuns('', 0, 100, null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.destinations.set(r.destinations.items ?? []);
          this.runs.set(r.runs.items ?? []);

          const next = (r.runs.items ?? []).find(x => x.idBkpRetentionRun === selectedId) ?? (r.runs.items ?? [])[0] ?? null;
          this.selected.set(next);
        },
        error: e => this.setError('No se pudo cargar retención', e?.message),
      });
  }

  async ejecutarDestino(d: BkpStorageDestination) {
    const action = this.isLocal(d) ? `limpiar archivos vencidos de ${d.nombre}` : `registrar revisión de retención para ${d.nombre}`;
    if (!(await this.confirm.confirmRetention(action))) return;

    this.running.set(true);
    this.error.set('');
    this.success.set('');

    this.repo.ejecutarRetentionDestino(d.idBkpStorageDestination)
      .pipe(finalize(() => this.running.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.notify.success('Retención ejecutada', r.mensaje);
          this.cargar();
        },
        error: e => this.setError('No se pudo ejecutar retención', e?.message),
      });
  }

  async ejecutarTodos() {
    if (!(await this.confirm.confirmRetention('todos los destinos'))) return;

    this.running.set(true);
    this.error.set('');
    this.success.set('');

    this.repo.ejecutarRetentionTodos()
      .pipe(finalize(() => this.running.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.notify.success('Retención ejecutada', r.mensaje);
          this.cargar();
        },
        error: e => this.setError('No se pudo ejecutar retención', e?.message),
      });
  }

  seleccionarRun(r: BkpRetentionRun) {
    this.selected.set(r);
  }

  isLocal(d: BkpStorageDestination) {
    return String(d.tipoStorage || '').toUpperCase() === 'LOCAL';
  }

  retentionLabel(d: BkpStorageDestination) {
    return `${d.retentionDays ?? 30} día(s)`;
  }

  destinationPath(d: BkpStorageDestination) {
    return d.basePath || d.bucketName || d.folderId || d.prefixPath || '-';
  }

  retentionMode(d: BkpStorageDestination) {
    return this.isLocal(d)
      ? 'Limpieza directa en servidor KLAX API'
      : 'Registro/lifecycle del proveedor';
  }

  destinoLabel(id?: number | null) {
    return this.destinations().find(x => x.idBkpStorageDestination === id)?.nombre ?? (id ? `Destino #${id}` : 'Todos');
  }

  destinoTipo(id?: number | null) {
    return this.destinations().find(x => x.idBkpStorageDestination === id)?.tipoStorage ?? '';
  }

  selectedMetadata() {
    const r = this.selected();
    return r?.metadata ? jsonPretty(r.metadata) : '';
  }

  private setError(summary: string, detail?: string) {
    const msg = detail || summary;
    this.error.set(msg);
    this.notify.error(summary, detail);
  }

  labelStorageType = labelStorageType;
  fmtBytes = fmtBytes;
  fmtDate = fmtDate;
  jsonPretty = jsonPretty;
}
