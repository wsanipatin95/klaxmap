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
  origenWkt?: string | null;
  destinoWkt?: string | null;
  confianzaSugerida?: number | null;
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
  contenedorWkt?: string | null;
  splitterOrigenWkt?: string | null;
  confianzaSugerida?: number | null;
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
  foLatLon?: string | null;
  foWkt?: string | null;
  fechaValidacion?: string | null;
  validadoPor?: number | null;
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
  | 'no-encontrado'
  | 'hilo-estado'
  | 'puerto-estado'
  | 'asociar-hilo'
  | 'asociar-destino'
  | 'pon-validar-oficina'
  | 'pon-validar-campo'
  | 'pon-pendiente-campo'
  | 'pon-rechazar';

export interface RedAccionEvento {
  kind: RedAccionKind;
  id: number;
  observacion?: string;
  ratioSplitter?: string;
  validadoEnCampo?: boolean;
  estadoNuevo?: string;
  idFoHilo?: number | null;
  idGeoElementoDestino?: number | null;
}

/** Destino navegable de una linea del anillo (estructuralmente compatible con RedSeleccion). */
export interface RedAnilloNav {
  tipo: 'base' | 'relacion' | 'splitter' | 'ponfo' | 'hilo' | 'puerto';
  data: unknown;
}

/** Linea del anillo operativo (padre/entrada, centro, hijos/salidas/destinos). */
export interface RedAnilloLinea {
  label: string;
  nombre?: string;
  estado?: string | null;
  vacio?: string;
  /** Si existe, la linea es clicable y navega a ese elemento (p.ej. un hilo, splitter o puerto). */
  sel?: RedAnilloNav;
  /** Color fisico del hilo (Azul, Verde...) para mostrar un swatch en el arbol. */
  color?: string;
}

/** Anillo operativo del elemento seleccionado. */
export interface RedAnillo {
  arribaLabel: string;
  arriba: RedAnilloLinea[];
  centro: string;
  abajoLabel: string;
  abajo: RedAnilloLinea[];
  faltantes: string[];
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
