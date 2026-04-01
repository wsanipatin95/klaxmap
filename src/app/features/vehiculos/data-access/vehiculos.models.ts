import { ListQuery, Paged } from './vehiculos.shared';

export type JsonMap = Record<string, unknown>;
export type BooleanLike = boolean | number | null;

export interface VehTipoVehiculo {
  idVehTipoVehiculo: number;
  art?: number | null;
  tipoVehiculo?: string | null;
  atributos?: JsonMap | null;
  usuGen?: number | null;
  fecGen?: string | null;
  usuFin?: number | null;
  fecFin?: string | null;
}

export interface VehTipoVehiculoVista {
  idVehTipoVehiculoVista: number;
  idVehTipoVehiculoFk: number;
  vista?: string | null;
  estructura?: string | null;
  orden?: number | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
  usuGen?: number | null;
  fecGen?: string | null;
  usuFin?: number | null;
  fecFin?: string | null;
}

export interface VehCheckList {
  idVehVehiculoCheckList: number;
  nombreItem: string;
  categoria?: string | null;
  orden?: number | null;
  obligatorio?: BooleanLike;
  usuGen?: number | null;
  fecGen?: string | null;
  usuFin?: number | null;
  fecFin?: string | null;
}

export interface VehCheckListVehiculo {
  idVehVehiculoCheckListVehiculo: number;
  idVehVehiculoCheckListFk: number;
  idVehTipoVehiculoFk: number;
  usuGen?: number | null;
  fecGen?: string | null;
  usuFin?: number | null;
  fecFin?: string | null;
}

export interface VehCliente {
  idTaxDni?: number;
  dni?: number;
  ruc: string;
  nombre: string;
  idCiuParroquiaFk?: number | null;
  direccion?: string | null;
  email?: string | null;
  movil?: string | null;
  telefono?: string | null;
  observacion?: string | null;
  deuda?: number | null;
  credito?: number | null;
  fecNacimiento?: string | null;
  idTaxTipIdeFk?: string | null;
  repLegal?: string | null;
  representante?: string | null;
  cargo?: string | null;
  cen?: number | null;
  estadomor?: number | null;
  codemp?: number | null;
  codigru?: number | null;
  monto?: number | null;
  diascredi?: number | null;
  idCrmZonaSector?: number | null;
  numeroPrecio?: number | null;
  porcentajeDescuento?: number | null;
}

export interface CliVehiculo {
  idCliVehiculo: number;
  dni: number;
  idVehTipoVehiculoFk: number;
  placa?: string | null;
  marca: string;
  modelo: string;
  anio?: number | null;
  color?: string | null;
  numeroChasis?: string | null;
  numeroMotor?: string | null;
  cilindraje?: string | null;
  combustible?: string | null;
  transmision?: string | null;
  kilometraje?: number | null;
  numeroRuedas?: number | null;
  capacidadCarga?: number | null;
  tipoBateria?: string | null;
  voltajeBateria?: string | null;
  amperajeBateria?: string | null;
  potenciaMotor?: string | null;
  autonomiaKm?: number | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
}

export interface VehOrdenTrabajo {
  idVehOrdenTrabajo: number;
  dni: number;
  idCliVehiculoFk: number;
  tipoServicio?: string | null;
  estadoOrden?: string | null;
  fechaIngreso?: string | null;
  fechaPrometida?: string | null;
  kilometrajeIngreso?: number | null;
  nivelCombustible?: string | null;
  nivelBateria?: string | null;
  fallaReportada?: string | null;
  sintomasReportados?: string | null;
  ruidosReportados?: string | null;
  detalleCliente?: string | null;
  accesoriosEntregados?: string | null;
  condicionIngreso?: string | null;
  diagnosticoGeneral?: string | null;
  recomendacionGeneral?: string | null;
  responsableRecepcion?: number | null;
  responsableTecnico?: number | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
  fecGen?: string | null;

  ruc?: string | null;
  nombre?: string | null;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
}

export interface VehOrdenTrabajoCheckList {
  idVehOrdenTrabajoCheckList: number;
  idVehOrdenTrabajoFk: number;
  idVehVehiculoCheckListVehiculoFk: number;
  estadoCheckList?: string | null;
  observaciones?: string | null;
  usuGen?: number | null;
  fecGen?: string | null;
  usuFin?: number | null;
  fecFin?: string | null;
}

export interface VehOrdenTrabajoTrabajo {
  idVehOrdenTrabajoTrabajo: number;
  idVehOrdenTrabajoFk: number;
  tipoTrabajo?: string | null;
  descripcionInicial?: string | null;
  descripcionRealizada?: string | null;
  resultado?: string | null;
  estadoTrabajo?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
}

export interface VehOrdenTrabajoHallazgo {
  idVehOrdenTrabajoHallazgo: number;
  idVehOrdenTrabajoFk: number;
  idVehOrdenTrabajoTrabajoFk?: number | null;
  tipoHallazgo?: string | null;
  categoria?: string | null;
  descripcion: string;
  severidad?: string | null;
  estadoHallazgo?: string | null;
  requiereCambio?: BooleanLike;
  motivoCambio?: string | null;
  aprobadoCliente?: BooleanLike;
  fechaAprobacion?: string | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
}

export interface VehOrdenTrabajoHallazgoMarca {
  idVehOrdenTrabajoHallazgoMarca: number;
  idVehOrdenTrabajoHallazgoFk: number;
  idVehTipoVehiculoVistaFk: number;
  tipoMarca?: string | null;
  geometria?: JsonMap | null;
  color?: string | null;
  observaciones?: string | null;
}

export interface VehOrdenTrabajoHallazgoFoto {
  idVehOrdenTrabajoHallazgoFoto: number;
  idVehOrdenTrabajoHallazgoFk: number;
  etapa?: string | null;
  foto?: string | null;
  descripcion?: string | null;
  principal?: BooleanLike;
  urlArchivo?: string | null;
}

export interface VehOrdenTrabajoRepuesto {
  idVehOrdenTrabajoRepuesto: number;
  idVehOrdenTrabajoFk: number;
  art: number;
  cantidad: number;
  precioUnitario: number;
  motivoCambio?: string | null;
  detalleInstalacion?: string | null;
  serieAnterior?: string | null;
  serieNueva?: string | null;
  idFacVentaDetFk?: number | null;
  idFacVentaFk?: number | null;
  observaciones?: string | null;

  artcod?: string | null;
  articulo?: string | null;
  precio4?: number | null;
  saldo?: number | null;
  subtipo?: string | null;
  tipoArticulo?: string | null;
  categoriaArticulo?: string | null;
}

export interface VehOrdenTrabajoAutorizacion {
  idVehOrdenTrabajoAutorizacion: number;
  idVehOrdenTrabajoFk: number;
  tipoAutorizacion?: string | null;
  referenciaTabla?: string | null;
  referenciaId?: number | null;
  descripcion?: string | null;
  estadoAutorizacion?: string | null;
  fechaRespuesta?: string | null;
  observaciones?: string | null;
}

export interface VehOrdenTrabajoFactura {
  idVehOrdenTrabajoFactura: number;
  idVehOrdenTrabajoFk: number;
  idFacVentaFk: number;
  tipoFacturacion?: string | null;
  motivoFacturacion?: string | null;
  observaciones?: string | null;
}

export interface VehArticuloCatalogo {
  idActInventario: number;
  artcod?: string | null;
  articulo: string;
  artmen?: number | null;
  artmay?: number | null;
  artcom?: number | null;
  idActSubtipoFk?: number | null;
  eliminado?: string | null;
  saldo?: number | null;
  subtipo?: string | null;
  inventariable?: string | null;
  idCntPlanTransito?: number | null;
  idCntPlanCosto?: number | null;
  idCntPlanInventario?: number | null;
  idCntIva?: number | null;
  porcentaje?: number | null;
  tipoArticulo?: string | null;
  categoriaArticulo?: string | null;
  txtInventariable?: string | null;
  visibleApp?: number | null;
  precio3?: number | null;
  precio4?: number | null;
}

export interface VehFactura {
  idFacVenta: number;
  cen?: number | null;
  usu?: number | null;
  tra?: number | null;
  dni?: number | null;
  fecEmi?: string | null;
  observacion?: string | null;
  estab?: number | null;
  ptoemi?: number | null;
  secuencial?: number | null;
  baseImponible?: number | null;
  iva?: number | null;
  ivaPorcentaje?: number | null;
  baseCero?: number | null;
  descuento?: number | null;
  total?: number | null;
  costoVenta?: number | null;
  cxc?: number | null;
  cxcDeuda?: number | null;
  sriEstado?: string | null;
  entrada?: number | null;
  cuotas?: number | null;
  despInmediato?: number | null;
  idTaxCompAutFk?: number | null;
}

export interface VehFacturaDet {
  idFacVentaDet: number;
  idFacVentaFk: number;
  unidades?: number | null;
  valuni?: number | null;
  valcom?: number | null;
  descuento?: number | null;
  art?: number | null;
  detalle?: string | null;
  iva?: number | null;
  ivaPorcen?: number | null;
  idConPlanFk?: number | null;
  observaciones?: string | null;
}

export interface VehCobro {
  idFacVentaCobro: number;
  tra?: number | null;
  fecha?: string | null;
  valor?: number | null;
  usu?: number | null;
  idFacArqueoCajaFk?: number | null;
  cen?: number | null;
  idBanDocBancoFk?: number | null;
  idCntFormaPagoFk?: number | null;
  traCash?: string | null;
  concepto?: string | null;
  reverso?: number | null;
  idBanBancoFk?: number | null;
  idBanBancoSubFk?: number | null;
  idTaxTarjetaDiferidoFk?: number | null;
  idBanTarjetaFk?: number | null;
  referenciaDatafast?: string | null;
}

export interface VehCaja {
  idFacCaja: number;
  idAdmPtoemiFk?: number | null;
  cajaFec?: string | null;
  cajaUsu?: number | null;
  saldoCaja?: number | null;
  arqueo?: number | null;
  arqueoDif?: number | null;
  cierreDif?: number | null;
  estado?: string | null;
  comentario?: string | null;
}

export interface VehPtoemi {
  idAdmPtoemi: number;
  cen?: number | null;
  ptoemi?: string | null;
  ptoemiNum?: number | null;
  cajaVirtual?: boolean | null;
  establecimiento?: number | null;
  ptoemiUsuario?: string | null;
  puntoEmision?: string | null;
  modo?: number | null;
}

/* ======== REQUESTS ======== */

export interface VehTipoVehiculoGuardarRequest {
  art?: number | null;
  tipoVehiculo?: string | null;
  atributos?: JsonMap | null;
}
export interface VehTipoVehiculoEditarRequest {
  idVehTipoVehiculo: number;
  cambios: Partial<VehTipoVehiculoGuardarRequest>;
}
export interface VehTipoVehiculoVistaGuardarRequest {
  idVehTipoVehiculoFk: number;
  vista?: string | null;
  estructura?: string | null;
  orden?: number | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
}
export interface VehTipoVehiculoVistaEditarRequest {
  idVehTipoVehiculoVista: number;
  cambios: Partial<VehTipoVehiculoVistaGuardarRequest>;
}
export interface VehCheckListGuardarRequest {
  nombreItem: string;
  categoria?: string | null;
  orden?: number | null;
  obligatorio?: BooleanLike;
}
export interface VehCheckListEditarRequest {
  idVehVehiculoCheckList: number;
  cambios: Partial<VehCheckListGuardarRequest>;
}
export interface VehCheckListVehiculoGuardarRequest {
  idVehVehiculoCheckListFk: number;
  idVehTipoVehiculoFk: number;
}
export interface VehCheckListVehiculoEditarRequest {
  idVehVehiculoCheckListVehiculo: number;
  cambios: Partial<VehCheckListVehiculoGuardarRequest>;
}
export interface VehClienteGuardarRequest {
  ruc: string;
  nombre: string;
  idCiuParroquiaFk?: number | null;
  direccion?: string | null;
  email?: string | null;
  movil?: string | null;
  telefono?: string | null;
  observacion?: string | null;
  deuda?: number | null;
  credito?: number | null;
  fecNacimiento?: string | null;
  idTaxTipIdeFk?: string | null;
  repLegal?: string | null;
  representante?: string | null;
  cargo?: string | null;
  cen?: number | null;
  estadomor?: number | null;
  codemp?: number | null;
  codigru?: number | null;
  monto?: number | null;
  diascredi?: number | null;
  idCrmZonaSector?: number | null;
  numeroPrecio?: number | null;
  porcentajeDescuento?: number | null;
}
export interface VehClienteEditarRequest {
  dni: number;
  cambiosTax?: JsonMap;
  cambiosCli?: JsonMap;
}
export interface CliVehiculoGuardarRequest {
  dni: number;
  idVehTipoVehiculoFk: number;
  placa?: string | null;
  marca: string;
  modelo: string;
  anio?: number | null;
  color?: string | null;
  numeroChasis?: string | null;
  numeroMotor?: string | null;
  cilindraje?: string | null;
  combustible?: string | null;
  transmision?: string | null;
  kilometraje?: number | null;
  numeroRuedas?: number | null;
  capacidadCarga?: number | null;
  tipoBateria?: string | null;
  voltajeBateria?: string | null;
  amperajeBateria?: string | null;
  potenciaMotor?: string | null;
  autonomiaKm?: number | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
}
export interface CliVehiculoEditarRequest {
  idCliVehiculo: number;
  cambios: Partial<CliVehiculoGuardarRequest>;
}
export interface VehOrdenTrabajoGuardarRequest {
  dni: number;
  idCliVehiculoFk: number;
  tipoServicio?: string | null;
  estadoOrden?: string | null;
  fechaIngreso?: string | null;
  fechaPrometida?: string | null;
  kilometrajeIngreso?: number | null;
  nivelCombustible?: string | null;
  nivelBateria?: string | null;
  fallaReportada?: string | null;
  sintomasReportados?: string | null;
  ruidosReportados?: string | null;
  detalleCliente?: string | null;
  accesoriosEntregados?: string | null;
  condicionIngreso?: string | null;
  diagnosticoGeneral?: string | null;
  recomendacionGeneral?: string | null;
  responsableRecepcion?: number | null;
  responsableTecnico?: number | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
}
export interface VehOrdenTrabajoEditarRequest {
  idVehOrdenTrabajo: number;
  cambios: Partial<VehOrdenTrabajoGuardarRequest>;
}
export interface VehOrdenTrabajoCheckListGuardarRequest {
  idVehOrdenTrabajoFk: number;
  idVehVehiculoCheckListVehiculoFk: number;
  estadoCheckList?: string | null;
  observaciones?: string | null;
}
export interface VehOrdenTrabajoCheckListEditarRequest {
  idVehOrdenTrabajoCheckList: number;
  cambios: Partial<VehOrdenTrabajoCheckListGuardarRequest>;
}
export interface VehOrdenTrabajoTrabajoGuardarRequest {
  idVehOrdenTrabajoFk: number;
  tipoTrabajo?: string | null;
  descripcionInicial?: string | null;
  descripcionRealizada?: string | null;
  resultado?: string | null;
  estadoTrabajo?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  motivo?: string | null;
  observaciones?: string | null;
}
export interface VehOrdenTrabajoTrabajoEditarRequest {
  idVehOrdenTrabajoTrabajo: number;
  cambios: Partial<VehOrdenTrabajoTrabajoGuardarRequest>;
}
export interface VehOrdenTrabajoHallazgoGuardarRequest {
  idVehOrdenTrabajoFk: number;
  idVehOrdenTrabajoTrabajoFk?: number | null;
  tipoHallazgo?: string | null;
  categoria?: string | null;
  descripcion: string;
  severidad?: string | null;
  estadoHallazgo?: string | null;
  requiereCambio?: BooleanLike;
  motivoCambio?: string | null;
  aprobadoCliente?: BooleanLike;
  fechaAprobacion?: string | null;
  observaciones?: string | null;
  atributos?: JsonMap | null;
}
export interface VehOrdenTrabajoHallazgoEditarRequest {
  idVehOrdenTrabajoHallazgo: number;
  cambios: Partial<VehOrdenTrabajoHallazgoGuardarRequest>;
}
export interface VehOrdenTrabajoHallazgoMarcaGuardarRequest {
  idVehOrdenTrabajoHallazgoFk: number;
  idVehTipoVehiculoVistaFk: number;
  tipoMarca?: string | null;
  geometria?: JsonMap | null;
  color?: string | null;
  observaciones?: string | null;
}
export interface VehOrdenTrabajoHallazgoMarcaEditarRequest {
  idVehOrdenTrabajoHallazgoMarca: number;
  cambios: Partial<VehOrdenTrabajoHallazgoMarcaGuardarRequest>;
}
export interface VehOrdenTrabajoHallazgoFotoGuardarRequest {
  idVehOrdenTrabajoHallazgoFk: number;
  etapa?: string | null;
  foto?: string | null;
  descripcion?: string | null;
  principal?: BooleanLike;
}
export interface VehOrdenTrabajoHallazgoFotoEditarRequest {
  idVehOrdenTrabajoHallazgoFoto: number;
  cambios: Partial<VehOrdenTrabajoHallazgoFotoGuardarRequest>;
}
export interface VehOrdenTrabajoRepuestoGuardarRequest {
  idVehOrdenTrabajoFk: number;
  art: number;
  cantidad: number;
  precioUnitario: number;
  motivoCambio?: string | null;
  detalleInstalacion?: string | null;
  serieAnterior?: string | null;
  serieNueva?: string | null;
  idFacVentaDetFk?: number | null;
  idFacVentaFk?: number | null;
  observaciones?: string | null;
}
export interface VehOrdenTrabajoRepuestoEditarRequest {
  idVehOrdenTrabajoRepuesto: number;
  cambios: Partial<VehOrdenTrabajoRepuestoGuardarRequest>;
}
export interface VehOrdenTrabajoAutorizacionGuardarRequest {
  idVehOrdenTrabajoFk: number;
  tipoAutorizacion?: string | null;
  referenciaTabla?: string | null;
  referenciaId?: number | null;
  descripcion?: string | null;
  estadoAutorizacion?: string | null;
  fechaRespuesta?: string | null;
  observaciones?: string | null;
}
export interface VehOrdenTrabajoAutorizacionEditarRequest {
  idVehOrdenTrabajoAutorizacion: number;
  cambios: Partial<VehOrdenTrabajoAutorizacionGuardarRequest>;
}
export interface VehOrdenTrabajoFacturaGuardarRequest {
  idVehOrdenTrabajoFk: number;
  idFacVentaFk: number;
  tipoFacturacion?: string | null;
  motivoFacturacion?: string | null;
  observaciones?: string | null;
}
export interface VehOrdenTrabajoFacturaEditarRequest {
  idVehOrdenTrabajoFactura: number;
  cambios: Partial<VehOrdenTrabajoFacturaGuardarRequest>;
}
export interface VehFacturaCrearRequest {
  idVehOrdenTrabajoFk: number;
  idsVehOrdenTrabajoRepuesto?: number[] | null;
  tipoFacturacion?: string | null;
  observacion?: string | null;
  dni?: number | null;
  cen?: number | null;
  idAdmPtoemi?: number | null;
  credito?: boolean | null;
  entrada?: number | null;
  cuotas?: number | null;
  fechaPrimerVencimiento?: string | null;
  idTaxCompAutFk?: number | null;
  usarPrecioRepuesto?: boolean | null;
}
export interface VehCajaAsegurarRequest {
  idAdmPtoemi?: number | null;
  cen?: number | null;
  cajaUsu?: number | null;
  saldoCaja?: number | null;
  comentario?: string | null;
  estadoInicial?: string | null;
}
export interface VehCobroCrearRequest {
  idFacVenta: number;
  valor: number;
  fecha?: string | null;
  usu?: number | null;
  cen?: number | null;
  idAdmPtoemi?: number | null;
  idFacCaja?: number | null;
  concepto?: string | null;
  idCntFormaPagoFk?: number | null;
  idBanDocBancoFk?: number | null;
  traCash?: string | null;
  idBanBancoFk?: number | null;
  idBanBancoSubFk?: number | null;
  idTaxTarjetaDiferidoFk?: number | null;
  idBanTarjetaFk?: number | null;
  referenciaDatafast?: string | null;
  idBanDocumentoFk?: number | null;
  crearCajaSiNoExiste?: boolean | null;
  idsFacVentaCxc?: number[] | null;
  contabilizar?: boolean | null;
  idCntPlanFormaPagoFk?: number | null;
  idCntTipoFk?: number | null;
}
export interface VehFacturaContabilizarRequest {
  idFacVenta: number;
  idCntTipoFk?: number | null;
  fechaContable?: string | null;
  concepto?: string | null;
}
export interface VehFacturacionWorkflowRequest {
  idVehOrdenTrabajoFk: number;
  idAdmPtoemiFk?: number | null;
  idsVehOrdenTrabajoRepuesto?: number[] | null;
  observacionFactura?: string | null;
  tipoFacturacion?: string | null;
  dni?: number | null;
  cen?: number | null;
  credito?: boolean | null;
  pagoInicial?: number | null;
  cuotas?: number | null;
  fechaEmisionIso?: string | null;
  fechaPrimerVencimientoIso?: string | null;
  idTaxCompAutFk?: number | null;
  usarPrecioRepuesto?: boolean | null;
  idCntFormaPagoFk?: number | null;
  idCntPlanFormaPagoFk?: number | null;
  idBanDocBancoFk?: number | null;
  idBanBancoFk?: number | null;
  idBanBancoSubFk?: number | null;
  idTaxTarjetaDiferidoFk?: number | null;
  idBanTarjetaFk?: number | null;
  referenciaDatafast?: string | null;
  traCash?: string | null;
  crearRecibo?: boolean | null;
  contabilizarFactura?: boolean | null;
  contabilizarCobro?: boolean | null;
  conceptoFactura?: string | null;
  conceptoCobro?: string | null;
  usu?: number | null;
}
export interface VehFacturacionWorkflowResultado {
  idVehOrdenTrabajoFk?: number | null;
  idAdmPtoemiFk?: number | null;
  idFacCaja?: number | null;
  estadoCaja?: string | null;
  idFacVenta?: number | null;
  secuencial?: number | null;
  subtotalCero?: number | null;
  subtotalIva?: number | null;
  iva?: number | null;
  descuento?: number | null;
  total?: number | null;
  pagoInicial?: number | null;
  saldoPendiente?: number | null;
  idFacVentaCobro?: number | null;
  traFactura?: number | null;
  traCobro?: number | null;
  estadoOrdenSugerido?: string | null;
  detallesFacturados?: Array<Record<string, unknown>>;
}

export interface DashboardMetric {
  label: string;
  value: number | string;
  hint?: string;
  icon?: string;
}

export interface DashboardBundle {
  ordenes: Paged<VehOrdenTrabajo>;
  clientes: Paged<VehCliente>;
  vehiculos: Paged<CliVehiculo>;
  facturas: Paged<VehFactura>;
  cobros: Paged<VehCobro>;
  tipos: Paged<VehTipoVehiculo>;
  articulos: Paged<VehArticuloCatalogo>;
}

export interface VehiculosRouteMeta {
  label: string;
  route: string;
  icon: string;
  description: string;
}

export type VehiculosListQuery = ListQuery;
export interface SegUsuarioListadoItem {
  idSegUsuario: number;
  usuario: string;
  idNomNominaFk?: number | null;
  estado?: boolean | null;
}