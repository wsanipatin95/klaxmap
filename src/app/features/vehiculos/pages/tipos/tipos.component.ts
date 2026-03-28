import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosWorkbenchShellComponent } from '../../components/workbench-shell/workbench-shell.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  VehTipoVehiculo,
  VehTipoVehiculoGuardarRequest,
  VehTipoVehiculoVista,
  VehTipoVehiculoVistaGuardarRequest,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-vehiculos-tipos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    ConfirmDialogModule,
    VehiculosPageHeaderComponent,
    VehiculosFormDrawerComponent,
    VehiculosEmptyStateComponent,
    VehiculosWorkbenchShellComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './tipos.component.html',
  styleUrl: './tipos.component.scss',
})
export class VehiculosTiposComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);
  private destroyRef = inject(DestroyRef);

  q = '';
  loading = signal(false);
  saving = signal(false);
  tipos = signal<VehTipoVehiculo[]>([]);
  vistas = signal<VehTipoVehiculoVista[]>([]);
  selected = signal<VehTipoVehiculo | null>(null);
  drawerVisible = signal(false);
  vistaDrawerVisible = signal(false);
  dirty = signal(false);
  vistaDirty = signal(false);
  editingId = signal<number | null>(null);
  editingVistaId = signal<number | null>(null);

  form = this.fb.group({
    art: [null as number | null],
    tipoVehiculo: ['', Validators.required],
    atributosJson: ['{}'],
  });

  vistaForm = this.fb.group({
    vista: ['', Validators.required],
    orden: [1],
    observaciones: [''],
    atributosJson: ['{}'],
  });

  constructor() {
    this.cargar();
    this.form.valueChanges.subscribe(() => this.dirty.set(true));
    this.vistaForm.valueChanges.subscribe(() => this.vistaDirty.set(true));
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    if (this.vistaDrawerVisible() && this.vistaDirty()) return this.confirm.confirmDiscard();
    return true;
  }

  cargar() {
    this.loading.set(true);
    this.repo.listarTipos(this.q, 0, 200, true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.tipos.set(res.items ?? []);
          const current = this.selected();
          if (current) {
            const selected = (res.items ?? []).find((x) => x.idVehTipoVehiculo === current.idVehTipoVehiculo) ?? null;
            this.selected.set(selected);
            if (selected) this.cargarVistas(selected.idVehTipoVehiculo);
          }
        },
        error: (err) => this.notify.error('No se pudo cargar tipos de vehículo', err?.message),
      });
  }

  cargarVistas(idVehTipoVehiculoFk: number) {
    this.repo.listarVistas({ idVehTipoVehiculoFk }).subscribe({
      next: (res) => this.vistas.set(res.items ?? []),
      error: (err) => this.notify.error('No se pudo cargar vistas', err?.message),
    });
  }

  seleccionar(item: VehTipoVehiculo) {
    this.selected.set(item);
    this.cargarVistas(item.idVehTipoVehiculo);
  }

  nuevo() {
    this.editingId.set(null);
    this.form.reset({ art: null, tipoVehiculo: '', atributosJson: '{}' });
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editar(item: VehTipoVehiculo) {
    this.editingId.set(item.idVehTipoVehiculo);
    this.form.reset({
      art: item.art ?? null,
      tipoVehiculo: item.tipoVehiculo ?? '',
      atributosJson: JSON.stringify(item.atributos ?? {}, null, 2),
    });
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  async eliminar(item: VehTipoVehiculo) {
    const ok = await this.confirm.confirmDelete(item.tipoVehiculo || `el tipo #${item.idVehTipoVehiculo}`);
    if (!ok) return;
    this.repo.eliminarTipo(item.idVehTipoVehiculo).subscribe({
      next: () => {
        this.notify.success('Tipo eliminado', 'El registro fue eliminado correctamente.');
        if (this.selected()?.idVehTipoVehiculo === item.idVehTipoVehiculo) {
          this.selected.set(null);
          this.vistas.set([]);
        }
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo eliminar tipo', err?.message),
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

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Ingresa el nombre del tipo.');
      return;
    }
    const payload: VehTipoVehiculoGuardarRequest = {
      art: this.form.value.art ?? null,
      tipoVehiculo: this.form.value.tipoVehiculo?.trim() || null,
      atributos: this.parseJson(this.form.value.atributosJson),
    };
    this.saving.set(true);
    const request$ = this.editingId()
      ? this.repo.editarTipo({ idVehTipoVehiculo: this.editingId()!, cambios: payload })
      : this.repo.crearTipo(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(this.editingId() ? 'Tipo actualizado' : 'Tipo creado', 'Registro guardado correctamente.');
        this.drawerVisible.set(false);
        this.dirty.set(false);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo guardar tipo', err?.message),
    });
  }

  nuevaVista() {
    if (!this.selected()) {
      this.notify.warn('Selecciona un tipo', 'Debes seleccionar un tipo antes de crear vistas.');
      return;
    }
    this.editingVistaId.set(null);
    this.vistaForm.reset({ vista: '', orden: (this.vistas().length || 0) + 1, observaciones: '', atributosJson: '{}' });
    this.vistaDrawerVisible.set(true);
    this.vistaDirty.set(false);
  }

  editarVista(item: VehTipoVehiculoVista) {
    this.editingVistaId.set(item.idVehTipoVehiculoVista);
    this.vistaForm.reset({
      vista: item.vista ?? '',
      orden: item.orden ?? 1,
      observaciones: item.observaciones ?? '',
      atributosJson: JSON.stringify(item.atributos ?? {}, null, 2),
    });
    this.vistaDrawerVisible.set(true);
    this.vistaDirty.set(false);
  }

  async eliminarVista(item: VehTipoVehiculoVista) {
    const ok = await this.confirm.confirmDelete(item.vista || `la vista #${item.idVehTipoVehiculoVista}`);
    if (!ok) return;
    this.repo.eliminarVista(item.idVehTipoVehiculoVista).subscribe({
      next: () => {
        this.notify.success('Vista eliminada', 'La vista fue eliminada correctamente.');
        if (this.selected()) this.cargarVistas(this.selected()!.idVehTipoVehiculo);
      },
      error: (err) => this.notify.error('No se pudo eliminar vista', err?.message),
    });
  }

  cerrarVistaDrawer = async () => {
    if (this.vistaDirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.vistaDrawerVisible.set(false);
    this.vistaDirty.set(false);
  };

  submitVista() {
    const selected = this.selected();
    if (!selected) {
      this.notify.warn('Selecciona un tipo', 'Debes seleccionar un tipo antes de guardar una vista.');
      return;
    }
    if (this.vistaForm.invalid) {
      this.vistaForm.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'La vista necesita un nombre.');
      return;
    }
    const payload: VehTipoVehiculoVistaGuardarRequest = {
      idVehTipoVehiculoFk: selected.idVehTipoVehiculo,
      vista: this.vistaForm.value.vista?.trim() || null,
      orden: Number(this.vistaForm.value.orden || 1),
      observaciones: this.vistaForm.value.observaciones?.trim() || null,
      atributos: this.parseJson(this.vistaForm.value.atributosJson),
    };
    this.saving.set(true);
    const request$ = this.editingVistaId()
      ? this.repo.editarVista({ idVehTipoVehiculoVista: this.editingVistaId()!, cambios: payload })
      : this.repo.crearVista(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(this.editingVistaId() ? 'Vista actualizada' : 'Vista creada', 'La vista fue guardada correctamente.');
        this.vistaDrawerVisible.set(false);
        this.vistaDirty.set(false);
        this.cargarVistas(selected.idVehTipoVehiculo);
      },
      error: (err) => this.notify.error('No se pudo guardar vista', err?.message),
    });
  }

  private parseJson(value?: string | null) {
    if (!value || !value.trim()) return {};
    try { return JSON.parse(value); } catch { return {}; }
  }
}
