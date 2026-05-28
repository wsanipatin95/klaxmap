import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpSecret, BkpStorageDestination } from '../../data-access/bkp.models';
import {
  destinationTypeHint,
  jsonPretty,
  labelSecretType,
  labelStorageType,
  storageTypesFromCatalog,
  toNullableString,
  toNumberOrNull,
} from '../../data-access/bkp.ux';

type DestinationReloadState = {
  id?: number | null;
  name?: string | null;
};

type ParamHelp = {
  key: string;
  label: string;
  required?: boolean;
  source: 'campo' | 'configJson' | 'backend';
};

@Component({
  selector: 'app-bkp-destinations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BkpPageHeaderComponent, BkpEmptyStateComponent],
  templateUrl: './destinations.component.html',
  styleUrl: './destinations.component.scss',
})
export class BkpDestinationsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private repo = inject(BkpRepository);
  private router = inject(Router);

  items = signal<BkpStorageDestination[]>([]);
  secrets = signal<BkpSecret[]>([]);
  storageTypes = signal<string[]>(['LOCAL', 'GOOGLE_DRIVE', 'S3', 'SFTP', 'SSH', 'SCP']);
  selected = signal<BkpStorageDestination | null>(null);
  q = signal('');
  loading = signal(false);
  saving = signal(false);
  dirty = signal(false);
  error = signal('');
  success = signal('');
  technicalOpen = signal(false);
  generatedJsonOpen = signal(false);
  preservedConfig = signal<Record<string, unknown>>({});

  form = this.fb.group({
    nombre: ['', Validators.required],
    tipoStorage: ['LOCAL', Validators.required],
    basePath: ['/var/backups/klax'],
    bucketName: [''],
    prefixPath: [''],
    folderId: [''],
    idBkpSecretCredentialFk: [null as number | null],
    retentionDays: [30, [Validators.required, Validators.min(1)]],
    immutableEnabled: [false],
    immutableDays: [null as number | null],
    activo: [true],

    remoteHost: [''],
    remotePort: [22],
    remoteUsername: [''],
    remotePath: [''],
    identityFile: [''],
    strictHostKey: [false],
    knownHosts: [''],
    sshBinary: ['ssh'],
    scpBinary: ['scp'],

    s3Region: ['us-east-1'],
    s3EndpointOverride: [''],
  });

  tipo = computed(() => String(this.form.value.tipoStorage || 'LOCAL').toUpperCase());
  typeHint = computed(() => destinationTypeHint(this.tipo()));

  ngOnInit() {
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.success.set('');
    });

    this.form.get('tipoStorage')?.valueChanges.subscribe(value => {
      this.applyDefaultsForType(String(value || '').toUpperCase());
    });

    this.cargar();
  }

  canDeactivate() {
    return !this.dirty() || confirm('Tienes cambios pendientes. ¿Salir sin guardar?');
  }

  volverDashboard() {
    this.router.navigateByUrl('/app/backups/dashboard');
  }

  cargar(state: DestinationReloadState = {}) {
    const snapshot: DestinationReloadState = {
      id: state.id ?? this.selected()?.idBkpStorageDestination ?? null,
      name: state.name ?? this.selected()?.nombre ?? null,
    };

    this.loading.set(true);
    this.error.set('');

    this.repo.catalogos().subscribe({
      next: c => {
        const fromCatalog = storageTypesFromCatalog(c);
        const allowed = fromCatalog.length ? fromCatalog : ['LOCAL', 'GOOGLE_DRIVE', 'S3', 'SFTP', 'SSH', 'SCP'];
        this.storageTypes.set(this.normalizeStorageTypes(allowed));
      },
      error: e => this.error.set(this.msg(e)),
    });

    this.repo.listarSecrets('', 0, 300, true).subscribe({
      next: p => this.secrets.set((p.items ?? []).filter(s => s.activo !== false)),
      error: () => {},
    });

    this.repo.listarDestinations(this.q(), 0, 200, null)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: p => {
          this.items.set(p.items ?? []);
          const selected = this.findDestination(snapshot.id, snapshot.name);
          if (selected) this.seleccionarSinConfirmar(selected);
        },
        error: e => this.error.set(this.msg(e)),
      });
  }

  nuevo() {
    this.selected.set(null);
    this.technicalOpen.set(false);
    this.generatedJsonOpen.set(false);
    this.preservedConfig.set({});

    this.form.reset({
      nombre: '',
      tipoStorage: 'LOCAL',
      basePath: '/var/backups/klax',
      bucketName: '',
      prefixPath: '',
      folderId: '',
      idBkpSecretCredentialFk: null,
      retentionDays: 30,
      immutableEnabled: false,
      immutableDays: null,
      activo: true,
      remoteHost: '',
      remotePort: 22,
      remoteUsername: '',
      remotePath: '',
      identityFile: '',
      strictHostKey: false,
      knownHosts: '',
      sshBinary: 'ssh',
      scpBinary: 'scp',
      s3Region: 'us-east-1',
      s3EndpointOverride: '',
    });

    this.dirty.set(false);
    this.error.set('');
    this.success.set('');
  }

  seleccionar(i: BkpStorageDestination) {
    if (this.dirty() && !confirm('Tienes cambios pendientes. ¿Cambiar de destino sin guardar?')) return;
    this.seleccionarSinConfirmar(i);
  }

  private seleccionarSinConfirmar(i: BkpStorageDestination) {
    const cfg = i.configJson ?? {};
    const type = String(i.tipoStorage || 'LOCAL').toUpperCase();

    this.selected.set(i);
    this.technicalOpen.set(false);
    this.generatedJsonOpen.set(false);
    this.preservedConfig.set(this.extractUnknownConfig(type, cfg));

    this.form.reset({
      nombre: i.nombre ?? '',
      tipoStorage: type,
      basePath: i.basePath ?? (type === 'LOCAL' ? '/var/backups/klax' : ''),
      bucketName: i.bucketName ?? '',
      prefixPath: i.prefixPath ?? '',
      folderId: i.folderId ?? '',
      idBkpSecretCredentialFk: i.idBkpSecretCredentialFk ?? null,
      retentionDays: i.retentionDays ?? 30,
      immutableEnabled: !!i.immutableEnabled,
      immutableDays: i.immutableDays ?? null,
      activo: i.activo !== false,

      remoteHost: String(cfg['host'] ?? ''),
      remotePort: Number(cfg['port'] ?? 22),
      remoteUsername: String(cfg['username'] ?? ''),
      remotePath: String(cfg['remotePath'] ?? ''),
      identityFile: String(cfg['identityFile'] ?? ''),
      strictHostKey: !!cfg['strictHostKey'],
      knownHosts: String(cfg['knownHosts'] ?? ''),
      sshBinary: String(cfg['sshBinary'] ?? 'ssh'),
      scpBinary: String(cfg['scpBinary'] ?? 'scp'),

      s3Region: String(cfg['region'] ?? 'us-east-1'),
      s3EndpointOverride: String(cfg['endpointOverride'] ?? ''),
    });

    this.dirty.set(false);
    this.error.set('');
    this.success.set('');
  }

  guardar() {
    this.error.set('');
    this.success.set('');

    try {
      const payload = this.payload();
      const id = this.selected()?.idBkpStorageDestination;
      const state: DestinationReloadState = {
        id: id || null,
        name: payload.nombre,
      };

      this.saving.set(true);

      const op = id
        ? this.repo.editarDestination(id, payload as Record<string, unknown>)
        : this.repo.crearDestination(payload);

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
    const id = this.selected()?.idBkpStorageDestination;
    if (!id || !confirm('¿Desactivar este destino?')) return;

    this.saving.set(true);

    this.repo.eliminarDestination(id)
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

  private payload(): Partial<BkpStorageDestination> {
    const v = this.form.getRawValue();
    const type = String(v.tipoStorage || '').toUpperCase();

    if (!v.nombre?.trim()) throw new Error('Nombre es obligatorio.');
    if (!type) throw new Error('Tipo de destino es obligatorio.');
    if (!v.retentionDays || Number(v.retentionDays) < 1) throw new Error('Retención días debe ser mayor a 0.');

    const p: Partial<BkpStorageDestination> = {
      nombre: v.nombre.trim(),
      tipoStorage: type,
      prefixPath: toNullableString(v.prefixPath),
      retentionDays: Number(v.retentionDays),
      activo: !!v.activo,
      immutableEnabled: false,
      immutableDays: null,
      configJson: {},
    };

    if (type === 'LOCAL') {
      if (!v.basePath?.trim()) throw new Error('Ruta local es obligatoria para LOCAL.');
      p.basePath = v.basePath.trim();
      p.configJson = {};
    }

    if (type === 'GOOGLE_DRIVE') {
      if (!v.folderId?.trim()) throw new Error('Folder ID es obligatorio para Google Drive.');
      if (!v.idBkpSecretCredentialFk) throw new Error('Token Google es obligatorio.');
      p.folderId = v.folderId.trim();
      p.idBkpSecretCredentialFk = v.idBkpSecretCredentialFk;
      p.configJson = this.generatedConfigJson(type);
    }

    if (type === 'S3') {
      if (!v.bucketName?.trim()) throw new Error('Bucket es obligatorio para S3.');
      if (!v.s3Region?.trim()) throw new Error('Región es obligatoria para S3.');
      if (!v.idBkpSecretCredentialFk) throw new Error('Credencial es obligatoria para S3.');
      if (v.immutableEnabled && (!v.immutableDays || Number(v.immutableDays) < 1)) {
        throw new Error('Días inmutable debe ser mayor a 0 cuando Object Lock está activo.');
      }

      p.bucketName = v.bucketName.trim();
      p.idBkpSecretCredentialFk = v.idBkpSecretCredentialFk;
      p.immutableEnabled = !!v.immutableEnabled;
      p.immutableDays = toNumberOrNull(v.immutableDays);
      p.configJson = this.generatedConfigJson(type);
    }

    if (type === 'SFTP') {
      this.validateRemoteBase();

      if (!v.idBkpSecretCredentialFk && !v.identityFile?.trim()) {
        throw new Error('SFTP requiere secreto credencial o identity file.');
      }

      p.idBkpSecretCredentialFk = v.idBkpSecretCredentialFk;
      p.configJson = this.generatedConfigJson(type);
    }

    if (type === 'SSH' || type === 'SCP') {
      this.validateRemoteBase();

      if (!v.identityFile?.trim()) {
        throw new Error('SSH/SCP requiere identity file. Para password usa destino SFTP.');
      }

      p.idBkpSecretCredentialFk = null;
      p.configJson = this.generatedConfigJson(type);
    }

    return p;
  }

  private validateRemoteBase() {
    const v = this.form.getRawValue();

    if (!v.remoteHost?.trim()) throw new Error('Host remoto es obligatorio.');
    if (!v.remotePort || Number(v.remotePort) < 1) throw new Error('Puerto remoto es obligatorio.');
    if (!v.remoteUsername?.trim()) throw new Error('Usuario remoto es obligatorio.');
    if (!v.remotePath?.trim()) throw new Error('Ruta remota es obligatoria.');
  }

  generatedConfigJson(type = this.tipo()): Record<string, unknown> {
    const v = this.form.getRawValue();
    const t = String(type || '').toUpperCase();
    const base: Record<string, unknown> = { ...this.preservedConfig() };

    if (t === 'S3') {
      return this.cleanObject({
        ...base,
        region: v.s3Region || 'us-east-1',
        endpointOverride: toNullableString(v.s3EndpointOverride),
      });
    }

    if (t === 'SFTP') {
      return this.cleanObject({
        ...base,
        host: v.remoteHost,
        port: Number(v.remotePort || 22),
        username: v.remoteUsername,
        remotePath: v.remotePath,
        identityFile: toNullableString(v.identityFile),
        strictHostKey: !!v.strictHostKey,
        knownHosts: toNullableString(v.knownHosts),
      });
    }

    if (t === 'SSH' || t === 'SCP') {
      return this.cleanObject({
        ...base,
        host: v.remoteHost,
        port: Number(v.remotePort || 22),
        username: v.remoteUsername,
        remotePath: v.remotePath,
        identityFile: toNullableString(v.identityFile),
        sshBinary: v.sshBinary || 'ssh',
        scpBinary: v.scpBinary || 'scp',
      });
    }

    return {};
  }

  generatedConfigJsonText() {
    return jsonPretty(this.generatedConfigJson());
  }

  destinationParams(): ParamHelp[] {
    const t = this.tipo();

    if (t === 'LOCAL') {
      return [
        { key: 'basePath', label: 'Ruta local en servidor KLAX API', required: true, source: 'campo' },
        { key: 'prefixPath', label: 'Subcarpeta opcional', source: 'campo' },
      ];
    }

    if (t === 'GOOGLE_DRIVE') {
      return [
        { key: 'folderId', label: 'Folder ID de Google Drive', required: true, source: 'campo' },
        { key: 'idBkpSecretCredentialFk', label: 'Token OAuth guardado como secreto', required: true, source: 'campo' },
      ];
    }

    if (t === 'S3') {
      return [
        { key: 'bucketName', label: 'Bucket destino', required: true, source: 'campo' },
        { key: 'idBkpSecretCredentialFk', label: 'Credencial S3 guardada como secreto', required: true, source: 'campo' },
        { key: 'region', label: 'Región S3', required: true, source: 'configJson' },
        { key: 'endpointOverride', label: 'Endpoint compatible opcional', source: 'configJson' },
        { key: 'prefixPath', label: 'Prefijo/carpeta opcional', source: 'campo' },
      ];
    }

    if (t === 'SFTP') {
      return [
        { key: 'host', label: 'Host remoto', required: true, source: 'configJson' },
        { key: 'port', label: 'Puerto remoto', required: true, source: 'configJson' },
        { key: 'username', label: 'Usuario remoto', required: true, source: 'configJson' },
        { key: 'remotePath', label: 'Ruta remota', required: true, source: 'configJson' },
        { key: 'idBkpSecretCredentialFk', label: 'Password/passphrase en secreto', source: 'campo' },
        { key: 'identityFile', label: 'Llave privada opcional', source: 'configJson' },
        { key: 'strictHostKey', label: 'Validar known_hosts', source: 'configJson' },
        { key: 'knownHosts', label: 'Ruta known_hosts opcional', source: 'configJson' },
      ];
    }

    if (t === 'SSH' || t === 'SCP') {
      return [
        { key: 'host', label: 'Host remoto', required: true, source: 'configJson' },
        { key: 'port', label: 'Puerto remoto', required: true, source: 'configJson' },
        { key: 'username', label: 'Usuario remoto', required: true, source: 'configJson' },
        { key: 'remotePath', label: 'Ruta remota', required: true, source: 'configJson' },
        { key: 'identityFile', label: 'Llave privada usada por ssh/scp', required: true, source: 'configJson' },
        { key: 'sshBinary', label: 'Binario ssh opcional', source: 'configJson' },
        { key: 'scpBinary', label: 'Binario scp opcional', source: 'configJson' },
      ];
    }

    return [];
  }

  authHint() {
    const t = this.tipo();

    if (t === 'SFTP') {
      return 'SFTP puede autenticarse con password guardado en Secrets o con identity file. Si la llave tiene passphrase, guárdala como secreto.';
    }

    if (t === 'SSH' || t === 'SCP') {
      return 'SSH/SCP usa los binarios ssh/scp del servidor KLAX API. Con el backend actual requiere identity file; para password usa SFTP.';
    }

    if (t === 'S3') {
      return 'El secreto S3 debe contener accessKey/secretKey en JSON o formato accessKey:secretKey.';
    }

    if (t === 'GOOGLE_DRIVE') {
      return 'El secreto debe contener el token OAuth de Google Drive.';
    }

    return 'Ruta local del servidor donde corre KLAX API.';
  }

  destinationSummary(i: BkpStorageDestination) {
    const type = String(i.tipoStorage || '').toUpperCase();
    const cfg = i.configJson ?? {};

    if (type === 'LOCAL') return i.basePath || 'ruta local';
    if (type === 'GOOGLE_DRIVE') return i.folderId || 'folder Google Drive';
    if (type === 'S3') return `${i.bucketName || 'bucket'}${i.prefixPath ? '/' + i.prefixPath : ''}`;
    if (['SFTP', 'SSH', 'SCP'].includes(type)) {
      const host = String(cfg['host'] || 'host remoto');
      const path = String(cfg['remotePath'] || 'ruta remota');
      return `${host} · ${path}`;
    }

    return i.prefixPath || 'config remoto';
  }

  labelStorageType = labelStorageType;
  labelSecretType = labelSecretType;

  isLocal() {
    return this.tipo() === 'LOCAL';
  }

  isS3() {
    return this.tipo() === 'S3';
  }

  isDrive() {
    return this.tipo() === 'GOOGLE_DRIVE';
  }

  isSftp() {
    return this.tipo() === 'SFTP';
  }

  isSshLike() {
    return ['SSH', 'SCP'].includes(this.tipo());
  }

  isRemote() {
    return ['SFTP', 'SSH', 'SCP'].includes(this.tipo());
  }

  private applyDefaultsForType(type: string) {
    const t = String(type || '').toUpperCase();

    if (t === 'LOCAL' && !this.form.value.basePath) {
      this.form.patchValue({ basePath: '/var/backups/klax' }, { emitEvent: false });
    }

    if (t === 'S3') {
      this.form.patchValue({ s3Region: this.form.value.s3Region || 'us-east-1' }, { emitEvent: false });
    }

    if (['SFTP', 'SSH', 'SCP'].includes(t)) {
      this.form.patchValue({
        remotePort: this.form.value.remotePort || 22,
        sshBinary: this.form.value.sshBinary || 'ssh',
        scpBinary: this.form.value.scpBinary || 'scp',
      }, { emitEvent: false });
    }
  }

  private normalizeStorageTypes(values: string[]) {
    const allowed = ['LOCAL', 'GOOGLE_DRIVE', 'S3', 'SFTP', 'SSH', 'SCP'];
    const normalized = values
      .map(v => String(v || '').toUpperCase())
      .filter(v => allowed.includes(v));

    return Array.from(new Set(normalized.length ? normalized : allowed));
  }

  private findDestination(id?: number | null, name?: string | null) {
    if (id) {
      const byId = this.items().find(x => x.idBkpStorageDestination === id);
      if (byId) return byId;
    }

    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;

    return this.items().find(x => String(x.nombre || '').trim().toUpperCase() === normalized) ?? null;
  }

  private cleanObject(obj: Record<string, unknown>) {
    const result: Record<string, unknown> = {};

    Object.entries(obj).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      result[key] = value;
    });

    return result;
  }

  private extractUnknownConfig(type: string, cfg: Record<string, unknown>) {
    const knownByType: Record<string, string[]> = {
      LOCAL: [],
      GOOGLE_DRIVE: [],
      S3: ['region', 'endpointOverride'],
      SFTP: ['host', 'port', 'username', 'remotePath', 'identityFile', 'strictHostKey', 'knownHosts'],
      SSH: ['host', 'port', 'username', 'remotePath', 'identityFile', 'sshBinary', 'scpBinary'],
      SCP: ['host', 'port', 'username', 'remotePath', 'identityFile', 'sshBinary', 'scpBinary'],
    };

    const known = new Set(knownByType[String(type || '').toUpperCase()] ?? []);
    const unknown: Record<string, unknown> = {};

    Object.entries(cfg || {}).forEach(([key, value]) => {
      if (!known.has(key)) unknown[key] = value;
    });

    return unknown;
  }

  private msg(e: unknown) {
    return e instanceof Error ? e.message : String((e as any)?.message || e || 'Error');
  }
}
