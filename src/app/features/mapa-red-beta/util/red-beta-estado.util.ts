/**
 * Mapeo de estados operativos a su representacion visual (colores, trazo) y helpers de geometria.
 * Centraliza la leyenda para que mapa, leyenda y paneles usen exactamente los mismos colores.
 */

export interface RedEstadoVisual {
  /** color principal (hex) */
  color: string;
  /** linea punteada en el mapa */
  dashed: boolean;
  /** mostrar tachado / inactivo (rechazado) */
  strike: boolean;
  /** etiqueta legible */
  label: string;
}

const DEFAULT_VISUAL: RedEstadoVisual = {
  color: '#64748b', // slate-500
  dashed: false,
  strike: false,
  label: 'Desconocido',
};

/**
 * Estados conocidos. Las claves coinciden con los valores guardados por el SQL maestro
 * (kxt_red_operativa_catalogo) y por las acciones del backend.
 */
const VISUALS: Record<string, RedEstadoVisual> = {
  'Sugerido por cursor': { color: '#2563eb', dashed: true, strike: false, label: 'Sugerido por cursor' }, // azul punteado
  'Sugerido por IA': { color: '#38bdf8', dashed: true, strike: false, label: 'Sugerido por IA' },          // celeste punteado
  'Supuesto ERP': { color: '#7c3aed', dashed: false, strike: false, label: 'Supuesto ERP' },               // morado
  'Validado oficina': { color: '#16a34a', dashed: false, strike: false, label: 'Validado oficina' },       // verde
  'Validado campo': { color: '#15803d', dashed: false, strike: false, label: 'Validado campo' },           // verde fuerte
  'Pendiente campo': { color: '#f97316', dashed: false, strike: false, label: 'Pendiente campo' },          // naranja
  'Pendiente validar': { color: '#fb923c', dashed: false, strike: false, label: 'Pendiente validar' },
  'Pendiente validar en campo': { color: '#f97316', dashed: false, strike: false, label: 'Pendiente validar en campo' },
  Conflicto: { color: '#dc2626', dashed: false, strike: false, label: 'Conflicto' },                        // rojo
  Rechazado: { color: '#9ca3af', dashed: false, strike: true, label: 'Rechazado' },                         // gris tachado
  Historico: { color: '#a78bfa', dashed: false, strike: true, label: 'Historico' },
};

/** Orden de la leyenda en pantalla. */
export const RED_ESTADOS_LEYENDA: string[] = [
  'Sugerido por cursor',
  'Sugerido por IA',
  'Supuesto ERP',
  'Validado oficina',
  'Validado campo',
  'Pendiente campo',
  'Conflicto',
  'Rechazado',
];

export function estadoVisual(estado: string | null | undefined): RedEstadoVisual {
  if (!estado) return DEFAULT_VISUAL;
  return VISUALS[estado] ?? DEFAULT_VISUAL;
}

export function esValidado(estado: string | null | undefined): boolean {
  return !!estado && estado.startsWith('Validado');
}

export function esConflicto(estado: string | null | undefined): boolean {
  return estado === 'Conflicto';
}

export function esPendienteCampo(estado: string | null | undefined): boolean {
  return estado === 'Pendiente campo' || estado === 'Pendiente validar en campo';
}

export function esRechazado(estado: string | null | undefined): boolean {
  return estado === 'Rechazado';
}

export function esSugerido(estado: string | null | undefined): boolean {
  return !!estado && (estado.startsWith('Sugerido') || estado === 'Supuesto ERP' || estado.startsWith('Pendiente'));
}

/**
 * Parsea el campo lat_lon ("lat,lon") que produce el backend (computeLatLon = centerY + "," + centerX).
 * Devuelve [lat, lon] o null si no es valido.
 */
export function parseLatLon(latLon: string | null | undefined): [number, number] | null {
  if (!latLon) return null;
  const parts = latLon.split(',').map((p) => Number(p.trim()));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  const [lat, lon] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lat, lon];
}
