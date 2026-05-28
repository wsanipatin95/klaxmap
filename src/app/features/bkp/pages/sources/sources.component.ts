import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpSecret, BkpSourceDatabase } from '../../data-access/bkp.models';
import { jsonPretty, labelSecretType, parseJsonObjectStrict, toNullableString } from '../../data-access/bkp.ux';

type SourceReloadState = {
  id?: number | null;
  name?: string | null;
};

@Component({
  selector: 'app-bkp-sources',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BkpPageHeaderComponent, BkpEmptyStateComponent],
  templateUrl: './sources.component.html',
  styleUrl: './sources.component.scss',
})
export class BkpSourcesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private repo = inject(BkpRepository);
  private router = inject(Router);

  items = signal<BkpSourceDatabase[]>([]);
  secrets = signal<BkpSecret[]>([]);
  motores = signal<string[]>(['POSTGRESQL', 'MYSQL']);
  selected = signal<BkpSourceDatabase | null>(null);
  q = signal('');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal('');
  success = signal('');
  technicalOpen = signal(false);

  form = this.fb.group({
    nombre: ['', Validators.required],
    motor: ['POSTGRESQL', Validators.required],
    host: ['localhost', Validators.required],
    puerto: [5432, [Validators.required, Validators.min(1)]],
    nombreBase: ['', Validators.required],
    nombreSchema: [''],
    usuario: ['', Validators.required],
    idBkpSecretPasswordFk: [null as number | null],
    sslEnabled: [false],
    connectionParams: ['{}'],
    observacion: [''],
    activo: [true],
  });

  isPostgres = computed(() => String(this.form.value.motor || '').toUpperCase() === 'POSTGRESQL');

  ngOnInit() {
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.success.set('');
    });

    this.form.get('motor')?.valueChanges.subscribe(v => {
      const motor = String(v || '').toUpperCase();
      const currentPort = Number(this.form.value.puerto || 0);

      if (motor === 'MYSQL') {
        this.form.patchValue({
          puerto: currentPort && currentPort !== 5432 ? currentPort : 3306,
          nombreSchema: '',
        }, { emitEvent: false });
        return;
      }

      this.form.patchValue({
        puerto: currentPort && currentPort !== 3306 ? currentPort : 5432,
      }, { emitEvent: false });
    });

    this.cargar();
  }

  canDeactivate() {
    return !this.dirty() || confirm('Tienes cambios pendientes. ¿Salir sin guardar?');
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar(state: SourceReloadState = {}) {
    const snapshot: SourceReloadState = {
      id: state.id ?? this.selected()?.idBkpSourceDatabase ?? null,
      name: state.name ?? this.selected()?.nombre ?? null,
    };

    this.loading.set(true);
    this.error.set('');

    this.repo.catalogos().subscribe({
      next: c => {
        const motores = c.motores?.length ? c.motores : ['POSTGRESQL', 'MYSQL'];
        this.motores.set(motores.filter(m => ['POSTGRESQL', 'MYSQL'].includes(m)));
      },
      error: () => {},
    });

    this.repo.listarSecrets('', 0, 300, true).subscribe({
      next: p => this.secrets.set((p.items ?? []).filter(s => s.activo !== false)),
      error: () => {},
    });

    this.repo.listarSources(this.q(), 0, 200, null)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: p => {
          this.items.set(p.items ?? []);
          const selected = this.findSource(snapshot.id, snapshot.name);
          if (selected) this.seleccionarSinConfirmar(selected);
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  nuevo() {
    this.selected.set(null);
    this.technicalOpen.set(false);

    this.form.reset({
      nombre: '',
      motor: 'POSTGRESQL',
      host: 'localhost',
      puerto: 5432,
      nombreBase: '',
      nombreSchema: '',
      usuario: '',
      idBkpSecretPasswordFk: null,
      sslEnabled: false,
      connectionParams: '{}',
      observacion: '',
      activo: true,
    });

    this.dirty.set(false);
    this.error.set('');
    this.success.set('');
  }

  seleccionar(i: BkpSourceDatabase) {
    if (this.dirty() && !confirm('Tienes cambios pendientes. ¿Cambiar de origen sin guardar?')) return;
    this.seleccionarSinConfirmar(i);
  }

  private seleccionarSinConfirmar(i: BkpSourceDatabase) {
    this.selected.set(i);
    this.technicalOpen.set(false);

    this.form.reset({
      nombre: i.nombre,
      motor: String(i.motor || 'POSTGRESQL').toUpperCase(),
      host: i.host,
      puerto: i.puerto,
      nombreBase: i.nombreBase,
      nombreSchema: i.nombreSchema ?? '',
      usuario: i.usuario,
      idBkpSecretPasswordFk: i.idBkpSecretPasswordFk ?? null,
      sslEnabled: !!i.sslEnabled,
      connectionParams: jsonPretty(i.connectionParams),
      observacion: i.observacion ?? '',
      activo: i.activo !== false,
    });

    this.dirty.set(false);
    this.error.set('');
    this.success.set('');
  }

  guardar() {
    this.error.set('');
    this.success.set('');

    try {
      const v = this.form.getRawValue();

      if (!v.nombre?.trim()) throw new Error('Nombre es obligatorio.');
      if (!v.host?.trim()) throw new Error('Host es obligatorio.');
      if (!v.nombreBase?.trim()) throw new Error('Base es obligatoria.');
      if (!v.usuario?.trim()) throw new Error('Usuario es obligatorio.');
      if (!v.idBkpSecretPasswordFk) throw new Error('Secreto password es obligatorio.');

      const payload: Partial<BkpSourceDatabase> = {
        nombre: v.nombre.trim(),
        motor: String(v.motor || 'POSTGRESQL').toUpperCase(),
        host: v.host.trim(),
        puerto: Number(v.puerto),
        nombreBase: v.nombreBase.trim(),
        nombreSchema: this.isPostgres() ? toNullableString(v.nombreSchema) : null,
        usuario: v.usuario.trim(),
        idBkpSecretPasswordFk: v.idBkpSecretPasswordFk,
        sslEnabled: !!v.sslEnabled,
        connectionParams: parseJsonObjectStrict(v.connectionParams, 'Parámetros JSON'),
        observacion: toNullableString(v.observacion),
        activo: !!v.activo,
      };

      const id = this.selected()?.idBkpSourceDatabase;
      const state: SourceReloadState = {
        id: id || null,
        name: payload.nombre,
      };

      this.saving.set(true);

      const op = id
        ? this.repo.editarSource(id, payload as Record<string, unknown>)
        : this.repo.crearSource(payload);

      op.pipe(finalize(() => this.saving.set(false))).subscribe({
        next: r => {
          this.success.set(r.mensaje);
          this.dirty.set(false);
          this.cargar(state);
        },
        error: e => this.error.set(this.msg(e)),
      });
    } catch (e) {
      this.error.set(this.msg(e));
    }
  }

  eliminar() {
    const id = this.selected()?.idBkpSourceDatabase;
    if (!id || !confirm('¿Desactivar esta base origen?')) return;

    this.saving.set(true);

    this.repo.eliminarSource(id)
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

  labelSecretType = labelSecretType;

  sourceSubtitle(i: BkpSourceDatabase) {
    return `${i.motor} · ${i.host}:${i.puerto}/${i.nombreBase}`;
  }

  motorHint() {
    const motor = String(this.form.value.motor || '').toUpperCase();
    return motor === 'MYSQL'
      ? 'Usa mysqldump/mysql configurados en Agentes y binarios.'
      : 'Usa pg_dump/pg_restore/psql configurados en Agentes y binarios.';
  }

  schemaHint() {
    return this.isPostgres()
      ? 'Vacío = toda la base. Con valor, pg_dump respaldará solo ese schema.'
      : '';
  }

  private findSource(id?: number | null, name?: string | null) {
    if (id) {
      const byId = this.items().find(x => x.idBkpSourceDatabase === id);
      if (byId) return byId;
    }

    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;

    return this.items().find(x => String(x.nombre || '').trim().toUpperCase() === normalized) ?? null;
  }

  private msg(e: unknown) {
    return e instanceof Error ? e.message : String((e as any)?.message || e || 'Error');
  }
}
