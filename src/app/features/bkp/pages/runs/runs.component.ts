import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  BkpEmptyStateComponent,
  BkpPageHeaderComponent,
  BkpStatusBadgeComponent,
} from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpRunDetail, BkpRunResumen } from '../../data-access/bkp.models';
import { fmtBytes, fmtDate } from '../../data-access/bkp.ux';

type RunStatusOption = {
  value: string | null;
  label: string;
};

@Component({
  selector: 'app-bkp-runs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
    BkpStatusBadgeComponent,
  ],
  templateUrl: './runs.component.html',
  styleUrl: './runs.component.scss',
})
export class BkpRunsComponent implements OnInit {
  private repo = inject(BkpRepository);
  private router = inject(Router);

  items = signal<BkpRunResumen[]>([]);
  selected = signal<BkpRunResumen | null>(null);
  detail = signal<BkpRunDetail | null>(null);

  q = signal('');
  status = signal<string | null>(null);
  loading = signal(false);
  detailLoading = signal(false);
  error = signal('');

  statuses: RunStatusOption[] = [
    { value: null, label: 'Todos los estados' },
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'RUNNING', label: 'Ejecutando' },
    { value: 'SUCCESS', label: 'Correcto' },
    { value: 'FAILED', label: 'Fallido' },
    { value: 'PARTIAL_SUCCESS', label: 'Parcial' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];

  ngOnInit() {
    this.cargar();
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  irPlanes() {
    this.router.navigateByUrl('/app/backups/plans');
  }

  cargar() {
    const selectedId = this.selected()?.idBkpRun ?? null;

    this.loading.set(true);
    this.error.set('');

    this.repo.listarRuns(this.q(), 0, 200, this.status())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: p => {
          const list = p.items ?? [];
          this.items.set(list);

          if (!list.length) {
            this.selected.set(null);
            this.detail.set(null);
            return;
          }

          const next = list.find(x => x.idBkpRun === selectedId) ?? list[0];
          this.seleccionar(next);
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  seleccionar(i: BkpRunResumen) {
    this.selected.set(i);
    this.detailLoading.set(true);
    this.error.set('');

    this.repo.obtenerRunDetail(i.idBkpRun)
      .pipe(finalize(() => this.detailLoading.set(false)))
      .subscribe({
        next: d => this.detail.set(d),
        error: e => this.error.set(this.msg(e)),
      });
  }

  statusLabel(status?: string | null) {
    const value = String(status || '').toUpperCase();
    return this.statuses.find(x => x.value === value)?.label ?? value;
  }

  triggerLabel(value?: string | null) {
    const v = String(value || '').toUpperCase();
    if (v === 'MANUAL') return 'Manual';
    if (v === 'SCHEDULED') return 'Automática';
    if (v === 'RETRY') return 'Reintento';
    return value || 'No definido';
  }

  hasDumpInfo(d: BkpRunDetail) {
    const run = d.run;
    return !!(
      run.commandPreview ||
      run.localFilePath ||
      run.checksumSha256 ||
      run.checksumMd5 ||
      run.exitCode !== null && run.exitCode !== undefined
    );
  }

  hasError(d: BkpRunDetail) {
    return !!(d.run.errorMessage || d.run.errorDetail || (d.uploads ?? []).some(x => x.errorMessage || x.errorDetail));
  }

  uploadTarget(u: any) {
    return u.remotePath || u.remoteUrl || u.remoteFileId || '-';
  }

  fmtBytes = fmtBytes;
  fmtDate = fmtDate;

  private msg(e: unknown) {
    return e instanceof Error ? e.message : String((e as any)?.message || e || 'Error');
  }
}
