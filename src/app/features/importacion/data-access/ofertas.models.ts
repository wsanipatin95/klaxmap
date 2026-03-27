export type OfertaProveedor = {
  idImpOfertaProveedor?: number;
  tipoOferta: string;
  numeroVersion?: number | null;
  versionOferta?: number | null;
  idImpOfertaProveedorOrigenFk?: number | null;
  idImpProveedorProspectoFk?: number | null;
  dniAdqProveedorFk?: number | null;
  numeroDocumento?: string | null;
  fechaOferta?: string | null;
  fechaVigenciaDesde?: string | null;
  fechaVigenciaHasta?: string | null;
  fechaVigencia?: string | null;
  idMonMonedaFk: number;
  incoterm?: string | null;
  lugarEntrega?: string | null;
  formaPago?: string | null;
  tiempoEntregaDias?: number | null;
  observacion?: string | null;
  estadoOferta?: string | null;
  vigente?: boolean | null;
  disponibleParaSondeo?: boolean | null;
  bloqueadaParaSondeo?: boolean | null;
  idImpSolicitudGeneralBloqueoFk?: number | null;
};

export type OfertaProveedorDetalle = {
  idImpOfertaProveedorDetalle?: number;
  idImpOfertaProveedorFk?: number;
  idImpArticuloProspectoFk?: number | null;
  idActInventarioFk?: number | null;
  codigoArticuloProveedor?: string | null;
  descripcionItem: string;
  color?: string | null;
  tamano?: string | null;
  cantidadMinima?: number | null;
  cantidadOfertada: number;
  idActInventarioUnidadFk: string;
  precioUnitario?: number | null;
  descuentoPct?: number | null;
  subtotal?: number | null;
  paisOrigenFk?: number | null;
  pesoUnitario?: number | null;
  cbmUnitario?: number | null;
  idImpCodigoArancelarioFk?: number | null;
  observacion?: string | null;
};

export type OfertaProveedorPacking = {
  idImpOfertaProveedorDetalleFk?: number | null;
  detalleIndex?: number | null;
  tipoEmpaque?: string | null;
  cantidadPorEmpaque?: number | null;
  largo?: number | null;
  ancho?: number | null;
  alto?: number | null;
  cbm?: number | null;
  pesoBruto?: number | null;
  pesoNeto?: number | null;
  observacion?: string | null;
};

export type OfertaProveedorPackingResumen = {
  ordenResumen?: number | null;
  tipoBulto?: string | null;
  cantidadBultos?: number | null;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  cbmTotal?: number | null;
  pesoBrutoTotal?: number | null;
  pesoNetoTotal?: number | null;
  observacion?: string | null;
};

export type OfertaProveedorDocumento = {
  idImpOfertaProveedorDocumento?: number;
  idImpOfertaProveedorFk: number;
  tipoDocumento: string;
  nombreArchivo?: string | null;
  rutaArchivo?: string | null;
  urlArchivo?: string | null;
  mimeType?: string | null;
  numeroDocumento?: string | null;
  hashArchivo?: string | null;
  tamanoBytes?: number | null;
  versionDocumento?: number | null;
  fechaDocumento?: string | null;
  vigente?: boolean | null;
  observacion?: string | null;
};

export type OfertaProveedorGuardarRequest = OfertaProveedor & {
  detalles: OfertaProveedorDetalle[];
  packings?: OfertaProveedorPacking[];
  packingResumenes?: OfertaProveedorPackingResumen[];
  reemplazarOrigen?: boolean | null;
};

export type OfertaProveedorVersionarRequest = {
  idImpOfertaProveedorOrigenFk: number;
  numeroVersion?: number | null;
  versionOferta?: number | null;
  numeroDocumento?: string | null;
  fechaOferta?: string | null;
  fechaVigenciaDesde?: string | null;
  fechaVigenciaHasta?: string | null;
  fechaVigencia?: string | null;
  idMonMonedaFk?: number | null;
  incoterm?: string | null;
  lugarEntrega?: string | null;
  tiempoEntregaDias?: number | null;
  formaPago?: string | null;
  vigente?: boolean | null;
  idImpSolicitudGeneralBloqueoFk?: number | null;
  observacion?: string | null;
  reemplazarOrigen?: boolean | null;
  detalles?: OfertaProveedorDetalle[];
  packings?: OfertaProveedorPacking[];
  packingResumenes?: OfertaProveedorPackingResumen[];
};

export type OfertaProveedorEditarRequest = {
  idImpOfertaProveedor: number;
  cambios: Partial<OfertaProveedor>;
};
