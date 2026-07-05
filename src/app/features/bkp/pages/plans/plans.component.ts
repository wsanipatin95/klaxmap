import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import {
  BkpAgentNode,
  BkpCatalogs,
  BkpPlan,
  BkpPlanGuardarRequest,
  BkpPlanScopeRequest,
  BkpPlanTableFilterRequest,
  BkpSchedule,
  BkpSecret,
  BkpSourceDatabase,
  BkpStorageDestination,
} from '../../data-access/bkp.models';
import {
  backupTypesFromCatalog,
  compressionTypesFromCatalog,
  formatsForMotor,
  labelBackupType,
  labelCompression,
  labelFormat,
  labelScheduleType,
  labelSecretType,
  labelStorageType,
  toNullableString,
} from '../../data-access/bkp.ux';

type PlanReloadState = {
  id?: number | null;
  name?: string | null;
};

type ScopeOption = {
  value: string;
  label: string;
  hint: string;
};

@Component({
  selector: 'app-bkp-plans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BkpPageHeaderComponent, BkpEmptyStateComponent],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.scss',
})
export class BkpPlansComponent implements OnInit {
  private fb = inject(FormBuilder);
  private repo = inject(BkpRepository);
  private router = inject(Router);

  items = signal<BkpPlan[]>([]);
  sources = signal<BkpSourceDatabase[]>([]);
  agents = signal<BkpAgentNode[]>([]);
  schedules = signal<BkpSchedule[]>([]);
  destinations = signal<BkpStorageDestination[]>([]);
  secrets = signal<BkpSecret[]>([]);
  catalogs = signal<Partial<BkpCatalogs>>({});
  selected = signal<BkpPlan | null>(null);
  selectedDestIds = signal<number[]>([]);
  lastSavedDestIds = signal<number[]>([]);
  destinationsTouched = signal(false);
  tableFilters = signal<BkpPlanTableFilterRequest[]>([]);

  q = signal('');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal('');
  success = signal('');
  technicalOpen = signal(false);
  scopeOpen = signal(true);

  sourceId = signal<number | null>(null);
  sourceMotor = computed(() => this.sources().find((s: BkpSourceDatabase) => s.idBkpSourceDatabase === this.sourceId())?.motor || 'POSTGRESQL');
  formatos = computed(() => formatsForMotor(this.sourceMotor()));
  backupTypes = computed(() => backupTypesFromCatalog(this.catalogs()));
  compressionTypes = computed(() => compressionTypesFromCatalog(this.catalogs()).filter((x: string) => x !== 'NONE'));

  compressionOn = signal(true);
  encryptionOn = signal(false);
  scopeType = signal('FULL');

  scopeOptions: ScopeOption[] = [
    { value: 'FULL', label: 'Toda la base', hint: 'Respalda estructura y datos completos.' },
    { value: 'SCHEMA_ONLY', label: 'Solo estructura', hint: 'Respalda tablas, vistas y objetos sin datos.' },
    { value: 'DATA_ONLY', label: 'Solo datos', hint: 'Respalda datos sin recrear estructura.' },
    { value: 'PARTIAL', label: 'Tablas específicas', hint: 'Respalda solo las tablas que agregues abajo.' },
  ];

  form = this.fb.group({
    nombre: ['', Validators.required],
    idBkpSourceDatabaseFk: [null as number | null, Validators.required],
    idBkpAgentNodeFk: [null as number | null, Validators.required],
    idBkpScheduleFk: [null as number | null],

    tipoBackup: ['LOGICAL_FULL'],
    formatoSalida: ['CUSTOM'],
    compressionEnabled: [true],
    compressionType: ['GZIP'],
    encryptionEnabled: [false],
    idBkpSecretEncryptionFk: [null as number | null],

    verifyAfterBackup: [true],
    calculateChecksum: [true],
    localTempPath: [''],
    localRetentionDays: [7, [Validators.required, Validators.min(1)]],
    maxRuntimeMinutes: [120, [Validators.required, Validators.min(1)]],
    extraDumpArgs: [''],
    activo: [true],

    scopeType: ['FULL'],
    includeOwner: [false],
    includePrivileges: [false],

    filterSchemaName: [''],
    filterTableName: [''],
    filterType: ['INCLUDE'],
  });

  ngOnInit() {
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.success.set('');
    });

    this.form.get('idBkpSourceDatabaseFk')?.valueChanges.subscribe(value => {
      this.sourceId.set(value ?? null);
      this.ensureFormatAllowed();
    });

    this.form.get('compressionEnabled')?.valueChanges.subscribe(value => {
      const enabled = value !== false;
      this.compressionOn.set(enabled);
      const ct = this.form.get('compressionType');
      if (enabled) {
        if (!this.form.value.compressionType) this.form.patchValue({ compressionType: 'GZIP' }, { emitEvent: false });
        ct?.setValidators([Validators.required]);
      } else {
        ct?.clearValidators();
      }
      ct?.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('encryptionEnabled')?.valueChanges.subscribe(value => {
      const on = value === true;
      this.encryptionOn.set(on);
      const sec = this.form.get('idBkpSecretEncryptionFk');
      if (on) {
        sec?.setValidators([Validators.required]);
      } else {
        sec?.clearValidators();
        this.form.patchValue({ idBkpSecretEncryptionFk: null }, { emitEvent: false });
      }
      sec?.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('scopeType')?.valueChanges.subscribe(value => {
      const type = String(value || 'FULL').toUpperCase();
      this.scopeType.set(type);
      if (type !== 'PARTIAL') {
        this.tableFilters.set([]);
      }
    });

    this.cargar();
    this.nuevo();
  }

  canDeactivate() {
    return !this.dirty() || confirm('Tienes cambios pendientes. ¿Salir sin guardar?');
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar(state: PlanReloadState = {}) {
    const snapshot: PlanReloadState = {
      id: state.id ?? this.selected()?.idBkpPlan ?? null,
      name: state.name ?? this.selected()?.nombre ?? null,
    };

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      catalogs: this.repo.catalogos(),
      sources: this.repo.listarSources('', 0, 300, true),
      agents: this.repo.listarAgents('', 0, 300, true),
      schedules: this.repo.listarSchedules('', 0, 300, true),
      destinations: this.repo.listarDestinations('', 0, 300, true),
      secrets: this.repo.listarSecrets('', 0, 300, true),
      plans: this.repo.listarPlans(this.q(), 0, 200, null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.catalogs.set(r.catalogs ?? {});
          this.sources.set(r.sources.items ?? []);
          this.agents.set(r.agents.items ?? []);
          this.schedules.set(r.schedules.items ?? []);
          this.destinations.set(r.destinations.items ?? []);
          this.secrets.set(r.secrets.items ?? []);
          this.items.set(r.plans.items ?? []);

          const selected = this.findPlan(snapshot.id, snapshot.name);
          if (selected) this.seleccionarSinConfirmar(selected);
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  nuevo() {
    this.selected.set(null);
    this.selectedDestIds.set([]);
    this.lastSavedDestIds.set([]);
    this.destinationsTouched.set(false);
    this.tableFilters.set([]);
    this.technicalOpen.set(false);
    this.scopeOpen.set(true);
    this.sourceId.set(null);
    this.compressionOn.set(true);
    this.encryptionOn.set(false);
    this.scopeType.set('FULL');

    this.form.reset({
      nombre: '',
      idBkpSourceDatabaseFk: null,
      idBkpAgentNodeFk: null,
      idBkpScheduleFk: null,
      tipoBackup: 'LOGICAL_FULL',
      formatoSalida: 'CUSTOM',
      compressionEnabled: true,
      compressionType: 'GZIP',
      encryptionEnabled: false,
      idBkpSecretEncryptionFk: null,
      verifyAfterBackup: true,
      calculateChecksum: true,
      localTempPath: '',
      localRetentionDays: 7,
      maxRuntimeMinutes: 120,
      extraDumpArgs: '',
      activo: true,
      scopeType: 'FULL',
      includeOwner: false,
      includePrivileges: false,
      filterSchemaName: '',
      filterTableName: '',
      filterType: 'INCLUDE',
    });

    this.clean();
  }

  seleccionar(i: BkpPlan) {
    if (this.dirty() && !confirm('Tienes cambios pendientes. ¿Cambiar de plan sin guardar?')) return;
    this.seleccionarSinConfirmar(i);
  }

  private seleccionarSinConfirmar(i: BkpPlan) {
    this.selected.set(i);
    this.loading.set(true);

    this.repo.obtenerPlan(i.idBkpPlan)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: d => {
          const plan: BkpPlan = d.plan || i;
          const scope: any = (d.scopes as any[] | undefined)?.[0];
          const scopeType = String(scope?.scopeType || 'FULL').toUpperCase();

          this.sourceId.set(plan.idBkpSourceDatabaseFk ?? null);
          this.compressionOn.set(plan.compressionEnabled !== false);
          this.encryptionOn.set(!!plan.encryptionEnabled);
          this.scopeType.set(scopeType);
          this.tableFilters.set([]);

          this.form.reset({
            nombre: plan.nombre ?? '',
            idBkpSourceDatabaseFk: plan.idBkpSourceDatabaseFk ?? null,
            idBkpAgentNodeFk: plan.idBkpAgentNodeFk ?? null,
            idBkpScheduleFk: plan.idBkpScheduleFk ?? null,
            tipoBackup: plan.tipoBackup || 'LOGICAL_FULL',
            formatoSalida: plan.formatoSalida || 'CUSTOM',
            compressionEnabled: plan.compressionEnabled !== false,
            compressionType: plan.compressionType || 'GZIP',
            encryptionEnabled: !!plan.encryptionEnabled,
            idBkpSecretEncryptionFk: plan.idBkpSecretEncryptionFk ?? null,
            verifyAfterBackup: plan.verifyAfterBackup !== false,
            calculateChecksum: plan.calculateChecksum !== false,
            localTempPath: plan.localTempPath ?? '',
            localRetentionDays: plan.localRetentionDays ?? 7,
            maxRuntimeMinutes: plan.maxRuntimeMinutes ?? 120,
            extraDumpArgs: plan.extraDumpArgs ?? '',
            activo: plan.activo !== false,
            scopeType,
            includeOwner: !!scope?.includeOwner,
            includePrivileges: !!scope?.includePrivileges,
            filterSchemaName: '',
            filterTableName: '',
            filterType: 'INCLUDE',
          });

          const destinationIds = (d.destinations ?? [])
            .filter((x: any) => x.activo !== false)
            .map((x: any) => x.idBkpStorageDestinationFk);

          const normalizedDestinationIds = this.uniqueIds(destinationIds);
          this.selectedDestIds.set(normalizedDestinationIds);
          this.lastSavedDestIds.set(normalizedDestinationIds);
          this.destinationsTouched.set(false);
          this.error.set('');

          this.ensureFormatAllowed();
          this.clean();
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  toggleDest(id: unknown, checked: boolean) {
    const normalizedId = this.toId(id);
    if (normalizedId === null) {
      this.error.set('Destino inválido. Recarga la pantalla y vuelve a intentar.');
      return;
    }

    const set = new Set(this.uniqueIds(this.selectedDestIds()));
    checked ? set.add(normalizedId) : set.delete(normalizedId);
    this.selectedDestIds.set(this.uniqueIds([...set]));
    this.destinationsTouched.set(true);
    this.dirty.set(true);
    this.error.set('');
  }

  addTableFilter() {
    const v = this.form.getRawValue();
    const tableName = String(v.filterTableName || '').trim();

    if (!tableName) {
      this.error.set('Tabla es obligatoria para filtro parcial.');
      return;
    }

    const item: BkpPlanTableFilterRequest = {
      schemaName: toNullableString(v.filterSchemaName),
      tableName,
      filterType: String(v.filterType || 'INCLUDE').toUpperCase(),
    };

    this.tableFilters.set([...this.tableFilters(), item]);
    this.form.patchValue({ filterSchemaName: '', filterTableName: '', filterType: 'INCLUDE' });
    this.dirty.set(true);
    this.error.set('');
  }

  removeTableFilter(index: number) {
    this.tableFilters.set(this.tableFilters().filter((_, i) => i !== index));
    this.dirty.set(true);
  }

  guardar() {
    this.form.markAllAsTouched();
    this.error.set('');
    this.success.set('');

    try {
      const v = this.form.getRawValue();
      const destinationIds = this.destinationIdsForSave();
      const base = this.buildBasePayload(v, destinationIds);
      const id = this.selected()?.idBkpPlan ?? 0;
      const state: PlanReloadState = {
        id: id || null,
        name: base.nombre,
      };

      this.saving.set(true);

      if (!id) {
        const payload: BkpPlanGuardarRequest = {
          ...base,
          destinationIds,
          scope: this.buildScopePayload(v),
        };

        this.repo.crearPlan(payload)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: r => {
              this.success.set(r.mensaje);
              this.dirty.set(false);
              this.cargar({ name: base.nombre });
            },
            error: e => this.error.set(this.msg(e)),
          });

        return;
      }

      this.repo.editarPlan(id, base as Record<string, unknown>).subscribe({
        next: r => {
          if (!this.destinationsTouched()) {
            this.saving.set(false);
            this.success.set(r.mensaje || 'Plan guardado');
            this.dirty.set(false);
            this.cargar(state);
            return;
          }

          this.repo.reemplazarPlanDestinations(id, destinationIds)
            .pipe(finalize(() => this.saving.set(false)))
            .subscribe({
              next: rr => {
                this.success.set(rr.mensaje);
                this.dirty.set(false);
                this.destinationsTouched.set(false);
                this.lastSavedDestIds.set(destinationIds);
                this.cargar(state);
              },
              error: e => this.error.set(this.msg(e)),
            });
        },
        error: e => {
          this.saving.set(false);
          this.error.set(this.msg(e));
        },
      });
    } catch (e) {
      this.saving.set(false);
      this.error.set(this.msg(e));
    }
  }

  ejecutarAhora() {
    const id = this.selected()?.idBkpPlan;

    if (!id) {
      this.error.set('Guarda el plan antes de ejecutarlo.');
      return;
    }

    if (this.dirty()) {
      this.error.set('Guarda los cambios antes de ejecutar el backup.');
      return;
    }

    if (!confirm('¿Ejecutar este backup ahora?')) return;

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.repo.ejecutarPlan(id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje || 'Backup enviado a ejecución.');
          this.router.navigateByUrl('/app/backups/runs');
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  eliminar() {
    const id = this.selected()?.idBkpPlan;
    if (!id || !confirm('¿Desactivar este plan?')) return;

    this.saving.set(true);

    this.repo.eliminarPlan(id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.nuevo();
          this.cargar();
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  private buildBasePayload(v: any, destinationIds: number[]): Omit<BkpPlan, 'idBkpPlan'> {
    const nombre = String(v.nombre || '').trim();
    const formato = String(v.formatoSalida || '').toUpperCase();
    const compressionEnabled = v.compressionEnabled !== false;
    const encryptionEnabled = v.encryptionEnabled === true;

    if (!nombre) throw new Error('Nombre es obligatorio.');
    if (!v.idBkpSourceDatabaseFk) throw new Error('Base origen es obligatoria.');
    if (!v.idBkpAgentNodeFk) throw new Error('Agente es obligatorio.');
    if (!destinationIds.length) throw new Error('Selecciona al menos un destino.');
    if (!this.formatos().includes(formato)) throw new Error('Formato no permitido para el motor seleccionado.');
    if (compressionEnabled && !this.compressionTypes().includes(String(v.compressionType || '').toUpperCase())) {
      throw new Error('Tipo de compresión no permitido.');
    }
    if (encryptionEnabled && !v.idBkpSecretEncryptionFk) {
      throw new Error('Selecciona secreto de cifrado.');
    }

    const localRetentionDays = Number(v.localRetentionDays || 7);
    const maxRuntimeMinutes = Number(v.maxRuntimeMinutes || 120);

    if (!Number.isFinite(localRetentionDays) || localRetentionDays < 1) {
      throw new Error('Retención local días debe ser mayor a 0.');
    }

    if (!Number.isFinite(maxRuntimeMinutes) || maxRuntimeMinutes < 1) {
      throw new Error('Runtime máximo debe ser mayor a 0.');
    }

    return {
      nombre,
      idBkpSourceDatabaseFk: v.idBkpSourceDatabaseFk,
      idBkpAgentNodeFk: v.idBkpAgentNodeFk,
      idBkpScheduleFk: v.idBkpScheduleFk ?? null,
      tipoBackup: String(v.tipoBackup || 'LOGICAL_FULL').toUpperCase(),
      formatoSalida: formato,
      compressionEnabled,
      compressionType: compressionEnabled ? String(v.compressionType || 'GZIP').toUpperCase() : 'NONE',
      encryptionEnabled,
      idBkpSecretEncryptionFk: encryptionEnabled ? v.idBkpSecretEncryptionFk : null,
      verifyAfterBackup: v.verifyAfterBackup !== false,
      calculateChecksum: v.calculateChecksum !== false,
      localTempPath: toNullableString(v.localTempPath),
      localRetentionDays,
      maxRuntimeMinutes,
      extraDumpArgs: toNullableString(v.extraDumpArgs),
      activo: v.activo !== false,
    };
  }

  private buildScopePayload(v: any): BkpPlanScopeRequest {
    const scopeType = String(v.scopeType || 'FULL').toUpperCase();
    const filters = scopeType === 'PARTIAL' ? this.tableFilters() : [];

    if (scopeType === 'PARTIAL' && !filters.length) {
      throw new Error('Para alcance parcial agrega al menos una tabla.');
    }

    return {
      scopeType,
      includeOwner: v.includeOwner === true,
      includePrivileges: v.includePrivileges === true,
      configJson: {},
      tableFilters: filters,
    };
  }

  clean() {
    this.dirty.set(false);
    this.error.set('');
    this.success.set('');
  }

  invalid(name: string) {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  ensureFormatAllowed() {
    const allowed = this.formatos();
    const current = String(this.form.value.formatoSalida || '').toUpperCase();

    if (!allowed.includes(current)) {
      this.form.patchValue({ formatoSalida: allowed[0] || 'CUSTOM' }, { emitEvent: false });
    }
  }

  planSummary(i: BkpPlan) {
    const parts = [
      this.labelBackupType(i.tipoBackup),
      this.labelFormat(i.formatoSalida),
      i.compressionEnabled === false ? 'sin compresión' : this.labelCompression(i.compressionType || 'GZIP'),
    ];

    if (i.encryptionEnabled) parts.push('cifrado');
    return parts.join(' · ');
  }

  selectedSource() {
    return this.sources().find((s: BkpSourceDatabase) => s.idBkpSourceDatabase === this.form.value.idBkpSourceDatabaseFk) ?? null;
  }

  sourceSummary() {
    const s = this.selectedSource();
    if (!s) return 'Selecciona la base que será respaldada.';
    return `${s.motor} · ${s.host}:${s.puerto}/${s.nombreBase}`;
  }

  destinationSummary(d: BkpStorageDestination) {
    if (d.tipoStorage === 'LOCAL') return d.basePath || 'ruta local';
    if (d.tipoStorage === 'S3') return d.bucketName || 'bucket';
    if (d.tipoStorage === 'GOOGLE_DRIVE') return d.folderId || 'Google Drive';
    return d.prefixPath || 'destino remoto';
  }

  scheduleSummary(s: BkpSchedule) {
    return `${this.labelScheduleType(s.tipoSchedule)} · ${s.timezone || 'sin timezone'}`;
  }

  scopeLabel(type?: string | null) {
    const t = String(type || 'FULL').toUpperCase();
    return this.scopeOptions.find((x: ScopeOption) => x.value === t)?.label ?? t;
  }

  scopeHint(type?: string | null) {
    const t = String(type || 'FULL').toUpperCase();
    return this.scopeOptions.find((x: ScopeOption) => x.value === t)?.hint ?? '';
  }

  scopeReadonlyText() {
    return `Este plan respalda: ${this.scopeLabel(this.scopeType())}.`;
  }



  canShowFormatHint() {
    return String(this.sourceMotor()).toUpperCase() === 'POSTGRESQL';
  }

  labelStorageType = labelStorageType;
  labelBackupType = labelBackupType;
  labelFormat = labelFormat;
  labelCompression = labelCompression;
  labelSecretType = labelSecretType;
  labelScheduleType = labelScheduleType;

  destinationIdsForSave(): number[] {
    const current = this.uniqueIds(this.selectedDestIds());

    if (current.length) return current;

    if (this.selected() && !this.destinationsTouched()) {
      return this.uniqueIds(this.lastSavedDestIds());
    }

    return [];
  }

  selectedDestinationCount() {
    return this.destinationIdsForSave().length;
  }

  destinationId(d: BkpStorageDestination | any): number {
    return this.toId(d?.idBkpStorageDestination) ?? 0;
  }

  isDestSelected(d: BkpStorageDestination | any): boolean {
    const id = this.destinationId(d);
    return id > 0 && this.uniqueIds(this.selectedDestIds()).includes(id);
  }

  private uniqueIds(values: unknown[]): number[] {
    const unique = new Set<number>();

    for (const value of values || []) {
      const id = this.toId(value);
      if (id !== null) unique.add(id);
    }

    return Array.from(unique);
  }

  private toId(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;

    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;

    return n;
  }

  private findPlan(id?: number | null, name?: string | null) {
    if (id) {
      const byId = this.items().find((x: BkpPlan) => x.idBkpPlan === id);
      if (byId) return byId;
    }

    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;

    return this.items().find((x: BkpPlan) => String(x.nombre || '').trim().toUpperCase() === normalized) ?? null;
  }

  private msg(e: unknown) {
    return e instanceof Error ? e.message : String((e as any)?.message || e || 'Error');
  }
}
