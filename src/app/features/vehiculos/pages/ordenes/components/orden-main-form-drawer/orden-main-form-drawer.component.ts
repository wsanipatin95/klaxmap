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
  CliVehiculoGuardarRequest,
  SegUsuarioListadoItem,
  VehCliente,
  VehClienteGuardarRequest,
  VehOrdenTrabajo,
  VehOrdenTrabajoGuardarRequest,
  VehTipoVehiculo,
} from '../../../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';

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
  @Output() saveAndClose = new EventEmitter<VehOrdenTrabajoGuardarRequest>();

  readonly TIPO_SERVICIO_OPTIONS = [
    'REPARACION',
    'MANTENIMIENTO',
    'DIAGNOSTICO',
    'GARANTIA',
    'REVISION',
    'INSPECCION',
    'OTRO',
  ];

  dirty = signal(false);
  submittedAttempt = signal(false);

  clientePickerVisible = signal(false);
  clientesBuscar = signal('');
  clientesResultados = signal<VehCliente[]>([]);
  clienteBuscando = signal(false);
  clienteSeleccionado = signal<VehCliente | null>(null);

  clienteCreateVisible = signal(false);
  clienteCreateSaving = signal(false);

  vehiculoCreateVisible = signal(false);
  vehiculoCreateSaving = signal(false);
  tiposVehiculo = signal<VehTipoVehiculo[]>([]);
  tiposVehiculoCargando = signal(false);

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
    estadoOrden: [{ value: 'RECIBIDO', disabled: true }, Validators.required],
    fechaIngreso: ['', Validators.required],
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

  clienteCreateForm = this.fb.group({
    ruc: ['', Validators.required],
    nombre: ['', Validators.required],
    direccion: [''],
    email: [''],
    movil: [''],
    telefono: [''],
    observacion: [''],
  });

  vehiculoCreateForm = this.fb.group({
    idVehTipoVehiculoFk: [null as number | null, Validators.required],
    placa: ['', Validators.required],
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    anio: [null as number | null],
    color: [''],
    numeroChasis: [''],
    numeroMotor: [''],
    cilindraje: [''],
    combustible: [''],
    transmision: [''],
    kilometraje: [null as number | null],
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
    if ((changes['visible'] && this.visible) || (changes['orden'] && this.visible)) {
      this.hydrateFromInput();
    }
  }

  get atributosRows(): FormArray<AtributoRowForm> {
    return this.atributosFormArray;
  }

  isEditing(): boolean {
    return !!this.orden?.idVehOrdenTrabajo;
  }

  isSelectionLocked(): boolean {
    return this.isEditing();
  }

  canCreateVehiculo(): boolean {
    return !this.isSelectionLocked() && !!this.form.controls.dni.value;
  }

  title(): string {
    return this.orden?.idVehOrdenTrabajo
      ? `Editar orden #${this.orden.idVehOrdenTrabajo}`
      : 'Nueva orden';
  }

  subtitle(): string {
    return this.isEditing()
      ? 'Actualiza los datos principales de la orden.'
      : 'Completa los datos básicos para registrar la orden.';
  }

  onVisibleChange(next: boolean) {
    if (next) {
      this.visibleChange.emit(true);
      return;
    }

    this.requestClose.emit();
  }

  onRequestClose() {
    this.requestClose.emit();
  }

  isControlInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || this.submittedAttempt());
  }

  showClienteError(): boolean {
    return this.isControlInvalid('dni');
  }

  showVehiculoError(): boolean {
    return this.isControlInvalid('idCliVehiculoFk');
  }

  clienteLabel(): string {
    const cli = this.clienteSeleccionado();
    if (cli) {
      return [cli.nombre || cli.ruc || `Cliente #${cli.idTaxDni ?? cli.dni ?? ''}`, cli.ruc]
        .filter(Boolean)
        .join(' · ');
    }

    const dni = this.form.controls.dni.value;
    return dni ? `Cliente #${dni}` : 'Elegir cliente';
  }

  vehiculoLabel(): string {
    const veh = this.vehiculoSeleccionado();
    if (veh) {
      return [veh.marca, veh.modelo, veh.placa].filter(Boolean).join(' · ');
    }

    const idCliVehiculo = this.form.controls.idCliVehiculoFk.value;
    return idCliVehiculo ? `Vehículo #${idCliVehiculo}` : 'Elegir vehículo';
  }

  submit(closeAfterSave = false) {
    this.submittedAttempt.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Cliente, vehículo, servicio y fecha de ingreso son obligatorios.');
      return;
    }

    const payload = this.buildPayload();

    if (closeAfterSave) {
      this.saveAndClose.emit(payload);
      return;
    }

    this.save.emit(payload);
  }

  private buildPayload(): VehOrdenTrabajoGuardarRequest {
    const raw = this.form.getRawValue();

    return {
      dni: Number(raw.dni),
      idCliVehiculoFk: Number(raw.idCliVehiculoFk),
      tipoServicio: raw.tipoServicio || 'REPARACION',
      estadoOrden: this.orden?.estadoOrden || raw.estadoOrden || 'RECIBIDO',
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
  }

  abrirClientePicker() {
    if (this.isSelectionLocked()) return;
    this.clientePickerVisible.set(true);
    this.clientesResultados.set([]);
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

  seleccionarCliente(cliente: VehCliente) {
    if (this.isSelectionLocked()) return;

    const dni = Number(cliente.dni ?? cliente.idTaxDni ?? cliente.ruc ?? 0);
    this.clienteSeleccionado.set(cliente);
    this.form.controls.dni.setValue(dni || null);
    this.form.controls.idCliVehiculoFk.setValue(null);
    this.vehiculoSeleccionado.set(null);
    this.vehiculosCliente.set([]);
    this.clientePickerVisible.set(false);
    this.buscarVehiculosCliente(dni || null);
    this.updateDirtyState();
  }

  abrirCrearCliente() {
    if (this.isSelectionLocked()) return;

    this.clienteCreateForm.reset({
      ruc: this.clientesBuscar() || '',
      nombre: '',
      direccion: '',
      email: '',
      movil: '',
      telefono: '',
      observacion: '',
    });

    this.clienteCreateVisible.set(true);
  }

  crearClienteInline() {
    if (this.clienteCreateForm.invalid) {
      this.clienteCreateForm.markAllAsTouched();
      return;
    }

    const raw = this.clienteCreateForm.getRawValue();
    const payload: VehClienteGuardarRequest = {
      ruc: raw.ruc?.trim() || '',
      nombre: raw.nombre?.trim() || '',
      direccion: raw.direccion?.trim() || null,
      email: raw.email?.trim() || null,
      movil: raw.movil?.trim() || null,
      telefono: raw.telefono?.trim() || null,
      observacion: raw.observacion?.trim() || null,
    };

    this.clienteCreateSaving.set(true);
    this.repo.crearCliente(payload)
      .pipe(finalize(() => this.clienteCreateSaving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Cliente creado', 'El cliente fue creado correctamente.');
          this.clienteCreateVisible.set(false);

          this.repo.listarClientes(payload.ruc, 0, 20, false).subscribe({
            next: (res) => {
              const cli = (res.items ?? []).find((x) => String(x.ruc || '').trim() === payload.ruc) ?? null;
              if (cli) {
                this.seleccionarCliente(cli);
              }
            },
          });
        },
        error: (err) => this.notify.error('No se pudo crear el cliente', err?.message),
      });
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

        if (selectedVehicleId != null) {
          const vehiculo = items.find((x) => x.idCliVehiculo === Number(selectedVehicleId)) ?? null;
          this.vehiculoSeleccionado.set(vehiculo);
          this.form.controls.idCliVehiculoFk.setValue(selectedVehicleId);
          return;
        }

        if (items.length === 1) {
          this.vehiculoSeleccionado.set(items[0]);
          this.form.controls.idCliVehiculoFk.setValue(items[0].idCliVehiculo);
          return;
        }

        const currentValue = this.form.controls.idCliVehiculoFk.value;
        if (currentValue) {
          const vehiculo = items.find((x) => x.idCliVehiculo === Number(currentValue)) ?? null;
          this.vehiculoSeleccionado.set(vehiculo);
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

  abrirCrearVehiculo() {
    if (!this.canCreateVehiculo()) {
      this.notify.warn('Selecciona un cliente', 'Primero debes elegir o crear un cliente.');
      return;
    }

    this.vehiculoCreateForm.reset({
      idVehTipoVehiculoFk: null,
      placa: '',
      marca: '',
      modelo: '',
      anio: null,
      color: '',
      numeroChasis: '',
      numeroMotor: '',
      cilindraje: '',
      combustible: '',
      transmision: '',
      kilometraje: null,
      observaciones: '',
    });

    this.vehiculoCreateVisible.set(true);
    this.cargarTiposVehiculo();
  }

  cargarTiposVehiculo() {
    if (this.tiposVehiculo().length) return;

    this.tiposVehiculoCargando.set(true);
    this.repo.listarTipos('', 0, 100, true)
      .pipe(finalize(() => this.tiposVehiculoCargando.set(false)))
      .subscribe({
        next: (res) => this.tiposVehiculo.set(res.items ?? []),
        error: (err) => this.notify.error('No se pudieron cargar tipos de vehículo', err?.message),
      });
  }

  crearVehiculoInline() {
    if (this.vehiculoCreateForm.invalid || !this.form.controls.dni.value) {
      this.vehiculoCreateForm.markAllAsTouched();
      return;
    }

    const raw = this.vehiculoCreateForm.getRawValue();
    const payload: CliVehiculoGuardarRequest = {
      dni: Number(this.form.controls.dni.value),
      idVehTipoVehiculoFk: Number(raw.idVehTipoVehiculoFk),
      placa: raw.placa?.trim() || null,
      marca: raw.marca?.trim() || '',
      modelo: raw.modelo?.trim() || '',
      anio: raw.anio ?? null,
      color: raw.color?.trim() || null,
      numeroChasis: raw.numeroChasis?.trim() || null,
      numeroMotor: raw.numeroMotor?.trim() || null,
      cilindraje: raw.cilindraje?.trim() || null,
      combustible: raw.combustible?.trim() || null,
      transmision: raw.transmision?.trim() || null,
      kilometraje: raw.kilometraje ?? null,
      observaciones: raw.observaciones?.trim() || null,
    };

    this.vehiculoCreateSaving.set(true);
    this.repo.crearClienteVehiculo(payload)
      .pipe(finalize(() => this.vehiculoCreateSaving.set(false)))
      .subscribe({
        next: (res: any) => {
          const nuevoId = Number(res?.data?.idCliVehiculo ?? 0) || null;

          this.notify.success('Vehículo creado', 'El vehículo fue creado correctamente.');
          this.vehiculoCreateVisible.set(false);
          this.buscarVehiculosCliente(Number(this.form.controls.dni.value), nuevoId);
        },
        error: (err) => this.notify.error('No se pudo crear el vehículo', err?.message),
      });
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
      fechaIngreso: this.toDate(item.fechaIngreso) || this.todayDateInput(),
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

    this.form.controls.estadoOrden.disable({ emitEvent: false });
    this.syncVehiculoControlState();

    this.populateAtributosFormArray(this.atributosRows, item.atributos ?? {});
    this.hydrateClienteSeleccionado(item.dni ?? null);
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

    this.clientePickerVisible.set(false);
    this.usuarioPickerVisible.set(false);
    this.clienteCreateVisible.set(false);
    this.vehiculoCreateVisible.set(false);
    this.clientesBuscar.set('');
    this.usuariosBuscar.set('');
    this.clientesResultados.set([]);
    this.usuariosResultados.set([]);

    this.form.reset({
      dni: null,
      idCliVehiculoFk: null,
      tipoServicio: 'REPARACION',
      estadoOrden: 'RECIBIDO',
      fechaIngreso: this.todayDateInput(),
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

    this.form.controls.estadoOrden.disable({ emitEvent: false });
    this.syncVehiculoControlState();

    this.populateAtributosFormArray(this.atributosRows, {});
    this.refreshSnapshot();
  }

  private syncVehiculoControlState() {
    const vehiculoControl = this.form.controls.idCliVehiculoFk;

    if (this.isSelectionLocked()) {
      vehiculoControl.disable({ emitEvent: false });
      return;
    }

    vehiculoControl.enable({ emitEvent: false });
  }

  private hydrateClienteSeleccionado(dni: number | null | undefined) {
    const targetDni = Number(dni ?? 0);
    if (!targetDni) {
      this.clienteSeleccionado.set(null);
      return;
    }

    this.repo.listarClientes('', 0, 100, false).subscribe({
      next: (res) => {
        const cli = this.findClienteByOrdenDni(res.items ?? [], targetDni);
        this.clienteSeleccionado.set(cli);
      },
      error: () => this.clienteSeleccionado.set(null),
    });
  }

  private findClienteByOrdenDni(items: VehCliente[], targetDni: number): VehCliente | null {
    return items.find((item) => Number(item.dni ?? item.idTaxDni ?? item.ruc ?? 0) === targetDni) ?? null;
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
      error: () => {
        if (target === 'recepcion') this.responsableRecepcionSeleccionado.set(null);
        if (target === 'tecnico') this.responsableTecnicoSeleccionado.set(null);
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

  private todayDateInput(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private createSnapshot(): string {
    return JSON.stringify({
      form: this.form.getRawValue(),
      atributos: this.buildAtributosObject(this.atributosRows),
    });
  }

  private refreshSnapshot() {
    this.initialSnapshot = this.createSnapshot();
    this.submittedAttempt.set(false);
    this.dirty.set(false);
    this.dirtyChange.emit(false);
  }

  private updateDirtyState() {
    const next = this.createSnapshot() !== this.initialSnapshot;
    this.dirty.set(next);
    this.dirtyChange.emit(next);
  }
}
