import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  DashboardMetric,
  VehCheckList,
  VehCheckListGuardarRequest,
  VehCheckListVehiculo,
  VehCheckListVehiculoGuardarRequest,
  VehTipoVehiculo,
  VehTipoVehiculoGuardarRequest,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type DashboardDrawerMode = 'tipo' | 'checklist' | 'relacion' | null;

@Component({
  selector: 'app-vehiculos-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    TextareaModule,
    VehiculosPageHeaderComponent,
    VehiculosEmptyStateComponent,
    VehiculosFormDrawerComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class VehiculosDashboardComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);

  loading = signal(false);
  saving = signal(false);
  drawerVisible = signal(false);
  drawerMode = signal<DashboardDrawerMode>(null);
  dirty = signal(false);

  metrics = signal<DashboardMetric[]>([]);
  tipos = signal<VehTipoVehiculo[]>([]);
  checklists = signal<VehCheckList[]>([]);
  relaciones = signal<VehCheckListVehiculo[]>([]);
  recientes = signal<Array<{ label: string; value: string; chip?: string }>>([]);

  tipoForm = this.fb.group({
    art: [null as number | null],
    tipoVehiculo: ['', Validators.required],
    atributosJson: ['{}'],
  });

  checklistForm = this.fb.group({
    nombreItem: ['', Validators.required],
    categoria: ['GENERAL'],
    orden: [1],
    obligatorio: [true],
  });

  relacionForm = this.fb.group({
    idVehVehiculoCheckListFk: [null as number | null, Validators.required],
    idVehTipoVehiculoFk: [null as number | null, Validators.required],
  });

  constructor() {
    this.tipoForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.checklistForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.relacionForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) {
      return this.confirm.confirmDiscard();
    }
    return true;
  }

  cargar() {
    this.loading.set(true);

    forkJoin({
      tipos: this.repo.listarTipos('', 0, 200, true),
      checklists: this.repo.listarChecklists(),
      relaciones: this.repo.listarChecklistsVehiculo(),
      clientes: this.repo.listarClientes('', 0, 100, true),
      vehiculos: this.repo.listarClientesVehiculo(),
      ordenes: this.repo.listarOrdenes('', 0, 100, true),
      facturas: this.repo.listarFacturas('', 0, 100, true),
      cobros: this.repo.listarCobros('', 0, 100, true),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (bundle) => {
          const tipos = bundle.tipos.items ?? [];
          const checklists = bundle.checklists.items ?? [];
          const relaciones = bundle.relaciones.items ?? [];
          const ordenes = bundle.ordenes.items ?? [];
          const facturas = bundle.facturas.items ?? [];
          const cobros = bundle.cobros.items ?? [];

          this.tipos.set(tipos);
          this.checklists.set(checklists);
          this.relaciones.set(relaciones);

          const tiposRelacionados = new Set(relaciones.map((x) => x.idVehTipoVehiculoFk));
          const checklistsRelacionados = new Set(relaciones.map((x) => x.idVehVehiculoCheckListFk));

          this.metrics.set([
            { label: 'Tipos de vehículo', value: tipos.length, hint: 'Catálogo maestro' },
            { label: 'Checklist maestro', value: checklists.length, hint: 'Ítems registrados' },
            { label: 'Relaciones', value: relaciones.length, hint: 'Checklist por tipo' },
            { label: 'Tipos sin checklist', value: tipos.filter((x) => !tiposRelacionados.has(x.idVehTipoVehiculo)).length, hint: 'Pendientes de relacionar' },
            { label: 'Checklist sin tipo', value: checklists.filter((x) => !checklistsRelacionados.has(x.idVehVehiculoCheckList)).length, hint: 'Pendientes de asignar' },
            { label: 'Vehículos', value: bundle.vehiculos.items?.length ?? 0, hint: 'Unidades registradas' },
            { label: 'Órdenes', value: ordenes.length, hint: 'Órdenes de trabajo' },
            { label: 'Facturas', value: facturas.length, hint: 'Documentos emitidos' },
            { label: 'Cobros', value: cobros.length, hint: 'Recibos registrados' },
            { label: 'Clientes', value: bundle.clientes.items?.length ?? 0, hint: 'Clientes activos' },
          ]);

          this.recientes.set([
            {
              label: 'Último tipo',
              value: this.tiposRecientes()[0]?.tipoVehiculo || 'Sin tipos',
              chip: this.tiposRecientes()[0] ? `#${this.tiposRecientes()[0].idVehTipoVehiculo}` : 'SIN DATOS',
            },
            {
              label: 'Último checklist',
              value: this.checklistsRecientes()[0]?.nombreItem || 'Sin checklist',
              chip: this.checklistsRecientes()[0]
                ? (this.esObligatorio(this.checklistsRecientes()[0].obligatorio) ? 'Obligatorio' : 'Opcional')
                : 'SIN DATOS',
            },
            {
              label: 'Última relación',
              value: this.relacionesRecientes()[0]
                ? `${this.nombreTipo(this.relacionesRecientes()[0].idVehTipoVehiculoFk)} · ${this.nombreChecklist(this.relacionesRecientes()[0].idVehVehiculoCheckListFk)}`
                : 'Sin relaciones',
              chip: this.relacionesRecientes()[0]
                ? `#${this.relacionesRecientes()[0].idVehVehiculoCheckListVehiculo}`
                : 'SIN DATOS',
            },
          ]);
        },
        error: (err) => this.notify.error('No se pudo cargar el dashboard de vehículos', err?.message),
      });
  }

  abrirDrawer(mode: Exclude<DashboardDrawerMode, null>) {
    this.drawerMode.set(mode);
    this.drawerVisible.set(true);
    this.dirty.set(false);

    if (mode === 'tipo') {
      this.tipoForm.reset({
        art: null,
        tipoVehiculo: '',
        atributosJson: '{}',
      });
    }

    if (mode === 'checklist') {
      this.checklistForm.reset({
        nombreItem: '',
        categoria: 'GENERAL',
        orden: (this.checklists().length || 0) + 1,
        obligatorio: true,
      });
    }

    if (mode === 'relacion') {
      this.relacionForm.reset({
        idVehVehiculoCheckListFk: null,
        idVehTipoVehiculoFk: null,
      });
    }
  }

  cerrarDrawer = async () => {
    if (this.dirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.drawerVisible.set(false);
    this.drawerMode.set(null);
    this.dirty.set(false);
  };

  submit() {
    const mode = this.drawerMode();
    if (!mode) return;

    let request$: Observable<any>;

    if (mode === 'tipo') {
      if (this.tipoForm.invalid) {
        this.tipoForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'El tipo de vehículo es obligatorio.');
        return;
      }

      const payload: VehTipoVehiculoGuardarRequest = {
        art: this.tipoForm.value.art ?? null,
        tipoVehiculo: this.tipoForm.value.tipoVehiculo?.trim() || null,
        atributos: this.parseJson(this.tipoForm.value.atributosJson),
      };

      request$ = this.repo.crearTipo(payload);
    } else if (mode === 'checklist') {
      if (this.checklistForm.invalid) {
        this.checklistForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'El nombre del checklist es obligatorio.');
        return;
      }

      const payload: VehCheckListGuardarRequest = {
        nombreItem: this.checklistForm.value.nombreItem?.trim() || '',
        categoria: this.checklistForm.value.categoria?.trim() || null,
        orden: Number(this.checklistForm.value.orden || 1),
        obligatorio: !!this.checklistForm.value.obligatorio,
      };

      request$ = this.repo.crearCheckList(payload);
    } else {
      if (this.relacionForm.invalid) {
        this.relacionForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Debes seleccionar el tipo y el checklist.');
        return;
      }

      const payload: VehCheckListVehiculoGuardarRequest = {
        idVehVehiculoCheckListFk: Number(this.relacionForm.value.idVehVehiculoCheckListFk),
        idVehTipoVehiculoFk: Number(this.relacionForm.value.idVehTipoVehiculoFk),
      };

      request$ = this.repo.crearChecklistVehiculo(payload);
    }

    this.saving.set(true);
    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          const titulo =
            mode === 'tipo'
              ? 'Tipo creado'
              : mode === 'checklist'
                ? 'Checklist creado'
                : 'Relación creada';

          const detalle =
            mode === 'tipo'
              ? 'El tipo de vehículo se guardó correctamente.'
              : mode === 'checklist'
                ? 'El checklist maestro se guardó correctamente.'
                : 'El checklist fue relacionado con el tipo de vehículo.';

          this.notify.success(titulo, detalle);
          this.drawerVisible.set(false);
          this.drawerMode.set(null);
          this.dirty.set(false);
          this.cargar();
        },
        error: (err) => this.notify.error('No se pudo guardar el registro', err?.message),
      });
  }

  drawerTitle() {
    switch (this.drawerMode()) {
      case 'tipo': return 'Nuevo tipo de vehículo';
      case 'checklist': return 'Nuevo checklist maestro';
      case 'relacion': return 'Relacionar checklist con tipo';
      default: return 'Nuevo registro';
    }
  }

  drawerSubtitle() {
    switch (this.drawerMode()) {
      case 'tipo': return 'Catálogo maestro de tipos de vehículo. Mantén nombre y atributos claros.';
      case 'checklist': return 'Ítems reutilizables para recepción, inspección y validación por tipo.';
      case 'relacion': return 'Conecta el checklist correcto con el tipo correcto sin salir del dashboard.';
      default: return 'Configuración rápida del módulo de vehículos.';
    }
  }

  tiposRecientes() {
    return [...this.tipos()].sort((a, b) => this.compareReciente(a, b, 'idVehTipoVehiculo')).slice(0, 5);
  }

  checklistsRecientes() {
    return [...this.checklists()].sort((a, b) => this.compareReciente(a, b, 'idVehVehiculoCheckList')).slice(0, 5);
  }

  relacionesRecientes() {
    return [...this.relaciones()].sort((a, b) => this.compareReciente(a, b, 'idVehVehiculoCheckListVehiculo')).slice(0, 5);
  }

  tiposDisponiblesParaRelacion() {
    return [...this.tipos()].sort((a, b) => (a.tipoVehiculo || '').localeCompare(b.tipoVehiculo || ''));
  }

  checklistsDisponiblesParaRelacion() {
    return [...this.checklists()].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  nombreTipo(id?: number | null) {
    return this.tipos().find((x) => x.idVehTipoVehiculo === id)?.tipoVehiculo || `Tipo #${id}`;
  }

  nombreChecklist(id?: number | null) {
    return this.checklists().find((x) => x.idVehVehiculoCheckList === id)?.nombreItem || `Checklist #${id}`;
  }

  esObligatorio(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
  }

  relacionesPendientesTexto() {
    const tiposRelacionados = new Set(this.relaciones().map((x) => x.idVehTipoVehiculoFk));
    const checklistsRelacionados = new Set(this.relaciones().map((x) => x.idVehVehiculoCheckListFk));

    const tiposPend = this.tipos().filter((x) => !tiposRelacionados.has(x.idVehTipoVehiculo)).length;
    const checkPend = this.checklists().filter((x) => !checklistsRelacionados.has(x.idVehVehiculoCheckList)).length;

    return `${tiposPend} tipos sin checklist · ${checkPend} checklist sin tipo`;
  }

  private parseJson(value?: string | null) {
    if (!value || !value.trim()) return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  private compareReciente<T extends { fecGen?: string | null }>(a: T, b: T, idField: keyof T) {
    const fa = a.fecGen ? new Date(a.fecGen).getTime() : 0;
    const fb = b.fecGen ? new Date(b.fecGen).getTime() : 0;

    if (fb !== fa) return fb - fa;

    const ia = Number(a[idField] ?? 0);
    const ib = Number(b[idField] ?? 0);
    return ib - ia;
  }
}