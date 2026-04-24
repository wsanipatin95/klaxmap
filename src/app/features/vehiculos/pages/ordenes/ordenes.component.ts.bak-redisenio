import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Observable, finalize, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosRepository } from '../../data-access/vehiculos.repository';
import {
  SegUsuarioListadoItem,
  VehArticuloCatalogo,
  VehCheckList,
  VehCheckListVehiculo,
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
  VehFacturaDetalleResponse,
  VehGarantia,
  VehGarantiaDetalle,
  VehGarantiaDetalleGuardarRequest,
  VehGarantiaGuardarRequest,
  VehGarantiaMovimiento,
  VehGarantiaMovimientoGuardarRequest,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import {
  ChecklistBulkRow,
  FacturaComercialSavePayload,
  FotoWorkbenchSavePayload,
  HallazgoWorkbenchSavePayload,
  OrdenDetailPanelComponent,
  RepuestoWorkbenchSavePayload,
  TrabajoWorkbenchSavePayload,
} from './components/orden-detail-panel/orden-detail-panel.component';
import { OrdenMainFormDrawerComponent } from './components/orden-main-form-drawer/orden-main-form-drawer.component';
import { OrdenReportesPanelComponent } from './components/orden-reportes-panel/orden-reportes-panel.component';

type ChildDrawerMode =
  | 'trabajo'
  | 'hallazgo'
  | 'repuesto'
  | 'autorizacion'
  | 'foto'
  | 'checklist'
  | 'garantia'
  | 'garantiaDetalle'
  | 'garantiaMovimiento'
  | null;

type ComercialDrawerMode =
  | 'factura'
  | 'cobro'
  | 'contabilizar'
  | null;

type AtributoRowForm = FormGroup<{
  key: FormControl<string>;
  value: FormControl<string>;
}>;

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
    VehiculosPageHeaderComponent,
    VehiculosEmptyStateComponent,
    VehiculosFormDrawerComponent,
    OrdenDetailPanelComponent,
    OrdenMainFormDrawerComponent,
    OrdenReportesPanelComponent,
  ],
  templateUrl: './ordenes.component.html',
  styleUrl: './ordenes.component.scss',
})
export class VehiculosOrdenesComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);
  private router = inject(Router);

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

  private readonly MAIN_DRAWER_PAGE_SIZE = 100;
  private detalleLoadSeq = 0;
  private hallazgoLoadSeq = 0;
  private facturaLoadSeq = 0;

  q = '';
  loading = signal(false);
  saving = signal(false);

  ordenes = signal<VehOrdenTrabajo[]>([]);
  selectedOrden = signal<VehOrdenTrabajo | null>(null);
  editingOrden = signal<VehOrdenTrabajo | null>(null);

  checklist = signal<VehOrdenTrabajoCheckList[]>([]);
  checklistOpciones = signal<VehCheckListVehiculo[]>([]);
  checklistCatalogo = signal<VehCheckList[]>([]);

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
  facturaDetalle = signal<VehFacturaDetalleResponse | null>(null);
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

  fotoBase64 = signal<string | null>(null);
  fotoPreview = signal<string | null>(null);

  responsableRecepcionSeleccionado = signal<SegUsuarioListadoItem | null>(null);
  responsableTecnicoSeleccionado = signal<SegUsuarioListadoItem | null>(null);

  clienteSeleccionadoNombre = signal('Cliente');
  vehiculoSeleccionadoLabel = signal('Vehículo');

  articuloCache = signal<Record<number, VehArticuloCatalogo>>({});

  garantias = signal<VehGarantia[]>([]);
  selectedGarantia = signal<VehGarantia | null>(null);
  garantiaDetalles = signal<VehGarantiaDetalle[]>([]);
  garantiaMovimientos = signal<VehGarantiaMovimiento[]>([]);

  private initialChildSnapshot = '';
  private initialComercialSnapshot = '';
  private articuloSearchTimer: ReturnType<typeof setTimeout> | null = null;

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

  garantiaForm = this.fb.group({
    tipoGarantia: ['REPUESTO'],
    modalidadVencimiento: ['TIEMPO_O_KM'],
    fechaBase: [''],
    kmBase: [0],
    diasGarantia: [90],
    mesesGarantia: [null as number | null],
    kmGarantia: [5000],
    fechaVence: [''],
    kmVence: [null as number | null],
    estadoGarantia: ['ACTIVA'],
    responsableCosto: ['TALLER'],
    observaciones: [''],
  });

  garantiaDetalleForm = this.fb.group({
    tipoCobertura: ['REPUESTO'],
    idVehOrdenTrabajoTrabajoFk: [null as number | null],
    idVehOrdenTrabajoRepuestoFk: [null as number | null],
    art: [null as number | null],
    cubreManoObra: [true],
    cubreRepuesto: [true],
    montoMaximo: [0],
    cantidadMaxima: [1],
    serieAnterior: [''],
    serieNueva: [''],
    observaciones: [''],
  });

  garantiaMovimientoForm = this.fb.group({
    idVehOrdenTrabajoFk: [null as number | null],
    fechaReclamo: [''],
    kmReclamo: [0],
    diagnostico: ['', Validators.required],
    resultado: ['PENDIENTE'],
    valorCliente: [0],
    valorTaller: [0],
    valorProveedor: [0],
    motivoRechazo: [''],
    observaciones: [''],
  });

  readonly hallazgoAtributosFormArray = this.fb.array<AtributoRowForm>([
    this.createAtributoRow('', ''),
  ]);

  readonly repuestoArticuloSeleccionado = computed(() => {
    const art = this.repuestoForm.controls.art.value;
    if (art == null) return null;
    return this.articuloCache()[art] ?? null;
  });

  readonly checklistLabelMap = computed<Record<number, string>>(() => {
    const catalogo = this.checklistCatalogo();
    const result: Record<number, string> = {};
    for (const rel of this.checklistOpciones()) {
      const item = catalogo.find((x) => x.idVehVehiculoCheckList === rel.idVehVehiculoCheckListFk);
      result[rel.idVehVehiculoCheckListVehiculo] = item?.nombreItem || `Checklist ${rel.idVehVehiculoCheckListFk}`;
    }
    return result;
  });

  readonly trabajoLabelMap = computed<Record<number, string>>(() => {
    const result: Record<number, string> = {};
    for (const trabajo of this.trabajos()) {
      result[trabajo.idVehOrdenTrabajoTrabajo] = [
        trabajo.tipoTrabajo || 'TRABAJO',
        trabajo.descripcionInicial || trabajo.descripcionRealizada || '',
      ].filter(Boolean).join(' · ');
    }
    return result;
  });

  readonly articuloLabelMap = computed<Record<number, string>>(() => {
    const result: Record<number, string> = {};

    for (const item of this.repuestos()) {
      if (!item.art) continue;
      result[item.art] = [
        item.artcod || `ART-${item.art}`,
        item.articulo || '',
      ].filter(Boolean).join(' · ');
    }

    const cache = this.articuloCache();
    for (const key of Object.keys(cache)) {
      const id = Number(key);
      const item = cache[id];
      if (!result[id]) {
        result[id] = [item.artcod || `ART-${item.idActInventario}`, item.articulo].filter(Boolean).join(' · ');
      }
    }

    return result;
  });

  readonly articulosCatalogo = computed<VehArticuloCatalogo[]>(() =>
    Object.values(this.articuloCache()).sort((a, b) =>
      String(a.articulo || '').localeCompare(String(b.articulo || '')),
    ),
  );

  constructor() {
    this.ensureAtLeastOneAtributoRow(this.hallazgoAtributosRows);

    this.checklistForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.trabajoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.hallazgoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.repuestoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.autorizacionForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.fotoForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.garantiaForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.garantiaDetalleForm.valueChanges.subscribe(() => this.updateChildDirtyState());
    this.garantiaMovimientoForm.valueChanges.subscribe(() => this.updateChildDirtyState());

    this.facturaForm.valueChanges.subscribe(() => this.updateComercialDirtyState());
    this.cobroForm.valueChanges.subscribe(() => this.updateComercialDirtyState());
    this.contabilizarForm.valueChanges.subscribe(() => this.updateComercialDirtyState());
    this.workflowForm.valueChanges.subscribe(() => this.updateComercialDirtyState());

    this.cargar();
    this.cargarCatalogoChecklistSiHaceFalta();
  }

  get hallazgoAtributosRows(): FormArray<AtributoRowForm> {
    return this.hallazgoAtributosFormArray;
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
    this.repo.listarOrdenes(this.q, 0, this.MAIN_DRAWER_PAGE_SIZE, false)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.ordenes.set(items);
          const current = this.selectedOrden();
          if (!current) return;

          const found = items.find((x) => x.idVehOrdenTrabajo === current.idVehOrdenTrabajo) ?? null;
          this.selectedOrden.set(found);
          if (found) {
            this.cargarDetalle(found);
          } else {
            this.resetDetalle();
          }
        },
        error: (err) => this.notify.error('No se pudieron cargar órdenes', err?.message),
      });
  }

  seleccionarOrden(item: VehOrdenTrabajo) {
    this.selectedOrden.set(item);
    this.cargarDetalle(item);
  }

  nuevo() {
    this.editingOrden.set(null);
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editarOrden(item: VehOrdenTrabajo) {
    if (this.isOrdenBloqueada(item)) {
      this.notify.warn('Orden bloqueada', 'La OT está finalizada o anulada y solo puede verse en modo consulta.');
      return;
    }

    this.selectedOrden.set(item);
    this.cargarDetalle(item);
    this.editingOrden.set(item);
    this.drawerVisible.set(true);
  }

  onMainDrawerDirtyChange(dirty: boolean) {
    this.dirty.set(dirty);
  }

  async onMainDrawerVisibleChange(visible: boolean) {
    if (visible) {
      this.drawerVisible.set(true);
      return;
    }

    await this.cerrarDrawer();
  }

  cerrarDrawer = async () => {
    if (!this.dirty()) {
      this.finalizeMainDrawerClose();
      return;
    }

    const ok = this.editingOrden()
      ? await this.confirm.confirmLeaveEdit()
      : await this.confirm.confirmDiscard();

    if (!ok) return;

    this.finalizeMainDrawerClose();
  };

  guardarOrden(payload: VehOrdenTrabajoGuardarRequest, closeAfterSave = false) {
    this.saving.set(true);

    const request$ = this.editingOrden()
      ? this.repo.editarOrden({
        idVehOrdenTrabajo: this.editingOrden()!.idVehOrdenTrabajo,
        cambios: payload,
      })
      : this.repo.crearOrden(payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res: any) => {
          const savedId = this.extractOrdenIdFromResponse(res);
          const successTitle = this.editingOrden() ? 'Orden actualizada' : 'Orden creada';

          this.notify.success(successTitle, res?.mensaje || 'La orden fue guardada correctamente.');
          this.dirty.set(false);
          this.refrescarOrdenGuardada(savedId, closeAfterSave);
        },
        error: (err) => this.notify.error('No se pudo guardar la orden', err?.message),
      });
  }

  async eliminarOrden(item: VehOrdenTrabajo) {
    if (this.isOrdenBloqueada(item)) {
      this.notify.warn('Acción no permitida', 'Una OT finalizada o anulada ya no se puede eliminar.');
      return;
    }

    let ok = false;

    try {
      ok = await this.confirm.confirmDelete(`la orden #${item.idVehOrdenTrabajo}`);
    } catch {
      this.notify.error('No se pudo abrir el confirmador', 'Intenta nuevamente.');
      return;
    }

    if (!ok) return;

    this.saving.set(true);
    this.repo.eliminarOrden(item.idVehOrdenTrabajo)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Orden eliminada', 'La orden fue eliminada correctamente.');

          if (this.selectedOrden()?.idVehOrdenTrabajo === item.idVehOrdenTrabajo) {
            this.selectedOrden.set(null);
            this.resetDetalle();
          }

          if (this.editingOrden()?.idVehOrdenTrabajo === item.idVehOrdenTrabajo) {
            this.finalizeMainDrawerClose();
          }

          this.cargar();
        },
        error: (err) => this.notify.error('No se pudo eliminar la orden', err?.message),
      });
  }

  cargarDetalle(item: VehOrdenTrabajo) {
    const loadSeq = ++this.detalleLoadSeq;

    forkJoin({
      checklist: this.repo.listarOrdenChecklists({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      trabajos: this.repo.listarOrdenTrabajos({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      hallazgos: this.repo.listarHallazgos({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      repuestos: this.repo.listarRepuestos({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      autorizaciones: this.repo.listarAutorizaciones({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      facturasRelacion: this.repo.listarOrdenFacturas({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      facturasOt: this.repo.listarFacturas('', 0, 100, true, { idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      garantias: this.repo.listarGarantias({ idVehOrdenTrabajoOrigenFk: item.idVehOrdenTrabajo }),
      checklistOpciones: this.repo.listarClientesVehiculo({ dni: item.dni }).pipe(
        map((vehiculos) => {
          const vehiculo = (vehiculos.items ?? []).find((x) => x.idCliVehiculo === item.idCliVehiculoFk) ?? null;
          return { vehiculos: vehiculos.items ?? [], vehiculo };
        }),
      ),
    }).subscribe({
      next: ({
        checklist,
        trabajos,
        hallazgos,
        repuestos,
        autorizaciones,
        facturasRelacion,
        facturasOt,
        garantias,
        checklistOpciones,
      }) => {
        const currentSelection = this.selectedOrden();
        if (
          loadSeq !== this.detalleLoadSeq ||
          !currentSelection ||
          currentSelection.idVehOrdenTrabajo !== item.idVehOrdenTrabajo
        ) {
          return;
        }

        this.checklist.set(checklist.items ?? []);
        this.trabajos.set(trabajos.items ?? []);
        this.hallazgos.set(hallazgos.items ?? []);
        this.repuestos.set(repuestos.items ?? []);
        this.autorizaciones.set(autorizaciones.items ?? []);
        this.ordenFacturas.set(facturasRelacion.items ?? []);
        this.facturasOt.set(facturasOt.items ?? []);

        this.hidratarArticulos((repuestos.items ?? []).map((x) => x.art));

        if (checklistOpciones.vehiculo) {
          this.vehiculoSeleccionadoLabel.set(
            this.ordenVehiculoDisplay(item) ||
            [checklistOpciones.vehiculo.marca, checklistOpciones.vehiculo.modelo, checklistOpciones.vehiculo.placa]
              .filter(Boolean)
              .join(' · ') ||
            'Vehículo',
          );

          this.repo.listarChecklistsVehiculo({ idVehTipoVehiculoFk: checklistOpciones.vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => {
              if (loadSeq !== this.detalleLoadSeq) return;
              this.checklistOpciones.set(r.items ?? []);
            },
            error: () => {
              if (loadSeq !== this.detalleLoadSeq) return;
              this.checklistOpciones.set([]);
            },
          });

          this.repo.listarVistas({ idVehTipoVehiculoFk: checklistOpciones.vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => {
              if (loadSeq !== this.detalleLoadSeq) return;
              const items = r.items ?? [];
              this.vistas.set(items);
              const currentVista = this.selectedVista();
              const selectedVista = currentVista
                ? items.find((x) => x.idVehTipoVehiculoVista === currentVista.idVehTipoVehiculoVista) ?? null
                : (items[0] ?? null);
              this.selectedVista.set(selectedVista);
            },
            error: () => {
              if (loadSeq !== this.detalleLoadSeq) return;
              this.vistas.set([]);
              this.selectedVista.set(null);
            },
          });
        } else {
          this.vehiculoSeleccionadoLabel.set('Vehículo');
          this.checklistOpciones.set([]);
          this.vistas.set([]);
          this.selectedVista.set(null);
        }

        const hallazgosItems = hallazgos.items ?? [];
        const currentHallazgoId = this.selectedHallazgo()?.idVehOrdenTrabajoHallazgo ?? null;

        const selectedHallazgo =
          currentHallazgoId != null
            ? (hallazgosItems.find((x) => x.idVehOrdenTrabajoHallazgo === currentHallazgoId) || null)
            : (hallazgosItems[0] || null);

        this.selectedHallazgo.set(selectedHallazgo);

        if (selectedHallazgo) {
          this.cargarHallazgoDetalle(selectedHallazgo.idVehOrdenTrabajoHallazgo);
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

        this.clienteSeleccionadoNombre.set(this.ordenClienteDisplay(item));
        this.cargarUsuarioSeleccionado(item.responsableRecepcion ?? null, 'recepcion');
        this.cargarUsuarioSeleccionado(item.responsableTecnico ?? null, 'tecnico');

        this.garantias.set(garantias.items ?? []);

        const garantiaActual = this.selectedGarantia();
        const garantiasItems = garantias.items ?? [];
        const garantiaSeleccionada =
          garantiaActual
            ? (garantiasItems.find((x) => x.idVehGarantia === garantiaActual.idVehGarantia) || null)
            : (garantiasItems[0] || null);

        this.selectedGarantia.set(garantiaSeleccionada);
        if (garantiaSeleccionada) {
          this.cargarGarantiaDetalle(garantiaSeleccionada.idVehGarantia);
        } else {
          this.garantiaDetalles.set([]);
          this.garantiaMovimientos.set([]);
        }
      },
      error: (err) => this.notify.error('No se pudo cargar detalle de la orden', err?.message),
    });
  }

  cargarGarantiaDetalle(idVehGarantia: number) {
    forkJoin({
      detalles: this.repo.listarGarantiaDetalles({ idVehGarantiaFk: idVehGarantia }),
      movimientos: this.repo.listarGarantiaMovimientos({ idVehGarantiaFk: idVehGarantia }),
    }).subscribe({
      next: ({ detalles, movimientos }) => {
        if (this.selectedGarantia()?.idVehGarantia !== idVehGarantia) return;
        this.garantiaDetalles.set(detalles.items ?? []);
        this.garantiaMovimientos.set(movimientos.items ?? []);
      },
      error: (err) => this.notify.error('No se pudo cargar el detalle de garantía', err?.message),
    });
  }

  seleccionarGarantia(item: VehGarantia) {
    this.selectedGarantia.set(item);
    this.cargarGarantiaDetalle(item.idVehGarantia);
  }

  resetDetalle() {
    this.checklist.set([]);
    this.checklistOpciones.set([]);
    this.trabajos.set([]);
    this.hallazgos.set([]);
    this.selectedHallazgo.set(null);
    this.marcas.set([]);
    this.fotos.set([]);
    this.repuestos.set([]);
    this.autorizaciones.set([]);
    this.ordenFacturas.set([]);
    this.vistas.set([]);
    this.selectedVista.set(null);
    this.facturasOt.set([]);
    this.selectedFacturaOt.set(null);
    this.facturaDetalle.set(null);
    this.cobrosFactura.set([]);
    this.workflowResultado.set(null);
    this.responsableRecepcionSeleccionado.set(null);
    this.responsableTecnicoSeleccionado.set(null);
    this.clienteSeleccionadoNombre.set('Cliente');
    this.vehiculoSeleccionadoLabel.set('Vehículo');
    this.garantias.set([]);
    this.selectedGarantia.set(null);
    this.garantiaDetalles.set([]);
    this.garantiaMovimientos.set([]);
  }

  abrirGarantiaDrawer() {
    const orden = this.selectedOrden();
    if (!orden) return;
    this.childMode.set('garantia');
    this.childDrawerVisible.set(true);
    this.garantiaForm.reset({
      tipoGarantia: 'REPUESTO',
      modalidadVencimiento: 'TIEMPO_O_KM',
      fechaBase: '',
      kmBase: Number(orden.kilometrajeIngreso || 0),
      diasGarantia: 90,
      mesesGarantia: null,
      kmGarantia: 5000,
      fechaVence: '',
      kmVence: null,
      estadoGarantia: 'ACTIVA',
      responsableCosto: 'TALLER',
      observaciones: '',
    });
    this.refreshChildSnapshot();
  }

  abrirGarantiaDetalleDrawer() {
    if (!this.selectedGarantia()) return;
    this.childMode.set('garantiaDetalle');
    this.childDrawerVisible.set(true);
    this.garantiaDetalleForm.reset({
      tipoCobertura: 'REPUESTO',
      idVehOrdenTrabajoTrabajoFk: null,
      idVehOrdenTrabajoRepuestoFk: null,
      art: null,
      cubreManoObra: true,
      cubreRepuesto: true,
      montoMaximo: 0,
      cantidadMaxima: 1,
      serieAnterior: '',
      serieNueva: '',
      observaciones: '',
    });
    this.refreshChildSnapshot();
  }

  abrirGarantiaMovimientoDrawer() {
    const garantia = this.selectedGarantia();
    if (!garantia) return;
    this.childMode.set('garantiaMovimiento');
    this.childDrawerVisible.set(true);
    this.garantiaMovimientoForm.reset({
      idVehOrdenTrabajoFk: garantia.idVehOrdenTrabajoReclamoFk ?? null,
      fechaReclamo: '',
      kmReclamo: 0,
      diagnostico: '',
      resultado: 'PENDIENTE',
      valorCliente: 0,
      valorTaller: 0,
      valorProveedor: 0,
      motivoRechazo: '',
      observaciones: '',
    });
    this.refreshChildSnapshot();
  }

  cargarHallazgoDetalle(idVehOrdenTrabajoHallazgo: number) {
    const hallazgoSeq = ++this.hallazgoLoadSeq;

    forkJoin({
      marcas: this.repo.listarHallazgoMarcas({ idVehOrdenTrabajoHallazgoFk: idVehOrdenTrabajoHallazgo }),
      fotos: this.repo.listarHallazgoFotos({ idVehOrdenTrabajoHallazgoFk: idVehOrdenTrabajoHallazgo }),
    }).subscribe({
      next: ({ marcas, fotos }) => {
        if (
          hallazgoSeq !== this.hallazgoLoadSeq ||
          this.selectedHallazgo()?.idVehOrdenTrabajoHallazgo !== idVehOrdenTrabajoHallazgo
        ) {
          return;
        }

        this.marcas.set(marcas.items ?? []);
        this.fotos.set(fotos.items ?? []);
      },
      error: (err) => this.notify.error('No se pudo cargar detalle del hallazgo', err?.message),
    });
  }

  seleccionarHallazgo(hallazgo: VehOrdenTrabajoHallazgo) {
    this.selectedHallazgo.set(hallazgo);
    this.cargarHallazgoDetalle(hallazgo.idVehOrdenTrabajoHallazgo);
  }

  limpiarSeleccionHallazgoWorkbench() {
    this.selectedHallazgo.set(null);
    this.marcas.set([]);
    this.fotos.set([]);
    this.hallazgoLoadSeq++;
  }

  seleccionarVista(vista: VehTipoVehiculoVista) {
    this.selectedVista.set(vista);
  }

  seleccionarFacturaOt(item: VehFactura, _activar = true) {
    const facturaSeq = ++this.facturaLoadSeq;
    this.selectedFacturaOt.set(item);

    forkJoin({
      detalle: this.repo.obtenerFactura(item.idFacVenta),
      cobros: this.repo.listarCobros('', 0, 100, true, { idFacVenta: item.idFacVenta }),
    }).subscribe({
      next: ({ detalle, cobros }) => {
        if (
          facturaSeq !== this.facturaLoadSeq ||
          this.selectedFacturaOt()?.idFacVenta !== item.idFacVenta
        ) {
          return;
        }

        this.facturaDetalle.set(detalle);
        this.cobrosFactura.set(cobros.items ?? []);
      },
      error: (err) => this.notify.error('No se pudo cargar el detalle comercial', err?.message),
    });
  }

  severityEstado(estado?: string | null) {
    const v = this.normalizeEstadoOrden({ estadoOrden: estado } as VehOrdenTrabajo);
    if (v.includes('FINALIZ') || v.includes('ENTREG')) return 'success';
    if (v.includes('FACTUR')) return 'info';
    if (v.includes('DEVUELT') || v.includes('PEND') || v.includes('ESPERA') || v.includes('PROCESO')) return 'warn';
    if (v.includes('ANUL')) return 'danger';
    return 'secondary';
  }

  formatDateFriendly(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const raw = String(value).trim();
    if (!raw) return 'Sin fecha';

    const safe = raw.includes('T') ? raw : `${raw}T00:00:00`;
    const date = new Date(safe);

    if (Number.isNaN(date.getTime())) {
      return raw.slice(0, 10);
    }

    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  formatDateTimeFriendly(value?: string | null): string {
    if (!value) return 'Sin fecha';
    const raw = String(value).trim();
    if (!raw) return 'Sin fecha';

    const safe = raw.includes('T') ? raw : `${raw}T00:00:00`;
    const date = new Date(safe);

    if (Number.isNaN(date.getTime())) {
      return this.formatDateFriendly(raw);
    }

    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  clienteNombreSeleccionado(): string {
    return this.ordenClienteDisplay(this.selectedOrden()) || this.clienteSeleccionadoNombre();
  }

  vehiculoNombreSeleccionado(): string {
    return this.ordenVehiculoDisplay(this.selectedOrden()) || this.vehiculoSeleccionadoLabel();
  }

  responsableRecepcionNombre(): string {
    return this.responsableRecepcionSeleccionado()?.usuario || 'No asignado';
  }

  responsableTecnicoNombre(): string {
    return this.responsableTecnicoSeleccionado()?.usuario || 'No asignado';
  }

  checklistLabelByRelation(idRel?: number | null): string {
    if (!idRel) return 'Checklist';
    return this.checklistLabelMap()[idRel] || 'Checklist configurado';
  }

  trabajoLabelById(idTrabajo?: number | null): string {
    if (!idTrabajo) return 'Trabajo no especificado';
    return this.trabajoLabelMap()[idTrabajo] || 'Trabajo relacionado';
  }

  articuloLabelById(art?: number | null): string {
    if (!art) return 'Repuesto';

    const repuesto = this.repuestos().find((x) => x.art === art);
    if (repuesto?.articulo || repuesto?.artcod) {
      return [repuesto.artcod || `ART-${repuesto.art}`, repuesto.articulo || '']
        .filter(Boolean)
        .join(' · ');
    }

    return this.articuloLabelMap()[art] || `ART-${art}`;
  }

  facturaNumber(item?: VehFactura | null): string {
    if (!item) return 'Factura';
    return `${item.estab || '-'}-${item.ptoemi || '-'}-${item.secuencial || item.idFacVenta}`;
  }

  abrirChild(mode: Exclude<ChildDrawerMode, null>) {
    const orden = this.selectedOrden();
    if (this.isOrdenBloqueada(orden)) {
      this.notify.warn('Orden bloqueada', 'La OT está finalizada o anulada y ya no permite registrar movimientos.');
      return;
    }
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
      });
      this.populateAtributosFormArray(this.hallazgoAtributosRows, {});
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

  onRepuestoArticuloQueryChange(value: string) {
    const query = (value ?? '').trim();
    if (this.articuloSearchTimer) clearTimeout(this.articuloSearchTimer);

    this.articuloSearchTimer = setTimeout(() => {
      this.repo.listarArticulos(query, 0, 100, false).subscribe({
        next: (res) => {
          const current = { ...this.articuloCache() };
          for (const item of res.items ?? []) {
            current[item.idActInventario] = item;
          }
          this.articuloCache.set(current);
        },
      });
    }, 250);
  }

  seleccionarArticuloRepuesto(item: VehArticuloCatalogo) {
    const current = { ...this.articuloCache(), [item.idActInventario]: item };
    this.articuloCache.set(current);
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
        this.notify.warn('Formulario incompleto', 'Debes seleccionar un ítem del checklist.');
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
        this.notify.warn('Formulario incompleto', 'Tipo y descripción son obligatorios.');
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
        atributos: this.buildAtributosObject(this.hallazgoAtributosRows),
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
        this.notify.warn('Formulario incompleto', 'La descripción es obligatoria.');
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
    } else if (mode === 'garantia') {
      const payload: VehGarantiaGuardarRequest = {
        idVehOrdenTrabajoOrigenFk: orden.idVehOrdenTrabajo,
        tipoGarantia: this.garantiaForm.value.tipoGarantia || null,
        modalidadVencimiento: this.garantiaForm.value.modalidadVencimiento || null,
        fechaBase: this.toTimestamp(this.garantiaForm.value.fechaBase),
        kmBase: Number(this.garantiaForm.value.kmBase || 0),
        diasGarantia: this.garantiaForm.value.diasGarantia ?? null,
        mesesGarantia: this.garantiaForm.value.mesesGarantia ?? null,
        kmGarantia: Number(this.garantiaForm.value.kmGarantia || 0),
        fechaVence: this.toTimestamp(this.garantiaForm.value.fechaVence),
        kmVence: this.garantiaForm.value.kmVence != null ? Number(this.garantiaForm.value.kmVence) : null,
        estadoGarantia: this.garantiaForm.value.estadoGarantia || null,
        responsableCosto: this.garantiaForm.value.responsableCosto || null,
        observaciones: this.garantiaForm.value.observaciones?.trim() || null,
      };
      request$ = this.repo.crearGarantia(payload);
    } else if (mode === 'garantiaDetalle') {
      const garantia = this.selectedGarantia();
      if (!garantia) return;
      const payload: VehGarantiaDetalleGuardarRequest = {
        idVehGarantiaFk: garantia.idVehGarantia,
        tipoCobertura: this.garantiaDetalleForm.value.tipoCobertura || null,
        idVehOrdenTrabajoTrabajoFk: this.garantiaDetalleForm.value.idVehOrdenTrabajoTrabajoFk ?? null,
        idVehOrdenTrabajoRepuestoFk: this.garantiaDetalleForm.value.idVehOrdenTrabajoRepuestoFk ?? null,
        art: this.garantiaDetalleForm.value.art ?? null,
        cubreManoObra: this.garantiaDetalleForm.value.cubreManoObra ? 1 : 0,
        cubreRepuesto: this.garantiaDetalleForm.value.cubreRepuesto ? 1 : 0,
        montoMaximo: Number(this.garantiaDetalleForm.value.montoMaximo || 0),
        cantidadMaxima: Number(this.garantiaDetalleForm.value.cantidadMaxima || 0),
        serieAnterior: this.garantiaDetalleForm.value.serieAnterior?.trim() || null,
        serieNueva: this.garantiaDetalleForm.value.serieNueva?.trim() || null,
        observaciones: this.garantiaDetalleForm.value.observaciones?.trim() || null,
      };
      request$ = this.repo.crearGarantiaDetalle(payload);
    } else if (mode === 'garantiaMovimiento') {
      const garantia = this.selectedGarantia();
      if (!garantia) return;
      if (this.garantiaMovimientoForm.invalid) {
        this.garantiaMovimientoForm.markAllAsTouched();
        this.notify.warn('Formulario incompleto', 'El diagnóstico del reclamo es obligatorio.');
        return;
      }
      const payload: VehGarantiaMovimientoGuardarRequest = {
        idVehGarantiaFk: garantia.idVehGarantia,
        idVehOrdenTrabajoFk: this.garantiaMovimientoForm.value.idVehOrdenTrabajoFk ?? null,
        fechaReclamo: this.toTimestamp(this.garantiaMovimientoForm.value.fechaReclamo),
        kmReclamo: Number(this.garantiaMovimientoForm.value.kmReclamo || 0),
        diagnostico: this.garantiaMovimientoForm.value.diagnostico?.trim() || null,
        resultado: this.garantiaMovimientoForm.value.resultado || null,
        valorCliente: Number(this.garantiaMovimientoForm.value.valorCliente || 0),
        valorTaller: Number(this.garantiaMovimientoForm.value.valorTaller || 0),
        valorProveedor: Number(this.garantiaMovimientoForm.value.valorProveedor || 0),
        motivoRechazo: this.garantiaMovimientoForm.value.motivoRechazo?.trim() || null,
        observaciones: this.garantiaMovimientoForm.value.observaciones?.trim() || null,
      };
      request$ = this.repo.crearGarantiaMovimiento(payload);
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
    if (this.isOrdenBloqueada(orden)) {
      this.notify.warn('Orden bloqueada', 'La OT está finalizada o anulada y ya no permite operaciones comerciales.');
      return;
    }
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
        this.notify.warn('Formulario incompleto', 'Debes indicar la orden.');
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
        dni: Number(this.workflowForm.value.dni),
        idsVehOrdenTrabajoRepuesto: this.toIdList(this.workflowForm.value.idsVehOrdenTrabajoRepuesto) ?? [],
        subtotalCero: 0,
        subtotalIva: 0,
        iva: 0,
        descuento: 0,
        total: 0,
        observacionFactura: this.workflowForm.value.observacionFactura?.trim() || null,
      };

      request$ = this.repo.facturarCobrarWorkflow(payload);
    }

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res: any) => {
        this.notify.success('Operación exitosa', res?.mensaje || 'Proceso ejecutado correctamente.');
        this.comercialDrawerVisible.set(false);
        this.comercialDrawerMode.set(null);
        this.refreshComercialSnapshot();
        this.cargarDetalle(orden);
      },
      error: (err: any) => this.notify.error('No se pudo ejecutar la operación', err?.message),
    });
  }

  createMarcaDesdeCanvas(point: { x: number; y: number }) {
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

  childDrawerTitle() {
    switch (this.childMode()) {
      case 'checklist': return 'Agregar ítem';
      case 'trabajo': return 'Agregar trabajo';
      case 'hallazgo': return 'Agregar hallazgo';
      case 'repuesto': return 'Agregar repuesto';
      case 'autorizacion': return 'Agregar aprobación';
      case 'foto': return 'Agregar evidencia';
      case 'garantia': return 'Agregar garantía';
      case 'garantiaDetalle': return 'Agregar cobertura';
      case 'garantiaMovimiento': return 'Agregar reclamo / movimiento';
      default: return 'Nuevo registro relacionado';
    }
  }

  childDrawerSubtitle() {
    switch (this.childMode()) {
      case 'checklist': return 'Registra el resultado del checklist para esta orden.';
      case 'trabajo': return 'Describe lo solicitado, lo realizado y el resultado.';
      case 'hallazgo': return 'Daño, novedad o diagnóstico detectado durante el trabajo.';
      case 'repuesto': return 'Pieza o material usado durante la orden.';
      case 'autorizacion': return 'Control de aprobaciones del cliente.';
      case 'foto': return 'Sube una imagen relacionada con el hallazgo seleccionado.';
      case 'garantia': return 'Configura la garantía base asociada a la OT.';
      case 'garantiaDetalle': return 'Define el alcance y cobertura de la garantía.';
      case 'garantiaMovimiento': return 'Registra el reclamo, diagnóstico y costos del caso.';
      default: return 'La acción cambia según el punto del flujo donde te encuentres.';
    }
  }

  comercialDrawerTitle() {
    switch (this.comercialDrawerMode()) {
      case 'factura': return 'Factura manual';
      case 'cobro': return 'Registrar cobro';
      case 'contabilizar': return 'Contabilizar factura';
      default: return 'Operación comercial';
    }
  }

  comercialDrawerSubtitle() {
    switch (this.comercialDrawerMode()) {
      case 'factura': return 'Crea la factura sin salir de la orden.';
      case 'cobro': return 'Registra un cobro sobre la factura seleccionada.';
      case 'contabilizar': return 'Envía la factura al proceso contable.';
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

  addHallazgoAtributoRow() {
    this.hallazgoAtributosRows.push(this.createAtributoRow('', ''));
    this.updateChildDirtyState();
  }

  removeHallazgoAtributoRow(index: number) {
    if (this.hallazgoAtributosRows.length === 1) {
      this.hallazgoAtributosRows.at(0).patchValue({ key: '', value: '' });
      this.updateChildDirtyState();
      return;
    }
    this.hallazgoAtributosRows.removeAt(index);
    this.updateChildDirtyState();
  }

  private cargarCatalogoChecklistSiHaceFalta() {
    if (this.checklistCatalogo().length) return;
    this.repo.listarChecklists().subscribe({
      next: (res) => this.checklistCatalogo.set(res.items ?? []),
    });
  }

  private hidratarArticulos(ids: Array<number | null | undefined>) {
    const pendientes = [...new Set(ids.filter((x): x is number => Number.isFinite(Number(x))))]
      .filter((id) => !this.articuloCache()[id]);

    if (!pendientes.length) return;

    forkJoin(
      pendientes.map((id) =>
        this.repo.listarArticulos(String(id), 0, 25, false).pipe(
          map((res) => (res.items ?? []).find((x) => x.idActInventario === id) ?? null),
        ),
      ),
    ).subscribe({
      next: (items) => {
        const next = { ...this.articuloCache() };
        for (const item of items) {
          if (item) next[item.idActInventario] = item;
        }
        this.articuloCache.set(next);
      },
    });
  }

  private createAtributoRow(key = '', value = ''): AtributoRowForm {
    return this.fb.group({
      key: this.fb.control(key, { nonNullable: true }),
      value: this.fb.control(value, { nonNullable: true }),
    });
  }

  private ensureAtLeastOneAtributoRow(formArray: FormArray<AtributoRowForm>) {
    if (formArray.length === 0) {
      formArray.push(this.createAtributoRow('', ''));
    }
  }

  private populateAtributosFormArray(formArray: FormArray<AtributoRowForm>, data?: Record<string, unknown> | null) {
    formArray.clear();
    const entries = Object.entries(data ?? {});
    if (entries.length === 0) {
      formArray.push(this.createAtributoRow('', ''));
      return;
    }
    for (const [key, value] of entries) {
      formArray.push(this.createAtributoRow(key, this.stringifyAtributoValue(value)));
    }
  }

  private buildAtributosObject(formArray: FormArray<AtributoRowForm>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const row of formArray.controls) {
      const key = String(row.controls.key.value || '').trim();
      const rawValue = String(row.controls.value.value || '').trim();
      if (!key) continue;
      result[key] = this.parseAtributoValue(rawValue);
    }
    return result;
  }

  private parseAtributoValue(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (!Number.isNaN(Number(trimmed))) return Number(trimmed);

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  private stringifyAtributoValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private cargarUsuarioSeleccionado(idSegUsuario: number | null | undefined, target: 'recepcion' | 'tecnico') {
    if (!idSegUsuario) {
      if (target === 'recepcion') this.responsableRecepcionSeleccionado.set(null);
      if (target === 'tecnico') this.responsableTecnicoSeleccionado.set(null);
      return;
    }

    this.repo.listarUsuarios(String(idSegUsuario), 0, 20, false).subscribe({
      next: (res: any) => {
        const user = (res.items ?? []).find((x: SegUsuarioListadoItem) => x.idSegUsuario === idSegUsuario) ?? null;
        if (target === 'recepcion') this.responsableRecepcionSeleccionado.set(user);
        if (target === 'tecnico') this.responsableTecnicoSeleccionado.set(user);
      },
    });
  }

  private toIdList(raw?: string | null): number[] | null {
    if (!raw || !raw.trim()) return null;
    const ids = raw
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => !Number.isNaN(x) && x > 0);
    return ids.length ? ids : null;
  }

  private toTimestamp(value?: string | null) {
    if (!value) return null;
    if (value.includes('T')) return value;
    return `${value}T00:00:00-05:00`;
  }

  private createChildSnapshot(): string {
    return JSON.stringify({
      mode: this.childMode(),
      checklist: this.checklistForm.getRawValue(),
      trabajo: this.trabajoForm.getRawValue(),
      hallazgo: this.hallazgoForm.getRawValue(),
      hallazgoAtributos: this.buildAtributosObject(this.hallazgoAtributosRows),
      repuesto: this.repuestoForm.getRawValue(),
      autorizacion: this.autorizacionForm.getRawValue(),
      foto: this.fotoForm.getRawValue(),
      fotoBase64: this.fotoBase64(),
      garantia: this.garantiaForm.getRawValue(),
      garantiaDetalle: this.garantiaDetalleForm.getRawValue(),
      garantiaMovimiento: this.garantiaMovimientoForm.getRawValue(),
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

  private refreshChildSnapshot() {
    this.initialChildSnapshot = this.createChildSnapshot();
    this.childDirty.set(false);
  }

  private refreshComercialSnapshot() {
    this.initialComercialSnapshot = this.createComercialSnapshot();
    this.comercialDirty.set(false);
  }

  private updateChildDirtyState() {
    this.childDirty.set(this.createChildSnapshot() !== this.initialChildSnapshot);
  }

  private updateComercialDirtyState() {
    this.comercialDirty.set(this.createComercialSnapshot() !== this.initialComercialSnapshot);
  }

  normalizeEstadoOrden(item?: VehOrdenTrabajo | null): string {
    return String(item?.estadoOrden || 'RECIBIDO').trim().toUpperCase();
  }

  isOrdenAnulada(item?: VehOrdenTrabajo | null): boolean {
    return this.normalizeEstadoOrden(item) === 'ANULADO';
  }

  isOrdenFinalizada(item?: VehOrdenTrabajo | null): boolean {
    return this.normalizeEstadoOrden(item) === 'FINALIZADO';
  }

  isOrdenBloqueada(item?: VehOrdenTrabajo | null): boolean {
    return this.isOrdenAnulada(item) || this.isOrdenFinalizada(item);
  }

  canFinalizeOrden(item?: VehOrdenTrabajo | null): boolean {
    if (!item) return false;
    return !this.isOrdenBloqueada(item);
  }

  canDevolverOrden(item?: VehOrdenTrabajo | null): boolean {
    if (!item) return false;
    return this.isOrdenFinalizada(item);
  }

  finalizarOrden(item: VehOrdenTrabajo) {
    if (!this.canFinalizeOrden(item)) return;
    this.saving.set(true);
    this.repo.editarOrden({
      idVehOrdenTrabajo: item.idVehOrdenTrabajo,
      cambios: { estadoOrden: 'FINALIZADO' },
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Orden finalizada', `La OT #${item.idVehOrdenTrabajo} fue finalizada.`);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo finalizar la orden', err?.message),
    });
  }

  devolverOrden(item: VehOrdenTrabajo) {
    if (!this.canDevolverOrden(item)) return;
    this.saving.set(true);
    this.repo.editarOrden({
      idVehOrdenTrabajo: item.idVehOrdenTrabajo,
      cambios: { estadoOrden: 'EN_PROCESO' },
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Orden devuelta', `La OT #${item.idVehOrdenTrabajo} volvió a EN_PROCESO.`);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo devolver la orden', err?.message),
    });
  }

  anularOrden(item: VehOrdenTrabajo) {
    if (this.isOrdenBloqueada(item)) return;
    this.saving.set(true);
    this.repo.editarOrden({
      idVehOrdenTrabajo: item.idVehOrdenTrabajo,
      cambios: { estadoOrden: 'ANULADO' },
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Orden anulada', `La OT #${item.idVehOrdenTrabajo} fue anulada.`);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo anular la orden', err?.message),
    });
  }

  guardarChecklistMasivo(rows: ChecklistBulkRow[]) {
    const orden = this.selectedOrden();
    if (!orden) return;
    const cambios = rows.filter((x) => x.changed);
    if (!cambios.length) return;

    const requests = cambios.map((row) => {
      if (row.existingChecklistId) {
        return this.repo.editarOrdenCheckList({
          idVehOrdenTrabajoCheckList: row.existingChecklistId,
          cambios: {
            estadoCheckList: row.checked ? 'OK' : 'PENDIENTE',
            observaciones: row.observaciones?.trim() || null,
          },
        });
      }
      return this.repo.crearOrdenCheckList({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        idVehVehiculoCheckListVehiculoFk: row.relationId,
        estadoCheckList: row.checked ? 'OK' : 'PENDIENTE',
        observaciones: row.observaciones?.trim() || null,
      });
    });

    this.saving.set(true);
    forkJoin(requests).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Checklist actualizado', 'Los cambios del checklist fueron guardados.');
        this.cargarDetalle(orden);
      },
      error: (err) => this.notify.error('No se pudo guardar el checklist', err?.message),
    });
  }

  guardarTrabajoWorkbench(payload: TrabajoWorkbenchSavePayload) {
    const orden = this.selectedOrden();
    if (!orden) return;

    const request$ = payload.idVehOrdenTrabajoTrabajo
      ? this.repo.editarOrdenTrabajo({
        idVehOrdenTrabajoTrabajo: payload.idVehOrdenTrabajoTrabajo,
        cambios: payload,
      })
      : this.repo.crearOrdenTrabajo({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        ...payload,
      });

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Trabajo guardado', 'El trabajo fue guardado correctamente.');
        this.cargarDetalle(orden);
      },
      error: (err) => this.notify.error('No se pudo guardar el trabajo', err?.message),
    });
  }

  guardarHallazgoWorkbench(payload: HallazgoWorkbenchSavePayload) {
    const orden = this.selectedOrden();
    if (!orden) return;

    const request$ = payload.idVehOrdenTrabajoHallazgo
      ? this.repo.editarHallazgo({
        idVehOrdenTrabajoHallazgo: payload.idVehOrdenTrabajoHallazgo,
        cambios: payload,
      })
      : this.repo.crearHallazgo({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        ...payload,
      });

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Hallazgo guardado', 'El hallazgo fue guardado correctamente.');
        this.cargarDetalle(orden);
      },
      error: (err) => this.notify.error('No se pudo guardar el hallazgo', err?.message),
    });
  }

  guardarFotoWorkbench(payload: FotoWorkbenchSavePayload) {
    const orden = this.selectedOrden();
    if (!orden) return;
    this.saving.set(true);
    this.repo.crearHallazgoFoto(payload as VehOrdenTrabajoHallazgoFotoGuardarRequest)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Foto guardada', 'La evidencia fue guardada correctamente.');
          this.cargarDetalle(orden);
        },
        error: (err) => this.notify.error('No se pudo guardar la foto', err?.message),
      });
  }

  guardarRepuestoWorkbench(payload: RepuestoWorkbenchSavePayload) {
    const orden = this.selectedOrden();
    if (!orden) return;

    const request$ = payload.idVehOrdenTrabajoRepuesto
      ? this.repo.editarRepuesto({
        idVehOrdenTrabajoRepuesto: payload.idVehOrdenTrabajoRepuesto,
        cambios: payload,
      })
      : this.repo.crearRepuesto({
        idVehOrdenTrabajoFk: orden.idVehOrdenTrabajo,
        ...payload,
      });

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Repuesto guardado', 'El repuesto fue guardado correctamente.');
        this.cargarDetalle(orden);
      },
      error: (err) => this.notify.error('No se pudo guardar el repuesto', err?.message),
    });
  }

  eliminarRepuestoWorkbench(item: VehOrdenTrabajoRepuesto) {
    const orden = this.selectedOrden();
    if (!orden) return;
    this.saving.set(true);
    this.repo.eliminarRepuesto(item.idVehOrdenTrabajoRepuesto)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Repuesto eliminado', 'El repuesto fue eliminado correctamente.');
          this.cargarDetalle(orden);
        },
        error: (err) => this.notify.error('No se pudo eliminar el repuesto', err?.message),
      });
  }

  guardarFacturaDesdePanel(payload: FacturaComercialSavePayload | any) {
    const orden = this.selectedOrden();
    if (!orden) return;

    const requestPayload: VehFacturaCrearRequest = {
      idVehOrdenTrabajoFk: Number(payload?.idVehOrdenTrabajoFk ?? orden.idVehOrdenTrabajo),
      idsVehOrdenTrabajoRepuesto: Array.isArray(payload?.idsVehOrdenTrabajoRepuesto)
        ? payload.idsVehOrdenTrabajoRepuesto
        : this.toIdList(payload?.idsVehOrdenTrabajoRepuesto) ?? null,
      tipoFacturacion: payload?.tipoFacturacion || 'PARCIAL',
      observacion: payload?.observacion?.trim?.() || payload?.observacion || null,
      dni: payload?.dni ?? orden.dni ?? null,
      cen: payload?.cen ?? null,
      idAdmPtoemi: payload?.idAdmPtoemi ?? null,
      credito: !!payload?.credito,
      entrada: Number(payload?.entrada || 0),
      cuotas: Number(payload?.cuotas || 1),
      fechaPrimerVencimiento: payload?.fechaPrimerVencimiento || null,
      idTaxCompAutFk: payload?.idTaxCompAutFk ?? 1,
      usarPrecioRepuesto: payload?.usarPrecioRepuesto !== false,
    };

    this.saving.set(true);
    this.repo.crearFactura(requestPayload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Factura creada', 'La factura fue creada correctamente.');
          this.cargarDetalle(orden);
        },
        error: (err) => this.notify.error('No se pudo crear la factura', err?.message),
      });
  }

  private extractOrdenIdFromResponse(res: any): number | null {
    return Number(
      res?.idVehOrdenTrabajo ??
      res?.data?.idVehOrdenTrabajo ??
      res?.payload?.idVehOrdenTrabajo ??
      0,
    ) || null;
  }

  private refrescarOrdenGuardada(savedId: number | null, closeAfterSave: boolean) {
    this.cargar();

    if (closeAfterSave) {
      this.finalizeMainDrawerClose();
    }

    if (!savedId) return;

    setTimeout(() => {
      const found = this.ordenes().find((x) => x.idVehOrdenTrabajo === savedId) ?? null;
      if (found) {
        this.selectedOrden.set(found);
        this.cargarDetalle(found);
      }
    }, 0);
  }

  private finalizeMainDrawerClose() {
    this.drawerVisible.set(false);
    this.editingOrden.set(null);
    this.dirty.set(false);
  }

  private ordenClienteDisplay(item?: VehOrdenTrabajo | null): string {
    if (!item) return 'Cliente';
    return item.nombre || item.ruc || (item.dni ? `Cliente #${item.dni}` : 'Cliente');
  }

  private ordenVehiculoDisplay(item?: VehOrdenTrabajo | null): string {
    if (!item) return 'Vehículo';
    return [item.marca, item.modelo, item.placa].filter(Boolean).join(' · ') || 'Vehículo';
  }
}
