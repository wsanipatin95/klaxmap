import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  BkpEmptyStateComponent,
  BkpPageHeaderComponent,
  BkpStatusBadgeComponent,
} from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpAgentNode, BkpRestoreRequest, BkpRestoreRun, BkpRunResumen, BkpSecret } from '../../data-access/bkp.models';
import { fmtDate, jsonPretty } from '../../data-access/bkp.shared';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { NotifyService } from 'src/app/core/services/notify.service';

type RestoreTypeOption = {
  value: string;
  label: string;
  hint: string;
};

@Component({
  selector: 'app-bkp-restores',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
    BkpStatusBadgeComponent,
  ],
  templateUrl: './restores.component.html',
  styleUrl: './restores.component.scss',
})
export class BkpRestoresComponent implements OnInit, PendingChangesAware {
  private repo = inject(BkpRepository);
  private confirm = inject(BkpConfirmService);
  private notify = inject(NotifyService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal('');
  success = signal('');

  runs = signal<BkpRunResumen[]>([]);
  agents = signal<BkpAgentNode[]>([]);
  secrets = signal<BkpSecret[]>([]);
  restores = signal<BkpRestoreRun[]>([]);
  selected = signal<BkpRestoreRun | null>(null);
  technicalOpen = signal(false);

  restoreTypes: RestoreTypeOption[] = [
    { value: 'TEST', label: 'TEST - prueba segura', hint: 'Valida que el archivo restaura en una base de prueba.' },
    { value: 'DRILL', label: 'DRILL - simulacro', hint: 'Simulacro controlado de recuperación.' },
    { value: 'REAL', label: 'REAL - recuperación real', hint: 'Recuperación real. Requiere confirmación fuerte.' },
  ];

  form = this.fb.group({
    idBkpRun: [null as number | null, Validators.required],
    idBkpAgentNode: [null as number | null],
    restoreType: ['TEST', Validators.required],
    targetHost: [''],
    targetPort: [null as number | null, [Validators.min(1), Validators.max(65535)]],
    targetDatabase: ['', Validators.required],
    targetSchema: [''],
    targetUsuario: [''],
    idBkpSecretPassword: [null as number | null],
    cleanBeforeRestore: [false],
    extraRestoreArgs: [''],
  });

  ngOnInit() {
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.success.set('');
    });

    this.form.get('idBkpRun')?.valueChanges.subscribe(id => this.applyRunDefaults(id));
    this.cargar();
  }

  canDeactivate() {
    return !this.dirty() || this.confirm.confirmDiscard();
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar() {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      runs: this.repo.listarRuns('', 0, 100, 'SUCCESS'),
      agents: this.repo.listarAgents('', 0, 100, true),
      secrets: this.repo.listarSecrets('', 0, 200, true),
      restores: this.repo.listarRestores('', 0, 100, null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.runs.set(r.runs.items ?? []);
          this.agents.set(r.agents.items ?? []);
          this.secrets.set(r.secrets.items ?? []);
          this.restores.set(r.restores.items ?? []);

          if (!this.selected() && (r.restores.items ?? []).length) {
            this.selected.set((r.restores.items ?? [])[0]);
          }
        },
        error: e => this.setError('No se pudo cargar restauraciones', e?.message),
      });
  }

  nuevo() {
    this.selected.set(null);
    this.technicalOpen.set(false);

    this.form.reset({
      idBkpRun: null,
      idBkpAgentNode: null,
      restoreType: 'TEST',
      targetHost: '',
      targetPort: null,
      targetDatabase: '',
      targetSchema: '',
      targetUsuario: '',
      idBkpSecretPassword: null,
      cleanBeforeRestore: false,
      extraRestoreArgs: '',
    });

    this.clean();
  }

  seleccionar(x: BkpRestoreRun) {
    this.selected.set(x);
    this.technicalOpen.set(false);

    this.form.patchValue({
      idBkpRun: x.idBkpRunFk,
      idBkpAgentNode: x.idBkpAgentNodeFk ?? null,
      restoreType: x.restoreType ?? 'TEST',
      targetHost: x.targetHost ?? '',
      targetPort: x.targetPort ?? null,
      targetDatabase: x.targetDatabase ?? '',
      targetSchema: x.targetSchema ?? '',
    }, { emitEvent: false });

    this.clean();
  }

  async ejecutar() {
    const req = this.build();
    if (!req) return;

    if (req.restoreType === 'REAL' && !(await this.confirm.confirmRestoreReal(req.targetDatabase || `run ${req.idBkpRun}`))) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.repo.ejecutarRestore(req)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.notify.success('Restore ejecutado', r.mensaje);
          this.dirty.set(false);
          this.cargar();
        },
        error: e => this.setError('No se pudo ejecutar restore', e?.message),
      });
  }

  registrar() {
    const req = this.build();
    if (!req) return;

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.repo.registrarRestore(req)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.notify.success('Restore registrado', r.mensaje);
          this.dirty.set(false);
          this.cargar();
        },
        error: e => this.setError('No se pudo registrar restore', e?.message),
      });
  }

  async ejecutarRegistrado(x = this.selected()) {
    if (!x) return;

    if (x.restoreType === 'REAL' && !(await this.confirm.confirmRestoreReal(x.targetDatabase || `restore #${x.idBkpRestoreRun}`))) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.repo.ejecutarRestoreRegistrado(x.idBkpRestoreRun)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.notify.success('Restore ejecutado', r.mensaje);
          this.cargar();
        },
        error: e => this.setError('No se pudo ejecutar restore', e?.message),
      });
  }

  private build(): BkpRestoreRequest | null {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.setError('Completa run exitoso y base destino.');
      return null;
    }

    const v = this.form.getRawValue();

    return {
      idBkpRun: Number(v.idBkpRun),
      idBkpAgentNode: v.idBkpAgentNode ?? null,
      restoreType: v.restoreType ?? 'TEST',
      targetHost: this.blankToNull(v.targetHost),
      targetPort: v.targetPort ?? null,
      targetDatabase: this.blankToNull(v.targetDatabase),
      targetSchema: this.blankToNull(v.targetSchema),
      targetUsuario: this.blankToNull(v.targetUsuario),
      idBkpSecretPassword: v.idBkpSecretPassword ?? null,
      cleanBeforeRestore: v.cleanBeforeRestore ?? false,
      extraRestoreArgs: this.blankToNull(v.extraRestoreArgs),
    };
  }

  private applyRunDefaults(id?: number | null) {
    const run = this.runs().find(x => x.idBkpRun === id);
    if (!run) return;

    const currentDb = String(this.form.value.targetDatabase || '').trim();
    if (!currentDb) {
      const suffix = this.form.value.restoreType === 'REAL' ? '' : '_restore_test';
      this.form.patchValue({
        targetDatabase: `${run.sourceBase || run.sourceNombre || 'restore'}${suffix}`,
      }, { emitEvent: false });
    }
  }

  selectedRun() {
    return this.runs().find(x => x.idBkpRun === this.form.value.idBkpRun) ?? null;
  }

  isRestoreType(type: string) {
    return String(this.form.value.restoreType || '').toUpperCase() === type;
  }

  restoreTypeHint() {
    const t = String(this.form.value.restoreType || 'TEST').toUpperCase();
    return this.restoreTypes.find(x => x.value === t)?.hint ?? '';
  }

  invalid(name: string) {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  runLabel(id?: number | null) {
    const r = this.runs().find(x => x.idBkpRun === id);
    return r ? `#${r.idBkpRun} · ${r.planNombre} · ${r.fileName || ''}` : `#${id}`;
  }

  clean() {
    this.dirty.set(false);
    this.error.set('');
    this.success.set('');
  }

  private setError(summary: string, detail?: string) {
    const msg = detail || summary;
    this.error.set(msg);
    this.notify.error(summary, detail);
  }

  private blankToNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  fmtDate = fmtDate;
  jsonPretty = jsonPretty;
}
