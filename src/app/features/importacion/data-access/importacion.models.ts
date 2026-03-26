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
  observacion?: string | null;
}

export interface ImpProveedorArticuloProspecto {
  idImpProveedorArticuloProspecto: number;
  nombreArticuloProveedor: string;
  observacion?: string | null;
}

export interface ImpOfertaProveedor {
  idImpOfertaProveedor: number;
  numeroDocumento?: string | null;
  observacion?: string | null;
}

export interface ImpSolicitudGeneral {
  idImpSolicitudGeneral: number;
  codigoSolicitud: string;
  nombreSolicitud: string;
  observacion?: string | null;
}

export interface ImpResumenSolicitud {
  solicitud: ImpSolicitudGeneral;
  detalles: any[];
  ofertas: any[];
  selecciones: any[];
  fichas: any[];
}
