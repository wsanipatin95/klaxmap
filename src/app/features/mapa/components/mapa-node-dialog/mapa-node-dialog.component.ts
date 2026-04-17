import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ViewChild, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import type { MapaNodo, MapaNodoSaveRequest, MapaPatchRequest } from '../../data-access/mapa.models';
import { MapaNodosRepository } from '../../data-access/nodo/mapa-nodos.repository';
import { MapaConfirmDialogComponent } from '../mapa-confirm-dialog/mapa-confirm-dialog.component';
import { AuditoriaRegistroComponent } from '../auditoria-registro/auditoria-registro.component';

type NodeDialogMode = 'create' | 'edit';
type NodeDialogView = 'edicion' | 'historial';
type NodeTipo = MapaNodo['tipoNodo'];

interface NodeDialogFormValue {
  idRedNodoPadreFk: FormControl<number | null>;
  codigo: FormControl<string>;
  nodo: FormControl<string>;
  descripcion: FormControl<string>;
  tipoNodo: FormControl<NodeTipo>;
  orden: FormControl<number>;
  visible: FormControl<boolean>;
}

@Component({
  selector: 'app-mapa-node-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, MapaConfirmDialogComponent, AuditoriaRegistroComponent],
  templateUrl: './mapa-node-dialog.component.html',
  styleUrl: './mapa-node-dialog.component.scss',
})
export class MapaNodeDialogComponent {
  @Output() createSubmitted = new EventEmitter<MapaNodoSaveRequest>();
  @Output() editSubmitted = new EventEmitter<MapaPatchRequest>();
  @Output() deleted = new EventEmitter<MapaNodo>();
  @Output() restored = new EventEmitter<MapaNodo>();

  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;

  private readonly fb = inject(FormBuilder);
  private readonly repo = inject(MapaNodosRepository);

  readonly visible = signal(false);
  readonly saving = signal(false);
  readonly mode = signal<NodeDialogMode>('create');
  readonly viewMode = signal<NodeDialogView>('edicion');
  readonly error = signal<string | null>(null);
  readonly title = signal('Crear nodo');
  readonly auditRefreshKey = signal(0);

  readonly parentNode = signal<MapaNodo | null>(null);
  readonly editingNode = signal<MapaNodo | null>(null);
  readonly submitted = signal(false);

  readonly form: FormGroup<NodeDialogFormValue> = this.fb.group({
    idRedNodoPadreFk: this.fb.control<number | null>(null),
    codigo: this.fb.nonNullable.control(''),
    nodo: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(160),
    ]),
    descripcion: this.fb.nonNullable.control('', [Validators.maxLength(500)]),
    tipoNodo: this.fb.nonNullable.control<NodeTipo>('carpeta', Validators.required),
    orden: this.fb.nonNullable.control(0, [Validators.min(0)]),
    visible: this.fb.nonNullable.control(true),
  });

  readonly isEditMode = computed(() => this.mode() === 'edit');
  readonly editingDeleted = computed(() => !!this.editingNode()?.fecFin);

  openCreate(parent: MapaNodo | null, tipo: NodeTipo = 'carpeta') {
    this.mode.set('create');
    this.viewMode.set('edicion');
    this.title.set(parent ? 'Nuevo nodo' : 'Nuevo nodo raíz');
    this.parentNode.set(parent);
    this.editingNode.set(null);
    this.error.set(null);
    this.saving.set(false);
    this.submitted.set(false);

    this.form.reset(
      {
        idRedNodoPadreFk: parent?.idRedNodo ?? null,
        codigo: '',
        nodo: '',
        descripcion: '',
        tipoNodo: tipo,
        orden: 0,
        visible: true,
      },
      { emitEvent: false }
    );

    this.form.controls.tipoNodo.disable({ emitEvent: false });

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.visible.set(true);
  }

  openEdit(node: MapaNodo) {
    this.prepareExistingNode(node, 'edicion');
    this.title.set('Editar nodo');
  }

  openAudit(node: MapaNodo) {
    this.prepareExistingNode(node, 'historial');
    this.title.set('Historial del nodo');
  }

  onVisibleChange(nextVisible: boolean) {
    if (nextVisible) {
      this.visible.set(true);
      return;
    }

    this.requestClose();
  }

  requestClose() {
    if (this.saving()) {
      return;
    }

    if (this.viewMode() !== 'edicion' || !this.hasPendingChanges()) {
      this.closeImmediately();
      return;
    }

    this.confirmDialog?.open(
      {
        title: this.isEditMode() ? 'Descartar edición del nodo' : 'Descartar nuevo nodo',
        message:
          'Hay cambios sin guardar en el nodo.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.closeImmediately();
      }
    );
  }

  submit() {
    if (this.saving() || this.viewMode() !== 'edicion') {
      return;
    }

    this.error.set(null);
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios.');
      return;
    }

    const payload = this.buildCreatePayload();

    this.confirmDialog?.open(
      {
        title: this.isEditMode() ? 'Guardar cambios del nodo' : 'Guardar nuevo nodo',
        message: this.isEditMode()
          ? 'Se guardarán los cambios del nodo seleccionado.\n\n¿Deseas continuar?'
          : 'Se creará el nuevo nodo con la información capturada.\n\n¿Deseas continuar?',
        confirmLabel: 'Guardar',
        cancelLabel: 'Seguir editando',
        alternateLabel: 'Descartar',
        severity: 'info',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);

        if (this.mode() === 'create') {
          this.createSubmitted.emit(payload);
          return;
        }

        const editing = this.editingNode();
        if (!editing) {
          this.saving.set(false);
          this.error.set('No se encontró el nodo.');
          return;
        }

        this.editSubmitted.emit({
          id: editing.idRedNodo,
          cambios: {
            codigo: payload.codigo,
            nodo: payload.nodo,
            descripcion: payload.descripcion,
            tipoNodo: payload.tipoNodo,
            orden: payload.orden ?? 0,
            visible: payload.visible ?? true,
          },
        });
      },
      undefined,
      () => {
        this.closeImmediately();
      }
    );
  }

  requestStateAction() {
    const node = this.editingNode();

    if (!node || this.saving() || !this.isEditMode() || this.viewMode() !== 'edicion') {
      return;
    }

    if (this.editingDeleted()) {
      this.confirmRestore(node);
      return;
    }

    this.confirmDelete(node);
  }

  markSaving() {
    this.saving.set(true);
    this.error.set(null);
  }

  handleSaveSuccess() {
    this.saving.set(false);
    this.auditRefreshKey.update((v) => v + 1);
    this.closeImmediately();
  }

  handleSaveError(message: string) {
    this.saving.set(false);
    this.error.set(message || 'No se pudo guardar el nodo.');
  }

  controlInvalid(name: keyof NodeDialogFormValue): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  controlError(name: keyof NodeDialogFormValue): string | null {
    const control = this.form.controls[name];

    if (!this.controlInvalid(name)) return null;

    if (control.errors?.['required']) {
      switch (name) {
        case 'nodo':
          return 'Ingresa el nombre.';
        case 'tipoNodo':
          return 'Selecciona el tipo.';
        default:
          return 'Campo obligatorio.';
      }
    }

    if (control.errors?.['maxlength']) {
      if (name === 'nodo') return 'Máximo 160 caracteres.';
      if (name === 'descripcion') return 'Máximo 500 caracteres.';
      return 'Valor demasiado largo.';
    }

    if (control.errors?.['min']) {
      return 'No puede ser negativo.';
    }

    return 'Valor inválido.';
  }

  parentLabel(): string {
    return this.parentNode()?.nodo || 'Raíz';
  }

  logicalStateLabel(): string {
    return this.editingDeleted() ? 'Eliminado' : 'Activo';
  }

  private hasPendingChanges(): boolean {
    return this.form.dirty;
  }

  private buildCreatePayload(): MapaNodoSaveRequest {
    const raw = this.form.getRawValue();

    return {
      idRedNodoPadreFk: raw.idRedNodoPadreFk,
      codigo: this.nullable(raw.codigo),
      nodo: raw.nodo.trim(),
      descripcion: this.nullable(raw.descripcion),
      tipoNodo: raw.tipoNodo,
      orden: Number.isFinite(raw.orden) ? raw.orden : 0,
      visible: raw.visible ?? true,
      atributos: null,
    };
  }

  private prepareExistingNode(node: MapaNodo, view: NodeDialogView) {
    this.mode.set('edit');
    this.viewMode.set(view);
    this.parentNode.set(null);
    this.editingNode.set(node);
    this.error.set(null);
    this.saving.set(false);
    this.submitted.set(false);

    this.form.reset(
      {
        idRedNodoPadreFk: node.idRedNodoPadreFk ?? null,
        codigo: node.codigo ?? '',
        nodo: node.nodo ?? '',
        descripcion: node.descripcion ?? '',
        tipoNodo: node.tipoNodo,
        orden: node.orden ?? 0,
        visible: node.visible ?? true,
      },
      { emitEvent: false }
    );

    this.form.controls.tipoNodo.enable({ emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.visible.set(true);
  }

  private confirmDelete(node: MapaNodo) {
    this.confirmDialog?.open(
      {
        title: 'Eliminar nodo',
        message:
          `El nodo "${node.nodo}" se marcará como eliminado.\n\nSolo se podrá eliminar si no tiene hijos activos ni elementos activos asociados.` +
          this.buildPendingChangesWarning(),
        confirmLabel: 'Eliminar nodo',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.executeDelete(node);
      }
    );
  }

  private confirmRestore(node: MapaNodo) {
    this.confirmDialog?.open(
      {
        title: 'Restaurar nodo',
        message:
          `El nodo "${node.nodo}" volverá a estar activo.\n\nSolo se restaurará si su padre existe y está activo.` +
          this.buildPendingChangesWarning(),
        confirmLabel: 'Restaurar nodo',
        cancelLabel: 'Cancelar',
        severity: 'info',
      },
      () => {
        this.executeRestore(node);
      }
    );
  }

  private executeDelete(node: MapaNodo) {
    this.saving.set(true);
    this.error.set(null);

    this.repo.eliminar(node.idRedNodo).subscribe({
      next: (resp) => {
        this.saving.set(false);
        this.auditRefreshKey.update((v) => v + 1);
        this.editingNode.set(resp.data);
        this.deleted.emit(resp.data);
        this.closeImmediately();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message || 'No se pudo eliminar el nodo.');
      },
    });
  }

  private executeRestore(node: MapaNodo) {
    this.saving.set(true);
    this.error.set(null);

    this.repo.restaurar(node.idRedNodo).subscribe({
      next: (resp) => {
        this.saving.set(false);
        this.auditRefreshKey.update((v) => v + 1);
        this.editingNode.set(resp.data);
        this.restored.emit(resp.data);
        this.closeImmediately();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.message || 'No se pudo restaurar el nodo.');
      },
    });
  }

  private buildPendingChangesWarning(): string {
    return this.hasPendingChanges()
      ? '\n\nHay cambios sin guardar en el formulario. Esa edición no se guardará antes de continuar.'
      : '';
  }

  private closeImmediately() {
    this.form.controls.tipoNodo.enable({ emitEvent: false });
    this.visible.set(false);
    this.saving.set(false);
    this.error.set(null);
    this.submitted.set(false);
    this.viewMode.set('edicion');
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private nullable(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }
}