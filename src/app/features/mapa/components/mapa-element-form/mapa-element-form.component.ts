import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import type {
  MapaElemento,
  MapaNodo,
  MapaPatchRequest,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';
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

interface ElementFormState {
  nombre: string;
  descripcion: string;
  estado: string;
  visible: boolean;
  idRedNodoFk: number | null;
  idGeoTipoElementoFk: number | null;
}

interface TipoAgrupadoVm {
  agrupacion: string;
  tipos: MapaTipoElemento[];
}

interface NodoSelectOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-mapa-element-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, MapaConfirmDialogComponent],
  templateUrl: './mapa-element-form.component.html',
  styleUrl: './mapa-element-form.component.scss',
})
export class MapaElementFormComponent implements OnChanges {
  @Input() elemento: MapaElemento | null = null;
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() saving = false;

  @Output() saved = new EventEmitter<MapaElemento>();
  @Output() deleted = new EventEmitter<MapaElemento>();
  @Output() restored = new EventEmitter<MapaElemento>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;

  private readonly repo = inject(MapaElementosRepository);

  readonly actionBusy = signal(false);
  readonly isDeleted = computed(() => !!this.elemento?.fecFin);

  form: ElementFormState = this.buildFormState(null);
  private initialForm: ElementFormState = this.buildFormState(null);

  submittedAttempt = false;
  error: string | null = null;
  successMessage: string | null = null;

  nodeOptions: NodoSelectOption[] = [];
  tiposAgrupados: TipoAgrupadoVm[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    this.rebuildNodeOptions();
    this.rebuildCompatibleTypeGroups();

    if (changes['elemento']) {
      this.resetFromElemento(this.elemento);
      return;
    }

    if (changes['nodos'] || changes['tipos']) {
      this.ensureCurrentSelectionsStillValid();
      this.emitDirtyState();
    }
  }

  onFieldChanged() {
    this.error = null;

    if (this.successMessage) {
      this.successMessage = null;
    }

    this.emitDirtyState();
  }

  onTipoPicked(tipoId: number) {
    if (this.form.idGeoTipoElementoFk === tipoId) {
      return;
    }

    this.form.idGeoTipoElementoFk = tipoId;
    this.error = null;

    if (this.successMessage) {
      this.successMessage = null;
    }

    this.emitDirtyState();
  }

  guardar() {
    if (!this.elemento || this.isWorking() || !this.hasUnsavedChanges()) {
      return;
    }

    this.submittedAttempt = true;
    this.error = null;
    this.successMessage = null;

    if (!this.isValid()) {
      this.error = 'Revisa los campos obligatorios.';
      return;
    }

    const payload: MapaPatchRequest = {
      id: this.elemento.idGeoElemento,
      cambios: {
        nombre: this.form.nombre.trim(),
        descripcion: this.form.descripcion.trim(),
        estado: this.form.estado,
        visible: this.form.visible,
        idRedNodoFk: this.form.idRedNodoFk,
        idGeoTipoElementoFk: this.form.idGeoTipoElementoFk,
      },
    };

    this.confirmDialog?.open(
      {
        title: 'Guardar cambios del elemento',
        message:
          'Se guardarán los cambios de la información del elemento.\n\n¿Deseas continuar?',
        confirmLabel: 'Guardar',
        cancelLabel: 'Seguir editando',
        alternateLabel: 'Descartar',
        severity: 'info',
      },
      () => {
        this.executeSave(payload);
      },
      undefined,
      () => {
        this.discardChanges();
      }
    );
  }

  requestStateAction() {
    if (!this.elemento || this.isWorking()) {
      return;
    }

    if (this.isDeleted()) {
      this.confirmRestore();
      return;
    }

    this.confirmDelete();
  }

  hasUnsavedChanges(): boolean {
    return !this.statesEqual(this.form, this.initialForm);
  }

  discardChanges() {
    this.resetFromElemento(this.elemento);
  }

  markSaved(elemento: MapaElemento | null = this.elemento) {
    this.resetFromElemento(elemento);
  }

  resetFromElemento(elemento: MapaElemento | null) {
    const state = this.buildFormState(elemento);
    this.form = this.cloneState(state);
    this.initialForm = this.cloneState(state);
    this.submittedAttempt = false;
    this.error = null;
    this.successMessage = null;

    this.rebuildNodeOptions();
    this.rebuildCompatibleTypeGroups();
    this.ensureCurrentSelectionsStillValid();
    this.emitDirtyState();
  }

  controlError(name: 'nombre' | 'idRedNodoFk' | 'idGeoTipoElementoFk' | 'descripcion'): string | null {
    if (!this.submittedAttempt) {
      return null;
    }

    switch (name) {
      case 'nombre':
        if (!this.form.nombre.trim()) return 'Ingresa el nombre.';
        if (this.form.nombre.trim().length > 180) return 'Máximo 180 caracteres.';
        return null;

      case 'descripcion':
        if ((this.form.descripcion || '').trim().length > 500) return 'Máximo 500 caracteres.';
        return null;

      case 'idRedNodoFk':
        return this.form.idRedNodoFk == null ? 'Selecciona un nodo.' : null;

      case 'idGeoTipoElementoFk':
        return this.form.idGeoTipoElementoFk == null ? 'Selecciona un tipo.' : null;

      default:
        return null;
    }
  }

  isTipoSelected(tipo: MapaTipoElemento): boolean {
    return this.form.idGeoTipoElementoFk === tipo.idGeoTipoElemento;
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

  geomDisplayLabel(): string {
    const geom = String(this.elemento?.geomTipo || '').toLowerCase();

    if (geom === 'linestring') return 'Ruta';
    if (geom === 'polygon') return 'Polígono';
    return 'Punto';
  }

  selectedNodoDisplay(): string {
    if (this.form.idRedNodoFk == null) return '';

    const found = this.nodos.find((n) => n.idRedNodo === this.form.idRedNodoFk);
    if (found) return found.nodo;

    return `Nodo #${this.form.idRedNodoFk}`;
  }

  logicalStateLabel(): string {
    return this.isDeleted() ? 'Eliminado' : 'Activo';
  }

  showPointCoordinates(): boolean {
    return String(this.elemento?.geomTipo || '').toLowerCase() === 'point' && !!this.pointCoordinates();
  }

  pointCoordinates(): string {
    return String(this.elemento?.latLon ?? '').trim();
  }

  copyPointCoordinates() {
    const value = this.pointCoordinates();
    if (!value) {
      return;
    }

    this.error = null;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => {
          this.successMessage = 'Coordenadas copiadas.';
        },
        () => {
          this.error = 'No se pudieron copiar las coordenadas.';
        }
      );
      return;
    }

    this.successMessage = 'Selecciona y copia manualmente las coordenadas.';
  }

  trackByTipo = (_: number, item: MapaTipoElemento) => item.idGeoTipoElemento;
  trackByGrupo = (_: number, item: TipoAgrupadoVm) => item.agrupacion;

  private isWorking(): boolean {
    return this.saving || this.actionBusy();
  }

  private executeSave(payload: MapaPatchRequest) {
    this.actionBusy.set(true);
    this.error = null;
    this.successMessage = null;

    this.repo.editar(payload).subscribe({
      next: (resp) => {
        this.actionBusy.set(false);
        this.error = null;
        this.successMessage = 'Los cambios se guardaron correctamente.';
        this.markSaved(resp.data);
        this.saved.emit(resp.data);
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.successMessage = null;
        this.error = err?.message || 'No se pudieron guardar los cambios.';
      },
    });
  }

  private confirmDelete() {
    const elemento = this.elemento;
    if (!elemento) {
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Eliminar elemento',
        message:
          `El elemento "${elemento.nombre}" se moverá a la carpeta Eliminados.\n\nPodrás restaurarlo luego desde este mismo formulario.` +
          this.buildPendingChangesWarning(),
        confirmLabel: 'Eliminar elemento',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.executeDelete(elemento);
      }
    );
  }

  private confirmRestore() {
    const elemento = this.elemento;
    if (!elemento) {
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Restaurar elemento',
        message:
          `El elemento "${elemento.nombre}" volverá a estar activo y regresará a su ubicación original dentro del árbol.` +
          this.buildPendingChangesWarning(),
        confirmLabel: 'Restaurar elemento',
        cancelLabel: 'Cancelar',
        severity: 'info',
      },
      () => {
        this.executeRestore(elemento);
      }
    );
  }

  private executeDelete(elemento: MapaElemento) {
    this.actionBusy.set(true);
    this.error = null;
    this.successMessage = null;

    this.repo.eliminar(elemento.idGeoElemento).subscribe({
      next: (resp) => {
        this.actionBusy.set(false);
        this.markSaved(resp.data);
        this.deleted.emit(resp.data);
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.error = err?.message || 'No se pudo eliminar el elemento.';
      },
    });
  }

  private executeRestore(elemento: MapaElemento) {
    this.actionBusy.set(true);
    this.error = null;
    this.successMessage = null;

    this.repo.restaurar(elemento.idGeoElemento).subscribe({
      next: (resp) => {
        this.actionBusy.set(false);
        this.markSaved(resp.data);
        this.restored.emit(resp.data);
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.error = err?.message || 'No se pudo restaurar el elemento.';
      },
    });
  }

  private buildPendingChangesWarning(): string {
    return this.hasUnsavedChanges()
      ? '\n\nHay cambios sin guardar en el formulario. Esa edición no se guardará antes de continuar.'
      : '';
  }

  private emitDirtyState() {
    this.dirtyChange.emit(this.hasUnsavedChanges());
  }

  private buildFormState(elemento: MapaElemento | null): ElementFormState {
    return {
      nombre: elemento?.nombre ?? '',
      descripcion: elemento?.descripcion ?? '',
      estado: elemento?.estado ?? 'activo',
      visible: elemento?.visible ?? true,
      idRedNodoFk: elemento?.idRedNodoFk ?? null,
      idGeoTipoElementoFk: elemento?.idGeoTipoElementoFk ?? null,
    };
  }

  private cloneState(state: ElementFormState): ElementFormState {
    return {
      nombre: state.nombre,
      descripcion: state.descripcion,
      estado: state.estado,
      visible: state.visible,
      idRedNodoFk: state.idRedNodoFk,
      idGeoTipoElementoFk: state.idGeoTipoElementoFk,
    };
  }

  private statesEqual(a: ElementFormState, b: ElementFormState): boolean {
    return (
      a.nombre.trim() === b.nombre.trim() &&
      a.descripcion.trim() === b.descripcion.trim() &&
      a.estado === b.estado &&
      a.visible === b.visible &&
      a.idRedNodoFk === b.idRedNodoFk &&
      a.idGeoTipoElementoFk === b.idGeoTipoElementoFk
    );
  }

  private isValid(): boolean {
    return (
      !!this.form.nombre.trim() &&
      this.form.nombre.trim().length <= 180 &&
      this.form.descripcion.trim().length <= 500 &&
      this.form.idRedNodoFk != null &&
      this.form.idGeoTipoElementoFk != null
    );
  }

  private rebuildNodeOptions() {
    const options = this.nodos.map((n) => ({
      value: n.idRedNodo,
      label: n.nodo,
    }));

    if (
      this.form.idRedNodoFk != null &&
      !options.some((x) => x.value === this.form.idRedNodoFk)
    ) {
      options.unshift({
        value: this.form.idRedNodoFk,
        label: this.selectedNodoDisplay() || `Nodo #${this.form.idRedNodoFk}`,
      });
    }

    this.nodeOptions = options;
  }

  private rebuildCompatibleTypeGroups() {
    const geom = this.elemento?.geomTipo ?? null;
    const compatibles = this.tipos.filter((t) => {
      if (!geom) return true;
      return t.geometriaPermitida === geom || t.geometriaPermitida === 'mixed';
    });

    const orderedGroups: TipoAgrupadoVm[] = [];
    const byGroup = new Map<string, TipoAgrupadoVm>();

    for (const tipo of compatibles) {
      const agrupacion = this.normalizeGrouping(tipo.agrupacion);

      let group = byGroup.get(agrupacion);
      if (!group) {
        group = { agrupacion, tipos: [] };
        byGroup.set(agrupacion, group);
        orderedGroups.push(group);
      }

      group.tipos.push(tipo);
    }

    this.tiposAgrupados = orderedGroups;
  }

  private ensureCurrentSelectionsStillValid() {
    if (
      this.form.idRedNodoFk != null &&
      !this.nodeOptions.some((x) => x.value === this.form.idRedNodoFk)
    ) {
      this.form.idRedNodoFk = null;
    }

    const compatibles = this.tiposAgrupados.flatMap((g) => g.tipos);

    if (!compatibles.length) {
      this.form.idGeoTipoElementoFk = null;
      return;
    }

    const exists = compatibles.some((t) => t.idGeoTipoElemento === this.form.idGeoTipoElementoFk);
    if (!exists) {
      this.form.idGeoTipoElementoFk = compatibles[0].idGeoTipoElemento;
    }
  }

  private normalizeGrouping(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    return normalized || 'Sin agrupación';
  }
}