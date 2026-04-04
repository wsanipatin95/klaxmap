import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  CliVehiculo,
  CliVehiculoGuardarRequest,
  VehCliente,
  VehClienteGuardarRequest,
  VehTipoVehiculo,
} from '../../data-access/vehiculos.models';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type ClientesTab = 'edicion' | 'vehiculos';
type ConfirmSeverity = 'danger' | 'warning' | 'info';
type ClienteLookupState = 'idle' | 'searching' | 'found' | 'not_found';

@Component({
  selector: 'app-vehiculos-clientes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    DialogModule,
    ButtonModule,
    TextareaModule,
    VehiculosPageHeaderComponent,
  ],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss',
})
export class VehiculosClientesComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private router = inject(Router);

  readonly IDENTIFICACION_OPTIONS = [
    { value: '04', label: 'RUC' },
    { value: '05', label: 'Cédula' },
    { value: '06', label: 'Pasaporte' },
  ];

  readonly q = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly clientes = signal<VehCliente[]>([]);
  readonly vehiculos = signal<CliVehiculo[]>([]);
  readonly tiposVehiculo = signal<VehTipoVehiculo[]>([]);

  readonly selectedCliente = signal<VehCliente | null>(null);
  readonly selectedVehiculo = signal<CliVehiculo | null>(null);

  readonly mode = signal<'crear' | 'editar'>('crear');
  readonly vehiculoMode = signal<'crear' | 'editar'>('crear');
  readonly activeTab = signal<ClientesTab>('edicion');

  readonly dirty = signal(false);
  readonly vehiculoDirty = signal(false);
  readonly hasPendingChanges = computed(() => this.dirty() || this.vehiculoDirty());

  readonly clienteLookupState = signal<ClienteLookupState>('idle');
  readonly clienteEncontrado = signal<VehCliente | null>(null);

  readonly currentTitle = computed(() =>
    this.mode() === 'crear' ? 'Nuevo cliente' : 'Editar cliente'
  );

  readonly currentSubtitle = computed(() => {
    if (this.mode() === 'crear') {
      return 'Valida la identificación y crea el cliente.';
    }
    const current = this.selectedCliente();
    return current
      ? current.nombre || current.ruc || 'Cliente seleccionado'
      : 'Cliente seleccionado';
  });

  readonly vehiculoTitle = computed(() =>
    this.vehiculoMode() === 'crear' ? 'Nuevo vehículo' : 'Editar vehículo'
  );

  readonly vehiculoSubtitle = computed(() => {
    const current = this.selectedCliente();
    if (!current) return 'Selecciona un cliente.';
    return `Vehículos de ${current.nombre || current.ruc}`;
  });

  readonly clientesCount = computed(() => this.clientes().length);
  readonly vehiculosCount = computed(() => this.vehiculos().length);

  readonly clienteSearchResolved = computed(() =>
    this.clienteLookupState() === 'found' || this.clienteLookupState() === 'not_found'
  );

  readonly disableClienteActionsInCreate = computed(() =>
    this.mode() === 'crear' && !this.clienteSearchResolved()
  );

  private initialClienteSnapshot = '';
  private initialVehiculoSnapshot = '';

  readonly confirmVisible = signal(false);
  readonly confirmTitle = signal('Confirmar');
  readonly confirmMessage = signal('');
  readonly confirmConfirmLabel = signal('Confirmar');
  readonly confirmCancelLabel = signal('Cancelar');
  readonly confirmAlternateLabel = signal<string | null>(null);
  readonly confirmSeverity = signal<ConfirmSeverity>('warning');

  private confirmAcceptCallback: (() => void) | null = null;
  private confirmCancelCallback: (() => void) | null = null;
  private confirmAlternateCallback: (() => void) | null = null;

  readonly form = this.fb.group({
    ruc: ['', Validators.required],
    nombre: ['', Validators.required],
    direccion: [''],
    email: ['', Validators.email],
    movil: [''],
    telefono: [''],
    observacion: [''],
    idTaxTipIdeFk: ['05', Validators.required],
    cen: [1],
    numeroPrecio: [1],
    porcentajeDescuento: [0],
  });

  readonly vehiculoForm = this.fb.group({
    idVehTipoVehiculoFk: [null as number | null, Validators.required],
    placa: [''],
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
    numeroRuedas: [null as number | null],
    capacidadCarga: [null as number | null],
    tipoBateria: [''],
    voltajeBateria: [''],
    amperajeBateria: [''],
    potenciaMotor: [''],
    autonomiaKm: [null as number | null],
    observaciones: [''],
  });

  constructor() {
    this.resetClienteFormForNew();
    this.resetVehiculoFormForNew();

    this.form.valueChanges.subscribe(() => this.updateClienteDirtyState());
    this.vehiculoForm.valueChanges.subscribe(() => this.updateVehiculoDirtyState());

    this.cargarTodo();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasPendingChanges()) return true;
    return this.requestDiscardConfirmation();
  }

  setTab(tab: ClientesTab): void {
    this.activeTab.set(tab);
  }

  cargarTodo(): void {
    this.cargarClientes();
    this.cargarTiposVehiculo();
  }

  cargarClientes(): void {
    this.loading.set(true);
    this.error.set(null);

    this.repo.listarClientes(this.q().trim(), 0, 50, false)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.clientes.set(items);

          const current = this.selectedCliente();
          if (!current) return;

          const updated =
            items.find(
              (x) => Number(x.dni ?? x.ruc) === Number(current.dni ?? current.ruc)
            ) ?? null;

          this.selectedCliente.set(updated);

          if (!updated) {
            this.mode.set('crear');
            this.activeTab.set('edicion');
            this.vehiculos.set([]);
            this.selectedVehiculo.set(null);
            this.resetClienteFormForNew();
            this.resetVehiculoFormForNew();
          } else {
            this.populateClienteForm(updated);
            this.cargarVehiculos(updated);
          }
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar clientes.');
        },
      });
  }

  cargarTiposVehiculo(): void {
    this.repo.listarTipos('', 0, 100, false).subscribe({
      next: (res) => this.tiposVehiculo.set(res.items ?? []),
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo cargar tipos de vehículo.');
      },
    });
  }

  cargarVehiculos(cliente: VehCliente): void {
    const dni = Number(cliente.dni ?? cliente.ruc);

    this.repo.listarClientesVehiculo({ dni }).subscribe({
      next: (res) => {
        const items = res.items ?? [];
        this.vehiculos.set(items);

        const current = this.selectedVehiculo();
        if (!current) return;

        const updated =
          items.find((x) => x.idCliVehiculo === current.idCliVehiculo) ?? null;

        this.selectedVehiculo.set(updated);
        if (!updated) {
          this.vehiculoMode.set('crear');
          this.resetVehiculoFormForNew();
        } else {
          this.populateVehiculoForm(updated);
        }
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudieron cargar los vehículos del cliente.');
      },
    });
  }

  onSearchEnter(): void {
    this.cargarClientes();
  }

  clearSearch(): void {
    if (!this.q()) return;
    this.q.set('');
    this.cargarClientes();
  }

  nuevoCliente(): void {
    this.runWithDiscardGuard(() => {
      this.selectedCliente.set(null);
      this.selectedVehiculo.set(null);
      this.mode.set('crear');
      this.vehiculoMode.set('crear');
      this.activeTab.set('edicion');
      this.vehiculos.set([]);
      this.error.set(null);
      this.success.set(null);
      this.resetClienteFormForNew();
      this.resetVehiculoFormForNew();
    });
  }

  seleccionarCliente(cliente: VehCliente): void {
    if (
      Number(this.selectedCliente()?.dni ?? this.selectedCliente()?.ruc) ===
      Number(cliente.dni ?? cliente.ruc) &&
      this.mode() === 'editar'
    ) {
      return;
    }

    this.runWithDiscardGuard(() => {
      this.selectedCliente.set(cliente);
      this.selectedVehiculo.set(null);
      this.mode.set('editar');
      this.vehiculoMode.set('crear');
      this.activeTab.set('edicion');
      this.error.set(null);
      this.success.set(null);
      this.populateClienteForm(cliente);
      this.resetVehiculoFormForNew();
      this.cargarVehiculos(cliente);
    });
  }

  nuevoVehiculo(): void {
    const current = this.selectedCliente();
    if (!current) {
      this.error.set('Primero selecciona o guarda un cliente.');
      this.success.set(null);
      return;
    }

    this.runWithDiscardGuardVehiculo(() => {
      this.selectedVehiculo.set(null);
      this.vehiculoMode.set('crear');
      this.activeTab.set('vehiculos');
      this.resetVehiculoFormForNew();
    });
  }

  seleccionarVehiculo(vehiculo: CliVehiculo): void {
    if (
      this.selectedVehiculo()?.idCliVehiculo === vehiculo.idCliVehiculo &&
      this.vehiculoMode() === 'editar'
    ) {
      return;
    }

    this.runWithDiscardGuardVehiculo(() => {
      this.selectedVehiculo.set(vehiculo);
      this.vehiculoMode.set('editar');
      this.activeTab.set('vehiculos');
      this.populateVehiculoForm(vehiculo);
    });
  }

  eliminarClienteActual(): void {
    const current = this.selectedCliente();
    if (!current) return;

    const dni = Number(current.dni ?? current.ruc);

    this.openConfirm(
      {
        title: 'Eliminar cliente',
        message: `Se eliminará "${current.nombre || current.ruc}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo.eliminarCliente(dni)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Cliente eliminado.');
              this.selectedCliente.set(null);
              this.selectedVehiculo.set(null);
              this.mode.set('crear');
              this.vehiculoMode.set('crear');
              this.activeTab.set('edicion');
              this.vehiculos.set([]);
              this.resetClienteFormForNew();
              this.resetVehiculoFormForNew();
              this.cargarClientes();
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar el cliente.');
            },
          });
      }
    );
  }

  eliminarVehiculoActual(): void {
    const current = this.selectedVehiculo();
    const cliente = this.selectedCliente();
    if (!current || !cliente) return;

    this.openConfirm(
      {
        title: 'Eliminar vehículo',
        message: `Se eliminará "${current.marca} ${current.modelo}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo.eliminarClienteVehiculo(current.idCliVehiculo)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Vehículo eliminado.');
              this.selectedVehiculo.set(null);
              this.vehiculoMode.set('crear');
              this.resetVehiculoFormForNew();
              this.cargarVehiculos(cliente);
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar el vehículo.');
            },
          });
      }
    );
  }

  onIdentificacionInput(): void {
    const identificacion = String(this.form.controls.ruc.value ?? '').trim();
    this.form.controls.ruc.setValue(identificacion, { emitEvent: false });
    this.form.controls.idTaxTipIdeFk.setValue(this.inferTipoIdeByLength(identificacion), {
      emitEvent: false,
    });

    if (this.mode() === 'crear') {
      this.clienteLookupState.set('idle');
      this.clienteEncontrado.set(null);
    }

    this.updateClienteDirtyState();
  }

  buscarClienteExistentePorIdentificacion(showStatus = true): void {
    const identificacion = String(this.form.controls.ruc.value ?? '').trim();

    if (!identificacion) {
      this.clienteLookupState.set('idle');
      this.clienteEncontrado.set(null);
      return;
    }

    this.clienteLookupState.set('searching');
    this.clienteEncontrado.set(null);

    this.repo.listarClientes(identificacion, 0, 50, false).subscribe({
      next: (res) => {
        const match = this.findClienteExacto(res.items ?? [], identificacion);

        if (!match) {
          this.clienteLookupState.set('not_found');
          this.clienteEncontrado.set(null);
          return;
        }

        if (
          this.mode() === 'editar' &&
          Number(match.dni ?? match.ruc) === Number(this.selectedCliente()?.dni ?? this.selectedCliente()?.ruc)
        ) {
          this.clienteLookupState.set('found');
          this.clienteEncontrado.set(match);
          return;
        }

        this.clienteLookupState.set('found');
        this.clienteEncontrado.set(match);

        if (showStatus) {
          this.success.set(null);
          this.error.set(`Ya existe el cliente "${match.nombre || match.ruc}". Puedes cargarlo para editarlo.`);
        }
      },
      error: (err) => {
        console.error(err);
        this.clienteLookupState.set('idle');
        this.clienteEncontrado.set(null);
        this.error.set(err?.message || 'No se pudo buscar cliente existente.');
      },
    });
  }

  cargarClienteEncontrado(): void {
    const found = this.clienteEncontrado();
    if (!found) return;
    this.seleccionarCliente(found);
  }

  guardarCliente(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa identificación, nombre y revisa el email.');
      this.success.set(null);
      return;
    }

    const raw = this.form.getRawValue();
    const payload: VehClienteGuardarRequest = {
      ruc: String(raw.ruc ?? '').trim(),
      nombre: String(raw.nombre ?? '').trim(),
      direccion: raw.direccion?.trim() || null,
      email: raw.email?.trim() || null,
      movil: raw.movil?.trim() || null,
      telefono: raw.telefono?.trim() || null,
      observacion: raw.observacion?.trim() || null,
      idTaxTipIdeFk: this.normalizeTipoIdentificacionValue(
        raw.idTaxTipIdeFk || this.inferTipoIdeByLength(String(raw.ruc ?? ''))
      ),
      cen: Number(raw.cen || 1),
      numeroPrecio: Number(raw.numeroPrecio || 1),
      porcentajeDescuento: Number(raw.porcentajeDescuento || 0),
    };

    if (!payload.ruc) {
      this.error.set('Ingresa una identificación válida.');
      this.success.set(null);
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    if (this.mode() === 'editar' && this.selectedCliente()) {
      const dni = Number(this.selectedCliente()!.dni ?? this.selectedCliente()!.ruc);

      this.repo.editarCliente({
        dni,
        cambiosTax: {
          ruc: payload.ruc,
          nombre: payload.nombre,
          direccion: payload.direccion,
          email: payload.email,
          movil: payload.movil,
          telefono: payload.telefono,
          observacion: payload.observacion,
        },
        cambiosCli: {
          idTaxTipIdeFk: payload.idTaxTipIdeFk,
          cen: payload.cen,
          numeroPrecio: payload.numeroPrecio,
          porcentajeDescuento: payload.porcentajeDescuento,
        },
      })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.success.set('Cliente actualizado.');
            const current = this.selectedCliente()!;
            const updated: VehCliente = {
              ...current,
              ruc: payload.ruc,
              nombre: payload.nombre,
              direccion: payload.direccion,
              email: payload.email,
              movil: payload.movil,
              telefono: payload.telefono,
              observacion: payload.observacion,
              idTaxTipIdeFk: payload.idTaxTipIdeFk,
              cen: payload.cen,
              numeroPrecio: payload.numeroPrecio,
              porcentajeDescuento: payload.porcentajeDescuento,
            };
            this.selectedCliente.set(updated);
            this.populateClienteForm(updated);
            this.cargarClientes();
          },
          error: (err) => {
            console.error(err);
            this.error.set(err?.message || 'No se pudo guardar el cliente.');
          },
        });

      return;
    }

    this.repo.listarClientes(payload.ruc, 0, 50, false).subscribe({
      next: (res) => {
        const found = this.findClienteExacto(res.items ?? [], payload.ruc);

        if (found) {
          this.saving.set(false);
          this.clienteEncontrado.set(found);
          this.clienteLookupState.set('found');
          this.error.set(`Ya existe el cliente "${found.nombre || found.ruc}". Cárgalo para editarlo.`);
          return;
        }

        this.repo.crearCliente(payload)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Cliente creado.');
              this.clienteEncontrado.set(null);
              this.clienteLookupState.set('idle');
              this.dirty.set(false);
              this.cargarClientes();
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo guardar el cliente.');
            },
          });
      },
      error: (err) => {
        console.error(err);
        this.saving.set(false);
        this.error.set(err?.message || 'No se pudo validar si el cliente existe.');
      },
    });
  }

  guardarVehiculo(): void {
    const cliente = this.selectedCliente();
    if (!cliente) {
      this.error.set('Selecciona o guarda primero un cliente.');
      this.success.set(null);
      return;
    }

    if (this.vehiculoForm.invalid) {
      this.vehiculoForm.markAllAsTouched();
      this.error.set('Debes seleccionar tipo de vehículo e ingresar marca y modelo.');
      this.success.set(null);
      return;
    }

    const raw = this.vehiculoForm.getRawValue();
    const payload: CliVehiculoGuardarRequest = {
      dni: Number(cliente.dni ?? cliente.ruc),
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
      numeroRuedas: raw.numeroRuedas ?? null,
      capacidadCarga: raw.capacidadCarga ?? null,
      tipoBateria: raw.tipoBateria?.trim() || null,
      voltajeBateria: raw.voltajeBateria?.trim() || null,
      amperajeBateria: raw.amperajeBateria?.trim() || null,
      potenciaMotor: raw.potenciaMotor?.trim() || null,
      autonomiaKm: raw.autonomiaKm ?? null,
      observaciones: raw.observaciones?.trim() || null,
    };

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    const request$ =
      this.vehiculoMode() === 'editar' && this.selectedVehiculo()
        ? this.repo.editarClienteVehiculo({
            idCliVehiculo: this.selectedVehiculo()!.idCliVehiculo,
            cambios: payload,
          })
        : this.repo.crearClienteVehiculo(payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set(
            this.vehiculoMode() === 'editar'
              ? 'Vehículo actualizado.'
              : 'Vehículo creado.'
          );

          this.vehiculoDirty.set(false);

          if (this.vehiculoMode() === 'crear') {
            this.resetVehiculoFormForNew();
          }

          this.cargarVehiculos(cliente);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo guardar el vehículo.');
        },
      });
  }

  cancelarCliente(): void {
    if (!this.dirty()) {
      if (this.mode() === 'editar' && this.selectedCliente()) {
        this.populateClienteForm(this.selectedCliente()!);
      } else {
        this.resetClienteFormForNew();
      }
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar en el cliente.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        if (this.mode() === 'editar' && this.selectedCliente()) {
          this.populateClienteForm(this.selectedCliente()!);
        } else {
          this.resetClienteFormForNew();
        }
      }
    );
  }

  cancelarVehiculo(): void {
    if (!this.vehiculoDirty()) {
      if (this.vehiculoMode() === 'editar' && this.selectedVehiculo()) {
        this.populateVehiculoForm(this.selectedVehiculo()!);
      } else {
        this.resetVehiculoFormForNew();
      }
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar en el vehículo.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        if (this.vehiculoMode() === 'editar' && this.selectedVehiculo()) {
          this.populateVehiculoForm(this.selectedVehiculo()!);
        } else {
          this.resetVehiculoFormForNew();
        }
      }
    );
  }

  tipoVehiculoLabel(idVehTipoVehiculoFk: number | null | undefined): string {
    if (idVehTipoVehiculoFk == null) return 'Sin tipo';
    return (
      this.tiposVehiculo().find((x) => x.idVehTipoVehiculo === idVehTipoVehiculoFk)?.tipoVehiculo ||
      `Tipo #${idVehTipoVehiculoFk}`
    );
  }

  clienteKey(cliente: VehCliente | null | undefined): number {
    return Number(cliente?.dni ?? cliente?.ruc ?? 0);
  }

  confirmSeverityClass(): string {
    if (this.confirmSeverity() === 'danger') return 'is-danger';
    if (this.confirmSeverity() === 'warning') return 'is-warning';
    return 'is-info';
  }

  confirmIconSymbol(): string {
    if (this.confirmSeverity() === 'danger') return '!';
    if (this.confirmSeverity() === 'warning') return '!';
    return 'i';
  }

  confirmAccept(): void {
    const callback = this.confirmAcceptCallback;
    this.closeConfirmInternal();
    callback?.();
  }

  confirmCancel(): void {
    const callback = this.confirmCancelCallback;
    this.closeConfirmInternal();
    callback?.();
  }

  confirmAlternate(): void {
    const callback = this.confirmAlternateCallback;
    this.closeConfirmInternal();
    callback?.();
  }

  onConfirmHide(): void {
    this.closeConfirmInternal(false);
  }

  volver(): void {
    this.runWithDiscardGuard(() => {
      this.router.navigate(['/app/vehiculos/dashboard']);
    });
  }

  private openConfirm(
    config: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      alternateLabel?: string | null;
      severity?: ConfirmSeverity;
    },
    onAccept?: () => void,
    onCancel?: () => void,
    onAlternate?: () => void
  ): void {
    this.confirmTitle.set(config.title);
    this.confirmMessage.set(config.message);
    this.confirmConfirmLabel.set(config.confirmLabel ?? 'Confirmar');
    this.confirmCancelLabel.set(config.cancelLabel ?? 'Cancelar');
    this.confirmAlternateLabel.set(config.alternateLabel ?? null);
    this.confirmSeverity.set(config.severity ?? 'warning');
    this.confirmAcceptCallback = onAccept ?? null;
    this.confirmCancelCallback = onCancel ?? null;
    this.confirmAlternateCallback = onAlternate ?? null;
    this.confirmVisible.set(true);
  }

  private requestDiscardConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      this.openConfirm(
        {
          title: 'Descartar cambios',
          message: 'Hay cambios sin guardar.\n\nSi continúas, se perderán.',
          confirmLabel: 'Descartar',
          cancelLabel: 'Seguir editando',
          severity: 'warning',
        },
        () => {
          this.dirty.set(false);
          this.vehiculoDirty.set(false);
          resolve(true);
        },
        () => resolve(false)
      );
    });
  }

  private closeConfirmInternal(resetCallbacks = true): void {
    this.confirmVisible.set(false);

    if (resetCallbacks) {
      this.confirmAcceptCallback = null;
      this.confirmCancelCallback = null;
      this.confirmAlternateCallback = null;
    }
  }

  private runWithDiscardGuard(action: () => void): void {
    if (!this.dirty()) {
      action();
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar en cliente.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.dirty.set(false);
        action();
      }
    );
  }

  private runWithDiscardGuardVehiculo(action: () => void): void {
    if (!this.vehiculoDirty()) {
      action();
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar en vehículo.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.vehiculoDirty.set(false);
        action();
      }
    );
  }

  private resetClienteFormForNew(): void {
    this.form.reset({
      ruc: '',
      nombre: '',
      direccion: '',
      email: '',
      movil: '',
      telefono: '',
      observacion: '',
      idTaxTipIdeFk: '05',
      cen: 1,
      numeroPrecio: 1,
      porcentajeDescuento: 0,
    });

    this.clienteLookupState.set('idle');
    this.clienteEncontrado.set(null);
    this.refreshClienteSnapshot();
  }

  private populateClienteForm(cliente: VehCliente): void {
    this.form.reset({
      ruc: cliente.ruc || '',
      nombre: cliente.nombre || '',
      direccion: cliente.direccion || '',
      email: cliente.email || '',
      movil: cliente.movil || '',
      telefono: cliente.telefono || '',
      observacion: cliente.observacion || '',
      idTaxTipIdeFk: this.normalizeTipoIdentificacionValue(
        cliente.idTaxTipIdeFk || this.inferTipoIdeByLength(cliente.ruc || '')
      ),
      cen: cliente.cen ?? 1,
      numeroPrecio: cliente.numeroPrecio ?? 1,
      porcentajeDescuento: cliente.porcentajeDescuento ?? 0,
    });

    this.clienteLookupState.set('found');
    this.clienteEncontrado.set(cliente);
    this.refreshClienteSnapshot();
  }

  private resetVehiculoFormForNew(): void {
    this.vehiculoForm.reset({
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
      numeroRuedas: null,
      capacidadCarga: null,
      tipoBateria: '',
      voltajeBateria: '',
      amperajeBateria: '',
      potenciaMotor: '',
      autonomiaKm: null,
      observaciones: '',
    });

    this.refreshVehiculoSnapshot();
  }

  private populateVehiculoForm(vehiculo: CliVehiculo): void {
    this.vehiculoForm.reset({
      idVehTipoVehiculoFk: vehiculo.idVehTipoVehiculoFk,
      placa: vehiculo.placa || '',
      marca: vehiculo.marca || '',
      modelo: vehiculo.modelo || '',
      anio: vehiculo.anio ?? null,
      color: vehiculo.color || '',
      numeroChasis: vehiculo.numeroChasis || '',
      numeroMotor: vehiculo.numeroMotor || '',
      cilindraje: vehiculo.cilindraje || '',
      combustible: vehiculo.combustible || '',
      transmision: vehiculo.transmision || '',
      kilometraje: vehiculo.kilometraje ?? null,
      numeroRuedas: vehiculo.numeroRuedas ?? null,
      capacidadCarga: vehiculo.capacidadCarga ?? null,
      tipoBateria: vehiculo.tipoBateria || '',
      voltajeBateria: vehiculo.voltajeBateria || '',
      amperajeBateria: vehiculo.amperajeBateria || '',
      potenciaMotor: vehiculo.potenciaMotor || '',
      autonomiaKm: vehiculo.autonomiaKm ?? null,
      observaciones: vehiculo.observaciones || '',
    });

    this.refreshVehiculoSnapshot();
  }

  private inferTipoIdeByLength(value: string): string {
    const len = String(value ?? '').trim().length;
    if (len === 13) return '04';
    if (len === 10) return '05';
    return '06';
  }

  private normalizeTipoIdentificacionValue(value: string): string {
    const v = String(value ?? '').trim();
    if (v === '04' || v === '05' || v === '06') return v;
    return '06';
  }

  private findClienteExacto(items: VehCliente[], identificacion: string): VehCliente | null {
    const needle = String(identificacion ?? '').trim();

    for (const item of items) {
      const ruc = String(item.ruc ?? '').trim();
      const dni = String(item.dni ?? '').trim();

      if (ruc === needle || dni === needle) return item;
      if (needle && /^\d+$/.test(needle) && Number(dni || ruc) === Number(needle)) return item;
    }

    return null;
  }

  private createClienteSnapshot(): string {
    const raw = this.form.getRawValue();
    return JSON.stringify({
      ruc: String(raw.ruc ?? '').trim(),
      nombre: String(raw.nombre ?? '').trim(),
      direccion: String(raw.direccion ?? '').trim(),
      email: String(raw.email ?? '').trim(),
      movil: String(raw.movil ?? '').trim(),
      telefono: String(raw.telefono ?? '').trim(),
      observacion: String(raw.observacion ?? '').trim(),
      idTaxTipIdeFk: this.normalizeTipoIdentificacionValue(
        raw.idTaxTipIdeFk || this.inferTipoIdeByLength(String(raw.ruc ?? ''))
      ),
      cen: Number(raw.cen || 1),
      numeroPrecio: Number(raw.numeroPrecio || 1),
      porcentajeDescuento: Number(raw.porcentajeDescuento || 0),
    });
  }

  private createVehiculoSnapshot(): string {
    const raw = this.vehiculoForm.getRawValue();
    return JSON.stringify({
      idVehTipoVehiculoFk: raw.idVehTipoVehiculoFk ?? null,
      placa: String(raw.placa ?? '').trim(),
      marca: String(raw.marca ?? '').trim(),
      modelo: String(raw.modelo ?? '').trim(),
      anio: raw.anio ?? null,
      color: String(raw.color ?? '').trim(),
      numeroChasis: String(raw.numeroChasis ?? '').trim(),
      numeroMotor: String(raw.numeroMotor ?? '').trim(),
      cilindraje: String(raw.cilindraje ?? '').trim(),
      combustible: String(raw.combustible ?? '').trim(),
      transmision: String(raw.transmision ?? '').trim(),
      kilometraje: raw.kilometraje ?? null,
      numeroRuedas: raw.numeroRuedas ?? null,
      capacidadCarga: raw.capacidadCarga ?? null,
      tipoBateria: String(raw.tipoBateria ?? '').trim(),
      voltajeBateria: String(raw.voltajeBateria ?? '').trim(),
      amperajeBateria: String(raw.amperajeBateria ?? '').trim(),
      potenciaMotor: String(raw.potenciaMotor ?? '').trim(),
      autonomiaKm: raw.autonomiaKm ?? null,
      observaciones: String(raw.observaciones ?? '').trim(),
    });
  }

  private refreshClienteSnapshot(): void {
    this.initialClienteSnapshot = this.createClienteSnapshot();
    this.dirty.set(false);
  }

  private refreshVehiculoSnapshot(): void {
    this.initialVehiculoSnapshot = this.createVehiculoSnapshot();
    this.vehiculoDirty.set(false);
  }

  private updateClienteDirtyState(): void {
    this.dirty.set(this.createClienteSnapshot() !== this.initialClienteSnapshot);
  }

  private updateVehiculoDirtyState(): void {
    this.vehiculoDirty.set(this.createVehiculoSnapshot() !== this.initialVehiculoSnapshot);
  }
}
