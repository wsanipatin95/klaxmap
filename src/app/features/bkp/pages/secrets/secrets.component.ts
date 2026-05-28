import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpSecret } from '../../data-access/bkp.models';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { NotifyService } from 'src/app/core/services/notify.service';

type SecretReloadState = {
  id?: number | null;
  name?: string | null;
};

@Component({
  selector: 'app-bkp-secrets',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    ConfirmDialogModule,
    BkpPageHeaderComponent,
    BkpEmptyStateComponent,
  ],
  templateUrl: './secrets.component.html',
  styleUrl: './secrets.component.scss',
})
export class BkpSecretsComponent implements OnInit, PendingChangesAware {
  private repo = inject(BkpRepository);
  private confirm = inject(BkpConfirmService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  q = signal('');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  items = signal<BkpSecret[]>([]);
  selected = signal<BkpSecret | null>(null);

  secretTypes = [
    'DB_PASSWORD',
    'ENCRYPTION_KEY',
    'SSH_PASSWORD',
    'SSH_PRIVATE_KEY',
    'API_TOKEN',
    'GOOGLE_TOKEN',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'SMTP_PASSWORD',
    'WPP_TOKEN',
    'TELEGRAM_TOKEN',
    'WEBHOOK_TOKEN',
    'OTHER',
  ];

  algorithmOptions = [
    { value: 'AES_GCM', label: 'AES-GCM', hint: 'Soportado actualmente por el backend.' },
  ];

  form = this.fb.group({
    nombre: ['', Validators.required],
    tipoSecret: ['DB_PASSWORD', Validators.required],
    algoritmo: ['AES_GCM', Validators.required],
    descripcion: [''],
    activo: [true],
    valorPlano: [''],
    confirmarValor: [''],
  });

  ngOnInit() {
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.success.set(null);
    });

    this.cargar();
    this.nuevo();
  }

  canDeactivate() {
    return !this.dirty() || this.confirm.confirmDiscard();
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar(state: SecretReloadState = {}) {
    const snapshot: SecretReloadState = {
      id: state.id ?? this.selected()?.idBkpSecret ?? null,
      name: state.name ?? this.selected()?.nombre ?? null,
    };

    this.loading.set(true);

    this.repo.listarSecrets(this.q(), 0, 200, null)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: r => {
          this.items.set(r.items ?? []);

          const selected =
            this.findSecret(snapshot.id, snapshot.name) ??
            this.findSecret(null, state.name ?? null);

          if (selected) this.seleccionarSinConfirmar(selected);
        },
        error: e => this.setError('No se pudo cargar secretos', e?.message),
      });
  }

  nuevo() {
    this.selected.set(null);
    this.form.reset({
      nombre: '',
      tipoSecret: 'DB_PASSWORD',
      algoritmo: 'AES_GCM',
      descripcion: '',
      activo: true,
      valorPlano: '',
      confirmarValor: '',
    });
    this.clean();
  }

  async seleccionar(i: BkpSecret) {
    if (this.dirty() && !(await this.confirm.confirmDiscard())) return;
    this.seleccionarSinConfirmar(i);
  }

  private seleccionarSinConfirmar(i: BkpSecret) {
    this.selected.set(i);
    this.form.reset({
      nombre: i.nombre ?? '',
      tipoSecret: i.tipoSecret ?? 'OTHER',
      algoritmo: i.algoritmo ?? 'AES_GCM',
      descripcion: i.descripcion ?? '',
      activo: i.activo !== false,
      valorPlano: '',
      confirmarValor: '',
    });
    this.clean();
  }

  guardar() {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.setError('Completa nombre, tipo y algoritmo.');
      return;
    }

    const v = this.form.getRawValue();
    const id = this.selected()?.idBkpSecret ?? 0;
    const valor = String(v.valorPlano ?? '').trim();
    const confirmar = String(v.confirmarValor ?? '').trim();

    if (!id && !valor) {
      this.setError('Valor requerido', 'Para crear un secreto debes ingresar el valor.');
      return;
    }

    if (!valor && confirmar) {
      this.setError('Valor requerido', 'Ingresa el nuevo valor o limpia la confirmación.');
      return;
    }

    if (valor !== confirmar) {
      this.setError('Confirmación inválida', 'Los valores no coinciden.');
      return;
    }

    const nombre = String(v.nombre ?? '').trim();
    const tipoSecret = String(v.tipoSecret ?? 'OTHER').trim();
    const algoritmo = String(v.algoritmo ?? 'AES_GCM').trim();
    const descripcion = v.descripcion ? String(v.descripcion) : null;
    const activo = v.activo ?? true;

    const cambios = {
      nombre,
      tipoSecret,
      algoritmo,
      descripcion,
      activo,
    };

    const state: SecretReloadState = {
      id: id || null,
      name: nombre,
    };

    const req = id
      ? this.repo.editarSecret({ idBkpSecret: id, valorPlano: valor || null, cambios })
      : this.repo.crearSecret({
          nombre,
          tipoSecret,
          algoritmo,
          descripcion,
          activo,
          valorPlano: valor,
        });

    this.saving.set(true);

    req.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (r: any) => {
        this.success.set(r?.mensaje || 'Secreto guardado');
        this.notify.success('Secreto guardado', r?.mensaje);
        this.dirty.set(false);
        this.form.patchValue({ valorPlano: '', confirmarValor: '' }, { emitEvent: false });

        const savedId = Number(r?.data?.idBkpSecret ?? r?.idBkpSecret ?? 0) || state.id;
        this.cargar({ id: savedId, name: state.name });
      },
      error: e => this.setError('No se pudo guardar', e?.message),
    });
  }

  async eliminar(i = this.selected()) {
    if (!i) return;
    if (!(await this.confirm.confirmDelete(i.nombre))) return;

    this.saving.set(true);

    this.repo.eliminarSecret(i.idBkpSecret)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: r => {
          this.notify.success('Secreto desactivado', r.mensaje);
          this.nuevo();
          this.cargar();
        },
        error: e => this.setError('No se pudo desactivar', e?.message),
      });
  }

  clean() {
    this.dirty.set(false);
    this.error.set(null);
    this.success.set(null);
  }

  setError(summary: string, detail?: string) {
    this.error.set(detail || summary);
    this.notify.error(summary, detail);
  }

  invalid(name: string) {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  isEditMode() {
    return !!this.selected();
  }

  selectedAlgorithmHint() {
    const selected = this.algorithmOptions.find(a => a.value === this.form.value.algoritmo);
    return selected?.hint ?? 'Selecciona un algoritmo soportado.';
  }

  typeLabel(type?: string | null) {
    const value = String(type || '').toUpperCase();
    const labels: Record<string, string> = {
      DB_PASSWORD: 'Contraseña de base de datos',
      ENCRYPTION_KEY: 'Clave de cifrado',
      SSH_PASSWORD: 'Password SSH/SFTP',
      SSH_PRIVATE_KEY: 'Clave privada SSH/SFTP',
      API_TOKEN: 'Token API',
      GOOGLE_TOKEN: 'Token Google',
      S3_ACCESS_KEY: 'S3 Access Key',
      S3_SECRET_KEY: 'S3 Secret Key',
      SMTP_PASSWORD: 'Password SMTP',
      WPP_TOKEN: 'Token WhatsApp',
      TELEGRAM_TOKEN: 'Token Telegram',
      WEBHOOK_TOKEN: 'Token Webhook',
      OTHER: 'Otro',
    };
    return labels[value] ?? value;
  }

  typeHint(type?: string | null) {
    const value = String(type || '').toUpperCase();

    if (value === 'DB_PASSWORD') return 'Usado por bases origen.';
    if (value === 'ENCRYPTION_KEY') return 'Usado para cifrar archivos de backup.';
    if (value === 'SSH_PASSWORD' || value === 'SSH_PRIVATE_KEY') return 'Usado por destinos SFTP/SSH.';
    if (value === 'GOOGLE_TOKEN') return 'Usado por destinos Google Drive.';
    if (value.startsWith('S3_')) return 'Usado por destinos S3.';
    if (value === 'SMTP_PASSWORD') return 'Usado por notificaciones de correo.';
    if (value === 'TELEGRAM_TOKEN' || value === 'WEBHOOK_TOKEN' || value === 'WPP_TOKEN') return 'Usado por notificaciones.';

    return 'Credencial cifrada para integraciones.';
  }

  private findSecret(id?: number | null, name?: string | null) {
    if (id) {
      const byId = this.items().find(x => x.idBkpSecret === id);
      if (byId) return byId;
    }

    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;

    return this.items().find(x => String(x.nombre || '').trim().toUpperCase() === normalized) ?? null;
  }
}
