import type { MapaElemento, MapaGeomTipo, MapaTipoElemento } from '../data-access/mapa.models';
import {
  normalizeMapaColor,
  normalizeMapaColorOrDefault,
} from './mapa-color.utils';

export interface MapaItemVisualPreview {
  mode: 'shape' | 'material' | 'class' | 'url';
  iconoFuente: string | null;
  icono: string | null;
  iconoClase: string | null;
  colorFill: string;
  colorStroke: string;
  colorTexto: string | null;
  strokeWidth: number;
  tamanoIcono: number;
  geomTipo: MapaGeomTipo;
}

export function resolveMapaTipoVisual(tipo: MapaTipoElemento): MapaItemVisualPreview {
  const geomTipo = normalizeGeomTipo(tipo.geometriaPermitida);
  return resolveVisualPreviewBase(
    {
      iconoFuente: tipo.iconoFuente,
      icono: tipo.icono,
      iconoClase: tipo.iconoClase,
      colorFill: tipo.colorFill,
      colorStroke: tipo.colorStroke,
      colorTexto: tipo.colorTexto,
      strokeWidth: tipo.strokeWidth,
      tamanoIcono: tipo.tamanoIcono,
    },
    geomTipo,
    {
      defaultStrokeWidth: 1,
      maxStrokeWidth: 6,
      defaultIconSize: 16,
      maxIconSize: 24,
    }
  );
}

export function resolveMapaElementoVisual(
  elemento: MapaElemento,
  tipo?: MapaTipoElemento | null
): MapaItemVisualPreview {
  return resolveVisualPreviewBase(
    {
      iconoFuente: elemento.iconoFuente || tipo?.iconoFuente,
      icono: elemento.icono || tipo?.icono,
      iconoClase: elemento.iconoClase || tipo?.iconoClase,
      colorFill: elemento.colorFill || tipo?.colorFill,
      colorStroke: elemento.colorStroke || tipo?.colorStroke,
      colorTexto: elemento.colorTexto || tipo?.colorTexto,
      strokeWidth: elemento.strokeWidth ?? tipo?.strokeWidth,
      tamanoIcono: elemento.tamanoIcono ?? tipo?.tamanoIcono,
    },
    normalizeGeomTipo(elemento.geomTipo),
    {
      defaultStrokeWidth: 1,
      maxStrokeWidth: 6,
      defaultIconSize: 16,
      maxIconSize: 24,
    }
  );
}

export function previewShapeClassForVisual(visual: MapaItemVisualPreview): string {
  if (visual.geomTipo === 'linestring') return 'is-line';
  if (visual.geomTipo === 'polygon') return 'is-polygon';

  if (visual.mode === 'material' || visual.mode === 'class' || visual.mode === 'url') {
    return 'is-icon-host';
  }

  const iconoFuente = String(visual.iconoFuente || '').toLowerCase();

  if (iconoFuente.includes('triangle')) return 'is-triangle';
  if (iconoFuente.includes('target')) return 'is-target';
  if (iconoFuente.includes('donut')) return 'is-donut';

  return 'is-point';
}

export function previewStyleForVisual(visual: MapaItemVisualPreview): Record<string, string> {
  return {
    '--preview-stroke': visual.colorStroke,
    '--preview-fill': visual.colorFill,
    '--preview-text': visual.colorTexto || visual.colorStroke,
    '--preview-size': `${visual.tamanoIcono}px`,
    '--preview-stroke-width': `${visual.strokeWidth}`,
    '--preview-stroke-width-px': `${visual.strokeWidth}px`,
  };
}

export function previewMaterialFamilyForVisual(visual: MapaItemVisualPreview): string {
  const source = String(visual.iconoFuente || '').toLowerCase();

  if (source.includes('rounded')) return 'material-symbols-rounded';
  if (source.includes('sharp')) return 'material-symbols-sharp';
  return 'material-symbols-outlined';
}

export function previewMaterialGlyphForVisual(visual: MapaItemVisualPreview): string {
  return visual.icono || 'radio_button_checked';
}

export function previewClassForVisual(visual: MapaItemVisualPreview): string {
  return visual.iconoClase || visual.icono || '';
}

export function previewImageUrlForVisual(visual: MapaItemVisualPreview): string {
  return visual.icono || '';
}

export function showMaterialPreviewForVisual(visual: MapaItemVisualPreview): boolean {
  return visual.mode === 'material';
}

export function showClassPreviewForVisual(visual: MapaItemVisualPreview): boolean {
  return visual.mode === 'class';
}

export function showUrlPreviewForVisual(visual: MapaItemVisualPreview): boolean {
  return visual.mode === 'url';
}

function resolveVisualPreviewBase(
  source: {
    iconoFuente?: string | null;
    icono?: string | null;
    iconoClase?: string | null;
    colorFill?: string | null;
    colorStroke?: string | null;
    colorTexto?: string | null;
    strokeWidth?: number | null;
    tamanoIcono?: number | null;
  },
  geomTipo: MapaGeomTipo,
  options: {
    defaultStrokeWidth: number;
    maxStrokeWidth: number;
    defaultIconSize: number;
    maxIconSize: number;
  }
): MapaItemVisualPreview {
  const iconoFuente = source.iconoFuente || null;
  const icono = source.icono || null;
  const iconoClase = source.iconoClase || null;

  const colorFill = normalizeMapaColorOrDefault(
    source.colorFill || source.colorStroke || null,
    '#f3aad6'
  );
  const colorStroke = normalizeMapaColorOrDefault(
    source.colorStroke || source.colorFill || null,
    '#7b0061'
  );
  const colorTexto = normalizeMapaColor(source.colorTexto, colorStroke) ?? colorStroke;

  const strokeWidthRaw = Number(source.strokeWidth ?? options.defaultStrokeWidth);
  const strokeWidth =
    Number.isFinite(strokeWidthRaw) && strokeWidthRaw > 0
      ? Math.max(1, Math.min(options.maxStrokeWidth, Math.round(strokeWidthRaw)))
      : options.defaultStrokeWidth;

  const tamanoIconoRaw = Number(source.tamanoIcono ?? options.defaultIconSize);
  const tamanoIcono =
    Number.isFinite(tamanoIconoRaw) && tamanoIconoRaw > 0
      ? Math.max(12, Math.min(options.maxIconSize, Math.round(tamanoIconoRaw)))
      : options.defaultIconSize;

  const normalizedSource = String(iconoFuente || '').trim().toLowerCase();

  let mode: MapaItemVisualPreview['mode'] = 'shape';

  if (isMaterialSource(normalizedSource)) {
    mode = 'material';
  } else if (isCssClassSource(normalizedSource) && !!(iconoClase || icono)) {
    mode = 'class';
  } else if (isUrlSource(normalizedSource, icono)) {
    mode = 'url';
  }

  return {
    mode,
    iconoFuente,
    icono,
    iconoClase,
    colorFill,
    colorStroke,
    colorTexto,
    strokeWidth,
    tamanoIcono,
    geomTipo,
  };
}

function normalizeGeomTipo(value: string | null | undefined): MapaGeomTipo {
  if (value === 'linestring') return 'linestring';
  if (value === 'polygon') return 'polygon';
  return 'point';
}

function isMaterialSource(source: string): boolean {
  return (
    source === 'material-symbols-outlined' ||
    source === 'material-symbols-rounded' ||
    source === 'material-symbols-sharp' ||
    source === 'material-symbols' ||
    source === 'material symbols' ||
    source === 'google' ||
    source === 'google-icons'
  );
}

function isCssClassSource(source: string): boolean {
  return (
    source === 'class' ||
    source === 'css' ||
    source === 'primeicons' ||
    source === 'fontawesome' ||
    source === 'mdi' ||
    source === 'fa'
  );
}

function isUrlSource(source: string, value: string | null): boolean {
  if (!value) return false;

  return (
    source === 'url' ||
    source === 'image' ||
    source === 'img' ||
    /^https?:\/\//i.test(value) ||
    /^data:image\//i.test(value) ||
    /^\/assets\//i.test(value)
  );
}
