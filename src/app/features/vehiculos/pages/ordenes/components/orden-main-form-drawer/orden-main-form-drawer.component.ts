import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { VehiculosFormDrawerComponent } from '../../../../components/form-drawer/form-drawer.component';
import { VehiculosRepository } from '../../../../data-access/vehiculos.repository';
import {
  CliVehiculo,
  SegUsuarioListadoItem,
  VehCliente,
  VehOrdenTrabajo,
  VehOrdenTrabajoGuardarRequest,
} from '../../../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';

type DrawerTab = 'clienteVehiculo' | 'recepcion' | 'diagnostico' | 'responsables' | 'observaciones';
type UsuarioPickerTarget = 'recepcion' | 'tecnico' | null;

type AtributoRowForm = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

@Component({
  selector: 'app-orden-main-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    VehiculosFormDrawerComponent,
  ],
  templateUrl: './orden-main-form-drawer.component.html',
  styleUrl: './orden-main-form-drawer.component.scss',
})
export class OrdenMainFormDrawerComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);

  @Input() visible = false;
  @Input() saving = false;
  @Input() orden: VehOrdenTrabajo | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() requestClose = new EventEmitter<void>();
  @Output() dirtyChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<VehOrdenTrabajoGuardarRequest>();

  readonly TIPO_SERVICIO_OPTIONS = [
    'REPARACION',
    'MANTENIMIENTO',
    'DIAGNOSTICO',
    'GARANTIA',
    'REVISION',
    'INSPECCION',
    'OTRO',
  ];

  readonly ESTADO_ORDEN_OPTIONS = [
    'RECIBIDO',
    'DIAGNOSTICO',
    'EN_PROCESO',
    'EN_ESPERA',
    'PENDIENTE_APROBACION',
    'LISTO',
    'FACTURADO',
    'ENTREGADO',
    'ANULADO',
  ];

  activeTab = signal<DrawerTab>('clienteVehiculo');
  dirty = signal(false);

  clientePickerVisible = signal(false);
  clientesBuscar = signal('');
  clientesResultados = signal<VehCliente[]>([]);
  clienteBuscando = signal(false);
  clienteSeleccionado = signal<VehCliente | null>(null);

  vehiculosCliente = signal<CliVehiculo[]>([]);
  vehiculoSeleccionado = signal<CliVehiculo | null>(null);

  usuarioPickerVisible = signal(false);
  usuarioPickerTarget = signal<UsuarioPickerTarget>(null);
  usuariosBuscar = signal('');
  usuariosResultados = signal<SegUsuarioListadoItem[]>([]);
  usuarioBuscando = signal(false);
  responsableRecepcionSeleccionado = signal<SegUsuarioListadoItem | null>(null);
  responsableTecnicoSeleccionado = signal<SegUsuarioListadoItem | null>(null);

  private initialSnapshot = '';

  form = this.fb.group({
    dni: [null as number | null, Validators.required],
    idCliVehiculoFk: [null as number | null, Validators.required],
    tipoServicio: ['REPARACION', Validators.required],
    estadoOrden: ['RECIBIDO', Validators.required],
    fechaIngreso: [''],
    fechaPrometida: [''],
    kilometrajeIngreso: [null as number | null],
    nivelCombustible: [''],
    nivelBateria: [''],
    fallaReportada: [''],
    sintomasReportados: [''],
    ruidosReportados: [''],
    detalleCliente: [''],
    accesoriosEntregados: [''],
    condicionIngreso: [''],
    diagnosticoGeneral: [''],
    recomendacionGeneral: [''],
    responsableRecepcion: [null as number | null],
    responsableTecnico: [null as number | null],
    observaciones: [''],
  });

  readonly atributosFormArray = this.fb.array<AtributoRowForm>([
    this.createAtributoRow('', ''),
  ]);

  constructor() {
    this.ensureAtLeastOneAtributoRow(this.atributosRows);
    this.form.valueChanges.subscribe(() => this.updateDirtyState());
    this.atributosRows.valueChanges.subscribe(() => this.updateDirtyState());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.activeTab.set('clienteVehiculo');
      this.hydrateFromInput();
    }
  }

  get atributosRows(): FormArray<AtributoRowForm> {
    return this.atributosFormArray;
  }

  setTab(tab: DrawerTab) {
    this.activeTab.set(tab);
  }

  title(): string {
    return this.orden ? 'Editar orden de trabajo' : 'Nueva orden de trabajo';
  }

  subtitle(): string {
    return 'La cabecera de la OT se divide por tabs para que el usuario no pierda contexto ni tenga que recorrer un formulario interminable.';
  }

  onVisibleChange(next: boolean) {
    this.visibleChange.emit(next);
  }

  onRequestClose() {
    this.requestClose.emit();
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Cliente, vehículo, tipo de servicio y estado son obligatorios.');
      this.activeTab.set('clienteVehiculo');
      return;
    }

    const raw = this.form.getRawValue();
    const payload: VehOrdenTrabajoGuardarRequest = {
      dni: Number(raw.dni),
      idCliVehiculoFk: Number(raw.idCliVehiculoFk),
      tipoServicio: raw.tipoServicio || null,
      estadoOrden: raw.estadoOrden || null,
      fechaIngreso: this.toTimestamp(raw.fechaIngreso),
      fechaPrometida: this.toTimestamp(raw.fechaPrometida),
      kilometrajeIngreso: raw.kilometrajeIngreso ?? null,
      nivelCombustible: raw.nivelCombustible?.trim() || null,
      nivelBateria: raw.nivelBateria?.trim() || null,
      fallaReportada: raw.fallaReportada?.trim() || null,
      sintomasReportados: raw.sintomasReportados?.trim() || null,
      ruidosReportados: raw.ruidosReportados?.trim() || null,
      detalleCliente: raw.detalleCliente?.trim() || null,
      accesoriosEntregados: raw.accesoriosEntregados?.trim() || null,
      condicionIngreso: raw.condicionIngreso?.trim() || null,
      diagnosticoGeneral: raw.diagnosticoGeneral?.trim() || null,
      recomendacionGeneral: raw.recomendacionGeneral?.trim() || null,
      responsableRecepcion: raw.responsableRecepcion ?? null,
      responsableTecnico: raw.responsableTecnico ?? null,
      observaciones: raw.observaciones?.trim() || null,
      atributos: this.buildAtributosObject(this.atributosRows),
    };

    this.save.emit(payload);
  }

  buscarClientes() {
    const q = this.clientesBuscar().trim();
    if (!q) {
      this.clientesResultados.set([]);
      return;
    }

    this.clienteBuscando.set(true);
    this.repo.listarClientes(q, 0, 20, false)
      .pipe(finalize(() => this.clienteBuscando.set(false)))
      .subscribe({
        next: (res) => this.clientesResultados.set(res.items ?? []),
        error: (err) => this.notify.error('No se pudo buscar clientes', err?.message),
      });
  }

  abrirClientePicker() {
    this.clientePickerVisible.set(true);
    this.clientesResultados.set([]);
  }

  seleccionarCliente(cliente: VehCliente) {
    const dni = Number(cliente.dni ?? cliente.ruc);
    this.clienteSeleccionado.set(cliente);
    this.form.controls.dni.setValue(dni);
    this.form.controls.idCliVehiculoFk.setValue(null);
    this.vehiculoSeleccionado.set(null);
    this.vehiculosCliente.set([]);
    this.clientePickerVisible.set(false);
    this.buscarVehiculosCliente(dni);
    this.updateDirtyState();
  }

  buscarVehiculosCliente(dni?: number | null, selectedVehicleId?: number | null) {
    const clienteDni = Number(dni ?? this.form.controls.dni.value ?? 0);
    if (!clienteDni) {
      this.vehiculosCliente.set([]);
      this.vehiculoSeleccionado.set(null);
      return;
    }

    this.repo.listarClientesVehiculo({ dni: clienteDni }).subscribe({
      next: (res) => {
        const items = res.items ?? [];
        this.vehiculosCliente.set(items);
        if (selectedVehicleId) {
          const vehiculo = items.find((x) => x.idCliVehiculo === selectedVehicleId) ?? null;
          this.vehiculoSeleccionado.set(vehiculo);
          this.form.controls.idCliVehiculoFk.setValue(selectedVehicleId);
        }
      },
      error: (err) => this.notify.error('No se pudieron cargar los vehículos del cliente', err?.message),
    });
  }

  onVehiculoSeleccionado(idCliVehiculo: number | null) {
    const vehiculo = this.vehiculosCliente().find((x) => x.idCliVehiculo === Number(idCliVehiculo)) ?? null;
    this.vehiculoSeleccionado.set(vehiculo);
    this.form.controls.idCliVehiculoFk.setValue(idCliVehiculo);
    this.updateDirtyState();
  }

  abrirUsuarioPicker(target: UsuarioPickerTarget) {
    this.usuarioPickerTarget.set(target);
    this.usuarioPickerVisible.set(true);
    this.usuariosBuscar.set('');
    this.usuariosResultados.set([]);
  }

  buscarUsuarios() {
    const q = this.usuariosBuscar().trim();
    this.usuarioBuscando.set(true);

    this.repo.listarUsuarios(q, 0, 20, false)
      .pipe(finalize(() => this.usuarioBuscando.set(false)))
      .subscribe({
        next: (res: any) => this.usuariosResultados.set(res.items ?? []),
        error: (err) => this.notify.error('No se pudieron cargar usuarios', err?.message),
      });
  }

  seleccionarUsuario(user: SegUsuarioListadoItem) {
    const target = this.usuarioPickerTarget();

    if (target === 'recepcion') {
      this.form.controls.responsableRecepcion.setValue(user.idSegUsuario);
      this.responsableRecepcionSeleccionado.set(user);
    }

    if (target === 'tecnico') {
      this.form.controls.responsableTecnico.setValue(user.idSegUsuario);
      this.responsableTecnicoSeleccionado.set(user);
    }

    this.usuarioPickerVisible.set(false);
    this.usuarioPickerTarget.set(null);
    this.updateDirtyState();
  }

  limpiarResponsable(target: UsuarioPickerTarget) {
    if (target === 'recepcion') {
      this.form.controls.responsableRecepcion.setValue(null);
      this.responsableRecepcionSeleccionado.set(null);
    }

    if (target === 'tecnico') {
      this.form.controls.responsableTecnico.setValue(null);
      this.responsableTecnicoSeleccionado.set(null);
    }

    this.updateDirtyState();
  }

  addAtributoRow() {
    this.atributosRows.push(this.createAtributoRow('', ''));
    this.updateDirtyState();
  }

  removeAtributoRow(index: number) {
    if (this.atributosRows.length === 1) {
      this.atributosRows.at(0).patchValue({ key: '', value: '' });
      this.updateDirtyState();
      return;
    }
    this.atributosRows.removeAt(index);
    this.updateDirtyState();
  }

  clienteLabel(): string {
    const cli = this.clienteSeleccionado();
    if (!cli) return 'No hay cliente seleccionado';
    return [cli.nombre || cli.ruc, cli.ruc].filter(Boolean).join(' · ');
  }

  vehiculoLabel(): string {
    const veh = this.vehiculoSeleccionado();
    if (!veh) return 'No hay vehículo seleccionado';
    return [veh.marca, veh.modelo, veh.placa].filter(Boolean).join(' · ');
  }

  hydrateFromInput() {
    if (!this.orden) {
      this.resetForCreate();
      return;
    }

    const item = this.orden;
    this.form.reset({
      dni: item.dni,
      idCliVehiculoFk: item.idCliVehiculoFk,
      tipoServicio: item.tipoServicio || 'REPARACION',
      estadoOrden: item.estadoOrden || 'RECIBIDO',
      fechaIngreso: this.toDate(item.fechaIngreso),
      fechaPrometida: this.toDate(item.fechaPrometida),
      kilometrajeIngreso: item.kilometrajeIngreso ?? null,
      nivelCombustible: item.nivelCombustible || '',
      nivelBateria: item.nivelBateria || '',
      fallaReportada: item.fallaReportada || '',
      sintomasReportados: item.sintomasReportados || '',
      ruidosReportados: item.ruidosReportados || '',
      detalleCliente: item.detalleCliente || '',
      accesoriosEntregados: item.accesoriosEntregados || '',
      condicionIngreso: item.condicionIngreso || '',
      diagnosticoGeneral: item.diagnosticoGeneral || '',
      recomendacionGeneral: item.recomendacionGeneral || '',
      responsableRecepcion: item.responsableRecepcion ?? null,
      responsableTecnico: item.responsableTecnico ?? null,
      observaciones: item.observaciones || '',
    });

    this.populateAtributosFormArray(this.atributosRows, item.atributos ?? {});

    this.repo.listarClientes(String(item.dni ?? ''), 0, 20, false).subscribe({
      next: (res) => {
        const cli = (res.items ?? []).find((x) => Number(x.dni ?? x.ruc) === Number(item.dni)) ?? null;
        this.clienteSeleccionado.set(cli);
      },
      error: () => this.clienteSeleccionado.set(null),
    });

    this.buscarVehiculosCliente(item.dni ?? null, item.idCliVehiculoFk ?? null);
    this.cargarUsuarioSeleccionado(item.responsableRecepcion ?? null, 'recepcion');
    this.cargarUsuarioSeleccionado(item.responsableTecnico ?? null, 'tecnico');
    this.refreshSnapshot();
  }

  private resetForCreate() {
    this.clienteSeleccionado.set(null);
    this.vehiculoSeleccionado.set(null);
    this.vehiculosCliente.set([]);
    this.responsableRecepcionSeleccionado.set(null);
    this.responsableTecnicoSeleccionado.set(null);

    this.form.reset({
      dni: null,
      idCliVehiculoFk: null,
      tipoServicio: 'REPARACION',
      estadoOrden: 'RECIBIDO',
      fechaIngreso: '',
      fechaPrometida: '',
      kilometrajeIngreso: null,
      nivelCombustible: '',
      nivelBateria: '',
      fallaReportada: '',
      sintomasReportados: '',
      ruidosReportados: '',
      detalleCliente: '',
      accesoriosEntregados: '',
      condicionIngreso: '',
      diagnosticoGeneral: '',
      recomendacionGeneral: '',
      responsableRecepcion: null,
      responsableTecnico: null,
      observaciones: '',
    });

    this.populateAtributosFormArray(this.atributosRows, {});
    this.refreshSnapshot();
  }

  private cargarUsuarioSeleccionado(idSegUsuario: number | null | undefined, target: UsuarioPickerTarget) {
    if (!idSegUsuario) {
      if (target === 'recepcion') this.responsableRecepcionSeleccionado.set(null);
      if (target === 'tecnico') this.responsableTecnicoSeleccionado.set(null);
      return;
    }

    this.repo.listarUsuarios(String(idSegUsuario), 0, 20, false).subscribe({
      next: (res: any) => {
        const user = (res.items ?? []).find((x: SegUsuarioListadoItem) => x.idSegUsuario === idSegUsuario) ?? null;
        if (target === 'recepcion') this.responsableRecepcionSeleccionado.set(user);
        if (target === 'tecnico') this.responsableTecnicoSeleccionado.set(user);
      },
    });
  }

  private createAtributoRow(key = '', value = ''): AtributoRowForm {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true }),
    });
  }

  private ensureAtLeastOneAtributoRow(formArray: FormArray<AtributoRowForm>) {
    if (formArray.length === 0) {
      formArray.push(this.createAtributoRow('', ''));
    }
  }

  private populateAtributosFormArray(formArray: FormArray<AtributoRowForm>, data?: Record<string, unknown> | null) {
    formArray.clear();
    const entries = Object.entries(data ?? {});
    if (entries.length === 0) {
      formArray.push(this.createAtributoRow('', ''));
      return;
    }
    for (const [key, value] of entries) {
      formArray.push(this.createAtributoRow(key, this.stringifyAtributoValue(value)));
    }
  }

  private buildAtributosObject(formArray: FormArray<AtributoRowForm>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const row of formArray.controls) {
      const key = String(row.controls.key.value || '').trim();
      const rawValue = String(row.controls.value.value || '').trim();
      if (!key) continue;
      result[key] = this.parseAtributoValue(rawValue);
    }
    return result;
  }

  private parseAtributoValue(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (!Number.isNaN(Number(trimmed))) return Number(trimmed);

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  private stringifyAtributoValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private toDate(value?: string | null) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  private toTimestamp(value?: string | null) {
    if (!value) return null;
    if (value.includes('T')) return value;
    return `${value}T00:00:00-05:00`;
  }

  private createSnapshot(): string {
    return JSON.stringify({
      ...this.form.getRawValue(),
      cliente: this.clienteSeleccionado()?.nombre ?? this.clienteSeleccionado()?.ruc ?? null,
      vehiculo: this.vehiculoSeleccionado()?.placa ?? this.vehiculoSeleccionado()?.modelo ?? null,
      responsableRecepcionNombre: this.responsableRecepcionSeleccionado()?.usuario ?? null,
      responsableTecnicoNombre: this.responsableTecnicoSeleccionado()?.usuario ?? null,
      atributos: this.buildAtributosObject(this.atributosRows),
    });
  }

  private refreshSnapshot() {
    this.initialSnapshot = this.createSnapshot();
    this.dirty.set(false);
    this.dirtyChange.emit(false);
  }

  private updateDirtyState() {
    const next = this.createSnapshot() !== this.initialSnapshot;
    this.dirty.set(next);
    this.dirtyChange.emit(next);
  }
}
