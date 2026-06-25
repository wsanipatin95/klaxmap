/**
 * Modelos de la beta de red operativa. Reflejan las vistas operativas kxvp_ expuestas por
 * el backend en /api/erp/red (no son las tablas base, son las vistas enriquecidas).
 */

/** kxvp_red_resumen_operativo */
export interface RedResumenItem {
  bloque: string;
  estado: string;
  total: number;
}

/** kxvp_red_elemento_relacion */
export interface RedElementoRelacion {
  idRedElementoRelacion: number;
  tipoRelacion: string;
  estadoRelacion: string;
  confianzaIa: number;
  origenRelacion: string;
  observacion?: string | null;
  fechaValidacion?: string | null;
  validadoPor?: number | null;
  idOrigen?: number | null;
  origenNombre?: string | null;
  origenTipo?: string | null;
  origenLatLon?: string | null;
  idDestino?: number | null;
  destinoNombre?: string | null;
  destinoTipo?: string | null;
  destinoLatLon?: string | null;
  idRedNodoOrigen?: number | null;
  nodoOrigen?: string | null;
  pathOrigen?: string | null;
  idRedNodoDestino?: number | null;
  nodoDestino?: string | null;
  pathDestino?: string | null;
  payloadSugerencia?: Record<string, unknown> | null;
  fecGen?: string | null;
  fecFin?: string | null;
}

/** kxvp_red_pon_elemento_relacion */
export interface RedPonElementoRelacion {
  idRedPonElementoRelacion: number;
  idRedVlanFk: number;
  tipoRelacion: string;
  estadoRelacion: string;
  confianzaIa: number;
  origenRelacion: string;
  observacion?: string | null;
  fechaValidacion?: string | null;
  validadoPor?: number | null;
  idGeoElementoFk?: number | null;
  elementoNombre?: string | null;
  elementoTipo?: string | null;
  elementoLatLon?: string | null;
  idRedNodo?: number | null;
  nodo?: string | null;
  pathCache?: string | null;
  idRedElementoRelacionFk?: number | null;
  relacionFisicaTipo?: string | null;
  relacionFisicaEstado?: string | null;
  payloadSugerencia?: Record<string, unknown> | null;
  fecGen?: string | null;
  fecFin?: string | null;
}

/** kxvp_red_dispositivo_pasivo */
export interface RedDispositivoPasivo {
  idDispositivoPasivo: number;
  tipoDispositivo: string;
  nombreOperativo: string;
  ratioSplitter: string;
  estadoRatio: string;
  cantidadEntradas: number;
  cantidadSalidas: number;
  numeroDispositivoEnCaja: number;
  estadoDispositivo: string;
  confianzaIa: number;
  origenRegistro: string;
  observacion?: string | null;
  idContenedor?: number | null;
  contenedorNombre?: string | null;
  contenedorTipo?: string | null;
  contenedorLatLon?: string | null;
  idSplitterOrigen?: number | null;
  splitterOrigenNombre?: string | null;
  splitterOrigenLatLon?: string | null;
  idRedNodo?: number | null;
  nodo?: string | null;
  pathCache?: string | null;
  payloadSugerencia?: Record<string, unknown> | null;
  fecGen?: string | null;
  fecFin?: string | null;
}

/** kxvp_red_fo_hilo */
export interface RedFoHilo {
  idFoHilo: number;
  idGeoElementoFoFk: number;
  foNombre?: string | null;
  foTipo?: string | null;
  idRedNodo?: number | null;
  nodo?: string | null;
  pathCache?: string | null;
  numeroHilo: number;
  colorHilo: string;
  grupoTubo: number;
  estadoHilo: string;
  origenRegistro: string;
  observacion?: string | null;
  payloadSugerencia?: Record<string, unknown> | null;
  fecGen?: string | null;
  fecFin?: string | null;
}

/** kxvp_red_dispositivo_puerto */
export interface RedDispositivoPuerto {
  idDispositivoPuerto: number;
  idDispositivoPasivoFk: number;
  dispositivoNombre?: string | null;
  ratioSplitter?: string | null;
  estadoDispositivo?: string | null;
  tipoPuerto: string;
  numeroPuerto: number;
  nombrePuerto: string;
  estadoPuerto: string;
  idFoHiloFk?: number | null;
  numeroHilo?: number | null;
  colorHilo?: string | null;
  estadoHilo?: string | null;
  idGeoElementoDestinoFk?: number | null;
  destinoNombre?: string | null;
  destinoTipo?: string | null;
  idRedElementoRelacionFk?: number | null;
  observacion?: string | null;
  payloadSugerencia?: Record<string, unknown> | null;
  fecGen?: string | null;
  fecFin?: string | null;
}

/** Punto base del mapa fisico (lectura ligera de /api/erp/mapa/elemento). */
export interface RedBaseElemento {
  idGeoElemento: number;
  nombre: string;
  etiqueta?: string | null;
  latLon?: string | null;
  wkt?: string | null;
  geomTipo?: string | null;
  tipoCodigo?: string | null;
  icono?: string | null;
  colorFill?: string | null;
  colorStroke?: string | null;
  colorTexto?: string | null;
  strokeWidth?: number | null;
}

/** Acciones humanas que la beta puede ejecutar sobre una sugerencia. */
export type RedAccionKind =
  | 'validar-oficina'
  | 'validar-campo'
  | 'rechazar'
  | 'pendiente-campo'
  | 'confirmar-ratio'
  | 'no-encontrado';

export interface RedAccionEvento {
  kind: RedAccionKind;
  id: number;
  observacion?: string;
  ratioSplitter?: string;
  validadoEnCampo?: boolean;
}

/** Identificadores de capa para el control de visibilidad. */
export type RedCapaKey =
  | 'base'
  | 'relSugeridas'
  | 'relValidadas'
  | 'splitters'
  | 'hilos'
  | 'puertos'
  | 'ponFo'
  | 'conflictos'
  | 'pendienteCampo';
