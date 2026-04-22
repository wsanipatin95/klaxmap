import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapOrThrow, unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { VehiculosApi } from './vehiculos.api';
import {
  CliVehiculoEditarRequest,
  CliVehiculoGuardarRequest,
  VehCajaAsegurarRequest,
  VehCheckListEditarRequest,
  VehCheckListGuardarRequest,
  VehCheckListVehiculoEditarRequest,
  VehCheckListVehiculoGuardarRequest,
  VehClienteEditarRequest,
  VehClienteGuardarRequest,
  VehCobroCrearRequest,
  VehFacturaContabilizarRequest,
  VehFacturaCrearRequest,
  VehFacturacionWorkflowRequest,
  VehOrdenTrabajoAutorizacionEditarRequest,
  VehOrdenTrabajoAutorizacionGuardarRequest,
  VehOrdenTrabajoCheckListEditarRequest,
  VehOrdenTrabajoCheckListGuardarRequest,
  VehOrdenTrabajoEditarRequest,
  VehOrdenTrabajoFacturaEditarRequest,
  VehOrdenTrabajoFacturaGuardarRequest,
  VehOrdenTrabajoGuardarRequest,
  VehOrdenTrabajoHallazgoEditarRequest,
  VehOrdenTrabajoHallazgoFotoEditarRequest,
  VehOrdenTrabajoHallazgoFotoGuardarRequest,
  VehOrdenTrabajoHallazgoGuardarRequest,
  VehOrdenTrabajoHallazgoMarcaEditarRequest,
  VehOrdenTrabajoHallazgoMarcaGuardarRequest,
  VehOrdenTrabajoRepuestoEditarRequest,
  VehOrdenTrabajoRepuestoGuardarRequest,
  VehOrdenTrabajoTrabajoEditarRequest,
  VehOrdenTrabajoTrabajoGuardarRequest,
  VehTipoVehiculoEditarRequest,
  VehTipoVehiculoGuardarRequest,
  VehTipoVehiculoVistaEditarRequest,
  VehTipoVehiculoVistaGuardarRequest,
  SegUsuarioListadoItem,
  VehGarantiaDetalleEditarRequest,
  VehGarantiaDetalleGuardarRequest,
  VehGarantiaEditarRequest,
  VehGarantiaGuardarRequest,
  VehGarantiaMovimientoEditarRequest,
  VehGarantiaMovimientoGuardarRequest
} from './vehiculos.models';

@Injectable({ providedIn: 'root' })
export class VehiculosRepository {
  private api = inject(VehiculosApi);

  listarTipos(q = '', page = 0, size = 20, all = false) {
    return this.api.listarTipos({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearTipo(payload: VehTipoVehiculoGuardarRequest) { return this.api.crearTipo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarTipo(payload: VehTipoVehiculoEditarRequest) { return this.api.editarTipo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarTipo(id: number) { return this.api.eliminarTipo(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarVistas(extra: Record<string, unknown> = {}) {
    return this.api.listarVistas({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearVista(payload: VehTipoVehiculoVistaGuardarRequest) { return this.api.crearVista(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarVista(payload: VehTipoVehiculoVistaEditarRequest) { return this.api.editarVista(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarVista(id: number) { return this.api.eliminarVista(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarChecklists(extra: Record<string, unknown> = {}) {
    return this.api.listarChecklists({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearCheckList(payload: VehCheckListGuardarRequest) { return this.api.crearCheckList(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarCheckList(payload: VehCheckListEditarRequest) { return this.api.editarCheckList(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarCheckList(id: number) { return this.api.eliminarCheckList(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarChecklistsVehiculo(extra: Record<string, unknown> = {}) {
    return this.api.listarChecklistsVehiculo({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearChecklistVehiculo(payload: VehCheckListVehiculoGuardarRequest) { return this.api.crearChecklistVehiculo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarChecklistVehiculo(payload: VehCheckListVehiculoEditarRequest) { return this.api.editarChecklistVehiculo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarChecklistVehiculo(id: number) { return this.api.eliminarChecklistVehiculo(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarClientes(q = '', page = 0, size = 20, all = false) {
    return this.api.listarClientes({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearCliente(payload: VehClienteGuardarRequest) { return this.api.crearCliente(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarCliente(payload: VehClienteEditarRequest) { return this.api.editarCliente(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarCliente(dni: number) { return this.api.eliminarCliente(dni).pipe(map((r) => unwrapWithMsg(r))); }

  listarClientesVehiculo(extra: Record<string, unknown> = {}) {
    return this.api.listarClientesVehiculo({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearClienteVehiculo(payload: CliVehiculoGuardarRequest) { return this.api.crearClienteVehiculo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarClienteVehiculo(payload: CliVehiculoEditarRequest) { return this.api.editarClienteVehiculo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarClienteVehiculo(id: number) { return this.api.eliminarClienteVehiculo(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarArticulos(q = '', page = 0, size = 20, all = false) {
    return this.api.listarArticulosCatalogo({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));
  }

  listarOrdenes(q = '', page = 0, size = 20, all = false, extra: Record<string, unknown> = {}) {
    return this.api.listarOrdenes({ q, page, size, all, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearOrden(payload: VehOrdenTrabajoGuardarRequest) { return this.api.crearOrden(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarOrden(payload: VehOrdenTrabajoEditarRequest) { return this.api.editarOrden(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarOrden(id: number) { return this.api.eliminarOrden(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarOrdenChecklists(extra: Record<string, unknown> = {}) {
    return this.api.listarOrdenChecklists({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearOrdenCheckList(payload: VehOrdenTrabajoCheckListGuardarRequest) { return this.api.crearOrdenCheckList(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarOrdenCheckList(payload: VehOrdenTrabajoCheckListEditarRequest) { return this.api.editarOrdenCheckList(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarOrdenCheckList(id: number) { return this.api.eliminarOrdenCheckList(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarOrdenTrabajos(extra: Record<string, unknown> = {}) {
    return this.api.listarOrdenTrabajos({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearOrdenTrabajo(payload: VehOrdenTrabajoTrabajoGuardarRequest) { return this.api.crearOrdenTrabajo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarOrdenTrabajo(payload: VehOrdenTrabajoTrabajoEditarRequest) { return this.api.editarOrdenTrabajo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarOrdenTrabajo(id: number) { return this.api.eliminarOrdenTrabajo(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarHallazgos(extra: Record<string, unknown> = {}) {
    return this.api.listarHallazgos({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearHallazgo(payload: VehOrdenTrabajoHallazgoGuardarRequest) { return this.api.crearHallazgo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarHallazgo(payload: VehOrdenTrabajoHallazgoEditarRequest) { return this.api.editarHallazgo(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarHallazgo(id: number) { return this.api.eliminarHallazgo(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarHallazgoMarcas(extra: Record<string, unknown> = {}) {
    return this.api.listarHallazgoMarcas({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearHallazgoMarca(payload: VehOrdenTrabajoHallazgoMarcaGuardarRequest) { return this.api.crearHallazgoMarca(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarHallazgoMarca(payload: VehOrdenTrabajoHallazgoMarcaEditarRequest) { return this.api.editarHallazgoMarca(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarHallazgoMarca(id: number) { return this.api.eliminarHallazgoMarca(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarHallazgoFotos(extra: Record<string, unknown> = {}) {
    return this.api.listarHallazgoFotos({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearHallazgoFoto(payload: VehOrdenTrabajoHallazgoFotoGuardarRequest) { return this.api.crearHallazgoFoto(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarHallazgoFoto(payload: VehOrdenTrabajoHallazgoFotoEditarRequest) { return this.api.editarHallazgoFoto(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarHallazgoFoto(id: number) { return this.api.eliminarHallazgoFoto(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarRepuestos(extra: Record<string, unknown> = {}) {
    return this.api.listarRepuestos({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearRepuesto(payload: VehOrdenTrabajoRepuestoGuardarRequest) { return this.api.crearRepuesto(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarRepuesto(payload: VehOrdenTrabajoRepuestoEditarRequest) { return this.api.editarRepuesto(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarRepuesto(id: number) { return this.api.eliminarRepuesto(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarAutorizaciones(extra: Record<string, unknown> = {}) {
    return this.api.listarAutorizaciones({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearAutorizacion(payload: VehOrdenTrabajoAutorizacionGuardarRequest) { return this.api.crearAutorizacion(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarAutorizacion(payload: VehOrdenTrabajoAutorizacionEditarRequest) { return this.api.editarAutorizacion(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarAutorizacion(id: number) { return this.api.eliminarAutorizacion(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarOrdenFacturas(extra: Record<string, unknown> = {}) {
    return this.api.listarOrdenFacturas({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }

  listarGarantias(extra: Record<string, unknown> = {}) {
    return this.api.listarGarantias({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearGarantia(payload: VehGarantiaGuardarRequest) { return this.api.crearGarantia(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarGarantia(payload: VehGarantiaEditarRequest) { return this.api.editarGarantia(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarGarantia(id: number) { return this.api.eliminarGarantia(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarGarantiaDetalles(extra: Record<string, unknown> = {}) {
    return this.api.listarGarantiaDetalles({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearGarantiaDetalle(payload: VehGarantiaDetalleGuardarRequest) { return this.api.crearGarantiaDetalle(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarGarantiaDetalle(payload: VehGarantiaDetalleEditarRequest) { return this.api.editarGarantiaDetalle(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarGarantiaDetalle(id: number) { return this.api.eliminarGarantiaDetalle(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarGarantiaMovimientos(extra: Record<string, unknown> = {}) {
    return this.api.listarGarantiaMovimientos({ all: true, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearGarantiaMovimiento(payload: VehGarantiaMovimientoGuardarRequest) { return this.api.crearGarantiaMovimiento(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarGarantiaMovimiento(payload: VehGarantiaMovimientoEditarRequest) { return this.api.editarGarantiaMovimiento(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarGarantiaMovimiento(id: number) { return this.api.eliminarGarantiaMovimiento(id).pipe(map((r) => unwrapWithMsg(r))); }

  crearOrdenFactura(payload: VehOrdenTrabajoFacturaGuardarRequest) { return this.api.crearOrdenFactura(payload).pipe(map((r) => unwrapWithMsg(r))); }
  editarOrdenFactura(payload: VehOrdenTrabajoFacturaEditarRequest) { return this.api.editarOrdenFactura(payload).pipe(map((r) => unwrapWithMsg(r))); }
  eliminarOrdenFactura(id: number) { return this.api.eliminarOrdenFactura(id).pipe(map((r) => unwrapWithMsg(r))); }

  listarFacturas(q = '', page = 0, size = 20, all = false, extra: Record<string, unknown> = {}) {
    return this.api.listarFacturas({ q, page, size, all, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  obtenerFactura(idFacVenta: number) {
    return this.api.obtenerFactura(idFacVenta).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearFactura(payload: VehFacturaCrearRequest) { return this.api.crearFactura(payload).pipe(map((r) => unwrapWithMsg(r))); }
  contabilizarFactura(payload: VehFacturaContabilizarRequest) { return this.api.contabilizarFactura(payload).pipe(map((r) => unwrapWithMsg(r))); }

  listarCajas(q = '', page = 0, size = 20, all = false, extra: Record<string, unknown> = {}) {
    return this.api.listarCajas({ q, page, size, all, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  asegurarCaja(payload: VehCajaAsegurarRequest) { return this.api.asegurarCaja(payload).pipe(map((r) => unwrapWithMsg(r))); }

  listarCobros(q = '', page = 0, size = 20, all = false, extra: Record<string, unknown> = {}) {
    return this.api.listarCobros({ q, page, size, all, extra: extra as Record<string, string | number | boolean | null | undefined> }).pipe(map((r) => unwrapOrThrow(r)));
  }
  obtenerCobro(idFacVentaCobro: number) { return this.api.obtenerCobro(idFacVentaCobro).pipe(map((r) => unwrapOrThrow(r))); }
  crearCobro(payload: VehCobroCrearRequest) { return this.api.crearCobro(payload).pipe(map((r) => unwrapWithMsg(r))); }

  facturarCobrarWorkflow(payload: VehFacturacionWorkflowRequest) {
    return this.api.facturarCobrarWorkflow(payload).pipe(map((r) => unwrapWithMsg(r)));
  }
  listarUsuarios(q = '', page = 0, size = 20, all = false) {
    return this.api.listarUsuarios({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));
  }
}
