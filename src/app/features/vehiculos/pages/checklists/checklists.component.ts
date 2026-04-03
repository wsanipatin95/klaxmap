import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  VehCheckList,
  VehCheckListGuardarRequest,
  VehCheckListVehiculo,
  VehTipoVehiculo,
} from '../../data-access/vehiculos.models';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type ChecklistPanelTab = 'edicion' | 'asignaciones';
type ConfirmSeverity = 'danger' | 'warning' | 'info';

@Component({
  selector: 'app-vehiculos-checklists',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
  ],
  templateUrl: './checklists.component.html',
  styleUrl: './checklists.component.scss',
})
export class VehiculosChecklistsComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private router = inject(Router);

  readonly q = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly checks = signal<VehCheckList[]>([]);
  readonly tipos = signal<VehTipoVehiculo[]>([]);
  readonly asignaciones = signal<VehCheckListVehiculo[]>([]);

  readonly selected = signal<VehCheckList | null>(null);
  readonly selectedRelacion = signal<VehCheckListVehiculo | null>(null);

  readonly mode = signal<'crear' | 'editar'>('crear');
  readonly activeTab = signal<ChecklistPanelTab>('edicion');

  readonly formDirty = signal(false);
  readonly assignDirty = signal(false);

  readonly currentTitle = computed(() =>
    this.mode() === 'crear' ? 'Nuevo ítem checklist' : 'Editar ítem checklist'
  );

  readonly currentSubtitle = computed(() => {
    if (this.mode() === 'crear') {
      return 'Completa los datos base del catálogo.';
    }

    const current = this.selected();
    return current
      ? `Editando: ${current.nombreItem}`
      : 'Editar ítem checklist';
  });

  readonly hasPendingChanges = computed(() =>
    this.formDirty() || this.assignDirty()
  );

  readonly tiposDisponiblesParaAsignar = computed(() => {
    const used = new Set(this.asignaciones().map((x) => x.idVehTipoVehiculoFk));
    return this.tipos().filter((tipo) => !used.has(tipo.idVehTipoVehiculo));
  });

  form = this.fb.group({
    nombreItem: ['', Validators.required],
    categoria: ['GENERAL'],
    orden: [1],
    obligatorio: [true],
  });

  assignForm = this.fb.group({
    idVehTipoVehiculoFk: [null as number | null, Validators.required],
  });

  private suppressFormDirty = false;
  private suppressAssignDirty = false;

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

  constructor() {
    this.form.valueChanges.subscribe(() => {
      if (!this.suppressFormDirty) {
        this.formDirty.set(true);
      }
    });

    this.assignForm.valueChanges.subscribe(() => {
      if (!this.suppressAssignDirty) {
        this.assignDirty.set(true);
      }
    });

    this.resetMainFormForNew();
    this.resetAssignForm();
    this.cargarTodo();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.hasPendingChanges()) {
      return true;
    }

    return this.requestDiscardConfirmation();
  }

  setTab(tab: ChecklistPanelTab) {
    this.activeTab.set(tab);
  }

  cargarTodo() {
    this.cargarChecks();
    this.cargarTipos();
  }

  cargarChecks() {
    this.loading.set(true);
    this.error.set(null);

    this.repo.listarChecklists({
      q: this.q().trim() || undefined,
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.checks.set(items);

          const current = this.selected();
          if (!current) {
            return;
          }

          const updated =
            items.find((x) => x.idVehVehiculoCheckList === current.idVehVehiculoCheckList) ?? null;

          this.selected.set(updated);

          if (!updated) {
            this.mode.set('crear');
            this.activeTab.set('edicion');
            this.asignaciones.set([]);
            this.selectedRelacion.set(null);
            this.resetMainFormForNew();
            this.resetAssignForm();
          } else {
            this.populateMainForm(updated);
            this.cargarAsignaciones(updated.idVehVehiculoCheckList);
          }
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar checklist.');
        },
      });
  }

  cargarTipos() {
    this.repo.listarTipos('', 0, 100, false).subscribe({
      next: (res) => {
        this.tipos.set(res.items ?? []);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudieron cargar tipos de vehículo.');
      },
    });
  }

  cargarAsignaciones(idVehVehiculoCheckListFk: number) {
    this.repo.listarChecklistsVehiculo({
      idVehVehiculoCheckListFk,
    }).subscribe({
      next: (res) => {
        const items = res.items ?? [];
        this.asignaciones.set(items);

        const currentRel = this.selectedRelacion();
        if (!currentRel) {
          return;
        }

        const updated =
          items.find(
            (x) =>
              x.idVehVehiculoCheckListVehiculo === currentRel.idVehVehiculoCheckListVehiculo
          ) ?? null;

        this.selectedRelacion.set(updated);
      },
      error: (err) => {
        console.error(err);
        this.error.set(err?.message || 'No se pudieron cargar las asignaciones.');
      },
    });
  }

  irADashboard() {
    this.runWithDiscardGuard(() => {
      this.router.navigate(['/app/vehiculos/dashboard']);
    });
  }

  onSearchEnter() {
    this.cargarChecks();
  }

  clearSearch() {
    if (!this.q()) return;
    this.q.set('');
    this.cargarChecks();
  }

  nuevoChecklist() {
    this.runWithDiscardGuard(() => {
      this.selected.set(null);
      this.selectedRelacion.set(null);
      this.mode.set('crear');
      this.activeTab.set('edicion');
      this.asignaciones.set([]);
      this.success.set(null);
      this.error.set(null);
      this.resetMainFormForNew();
      this.resetAssignForm();
    });
  }

  seleccionarChecklist(item: VehCheckList) {
    if (
      this.selected()?.idVehVehiculoCheckList === item.idVehVehiculoCheckList &&
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
      this.resetAssignForm();
      this.cargarAsignaciones(item.idVehVehiculoCheckList);
    });
  }

  guardarChecklist() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa los campos obligatorios.');
      this.success.set(null);
      return;
    }

    const payload: VehCheckListGuardarRequest = {
      nombreItem: this.form.controls.nombreItem.value?.trim() || '',
      categoria: this.form.controls.categoria.value?.trim() || null,
      orden: Number(this.form.controls.orden.value || 1),
      obligatorio: !!this.form.controls.obligatorio.value,
    };

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    if (this.mode() === 'crear') {
      this.repo.crearCheckList(payload)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.success.set('Ítem checklist creado.');
            this.mode.set('crear');
            this.activeTab.set('edicion');
            this.selected.set(null);
            this.asignaciones.set([]);
            this.resetMainFormForNew();
            this.resetAssignForm();
            this.cargarChecks();
          },
          error: (err) => {
            console.error(err);
            this.error.set(err?.message || 'No se pudo crear el ítem checklist.');
          },
        });

      return;
    }

    const current = this.selected();
    if (!current) {
      this.saving.set(false);
      this.error.set('No hay un ítem checklist seleccionado.');
      return;
    }

    this.repo.editarCheckList({
      idVehVehiculoCheckList: current.idVehVehiculoCheckList,
      cambios: {
        ...payload,
      },
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Ítem checklist actualizado.');
          this.formDirty.set(false);
          this.cargarChecks();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo actualizar el ítem checklist.');
        },
      });
  }

  eliminarChecklistActual() {
    const current = this.selected();
    if (!current) return;

    this.openConfirm(
      {
        title: 'Eliminar ítem checklist',
        message: `Se eliminará "${current.nombreItem}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo.eliminarCheckList(current.idVehVehiculoCheckList)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Ítem checklist eliminado.');
              this.selected.set(null);
              this.selectedRelacion.set(null);
              this.mode.set('crear');
              this.activeTab.set('edicion');
              this.asignaciones.set([]);
              this.formDirty.set(false);
              this.assignDirty.set(false);
              this.resetMainFormForNew();
              this.resetAssignForm();
              this.cargarChecks();
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar el ítem checklist.');
            },
          });
      }
    );
  }

  onMainFormCancel() {
    if (!this.formDirty()) {
      if (this.mode() === 'editar' && this.selected()) {
        this.populateMainForm(this.selected()!);
      } else {
        this.nuevoChecklist();
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
        this.formDirty.set(false);

        if (this.mode() === 'editar' && this.selected()) {
          this.populateMainForm(this.selected()!);
        } else {
          this.nuevoChecklist();
        }
      }
    );
  }

  guardarAsignacion() {
    const current = this.selected();
    if (!current) {
      this.error.set('Primero selecciona un ítem checklist.');
      return;
    }

    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      this.error.set('Selecciona un tipo de vehículo para asignar.');
      return;
    }

    const idVehTipoVehiculoFk = Number(this.assignForm.controls.idVehTipoVehiculoFk.value);

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    this.repo.crearChecklistVehiculo({
      idVehVehiculoCheckListFk: current.idVehVehiculoCheckList,
      idVehTipoVehiculoFk,
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Asignación creada.');
          this.assignDirty.set(false);
          this.resetAssignForm();
          this.cargarAsignaciones(current.idVehVehiculoCheckList);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo crear la asignación.');
        },
      });
  }

  eliminarAsignacion(rel: VehCheckListVehiculo) {
    const tipoLabel = this.nombreTipo(rel.idVehTipoVehiculoFk);

    this.openConfirm(
      {
        title: 'Eliminar asignación',
        message: `Se quitará la relación con "${tipoLabel}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        const current = this.selected();
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo.eliminarChecklistVehiculo(rel.idVehVehiculoCheckListVehiculo)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Asignación eliminada.');
              this.selectedRelacion.set(null);

              if (current) {
                this.cargarAsignaciones(current.idVehVehiculoCheckList);
              }
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar la asignación.');
            },
          });
      }
    );
  }

  nombreTipo(idVehTipoVehiculoFk: number): string {
    return (
      this.tipos().find((x) => x.idVehTipoVehiculo === idVehTipoVehiculoFk)?.tipoVehiculo ||
      `Tipo #${idVehTipoVehiculoFk}`
    );
  }

  obligatoriedadLabel(item: VehCheckList): string {
    return this.toBoolean(item.obligatorio) ? 'Obligatorio' : 'Opcional';
  }

  categoriaLabel(item: VehCheckList): string {
    return item.categoria?.trim() || 'GENERAL';
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

  confirmAccept() {
    const callback = this.confirmAcceptCallback;
    this.closeConfirmInternal();
    callback?.();
  }

  confirmCancel() {
    const callback = this.confirmCancelCallback;
    this.closeConfirmInternal();
    callback?.();
  }

  confirmAlternate() {
    const callback = this.confirmAlternateCallback;
    this.closeConfirmInternal();
    callback?.();
  }

  onConfirmHide() {
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
  ) {
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
          this.assignDirty.set(false);
          resolve(true);
        },
        () => resolve(false)
      );
    });
  }

  private closeConfirmInternal(resetCallbacks = true) {
    this.confirmVisible.set(false);

    if (resetCallbacks) {
      this.confirmAcceptCallback = null;
      this.confirmCancelCallback = null;
      this.confirmAlternateCallback = null;
    }
  }

  private runWithDiscardGuard(action: () => void) {
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
        this.assignDirty.set(false);
        action();
      }
    );
  }

  private populateMainForm(item: VehCheckList) {
    this.suppressFormDirty = true;

    this.form.reset({
      nombreItem: item.nombreItem || '',
      categoria: item.categoria || 'GENERAL',
      orden: item.orden ?? 1,
      obligatorio: this.toBoolean(item.obligatorio),
    });

    this.formDirty.set(false);
    queueMicrotask(() => {
      this.suppressFormDirty = false;
    });
  }

  private resetMainFormForNew() {
    this.suppressFormDirty = true;

    this.form.reset({
      nombreItem: '',
      categoria: 'GENERAL',
      orden: (this.checks().length || 0) + 1,
      obligatorio: true,
    });

    this.formDirty.set(false);
    queueMicrotask(() => {
      this.suppressFormDirty = false;
    });
  }

  private resetAssignForm() {
    this.suppressAssignDirty = true;

    this.assignForm.reset({
      idVehTipoVehiculoFk: null,
    });

    this.assignDirty.set(false);
    queueMicrotask(() => {
      this.suppressAssignDirty = false;
    });
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'sí';
    }
    return false;
  }
}