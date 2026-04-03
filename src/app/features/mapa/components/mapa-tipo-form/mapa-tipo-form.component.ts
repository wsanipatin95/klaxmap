import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
} from '../../data-access/mapa.models';
import {
  normalizeMapaColor,
  normalizeMapaColorOrDefault,
} from '../../utils/mapa-color.utils';

type GeometryMode = 'point' | 'linestring' | 'polygon' | 'mixed';
type PointIconMode = 'none' | 'material' | 'class' | 'url' | 'preset';
type ColorFieldKey = 'colorFill' | 'colorStroke' | 'colorTexto';

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

  readonly fillPresets = [
    '#f8c7e0',
    '#f3aad6',
    '#eb79ba',
    '#d9468f',
    '#f1f5f9',
    '#e2e8f0',
    '#cbd5e1',
    '#fde68a',
  ];

  readonly strokePresets = [
    '#7b0061',
    '#921f54',
    '#b02365',
    '#c0267b',
    '#475569',
    '#334155',
    '#1f2937',
    '#a16207',
  ];

  readonly textPresets = [
    '#334155',
    '#475569',
    '#0f172a',
    '#ffffff',
    '#7b0061',
    '#921f54',
    '#1f2937',
    '#64748b',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipo'] || changes['modo']) {
      if (this.tipo) {
        this.loadFromTipo(this.tipo);
      } else {
        this.resetForm(false);
      }
    }
  }

  get title(): string {
    return this.modo === 'crear' ? 'Nuevo tipo' : 'Editar tipo';
  }

  get geometryMode(): GeometryMode {
    return (this.form.geometriaPermitida ?? 'point') as GeometryMode;
  }

  get normalizedIconSource(): string {
    return (this.form.iconoFuente ?? '').trim().toLowerCase();
  }

  get pointIconMode(): PointIconMode {
    const source = this.normalizedIconSource;

    if (!source) return 'none';
    if (this.isMaterialSource(source)) return 'material';
    if (this.isCssClassSource(source)) return 'class';
    if (this.isUrlSource(source)) return 'url';
    if (this.isPresetSource(source)) return 'preset';

    return 'none';
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

  get showMaterialBlock(): boolean {
    return this.showPointAppearance && this.pointIconMode === 'material';
  }

  get showCssClassBlock(): boolean {
    return this.showPointAppearance && this.pointIconMode === 'class';
  }

  get showUrlBlock(): boolean {
    return this.showPointAppearance && this.pointIconMode === 'url';
  }

  get showPresetBlock(): boolean {
    return this.showPointAppearance && this.pointIconMode === 'preset';
  }

  get showNeutralPointBlock(): boolean {
    return this.showPointAppearance && this.pointIconMode === 'none';
  }

  get modeSummary(): string {
    if (this.geometryMode === 'linestring') return 'Línea';
    if (this.geometryMode === 'polygon') return 'Polígono';
    if (this.geometryMode === 'mixed') return 'Mixto';

    switch (this.pointIconMode) {
      case 'material':
        return 'Punto · Material';
      case 'class':
        return 'Punto · Clase';
      case 'url':
        return 'Punto · Imagen';
      case 'preset':
        return 'Punto · Forma';
      default:
        return 'Punto';
    }
  }

  submit() {
    this.error = null;

    if (!this.form.codigo?.trim()) {
      this.error = 'Ingresa el código.';
      return;
    }

    if (!this.form.nombre?.trim()) {
      this.error = 'Ingresa el nombre.';
      return;
    }

    if (!this.form.geometriaPermitida?.trim()) {
      this.error = 'Selecciona la geometría.';
      return;
    }

    if (this.showMaterialBlock && !this.form.icono?.trim()) {
      this.error = 'Ingresa el icono Material.';
      return;
    }

    if (this.showCssClassBlock && !(this.form.iconoClase?.trim() || this.form.icono?.trim())) {
      this.error = 'Ingresa la clase CSS.';
      return;
    }

    if (this.showUrlBlock && !this.form.icono?.trim()) {
      this.error = 'Ingresa la URL o ruta del icono.';
      return;
    }

    const atributos = this.parseAtributos();
    if (atributos == null) {
      return;
    }

    const usePointFields = this.showPointAppearance;

    let iconoFuente: string | null = null;
    let icono: string | null = null;
    let iconoClase: string | null = null;
    let tamanoIcono: number | null = null;

    if (usePointFields) {
      iconoFuente = this.cleanString(this.form.iconoFuente);
      tamanoIcono = this.normalizeNullableNumber(this.form.tamanoIcono);

      switch (this.pointIconMode) {
        case 'material':
          icono = this.cleanString(this.form.icono);
          iconoClase = null;
          break;
        case 'class':
          icono = this.cleanString(this.form.icono);
          iconoClase = this.cleanString(this.form.iconoClase) ?? this.cleanString(this.form.icono);
          break;
        case 'url':
          icono = this.cleanString(this.form.icono);
          iconoClase = null;
          break;
        case 'preset':
        case 'none':
        default:
          icono = this.cleanString(this.form.icono);
          iconoClase = this.cleanString(this.form.iconoClase);
          break;
      }
    }

    const normalizedFill = normalizeMapaColorOrDefault(
      this.form.colorFill ?? this.form.colorStroke ?? null,
      '#f3aad6'
    );
    const normalizedStroke = normalizeMapaColorOrDefault(
      this.form.colorStroke ?? this.form.colorFill ?? null,
      '#7b0061'
    );
    const normalizedText = normalizeMapaColor(this.form.colorTexto, normalizedStroke) ?? normalizedStroke;

    const payload: MapaTipoElementoSaveRequest = {
      codigo: this.form.codigo.trim(),
      nombre: this.form.nombre.trim(),
      descripcion: this.cleanString(this.form.descripcion),

      iconoFuente,
      icono,
      iconoClase,

      shapeBase: this.resolveShapeBaseForPayload(),
      colorFill: normalizedFill,
      colorStroke: normalizedStroke,
      colorTexto: normalizedText,
      strokeWidth: this.normalizeNumber(this.form.strokeWidth, 1),
      zIndex: this.normalizeNumber(this.form.zIndex, 0),
      tamanoIcono,

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

  onGeometryChange() {
    this.applyGeometryDefaults();
    this.emitDirty();
  }

  onIconSourceChange() {
    this.applyIconSourceDefaults();
    this.emitDirty();
  }

  setColor(field: ColorFieldKey, value: string) {
    this.form[field] = normalizeMapaColor(value, value) ?? value;
    this.emitDirty();
  }

  previewStyle(): Record<string, string> {
    const fill = normalizeMapaColorOrDefault(
      this.form.colorFill?.trim() || this.form.colorStroke?.trim(),
      '#f3aad6'
    );
    const stroke = normalizeMapaColorOrDefault(
      this.form.colorStroke?.trim() || this.form.colorFill?.trim(),
      '#7b0061'
    );
    const widthValue = this.normalizeNumber(this.form.strokeWidth, 1);
    const width = `${widthValue}`;
    const size = `${this.previewPointSize()}px`;

    return {
      '--preview-stroke': stroke,
      '--preview-fill': fill,
      '--preview-stroke-width': width,
      '--preview-stroke-width-px': `${widthValue}px`,
      '--preview-size': size,
    };
  }

  previewShapeClass(): string {
    const shape = (this.form.shapeBase ?? '').toLowerCase();

    if (this.geometryMode === 'linestring') return 'is-line';
    if (this.geometryMode === 'polygon') return 'is-polygon';
    if (this.geometryMode === 'mixed') return 'is-mixed';

    if (this.pointIconMode === 'material' || this.pointIconMode === 'class' || this.pointIconMode === 'url') {
      return 'is-icon-host';
    }

    if (this.normalizedIconSource.includes('triangle') || shape.includes('triangle')) return 'is-triangle';
    if (this.normalizedIconSource.includes('target') || shape.includes('target')) return 'is-target';
    if (this.normalizedIconSource.includes('donut') || shape.includes('donut')) return 'is-donut';
    if (shape.includes('square') || shape.includes('rect')) return 'is-square';

    return 'is-point';
  }

  previewVisualMode(): 'material' | 'class' | 'url' | 'shape' {
    if (this.geometryMode !== 'point') {
      return 'shape';
    }

    if (this.pointIconMode === 'material') return 'material';
    if (this.pointIconMode === 'class') return 'class';
    if (this.pointIconMode === 'url') return 'url';

    return 'shape';
  }

  previewMaterialFamilyClass(): string {
    const source = this.normalizedIconSource;
    if (source.includes('rounded')) return 'material-symbols-rounded';
    if (source.includes('sharp')) return 'material-symbols-sharp';
    return 'material-symbols-outlined';
  }

  previewMaterialGlyph(): string {
    return this.form.icono?.trim() || 'radio_button_checked';
  }

  previewMaterialVariation(): string {
    const fill = this.form.colorFill?.trim() ? 1 : 0;
    const weight = this.toMaterialWeight(this.form.strokeWidth ?? 1);
    const opsz = Math.max(20, this.previewPointSize());

    return `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opsz}`;
  }

  previewCssClass(): string {
    return this.form.iconoClase?.trim() || this.form.icono?.trim() || 'pi pi-map-marker';
  }

  previewImageUrl(): string {
    return this.form.icono?.trim() || '';
  }

  previewPointSize(): number {
    return this.normalizeNullableNumber(this.form.tamanoIcono) ?? 18;
  }

  previewTextColor(): string {
    return normalizeMapaColor(
      this.form.colorTexto?.trim() || this.form.colorStroke?.trim(),
      '#334155'
    ) ?? '#334155';
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
    const normalizedFill = normalizeMapaColorOrDefault(
      tipo.colorFill ?? tipo.colorStroke ?? null,
      '#f3aad6'
    );
    const normalizedStroke = normalizeMapaColorOrDefault(
      tipo.colorStroke ?? tipo.colorFill ?? null,
      '#7b0061'
    );
    const normalizedText = normalizeMapaColor(tipo.colorTexto, normalizedStroke) ?? normalizedStroke;

    this.form = {
      codigo: tipo.codigo ?? '',
      nombre: tipo.nombre ?? '',
      descripcion: tipo.descripcion ?? '',
      icono: tipo.icono ?? '',
      iconoFuente: tipo.iconoFuente ?? '',
      iconoClase: tipo.iconoClase ?? '',
      shapeBase: tipo.shapeBase ?? '',
      colorFill: normalizedFill,
      colorStroke: normalizedStroke,
      colorTexto: normalizedText,
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
      iconoFuente: 'target',
      iconoClase: '',
      shapeBase: 'point',
      colorFill: '#f3aad6',
      colorStroke: '#7b0061',
      colorTexto: '#334155',
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
        this.error = 'Atributos debe ser un objeto JSON.';
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

  private applyGeometryDefaults() {
    this.error = null;

    if (this.geometryMode === 'point') {
      if (!this.form.shapeBase || ['line', 'polygon'].includes((this.form.shapeBase ?? '').toLowerCase())) {
        this.form.shapeBase = 'point';
      }
      if (!this.form.iconoFuente) {
        this.form.iconoFuente = 'target';
      }
      if (this.form.tamanoIcono == null) {
        this.form.tamanoIcono = 18;
      }
      return;
    }

    if (this.geometryMode === 'linestring') {
      this.form.shapeBase = 'line';
      this.clearPointVisualFields();
      return;
    }

    if (this.geometryMode === 'polygon') {
      this.form.shapeBase = 'polygon';
      this.clearPointVisualFields();
      return;
    }

    if (this.geometryMode === 'mixed' && !this.form.shapeBase) {
      this.form.shapeBase = 'point';
    }
  }

  private applyIconSourceDefaults() {
    this.error = null;

    if (!this.showPointAppearance) return;

    switch (this.pointIconMode) {
      case 'material':
        if (!this.form.icono?.trim()) {
          this.form.icono = 'radio_button_checked';
        }
        this.form.iconoClase = '';
        if (!this.form.tamanoIcono) {
          this.form.tamanoIcono = 18;
        }
        break;

      case 'class':
        if (!this.form.iconoClase?.trim() && this.form.icono?.trim()) {
          this.form.iconoClase = this.form.icono.trim();
        }
        if (!this.form.tamanoIcono) {
          this.form.tamanoIcono = 18;
        }
        break;

      case 'url':
        this.form.iconoClase = '';
        if (!this.form.tamanoIcono) {
          this.form.tamanoIcono = 22;
        }
        break;

      case 'preset':
        this.form.icono = '';
        this.form.iconoClase = '';
        if (['triangle', 'target', 'donut'].includes(this.normalizedIconSource)) {
          this.form.shapeBase = this.normalizedIconSource;
        }
        if (!this.form.tamanoIcono) {
          this.form.tamanoIcono = 18;
        }
        break;

      case 'none':
      default:
        if (!this.form.shapeBase) {
          this.form.shapeBase = 'point';
        }
        break;
    }
  }

  private clearPointVisualFields() {
    this.form.icono = '';
    this.form.iconoFuente = '';
    this.form.iconoClase = '';
    this.form.tamanoIcono = null;
  }

  private resolveShapeBaseForPayload(): string | null {
    if (this.geometryMode === 'linestring') return 'line';
    if (this.geometryMode === 'polygon') return 'polygon';
    return this.cleanString(this.form.shapeBase);
  }

  private isMaterialSource(source: string): boolean {
    return (
      source === 'material-symbols-outlined' ||
      source === 'material-symbols-rounded' ||
      source === 'material-symbols-sharp' ||
      source === 'material symbols' ||
      source === 'material-symbols'
    );
  }

  private isCssClassSource(source: string): boolean {
    return source === 'class' || source === 'css' || source === 'primeicons' || source === 'fontawesome' || source === 'mdi';
  }

  private isUrlSource(source: string): boolean {
    return source === 'url' || source === 'image' || source === 'img';
  }

  private isPresetSource(source: string): boolean {
    return source === 'triangle' || source === 'target' || source === 'donut';
  }

  private toMaterialWeight(strokeWidth: number): number {
    const raw = strokeWidth > 10 ? strokeWidth : strokeWidth * 100;
    const snapped = Math.round(raw / 100) * 100;
    return Math.max(100, Math.min(700, snapped));
  }
}
