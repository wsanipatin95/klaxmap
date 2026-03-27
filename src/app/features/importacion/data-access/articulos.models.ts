export type ArticuloProspecto = {
  idImpProveedorArticuloProspecto?: number;
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
  precioReferencial?: number | null;
  idMonMonedaFk?: number | null;
  estadoProspecto?: string | null;
  clasificacionConfirmada?: boolean | null;
  idImpCodigoArancelarioFk?: number | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ArticuloImagen = {
  idImpProveedorArticuloProspectoImagen?: number;
  idImpProveedorArticuloProspectoFk: number;
  nombreArchivo?: string | null;
  rutaArchivo?: string | null;
  urlArchivo?: string | null;
  mimeType?: string | null;
  imagenPrincipal?: boolean | null;
  ordenVisual?: number | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ArticuloAtributo = {
  idImpProveedorArticuloProspectoAtributo?: number;
  idImpProveedorArticuloProspectoFk: number;
  nombreAtributo: string;
  valorAtributo?: string | null;
  unidadAtributo?: string | null;
  ordenVisual?: number | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ArticuloHomologacion = {
  idImpProveedorArticuloHomologacion?: number;
  idImpProveedorArticuloProspectoFk: number;
  idActInventarioFk?: number | null;
  idActInventarioUnidadFk?: number | null;
  idImpCodigoArancelarioFk?: number | null;
  clasificacionConfirmada?: boolean | null;
  estadoHomologacion?: string | null;
  vigente?: boolean | null;
  aplicarEnArticulo?: boolean | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ArticuloClasificacion = {
  idImpArticuloClasificacion?: number;
  idImpProveedorArticuloProspectoFk: number;
  idActInventarioFk?: number | null;
  idImpCodigoArancelarioFk: number;
  tipoClasificacion?: string | null;
  estadoClasificacion?: string | null;
  nivelConfianza?: number | null;
  clasificacionConfirmada?: boolean | null;
  sustentoClasificacion?: string | null;
  fechaClasificacion?: string | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ArticuloProspectoGuardarRequest = Omit<ArticuloProspecto, 'idImpProveedorArticuloProspecto' | 'fecFin'>;
export type ArticuloProspectoEditarRequest = {
  idImpProveedorArticuloProspecto: number;
  cambios: Partial<ArticuloProspectoGuardarRequest>;
};

export type ArticuloImagenGuardarRequest = Omit<ArticuloImagen, 'idImpProveedorArticuloProspectoImagen' | 'fecFin'>;
export type ArticuloAtributoGuardarRequest = Omit<ArticuloAtributo, 'idImpProveedorArticuloProspectoAtributo' | 'fecFin'>;
export type ArticuloHomologacionGuardarRequest = Omit<ArticuloHomologacion, 'idImpProveedorArticuloHomologacion' | 'fecFin'>;
export type ArticuloClasificacionGuardarRequest = Omit<ArticuloClasificacion, 'idImpArticuloClasificacion' | 'fecFin'>;
