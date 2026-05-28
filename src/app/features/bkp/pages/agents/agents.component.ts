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

type AgentTab = 'agents' | 'tools';

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

  tab = signal<AgentTab>('agents');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  agentTechOpen = signal(false);
  toolTechOpen = signal(false);

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

    this.route.queryParamMap.subscribe(params => {
      const requested = params.get('tab') === 'tools' ? 'tools' : 'agents';
      if (this.tab() !== requested && !this.dirty()) {
        this.tab.set(requested);
      }
    });

    this.toolForm.get('motor')?.valueChanges.subscribe(() => this.syncToolPathIfEmpty());
    this.toolForm.get('herramienta')?.valueChanges.subscribe(() => this.syncToolPathIfEmpty());
    this.toolForm.get('idBkpAgentNodeFk')?.valueChanges.subscribe(() => this.syncToolPathIfEmpty());

    this.cargar();
  }

  canDeactivate() {
    return !this.dirty() || this.confirm.confirmDiscard();
  }

  cargar() {
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
        if (!this.toolForm.value.idBkpAgentNodeFk && this.agents()[0]?.idBkpAgentNode) {
          this.toolForm.patchValue({ idBkpAgentNodeFk: this.agents()[0].idBkpAgentNode }, { emitEvent: false });
        }
        if (!this.selectedAgent() && this.tab() === 'agents' && this.agents()[0]) {
          this.seleccionarAgentSinConfirmar(this.agents()[0]);
        }
        this.clean();
      },
      error: e => this.setError('No se pudo cargar agentes', e?.message),
    });
  }

  async setTab(t: AgentTab) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.tab.set(t);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t }, queryParamsHandling: 'merge' });
    if (t === 'agents') this.nuevoAgent();
    else this.nuevoTool();
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  nuevo() {
    if (this.tab() === 'agents') this.nuevoAgent();
    else this.nuevoTool();
  }

  nuevoAgent() {
    this.selectedAgent.set(null);
    this.selectedTool.set(null);
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

  nuevoTool(agentId?: number | null) {
    this.selectedTool.set(null);
    this.selectedAgent.set(null);
    this.toolTechOpen.set(false);
    const id = agentId ?? this.agents()[0]?.idBkpAgentNode ?? null;
    const motor = 'POSTGRESQL';
    const herramienta = 'pg_dump';
    const agent = this.agents().find(a => a.idBkpAgentNode === id);
    this.toolForm.reset({
      idBkpAgentNodeFk: id,
      motor,
      herramienta,
      binaryPath: this.defaultBinaryPath(motor, herramienta, agent?.osType),
      versionText: '',
      configJson: '{}',
      activo: true,
    });
    this.clean();
  }

  async seleccionarAgent(i: BkpAgentNode) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.seleccionarAgentSinConfirmar(i);
  }

  private seleccionarAgentSinConfirmar(i: BkpAgentNode) {
    this.tab.set('agents');
    this.selectedAgent.set(i);
    this.selectedTool.set(null);
    this.agentTechOpen.set(false);
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
    this.clean();
  }

  async seleccionarTool(i: BkpEngineTool) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.tab.set('tools');
    this.selectedTool.set(i);
    this.selectedAgent.set(null);
    this.toolTechOpen.set(false);
    this.toolForm.reset({
      idBkpAgentNodeFk: i.idBkpAgentNodeFk ?? null,
      motor: i.motor ?? 'POSTGRESQL',
      herramienta: i.herramienta ?? 'pg_dump',
      binaryPath: i.binaryPath ?? '',
      versionText: i.versionText ?? '',
      configJson: jsonPretty(i.configJson ?? {}),
      activo: i.activo !== false,
    });
    this.clean();
  }

  abrirBinariosDelAgente(agent = this.selectedAgent()) {
    if (!agent) return;
    this.tab.set('tools');
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: 'tools' }, queryParamsHandling: 'merge' });
    this.nuevoTool(agent.idBkpAgentNode);
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
    this.save(
      id ? this.repo.editarAgent(id, payload as Record<string, unknown>) : this.repo.crearAgent(payload),
      'Agente guardado'
    );
  }

  guardarTool() {
    this.toolForm.markAllAsTouched();
    if (this.toolForm.invalid) {
      this.setError('Completa agente, motor, herramienta y ruta del binario.');
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
      idBkpAgentNodeFk: Number(v.idBkpAgentNodeFk),
      motor: v.motor ?? 'POSTGRESQL',
      herramienta: v.herramienta ?? 'pg_dump',
      binaryPath: v.binaryPath ?? '',
      versionText: v.versionText || null,
      configJson,
      activo: v.activo ?? true,
    };

    const id = this.selectedTool()?.idBkpEngineTool ?? 0;
    this.save(
      id ? this.repo.editarTool(id, payload as Record<string, unknown>) : this.repo.crearTool(payload),
      'Binario guardado'
    );
  }

  async eliminarAgent(i = this.selectedAgent()) {
    if (!i) return;
    if (!(await this.confirm.confirmDelete(i.nombre))) return;
    this.save(this.repo.eliminarAgent(i.idBkpAgentNode), 'Agente desactivado', true);
  }

  async eliminarTool(i = this.selectedTool()) {
    if (!i) return;
    if (!(await this.confirm.confirmDelete(i.herramienta))) return;
    this.save(this.repo.eliminarTool(i.idBkpEngineTool), 'Binario desactivado', true);
  }

  save(obs: any, label: string, reset = false) {
    this.saving.set(true);
    obs.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || label);
        this.notify.success(label, r?.mensaje);
        this.dirty.set(false);
        if (reset) this.nuevo();
        this.cargar();
      },
      error: (e: any) => this.setError('No se pudo guardar', e?.message),
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

  agentName(id?: number | null) {
    return this.agents().find(a => a.idBkpAgentNode === id)?.nombre ?? 'Sin agente';
  }

  selectedToolAgent() {
    return this.agents().find(a => a.idBkpAgentNode === this.toolForm.value.idBkpAgentNodeFk) ?? null;
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
    const agent = this.selectedToolAgent();
    this.toolForm.patchValue({
      binaryPath: this.defaultBinaryPath(this.toolForm.value.motor, this.toolForm.value.herramienta, agent?.osType),
    }, { emitEvent: false });
  }

  private defaultBinaryPath(motor?: string | null, tool?: string | null, os?: string | null) {
    const herramienta = String(tool || 'pg_dump');
    const isWindows = String(os || '').toUpperCase() === 'WINDOWS';
    if (isWindows) {
      if (String(motor).toUpperCase() === 'MYSQL') return `C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\${herramienta}.exe`;
      return `C:\\Program Files\\PostgreSQL\\15\\bin\\${herramienta}.exe`;
    }
    return `/usr/bin/${herramienta}`;
  }
}
