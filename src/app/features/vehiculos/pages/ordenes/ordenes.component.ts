import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Observable, finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService } from 'primeng/api';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosWorkbenchShellComponent } from '../../components/workbench-shell/workbench-shell.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { OrdenResumenPanelComponent } from '../../components/orden-resumen-panel/orden-resumen-panel.component';
import { VehiculoVistaCanvasComponent } from '../../components/vehiculo-vista-canvas/vehiculo-vista-canvas.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  CliVehiculo,
  VehCliente,
  VehCobro,
  VehCobroCrearRequest,
  VehFactura,
  VehFacturaContabilizarRequest,
  VehFacturaCrearRequest,
  VehFacturacionWorkflowRequest,
  VehFacturacionWorkflowResultado,
  VehOrdenTrabajo,
  VehOrdenTrabajoAutorizacion,
  VehOrdenTrabajoAutorizacionGuardarRequest,
  VehOrdenTrabajoCheckList,
  VehOrdenTrabajoFactura,
  VehOrdenTrabajoGuardarRequest,
  VehOrdenTrabajoHallazgo,
  VehOrdenTrabajoHallazgoFoto,
  VehOrdenTrabajoHallazgoFotoGuardarRequest,
  VehOrdenTrabajoHallazgoGuardarRequest,
  VehOrdenTrabajoHallazgoMarca,
  VehOrdenTrabajoHallazgoMarcaGuardarRequest,
  VehOrdenTrabajoRepuesto,
  VehOrdenTrabajoRepuestoGuardarRequest,
  VehOrdenTrabajoTrabajo,
  VehOrdenTrabajoTrabajoGuardarRequest,
  VehTipoVehiculoVista,
  VehCheckListVehiculo,
  VehArticuloCatalogo,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type OrdenTab =
  | 'resumen'
  | 'checklist'
  | 'trabajos'
  | 'hallazgos'
  | 'repuestos'
  | 'autorizaciones'
  | 'comercial';

type ChildDrawerMode =
  | 'trabajo'
  | 'hallazgo'
  | 'repuesto'
  | 'autorizacion'
  | 'foto'
  | 'checklist'
  | null;

type ComercialDrawerMode =
  | 'workflow'
  | 'factura'
  | 'cobro'
  | 'contabilizar'
  | null;

@Component({
  selector: 'app-vehiculos-ordenes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    ConfirmDialogModule,
    DialogModule,
    VehiculosPageHeaderComponent,
    VehiculosWorkbenchShellComponent,
    VehiculosFormDrawerComponent,
    VehiculosEmptyStateComponent,
    OrdenResumenPanelComponent,
    VehiculoVistaCanvasComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss',
})
export class VehiculosOrdenesComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);
  private router = inject(Router);

  readonly TIPO_SERVICIO_OPTIONS = [
    'REPARACION',
    'MANTENIMIENTO',
    'DIAGNOSTICO',
    'GARANTIA',
    'REVISION',
    'INSPECCION',
    'OTRO',
  ];

  readonly ESTADO_ORDEN_OPTIONS = [
    'RECIBIDO',
    'DIAGNOSTICO',
    'EN_PROCESO',
    'EN_ESPERA',
    'PENDIENTE_APROBACION',
    'LISTO',
    'FACTURADO',
    'ENTREGADO',
    'ANULADO',
  ];

  readonly ESTADO_CHECKLIST_OPTIONS = ['PENDIENTE', 'OK', 'NO_OK', 'N/A'];
  readonly TIPO_TRABAJO_OPTIONS = ['DIAGNOSTICO', 'REPARACION', 'MANTENIMIENTO', 'INSTALACION', 'PRUEBA', 'OTRO'];
  readonly ESTADO_TRABAJO_OPTIONS = ['PENDIENTE', 'EN_PROCESO', 'PAUSADO', 'FINALIZADO', 'ANULADO'];
  readonly TIPO_HALLAZGO_OPTIONS = ['RECEPCION', 'DIAGNOSTICO', 'DESMONTAJE', 'PRUEBA', 'ENTREGA', 'OTRO'];
  readonly CATEGORIA_HALLAZGO_OPTIONS = ['GENERAL', 'MECANICO', 'ELECTRICO', 'CARROCERIA', 'PINTURA', 'INTERIOR', 'SEGURIDAD'];
  readonly SEVERIDAD_OPTIONS = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
  readonly ESTADO_HALLAZGO_OPTIONS = ['REPORTADO', 'VALIDADO', 'APROBADO', 'RECHAZADO', 'RESUELTO'];
  readonly ETAPA_FOTO_OPTIONS = ['ANTES', 'DURANTE', 'DESPUES'];
  readonly TIPO_AUTORIZACION_OPTIONS = ['ADICIONAL', 'CAMBIO_REPUESTO', 'SERVICIO_EXTRA', 'ENTREGA', 'OTRO'];
  readonly ESTADO_AUTORIZACION_OPTIONS = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'];
  readonly TIPO_FACTURACION_OPTIONS = ['PARCIAL', 'TOTAL'];

  q = '';
  loading = signal(false);
  saving = signal(false);
  activeTab = signal<OrdenTab>('resumen');

  ordenes = signal<VehOrdenTrabajo[]>([]);
  selectedOrden = signal<VehOrdenTrabajo | null>(null);

  checklist = signal<VehOrdenTrabajoCheckList[]>([]);
  checklistOpciones = signal<VehCheckListVehiculo[]>([]);
  trabajos = signal<VehOrdenTrabajoTrabajo[]>([]);
  hallazgos = signal<VehOrdenTrabajoHallazgo[]>([]);
  selectedHallazgo = signal<VehOrdenTrabajoHallazgo | null>(null);
  marcas = signal<VehOrdenTrabajoHallazgoMarca[]>([]);
  fotos = signal<VehOrdenTrabajoHallazgoFoto[]>([]);
  repuestos = signal<VehOrdenTrabajoRepuesto[]>([]);
  autorizaciones = signal<VehOrdenTrabajoAutorizacion[]>([]);
  ordenFacturas = signal<VehOrdenTrabajoFactura[]>([]);
  vistas = signal<VehTipoVehiculoVista[]>([]);
  selectedVista = signal<VehTipoVehiculoVista | null>(null);

  facturasOt = signal<VehFactura[]>([]);
  selectedFacturaOt = signal<VehFactura | null>(null);
  facturaDetalle = signal<Record<string, unknown> | null>(null);
  cobrosFactura = signal<VehCobro[]>([]);
  workflowResultado = signal<VehFacturacionWorkflowResultado | null>(null);

  drawerVisible = signal(false);
  childDrawerVisible = signal(false);
  comercialDrawerVisible = signal(false);

  childMode = signal<ChildDrawerMode>(null);
  comercialDrawerMode = signal<ComercialDrawerMode>(null);

  dirty = signal(false);
  childDirty = signal(false);
  comercialDirty = signal(false);

  editingOrdenId = signal<number | null>(null);
  fotoBase64 = signal<string | null>(null);
  fotoPreview = signal<string | null>(null);

  clientesBuscar = signal('');
  clientesResultados = signal<VehCliente[]>([]);
  clienteBuscando = signal(false);
  clientePickerVisible = signal(false);
  clienteSeleccionado = signal<VehCliente | null>(null);

  vehiculosCliente = signal<CliVehiculo[]>([]);
  vehiculoSeleccionado = signal<CliVehiculo | null>(null);

  repuestoArticuloQuery = signal('');
  repuestoArticulos = signal<VehArticuloCatalogo[]>([]);
  repuestoArticuloLoading = signal(false);
  repuestoArticuloPickerVisible = signal(false);

  private articuloSearchTimer: ReturnType<typeof setTimeout> | null = null;

  private initialMainSnapshot = '';
  private initialChildSnapshot = '';
  private initialComercialSnapshot = '';

  form = this.fb.group({
    dni: [null as number | null, Validators.required],
    idCliVehiculoFk: [null as number | null, Validators.required],
    tipoServicio: ['REPARACION', Validators.required],
    estadoOrden: ['RECIBIDO', Validators.required],
    fechaIngreso: [''],
    fechaPrometida: [''],
    kilometrajeIngreso: [null as number | null],
    nivelCombustible: [''],
    nivelBateria: [''],
    fallaReportada: [''],
    sintomasReportados: [''],
    ruidosReportados: [''],
    detalleCliente: [''],
    accesoriosEntregados: [''],
    condicionIngreso: [''],
    diagnosticoGeneral: [''],
    recomendacionGeneral: [''],
    responsableRecepcion: [null as number | null],
    responsableTecnico: [null as number | null],
    observaciones: [''],
    atributosJson: ['{}'],
  });

  checklistForm = this.fb.group({
    idVehVehiculoCheckListVehiculoFk: [null as number | null, Validators.required],
    estadoCheckList: ['PENDIENTE'],
    observaciones: [''],
  });

  trabajoForm = this.fb.group({
    tipoTrabajo: ['DIAGNOSTICO', Validators.required],
    descripcionInicial: ['', Validators.required],
    descripcionRealizada: [''],
    resultado: [''],
    estadoTrabajo: ['PENDIENTE'],
    fechaInicio: [''],
    fechaFin: [''],
    motivo: [''],
    observaciones: [''],
  });

  hallazgoForm = this.fb.group({
    idVehOrdenTrabajoTrabajoFk: [null as number | null],
    tipoHallazgo: ['RECEPCION'],
    categoria: ['GENERAL'],
    descripcion: ['', Validators.required],
    severidad: ['MEDIA'],
    estadoHallazgo: ['REPORTADO'],
    requiereCambio: [true],
    motivoCambio: [''],
    aprobadoCliente: [false],
    fechaAprobacion: [''],
    observaciones: [''],
    atributosJson: ['{}'],
  });

  repuestoForm = this.fb.group({
    art: [null as number | null, Validators.required],
    cantidad: [1, Validators.required],
    precioUnitario: [0, Validators.required],
    motivoCambio: [''],
    detalleInstalacion: [''],
    serieAnterior: [''],
    serieNueva: [''],
    observaciones: [''],
  });

  autorizacionForm = this.fb.group({
    tipoAutorizacion: ['ADICIONAL'],
    referenciaTabla: [''],
    referenciaId: [null as number | null],
    descripcion: ['', Validators.required],
    estadoAutorizacion: ['PENDIENTE'],
    fechaRespuesta: [''],
    observaciones: [''],
  });

  fotoForm = this.fb.group({
    etapa: ['ANTES'],
    descripcion: [''],
    principal: [false],
  });

  facturaForm = this.fb.group({
    idVehOrdenTrabajoFk: [null as number | null, Validators.required],
    idsVehOrdenTrabajoRepuesto: [''],
    tipoFacturacion: ['PARCIAL'],
    observacion: [''],
    dni: [null as number | null],
    cen: [null as number | null],
    idAdmPtoemi: [null as number | null],
    credito: [false],
    entrada: [0],
    cuotas: [1],
    fechaPrimerVencimiento: [''],
    idTaxCompAutFk: [1],
    usarPrecioRepuesto: [true],
  });

  cobroForm = this.fb.group({
    idFacVenta: [null as number | null, Validators.required],
    valor: [0, Validators.required],
    fecha: [''],
    cen: [null as number | null],
    idAdmPtoemi: [null as number | null],
    idFacCaja: [null as number | null],
    concepto: [''],
    idCntFormaPagoFk: [null as number | null],
    idBanDocBancoFk: [null as number | null],
    traCash: [''],
    idBanBancoFk: [null as number | null],
    idBanBancoSubFk: [null as number | null],
    idTaxTarjetaDiferidoFk: [null as number | null],
    idBanTarjetaFk: [null as number | null],
    referenciaDatafast: [''],
    crearCajaSiNoExiste: [true],
    contabilizar: [true],
    idCntPlanFormaPagoFk: [null as number | null],
    idCntTipoFk: [20],
  });

  contabilizarForm = this.fb.group({
    idFacVenta: [null as number | null, Validators.required],
    idCntTipoFk: [20],
    fechaContable: [''],
    concepto: ['Factura vehicular'],
  });

  workflowForm = this.fb.group({
    idVehOrdenTrabajoFk: [null as number | null, Validators.required],
    idAdmPtoemiFk: [null as number | null],
    idsVehOrdenTrabajoRepuesto: [''],
    observacionFactura: [''],
    tipoFacturacion: ['PARCIAL'],
    dni: [null as number | null],
    cen: [null as number | null],
    credito: [false],
    pagoInicial: [0],
    cuotas: [1],
    fechaEmisionIso: [''],
    fechaPrimerVencimientoIso: [''],
    idTaxCompAutFk: [1],
    usarPrecioRepuesto: [true],
    idCntFormaPagoFk: [null as number | null],
    idCntPlanFormaPagoFk: [null as number | null],
    idBanDocBancoFk: [null as number | null],
    idBanBancoFk: [null as number | null],
    idBanBancoSubFk: [null as number | null],
    idTaxTarjetaDiferidoFk: [null as number | null],
    idBanTarjetaFk: [null as number | null],
    referenciaDatafast: [''],
    traCash: [''],
    crearRecibo: [true],
    contabilizarFactura: [true],
    contabilizarCobro: [true],
    conceptoFactura: ['Factura vehicular'],
    conceptoCobro: ['Cobro vehicular'],
  });

  readonly repuestoArticuloSeleccionado = computed(() => {
    const art = this.repuestoForm.controls.art.value;
    if (art == null) return null;
    return this.repuestoArticulos().find((x) => x.idActInventario === art) ?? null;
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.updateMainDirtyState());
    this.checklistForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.trabajoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.hallazgoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.repuestoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.autorizacionForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.fotoForm.valueChanges.subscribe(() => this.updateChildDirtyState());

    this.facturaForm.valueChanges.subscribe(() => this.updateComercialDirtyState());
    this.cobroForm.valueChanges.subscribe(() => this.updateComercialDirtyState());
    this.contabilizarForm.valueChanges.subscribe(() => this.updateComercialDirtyState());
    this.workflowForm.valueChanges.subscribe(() => this.updateComercialDirtyState());

    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    if (this.childDrawerVisible() && this.childDirty()) return this.confirm.confirmDiscard();
    if (this.comercialDrawerVisible() && this.comercialDirty()) return this.confirm.confirmDiscard();
    return true;
  }

  volver() {
    if (this.drawerVisible() && this.dirty()) {
      this.confirm.confirmDiscard().then((ok) => {
        if (ok) this.router.navigate(['/app/vehiculos/dashboard']);
      });
      return;
    }
    this.router.navigate(['/app/vehiculos/dashboard']);
  }

  cargar() {
    this.loading.set(true);
    this.repo.listarOrdenes(this.q, 0, 50, false)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.ordenes.set(res.items ?? []);
          const current = this.selectedOrden();
          if (current) {
            const found = (res.items ?? []).find((x) => x.idVehOrdenTrabajo === current.idVehOrdenTrabajo) ?? null;
            this.selectedOrden.set(found);
            if (found) this.cargarDetalle(found);
          }
        },
        error: (err) => this.notify.error('No se pudieron cargar órdenes', err?.message),
      });
  }

  seleccionarOrden(item: VehOrdenTrabajo) {
    this.selectedOrden.set(item);
    this.cargarDetalle(item);
  }

  cargarDetalle(item: VehOrdenTrabajo) {
    forkJoin({
      checklist: this.repo.listarOrdenChecklists({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      trabajos: this.repo.listarOrdenTrabajos({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      hallazgos: this.repo.listarHallazgos({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      repuestos: this.repo.listarRepuestos({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      autorizaciones: this.repo.listarAutorizaciones({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      facturasRelacion: this.repo.listarOrdenFacturas({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      facturasOt: this.repo.listarFacturas('', 0, 100, true, { idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      vehiculos: this.repo.listarClientesVehiculo({ dni: item.dni }),
    }).subscribe({
      next: ({
        checklist,
        trabajos,
        hallazgos,
        repuestos,
        autorizaciones,
        facturasRelacion,
        facturasOt,
        vehiculos,
      }) => {
        this.checklist.set(checklist.items ?? []);
        this.trabajos.set(trabajos.items ?? []);
        this.hallazgos.set(hallazgos.items ?? []);
        this.repuestos.set(repuestos.items ?? []);
        this.autorizaciones.set(autorizaciones.items ?? []);
        this.ordenFacturas.set(facturasRelacion.items ?? []);
        this.facturasOt.set(facturasOt.items ?? []);

        const vehiculo = (vehiculos.items ?? []).find((x) => x.idCliVehiculo === item.idCliVehiculoFk);
        if (vehiculo) {
          this.repo.listarChecklistsVehiculo({ idVehTipoVehiculoFk: vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => this.checklistOpciones.set(r.items ?? []),
          });

          this.repo.listarVistas({ idVehTipoVehiculoFk: vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => {
              const items = r.items ?? [];
              this.vistas.set(items);
              const currentVista = this.selectedVista();
              const selectedVista = currentVista
                ? items.find((x) => x.idVehTipoVehiculoVista === currentVista.idVehTipoVehiculoVista) ?? null
                : (items[0] ?? null);
              this.selectedVista.set(selectedVista);
            },
          });
        } else {
          this.checklistOpciones.set([]);
          this.vistas.set([]);
          this.selectedVista.set(null);
        }

        const firstHallazgo = (hallazgos.items ?? [])[0] ?? null;
        this.selectedHallazgo.set(firstHallazgo);
        if (firstHallazgo) {
          this.cargarHallazgoDetalle(firstHallazgo.idVehOrdenTrabajoHallazgo);
        } else {
          this.marcas.set([]);
          this.fotos.set([]);
        }

        const facturasItems = facturasOt.items ?? [];
        const currentFactura = this.selectedFacturaOt();
        const facturaSeleccionada = currentFactura
          ? facturasItems.find((x) => x.idFacVenta === currentFactura.idFacVenta) ?? null
          : (facturasItems[0] ?? null);

        this.selectedFacturaOt.set(facturaSeleccionada);
        if (facturaSeleccionada) {
          this.seleccionarFacturaOt(facturaSeleccionada, false);
        } else {
          this.facturaDetalle.set(null);
          this.cobrosFactura.set([]);
        }
      },
      error: (err) => this.notify.error('No se pudo cargar detalle de la orden', err?.message),
    });
  }

  cargarHallazgoDetalle(idVehOrdenTrabajoHallazgo: number) {
    forkJoin({
      marcas: this.repo.listarHallazgoMarcas({ idVehOrdenTrabajoHallazgoFk: idVehOrdenTrabajoHallazgo }),
      fotos: this.repo.listarHallazgoFotos({ idVehOrdenTrabajoHallazgoFk: idVehOrdenTrabajoHallazgo }),
    }).subscribe({
      next: ({ marcas, fotos }) => {
        this.marcas.set(marcas.items ?? []);
        this.fotos.set(fotos.items ?? []);
      },
      error: (err) => this.notify.error('No se pudo cargar detalle del hallazgo', err?.message),
    });
  }

  seleccionarFacturaOt(item: VehFactura, activarTab = true) {
    this.selectedFacturaOt.set(item);
    if (activarTab) this.activeTab.set('comercial');

    forkJoin({
      detalle: this.repo.obtenerFactura(item.idFacVenta),
      cobros: this.repo.listarCobros('', 0, 100, true, { idFacVenta: item.idFacVenta }),
    }).subscribe({
      next: ({ detalle, cobros }) => {
        this.facturaDetalle.set(detalle as Record<string, unknown>);
        this.cobrosFactura.set(cobros.items ?? []);
      },
      error: (err) => this.notify.error('No se pudo cargar el detalle comercial', err?.message),
    });
  }

  severityEstado(estado?: string | null) {
    const v = (estado || '').toUpperCase();
    if (v.includes('ENTREG')) return 'success';
    if (v.includes('FACTUR')) return 'info';
    if (v.includes('PEND') || v.includes('ESPERA')) return 'warn';
    if (v.includes('ANUL')) return 'danger';
    return 'secondary';
  }

  buscarClientesOrden() {
    const q = this.clientesBuscar().trim();
    if (!q) {
      this.clientesResultados.set([]);
      return;
    }

    this.clienteBuscando.set(true);
    this.repo.listarClientes(q, 0, 20, false)
      .pipe(finalize(() => this.clienteBuscando.set(false)))
      .subscribe({
        next: (res) => {
          this.clientesResultados.set(res.items ?? []);
        },
        error: (err) => this.notify.error('No se pudo buscar clientes', err?.message),
      });
  }

  abrirClientePicker() {
    this.clientePickerVisible.set(true);
    this.clientesResultados.set([]);
  }

  cerrarClientePicker() {
    this.clientePickerVisible.set(false);
  }

  seleccionarClienteOrden(cliente: VehCliente) {
    const dni = Number(cliente.dni ?? cliente.ruc);
    this.clienteSeleccionado.set(cliente);
    this.form.controls.dni.setValue(dni);
    this.form.controls.idCliVehiculoFk.setValue(null);
    this.vehiculoSeleccionado.set(null);
    this.vehiculosCliente.set([]);
    this.clientePickerVisible.set(false);
    this.buscarVehiculosCliente(dni);
    this.updateMainDirtyState();
  }

  buscarVehiculosCliente(dni?: number | null) {
    const clienteDni = Number(dni ?? this.form.controls.dni.value ?? 0);
    if (!clienteDni) {
      this.vehiculosCliente.set([]);
      return;
    }

    this.repo.listarClientesVehiculo({ dni: clienteDni }).subscribe({
      next: (res) => {
        this.vehiculosCliente.set(res.items ?? []);
      },
      error: (err) => this.notify.error('No se pudieron cargar los vehículos del cliente', err?.message),
    });
  }

  onVehiculoSeleccionado(idCliVehiculo: number | null) {
    const vehiculo = this.vehiculosCliente().find((x) => x.idCliVehiculo === Number(idCliVehiculo)) ?? null;
    this.vehiculoSeleccionado.set(vehiculo);
    this.form.controls.idCliVehiculoFk.setValue(idCliVehiculo);
    this.updateMainDirtyState();
  }

  nuevo() {
    this.editingOrdenId.set(null);
    this.drawerVisible.set(true);
    this.clienteSeleccionado.set(null);
    this.vehiculoSeleccionado.set(null);
    this.vehiculosCliente.set([]);
    this.form.reset({
      dni: null,
      idCliVehiculoFk: null,
      tipoServicio: 'REPARACION',
      estadoOrden: 'RECIBIDO',
      fechaIngreso: '',
      fechaPrometida: '',
      kilometrajeIngreso: null,
      nivelCombustible: '',
      nivelBateria: '',
      fallaReportada: '',
      sintomasReportados: '',
      ruidosReportados: '',
      detalleCliente: '',
      accesoriosEntregados: '',
      condicionIngreso: '',
      diagnosticoGeneral: '',
      recomendacionGeneral: '',
      responsableRecepcion: null,
      responsableTecnico: null,
      observaciones: '',
      atributosJson: '{}',
    });
    this.refreshMainSnapshot();
  }

  editarOrden(item: VehOrdenTrabajo) {
    this.editingOrdenId.set(item.idVehOrdenTrabajo);
    this.drawerVisible.set(true);
    this.form.reset({
      dni: item.dni,
      idCliVehiculoFk: item.idCliVehiculoFk,
      tipoServicio: item.tipoServicio || 'REPARACION',
      estadoOrden: item.estadoOrden || 'RECIBIDO',
      fechaIngreso: this.toDate(item.fechaIngreso),
      fechaPrometida: this.toDate(item.fechaPrometida),
      kilometrajeIngreso: item.kilometrajeIngreso ?? null,
      nivelCombustible: item.nivelCombustible || '',
      nivelBateria: item.nivelBateria || '',
      fallaReportada: item.fallaReportada || '',
      sintomasReportados: item.sintomasReportados || '',
      ruidosReportados: item.ruidosReportados || '',
      detalleCliente: item.detalleCliente || '',
      accesoriosEntregados: item.accesoriosEntregados || '',
      condicionIngreso: item.condicionIngreso || '',
      diagnosticoGeneral: item.diagnosticoGeneral || '',
      recomendacionGeneral: item.recomendacionGeneral || '',
      responsableRecepcion: item.responsableRecepcion ?? null,
      responsableTecnico: item.responsableTecnico ?? null,
      observaciones: item.observaciones || '',
      atributosJson: JSON.stringify(item.atributos ?? {}, null, 2),
    });

    this.repo.listarClientes(String(item.dni ?? ''), 0, 20, false).subscribe({
      next: (res) => {
        const cli = (res.items ?? []).find((x) => Number(x.dni ?? x.ruc) === Number(item.dni)) ?? null;
        this.clienteSeleccionado.set(cli);
      },
    });

    this.buscarVehiculosCliente(item.dni ?? null);
    this.refreshMainSnapshot();
  }

  async eliminarOrden(item: VehOrdenTrabajo) {
    const ok = await this.confirm.confirmDelete(`la orden #${item.idVehOrdenTrabajo}`);
    if (!ok) return;

    this.repo.eliminarOrden(item.idVehOrdenTrabajo).subscribe({
      next: () => {
        this.notify.success('Orden eliminada', 'La orden fue eliminada correctamente.');
        if (this.selectedOrden()?.idVehOrdenTrabajo === item.idVehOrdenTrabajo) {
          this.selectedOrden.set(null);
          this.checklist.set([]);
          this.trabajos.set([]);
          this.hallazgos.set([]);
          this.repuestos.set([]);
          this.autorizaciones.set([]);
          this.ordenFacturas.set([]);
          this.facturasOt.set([]);
          this.selectedFacturaOt.set(null);
          this.facturaDetalle.set(null);
          this.cobrosFactura.set([]);
        }
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo eliminar la orden', err?.message),
    });
  }

  submitOrden() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'Cliente, vehículo, tipo de servicio y estado son obligatorios.');
      return;
    }

    const raw = this.form.getRawValue();
    const payload: VehOrdenTrabajoGuardarRequest = {
      dni: Number(raw.dni),
      idCliVehiculoFk: Number(raw.idCliVehiculoFk),
      tipoServicio: raw.tipoServicio || null,
      estadoOrden: raw.estadoOrden || null,
      fechaIngreso: this.toTimestamp(raw.fechaIngreso),
      fechaPrometida: this.toTimestamp(raw.fechaPrometida),
      kilometrajeIngreso: raw.kilometrajeIngreso ?? null,
      nivelCombustible: raw.nivelCombustible?.trim() || null,
      nivelBateria: raw.nivelBateria?.trim() || null,
      fallaReportada: raw.fallaReportada?.trim() || null,
      sintomasReportados: raw.sintomasReportados?.trim() || null,
      ruidosReportados: raw.ruidosReportados?.trim() || null,
      detalleCliente: raw.detalleCliente?.trim() || null,
      accesoriosEntregados: raw.accesoriosEntregados?.trim() || null,
      condicionIngreso: raw.condicionIngreso?.trim() || null,
      diagnosticoGeneral: raw.diagnosticoGeneral?.trim() || null,
      recomendacionGeneral: raw.recomendacionGeneral?.trim() || null,
      responsableRecepcion: raw.responsableRecepcion ?? null,
      responsableTecnico: raw.responsableTecnico ?? null,
      observaciones: raw.observaciones?.trim() || null,
      atributos: this.parseJson(raw.atributosJson),
    };

    this.saving.set(true);
    const request$ = this.editingOrdenId()
      ? this.repo.editarOrden({ idVehOrdenTrabajo: this.editingOrdenId()!, cambios: payload })
      : this.repo.crearOrden(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(
          this.editingOrdenId() ? 'Orden actualizada' : 'Orden creada',
          'La orden fue guardada correctamente.',
        );
        this.drawerVisible.set(false);
        this.refreshMainSnapshot();
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo guardar la orden', err?.message),
    });
  }

  cerrarDrawer = async () => {
    if (this.dirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.drawerVisible.set(false);
    this.refreshMainSnapshot();
  };

  abrirChild(mode: Exclude<ChildDrawerMode, null>) {
    const orden = this.selectedOrden();
    if (!orden) {
      this.notify.warn('Selecciona una orden', 'Primero selecciona una orden de trabajo.');
      return;
    }

    this.childMode.set(mode);
    this.childDrawerVisible.set(true);

    if (mode === 'checklist') {
      this.checklistForm.reset({
        idVehVehiculoCheckListVehiculoFk: null,
        estadoCheckList: 'PENDIENTE',
        observaciones: '',
      });
    }

    if (mode === 'trabajo') {
      this.trabajoForm.reset({
        tipoTrabajo: 'DIAGNOSTICO',
        descripcionInicial: '',
        descripcionRealizada: '',
        resultado: '',
        estadoTrabajo: 'PENDIENTE',
        fechaInicio: '',
        fechaFin: '',
        motivo: '',
        observaciones: '',
      });
    }

    if (mode === 'hallazgo') {
      this.hallazgoForm.reset({
        idVehOrdenTrabajoTrabajoFk: null,
        tipoHallazgo: 'RECEPCION',
        categoria: 'GENERAL',
        descripcion: '',
        severidad: 'MEDIA',
        estadoHallazgo: 'REPORTADO',
        requiereCambio: true,
        motivoCambio: '',
        aprobadoCliente: false,
        fechaAprobacion: '',
        observaciones: '',
        atributosJson: '{}',
      });
    }

    if (mode === 'repuesto') {
      this.repuestoForm.reset({
        art: null,
        cantidad: 1,
        precioUnitario: 0,
        motivoCambio: '',
        detalleInstalacion: '',
        serieAnterior: '',
        serieNueva: '',
        observaciones: '',
      });
      this.repuestoArticulos.set([]);
      this.repuestoArticuloQuery.set('');
    }

    if (mode === 'autorizacion') {
      this.autorizacionForm.reset({
        tipoAutorizacion: 'ADICIONAL',
        referenciaTabla: '',
        referenciaId: null,
        descripcion: '',
        estadoAutorizacion: 'PENDIENTE',
        fechaRespuesta: '',
        observaciones: '',
      });
    }

    if (mode === 'foto') {
      this.fotoForm.reset({
        etapa: 'ANTES',
        descripcion: '',
        principal: false,
      });
      this.fotoBase64.set(null);
      this.fotoPreview.set(null);
    }

    this.refreshChildSnapshot();
  }

  cerrarChildDrawer = async () => {
    if (this.childDirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.childDrawerVisible.set(false);
    this.childMode.set(null);
    this.refreshChildSnapshot();
  };

  abrirRepuestoArticuloPicker() {
    this.repuestoArticuloPickerVisible.set(true);
    this.buscarArticulosRepuesto(this.repuestoArticuloQuery().trim());
  }

  onRepuestoArticuloQueryChange(value: string) {
    this.repuestoArticuloQuery.set(value ?? '');
    this.buscarArticulosRepuesto(this.repuestoArticuloQuery().trim());
  }

  buscarArticulosRepuesto(query: string) {
    if (this.articuloSearchTimer) clearTimeout(this.articuloSearchTimer);

    this.articuloSearchTimer = setTimeout(() => {
      this.repuestoArticuloLoading.set(true);
      this.repo.listarArticulos(query, 0, 50, false)
        .pipe(finalize(() => this.repuestoArticuloLoading.set(false)))
        .subscribe({
          next: (res) => {
            const items = res.items ?? [];
            const current = this.repuestoArticuloSeleccionado();
            if (current && !items.some((x) => x.idActInventario === current.idActInventario)) {
              this.repuestoArticulos.set([current, ...items]);
            } else {
              this.repuestoArticulos.set(items);
            }
          },
          error: (err) => this.notify.error('No se pudo buscar artículos', err?.message),
        });
    }, 250);
  }

  seleccionarArticuloRepuesto(item: VehArticuloCatalogo) {
    this.repuestoForm.controls.art.setValue(item.idActInventario);
    this.repuestoArticuloPickerVisible.set(false);
    this.updateChildDirtyState();
  }

  limpiarArticuloRepuesto() {
    this.repuestoForm.controls.art.setValue(null);
    this.updateChildDirtyState();
  }

  submitChild() {
    const orden = this.selectedOrden();
    if (!orden) return;

    const mode = this.childMode();
    if (!mode) return;

    let request$: Observable<any>;

    if (mode === 'checklist') {
      if (this.checklistForm.invalid) {
        this.checklistForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Debes seleccionar un checklist relacionado.');
        return;
      }

      request$ = this.repo.crearOrdenCheckList({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        idVehVehiculoCheckListVehiculoFk: Number(this.checklistForm.value.idVehVehiculoCheckListVehiculoFk),
        estadoCheckList: this.checklistForm.value.estadoCheckList || null,
        observaciones: this.checklistForm.value.observaciones?.trim() || null,
      });
    } else if (mode === 'trabajo') {
      if (this.trabajoForm.invalid) {
        this.trabajoForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Tipo y descripción inicial son obligatorios.');
        return;
      }

      const payload: VehOrdenTrabajoTrabajoGuardarRequest = {
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        tipoTrabajo: this.trabajoForm.value.tipoTrabajo || null,
        descripcionInicial: this.trabajoForm.value.descripcionInicial?.trim() || null,
        descripcionRealizada: this.trabajoForm.value.descripcionRealizada?.trim() || null,
        resultado: this.trabajoForm.value.resultado?.trim() || null,
        estadoTrabajo: this.trabajoForm.value.estadoTrabajo || null,
        fechaInicio: this.toTimestamp(this.trabajoForm.value.fechaInicio),
        fechaFin: this.toTimestamp(this.trabajoForm.value.fechaFin),
        motivo: this.trabajoForm.value.motivo?.trim() || null,
        observaciones: this.trabajoForm.value.observaciones?.trim() || null,
      };
      request$ = this.repo.crearOrdenTrabajo(payload);
    } else if (mode === 'hallazgo') {
      if (this.hallazgoForm.invalid) {
        this.hallazgoForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'La descripción del hallazgo es obligatoria.');
        return;
      }

      const payload: VehOrdenTrabajoHallazgoGuardarRequest = {
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        idVehOrdenTrabajoTrabajoFk: this.hallazgoForm.value.idVehOrdenTrabajoTrabajoFk ?? null,
        tipoHallazgo: this.hallazgoForm.value.tipoHallazgo || null,
        categoria: this.hallazgoForm.value.categoria || null,
        descripcion: this.hallazgoForm.value.descripcion?.trim() || '',
        severidad: this.hallazgoForm.value.severidad || null,
        estadoHallazgo: this.hallazgoForm.value.estadoHallazgo || null,
        requiereCambio: !!this.hallazgoForm.value.requiereCambio,
        motivoCambio: this.hallazgoForm.value.motivoCambio?.trim() || null,
        aprobadoCliente: !!this.hallazgoForm.value.aprobadoCliente,
        fechaAprobacion: this.toTimestamp(this.hallazgoForm.value.fechaAprobacion),
        observaciones: this.hallazgoForm.value.observaciones?.trim() || null,
        atributos: this.parseJson(this.hallazgoForm.value.atributosJson),
      };
      request$ = this.repo.crearHallazgo(payload);
    } else if (mode === 'repuesto') {
      if (this.repuestoForm.invalid) {
        this.repuestoForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Artículo, cantidad y precio son obligatorios.');
        return;
      }

      const payload: VehOrdenTrabajoRepuestoGuardarRequest = {
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        art: Number(this.repuestoForm.value.art),
        cantidad: Number(this.repuestoForm.value.cantidad),
        precioUnitario: Number(this.repuestoForm.value.precioUnitario),
        motivoCambio: this.repuestoForm.value.motivoCambio?.trim() || null,
        detalleInstalacion: this.repuestoForm.value.detalleInstalacion?.trim() || null,
        serieAnterior: this.repuestoForm.value.serieAnterior?.trim() || null,
        serieNueva: this.repuestoForm.value.serieNueva?.trim() || null,
        observaciones: this.repuestoForm.value.observaciones?.trim() || null,
      };
      request$ = this.repo.crearRepuesto(payload);
    } else if (mode === 'autorizacion') {
      if (this.autorizacionForm.invalid) {
        this.autorizacionForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'La descripción de la autorización es obligatoria.');
        return;
      }

      const payload: VehOrdenTrabajoAutorizacionGuardarRequest = {
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        tipoAutorizacion: this.autorizacionForm.value.tipoAutorizacion || null,
        referenciaTabla: this.autorizacionForm.value.referenciaTabla?.trim() || null,
        referenciaId: this.autorizacionForm.value.referenciaId ?? null,
        descripcion: this.autorizacionForm.value.descripcion?.trim() || null,
        estadoAutorizacion: this.autorizacionForm.value.estadoAutorizacion || null,
        fechaRespuesta: this.toTimestamp(this.autorizacionForm.value.fechaRespuesta),
        observaciones: this.autorizacionForm.value.observaciones?.trim() || null,
      };
      request$ = this.repo.crearAutorizacion(payload);
    } else {
      const hallazgo = this.selectedHallazgo();
      if (!hallazgo) {
        this.notify.warn('Selecciona un hallazgo', 'La foto se registra sobre un hallazgo concreto.');
        return;
      }
      if (!this.fotoBase64()) {
        this.notify.warn('Archivo requerido', 'Selecciona una imagen para registrar la evidencia.');
        return;
      }

      const payload: VehOrdenTrabajoHallazgoFotoGuardarRequest = {
        idVehOrdenTrabajoHallazgoFk: hallazgo.idVehOrdenTrabajoHallazgo,
        etapa: this.fotoForm.value.etapa || null,
        foto: this.fotoBase64() || null,
        descripcion: this.fotoForm.value.descripcion?.trim() || null,
        principal: !!this.fotoForm.value.principal,
      };
      request$ = this.repo.crearHallazgoFoto(payload);
    }

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Registro guardado', 'La operación se ejecutó correctamente.');
        this.childDrawerVisible.set(false);
        this.childMode.set(null);
        this.refreshChildSnapshot();
        this.cargarDetalle(orden);
      },
      error: (err) => this.notify.error('No se pudo guardar el registro', err?.message),
    });
  }

  abrirComercialDrawer(mode: Exclude<ComercialDrawerMode, null>) {
    const orden = this.selectedOrden();
    if (!orden) {
      this.notify.warn('Selecciona una orden', 'Debes seleccionar una OT para continuar.');
      return;
    }

    const factura = this.selectedFacturaOt();
    const idsPendientes = this.repuestosPendientesIds().join(', ');

    if ((mode === 'cobro' || mode === 'contabilizar') && !factura) {
      this.notify.warn('Selecciona una factura', 'Primero selecciona una factura de la OT.');
      return;
    }

    this.comercialDrawerMode.set(mode);
    this.comercialDrawerVisible.set(true);

    if (mode === 'workflow') {
      this.workflowForm.reset({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        idAdmPtoemiFk: null,
        idsVehOrdenTrabajoRepuesto: idsPendientes,
        observacionFactura: '',
        tipoFacturacion: 'PARCIAL',
        dni: orden.dni ?? null,
        cen: null,
        credito: false,
        pagoInicial: 0,
        cuotas: 1,
        fechaEmisionIso: '',
        fechaPrimerVencimientoIso: '',
        idTaxCompAutFk: 1,
        usarPrecioRepuesto: true,
        idCntFormaPagoFk: null,
        idCntPlanFormaPagoFk: null,
        idBanDocBancoFk: null,
        idBanBancoFk: null,
        idBanBancoSubFk: null,
        idTaxTarjetaDiferidoFk: null,
        idBanTarjetaFk: null,
        referenciaDatafast: '',
        traCash: '',
        crearRecibo: true,
        contabilizarFactura: true,
        contabilizarCobro: true,
        conceptoFactura: 'Factura vehicular',
        conceptoCobro: 'Cobro vehicular',
      });
    }

    if (mode === 'factura') {
      this.facturaForm.reset({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        idsVehOrdenTrabajoRepuesto: idsPendientes,
        tipoFacturacion: 'PARCIAL',
        observacion: '',
        dni: orden.dni ?? null,
        cen: null,
        idAdmPtoemi: null,
        credito: false,
        entrada: 0,
        cuotas: 1,
        fechaPrimerVencimiento: '',
        idTaxCompAutFk: 1,
        usarPrecioRepuesto: true,
      });
    }

    if (mode === 'cobro' && factura) {
      this.cobroForm.reset({
        idFacVenta: factura.idFacVenta,
        valor: Number(factura.cxcDeuda || factura.total || 0),
        fecha: '',
        cen: factura.cen ?? null,
        idAdmPtoemi: null,
        idFacCaja: null,
        concepto: '',
        idCntFormaPagoFk: null,
        idBanDocBancoFk: null,
        traCash: '',
        idBanBancoFk: null,
        idBanBancoSubFk: null,
        idTaxTarjetaDiferidoFk: null,
        idBanTarjetaFk: null,
        referenciaDatafast: '',
        crearCajaSiNoExiste: true,
        contabilizar: true,
        idCntPlanFormaPagoFk: null,
        idCntTipoFk: 20,
      });
    }

    if (mode === 'contabilizar' && factura) {
      this.contabilizarForm.reset({
        idFacVenta: factura.idFacVenta,
        idCntTipoFk: 20,
        fechaContable: '',
        concepto: 'Factura vehicular',
      });
    }

    this.refreshComercialSnapshot();
  }

  cerrarComercialDrawer = async () => {
    if (this.comercialDirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.comercialDrawerVisible.set(false);
    this.comercialDrawerMode.set(null);
    this.refreshComercialSnapshot();
  };

  submitComercial() {
    const orden = this.selectedOrden();
    if (!orden) return;

    const mode = this.comercialDrawerMode();
    if (!mode) return;

    let request$: Observable<any>;

    if (mode === 'factura') {
      if (this.facturaForm.invalid) {
        this.facturaForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Debes indicar la OT.');
        return;
      }

      const payload: VehFacturaCrearRequest = {
        idVehOrdenTrabajoFk: Number(this.facturaForm.value.idVehOrdenTrabajoFk),
        idsVehOrdenTrabajoRepuesto: this.toIdList(this.facturaForm.value.idsVehOrdenTrabajoRepuesto),
        tipoFacturacion: this.facturaForm.value.tipoFacturacion || null,
        observacion: this.facturaForm.value.observacion?.trim() || null,
        dni: this.facturaForm.value.dni ?? null,
        cen: this.facturaForm.value.cen ?? null,
        idAdmPtoemi: this.facturaForm.value.idAdmPtoemi ?? null,
        credito: !!this.facturaForm.value.credito,
        entrada: Number(this.facturaForm.value.entrada || 0),
        cuotas: Number(this.facturaForm.value.cuotas || 1),
        fechaPrimerVencimiento: this.facturaForm.value.fechaPrimerVencimiento || null,
        idTaxCompAutFk: this.facturaForm.value.idTaxCompAutFk ?? null,
        usarPrecioRepuesto: !!this.facturaForm.value.usarPrecioRepuesto,
      };
      request$ = this.repo.crearFactura(payload);
    } else if (mode === 'cobro') {
      if (this.cobroForm.invalid) {
        this.cobroForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Factura y valor son obligatorios.');
        return;
      }

      const payload: VehCobroCrearRequest = {
        idFacVenta: Number(this.cobroForm.value.idFacVenta),
        valor: Number(this.cobroForm.value.valor || 0),
        fecha: this.toTimestamp(this.cobroForm.value.fecha),
        cen: this.cobroForm.value.cen ?? null,
        idAdmPtoemi: this.cobroForm.value.idAdmPtoemi ?? null,
        idFacCaja: this.cobroForm.value.idFacCaja ?? null,
        concepto: this.cobroForm.value.concepto?.trim() || null,
        idCntFormaPagoFk: this.cobroForm.value.idCntFormaPagoFk ?? null,
        idBanDocBancoFk: this.cobroForm.value.idBanDocBancoFk ?? null,
        traCash: this.cobroForm.value.traCash?.trim() || null,
        idBanBancoFk: this.cobroForm.value.idBanBancoFk ?? null,
        idBanBancoSubFk: this.cobroForm.value.idBanBancoSubFk ?? null,
        idTaxTarjetaDiferidoFk: this.cobroForm.value.idTaxTarjetaDiferidoFk ?? null,
        idBanTarjetaFk: this.cobroForm.value.idBanTarjetaFk ?? null,
        referenciaDatafast: this.cobroForm.value.referenciaDatafast?.trim() || null,
        crearCajaSiNoExiste: !!this.cobroForm.value.crearCajaSiNoExiste,
        contabilizar: !!this.cobroForm.value.contabilizar,
        idCntPlanFormaPagoFk: this.cobroForm.value.idCntPlanFormaPagoFk ?? null,
        idCntTipoFk: this.cobroForm.value.idCntTipoFk ?? null,
      };
      request$ = this.repo.crearCobro(payload);
    } else if (mode === 'contabilizar') {
      if (this.contabilizarForm.invalid) {
        this.contabilizarForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Debes indicar la factura.');
        return;
      }

      const payload: VehFacturaContabilizarRequest = {
        idFacVenta: Number(this.contabilizarForm.value.idFacVenta),
        idCntTipoFk: this.contabilizarForm.value.idCntTipoFk ?? null,
        fechaContable: this.contabilizarForm.value.fechaContable || null,
        concepto: this.contabilizarForm.value.concepto?.trim() || null,
      };
      request$ = this.repo.contabilizarFactura(payload);
    } else {
      if (this.workflowForm.invalid) {
        this.workflowForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'Debes indicar la OT para el workflow.');
        return;
      }

      const payload: VehFacturacionWorkflowRequest = {
        idVehOrdenTrabajoFk: Number(this.workflowForm.value.idVehOrdenTrabajoFk),
        idAdmPtoemiFk: this.workflowForm.value.idAdmPtoemiFk ?? null,
        idsVehOrdenTrabajoRepuesto: this.toIdList(this.workflowForm.value.idsVehOrdenTrabajoRepuesto),
        observacionFactura: this.workflowForm.value.observacionFactura?.trim() || null,
        tipoFacturacion: this.workflowForm.value.tipoFacturacion || null,
        dni: this.workflowForm.value.dni ?? null,
        cen: this.workflowForm.value.cen ?? null,
        credito: !!this.workflowForm.value.credito,
        pagoInicial: Number(this.workflowForm.value.pagoInicial || 0),
        cuotas: Number(this.workflowForm.value.cuotas || 1),
        fechaEmisionIso: this.toIsoStartOfDayWithOffset(this.workflowForm.value.fechaEmisionIso),
        fechaPrimerVencimientoIso: this.toIsoStartOfDayWithOffset(this.workflowForm.value.fechaPrimerVencimientoIso),
        idTaxCompAutFk: this.workflowForm.value.idTaxCompAutFk ?? null,
        usarPrecioRepuesto: !!this.workflowForm.value.usarPrecioRepuesto,
        idCntFormaPagoFk: this.workflowForm.value.idCntFormaPagoFk ?? null,
        idCntPlanFormaPagoFk: this.workflowForm.value.idCntPlanFormaPagoFk ?? null,
        idBanDocBancoFk: this.workflowForm.value.idBanDocBancoFk ?? null,
        idBanBancoFk: this.workflowForm.value.idBanBancoFk ?? null,
        idBanBancoSubFk: this.workflowForm.value.idBanBancoSubFk ?? null,
        idTaxTarjetaDiferidoFk: this.workflowForm.value.idTaxTarjetaDiferidoFk ?? null,
        idBanTarjetaFk: this.workflowForm.value.idBanTarjetaFk ?? null,
        referenciaDatafast: this.workflowForm.value.referenciaDatafast?.trim() || null,
        traCash: this.workflowForm.value.traCash?.trim() || null,
        crearRecibo: !!this.workflowForm.value.crearRecibo,
        contabilizarFactura: !!this.workflowForm.value.contabilizarFactura,
        contabilizarCobro: !!this.workflowForm.value.contabilizarCobro,
        conceptoFactura: this.workflowForm.value.conceptoFactura?.trim() || null,
        conceptoCobro: this.workflowForm.value.conceptoCobro?.trim() || null,
      };
      request$ = this.repo.facturarCobrarWorkflow(payload);
    }

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res: any) => {
        this.notify.success('Operación exitosa', res?.mensaje || 'Proceso ejecutado correctamente.');
        if (mode === 'workflow') {
          this.workflowResultado.set((res?.data ?? null) as VehFacturacionWorkflowResultado | null);
        }
        this.comercialDrawerVisible.set(false);
        this.comercialDrawerMode.set(null);
        this.refreshComercialSnapshot();
        this.activeTab.set('comercial');
        this.cargarDetalle(orden);
      },
      error: (err: any) => this.notify.error('No se pudo ejecutar la operación', err?.message),
    });
  }

  seleccionarHallazgo(h: VehOrdenTrabajoHallazgo) {
    this.selectedHallazgo.set(h);
    this.cargarHallazgoDetalle(h.idVehOrdenTrabajoHallazgo);
    this.activeTab.set('hallazgos');
  }

  seleccionarVista(vista: VehTipoVehiculoVista) {
    this.selectedVista.set(vista);
  }

  crearMarcaDesdeCanvas(point: { x: number; y: number }) {
    const hallazgo = this.selectedHallazgo();
    const vista = this.selectedVista();
    if (!hallazgo || !vista) {
      this.notify.warn('Contexto incompleto', 'Selecciona un hallazgo y una vista para marcar.');
      return;
    }

    const payload: VehOrdenTrabajoHallazgoMarcaGuardarRequest = {
      idVehOrdenTrabajoHallazgoFk: hallazgo.idVehOrdenTrabajoHallazgo,
      idVehTipoVehiculoVistaFk: vista.idVehTipoVehiculoVista,
      tipoMarca: 'PUNTO',
      geometria: { x: point.x, y: point.y },
      color: '#cd327f',
      observaciones: 'Marca creada desde canvas.',
    };

    this.repo.crearHallazgoMarca(payload).subscribe({
      next: () => {
        this.notify.success('Marca registrada', 'La marca visual del hallazgo fue guardada.');
        this.cargarHallazgoDetalle(hallazgo.idVehOrdenTrabajoHallazgo);
      },
      error: (err) => this.notify.error('No se pudo registrar la marca', err?.message),
    });
  }

  onFotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.notify.warn('Archivo inválido', 'Selecciona una imagen válida para la evidencia del hallazgo.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      this.fotoBase64.set(base64 || '');
      this.fotoPreview.set(dataUrl || null);
      this.updateChildDirtyState();
    };
    reader.readAsDataURL(file);
  }

  limpiarFotoSeleccionada() {
    this.fotoBase64.set('');
    this.fotoPreview.set(null);
    this.updateChildDirtyState();
  }

  nombreChecklistRelacionado(idRel?: number | null) {
    return this.checklistOpciones().find((x) => x.idVehVehiculoCheckListVehiculo === idRel)?.idVehVehiculoCheckListFk || idRel || '-';
  }

  childDrawerTitle() {
    switch (this.childMode()) {
      case 'checklist': return 'Agregar checklist';
      case 'trabajo': return 'Agregar trabajo';
      case 'hallazgo': return 'Agregar hallazgo';
      case 'repuesto': return 'Agregar repuesto';
      case 'autorizacion': return 'Agregar autorización';
      case 'foto': return 'Agregar evidencia';
      default: return 'Nuevo registro relacionado';
    }
  }

  childDrawerSubtitle() {
    switch (this.childMode()) {
      case 'checklist': return 'Mantén la recepción y la inspección dentro de la misma OT.';
      case 'trabajo': return 'Registra actividades del técnico sin salir del contexto de la orden.';
      case 'hallazgo': return 'Diagnóstico, daño o novedad detectada durante el proceso.';
      case 'repuesto': return 'Pieza, insumo o material relacionado a la ejecución de la OT.';
      case 'autorizacion': return 'Aprobaciones del cliente para adicionales, cambios o reparaciones.';
      case 'foto': return 'Sube evidencia real del hallazgo dentro de la misma pantalla operativa.';
      default: return 'La acción cambia según el punto del flujo donde te encuentres.';
    }
  }

  comercialDrawerTitle() {
    switch (this.comercialDrawerMode()) {
      case 'workflow': return 'Workflow integral';
      case 'factura': return 'Factura manual';
      case 'cobro': return 'Registrar cobro';
      case 'contabilizar': return 'Contabilizar factura';
      default: return 'Operación comercial';
    }
  }

  comercialDrawerSubtitle() {
    switch (this.comercialDrawerMode()) {
      case 'workflow': return 'Facturación + cobro + contabilidad en un solo flujo desde la OT.';
      case 'factura': return 'Genera la factura manualmente sin abandonar el contexto de la orden.';
      case 'cobro': return 'Registra el cobro inicial o total directamente desde la misma OT.';
      case 'contabilizar': return 'Lanza el asiento contable de la factura seleccionada.';
      default: return 'Centro comercial operativo del taller.';
    }
  }

  repuestosPendientesCount() {
    return this.repuestos().filter((x) => !x.idFacVentaFk).length;
  }

  repuestosPendientesIds() {
    return this.repuestos()
      .filter((x) => !x.idFacVentaFk)
      .map((x) => x.idVehOrdenTrabajoRepuesto);
  }

  tieneFacturaSeleccionada() {
    return !!this.selectedFacturaOt();
  }

  facturaActual(): any {
    const data = this.facturaDetalle() as any;
    return data?.factura ?? this.selectedFacturaOt() ?? null;
  }

  facturaDetalleItems(): any[] {
    const data = this.facturaDetalle() as any;
    return Array.isArray(data?.detalle) ? data.detalle : [];
  }

  facturaCxcItems(): any[] {
    const data = this.facturaDetalle() as any;
    return Array.isArray(data?.cxc) ? data.cxc : [];
  }

  workflowDetalles(): any[] {
    const data = this.workflowResultado() as any;
    const items = data?.detallesFacturados ?? data?.detailsFacturados;
    return Array.isArray(items) ? items : [];
  }

  muestraCamposCobroWorkflow() {
    return !!this.workflowForm.value.crearRecibo && Number(this.workflowForm.value.pagoInicial || 0) > 0;
  }

  resolveBinarySrc(binary?: string | null) {
    if (!binary) return null;
    const value = String(binary).trim();
    if (!value) return null;
    if (
      value.startsWith('data:') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('blob:')
    ) {
      return value;
    }
    return `data:${this.guessMimeType(value)};base64,${value}`;
  }

  esVerdadero(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'si', 'sí'].includes(value.toLowerCase());
    return false;
  }

  private toIdList(raw?: string | null): number[] | null {
    if (!raw || !raw.trim()) return null;
    const ids = raw
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => !Number.isNaN(x) && x > 0);
    return ids.length ? ids : null;
  }

  private guessMimeType(base64: string) {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('PHN2Zy') || base64.startsWith('PD94bWw')) return 'image/svg+xml';
    return 'image/png';
  }

  private parseJson(value?: string | null) {
    if (!value || !value.trim()) return {};
    try { return JSON.parse(value); } catch { return {}; }
  }

  private toDate(value?: string | null) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  private toTimestamp(value?: string | null) {
    if (!value) return null;
    return value.includes('T') || value.includes(' ') ? value : `${value} 00:00:00`;
  }

  private toIsoStartOfDayWithOffset(value?: string | null) {
    if (!value) return null;
    return value.includes('T') ? value : `${value}T00:00:00-05:00`;
  }

  private createMainSnapshot(): string {
    return JSON.stringify({
      ...this.form.getRawValue(),
      cliente: this.clienteSeleccionado()?.dni ?? this.clienteSeleccionado()?.ruc ?? null,
      vehiculo: this.vehiculoSeleccionado()?.idCliVehiculo ?? null,
    });
  }

  private createChildSnapshot(): string {
    return JSON.stringify({
      mode: this.childMode(),
      checklist: this.checklistForm.getRawValue(),
      trabajo: this.trabajoForm.getRawValue(),
      hallazgo: this.hallazgoForm.getRawValue(),
      repuesto: this.repuestoForm.getRawValue(),
      autorizacion: this.autorizacionForm.getRawValue(),
      foto: this.fotoForm.getRawValue(),
      fotoBase64: this.fotoBase64(),
    });
  }

  private createComercialSnapshot(): string {
    return JSON.stringify({
      mode: this.comercialDrawerMode(),
      factura: this.facturaForm.getRawValue(),
      cobro: this.cobroForm.getRawValue(),
      contabilizar: this.contabilizarForm.getRawValue(),
      workflow: this.workflowForm.getRawValue(),
    });
  }

  private refreshMainSnapshot() {
    this.initialMainSnapshot = this.createMainSnapshot();
    this.dirty.set(false);
  }

  private refreshChildSnapshot() {
    this.initialChildSnapshot = this.createChildSnapshot();
    this.childDirty.set(false);
  }

  private refreshComercialSnapshot() {
    this.initialComercialSnapshot = this.createComercialSnapshot();
    this.comercialDirty.set(false);
  }

  private updateMainDirtyState() {
    this.dirty.set(this.createMainSnapshot() !== this.initialMainSnapshot);
  }

  private updateChildDirtyState() {
    this.childDirty.set(this.createChildSnapshot() !== this.initialChildSnapshot);
  }

  private updateComercialDirtyState() {
    this.comercialDirty.set(this.createComercialSnapshot() !== this.initialComercialSnapshot);
  }
}