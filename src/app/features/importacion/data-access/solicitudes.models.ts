export type SolicitudGeneral = {
  idImpSolicitudGeneral?: number;
  codigoSolicitud: string;
  nombreSolicitud: string;
  descripcion?: string | null;
  versionSolicitud?: number | null;
  idImpSolicitudGeneralOrigenFk?: number | null;
  fechaSolicitud?: string | null;
  estadoSolicitud?: string | null;
  observacion?: string | null;
  cerrada?: boolean | null;
};

export type SolicitudGeneralDetalle = {
  idImpSolicitudGeneralDetalle?: number;
  idImpSolicitudGeneralFk?: number;
  idActInventarioFk?: number | null;
  descripcionRequerida: string;
  cantidadRequerida: number;
  idActInventarioUnidadFk: string;
  colorRequerido?: string | null;
  tamanoRequerido?: string | null;
  especificacionTecnica?: string | null;
  observacion?: string | null;
  estadoDetalle?: string | null;
};

export type SolicitudGeneralGuardarRequest = SolicitudGeneral & {
  detalles?: SolicitudGeneralDetalle[];
};

export type SolicitudGeneralEditarRequest = {
  idImpSolicitudGeneral: number;
  cambios: Partial<SolicitudGeneral>;
};

export type SolicitudAgregarOfertaRequest = {
  idImpSolicitudGeneralFk: number;
  idImpOfertaProveedorFk: number;
};

export type SolicitudSeleccionDetalleRequest = {
  idImpSolicitudGeneralFk: number;
  idImpSolicitudGeneralDetalleFk: number;
  idImpOfertaProveedorFk: number;
  idImpOfertaProveedorDetalleFk: number;
  dniAdqProveedorFk?: number | null;
  idImpProveedorProspectoFk?: number | null;
  idActInventarioFk?: number | null;
  cantidadFinal: number;
  idActInventarioUnidadFk?: string | null;
  precioUnitarioFinal: number;
  colorFinal?: string | null;
  tamanoFinal?: string | null;
  empaqueFinal?: string | null;
  observacion?: string | null;
};

export type SolicitudCerrarRequest = {
  idImpSolicitudGeneralFk: number;
  observacionCierre?: string | null;
};

export type SolicitudReabrirRequest = {
  idImpSolicitudGeneralFk: number;
  motivoReapertura: string;
};

export type SolicitudCrearVersionRequest = {
  idImpSolicitudGeneralFk: number;
  copiarRelacionesOferta?: boolean | null;
  copiarSoloOfertasSeleccionadas?: boolean | null;
  copiarSeleccionesBase?: boolean | null;
  liberarOfertasSeleccionadas?: boolean | null;
  conservarObservacionOrigen?: boolean | null;
  observacionNuevaVersion?: string | null;
};

export type WorkflowInconsistencia = {
  severidad: 'ERROR' | 'WARNING' | string;
  codigo: string;
  referenciaTipo: string;
  referenciaId?: number | null;
  mensaje: string;
};

export type WorkflowProveedorGrupo = {
  proveedorKey: string;
  dniAdqProveedorFk?: number | null;
  idImpProveedorProspectoFk?: number | null;
  totalDetallesSeleccionados: number;
  totalOfertasInvolucradas: number;
  montoTotal?: number | null;
  idImpFichaProveedorFinal?: number | null;
  estadoFicha?: string | null;
};

export type WorkflowValidacionCierre = {
  idImpSolicitudGeneral: number;
  codigoSolicitud: string;
  nombreSolicitud: string;
  estadoSolicitud: string;
  cerrada: boolean;
  totalDetalles: number;
  totalOfertasRelacionadas: number;
  totalSelecciones: number;
  totalFichas: number;
  detallesSinSeleccion: number;
  ofertasSeleccionadas: number;
  proveedoresAgrupados: number;
  puedeCerrar: boolean;
  inconsistencias: WorkflowInconsistencia[];
  proveedores: WorkflowProveedorGrupo[];
};

export type WorkflowResumenFicha = {
  idImpFichaProveedorFinal: number;
  idImpSolicitudGeneralFk: number;
  dniAdqProveedorFk?: number | null;
  idImpProveedorProspectoFk?: number | null;
  fechaGeneracion?: string | null;
  estadoFicha?: string | null;
  totalItems: number;
  subtotalEstimado?: number | null;
  detalles: Array<Record<string, unknown>>;
};

export type WorkflowVersionResultado = {
  idImpSolicitudGeneralOrigen: number;
  idImpSolicitudGeneralNueva: number;
  idImpSolicitudGeneralRaiz: number;
  versionNueva: number;
  codigoSolicitudNueva: string;
  nombreSolicitudNueva: string;
  estadoSolicitudNueva: string;
  detallesCopiados: number;
  ofertasRelacionadasCopiadas: number;
  seleccionesBaseCopiadas: number;
  ofertasSeleccionadasLiberadas: number;
};

export type WorkflowHistorialVersion = {
  idImpSolicitudGeneral: number;
  idImpSolicitudGeneralOrigenFk?: number | null;
  codigoSolicitud: string;
  nombreSolicitud: string;
  versionSolicitud: number;
  estadoSolicitud: string;
  cerrada: boolean;
  fechaSolicitud?: string | null;
  fechaCierre?: string | null;
  totalDetalles: number;
  totalOfertasRelacionadas: number;
  totalSelecciones: number;
  totalFichas: number;
};
