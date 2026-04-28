import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { buildListParams, ListQuery, Paged } from './vehiculos.shared';
import {
  CliVehiculo,
  CliVehiculoEditarRequest,
  CliVehiculoGuardarRequest,
  VehArticuloCatalogo,
  VehCaja,
  VehCajaAsegurarRequest,
  VehCheckList,
  VehCheckListEditarRequest,
  VehCheckListGuardarRequest,
  VehCheckListVehiculo,
  VehCheckListVehiculoEditarRequest,
  VehCheckListVehiculoGuardarRequest,
  VehCliente,
  VehClienteEditarRequest,
  VehClienteGuardarRequest,
  VehCobro,
  VehCobroCrearRequest,
  VehFactura,
  VehFacturaContabilizarRequest,
  VehFacturaCrearRequest,
  VehFacturacionWorkflowRequest,
  VehFacturacionWorkflowResultado,
  VehOrdenTrabajo,
  VehOrdenTrabajoAutorizacion,
  VehOrdenTrabajoAutorizacionEditarRequest,
  VehOrdenTrabajoAutorizacionGuardarRequest,
  VehOrdenTrabajoCheckList,
  VehOrdenTrabajoCheckListEditarRequest,
  VehOrdenTrabajoCheckListGuardarRequest,
  VehOrdenTrabajoEditarRequest,
  VehOrdenTrabajoFactura,
  VehOrdenTrabajoFacturaEditarRequest,
  VehOrdenTrabajoFacturaGuardarRequest,
  VehOrdenTrabajoGuardarRequest,
  VehOrdenTrabajoBitacoraItem,
  VehOrdenTrabajoBitacoraGuardarRequest,
  VehOrdenTrabajoHallazgo,
  VehOrdenTrabajoHallazgoEditarRequest,
  VehOrdenTrabajoHallazgoFoto,
  VehOrdenTrabajoHallazgoFotoEditarRequest,
  VehOrdenTrabajoHallazgoFotoGuardarRequest,
  VehOrdenTrabajoHallazgoGuardarRequest,
  VehOrdenTrabajoHallazgoMarca,
  VehOrdenTrabajoHallazgoMarcaEditarRequest,
  VehOrdenTrabajoHallazgoMarcaGuardarRequest,
  VehOrdenTrabajoRepuesto,
  VehOrdenTrabajoRepuestoEditarRequest,
  VehOrdenTrabajoRepuestoGuardarRequest,
  VehOrdenTrabajoTrabajo,
  VehOrdenTrabajoTrabajoEditarRequest,
  VehOrdenTrabajoTrabajoGuardarRequest,
  VehPtoemi,
  VehTipoVehiculo,
  VehTipoVehiculoEditarRequest,
  VehTipoVehiculoGuardarRequest,
  VehTipoVehiculoVista,
  VehTipoVehiculoVistaEditarRequest,
  VehTipoVehiculoVistaGuardarRequest,
  SegUsuarioListadoItem,
  VehFacturaDetalleResponse,
  VehGarantia,
  VehGarantiaDetalle,
  VehGarantiaMovimiento,
  VehGarantiaGuardarRequest,
  VehGarantiaEditarRequest,
  VehGarantiaDetalleGuardarRequest,
  VehGarantiaDetalleEditarRequest,
  VehGarantiaMovimientoGuardarRequest,
  VehGarantiaMovimientoEditarRequest
} from './vehiculos.models';

@Injectable({ providedIn: 'root' })
export class VehiculosApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private userBaseUrl = `${this.env.apiBaseUrl}/api/erp`;
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/veh`;
  private admBaseUrl = `${this.env.apiBaseUrl}/api/erp/klax/adm`;

  /* ===== Tipos ===== */
  listarTipos(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehTipoVehiculo>>>(`${this.baseUrl}/tipos-vehiculo`, { params: buildListParams(query) });
  }
  crearTipo(payload: VehTipoVehiculoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehTipoVehiculo: number }>>(`${this.baseUrl}/tipos-vehiculo`, payload);
  }
  editarTipo(payload: VehTipoVehiculoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehTipoVehiculo: number }>>(`${this.baseUrl}/tipos-vehiculo`, payload);
  }
  eliminarTipo(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehTipoVehiculo: number }>>(`${this.baseUrl}/tipos-vehiculo/${id}`);
  }

  listarVistas(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehTipoVehiculoVista>>>(`${this.baseUrl}/tipos-vehiculo-vistas`, { params: buildListParams(query) });
  }
  crearVista(payload: VehTipoVehiculoVistaGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehTipoVehiculoVista: number }>>(`${this.baseUrl}/tipos-vehiculo-vistas`, payload);
  }
  editarVista(payload: VehTipoVehiculoVistaEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehTipoVehiculoVista: number }>>(`${this.baseUrl}/tipos-vehiculo-vistas`, payload);
  }
  eliminarVista(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehTipoVehiculoVista: number }>>(`${this.baseUrl}/tipos-vehiculo-vistas/${id}`);
  }

  /* ===== Checklists ===== */
  listarChecklists(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehCheckList>>>(`${this.baseUrl}/check-lists`, { params: buildListParams(query) });
  }
  crearCheckList(payload: VehCheckListGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehVehiculoCheckList: number }>>(`${this.baseUrl}/check-lists`, payload);
  }
  editarCheckList(payload: VehCheckListEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehVehiculoCheckList: number }>>(`${this.baseUrl}/check-lists`, payload);
  }
  eliminarCheckList(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehVehiculoCheckList: number }>>(`${this.baseUrl}/check-lists/${id}`);
  }

  listarChecklistsVehiculo(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehCheckListVehiculo>>>(`${this.baseUrl}/check-lists-vehiculo`, { params: buildListParams(query) });
  }
  crearChecklistVehiculo(payload: VehCheckListVehiculoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehVehiculoCheckListVehiculo: number }>>(`${this.baseUrl}/check-lists-vehiculo`, payload);
  }
  editarChecklistVehiculo(payload: VehCheckListVehiculoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehVehiculoCheckListVehiculo: number }>>(`${this.baseUrl}/check-lists-vehiculo`, payload);
  }
  eliminarChecklistVehiculo(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehVehiculoCheckListVehiculo: number }>>(`${this.baseUrl}/check-lists-vehiculo/${id}`);
  }

  /* ===== Clientes ===== */
  listarClientes(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehCliente>>>(`${this.baseUrl}/clientes`, { params: buildListParams(query) });
  }
  crearCliente(payload: VehClienteGuardarRequest) {
    return this.http.post<ApiEnvelope<{ dni: number }>>(`${this.baseUrl}/clientes`, payload);
  }
  editarCliente(payload: VehClienteEditarRequest) {
    return this.http.patch<ApiEnvelope<{ dni: number }>>(`${this.baseUrl}/clientes`, payload);
  }
  eliminarCliente(dni: number) {
    return this.http.delete<ApiEnvelope<{ dni: number }>>(`${this.baseUrl}/clientes/${dni}`);
  }

  listarClientesVehiculo(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<CliVehiculo>>>(`${this.baseUrl}/clientes-vehiculo`, { params: buildListParams(query) });
  }
  crearClienteVehiculo(payload: CliVehiculoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idCliVehiculo: number }>>(`${this.baseUrl}/clientes-vehiculo`, payload);
  }
  editarClienteVehiculo(payload: CliVehiculoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idCliVehiculo: number }>>(`${this.baseUrl}/clientes-vehiculo`, payload);
  }
  eliminarClienteVehiculo(id: number) {
    return this.http.delete<ApiEnvelope<{ idCliVehiculo: number }>>(`${this.baseUrl}/clientes-vehiculo/${id}`);
  }

  /* ===== Catálogos / Inventario ===== */
  listarArticulosCatalogo(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehArticuloCatalogo>>>(`${this.baseUrl}/catalogos/articulos`, { params: buildListParams(query) });
  }

  /* ===== Órdenes ===== */
  listarOrdenes(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajo>>>(`${this.baseUrl}/ordenes-trabajo`, { params: buildListParams(query) });
  }
  crearOrden(payload: VehOrdenTrabajoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajo: number }>>(`${this.baseUrl}/ordenes-trabajo`, payload);
  }
  editarOrden(payload: VehOrdenTrabajoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajo: number }>>(`${this.baseUrl}/ordenes-trabajo`, payload);
  }
  eliminarOrden(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajo: number }>>(`${this.baseUrl}/ordenes-trabajo/${id}`);
  }


  listarOrdenBitacora(idOrden: number, query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoBitacoraItem> | { items: VehOrdenTrabajoBitacoraItem[]; total?: number }>>(
      `${this.baseUrl}/ordenes-trabajo/${idOrden}/bitacora`,
      { params: buildListParams(query) }
    );
  }
  crearOrdenBitacora(idOrden: number, payload: VehOrdenTrabajoBitacoraGuardarRequest) {
    return this.http.post<ApiEnvelope<VehOrdenTrabajoBitacoraItem | { idVehOrdenTrabajoBitacora: number }>>(
      `${this.baseUrl}/ordenes-trabajo/${idOrden}/bitacora`,
      payload
    );
  }

  listarOrdenChecklists(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoCheckList>>>(`${this.baseUrl}/ordenes-trabajo-check-list`, { params: buildListParams(query) });
  }
  crearOrdenCheckList(payload: VehOrdenTrabajoCheckListGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoCheckList: number }>>(`${this.baseUrl}/ordenes-trabajo-check-list`, payload);
  }
  editarOrdenCheckList(payload: VehOrdenTrabajoCheckListEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoCheckList: number }>>(`${this.baseUrl}/ordenes-trabajo-check-list`, payload);
  }
  eliminarOrdenCheckList(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoCheckList: number }>>(`${this.baseUrl}/ordenes-trabajo-check-list/${id}`);
  }

  listarOrdenTrabajos(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoTrabajo>>>(`${this.baseUrl}/ordenes-trabajo-trabajo`, { params: buildListParams(query) });
  }
  crearOrdenTrabajo(payload: VehOrdenTrabajoTrabajoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoTrabajo: number }>>(`${this.baseUrl}/ordenes-trabajo-trabajo`, payload);
  }
  editarOrdenTrabajo(payload: VehOrdenTrabajoTrabajoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoTrabajo: number }>>(`${this.baseUrl}/ordenes-trabajo-trabajo`, payload);
  }
  eliminarOrdenTrabajo(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoTrabajo: number }>>(`${this.baseUrl}/ordenes-trabajo-trabajo/${id}`);
  }

  listarHallazgos(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoHallazgo>>>(`${this.baseUrl}/ordenes-trabajo-hallazgo`, { params: buildListParams(query) });
  }
  crearHallazgo(payload: VehOrdenTrabajoHallazgoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoHallazgo: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo`, payload);
  }
  editarHallazgo(payload: VehOrdenTrabajoHallazgoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoHallazgo: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo`, payload);
  }
  eliminarHallazgo(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoHallazgo: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo/${id}`);
  }

  listarHallazgoMarcas(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoHallazgoMarca>>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-marca`, { params: buildListParams(query) });
  }
  crearHallazgoMarca(payload: VehOrdenTrabajoHallazgoMarcaGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoHallazgoMarca: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-marca`, payload);
  }
  editarHallazgoMarca(payload: VehOrdenTrabajoHallazgoMarcaEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoHallazgoMarca: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-marca`, payload);
  }
  eliminarHallazgoMarca(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoHallazgoMarca: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-marca/${id}`);
  }

  listarHallazgoFotos(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoHallazgoFoto>>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-foto`, { params: buildListParams(query) });
  }
  crearHallazgoFoto(payload: VehOrdenTrabajoHallazgoFotoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoHallazgoFoto: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-foto`, payload);
  }
  editarHallazgoFoto(payload: VehOrdenTrabajoHallazgoFotoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoHallazgoFoto: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-foto`, payload);
  }
  eliminarHallazgoFoto(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoHallazgoFoto: number }>>(`${this.baseUrl}/ordenes-trabajo-hallazgo-foto/${id}`);
  }

  listarRepuestos(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoRepuesto>>>(`${this.baseUrl}/ordenes-trabajo-repuesto`, { params: buildListParams(query) });
  }
  crearRepuesto(payload: VehOrdenTrabajoRepuestoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoRepuesto: number }>>(`${this.baseUrl}/ordenes-trabajo-repuesto`, payload);
  }
  editarRepuesto(payload: VehOrdenTrabajoRepuestoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoRepuesto: number }>>(`${this.baseUrl}/ordenes-trabajo-repuesto`, payload);
  }
  eliminarRepuesto(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoRepuesto: number }>>(`${this.baseUrl}/ordenes-trabajo-repuesto/${id}`);
  }

  listarAutorizaciones(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoAutorizacion>>>(`${this.baseUrl}/ordenes-trabajo-autorizacion`, { params: buildListParams(query) });
  }
  crearAutorizacion(payload: VehOrdenTrabajoAutorizacionGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoAutorizacion: number }>>(`${this.baseUrl}/ordenes-trabajo-autorizacion`, payload);
  }
  editarAutorizacion(payload: VehOrdenTrabajoAutorizacionEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoAutorizacion: number }>>(`${this.baseUrl}/ordenes-trabajo-autorizacion`, payload);
  }
  eliminarAutorizacion(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoAutorizacion: number }>>(`${this.baseUrl}/ordenes-trabajo-autorizacion/${id}`);
  }

  listarOrdenFacturas(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoFactura>>>(`${this.baseUrl}/ordenes-trabajo-factura`, { params: buildListParams(query) });
  }
  crearOrdenFactura(payload: VehOrdenTrabajoFacturaGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehOrdenTrabajoFactura: number }>>(`${this.baseUrl}/ordenes-trabajo-factura`, payload);
  }
  editarOrdenFactura(payload: VehOrdenTrabajoFacturaEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehOrdenTrabajoFactura: number }>>(`${this.baseUrl}/ordenes-trabajo-factura`, payload);
  }
  eliminarOrdenFactura(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehOrdenTrabajoFactura: number }>>(`${this.baseUrl}/ordenes-trabajo-factura/${id}`);
  }
  /**garania */
  listarGarantias(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehGarantia>>>(`${this.baseUrl}/garantias`, { params: buildListParams(query) });
  }
  crearGarantia(payload: VehGarantiaGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehGarantia: number }>>(`${this.baseUrl}/garantias`, payload);
  }
  editarGarantia(payload: VehGarantiaEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehGarantia: number }>>(`${this.baseUrl}/garantias`, payload);
  }
  eliminarGarantia(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehGarantia: number }>>(`${this.baseUrl}/garantias/${id}`);
  }

  listarGarantiaDetalles(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehGarantiaDetalle>>>(`${this.baseUrl}/garantias-detalle`, { params: buildListParams(query) });
  }
  crearGarantiaDetalle(payload: VehGarantiaDetalleGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehGarantiaDetalle: number }>>(`${this.baseUrl}/garantias-detalle`, payload);
  }
  editarGarantiaDetalle(payload: VehGarantiaDetalleEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehGarantiaDetalle: number }>>(`${this.baseUrl}/garantias-detalle`, payload);
  }
  eliminarGarantiaDetalle(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehGarantiaDetalle: number }>>(`${this.baseUrl}/garantias-detalle/${id}`);
  }

  listarGarantiaMovimientos(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehGarantiaMovimiento>>>(`${this.baseUrl}/garantias-movimiento`, { params: buildListParams(query) });
  }
  crearGarantiaMovimiento(payload: VehGarantiaMovimientoGuardarRequest) {
    return this.http.post<ApiEnvelope<{ idVehGarantiaMovimiento: number }>>(`${this.baseUrl}/garantias-movimiento`, payload);
  }
  editarGarantiaMovimiento(payload: VehGarantiaMovimientoEditarRequest) {
    return this.http.patch<ApiEnvelope<{ idVehGarantiaMovimiento: number }>>(`${this.baseUrl}/garantias-movimiento`, payload);
  }
  eliminarGarantiaMovimiento(id: number) {
    return this.http.delete<ApiEnvelope<{ idVehGarantiaMovimiento: number }>>(`${this.baseUrl}/garantias-movimiento/${id}`);
  }
  /* ===== Facturas / Cajas / Cobros ===== */
  listarFacturas(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehFactura>>>(`${this.baseUrl}/facturas`, { params: buildListParams(query) });
  }
  obtenerFactura(idFacVenta: number) {
    return this.http.get<ApiEnvelope<VehFacturaDetalleResponse>>(
      `${this.baseUrl}/facturas/${idFacVenta}`
    );
  }
  crearFactura(payload: VehFacturaCrearRequest) {
    return this.http.post<ApiEnvelope<Record<string, unknown>>>(`${this.baseUrl}/facturas`, payload);
  }
  contabilizarFactura(payload: VehFacturaContabilizarRequest) {
    return this.http.post<ApiEnvelope<Record<string, unknown>>>(`${this.baseUrl}/facturas/contabilizar`, payload);
  }

  listarCajas(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehCaja>>>(`${this.baseUrl}/cajas`, { params: buildListParams(query) });
  }
  asegurarCaja(payload: VehCajaAsegurarRequest) {
    return this.http.post<ApiEnvelope<Record<string, unknown>>>(`${this.baseUrl}/cajas/asegurar`, payload);
  }

  listarCobros(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehCobro>>>(`${this.baseUrl}/cobros`, { params: buildListParams(query) });
  }
  obtenerCobro(idFacVentaCobro: number) {
    return this.http.get<ApiEnvelope<Record<string, unknown>>>(`${this.baseUrl}/cobros/${idFacVentaCobro}`);
  }
  crearCobro(payload: VehCobroCrearRequest) {
    return this.http.post<ApiEnvelope<Record<string, unknown>>>(`${this.baseUrl}/cobros`, payload);
  }

  /* ===== Workflow ===== */
  facturarCobrarWorkflow(payload: VehFacturacionWorkflowRequest) {
    return this.http.post<ApiEnvelope<VehFacturacionWorkflowResultado>>(`${this.baseUrl}/workflow/facturar-cobrar`, payload);
  }

  listarUsuarios(query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<SegUsuarioListadoItem>>>(`${this.userBaseUrl}/usuario/usuarios`, {
      params: buildListParams(query),
    });
  }
}
