import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpAgentNode, BkpEngineTool, BkpCatalogs } from '../../data-access/bkp.models';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { jsonPretty, parseJsonObjectStrict } from '../../data-access/bkp.shared';
import { NotifyService } from 'src/app/core/services/notify.service';

type AgentSection = 'data' | 'tools';

type ReloadState = {
  agentId?: number | null;
  agentName?: string | null;
  section?: AgentSection;
  toolId?: number | null;
  toolKey?: string | null;
  keepToolEditor?: boolean;
};

@Component({
  selector: 'app-bkp-agents',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
  ],
  templateUrl: './agents.component.html',
  styleUrl: './agents.component.scss',
})
export class BkpAgentsComponent implements OnInit, PendingChangesAware {
  private repo = inject(BkpRepository);
  private confirm = inject(BkpConfirmService);
  private notify = inject(NotifyService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  activeSection = signal<AgentSection>('data');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  agentTechOpen = signal(false);
  toolTechOpen = signal(false);
  toolEditorOpen = signal(false);

  agents = signal<BkpAgentNode[]>([]);
  tools = signal<BkpEngineTool[]>([]);
  catalogs = signal<Partial<BkpCatalogs>>({});
  selectedAgent = signal<BkpAgentNode | null>(null);
  selectedTool = signal<BkpEngineTool | null>(null);

  agentForm = this.fb.group({
    nombre: ['', Validators.required],
    hostname: [''],
    ipAddress: [''],
    osType: ['LINUX', Validators.required],
    workDir: [''],
    tempDir: [''],
    logDir: [''],
    maxParallelJobs: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
    observacion: [''],
    metadataJson: ['{}'],
    activo: [true],
  });

  toolForm = this.fb.group({
    idBkpAgentNodeFk: [null as number | null, Validators.required],
    motor: ['POSTGRESQL', Validators.required],
    herramienta: ['pg_dump', Validators.required],
    binaryPath: ['', Validators.required],
    versionText: [''],
    configJson: ['{}'],
    activo: [true],
  });

  ngOnInit() {
    this.agentForm.valueChanges.subscribe(() => this.markDirty());
    this.toolForm.valueChanges.subscribe(() => this.markDirty());

    this.toolForm.get('motor')?.valueChanges.subscribe(() => this.syncToolPathIfEmpty());
    this.toolForm.get('herramienta')?.valueChanges.subscribe(() => this.syncToolPathIfEmpty());

    this.cargar({
      section: this.route.snapshot.queryParamMap.get('tab') === 'tools' ? 'tools' : 'data',
    });
  }

  canDeactivate() {
    return !this.dirty() || this.confirm.confirmDiscard();
  }

  selectedAgentTools() {
    const agentId = this.selectedAgent()?.idBkpAgentNode;
    if (!agentId) return [];
    return this.tools().filter(t => t.idBkpAgentNodeFk === agentId);
  }

  agentOs() {
    return String(this.agentForm.value.osType || 'LINUX').toUpperCase();
  }

  binaryPathOs() {
    const path = String(this.toolForm.value.binaryPath || '').trim();
    if (/^[a-zA-Z]:\\/.test(path) || path.includes('\\')) return 'WINDOWS';
    if (path.startsWith('/')) return 'LINUX';
    return this.agentOs();
  }

  cargar(state: ReloadState = {}) {
    const snapshot: ReloadState = {
      agentId: state.agentId ?? this.selectedAgent()?.idBkpAgentNode ?? null,
      agentName: state.agentName ?? this.selectedAgent()?.nombre ?? null,
      section: state.section ?? this.activeSection(),
      toolId: state.toolId ?? this.selectedTool()?.idBkpEngineTool ?? null,
      toolKey: state.toolKey ?? this.currentToolKey(),
      keepToolEditor: state.keepToolEditor ?? this.toolEditorOpen(),
    };

    this.loading.set(true);

    forkJoin({
      agents: this.repo.listarAgents('', 0, 200, null),
      tools: this.repo.listarTools('', 0, 200, null),
      catalogs: this.repo.catalogos(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: r => {
        this.agents.set(r.agents.items ?? []);
        this.tools.set(r.tools.items ?? []);
        this.catalogs.set(r.catalogs ?? {});

        const selected =
          this.findAgent(snapshot.agentId, snapshot.agentName) ??
          this.agents()[0] ??
          null;

        if (selected) this.seleccionarAgentSinConfirmar(selected, { preserveSection: true });
        else this.nuevoAgent();

        const targetSection = snapshot.section ?? (this.route.snapshot.queryParamMap.get('tab') === 'tools' ? 'tools' : 'data');
        if (targetSection === 'tools' && selected) this.activeSection.set('tools');
        else this.activeSection.set('data');

        const selectedTool =
          this.findTool(snapshot.toolId, snapshot.toolKey) ??
          (this.activeSection() === 'tools' ? this.selectedAgentTools()[0] : null);

        if (selectedTool) {
          this.seleccionarToolSinConfirmar(selectedTool, { keepEditor: !!snapshot.keepToolEditor });
        } else {
          this.selectedTool.set(null);
          this.toolEditorOpen.set(!!snapshot.keepToolEditor && this.activeSection() === 'tools');
        }

        this.clean();
      },
      error: e => this.setError('No se pudo cargar agentes', e?.message),
    });
  }

  setSection(section: AgentSection) {
    if (section === 'tools' && !this.selectedAgent()?.idBkpAgentNode) {
      this.setError('Guarda o selecciona un agente antes de configurar binarios.');
      return;
    }

    this.activeSection.set(section);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: section === 'tools' ? 'tools' : 'agents' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  nuevoAgent() {
    this.activeSection.set('data');
    this.selectedAgent.set(null);
    this.selectedTool.set(null);
    this.toolEditorOpen.set(false);
    this.toolTechOpen.set(false);
    this.agentTechOpen.set(false);

    this.agentForm.reset({
      nombre: 'BACKUP-SERVER-01',
      hostname: '',
      ipAddress: '',
      osType: 'LINUX',
      workDir: '',
      tempDir: '',
      logDir: '',
      maxParallelJobs: 1,
      observacion: '',
      metadataJson: '{}',
      activo: true,
    });

    this.clean();
  }

  async seleccionarAgent(i: BkpAgentNode) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.seleccionarAgentSinConfirmar(i);
  }

  private seleccionarAgentSinConfirmar(i: BkpAgentNode, opts: { preserveSection?: boolean } = {}) {
    const section = this.activeSection();

    this.selectedAgent.set(i);
    this.selectedTool.set(null);
    this.toolTechOpen.set(false);
    this.toolEditorOpen.set(false);

    this.agentForm.reset({
      nombre: i.nombre ?? '',
      hostname: i.hostname ?? '',
      ipAddress: i.ipAddress ?? '',
      osType: i.osType ?? 'LINUX',
      workDir: i.workDir ?? '',
      tempDir: i.tempDir ?? '',
      logDir: i.logDir ?? '',
      maxParallelJobs: i.maxParallelJobs ?? 1,
      observacion: i.observacion ?? '',
      metadataJson: jsonPretty(i.metadata ?? {}),
      activo: i.activo !== false,
    });

    this.toolForm.patchValue({ idBkpAgentNodeFk: i.idBkpAgentNode }, { emitEvent: false });

    if (opts.preserveSection) this.activeSection.set(section);
    this.clean();
  }

  nuevoTool(agentId = this.selectedAgent()?.idBkpAgentNode ?? null, resetDirty = true) {
    if (!agentId) {
      this.setError('Guarda o selecciona un agente antes de agregar binarios.');
      return;
    }

    this.activeSection.set('tools');
    this.selectedTool.set(null);
    this.toolTechOpen.set(false);
    this.toolEditorOpen.set(true);

    const motor = 'POSTGRESQL';
    const herramienta = 'pg_dump';

    this.toolForm.reset({
      idBkpAgentNodeFk: agentId,
      motor,
      herramienta,
      binaryPath: this.defaultBinaryPath(motor, herramienta, this.agentOs()),
      versionText: '',
      configJson: '{}',
      activo: true,
    });

    if (resetDirty) this.clean();
  }

  async seleccionarTool(i: BkpEngineTool) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.seleccionarToolSinConfirmar(i, { keepEditor: true });
  }

  private seleccionarToolSinConfirmar(i: BkpEngineTool, opts: { keepEditor?: boolean } = {}) {
    this.activeSection.set('tools');
    this.selectedTool.set(i);
    this.toolTechOpen.set(false);
    this.toolEditorOpen.set(opts.keepEditor !== false);

    this.toolForm.reset({
      idBkpAgentNodeFk: i.idBkpAgentNodeFk ?? this.selectedAgent()?.idBkpAgentNode ?? null,
      motor: i.motor ?? 'POSTGRESQL',
      herramienta: i.herramienta ?? 'pg_dump',
      binaryPath: i.binaryPath ?? '',
      versionText: i.versionText ?? '',
      configJson: jsonPretty(i.configJson ?? {}),
      activo: i.activo !== false,
    });

    this.clean();
  }

  guardarAgent() {
    this.agentForm.markAllAsTouched();

    if (this.agentForm.invalid) {
      this.setError('Completa los campos obligatorios del agente.');
      return;
    }

    let metadata: Record<string, unknown>;
    try {
      metadata = parseJsonObjectStrict(this.agentForm.value.metadataJson, 'Metadata');
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'JSON inválido');
      return;
    }

    const v = this.agentForm.getRawValue();
    const payload: Partial<BkpAgentNode> = {
      nombre: v.nombre ?? '',
      hostname: v.hostname || null,
      ipAddress: v.ipAddress || null,
      osType: v.osType ?? 'LINUX',
      workDir: v.workDir || null,
      tempDir: v.tempDir || null,
      logDir: v.logDir || null,
      maxParallelJobs: Number(v.maxParallelJobs ?? 1),
      observacion: v.observacion || null,
      metadata,
      activo: v.activo ?? true,
    };

    const id = this.selectedAgent()?.idBkpAgentNode ?? 0;
    const state: ReloadState = {
      agentId: id || null,
      agentName: payload.nombre ?? null,
      section: this.activeSection(),
      toolId: this.selectedTool()?.idBkpEngineTool ?? null,
      keepToolEditor: this.toolEditorOpen(),
    };

    const request = id
      ? this.repo.editarAgent(id, payload as Record<string, unknown>)
      : this.repo.crearAgent(payload);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || 'Agente guardado');
        this.notify.success('Agente guardado', r?.mensaje);
        this.dirty.set(false);
        this.cargar(state);
      },
      error: (e: any) => this.setError('No se pudo guardar el agente', e?.message),
    });
  }

  guardarTool() {
    this.toolForm.markAllAsTouched();

    if (!this.selectedAgent()?.idBkpAgentNode) {
      this.setError('Selecciona o guarda un agente antes de guardar binarios.');
      return;
    }

    if (this.toolForm.invalid) {
      this.setError('Completa motor, herramienta y ruta del binario.');
      return;
    }

    let configJson: Record<string, unknown>;
    try {
      configJson = parseJsonObjectStrict(this.toolForm.value.configJson, 'Config JSON');
    } catch (e) {
      this.setError(e instanceof Error ? e.message : 'JSON inválido');
      return;
    }

    const v = this.toolForm.getRawValue();
    const payload: Partial<BkpEngineTool> = {
      idBkpAgentNodeFk: this.selectedAgent()?.idBkpAgentNode,
      motor: v.motor ?? 'POSTGRESQL',
      herramienta: v.herramienta ?? 'pg_dump',
      binaryPath: v.binaryPath ?? '',
      versionText: v.versionText || null,
      configJson,
      activo: v.activo ?? true,
    };

    const id = this.selectedTool()?.idBkpEngineTool ?? 0;
    const state: ReloadState = {
      agentId: this.selectedAgent()?.idBkpAgentNode ?? null,
      section: 'tools',
      toolId: id || null,
      toolKey: this.toolKey(payload),
      keepToolEditor: true,
    };

    const request = id
      ? this.repo.editarTool(id, payload as Record<string, unknown>)
      : this.repo.crearTool(payload);

    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || 'Binario guardado');
        this.notify.success('Binario guardado', r?.mensaje);
        this.dirty.set(false);
        this.cargar(state);
      },
      error: (e: any) => this.setError('No se pudo guardar el binario', e?.message),
    });
  }

  async eliminarAgent(i = this.selectedAgent()) {
    if (!i) return;
    if (!(await this.confirm.confirmDelete(i.nombre))) return;

    this.saving.set(true);
    this.repo.eliminarAgent(i.idBkpAgentNode).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || 'Agente desactivado');
        this.notify.success('Agente desactivado', r?.mensaje);
        this.nuevoAgent();
        this.cargar({ section: 'data' });
      },
      error: (e: any) => this.setError('No se pudo desactivar el agente', e?.message),
    });
  }

  async eliminarTool(i = this.selectedTool()) {
    if (!i) return;
    if (!(await this.confirm.confirmDelete(i.herramienta))) return;

    const agentId = this.selectedAgent()?.idBkpAgentNode ?? null;

    this.saving.set(true);
    this.repo.eliminarTool(i.idBkpEngineTool).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || 'Binario desactivado');
        this.notify.success('Binario desactivado', r?.mensaje);
        this.selectedTool.set(null);
        this.toolEditorOpen.set(false);
        this.cargar({ agentId, section: 'tools', keepToolEditor: false });
      },
      error: (e: any) => this.setError('No se pudo desactivar el binario', e?.message),
    });
  }

  clean() {
    this.dirty.set(false);
    this.error.set(null);
    this.success.set(null);
  }

  markDirty() {
    this.dirty.set(true);
    this.success.set(null);
  }

  setError(summary: string, detail?: string) {
    this.error.set(detail || summary);
    this.notify.error(summary, detail);
  }

  motores() {
    return this.catalogs().motores ?? ['POSTGRESQL', 'MYSQL'];
  }

  herramientas() {
    const motor = String(this.toolForm.value.motor || '').toUpperCase();
    const all = this.catalogs().herramientas ?? ['pg_dump', 'pg_restore', 'psql', 'mysqldump', 'mysql'];

    if (motor === 'POSTGRESQL') return all.filter(x => ['pg_dump', 'pg_restore', 'psql'].includes(String(x)));
    if (motor === 'MYSQL') return all.filter(x => ['mysqldump', 'mysql'].includes(String(x)));

    return all;
  }

  agentToolHint() {
    const motor = String(this.toolForm.value.motor || '').toUpperCase();
    const tool = String(this.toolForm.value.herramienta || '');

    if (motor === 'POSTGRESQL' && tool === 'pg_dump') return 'Necesario para generar backups PostgreSQL.';
    if (motor === 'POSTGRESQL' && tool === 'pg_restore') return 'Necesario para restaurar backups CUSTOM o TAR.';
    if (motor === 'POSTGRESQL' && tool === 'psql') return 'Necesario para restaurar scripts SQL.';
    if (motor === 'MYSQL' && tool === 'mysqldump') return 'Necesario para generar backups MySQL.';
    if (motor === 'MYSQL' && tool === 'mysql') return 'Necesario para restaurar backups MySQL.';

    return 'Ruta real del ejecutable en el servidor del agente.';
  }

  invalid(form: 'agent' | 'tool', name: string) {
    const control = form === 'agent' ? this.agentForm.get(name) : this.toolForm.get(name);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  setDefaultBinary(os: 'LINUX' | 'WINDOWS') {
    const motor = this.toolForm.value.motor ?? 'POSTGRESQL';
    const herramienta = this.toolForm.value.herramienta ?? 'pg_dump';
    this.toolForm.patchValue({ binaryPath: this.defaultBinaryPath(motor, herramienta, os) });
  }

  private syncToolPathIfEmpty() {
    const current = String(this.toolForm.value.binaryPath || '').trim();
    if (current) return;

    this.toolForm.patchValue({
      binaryPath: this.defaultBinaryPath(
        this.toolForm.value.motor,
        this.toolForm.value.herramienta,
        this.agentOs()
      ),
    }, { emitEvent: false });
  }

  private defaultBinaryPath(motor?: string | null, tool?: string | null, os?: string | null) {
    const herramienta = String(tool || 'pg_dump');
    const isWindows = String(os || '').toUpperCase() === 'WINDOWS';

    if (isWindows) {
      if (String(motor).toUpperCase() === 'MYSQL') {
        return `C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\${herramienta}.exe`;
      }
      return `C:\\Program Files\\PostgreSQL\\15\\bin\\${herramienta}.exe`;
    }

    return `/usr/bin/${herramienta}`;
  }

  private findAgent(id?: number | null, name?: string | null) {
    if (id) {
      const byId = this.agents().find(a => a.idBkpAgentNode === id);
      if (byId) return byId;
    }

    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;

    return this.agents().find(a => String(a.nombre || '').trim().toUpperCase() === normalized) ?? null;
  }

  private findTool(id?: number | null, key?: string | null) {
    if (id) {
      const byId = this.tools().find(t => t.idBkpEngineTool === id);
      if (byId) return byId;
    }

    if (!key) return null;

    return this.tools().find(t => this.toolKey(t) === key) ?? null;
  }

  private currentToolKey() {
    if (this.selectedTool()) return this.toolKey(this.selectedTool()!);
    return this.toolKey(this.toolForm.getRawValue());
  }

  private toolKey(tool: Partial<BkpEngineTool> | any) {
    return [
      tool?.idBkpAgentNodeFk ?? this.selectedAgent()?.idBkpAgentNode ?? '',
      String(tool?.motor ?? '').trim().toUpperCase(),
      String(tool?.herramienta ?? '').trim().toLowerCase(),
      String(tool?.binaryPath ?? '').trim(),
    ].join('|');
  }
}
