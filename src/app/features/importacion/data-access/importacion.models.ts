export interface ApiResponse<T = any> {
  codigo: number;
  mensaje: string;
  data: T;
}

export interface CiuPais {
  idCiuPais: number;
  pais: string;
  extension?: string | null;
}

export interface GenMoneda {
  idGenMoneda: number;
  codigo: string;
  moneda: string;
  simbolo?: string | null;
  decimales?: number | null;
}

export interface ActInventarioUnidad {
  idActInventarioUnidad: number;
  unidad: string;
  abreviatura?: string | null;
}

export interface ImpProveedorProspecto {
  idImpProveedorProspecto: number;
  nombreProveedor: string;
  nombreComercial?: string | null;
  identificacion?: string | null;
  idCiuPaisFk?: number | null;
  ciudad?: string | null;
  direccion?: string | null;
  sitioWeb?: string | null;
  correoPrincipal?: string | null;
  telefonoPrincipal?: string | null;
  whatsapp?: string | null;
  observacion?: string | null;
  estadoProspecto?: string | null;
  dniAdqProveedorFk?: number | null;
}

export interface ImpProveedorProspectoContacto {
  idImpProveedorProspectoContacto: number;
  idImpProveedorProspectoFk: number;
  nombreContacto: string;
  cargo?: string | null;
  correo?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  idioma?: string | null;
  principal?: boolean | null;
  observacion?: string | null;
}

export interface ImpProveedorArticuloProspecto {
  idImpProveedorArticuloProspecto: number;
  idImpProveedorProspectoFk: number;
  codigoArticuloProveedor?: string | null;
  nombreArticuloProveedor: string;
  descripcionArticuloProveedor?: string | null;
  idActInventarioFk?: number | null;
  idActInventarioUnidadFk?: number | null;
  factorConversion?: number | null;
  cantidadPorEmpaque?: number | null;
  tipoEmpaque?: string | null;
  pesoUnitario?: number | null;
  cbmUnitario?: number | null;
  idCiuPaisOrigenFk?: number | null;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  tamano?: string | null;
  urlImagen?: string | null;
  observacion?: string | null;
  estadoProspecto?: string | null;
  clasificacionConfirmada?: boolean | null;
}

export interface ImpOfertaProveedor {
  idImpOfertaProveedor: number;
  idImpProveedorProspectoFk?: number | null;
  dniAdqProveedorFk?: number | null;
  tipoOferta: 'COTIZACION' | 'PROFORMA';
  numeroDocumento?: string | null;
  versionOferta?: number | null;
  fechaOferta?: string | null;
  fechaVigencia?: string | null;
  idMonMonedaFk?: number | null;
  incoterm?: string | null;
  lugarEntrega?: string | null;
  tiempoEntregaDias?: number | null;
  formaPago?: string | null;
  disponibleParaSondeo?: boolean | null;
  bloqueadaParaSondeo?: boolean | null;
  estadoOferta?: string | null;
  observacion?: string | null;
}

export interface ImpOfertaProveedorDetalle {
  idImpOfertaProveedorDetalle: number;
  idImpOfertaProveedorFk: number;
  idImpProveedorArticuloProspectoFk?: number | null;
  idActInventarioFk?: number | null;
  codigoArticuloProveedor?: string | null;
  descripcionProveedor?: string | null;
  cantidadOfertada?: number | null;
  idActInventarioUnidadFk?: number | null;
  precioUnitario?: number | null;
  descuentoPct?: number | null;
  subtotal?: number | null;
  pesoUnitario?: number | null;
  cbmUnitario?: number | null;
  cantidadPorEmpaque?: number | null;
  tipoEmpaque?: string | null;
  color?: string | null;
  tamano?: string | null;
  observacion?: string | null;
}

export interface ImpSolicitudGeneral {
  idImpSolicitudGeneral: number;
  codigoSolicitud: string;
  nombreSolicitud: string;
  versionSolicitud?: number | null;
  estadoSolicitud?: string | null;
  cerrada?: boolean | null;
  fechaSolicitud?: string | null;
  fechaCierre?: string | null;
  observacion?: string | null;
}

export interface ImpSolicitudGeneralDetalle {
  idImpSolicitudGeneralDetalle: number;
  idImpSolicitudGeneralFk: number;
  idActInventarioFk?: number | null;
  descripcionRequerida?: string | null;
  cantidadRequerida?: number | null;
  idActInventarioUnidadFk?: number | null;
  especificacionTecnica?: string | null;
  estadoDetalle?: string | null;
  observacion?: string | null;
}

export interface ImpSolicitudGeneralOferta {
  idImpSolicitudGeneralOferta: number;
  idImpSolicitudGeneralFk: number;
  idImpOfertaProveedorFk: number;
  seleccionada?: boolean | null;
  bloqueada?: boolean | null;
  motivoNoSeleccion?: string | null;
}

export interface ImpSolicitudGeneralSeleccionDetalle {
  idImpSolicitudGeneralSeleccionDetalle: number;
  idImpSolicitudGeneralFk: number;
  idImpSolicitudGeneralDetalleFk: number;
  idImpOfertaProveedorFk: number;
  idImpOfertaProveedorDetalleFk: number;
  dniAdqProveedorFk?: number | null;
  idImpProveedorProspectoFk?: number | null;
  idActInventarioFk?: number | null;
  cantidadFinal?: number | null;
  idActInventarioUnidadFk?: number | null;
  precioUnitarioFinal?: number | null;
  colorFinal?: string | null;
  tamanoFinal?: string | null;
  empaqueFinal?: string | null;
  estadoSeleccion?: string | null;
  observacion?: string | null;
}

export interface ImpFichaProveedorFinal {
  idImpFichaProveedorFinal: number;
  idImpSolicitudGeneralFk: number;
  dniAdqProveedorFk?: number | null;
  idImpProveedorProspectoFk?: number | null;
  fechaGeneracion?: string | null;
  estadoFicha?: string | null;
  observacion?: string | null;
}

export interface ImpResumenSolicitud {
  solicitud: ImpSolicitudGeneral;
  detalles: ImpSolicitudGeneralDetalle[];
  ofertas: ImpSolicitudGeneralOferta[];
  selecciones: ImpSolicitudGeneralSeleccionDetalle[];
  fichas: ImpFichaProveedorFinal[];
  stats?: {
    totalDetalles: number;
    detallesSeleccionados: number;
    totalOfertas: number;
    ofertasSeleccionadas: number;
    fichasActivas: number;
  };
}
