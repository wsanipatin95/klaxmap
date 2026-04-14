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
import type { MapaItemVisualPreview } from '../../utils/mapa-element-visual.utils';
import {
  previewClassForVisual,
  previewImageUrlForVisual,
  previewMaterialFamilyForVisual,
  previewMaterialGlyphForVisual,
  previewShapeClassForVisual,
  previewStyleForVisual,
  resolveMapaTipoVisual,
  showClassPreviewForVisual,
  showMaterialPreviewForVisual,
  showUrlPreviewForVisual,
} from '../../utils/mapa-element-visual.utils';

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

interface TipoAgrupadoVm {
  agrupacion: string;
  tipos: MapaTipoElemento[];
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

  readonly nodeLocked = signal(false);
  readonly nodeSearch = signal('');

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

  readonly geomDisplayLabel = computed(() => {
    const geom = String(this.currentGeomTipo() || '').toLowerCase();

    if (geom === 'linestring') return 'Ruta';
    if (geom === 'polygon') return 'Polígono';
    return 'Punto';
  });

  readonly dialogTitle = computed(() => `Nuevo elemento · ${this.geomDisplayLabel()}`);

  readonly tiposCompatibles = computed(() => {
    const geomTipo = this.currentGeomTipo();
    if (!geomTipo) return this.tipos;

    return this.tipos.filter(
      (t) => t.geometriaPermitida === geomTipo || t.geometriaPermitida === 'mixed'
    );
  });

  readonly tiposAgrupados = computed<TipoAgrupadoVm[]>(() => {
    const orderedGroups: TipoAgrupadoVm[] = [];
    const byGroup = new Map<string, TipoAgrupadoVm>();

    for (const tipo of this.tiposCompatibles()) {
      const agrupacion = this.normalizeGrouping(tipo.agrupacion);

      let group = byGroup.get(agrupacion);
      if (!group) {
        group = { agrupacion, tipos: [] };
        byGroup.set(agrupacion, group);
        orderedGroups.push(group);
      }

      group.tipos.push(tipo);
    }

    return orderedGroups;
  });

  readonly filteredNodos = computed(() => {
    const q = this.normalizeText(this.nodeSearch());

    if (!q) return this.nodos;

    return this.nodos.filter((n) => {
      return [
        n.nodo,
        n.codigo ?? '',
        n.descripcion ?? '',
        n.tipoNodo,
        n.pathCache ?? '',
      ].some((value) => this.normalizeText(value).includes(q));
    });
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
    this.nodeSearch.set('');

    const tiposCompatibles = this.resolveTiposCompatibles(params.geomTipo);
    const firstTipo = tiposCompatibles[0]?.idGeoTipoElemento ?? null;

    const incomingNodeId =
      params.nodoId != null && this.nodos.some((n) => n.idRedNodo === params.nodoId)
        ? params.nodoId
        : null;

    this.form.controls.idRedNodoFk.enable({ emitEvent: false });
    this.form.controls.idGeoTipoElementoFk.enable({ emitEvent: false });

    this.form.reset(
      {
        idRedNodoFk: incomingNodeId,
        idGeoTipoElementoFk: firstTipo,
        nombre: '',
        descripcion: '',
        estado: 'activo',
        visible: true,
        ordenDibujo: 0,
      },
      { emitEvent: false }
    );

    if (incomingNodeId != null) {
      this.nodeLocked.set(true);
      this.form.controls.idRedNodoFk.disable({ emitEvent: false });
    } else {
      this.nodeLocked.set(false);
      this.form.controls.idRedNodoFk.enable({ emitEvent: false });
    }

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

  onNodeSearchInput(value: string) {
    this.nodeSearch.set(value);

    if (this.nodeLocked()) {
      return;
    }

    const selectedNodeId = this.form.controls.idRedNodoFk.value;
    if (selectedNodeId == null) {
      return;
    }

    const stillVisible = this.filteredNodos().some((n) => n.idRedNodo === selectedNodeId);
    if (!stillVisible) {
      this.form.controls.idRedNodoFk.setValue(null);
    }
  }

  onTipoPicked(tipoId: number) {
    if (this.form.controls.idGeoTipoElementoFk.value === tipoId) {
      return;
    }

    this.form.controls.idGeoTipoElementoFk.setValue(tipoId);
    this.form.controls.idGeoTipoElementoFk.markAsDirty();
    this.error.set(null);
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

  isTipoSelected(tipo: MapaTipoElemento): boolean {
    return this.form.controls.idGeoTipoElementoFk.value === tipo.idGeoTipoElemento;
  }

  visual(tipo: MapaTipoElemento): MapaItemVisualPreview {
    return resolveMapaTipoVisual(tipo);
  }

  previewShapeClass(tipo: MapaTipoElemento): string {
    return previewShapeClassForVisual(this.visual(tipo));
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    return previewStyleForVisual(this.visual(tipo));
  }

  previewMaterialFamily(tipo: MapaTipoElemento): string {
    return previewMaterialFamilyForVisual(this.visual(tipo));
  }

  previewMaterialGlyph(tipo: MapaTipoElemento): string {
    return previewMaterialGlyphForVisual(this.visual(tipo));
  }

  previewClass(tipo: MapaTipoElemento): string {
    return previewClassForVisual(this.visual(tipo));
  }

  previewImageUrl(tipo: MapaTipoElemento): string {
    return previewImageUrlForVisual(this.visual(tipo));
  }

  showMaterialPreview(tipo: MapaTipoElemento): boolean {
    return showMaterialPreviewForVisual(this.visual(tipo));
  }

  showClassPreview(tipo: MapaTipoElemento): boolean {
    return showClassPreviewForVisual(this.visual(tipo));
  }

  showUrlPreview(tipo: MapaTipoElemento): boolean {
    return showUrlPreviewForVisual(this.visual(tipo));
  }

  trackByNodo = (_: number, item: MapaNodo) => item.idRedNodo;
  trackByTipo = (_: number, item: MapaTipoElemento) => item.idGeoTipoElemento;
  trackByGrupo = (_: number, item: TipoAgrupadoVm) => item.agrupacion;

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
    this.nodeLocked.set(false);
    this.nodeSearch.set('');

    this.form.controls.idRedNodoFk.enable({ emitEvent: false });
    this.form.controls.idGeoTipoElementoFk.enable({ emitEvent: false });

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

  private normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizeGrouping(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    return normalized || 'Sin agrupación';
  }
}