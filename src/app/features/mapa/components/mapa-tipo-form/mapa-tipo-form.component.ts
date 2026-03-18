import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
} from '../../data-access/mapa.models';

type GeometryMode = 'point' | 'linestring' | 'polygon' | 'mixed';

@Component({
  selector: 'app-mapa-tipo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-tipo-form.component.html',
  styleUrl: './mapa-tipo-form.component.scss',
})
export class MapaTipoFormComponent {
  @Input() tipo: MapaTipoElemento | null = null;
  @Input() modo: 'crear' | 'editar' = 'crear';
  @Input() saving = false;

  @Output() saveRequested = new EventEmitter<MapaTipoElementoSaveRequest>();
  @Output() cancelRequested = new EventEmitter<void>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  form: MapaTipoElementoSaveRequest = this.buildDefaultForm();
  atributosText = '{}';
  error: string | null = null;
  private lastSnapshot = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipo'] || changes['modo']) {
      if (this.tipo) {
        this.loadFromTipo(this.tipo);
      } else {
        this.resetForm(false);
      }
    }
  }

  get geometryMode(): GeometryMode {
    return (this.form.geometriaPermitida ?? 'point') as GeometryMode;
  }

  get isDirty(): boolean {
    return this.currentSnapshot() !== this.lastSnapshot;
  }

  get showPointAppearance(): boolean {
    return this.geometryMode === 'point' || this.geometryMode === 'mixed';
  }

  get showLineAppearance(): boolean {
    return this.geometryMode === 'linestring' || this.geometryMode === 'mixed';
  }

  get showPolygonAppearance(): boolean {
    return this.geometryMode === 'polygon' || this.geometryMode === 'mixed';
  }

  get title(): string {
    return this.modo === 'crear' ? 'Nuevo tipo de elemento' : 'Editar tipo de elemento';
  }

  get subtitle(): string {
    return this.modo === 'crear'
      ? 'Completa el catálogo visual y funcional del tipo.'
      : 'Modifica todas las características del tipo seleccionado.';
  }

  get previewLabel(): string {
    switch (this.geometryMode) {
      case 'linestring':
        return 'Vista previa de línea';
      case 'polygon':
        return 'Vista previa de polígono';
      case 'mixed':
        return 'Vista previa mixta';
      case 'point':
      default:
        return 'Vista previa de punto';
    }
  }

  submit() {
    this.error = null;

    if (!this.form.codigo?.trim()) {
      this.error = 'El código es obligatorio.';
      return;
    }

    if (!this.form.nombre?.trim()) {
      this.error = 'El nombre es obligatorio.';
      return;
    }

    if (!this.form.geometriaPermitida?.trim()) {
      this.error = 'La geometría permitida es obligatoria.';
      return;
    }

    const atributos = this.parseAtributos();
    if (atributos == null) {
      return;
    }

    const payload: MapaTipoElementoSaveRequest = {
      codigo: this.form.codigo.trim(),
      nombre: this.form.nombre.trim(),
      descripcion: this.cleanString(this.form.descripcion),
      icono: this.cleanString(this.form.icono),
      iconoFuente: this.cleanString(this.form.iconoFuente),
      iconoClase: this.cleanString(this.form.iconoClase),
      shapeBase: this.cleanString(this.form.shapeBase),
      colorFill: this.cleanString(this.form.colorFill),
      colorStroke: this.cleanString(this.form.colorStroke),
      colorTexto: this.cleanString(this.form.colorTexto),
      strokeWidth: this.normalizeNumber(this.form.strokeWidth, 1),
      zIndex: this.normalizeNumber(this.form.zIndex, 0),
      tamanoIcono: this.normalizeNullableNumber(this.form.tamanoIcono),
      geometriaPermitida: this.form.geometriaPermitida,
      snapping: !!this.form.snapping,
      conectable: !!this.form.conectable,
      maxPuertosDefault: this.normalizeInteger(this.form.maxPuertosDefault, 0),
      permiteImportAuto: !!this.form.permiteImportAuto,
      requiereRevision: !!this.form.requiereRevision,
      prioridadClasificacion: this.normalizeInteger(this.form.prioridadClasificacion, 100),
      activo: !!this.form.activo,
      atributos,
    };

    this.saveRequested.emit(payload);
  }

  resetForNew() {
    this.resetForm(true);
  }

  onCancelClick() {
    this.cancelRequested.emit();
  }

  onFieldInput() {
    this.emitDirty();
  }

  previewStyle(): Record<string, string> {
    const stroke = this.form.colorStroke?.trim() || '#2563eb';
    const fill = this.form.colorFill?.trim() || '#93c5fd';
    const width = `${this.normalizeNumber(this.form.strokeWidth, 1)}`;

    return {
      '--preview-stroke': stroke,
      '--preview-fill': fill,
      '--preview-stroke-width': width,
    };
  }

  previewShapeClass(): string {
    const source = (this.form.iconoFuente ?? '').toLowerCase();
    const shape = (this.form.shapeBase ?? '').toLowerCase();

    if (this.geometryMode === 'linestring') return 'is-line';
    if (this.geometryMode === 'polygon') return 'is-polygon';
    if (this.geometryMode === 'mixed') return 'is-mixed';

    if (source.includes('triangle') || shape.includes('triangle')) return 'is-triangle';
    if (source.includes('target') || shape.includes('target')) return 'is-target';
    if (source.includes('donut') || shape.includes('donut')) return 'is-donut';
    if (shape.includes('square') || shape.includes('rect')) return 'is-square';

    return 'is-point';
  }

  markSaved(tipo?: MapaTipoElemento | null) {
    if (tipo) {
      this.loadFromTipo(tipo);
      return;
    }

    this.lastSnapshot = this.currentSnapshot();
    this.emitDirty();
  }

  private loadFromTipo(tipo: MapaTipoElemento) {
    this.form = {
      codigo: tipo.codigo ?? '',
      nombre: tipo.nombre ?? '',
      descripcion: tipo.descripcion ?? '',
      icono: tipo.icono ?? '',
      iconoFuente: tipo.iconoFuente ?? '',
      iconoClase: tipo.iconoClase ?? '',
      shapeBase: tipo.shapeBase ?? '',
      colorFill: tipo.colorFill ?? '',
      colorStroke: tipo.colorStroke ?? '',
      colorTexto: tipo.colorTexto ?? '',
      strokeWidth: tipo.strokeWidth ?? 1,
      zIndex: tipo.zIndex ?? 0,
      tamanoIcono: tipo.tamanoIcono ?? null,
      geometriaPermitida: tipo.geometriaPermitida ?? 'point',
      snapping: tipo.snapping ?? false,
      conectable: tipo.conectable ?? false,
      maxPuertosDefault: tipo.maxPuertosDefault ?? 0,
      permiteImportAuto: tipo.permiteImportAuto ?? true,
      requiereRevision: tipo.requiereRevision ?? false,
      prioridadClasificacion: tipo.prioridadClasificacion ?? 100,
      activo: tipo.activo ?? true,
      atributos: tipo.atributos ?? {},
    };

    this.atributosText = this.stringifyAtributos(this.form.atributos);
    this.error = null;
    this.lastSnapshot = this.currentSnapshot();
    this.emitDirty();
  }

  private resetForm(emit = true) {
    this.form = this.buildDefaultForm();
    this.atributosText = '{}';
    this.error = null;
    this.lastSnapshot = this.currentSnapshot();

    if (emit) {
      this.emitDirty();
    }
  }

  private buildDefaultForm(): MapaTipoElementoSaveRequest {
    return {
      codigo: '',
      nombre: '',
      descripcion: '',
      icono: '',
      iconoFuente: '',
      iconoClase: '',
      shapeBase: '',
      colorFill: '#93c5fd',
      colorStroke: '#2563eb',
      colorTexto: '#0f172a',
      strokeWidth: 1,
      zIndex: 0,
      tamanoIcono: 18,
      geometriaPermitida: 'point',
      snapping: false,
      conectable: false,
      maxPuertosDefault: 0,
      permiteImportAuto: true,
      requiereRevision: false,
      prioridadClasificacion: 100,
      activo: true,
      atributos: {},
    };
  }

  private currentSnapshot(): string {
    const snapshot = {
      ...this.form,
      atributosText: this.atributosText,
    };
    return JSON.stringify(snapshot);
  }

  private emitDirty() {
    this.dirtyChange.emit(this.isDirty);
  }

  private cleanString(value: string | null | undefined): string | null {
    const v = (value ?? '').trim();
    return v ? v : null;
  }

  private normalizeNumber(value: unknown, fallback: number): number {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : fallback;
  }

  private normalizeNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  private normalizeInteger(value: unknown, fallback: number): number {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : fallback;
  }

  private parseAtributos(): Record<string, any> | null {
    const raw = (this.atributosText || '').trim();
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error = 'Atributos debe ser un objeto JSON válido.';
        return null;
      }
      return parsed;
    } catch {
      this.error = 'Atributos debe ser un JSON válido.';
      return null;
    }
  }

  private stringifyAtributos(value: Record<string, any> | null | undefined): string {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return '{}';
    }
  }
}