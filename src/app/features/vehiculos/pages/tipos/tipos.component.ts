import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  VehArticuloCatalogo,
  VehCheckList,
  VehCheckListVehiculo,
  VehTipoVehiculo,
  VehTipoVehiculoGuardarRequest,
  VehTipoVehiculoVista,
  VehTipoVehiculoVistaGuardarRequest,
} from '../../data-access/vehiculos.models';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type TiposPanelTab = 'edicion' | 'vistas' | 'checklists';
type ConfirmSeverity = 'danger' | 'warning' | 'info';

type AtributoRowForm = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

type VistaAtributoRowForm = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

@Component({
  selector: 'app-vehiculos-tipos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    TagModule,
  ],
  templateUrl: './tipos.component.html',
  styleUrl: './tipos.component.scss',
})
export class VehiculosTiposComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private router = inject(Router);

  readonly VEHICLE_TYPE_OPTIONS = [
    'AUTO',
    'MOTO',
    'TRICICLO_ELECTRICO',
    'BICICLETA_ELECTRICA',
    'CAMIONETA',
    'CAMION',
    'SUV',
    'BUS',
    'FURGON',
    'OTRO',
  ];

  readonly VISTA_OPTIONS = [
    'FRENTE',
    'ATRAS',
    'LATERAL_IZQ',
    'LATERAL_DER',
    'SUPERIOR',
    'INFERIOR',
    'INTERIOR',
    'TABLERO',
    'MOTOR',
    'BAUL',
    'BATERIA',
    'OTRA',
  ];

  readonly q = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly tipos = signal<VehTipoVehiculo[]>([]);
  readonly vistas = signal<VehTipoVehiculoVista[]>([]);
  readonly checklistCatalogo = signal<VehCheckList[]>([]);
  readonly checklistAsignado = signal<VehCheckListVehiculo[]>([]);
  readonly articulos = signal<VehArticuloCatalogo[]>([]);

  readonly selected = signal<VehTipoVehiculo | null>(null);
  readonly selectedVista = signal<VehTipoVehiculoVista | null>(null);
  readonly mode = signal<'crear' | 'editar'>('crear');
  readonly activeTab = signal<TiposPanelTab>('edicion');

  readonly formDirty = signal(false);
  readonly vistaDirty = signal(false);
  readonly hasPendingChanges = computed(() => this.formDirty() || this.vistaDirty());

  readonly currentTitle = computed(() =>
    this.mode() === 'crear' ? 'Nuevo tipo de vehículo' : 'Editar tipo de vehículo'
  );

  readonly currentSubtitle = computed(() => {
    if (this.mode() === 'crear') {
      return 'Configura el tipo, artículo, atributos, vistas y checklist asociado.';
    }

    const current = this.selected();
    return current
      ? `Editando: ${current.tipoVehiculo || `Tipo #${current.idVehTipoVehiculo}`}`
      : 'Editar tipo de vehículo';
  });

  readonly articuloQuery = signal('');
  readonly articuloPanelOpen = signal(false);
  readonly articuloLoading = signal(false);

  readonly filteredArticulos = computed(() => {
    const query = this.articuloQuery().trim().toLowerCase();
    const source = this.articulos();

    if (!query) {
      return source.slice(0, 100);
    }

    return source
      .filter((item) => {
        const codigo = String(item.artcod || '').toLowerCase();
        const nombre = String(item.articulo || '').toLowerCase();
        return codigo.includes(query) || nombre.includes(query);
      })
      .slice(0, 200);
  });

  readonly selectedArticulo = computed(() => {
    const art = this.form.controls.art.value;
    if (art == null) return null;
    return this.articulos().find((x) => x.idActInventario === art) ?? null;
  });

  readonly checklistDisponibles = computed(() => {
    const assignedIds = new Set(
      this.checklistAsignado().map((x) => x.idVehVehiculoCheckListFk)
    );
    return this.checklistCatalogo()
      .filter((x) => !assignedIds.has(x.idVehVehiculoCheckList))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  });

  readonly checklistSearch = signal('');
  readonly checklistDisponiblesFiltrados = computed(() => {
    const query = this.checklistSearch().trim().toLowerCase();
    const source = this.checklistDisponibles();

    if (!query) return source;

    return source.filter((item) => {
      const nombre = String(item.nombreItem || '').toLowerCase();
      const categoria = String(item.categoria || '').toLowerCase();
      return nombre.includes(query) || categoria.includes(query);
    });
  });

  readonly selectedChecklistToAssign = signal<number | null>(null);

  readonly vistaDialogVisible = signal(false);
  readonly vistaDialogMode = signal<'crear' | 'editar'>('crear');
  readonly vistaStructureBase64 = signal<string | null>(null);
  readonly vistaStructurePreview = signal<string | null>(null);

  private initialMainSnapshot = '';
  private initialVistaSnapshot = '';

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
    art: this.fb.control<number | null>(null),
    tipoVehiculo: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    atributos: this.fb.array<AtributoRowForm>([]),
  });

  readonly vistaForm = this.fb.group({
    idVehTipoVehiculoVista: this.fb.control<number | null>(null),
    vista: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    orden: this.fb.control<number>(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    observaciones: this.fb.control<string>('', { nonNullable: true }),
    atributos: this.fb.array<VistaAtributoRowForm>([]),
  });

  constructor() {
    this.ensureAtLeastOneAtributoRow();
    this.ensureAtLeastOneVistaAtributoRow();

    this.form.valueChanges.subscribe(() => {
      this.updateMainDirtyState();
    });

    this.vistaForm.valueChanges.subscribe(() => {
      this.updateVistaDirtyState();
    });

    this.cargarTodo();
    this.cargarArticulos();
    this.cargarChecklistCatalogo();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasPendingChanges()) {
      return true;
    }

    return this.requestDiscardConfirmation();
  }

  get atributosFormArray(): FormArray<AtributoRowForm> {
    return this.form.controls.atributos;
  }

  get vistaAtributosFormArray(): FormArray<VistaAtributoRowForm> {
    return this.vistaForm.controls.atributos;
  }

  setTab(tab: TiposPanelTab): void {
    this.activeTab.set(tab);
  }

  cargarTodo(): void {
    this.cargarTipos();
  }

  cargarTipos(): void {
    this.loading.set(true);
    this.error.set(null);

    this.repo
      .listarTipos(this.q().trim(), 0, 500, true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.tipos.set(items);

          const current = this.selected();
          if (!current) return;

          const updated =
            items.find((x) => x.idVehTipoVehiculo === current.idVehTipoVehiculo) ?? null;

          this.selected.set(updated);

          if (!updated) {
            this.mode.set('crear');
            this.activeTab.set('edicion');
            this.vistas.set([]);
            this.checklistAsignado.set([]);
            this.selectedVista.set(null);
            this.resetMainFormForNew();
          } else {
            this.populateMainForm(updated);
            this.cargarVistas(updated.idVehTipoVehiculo);
            this.cargarChecklistAsignado(updated.idVehTipoVehiculo);
          }
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar tipos de vehículo.');
        },
      });
  }

  cargarArticulos(): void {
    this.articuloLoading.set(true);

    this.repo
      .listarArticulos('', 0, 500, true)
      .pipe(finalize(() => this.articuloLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.articulos.set(res.items ?? []);
          this.updateMainDirtyState();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar el catálogo de artículos.');
        },
      });
  }

  cargarChecklistCatalogo(): void {
    this.repo.listarChecklists().subscribe({
      next: (res) => {
        this.checklistCatalogo.set(res.items ?? []);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo cargar el catálogo de checklist.');
      },
    });
  }

  cargarVistas(idVehTipoVehiculoFk: number): void {
    this.repo.listarVistas({ idVehTipoVehiculoFk }).subscribe({
      next: (res) => {
        const items = res.items ?? [];
        this.vistas.set(items);

        const currentVista = this.selectedVista();
        if (!currentVista) {
          this.selectedVista.set(items[0] ?? null);
          return;
        }

        const updated =
          items.find((x) => x.idVehTipoVehiculoVista === currentVista.idVehTipoVehiculoVista) ??
          null;

        this.selectedVista.set(updated ?? items[0] ?? null);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo cargar las vistas del tipo.');
      },
    });
  }

  cargarChecklistAsignado(idVehTipoVehiculoFk: number): void {
    this.repo.listarChecklistsVehiculo({ idVehTipoVehiculoFk }).subscribe({
      next: (res) => {
        this.checklistAsignado.set(res.items ?? []);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudo cargar checklist asignado al tipo.');
      },
    });
  }

  onSearchEnter(): void {
    this.cargarTipos();
  }

  clearSearch(): void {
    if (!this.q()) return;
    this.q.set('');
    this.cargarTipos();
  }

  irADashboard(): void {
    this.runWithDiscardGuard(() => {
      this.router.navigate(['/app/vehiculos/dashboard']);
    });
  }

  nuevoTipo(): void {
    this.runWithDiscardGuard(() => {
      this.selected.set(null);
      this.selectedVista.set(null);
      this.mode.set('crear');
      this.activeTab.set('edicion');
      this.vistas.set([]);
      this.checklistAsignado.set([]);
      this.success.set(null);
      this.error.set(null);
      this.resetMainFormForNew();
    });
  }

  seleccionarTipo(item: VehTipoVehiculo): void {
    if (
      this.selected()?.idVehTipoVehiculo === item.idVehTipoVehiculo &&
      this.mode() === 'editar'
    ) {
      return;
    }

    this.runWithDiscardGuard(() => {
      this.selected.set(item);
      this.mode.set('editar');
      this.activeTab.set('edicion');
      this.success.set(null);
      this.error.set(null);
      this.populateMainForm(item);
      this.cargarVistas(item.idVehTipoVehiculo);
      this.cargarChecklistAsignado(item.idVehTipoVehiculo);
    });
  }

  guardarTipo(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa los campos obligatorios del tipo.');
      this.success.set(null);
      return;
    }

    const payload: VehTipoVehiculoGuardarRequest = {
      art: this.form.controls.art.value,
      tipoVehiculo: this.form.controls.tipoVehiculo.value?.trim() || null,
      atributos: this.buildAtributosObject(this.atributosFormArray),
    };

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    if (this.mode() === 'crear') {
      this.repo
        .crearTipo(payload)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (res: any) => {
            const newId = res?.idVehTipoVehiculo ?? res?.data?.idVehTipoVehiculo ?? null;

            this.success.set('Tipo de vehículo creado.');
            this.formDirty.set(false);
            this.cargarTipos();

            if (newId) {
              const optimistic: VehTipoVehiculo = {
                idVehTipoVehiculo: Number(newId),
                art: payload.art ?? null,
                tipoVehiculo: payload.tipoVehiculo ?? null,
                atributos: payload.atributos ?? null,
              };

              this.selected.set(optimistic);
              this.mode.set('editar');
              this.activeTab.set('vistas');
              this.populateMainForm(optimistic);
            } else {
              this.mode.set('crear');
              this.activeTab.set('edicion');
              this.refreshMainSnapshot();
            }
          },
          error: (err) => {
            console.error(err);
            this.error.set(err?.message || 'No se pudo crear el tipo de vehículo.');
          },
        });

      return;
    }

    const current = this.selected();
    if (!current) {
      this.saving.set(false);
      this.error.set('No hay un tipo seleccionado.');
      return;
    }

    this.repo
      .editarTipo({
        idVehTipoVehiculo: current.idVehTipoVehiculo,
        cambios: payload,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Tipo de vehículo actualizado.');
          const updatedCurrent: VehTipoVehiculo = {
            ...current,
            art: payload.art ?? null,
            tipoVehiculo: payload.tipoVehiculo ?? null,
            atributos: payload.atributos ?? null,
          };
          this.selected.set(updatedCurrent);
          this.populateMainForm(updatedCurrent);
          this.cargarTipos();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo actualizar el tipo de vehículo.');
        },
      });
  }

  eliminarTipoActual(): void {
    const current = this.selected();
    if (!current) return;

    this.openConfirm(
      {
        title: 'Eliminar tipo de vehículo',
        message: `Se eliminará "${current.tipoVehiculo || `Tipo #${current.idVehTipoVehiculo}`}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo
          .eliminarTipo(current.idVehTipoVehiculo)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Tipo de vehículo eliminado.');
              this.selected.set(null);
              this.selectedVista.set(null);
              this.vistas.set([]);
              this.checklistAsignado.set([]);
              this.mode.set('crear');
              this.activeTab.set('edicion');
              this.formDirty.set(false);
              this.vistaDirty.set(false);
              this.resetMainFormForNew();
              this.cargarTipos();
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar el tipo de vehículo.');
            },
          });
      }
    );
  }

  onMainFormCancel(): void {
    if (!this.formDirty()) {
      if (this.mode() === 'editar' && this.selected()) {
        this.populateMainForm(this.selected()!);
      } else {
        this.nuevoTipo();
      }
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        if (this.mode() === 'editar' && this.selected()) {
          this.populateMainForm(this.selected()!);
        } else {
          this.resetMainFormForNew();
        }
      }
    );
  }

  addAtributoRow(key = '', value = ''): void {
    this.atributosFormArray.push(
      this.fb.group({
        key: this.fb.control(key, { nonNullable: true }),
        value: this.fb.control(value, { nonNullable: true }),
      })
    );
    this.updateMainDirtyState();
  }

  removeAtributoRow(index: number): void {
    if (this.atributosFormArray.length === 1) {
      this.atributosFormArray.at(0).patchValue({ key: '', value: '' });
      this.updateMainDirtyState();
      return;
    }

    this.atributosFormArray.removeAt(index);
    this.updateMainDirtyState();
  }

  addVistaAtributoRow(key = '', value = ''): void {
    this.vistaAtributosFormArray.push(
      this.fb.group({
        key: this.fb.control(key, { nonNullable: true }),
        value: this.fb.control(value, { nonNullable: true }),
      })
    );
    this.updateVistaDirtyState();
  }

  removeVistaAtributoRow(index: number): void {
    if (this.vistaAtributosFormArray.length === 1) {
      this.vistaAtributosFormArray.at(0).patchValue({ key: '', value: '' });
      this.updateVistaDirtyState();
      return;
    }

    this.vistaAtributosFormArray.removeAt(index);
    this.updateVistaDirtyState();
  }

  openArticuloPanel(): void {
    this.articuloQuery.set('');
    this.articuloPanelOpen.set(true);
  }

  closeArticuloPanel(): void {
    this.articuloPanelOpen.set(false);
    this.articuloQuery.set('');
  }

  clearArticuloSelection(): void {
    if (this.form.controls.art.value == null) return;
    this.form.controls.art.setValue(null);
    this.updateMainDirtyState();
  }

  seleccionarArticulo(item: VehArticuloCatalogo): void {
    const current = this.form.controls.art.value;
    if (current === item.idActInventario) {
      this.closeArticuloPanel();
      return;
    }

    this.form.controls.art.setValue(item.idActInventario);
    this.closeArticuloPanel();
    this.updateMainDirtyState();
  }

  checklistNombre(id: number): string {
    return (
      this.checklistCatalogo().find((x) => x.idVehVehiculoCheckList === id)?.nombreItem ||
      `Checklist #${id}`
    );
  }

  checklistCategoria(id: number): string {
    return (
      this.checklistCatalogo().find((x) => x.idVehVehiculoCheckList === id)?.categoria ||
      'GENERAL'
    );
  }

  agregarChecklistAlTipo(): void {
    const current = this.selected();
    const checklistId = this.selectedChecklistToAssign();

    if (!current) {
      this.error.set('Debes guardar o seleccionar un tipo antes de asignar checklist.');
      return;
    }

    if (!checklistId) {
      this.error.set('Selecciona un checklist disponible para agregar.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.repo
      .crearChecklistVehiculo({
        idVehTipoVehiculoFk: current.idVehTipoVehiculo,
        idVehVehiculoCheckListFk: checklistId,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Checklist asignado al tipo.');
          this.selectedChecklistToAssign.set(null);
          this.cargarChecklistAsignado(current.idVehTipoVehiculo);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo asignar el checklist al tipo.');
        },
      });
  }

  quitarChecklistDelTipo(rel: VehCheckListVehiculo): void {
    const label = this.checklistNombre(rel.idVehVehiculoCheckListFk);

    this.openConfirm(
      {
        title: 'Quitar checklist del tipo',
        message: `Se quitará "${label}" de este tipo de vehículo.\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Quitar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        const current = this.selected();
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo
          .eliminarChecklistVehiculo(rel.idVehVehiculoCheckListVehiculo)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Checklist quitado del tipo.');
              if (current) {
                this.cargarChecklistAsignado(current.idVehTipoVehiculo);
              }
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo quitar el checklist del tipo.');
            },
          });
      }
    );
  }

  nuevaVista(): void {
    const selected = this.selected();
    if (!selected) {
      this.error.set('Primero guarda o selecciona un tipo para agregar vistas.');
      return;
    }

    this.vistaDialogMode.set('crear');
    this.vistaDialogVisible.set(true);
    this.selectedVista.set(null);
    this.resetVistaFormForNew();
  }

  editarVista(vista: VehTipoVehiculoVista): void {
    this.vistaDialogMode.set('editar');
    this.vistaDialogVisible.set(true);
    this.selectedVista.set(vista);
    this.populateVistaForm(vista);
  }

  seleccionarVista(vista: VehTipoVehiculoVista): void {
    this.selectedVista.set(vista);
  }

  guardarVista(): void {
    const selected = this.selected();
    if (!selected) {
      this.error.set('No hay un tipo seleccionado para guardar la vista.');
      return;
    }

    if (this.vistaForm.invalid) {
      this.vistaForm.markAllAsTouched();
      this.error.set('Completa los campos obligatorios de la vista.');
      return;
    }

    const payload: VehTipoVehiculoVistaGuardarRequest = {
      idVehTipoVehiculoFk: selected.idVehTipoVehiculo,
      vista: this.vistaForm.controls.vista.value?.trim() || null,
      orden: Number(this.vistaForm.controls.orden.value || 1),
      observaciones: this.vistaForm.controls.observaciones.value?.trim() || null,
      estructura:
        this.vistaStructureBase64() !== null ? this.vistaStructureBase64() || null : undefined,
      atributos: this.buildAtributosObject(this.vistaAtributosFormArray),
    };

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    if (this.vistaDialogMode() === 'crear') {
      this.repo
        .crearVista(payload)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.success.set('Vista creada.');
            this.vistaDialogVisible.set(false);
            this.resetVistaFormForNew();
            this.cargarVistas(selected.idVehTipoVehiculo);
          },
          error: (err) => {
            console.error(err);
            this.error.set(err?.message || 'No se pudo crear la vista.');
          },
        });

      return;
    }

    const currentVista = this.selectedVista();
    if (!currentVista) {
      this.saving.set(false);
      this.error.set('No hay una vista seleccionada para editar.');
      return;
    }

    this.repo
      .editarVista({
        idVehTipoVehiculoVista: currentVista.idVehTipoVehiculoVista,
        cambios: payload,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Vista actualizada.');
          this.vistaDialogVisible.set(false);
          this.populateVistaForm({
            ...currentVista,
            ...payload,
            idVehTipoVehiculoVista: currentVista.idVehTipoVehiculoVista,
          } as VehTipoVehiculoVista);
          this.cargarVistas(selected.idVehTipoVehiculo);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo actualizar la vista.');
        },
      });
  }

  eliminarVista(vista: VehTipoVehiculoVista): void {
    this.openConfirm(
      {
        title: 'Eliminar vista',
        message: `Se eliminará "${vista.vista || `Vista #${vista.idVehTipoVehiculoVista}`}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        const selected = this.selected();
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo
          .eliminarVista(vista.idVehTipoVehiculoVista)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Vista eliminada.');
              if (selected) {
                this.cargarVistas(selected.idVehTipoVehiculo);
              }
              if (
                this.selectedVista()?.idVehTipoVehiculoVista === vista.idVehTipoVehiculoVista
              ) {
                this.selectedVista.set(null);
              }
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar la vista.');
            },
          });
      }
    );
  }

  onVistaCancel(): void {
    if (!this.vistaDirty()) {
      this.vistaDialogVisible.set(false);
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar en la vista.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        if (this.vistaDialogMode() === 'editar' && this.selectedVista()) {
          this.populateVistaForm(this.selectedVista()!);
        } else {
          this.resetVistaFormForNew();
        }
        this.vistaDialogVisible.set(false);
      }
    );
  }

  onVistaStructureSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error.set('Selecciona una imagen válida para la vista.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      this.vistaStructureBase64.set(base64 || '');
      this.vistaStructurePreview.set(dataUrl || null);
      this.updateVistaDirtyState();
    };
    reader.readAsDataURL(file);
  }

  limpiarVistaStructure(): void {
    const alreadyEmpty =
      (this.vistaStructureBase64() ?? null) === '' && (this.vistaStructurePreview() ?? null) === null;

    if (alreadyEmpty) return;

    this.vistaStructureBase64.set('');
    this.vistaStructurePreview.set(null);
    this.updateVistaDirtyState();
  }

  resolveBinarySrc(binary?: string | null): string | null {
    if (!binary) return null;

    const value = String(binary).trim();
    if (!value) return null;

    if (
      value.startsWith('data:') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('blob:')
    ) {
      return value;
    }

    return `data:${this.guessMimeType(value)};base64,${value}`;
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
          this.formDirty.set(false);
          this.vistaDirty.set(false);
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
    if (!this.hasPendingChanges()) {
      action();
      return;
    }

    this.openConfirm(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.formDirty.set(false);
        this.vistaDirty.set(false);
        action();
      }
    );
  }

  private resetMainFormForNew(): void {
    this.form.reset({
      art: null,
      tipoVehiculo: '',
    });

    this.atributosFormArray.clear();
    this.atributosFormArray.push(this.createAtributoRow('', ''));

    this.articuloQuery.set('');
    this.articuloPanelOpen.set(false);

    this.refreshMainSnapshot();
  }

  private populateMainForm(item: VehTipoVehiculo): void {
    this.form.reset({
      art: item.art ?? null,
      tipoVehiculo: item.tipoVehiculo ?? '',
    });

    this.atributosFormArray.clear();

    const entries = Object.entries(item.atributos ?? {});
    if (entries.length === 0) {
      this.atributosFormArray.push(this.createAtributoRow('', ''));
    } else {
      for (const [key, value] of entries) {
        this.atributosFormArray.push(this.createAtributoRow(key, this.stringifyAtributoValue(value)));
      }
    }

    this.articuloQuery.set('');
    this.articuloPanelOpen.set(false);

    this.refreshMainSnapshot();
  }

  private resetVistaFormForNew(): void {
    this.vistaForm.reset({
      idVehTipoVehiculoVista: null,
      vista: '',
      orden: (this.vistas().length || 0) + 1,
      observaciones: '',
    });

    this.vistaAtributosFormArray.clear();
    this.vistaAtributosFormArray.push(this.createVistaAtributoRow('', ''));

    this.vistaStructureBase64.set(null);
    this.vistaStructurePreview.set(null);

    this.refreshVistaSnapshot();
  }

  private populateVistaForm(vista: VehTipoVehiculoVista): void {
    this.vistaForm.reset({
      idVehTipoVehiculoVista: vista.idVehTipoVehiculoVista,
      vista: vista.vista ?? '',
      orden: vista.orden ?? 1,
      observaciones: vista.observaciones ?? '',
    });

    this.vistaAtributosFormArray.clear();

    const entries = Object.entries(vista.atributos ?? {});
    if (entries.length === 0) {
      this.vistaAtributosFormArray.push(this.createVistaAtributoRow('', ''));
    } else {
      for (const [key, value] of entries) {
        this.vistaAtributosFormArray.push(
          this.createVistaAtributoRow(key, this.stringifyAtributoValue(value))
        );
      }
    }

    this.vistaStructureBase64.set(null);
    this.vistaStructurePreview.set(this.resolveBinarySrc(vista.estructura));

    this.refreshVistaSnapshot();
  }

  private createAtributoRow(key = '', value = ''): AtributoRowForm {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true }),
    });
  }

  private createVistaAtributoRow(key = '', value = ''): VistaAtributoRowForm {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true }),
    });
  }

  private ensureAtLeastOneAtributoRow(): void {
    if (this.atributosFormArray.length === 0) {
      this.atributosFormArray.push(this.createAtributoRow('', ''));
    }
  }

  private ensureAtLeastOneVistaAtributoRow(): void {
    if (this.vistaAtributosFormArray.length === 0) {
      this.vistaAtributosFormArray.push(this.createVistaAtributoRow('', ''));
    }
  }

  private buildAtributosObject(
    formArray: FormArray<AtributoRowForm> | FormArray<VistaAtributoRowForm>
  ): Record<string, unknown> {
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

    if (!Number.isNaN(Number(trimmed)) && trimmed !== '') {
      return Number(trimmed);
    }

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

  private guessMimeType(base64: string): string {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWw')) return 'image/svg+xml';
    return 'image/png';
  }

  private createMainSnapshot(): string {
    return JSON.stringify({
      art: this.form.controls.art.value ?? null,
      tipoVehiculo: (this.form.controls.tipoVehiculo.value ?? '').trim(),
      atributos: this.buildAtributosObject(this.atributosFormArray),
    });
  }

  private createVistaSnapshot(): string {
    return JSON.stringify({
      idVehTipoVehiculoVista: this.vistaForm.controls.idVehTipoVehiculoVista.value ?? null,
      vista: (this.vistaForm.controls.vista.value ?? '').trim(),
      orden: Number(this.vistaForm.controls.orden.value || 1),
      observaciones: (this.vistaForm.controls.observaciones.value ?? '').trim(),
      atributos: this.buildAtributosObject(this.vistaAtributosFormArray),
      estructura: this.vistaStructureBase64(),
    });
  }

  private refreshMainSnapshot(): void {
    this.initialMainSnapshot = this.createMainSnapshot();
    this.formDirty.set(false);
  }

  private refreshVistaSnapshot(): void {
    this.initialVistaSnapshot = this.createVistaSnapshot();
    this.vistaDirty.set(false);
  }

  private updateMainDirtyState(): void {
    this.formDirty.set(this.createMainSnapshot() !== this.initialMainSnapshot);
  }

  private updateVistaDirtyState(): void {
    this.vistaDirty.set(this.createVistaSnapshot() !== this.initialVistaSnapshot);
  }
}