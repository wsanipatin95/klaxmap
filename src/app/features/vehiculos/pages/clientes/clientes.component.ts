import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosWorkbenchShellComponent } from '../../components/workbench-shell/workbench-shell.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import { CliVehiculo, VehCliente, VehClienteGuardarRequest, CliVehiculoGuardarRequest } from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-vehiculos-clientes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ConfirmDialogModule,
    VehiculosPageHeaderComponent,
    VehiculosWorkbenchShellComponent,
    VehiculosFormDrawerComponent,
    VehiculosEmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss',
})
export class VehiculosClientesComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);

  q = '';
  loading = signal(false);
  saving = signal(false);
  clientes = signal<VehCliente[]>([]);
  vehiculos = signal<CliVehiculo[]>([]);
  selectedCliente = signal<VehCliente | null>(null);

  drawerVisible = signal(false);
  vehiculoDrawerVisible = signal(false);
  dirty = signal(false);
  vehiculoDirty = signal(false);
  editingDni = signal<number | null>(null);
  editingVehiculoId = signal<number | null>(null);

  form = this.fb.group({
    ruc: ['', Validators.required],
    nombre: ['', Validators.required],
    direccion: [''],
    email: [''],
    movil: [''],
    telefono: [''],
    observacion: [''],
    idTaxTipIdeFk: ['CED'],
    cen: [1],
    numeroPrecio: [1],
    porcentajeDescuento: [0],
  });

  vehiculoForm = this.fb.group({
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
    this.form.valueChanges.subscribe(() => this.dirty.set(true));
    this.vehiculoForm.valueChanges.subscribe(() => this.vehiculoDirty.set(true));
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    if (this.vehiculoDrawerVisible() && this.vehiculoDirty()) return this.confirm.confirmDiscard();
    return true;
  }

  cargar() {
    this.loading.set(true);
    this.repo.listarClientes(this.q, 0, 200, true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.clientes.set(res.items ?? []);
          const current = this.selectedCliente();
          if (current) {
            const updated = (res.items ?? []).find((x) => Number(x.ruc) === Number(current.ruc) || x.ruc === current.ruc || x.dni === current.dni) ?? null;
            this.selectedCliente.set(updated);
            if (updated) this.cargarVehiculos(updated);
          }
        },
        error: (err) => this.notify.error('No se pudo cargar clientes', err?.message),
      });
  }

  cargarVehiculos(cliente: VehCliente) {
    const dni = cliente.dni ? Number(cliente.dni) : Number(cliente.ruc);
    this.repo.listarClientesVehiculo({ dni }).subscribe({
      next: (res) => this.vehiculos.set(res.items ?? []),
      error: (err) => this.notify.error('No se pudieron cargar vehículos del cliente', err?.message),
    });
  }

  seleccionar(cliente: VehCliente) {
    this.selectedCliente.set(cliente);
    this.cargarVehiculos(cliente);
  }

  nuevoCliente() {
    this.editingDni.set(null);
    this.form.reset({
      ruc: '',
      nombre: '',
      direccion: '',
      email: '',
      movil: '',
      telefono: '',
      observacion: '',
      idTaxTipIdeFk: 'CED',
      cen: 1,
      numeroPrecio: 1,
      porcentajeDescuento: 0,
    });
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editarCliente(cliente: VehCliente) {
    this.editingDni.set(cliente.dni ?? Number(cliente.ruc));
    this.form.reset({
      ruc: cliente.ruc || '',
      nombre: cliente.nombre || '',
      direccion: cliente.direccion || '',
      email: cliente.email || '',
      movil: cliente.movil || '',
      telefono: cliente.telefono || '',
      observacion: cliente.observacion || '',
      idTaxTipIdeFk: cliente.idTaxTipIdeFk || 'CED',
      cen: cliente.cen ?? 1,
      numeroPrecio: cliente.numeroPrecio ?? 1,
      porcentajeDescuento: cliente.porcentajeDescuento ?? 0,
    });
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  async eliminarCliente(cliente: VehCliente) {
    const dni = Number(cliente.dni ?? cliente.ruc);
    const ok = await this.confirm.confirmDelete(cliente.nombre || cliente.ruc);
    if (!ok) return;
    this.repo.eliminarCliente(dni).subscribe({
      next: () => {
        this.notify.success('Cliente eliminado', 'El cliente fue eliminado correctamente.');
        if (this.selectedCliente()?.ruc === cliente.ruc) {
          this.selectedCliente.set(null);
          this.vehiculos.set([]);
        }
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo eliminar cliente', err?.message),
    });
  }

  cerrarDrawer = async () => {
    if (this.dirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.drawerVisible.set(false);
    this.dirty.set(false);
  };

  submitCliente() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Completa al menos identificación y nombre.');
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
      idTaxTipIdeFk: raw.idTaxTipIdeFk?.trim() || null,
      cen: Number(raw.cen || 1),
      numeroPrecio: Number(raw.numeroPrecio || 1),
      porcentajeDescuento: Number(raw.porcentajeDescuento || 0),
    };

    this.saving.set(true);
    const request$ = this.editingDni()
      ? this.repo.editarCliente({
          dni: this.editingDni()!,
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
      : this.repo.crearCliente(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(this.editingDni() ? 'Cliente actualizado' : 'Cliente creado', 'Registro guardado correctamente.');
        this.drawerVisible.set(false);
        this.dirty.set(false);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo guardar cliente', err?.message),
    });
  }

  nuevoVehiculo() {
    const current = this.selectedCliente();
    if (!current) {
      this.notify.warn('Selecciona un cliente', 'Primero selecciona un cliente para registrar su vehículo.');
      return;
    }
    this.editingVehiculoId.set(null);
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
    this.vehiculoDrawerVisible.set(true);
    this.vehiculoDirty.set(false);
  }

  editarVehiculo(vehiculo: CliVehiculo) {
    this.editingVehiculoId.set(vehiculo.idCliVehiculo);
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
    this.vehiculoDrawerVisible.set(true);
    this.vehiculoDirty.set(false);
  }

  async eliminarVehiculo(vehiculo: CliVehiculo) {
    const ok = await this.confirm.confirmDelete(`${vehiculo.marca} ${vehiculo.modelo}`);
    if (!ok) return;
    this.repo.eliminarClienteVehiculo(vehiculo.idCliVehiculo).subscribe({
      next: () => {
        this.notify.success('Vehículo eliminado', 'El vehículo fue eliminado correctamente.');
        const cliente = this.selectedCliente();
        if (cliente) this.cargarVehiculos(cliente);
      },
      error: (err) => this.notify.error('No se pudo eliminar vehículo', err?.message),
    });
  }

  cerrarVehiculoDrawer = async () => {
    if (this.vehiculoDirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.vehiculoDrawerVisible.set(false);
    this.vehiculoDirty.set(false);
  };

  submitVehiculo() {
    const current = this.selectedCliente();
    if (!current) {
      this.notify.warn('Selecciona un cliente', 'No se puede guardar un vehículo sin cliente seleccionado.');
      return;
    }
    if (this.vehiculoForm.invalid) {
      this.vehiculoForm.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Debes ingresar tipo, marca y modelo.');
      return;
    }

    const dni = Number(current.dni ?? current.ruc);
    const raw = this.vehiculoForm.getRawValue();
    const payload: CliVehiculoGuardarRequest = {
      dni,
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

    this.saving.set(true);
    const request$ = this.editingVehiculoId()
      ? this.repo.editarClienteVehiculo({ idCliVehiculo: this.editingVehiculoId()!, cambios: payload })
      : this.repo.crearClienteVehiculo(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(this.editingVehiculoId() ? 'Vehículo actualizado' : 'Vehículo creado', 'Registro guardado correctamente.');
        this.vehiculoDrawerVisible.set(false);
        this.vehiculoDirty.set(false);
        this.cargarVehiculos(current);
      },
      error: (err) => this.notify.error('No se pudo guardar vehículo', err?.message),
    });
  }
}
