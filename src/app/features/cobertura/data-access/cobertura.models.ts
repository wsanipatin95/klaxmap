/**
 * Modelos de la vista de Cobertura (solo lectura).
 * NAP con clientes (de kxvp_red_cobertura_nap) + detalle por puerto del mapa viejo.
 */

/** kxvp_red_cobertura_nap — 1 fila por caja NAP con su conteo de clientes. */
export interface CoberturaNap {
  idGeoElemento: number;
  napCodigo?: string | null;
  napNombre?: string | null;
  nivelNap?: number | null; // 1 | 2
  radioM: number;
  lat?: number | null;
  lng?: number | null;
  totalClientes: number;
}

/** Cliente en una NAP (detalle por puerto, del modal del mapa viejo). */
export interface CoberturaNapCliente {
  puerto?: number | null;
  idContrato?: number | null;
  cliente?: string | null;
  documento?: string | null;
  estado?: string | null;
}

/** kxvp_red_cobertura_cliente — cliente por cercania GPS + su servicio real (OLT/PON/ONU). */
export interface CoberturaClienteGeo {
  idRedCoberturaCliente: number;
  idConContratoFk: number;
  documento?: string | null;   // cedula/RUC real
  clienteNombre?: string | null;
  estado?: string | null;
  estadoColor?: string | null;
  lat?: number | null;
  lng?: number | null;
  idGeoElementoFk?: number | null;
  napCodigo?: string | null;
  oltNombre?: string | null;
  lpuPosicion?: number | null;
  ponPuerto?: number | null;
  gponOnu?: number | null;
  onuEstado?: string | null;
  nivelNap?: number | null;
  distanciaM?: number | null;
  radioM: number;
  dentroRadio: boolean;
  fuente?: string | null;      // 'RED' | 'GPS'
  estadoGrupo?: number | null; // 1 activo | 2 cortado/suspension | 3 los demas
  calidad?: number | null;     // 0 sin gps | 1 gps a otro PON | 2 sin confirmar | 3 confirmado
}

/**
 * Metadatos visuales del elemento (del endpoint base-elemento del mapa real):
 * nombre corto (etiqueta), icono y colores, para pintar las NAP igual que el mapa original.
 */
export interface CoberturaElementoMeta {
  idGeoElemento: number;
  nombre?: string | null;
  etiqueta?: string | null;
  latLon?: string | null;
  icono?: string | null;
  colorStroke?: string | null;
  colorFill?: string | null;
  tipoCodigo?: string | null;
}

/** OLT para el picker del confirmador de PON (tarjeta "Elegí la OLT"). */
export interface CoberturaOlt {
  idRedOlt: number;
  nombre?: string | null;
  ip?: string | null;
}

/** LPU-PON de una OLT (tarjeta/puerto) para la grilla "Elegí LPU-PON". */
export interface CoberturaLpuPon {
  lpu?: number | null;      // tarjeta (lpu.posicion)
  pon: number;              // puerto PON (vlan.pon)
  napId?: number | null;    // NAP que ya lo tiene amarrado (null = libre)
  napCodigo?: string | null;
}

/** Amarre confirmado NAP <-> (OLT, tarjeta, PON) — kxt_red_nap_pon. */
export interface CoberturaNapPon {
  idRedNapPon?: number | null;
  idGeoElementoFk: number;
  idRedOltFk?: number | null;
  oltNombre?: string | null;
  lpu?: number | null;   // tarjeta
  pon: number;           // puerto
  usu?: string | null;
}

/** Zona (barrio) generada por clustering — kxvp_red_zona — para el coroplético. */
export interface CoberturaZona {
  idRedZona: number;
  geojson?: string | null;   // geometría del polígono en GeoJSON
  total: number;
  activos: number;
  cortados: number;
  otros: number;             // bajas / churn
  lat?: number | null;
  lng?: number | null;
}

/** Respuesta del endpoint /api/erp/mapa/elemento/{id}/clientes. */
export interface CoberturaNapClientes {
  idGeoElemento: number;
  idRedEquipo?: number | null;
  splitter: string; // "1/8" | "1/16"
  bloqueado: boolean;
  total: number;
  ocupados: number;
  disponibles: number;
  clientes: CoberturaNapCliente[];
}
