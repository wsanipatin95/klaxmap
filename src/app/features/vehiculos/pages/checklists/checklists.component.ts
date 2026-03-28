import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  VehCheckList,
  VehCheckListGuardarRequest,
  VehCheckListVehiculo,
  VehTipoVehiculo,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-vehiculos-checklists',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    ConfirmDialogModule,
    VehiculosPageHeaderComponent,
    VehiculosFormDrawerComponent,
    VehiculosEmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss',
})
export class VehiculosChecklistsComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);

  q = '';
  loading = signal(false);
  saving = signal(false);
  checks = signal<VehCheckList[]>([]);
  tipos = signal<VehTipoVehiculo[]>([]);
  selectedTipo = signal<VehTipoVehiculo | null>(null);
  asignados = signal<VehCheckListVehiculo[]>([]);

  drawerVisible = signal(false);
  assignDrawerVisible = signal(false);
  dirty = signal(false);
  assignDirty = signal(false);
  editingId = signal<number | null>(null);

  form = this.fb.group({
    nombreItem: ['', Validators.required],
    categoria: ['GENERAL'],
    orden: [1],
    obligatorio: [true],
  });

  assignForm = this.fb.group({
    idVehVehiculoCheckListFk: [null as number | null, Validators.required],
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.dirty.set(true));
    this.assignForm.valueChanges.subscribe(() => this.assignDirty.set(true));
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    if (this.assignDrawerVisible() && this.assignDirty()) return this.confirm.confirmDiscard();
    return true;
  }

  cargar() {
    this.loading.set(true);
    this.repo.listarChecklists({ q: this.q })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.checks.set(res.items ?? []),
        error: (err) => this.notify.error('No se pudo cargar checklist', err?.message),
      });

    this.repo.listarTipos('', 0, 200, true).subscribe({
      next: (res) => {
        this.tipos.set(res.items ?? []);
        const current = this.selectedTipo();
        if (current) {
          const found = (res.items ?? []).find((x) => x.idVehTipoVehiculo === current.idVehTipoVehiculo) ?? null;
          this.selectedTipo.set(found);
          if (found) this.cargarAsignados(found.idVehTipoVehiculo);
        }
      },
      error: (err) => this.notify.error('No se pudieron cargar tipos', err?.message),
    });
  }

  seleccionarTipo(tipo: VehTipoVehiculo) {
    this.selectedTipo.set(tipo);
    this.cargarAsignados(tipo.idVehTipoVehiculo);
  }

  cargarAsignados(idVehTipoVehiculoFk: number) {
    this.repo.listarChecklistsVehiculo({ idVehTipoVehiculoFk }).subscribe({
      next: (res) => this.asignados.set(res.items ?? []),
      error: (err) => this.notify.error('No se pudieron cargar asignaciones', err?.message),
    });
  }

  nuevo() {
    this.editingId.set(null);
    this.form.reset({ nombreItem: '', categoria: 'GENERAL', orden: (this.checks().length || 0) + 1, obligatorio: true });
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editar(item: VehCheckList) {
    this.editingId.set(item.idVehVehiculoCheckList);
    this.form.reset({
      nombreItem: item.nombreItem || '',
      categoria: item.categoria || 'GENERAL',
      orden: item.orden ?? 1,
      obligatorio: this.toBoolean(item.obligatorio),
    });
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  async eliminar(item: VehCheckList) {
    const ok = await this.confirm.confirmDelete(item.nombreItem);
    if (!ok) return;
    this.repo.eliminarCheckList(item.idVehVehiculoCheckList).subscribe({
      next: () => {
        this.notify.success('Ítem eliminado', 'Se eliminó el ítem del checklist.');
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo eliminar', err?.message),
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'El nombre del ítem es obligatorio.');
      return;
    }
    const payload: VehCheckListGuardarRequest = {
      nombreItem: this.form.value.nombreItem?.trim() || '',
      categoria: this.form.value.categoria?.trim() || null,
      orden: Number(this.form.value.orden || 1),
      obligatorio: !!this.form.value.obligatorio,
    };
    this.saving.set(true);
    const request$ = this.editingId()
      ? this.repo.editarCheckList({ idVehVehiculoCheckList: this.editingId()!, cambios: payload })
      : this.repo.crearCheckList(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(this.editingId() ? 'Ítem actualizado' : 'Ítem creado', 'Checklist guardado correctamente.');
        this.drawerVisible.set(false);
        this.dirty.set(false);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo guardar checklist', err?.message),
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

  nuevaAsignacion() {
    if (!this.selectedTipo()) {
      this.notify.warn('Selecciona un tipo', 'Debes seleccionar un tipo de vehículo para asignar checklist.');
      return;
    }
    this.assignForm.reset({ idVehVehiculoCheckListFk: null });
    this.assignDrawerVisible.set(true);
    this.assignDirty.set(false);
  }

  submitAsignacion() {
    const tipo = this.selectedTipo();
    if (!tipo) {
      this.notify.warn('Selecciona un tipo', 'No hay tipo seleccionado.');
      return;
    }
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Debes seleccionar un ítem checklist.');
      return;
    }
    this.saving.set(true);
    this.repo.crearChecklistVehiculo({
      idVehTipoVehiculoFk: tipo.idVehTipoVehiculo,
      idVehVehiculoCheckListFk: Number(this.assignForm.value.idVehVehiculoCheckListFk),
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Asignación creada', 'El ítem fue asociado al tipo de vehículo.');
        this.assignDrawerVisible.set(false);
        this.assignDirty.set(false);
        this.cargarAsignados(tipo.idVehTipoVehiculo);
      },
      error: (err) => this.notify.error('No se pudo crear la asignación', err?.message),
    });
  }

  async eliminarAsignacion(item: VehCheckListVehiculo) {
    const ok = await this.confirm.confirmDelete(`la asignación #${item.idVehVehiculoCheckListVehiculo}`);
    if (!ok) return;
    this.repo.eliminarChecklistVehiculo(item.idVehVehiculoCheckListVehiculo).subscribe({
      next: () => {
        this.notify.success('Asignación eliminada', 'La relación fue eliminada correctamente.');
        if (this.selectedTipo()) this.cargarAsignados(this.selectedTipo()!.idVehTipoVehiculo);
      },
      error: (err) => this.notify.error('No se pudo eliminar asignación', err?.message),
    });
  }

  cerrarAsignacionDrawer = async () => {
    if (this.assignDirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.assignDrawerVisible.set(false);
    this.assignDirty.set(false);
  };

  nombreCheck(id?: number | null) {
    return this.checks().find((x) => x.idVehVehiculoCheckList === id)?.nombreItem || `Checklist #${id}`;
  }

  disponiblesParaAsignar() {
    const assignedIds = new Set(this.asignados().map((x) => x.idVehVehiculoCheckListFk));
    return this.checks().filter((x) => !assignedIds.has(x.idVehVehiculoCheckList));
  }

  esObligatorio(value: unknown) {
    return this.toBoolean(value);
  }

  private toBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
  }
}
