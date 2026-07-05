
import type { DynamicMenuItem } from 'src/app/features/seg/store/session.store';

export type MapaEmbedMode = 'admin' | 'vendedor' | 'tecnico';

export interface MapaEmbedContext {
  mode: MapaEmbedMode;
  company: string;
  tenant: string;
  usu: number;
  usuario: string;

  lat?: number | null;
  lng?: number | null;
  direccion?: string | null;
  radioM?: number | null;

  trabajoId?: number | null;
  clienteId?: number | null;
  ordenId?: number | null;

  metadata?: Record<string, unknown> | null;
}

export interface MapaEmbedConfig {
  mode: MapaEmbedMode;
  tiposElemento: number[];
  distanciaM: number;
  acciones: string[];
  privilegios: Record<string, boolean>;
}

export interface MapaEmbedExchangeRequest {
  code: string;
}

export interface MapaEmbedExchangeResponse {
  token: string;
  usuario: string;
  usu: number;
  catalogo?: string | null;
  tipo?: number | null;
  organizacion?: unknown[] | null;

  contextPath?: string | null;
  environment?: string | null;

  privilegiosEmpresa?: string[] | null;
  menusEmpresa?: DynamicMenuItem[] | null;

  embed: MapaEmbedContext;
  embedConfig: MapaEmbedConfig;
}

export interface MapaElementoCercano {
  idGeoElemento: number;
  idRedNodoFk: number;
  idGeoTipoElementoFk: number;

  tipoCodigo?: string | null;
  tipoNombre?: string | null;

  icono?: string | null;
  iconoFuente?: string | null;
  iconoClase?: string | null;
  shapeBase?: string | null;
  colorFill?: string | null;
  colorStroke?: string | null;
  colorTexto?: string | null;
  strokeWidth?: number | null;
  zIndex?: number | null;
  tamanoIcono?: number | null;

  codigo?: string | null;
  nombre: string;
  descripcion?: string | null;
  etiqueta?: string | null;

  estado?: string | null;
  visible?: boolean | null;

  geomTipo?: 'point' | 'linestring' | 'polygon' | string | null;
  wkt?: string | null;
  latLon?: string | null;
  bbox?: string | null;

  longitudM?: number | null;
  areaM2?: number | null;
  ordenDibujo?: number | null;

  distanciaM?: number | null;
}

export interface MapaElementosCercanosResponse {
  mode: MapaEmbedMode;
  lat: number;
  lng: number;
  radioM: number;
  total: number;
  items: MapaElementoCercano[];
}

export interface MapaEmbedInitMessage {
  type: 'KLAX_MAP_INIT';
  mode?: MapaEmbedMode;
  lat?: number;
  lng?: number;
  direccion?: string;
  radioM?: number;
  trabajoId?: number;
  clienteId?: number;
  ordenId?: number;
  metadata?: Record<string, unknown>;
}


export interface MapaOtaCrearRequest {
  idGeoElemento: number;
  nivel?: string | null;
  clave: string;
}

export interface MapaOtaCrearResponse {
  ok: boolean;
  idTicket?: number | null;
  idOrden?: number | null;
  idRuta?: number | null;
  hora?: string | null;
  reutilizada?: boolean;
  rutaNueva?: boolean;
}

/** tipoCodigo de NAP elegibles para crear OT-A. */
export const OTA_TIPOS_ELEGIBLES = ['NAP_PROYECTADA', 'NAP_1ER_NIVEL', 'NAP_2DO_NIVEL'];
