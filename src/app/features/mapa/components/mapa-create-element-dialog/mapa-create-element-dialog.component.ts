import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import type {
  MapaElementoSaveRequest,
  MapaGeomTipo,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaConfirmDialogComponent } from '../mapa-confirm-dialog/mapa-confirm-dialog.component';

type EstadoElemento = 'activo' | 'planificado' | 'pendiente_clasificar';

interface CreateElementoFormValue {
  idRedNodoFk: FormControl<number | null>;
  idGeoTipoElementoFk: FormControl<number | null>;
  nombre: FormControl<string>;
  descripcion: FormControl<string>;
  estado: FormControl<EstadoElemento>;
  visible: FormControl<boolean>;
  ordenDibujo: FormControl<number>;
}

@Component({
  selector: 'app-mapa-create-element-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, MapaConfirmDialogComponent],
  templateUrl: './mapa-create-element-dialog.component.html',
  styleUrl: './mapa-create-element-dialog.component.scss',
})
export class MapaCreateElementDialogComponent {
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];

  @Output() submitted = new EventEmitter<MapaElementoSaveRequest>();

  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;

  private readonly fb = inject(FormBuilder);

  readonly visible = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentWkt = signal<string | null>(null);
  readonly currentGeomTipo = signal<MapaGeomTipo | null>(null);
  readonly submittedAttempt = signal(false);

  readonly form: FormGroup<CreateElementoFormValue> = this.fb.group({
    idRedNodoFk: this.fb.control<number | null>(null, Validators.required),
    idGeoTipoElementoFk: this.fb.control<number | null>(null, Validators.required),
    nombre: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(180),
    ]),
    descripcion: this.fb.nonNullable.control('', [Validators.maxLength(500)]),
    estado: this.fb.nonNullable.control<EstadoElemento>('activo', Validators.required),
    visible: this.fb.nonNullable.control(true),
    ordenDibujo: this.fb.nonNullable.control(0, [Validators.min(0)]),
  });

  readonly tiposCompatibles = computed(() => {
    const geomTipo = this.currentGeomTipo();
    if (!geomTipo) return this.tipos;

    return this.tipos.filter(
      (t) => t.geometriaPermitida === geomTipo || t.geometriaPermitida === 'mixed'
    );
  });

  readonly selectedNodo = computed(() => {
    const nodeId = this.form.controls.idRedNodoFk.value;
    if (nodeId == null) return null;
    return this.nodos.find((n) => n.idRedNodo === nodeId) ?? null;
  });

  readonly selectedTipo = computed(() => {
    const tipoId = this.form.controls.idGeoTipoElementoFk.value;
    if (tipoId == null) return null;
    return this.tipos.find((t) => t.idGeoTipoElemento === tipoId) ?? null;
  });

  open(params: { wkt: string; geomTipo: MapaGeomTipo; nodoId?: number | null }) {
    this.visible.set(true);
    this.saving.set(false);
    this.error.set(null);
    this.submittedAttempt.set(false);
    this.currentWkt.set(params.wkt);
    this.currentGeomTipo.set(params.geomTipo);

    const tiposCompatibles = this.resolveTiposCompatibles(params.geomTipo);
    const firstTipo = tiposCompatibles[0]?.idGeoTipoElemento ?? null;
    const firstNodo = params.nodoId ?? this.nodos[0]?.idRedNodo ?? null;

    this.form.reset(
      {
        idRedNodoFk: firstNodo,
        idGeoTipoElementoFk: firstTipo,
        nombre: '',
        descripcion: '',
        estado: 'activo',
        visible: true,
        ordenDibujo: 0,
      },
      { emitEvent: false }
    );

    this.form.markAsPristine();
    this.form.markAsUntouched();
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

    if (!this.hasPendingChanges()) {
      this.closeImmediately();
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Descartar nuevo elemento',
        message:
          'Hay un elemento nuevo sin guardar.\n\nSi continúas, la geometría y los datos capturados se perderán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.closeImmediately();
      }
    );
  }

  onTipoChange() {
    this.error.set(null);

    const tipoId = this.form.controls.idGeoTipoElementoFk.value;
    if (tipoId == null) return;

    const allowed = this.tiposCompatibles().some((t) => t.idGeoTipoElemento === tipoId);
    if (!allowed) {
      this.form.controls.idGeoTipoElementoFk.setValue(
        this.tiposCompatibles()[0]?.idGeoTipoElemento ?? null
      );
    }
  }

  guardar() {
    if (this.saving()) {
      return;
    }

    this.error.set(null);
    this.submittedAttempt.set(true);

    if (!this.currentWkt()) {
      this.error.set('No hay geometría.');
      return;
    }

    if (!this.currentGeomTipo()) {
      this.error.set('No se pudo leer la geometría.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos obligatorios.');
      return;
    }

    const payload = this.buildPayload();

    this.confirmDialog?.open(
      {
        title: 'Guardar nuevo elemento',
        message:
          'Se guardará el nuevo elemento con la geometría dibujada.\n\n¿Deseas continuar?',
        confirmLabel: 'Guardar',
        cancelLabel: 'Seguir editando',
        alternateLabel: 'Descartar',
        severity: 'info',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);
        this.submitted.emit(payload);
      },
      undefined,
      () => {
        this.closeImmediately();
      }
    );
  }

  markSaving() {
    this.saving.set(true);
    this.error.set(null);
  }

  handleSaveSuccess() {
    this.saving.set(false);
    this.closeImmediately();
  }

  handleSaveError(message: string) {
    this.saving.set(false);
    this.error.set(message || 'No se pudo guardar el elemento.');
  }

  controlInvalid(name: keyof CreateElementoFormValue): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submittedAttempt());
  }

  controlError(name: keyof CreateElementoFormValue): string | null {
    const control = this.form.controls[name];

    if (!this.controlInvalid(name)) return null;

    if (control.errors?.['required']) {
      switch (name) {
        case 'idRedNodoFk':
          return 'Selecciona un nodo.';
        case 'idGeoTipoElementoFk':
          return 'Selecciona un tipo.';
        case 'nombre':
          return 'Ingresa el nombre.';
        default:
          return 'Campo obligatorio.';
      }
    }

    if (control.errors?.['maxlength']) {
      if (name === 'nombre') return 'Máximo 180 caracteres.';
      if (name === 'descripcion') return 'Máximo 500 caracteres.';
      return 'Valor demasiado largo.';
    }

    if (control.errors?.['min']) {
      return 'No puede ser negativo.';
    }

    return 'Valor inválido.';
  }

  geomLabel(): string {
    const geom = String(this.currentGeomTipo() || '').toLowerCase();

    if (geom === 'linestring') return 'Línea';
    if (geom === 'polygon') return 'Polígono';
    return 'Punto';
  }

  private buildPayload(): MapaElementoSaveRequest {
    const raw = this.form.getRawValue();

    return {
      idRedNodoFk: raw.idRedNodoFk as number,
      idGeoTipoElementoFk: raw.idGeoTipoElementoFk as number,
      nombre: raw.nombre.trim(),
      descripcion: this.emptyToNull(raw.descripcion) ?? '',
      estado: raw.estado,
      visible: raw.visible ?? true,
      origen: 'manual',
      wkt: this.currentWkt() as string,
      ordenDibujo: Number.isFinite(raw.ordenDibujo) ? raw.ordenDibujo : 0,
    };
  }

  private hasPendingChanges(): boolean {
    return !!this.currentWkt() || this.form.dirty;
  }

  private closeImmediately() {
    this.visible.set(false);
    this.saving.set(false);
    this.error.set(null);
    this.submittedAttempt.set(false);
    this.currentWkt.set(null);
    this.currentGeomTipo.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private resolveTiposCompatibles(geomTipo: MapaGeomTipo): MapaTipoElemento[] {
    return this.tipos.filter(
      (t) => t.geometriaPermitida === geomTipo || t.geometriaPermitida === 'mixed'
    );
  }

  private emptyToNull(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  }
}