export type ProveedorProspecto = {
  idImpProveedorProspecto?: number;
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
  condicionesGenerales?: string | null;
  estadoProspecto?: string | null;
  dniAdqProveedorFk?: number | null;
  bloqueado?: boolean | null;
  observacion?: string | null;
  usuGen?: number | null;
  fecGen?: string | null;
  usuFin?: number | null;
  fecFin?: string | null;
};

export type ProveedorProspectoContacto = {
  idImpProveedorProspectoContacto?: number;
  idImpProveedorProspectoFk: number;
  nombreContacto?: string | null;
  cargo?: string | null;
  correo?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  idioma?: string | null;
  principal?: boolean | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ProveedorProspectoDocumento = {
  idImpProveedorProspectoDocumento?: number;
  idImpProveedorProspectoFk: number;
  tipoDocumento: string;
  nombreArchivo?: string | null;
  rutaArchivo?: string | null;
  urlArchivo?: string | null;
  mimeType?: string | null;
  numeroDocumento?: string | null;
  fechaDocumento?: string | null;
  hashArchivo?: string | null;
  tamanoBytes?: number | null;
  versionDocumento?: number | null;
  vigente?: boolean | null;
  observacion?: string | null;
  fecFin?: string | null;
};

export type ProveedorProspectoGuardarRequest = Omit<ProveedorProspecto, 'idImpProveedorProspecto' | 'usuGen' | 'fecGen' | 'usuFin' | 'fecFin'>;
export type ProveedorProspectoEditarRequest = {
  idImpProveedorProspecto: number;
  cambios: Partial<ProveedorProspectoGuardarRequest>;
};

export type ProveedorProspectoContactoGuardarRequest = Omit<ProveedorProspectoContacto, 'idImpProveedorProspectoContacto' | 'fecFin'>;
export type ProveedorProspectoContactoEditarRequest = {
  idImpProveedorProspectoContacto: number;
  cambios: Partial<ProveedorProspectoContactoGuardarRequest>;
};

export type ProveedorProspectoDocumentoGuardarRequest = Omit<ProveedorProspectoDocumento, 'idImpProveedorProspectoDocumento' | 'fecFin'>;
export type ProveedorProspectoDocumentoEditarRequest = {
  idImpProveedorProspectoDocumento: number;
  cambios: Partial<ProveedorProspectoDocumentoGuardarRequest>;
};
