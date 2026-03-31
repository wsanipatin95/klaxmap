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
import { ConfirmationService } from 'primeng/api';
import { VehiculosPageHeaderComponent } from '../../components/page-header/page-header.component';
import { VehiculosFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { VehiculosEmptyStateComponent } from '../../components/empty-state/empty-state.component';
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
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { OrdenDetailPanelComponent } from './components/orden-detail-panel/orden-detail-panel.component';
import { OrdenMainFormDrawerComponent } from './components/orden-main-form-drawer/orden-main-form-drawer.component';

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
    OrdenDetailPanelComponent,
    OrdenMainFormDrawerComponent,
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

  fotoBase64 = signal<string | null>(null);
  fotoPreview = signal<string | null>(null);

  responsableRecepcionSeleccionado = signal<SegUsuarioListadoItem | null>(null);
  responsableTecnicoSeleccionado = signal<SegUsuarioListadoItem | null>(null);

  clienteSeleccionadoNombre = signal('Cliente');
  vehiculoSeleccionadoLabel = signal('Vehículo');

  articuloCache = signal<Record<number, VehArticuloCatalogo>>({});

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
    const cache = this.articuloCache();
    const result: Record<number, string> = {};
    for (const key of Object.keys(cache)) {
      const id = Number(key);
      const item = cache[id];
      result[id] = [item.artcod || `ART-${item.idActInventario}`, item.articulo].filter(Boolean).join(' · ');
    }
    return result;
  });

  constructor() {
    this.ensureAtLeastOneAtributoRow(this.hallazgoAtributosRows);

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
    this.repo.listarOrdenes(this.q, 0, 50, false)
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
    if (this.isOrdenAnulada(item)) {
      this.notify.warn('Orden bloqueada', 'La OT está anulada y solo puede verse en modo consulta.');
      return;
    }
    this.editingOrden.set(item);
    this.drawerVisible.set(true);
  }

  onMainDrawerDirtyChange(dirty: boolean) {
    this.dirty.set(dirty);
  }

  onMainDrawerVisibleChange(visible: boolean) {
    this.drawerVisible.set(visible);
  }

  cerrarDrawer = async () => {
    if (this.dirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.drawerVisible.set(false);
    this.dirty.set(false);
    this.editingOrden.set(null);
  };

  guardarOrden(payload: VehOrdenTrabajoGuardarRequest) {
    this.saving.set(true);

    const request$ = this.editingOrden()
      ? this.repo.editarOrden({
        idVehOrdenTrabajo: this.editingOrden()!.idVehOrdenTrabajo,
        cambios: payload,
      })
      : this.repo.crearOrden(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success(
          this.editingOrden() ? 'Orden actualizada' : 'Orden creada',
          'La orden fue guardada correctamente.',
        );
        this.drawerVisible.set(false);
        this.dirty.set(false);
        this.editingOrden.set(null);
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo guardar la orden', err?.message),
    });
  }

  async eliminarOrden(item: VehOrdenTrabajo) {
    let ok = false;
    try {
      ok = await this.confirm.confirmDelete(`la orden #${item.idVehOrdenTrabajo}`);
    } catch {
      ok = false;
    }

    if (!ok && typeof window !== 'undefined') {
      ok = window.confirm(`¿Deseas eliminar la orden #${item.idVehOrdenTrabajo}?`);
    }

    if (!ok) return;

    this.repo.eliminarOrden(item.idVehOrdenTrabajo).subscribe({
      next: () => {
        this.notify.success('Orden eliminada', 'La orden fue eliminada correctamente.');
        if (this.selectedOrden()?.idVehOrdenTrabajo === item.idVehOrdenTrabajo) {
          this.selectedOrden.set(null);
          this.resetDetalle();
        }
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo eliminar la orden', err?.message),
    });
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
        checklistOpciones,
      }) => {
        this.checklist.set(checklist.items ?? []);
        this.trabajos.set(trabajos.items ?? []);
        this.hallazgos.set(hallazgos.items ?? []);
        this.repuestos.set(repuestos.items ?? []);
        this.autorizaciones.set(autorizaciones.items ?? []);
        this.ordenFacturas.set(facturasRelacion.items ?? []);
        this.facturasOt.set(facturasOt.items ?? []);

        this.hidratarArticulos((repuestos.items ?? []).map((x) => x.art));

        if (checklistOpciones.vehiculo) {
          this.vehiculoSeleccionadoLabel.set([checklistOpciones.vehiculo.marca, checklistOpciones.vehiculo.modelo, checklistOpciones.vehiculo.placa].filter(Boolean).join(' · ') || 'Vehículo');
          this.repo.listarChecklistsVehiculo({ idVehTipoVehiculoFk: checklistOpciones.vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => this.checklistOpciones.set(r.items ?? []),
            error: () => this.checklistOpciones.set([]),
          });

          this.repo.listarVistas({ idVehTipoVehiculoFk: checklistOpciones.vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => {
              const items = r.items ?? [];
              this.vistas.set(items);
              const currentVista = this.selectedVista();
              const selectedVista = currentVista
                ? items.find((x) => x.idVehTipoVehiculoVista === currentVista.idVehTipoVehiculoVista) ?? null
                : (items[0] ?? null);
              this.selectedVista.set(selectedVista);
            },
            error: () => {
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

        this.repo.listarClientes('', 0, 200, true).subscribe({
          next: (res) => {
            const cli = (res.items ?? []).find(
              (x) => Number((x as any).dni ?? (x as any).idTaxDni ?? (x as any).ruc ?? 0) === Number(item.dni ?? 0),
            ) ?? null;

            this.clienteSeleccionadoNombre.set(cli?.nombre || cli?.ruc || `Cliente #${item.dni}`);
          },
          error: () => this.clienteSeleccionadoNombre.set(`Cliente #${item.dni}`),
        });

        this.cargarUsuarioSeleccionado(item.responsableRecepcion ?? null, 'recepcion');
        this.cargarUsuarioSeleccionado(item.responsableTecnico ?? null, 'tecnico');
      },
      error: (err) => this.notify.error('No se pudo cargar detalle de la orden', err?.message),
    });
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

  seleccionarHallazgo(hallazgo: VehOrdenTrabajoHallazgo) {
    this.selectedHallazgo.set(hallazgo);
    this.cargarHallazgoDetalle(hallazgo.idVehOrdenTrabajoHallazgo);
  }

  seleccionarVista(vista: VehTipoVehiculoVista) {
    this.selectedVista.set(vista);
  }

  seleccionarFacturaOt(item: VehFactura, _activar = true) {
    this.selectedFacturaOt.set(item);

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

  clienteNombreSeleccionado(): string {
    return this.clienteSeleccionadoNombre();
  }

  vehiculoNombreSeleccionado(): string {
    return this.vehiculoSeleccionadoLabel();
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
    return this.articuloLabelMap()[art] || 'Repuesto de inventario';
  }

  facturaNumber(item?: VehFactura | null): string {
    if (!item) return 'Factura';
    return `${item.estab || '-'}-${item.ptoemi || '-'}-${item.secuencial || item.idFacVenta}`;
  }

  abrirChild(mode: Exclude<ChildDrawerMode, null>) {
    const orden = this.selectedOrden();
    if (this.isOrdenAnulada(orden)) {
      this.notify.warn('Orden bloqueada', 'La OT está anulada y ya no permite registrar movimientos.');
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
      this.repo.listarArticulos(query, 0, 30, false).subscribe({
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
    this.repuestoForm.controls.art.setValue(item.idActInventario);
    const current = { ...this.articuloCache(), [item.idActInventario]: item };
    this.articuloCache.set(current);
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
    if (this.isOrdenAnulada(orden)) {
      this.notify.warn('Orden bloqueada', 'La OT está anulada y ya no permite operaciones comerciales.');
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

  private toIsoStartOfDayWithOffset(value?: string | null) {
    if (!value) return null;
    return value.includes('T') ? value : `${value}T00:00:00-05:00`;
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

  isOrdenAnulada(item?: VehOrdenTrabajo | null): boolean {
    return (item?.estadoOrden || '').toUpperCase() === 'ANULADO';
  }

  async anularOrden(item: VehOrdenTrabajo) {
    if (this.isOrdenAnulada(item)) return;

    let ok = false;
    try {
      ok = await this.confirm.confirmDelete(`anular la orden #${item.idVehOrdenTrabajo}`);
    } catch {
      ok = false;
    }

    if (!ok && typeof window !== 'undefined') {
      ok = window.confirm(`¿Deseas anular la orden #${item.idVehOrdenTrabajo}?`);
    }

    if (!ok) return;

    this.saving.set(true);
    this.repo.editarOrden({
      idVehOrdenTrabajo: item.idVehOrdenTrabajo,
      cambios: { estadoOrden: 'ANULADO' },
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Orden anulada', 'La OT quedó anulada y bloqueada.');
        if (this.selectedOrden()?.idVehOrdenTrabajo === item.idVehOrdenTrabajo) {
          this.selectedOrden.set({ ...item, estadoOrden: 'ANULADO' });
        }
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo anular la orden', err?.message),
    });
  }
}
