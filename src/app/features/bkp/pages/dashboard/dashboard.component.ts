import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import {
  BkpEmptyStateComponent,
  BkpPageHeaderComponent,
  BkpStatusBadgeComponent,
} from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import {
  BkpAgentNode,
  BkpGeneralConfig,
  BkpIntegrationProvider,
  BkpPlan,
  BkpRestoreEjecución,
  BkpRetentionEjecución,
  BkpEjecuciónResumen,
  BkpSchedule,
  BkpSecret,
  BkpSourceDatabase,
  BkpStorageDestination,
} from '../../data-access/bkp.models';
import { fmtBytes, fmtDate } from '../../data-access/bkp.shared';
import { NotifyService } from 'src/app/core/services/notify.service';

type SetupTone = 'success' | 'warning' | 'danger' | 'neutral';

type SetupStep = {
  key: string;
  order: number;
  title: string;
  subtitle: string;
  route: string;
  actionLabel: string;
  icon: string;
  ready: boolean;
  required: boolean;
  count: number;
  tone: SetupTone;
  help: string;
};

type BkpModuleCard = {
  title: string;
  subtitle: string;
  route: string;
  icon: string;
  countLabel: string;
  statusLabel: string;
  tone: SetupTone;
  dependsOn?: string;
};

type HealthAlert = {
  title: string;
  message: string;
  tone: SetupTone;
  route?: string;
  action?: string;
};

@Component({
  selector: 'app-bkp-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
    BkpStatusBadgeComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class BkpDashboardComponent implements OnInit {
  private repo = inject(BkpRepository);
  private notify = inject(NotifyService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly warnings = signal<string[]>([]);

  readonly agents = signal<BkpAgentNode[]>([]);
  readonly tools = signal<any[]>([]);
  readonly secrets = signal<BkpSecret[]>([]);
  readonly sources = signal<BkpSourceDatabase[]>([]);
  readonly destinations = signal<BkpStorageDestination[]>([]);
  readonly schedules = signal<BkpSchedule[]>([]);
  readonly plans = signal<BkpPlan[]>([]);
  readonly runs = signal<BkpEjecuciónResumen[]>([]);
  readonly integrations = signal<BkpIntegrationProvider[]>([]);
  readonly contacts = signal<any[]>([]);
  readonly rules = signal<any[]>([]);
  readonly restores = signal<BkpRestoreEjecución[]>([]);
  readonly retentionEjecucións = signal<BkpRetentionEjecución[]>([]);
  readonly configs = signal<BkpGeneralConfig[]>([]);

  readonly activeAgents = computed(() => this.active(this.agents()));
  readonly activeSecrets = computed(() => this.active(this.secrets()));
  readonly activeSources = computed(() => this.active(this.sources()));
  readonly activeDestinations = computed(() => this.active(this.destinations()));
  readonly activeSchedules = computed(() => this.active(this.schedules()));
  readonly activePlans = computed(() => this.active(this.plans()));
  readonly activeIntegrations = computed(() => this.active(this.integrations()));
  readonly activeContacts = computed(() => this.active(this.contacts()));
  readonly activeRules = computed(() => this.active(this.rules()));

  readonly latestEjecución = computed(() => this.runs()[0] ?? null);
  readonly failedEjecucións = computed(() => this.runs().filter(x => this.norm(x.status) === 'FAILED').length);
  readonly successEjecucións = computed(() => this.runs().filter(x => this.norm(x.status) === 'SUCCESS').length);
  readonly partialEjecucións = computed(() => this.runs().filter(x => this.norm(x.status) === 'PARTIAL_SUCCESS').length);
  readonly runningEjecucións = computed(() => this.runs().filter(x => ['RUNNING', 'PENDING'].includes(this.norm(x.status))).length);
  readonly lastEjecuciónSize = computed(() => this.runs().reduce((acc, item) => acc + Number(item.fileSizeBytes ?? 0), 0));

  readonly plansWithEncryptionIssue = computed(() =>
    this.activePlans().filter(plan => plan.encryptionEnabled && !plan.idBkpSecretEncryptionFk)
  );

  readonly destinationsWithoutRetention = computed(() =>
    this.activeDestinations().filter(dest => !Number(dest.retentionDays ?? 0))
  );

  readonly setupSteps = computed<SetupStep[]>(() => {
    const agents = this.activeAgents();
    const tools = this.tools();
    const secrets = this.activeSecrets();
    const sources = this.activeSources();
    const destinations = this.activeDestinations();
    const schedules = this.activeSchedules();
    const plans = this.activePlans();
    const successfulEjecucións = this.successEjecucións();

    const steps: SetupStep[] = [
      {
        key: 'agents',
        order: 1,
        title: 'Agente de ejecución',
        subtitle: 'Servidor donde se ejecutan pg_dump, pg_restore, mysqldump o mysql.',
        route: '/app/backups/agents',
        actionLabel: agents.length ? 'Ver agentes' : 'Crear agente',
        icon: 'pi pi-server',
        ready: agents.length > 0,
        required: true,
        count: agents.length,
        tone: agents.length ? 'success' : 'danger',
        help: 'Sin agente no se puede ejecutar ningún backup ni restore.',
      },
      {
        key: 'tools',
        order: 2,
        title: 'Herramientas del motor',
        subtitle: 'Rutas de binarios por agente: pg_dump, pg_restore, psql, mysqldump, mysql.',
        route: '/app/backups/agents',
        actionLabel: tools.length ? 'Ver herramientas' : 'Agregar herramientas',
        icon: 'pi pi-wrench',
        ready: tools.length > 0,
        required: true,
        count: tools.length,
        tone: tools.length ? 'success' : 'danger',
        help: 'El agente necesita saber dónde están los binarios del motor de base de datos.',
      },
      {
        key: 'secrets',
        order: 3,
        title: 'Secretos cifrados',
        subtitle: 'Contraseñas, tokens, claves S3/Drive y claves de cifrado.',
        route: '/app/backups/secrets',
        actionLabel: secrets.length ? 'Ver secretos' : 'Crear secreto',
        icon: 'pi pi-key',
        ready: secrets.length > 0,
        required: true,
        count: secrets.length,
        tone: secrets.length ? 'success' : 'danger',
        help: 'Las credenciales no se guardan en claro. Primero crea el secreto y luego lo seleccionas en orígenes/destinos.',
      },
      {
        key: 'sources',
        order: 4,
        title: 'Base origen',
        subtitle: 'Conexión PostgreSQL/MySQL que será respaldada.',
        route: '/app/backups/sources',
        actionLabel: sources.length ? 'Ver orígenes' : 'Agregar origen',
        icon: 'pi pi-database',
        ready: sources.length > 0,
        required: true,
        count: sources.length,
        tone: sources.length ? 'success' : 'danger',
        help: 'Un origen necesita motor, host, puerto, base, usuario y secreto de contraseña si aplica.',
      },
      {
        key: 'destinations',
        order: 5,
        title: 'Destino de almacenamiento',
        subtitle: 'Dónde se guarda el archivo generado: local, SFTP, S3 o Google Drive.',
        route: '/app/backups/destinations',
        actionLabel: destinations.length ? 'Ver destinos' : 'Agregar destino',
        icon: 'pi pi-cloud-upload',
        ready: destinations.length > 0,
        required: true,
        count: destinations.length,
        tone: destinations.length ? 'success' : 'danger',
        help: 'El destino define ruta/basePath, bucket, folder, retención e integración si aplica.',
      },
      {
        key: 'schedules',
        order: 6,
        title: 'Horario',
        subtitle: 'Frecuencia automática: diaria, semanal, mensual, intervalo o cron.',
        route: '/app/backups/schedules',
        actionLabel: schedules.length ? 'Ver horarios' : 'Crear horario',
        icon: 'pi pi-clock',
        ready: schedules.length > 0,
        required: false,
        count: schedules.length,
        tone: schedules.length ? 'success' : 'warning',
        help: 'No es obligatorio para backup manual, pero sí para automatizar.',
      },
      {
        key: 'plans',
        order: 7,
        title: 'Plan de backup',
        subtitle: 'Une origen, agente, horario, formato, compresión, cifrado y destinos.',
        route: '/app/backups/plans',
        actionLabel: plans.length ? 'Ver planes' : 'Crear plan',
        icon: 'pi pi-calendar-clock',
        ready: plans.length > 0,
        required: true,
        count: plans.length,
        tone: plans.length ? 'success' : 'danger',
        help: 'El plan es la unidad ejecutable. Sin plan no hay runs.',
      },
      {
        key: 'runs',
        order: 8,
        title: 'Primera ejecución',
        subtitle: 'Ejecuta un plan manualmente y revisa uploads/notificaciones.',
        route: plans.length ? '/app/backups/plans' : '/app/backups/runs',
        actionLabel: successfulEjecucións ? 'Ver runs' : 'Ejecutar backup',
        icon: 'pi pi-play-circle',
        ready: successfulEjecucións > 0,
        required: false,
        count: successfulEjecucións,
        tone: successfulEjecucións ? 'success' : (plans.length ? 'warning' : 'neutral'),
        help: 'Cuando el plan esté listo, ejecútalo manualmente para validar el flujo completo.',
      },
    ];

    return steps.sort((a, b) => a.order - b.order);
  });

  readonly setupProgress = computed(() => {
    const steps = this.setupSteps().filter(x => x.required);
    if (!steps.length) return 0;
    return Math.round((steps.filter(x => x.ready).length / steps.length) * 100);
  });

  readonly requiredStepCount = computed(() =>
    this.setupSteps().filter(step => step.required).length
  );

  readonly requiredReadyCount = computed(() =>
    this.setupSteps().filter(step => step.required && step.ready).length
  );

  readonly nextSetupStep = computed(() =>
    this.setupSteps().find(step => step.required && !step.ready) ??
    this.setupSteps().find(step => !step.ready) ??
    null
  );

  readonly moduleCards = computed<BkpModuleCard[]>(() => [
    {
      title: 'Agentes',
      subtitle: 'Servidores y herramientas pg_dump/mysqldump.',
      route: '/app/backups/agents',
      icon: 'pi pi-server',
      countLabel: `${this.activeAgents().length} activos · ${this.tools().length} herramientas`,
      statusLabel: this.activeAgents().length && this.tools().length ? 'Listo' : 'Pendiente',
      tone: this.activeAgents().length && this.tools().length ? 'success' : 'danger',
      dependsOn: 'Primer paso obligatorio',
    },
    {
      title: 'Secretos',
      subtitle: 'Contraseñas y tokens cifrados.',
      route: '/app/backups/secrets',
      icon: 'pi pi-key',
      countLabel: `${this.activeSecrets().length} activos`,
      statusLabel: this.activeSecrets().length ? 'Listo' : 'Pendiente',
      tone: this.activeSecrets().length ? 'success' : 'danger',
      dependsOn: 'Usado por orígenes, destinos y cifrado',
    },
    {
      title: 'Orígenes',
      subtitle: 'Bases PostgreSQL/MySQL a respaldar.',
      route: '/app/backups/sources',
      icon: 'pi pi-database',
      countLabel: `${this.activeSources().length} activos`,
      statusLabel: this.activeSources().length ? 'Listo' : 'Pendiente',
      tone: this.activeSources().length ? 'success' : 'danger',
      dependsOn: 'Depende de secretos',
    },
    {
      title: 'Destinos',
      subtitle: 'Local, S3 o Google Drive.',
      route: '/app/backups/destinations',
      icon: 'pi pi-cloud-upload',
      countLabel: `${this.activeDestinations().length} activos`,
      statusLabel: this.activeDestinations().length ? 'Listo' : 'Pendiente',
      tone: this.activeDestinations().length ? 'success' : 'danger',
      dependsOn: 'Depende de providers/secretos si es remoto',
    },
    {
      title: 'Horarios',
      subtitle: 'Automatización diaria, semanal, intervalo o cron.',
      route: '/app/backups/schedules',
      icon: 'pi pi-clock',
      countLabel: `${this.activeSchedules().length} activos`,
      statusLabel: this.activeSchedules().length ? 'Configurado' : 'Opcional',
      tone: this.activeSchedules().length ? 'success' : 'warning',
      dependsOn: 'Opcional para ejecución manual',
    },
    {
      title: 'Planes',
      subtitle: 'Une origen + agente + horario + destinos.',
      route: '/app/backups/plans',
      icon: 'pi pi-calendar-clock',
      countLabel: `${this.activePlans().length} activos`,
      statusLabel: this.activePlans().length ? 'Ejecutable' : 'Pendiente',
      tone: this.activePlans().length ? 'success' : 'danger',
      dependsOn: 'Depende de agente, origen y destino',
    },
    {
      title: 'Ejecuciones',
      subtitle: 'Ejecucións, archivos, checksums, uploads y errores.',
      route: '/app/backups/runs',
      icon: 'pi pi-list-check',
      countLabel: `${this.runs().length} recientes`,
      statusLabel: this.failedEjecucións() ? `${this.failedEjecucións()} fallidos` : 'Monitoreo',
      tone: this.failedEjecucións() ? 'danger' : (this.runs().length ? 'success' : 'neutral'),
      dependsOn: 'Nace desde un plan ejecutado',
    },
    {
      title: 'Restauraciones',
      subtitle: 'TEST, DRILL o REAL con confirmación fuerte.',
      route: '/app/backups/restores',
      icon: 'pi pi-replay',
      countLabel: `${this.restores().length} registros`,
      statusLabel: 'Restore',
      tone: this.restores().some(x => this.norm(x.status) === 'FAILED') ? 'danger' : 'neutral',
      dependsOn: 'Depende de runs exitosos',
    },
    {
      title: 'Retención',
      subtitle: 'Limpieza local y registro remoto.',
      route: '/app/backups/retention',
      icon: 'pi pi-trash',
      countLabel: `${this.retentionEjecucións().length} ejecuciones`,
      statusLabel: 'Limpieza',
      tone: this.retentionEjecucións().some(x => this.norm(x.status) === 'FAILED') ? 'danger' : 'neutral',
      dependsOn: 'Depende de destinos con retentionDays',
    },
    {
      title: 'Notificaciones',
      subtitle: 'Contactos, reglas y providers.',
      route: '/app/backups/notifications',
      icon: 'pi pi-send',
      countLabel: `${this.activeContacts().length} contactos · ${this.activeRules().length} reglas`,
      statusLabel: this.activeContacts().length && this.activeRules().length ? 'Activas' : 'Opcional',
      tone: this.activeContacts().length && this.activeRules().length ? 'success' : 'warning',
      dependsOn: 'EMAIL, WhatsApp, Telegram o Webhook',
    },
    {
      title: 'Configuración',
      subtitle: 'Timezone, retención y parámetros globales.',
      route: '/app/backups/settings',
      icon: 'pi pi-cog',
      countLabel: `${this.configs().length} registros`,
      statusLabel: this.configs().length ? 'Configurado' : 'Revisar',
      tone: this.configs().length ? 'success' : 'warning',
      dependsOn: 'Valores por defecto del módulo',
    },
  ]);

  readonly healthAlerts = computed<HealthAlert[]>(() => {
    const alerts: HealthAlert[] = [];

    if (!this.activeAgents().length) {
      alerts.push({
        title: 'No tienes agente de backup',
        message: 'Configura el servidor que ejecutará los comandos de dump y restore.',
        tone: 'danger',
        route: '/app/backups/agents',
        action: 'Crear agente',
      });
    }

    if (this.activeAgents().length && !this.tools().length) {
      alerts.push({
        title: 'Faltan herramientas del motor',
        message: 'Agrega rutas de pg_dump, pg_restore, psql, mysqldump o mysql para el agente.',
        tone: 'danger',
        route: '/app/backups/agents',
        action: 'Agregar herramientas',
      });
    }

    if (!this.activeSecrets().length) {
      alerts.push({
        title: 'No tienes secretos cifrados',
        message: 'Crea secretos para password de base, credenciales remotas o claves de cifrado.',
        tone: 'danger',
        route: '/app/backups/secrets',
        action: 'Crear secreto',
      });
    }

    if (!this.activeSources().length) {
      alerts.push({
        title: 'No tienes bases origen',
        message: 'Registra al menos una base PostgreSQL o MySQL para respaldar.',
        tone: 'danger',
        route: '/app/backups/sources',
        action: 'Agregar origen',
      });
    }

    if (!this.activeDestinations().length) {
      alerts.push({
        title: 'No tienes destinos activos',
        message: 'Configura un destino LOCAL, S3 o GOOGLE_DRIVE para almacenar los archivos.',
        tone: 'danger',
        route: '/app/backups/destinations',
        action: 'Agregar destino',
      });
    }

    if (!this.activePlans().length) {
      alerts.push({
        title: 'No tienes planes ejecutables',
        message: 'Crea un plan cuando ya tengas agente, origen y destino.',
        tone: 'warning',
        route: '/app/backups/plans',
        action: 'Crear plan',
      });
    }

    if (this.plansWithEncryptionIssue().length) {
      alerts.push({
        title: 'Planes con cifrado incompleto',
        message: `${this.plansWithEncryptionIssue().length} plan(es) tienen cifrado activo sin secreto de cifrado.`,
        tone: 'danger',
        route: '/app/backups/plans',
        action: 'Revisar planes',
      });
    }

    if (this.destinationsWithoutRetention().length) {
      alerts.push({
        title: 'Destinos sin retención definida',
        message: `${this.destinationsWithoutRetention().length} destino(s) no tienen retentionDays definido.`,
        tone: 'warning',
        route: '/app/backups/destinations',
        action: 'Revisar destinos',
      });
    }

    if (this.failedEjecucións()) {
      alerts.push({
        title: 'Hay ejecuciones fallidas',
        message: `Revisa ${this.failedEjecucións()} run(s) fallidos en las últimas ejecuciones cargadas.`,
        tone: 'danger',
        route: '/app/backups/runs',
        action: 'Ver runs',
      });
    }

    return alerts;
  });

  readonly flowNodes = [
    { label: 'Secretos', icon: 'pi pi-key', route: '/app/backups/secrets' },
    { label: 'Agente', icon: 'pi pi-server', route: '/app/backups/agents' },
    { label: 'Origen DB', icon: 'pi pi-database', route: '/app/backups/sources' },
    { label: 'Destino', icon: 'pi pi-cloud-upload', route: '/app/backups/destinations' },
    { label: 'Horario', icon: 'pi pi-clock', route: '/app/backups/schedules' },
    { label: 'Plan', icon: 'pi pi-calendar-clock', route: '/app/backups/plans' },
    { label: 'Ejecución', icon: 'pi pi-play-circle', route: '/app/backups/runs' },
    { label: 'Restore / Retención', icon: 'pi pi-shield', route: '/app/backups/restores' },
  ];

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.warnings.set([]);

    forkJoin({
      agents: this.repo.listarAgents('', 0, 100, null).pipe(catchError(error => this.fail('agentes', error))),
      tools: this.repo.listarTools('', 0, 100, null).pipe(catchError(error => this.fail('herramientas', error))),
      secrets: this.repo.listarSecrets('', 0, 100, null).pipe(catchError(error => this.fail('secretos', error))),
      sources: this.repo.listarSources('', 0, 100, null).pipe(catchError(error => this.fail('orígenes', error))),
      destinations: this.repo.listarDestinations('', 0, 100, null).pipe(catchError(error => this.fail('destinos', error))),
      schedules: this.repo.listarSchedules('', 0, 100, null).pipe(catchError(error => this.fail('horarios', error))),
      plans: this.repo.listarPlans('', 0, 100, null).pipe(catchError(error => this.fail('planes', error))),
      runs: this.repo.listarEjecucións('', 0, 20, null).pipe(catchError(error => this.fail('ejecuciones', error))),
      integrations: this.repo.listarIntegrations('', 0, 100, null).pipe(catchError(error => this.fail('integraciones', error))),
      contacts: this.repo.listarContacts('', 0, 100, null).pipe(catchError(error => this.fail('contactos', error))),
      rules: this.repo.listarRules('', 0, 100, null).pipe(catchError(error => this.fail('reglas', error))),
      restores: this.repo.listarRestores('', 0, 20, null).pipe(catchError(error => this.fail('restauraciones', error))),
      retentionEjecucións: this.repo.listarRetentionEjecucións('', 0, 20, null).pipe(catchError(error => this.fail('retención', error))),
      configs: this.repo.listarGeneralConfig('', 0, 20, null).pipe(catchError(error => this.fail('configuración', error))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(result => {
        this.agents.set(result.agents.items ?? []);
        this.tools.set(result.tools.items ?? []);
        this.secrets.set(result.secrets.items ?? []);
        this.sources.set(result.sources.items ?? []);
        this.destinations.set(result.destinations.items ?? []);
        this.schedules.set(result.schedules.items ?? []);
        this.plans.set(result.plans.items ?? []);
        this.runs.set(result.runs.items ?? []);
        this.integrations.set(result.integrations.items ?? []);
        this.contacts.set(result.contacts.items ?? []);
        this.rules.set(result.rules.items ?? []);
        this.restores.set(result.restores.items ?? []);
        this.retentionEjecucións.set(result.retentionEjecucións.items ?? []);
        this.configs.set(result.configs.items ?? []);
      });
  }

  go(route: string) {
    this.router.navigateByUrl(route);
  }

  goNextStep() {
    const step = this.nextSetupStep();
    if (step) {
      this.go(step.route);
      return;
    }

    this.go('/app/backups/plans');
  }

  executeFirstPlan() {
    const plan = this.activePlans()[0];
    if (!plan) {
      this.go('/app/backups/plans');
      return;
    }

    this.notify.info('Ejecutar backup', 'Abre el plan y usa el botón Ejecutar para lanzar la prueba manual.');
    this.go('/app/backups/plans');
  }

  toneClass(tone: SetupTone | string | null | undefined) {
    const value = String(tone || 'neutral').toLowerCase();
    if (value === 'success') return 'is-success';
    if (value === 'danger') return 'is-danger';
    if (value === 'warning') return 'is-warning';
    return 'is-neutral';
  }

  stepStatus(step: SetupStep) {
    if (step.ready) return 'OK';
    if (step.required) return 'PENDIENTE';
    return 'OPCIONAL';
  }

  moduleStatus(card: BkpModuleCard) {
    return card.statusLabel;
  }

  fmtBytes = fmtBytes;
  fmtDate = fmtDate;

  private active<T extends { activo?: boolean }>(items: T[]) {
    return (items ?? []).filter(item => item?.activo !== false);
  }

  private norm(value: unknown) {
    return String(value ?? '').trim().toUpperCase();
  }

  private fail(label: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    this.warnings.update(items => [...items, `No se pudo cargar ${label}: ${message}`]);
    return of({ items: [] });
  }
}
