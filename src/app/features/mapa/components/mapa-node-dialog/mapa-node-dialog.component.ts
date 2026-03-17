import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import type { MapaNodo, MapaNodoSaveRequest, MapaPatchRequest } from '../../data-access/mapa.models';

type NodeDialogMode = 'create' | 'edit';
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
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, DialogModule],
  templateUrl: './mapa-node-dialog.component.html',
  styleUrl: './mapa-node-dialog.component.scss',
})
export class MapaNodeDialogComponent {
  @Output() createSubmitted = new EventEmitter<MapaNodoSaveRequest>();
  @Output() editSubmitted = new EventEmitter<MapaPatchRequest>();

  private readonly fb = inject(FormBuilder);

  readonly visible = signal(false);
  readonly mode = signal<NodeDialogMode>('create');
  readonly error = signal<string | null>(null);
  readonly title = signal('Crear nodo');

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

  openCreate(parent: MapaNodo | null, tipo: NodeTipo = 'carpeta') {
    this.mode.set('create');
    this.title.set(parent ? `Crear dentro de ${parent.nodo}` : 'Crear nodo raíz');
    this.parentNode.set(parent);
    this.editingNode.set(null);
    this.error.set(null);
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

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.visible.set(true);
  }

  openEdit(node: MapaNodo) {
    this.mode.set('edit');
    this.title.set(`Editar ${node.nodo}`);
    this.parentNode.set(null);
    this.editingNode.set(node);
    this.error.set(null);
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

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
    this.error.set(null);
    this.submitted.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  submit() {
    this.error.set(null);
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios antes de continuar.');
      return;
    }

    const payload = this.buildCreatePayload();

    if (this.mode() === 'create') {
      this.createSubmitted.emit(payload);
      this.close();
      return;
    }

    const editing = this.editingNode();
    if (!editing) {
      this.error.set('No se encontró el nodo a editar.');
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
        atributos: {},
      },
    });

    this.close();
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
          return 'El nombre del nodo es obligatorio.';
        case 'tipoNodo':
          return 'Debes seleccionar el tipo de nodo.';
        default:
          return 'Este campo es obligatorio.';
      }
    }

    if (control.errors?.['maxlength']) {
      if (name === 'nodo') return 'El nombre no puede superar 160 caracteres.';
      if (name === 'descripcion') return 'La descripción no puede superar 500 caracteres.';
      return 'El valor supera la longitud permitida.';
    }

    if (control.errors?.['min']) {
      return 'El orden no puede ser negativo.';
    }

    return 'Valor inválido.';
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
      atributos: {},
    };
  }

  private nullable(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }
}