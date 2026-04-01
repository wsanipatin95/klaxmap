import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Observable, finalize, forkJoin } from 'rxjs';
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
  VehArticuloCatalogo,
  VehCaja,
  VehCobro,
  VehCobroCrearRequest,
  VehFactura,
  VehFacturaContabilizarRequest,
  VehFacturaCrearRequest,
  VehFacturacionWorkflowRequest,
  VehFacturacionWorkflowResultado,
  VehFacturaDetalleResponse,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type FacturacionTab = 'workflow' | 'facturas' | 'cobros' | 'cajas' | 'articulos';
type DrawerMode = 'workflow' | 'factura' | 'cobro' | 'caja' | 'contabilizar' | null;

@Component({
  selector: 'app-vehiculos-facturacion',
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
    VehiculosFormDrawerComponent,
    VehiculosEmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './facturacion.component.html',
  styleUrl: './facturacion.component.scss',
})
export class VehiculosFacturacionComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(VehiculosConfirmService);

  q = '';
  loading = signal(false);
  saving = signal(false);
  activeTab = signal<FacturacionTab>('workflow');

  articulos = signal<VehArticuloCatalogo[]>([]);
  facturas = signal<VehFactura[]>([]);
  cobros = signal<VehCobro[]>([]);
  cajas = signal<VehCaja[]>([]);
  selectedFactura = signal<VehFactura | null>(null);
  selectedCobro = signal<VehCobro | null>(null);
  facturaDetalle = signal<VehFacturaDetalleResponse | null>(null);
  cobroDetalle = signal<Record<string, unknown> | null>(null);
  workflowResultado = signal<VehFacturacionWorkflowResultado | null>(null);

  drawerVisible = signal(false);
  drawerMode = signal<DrawerMode>(null);
  dirty = signal(false);

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

  cajaForm = this.fb.group({
    idAdmPtoemi: [null as number | null],
    cen: [null as number | null],
    saldoCaja: [0],
    comentario: ['Caja creada desde frontend vehicular.'],
    estadoInicial: ['p'],
  });

  contabilizarForm = this.fb.group({
    idFacVenta: [null as number | null, Validators.required],
    idCntTipoFk: [20],
    fechaContable: [''],
    concepto: ['Factura vehicular'],
  });

  workflowForm = this.fb.group({
    idVehOrdenTrabajoFk: [null as number | null, Validators.required],
    idsVehOrdenTrabajoRepuesto: [''],
    observacionFactura: [''],
    dni: [null as number | null, Validators.required],
    subtotalCero: [0, Validators.required],
    subtotalIva: [0, Validators.required],
    iva: [0, Validators.required],
    descuento: [0, Validators.required],
    total: [0, Validators.required],
    usu: [null as number | null],
  });

  constructor() {
    this.facturaForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.cobroForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.cajaForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.contabilizarForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.workflowForm.valueChanges.subscribe(() => this.dirty.set(true));
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    return true;
  }

  cargar() {
    this.loading.set(true);
    forkJoin({
      articulos: this.repo.listarArticulos(this.q, 0, 100, true),
      facturas: this.repo.listarFacturas(this.q, 0, 100, true),
      cobros: this.repo.listarCobros(this.q, 0, 100, true),
      cajas: this.repo.listarCajas(this.q, 0, 100, true),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ articulos, facturas, cobros, cajas }) => {
        this.articulos.set(articulos.items ?? []);
        this.facturas.set(facturas.items ?? []);
        this.cobros.set(cobros.items ?? []);
        this.cajas.set(cajas.items ?? []);
      },
      error: (err) => this.notify.error('No se pudo cargar facturación/cobros', err?.message),
    });
  }

  seleccionarFactura(item: VehFactura) {
    this.selectedFactura.set(item);
    this.repo.obtenerFactura(item.idFacVenta).subscribe({
      next: (res) => this.facturaDetalle.set(res),
      error: (err) => this.notify.error('No se pudo cargar detalle de factura', err?.message),
    });
  }

  seleccionarCobro(item: VehCobro) {
    this.selectedCobro.set(item);
    this.repo.obtenerCobro(item.idFacVentaCobro).subscribe({
      next: (res) => this.cobroDetalle.set(res),
      error: (err) => this.notify.error('No se pudo cargar detalle de cobro', err?.message),
    });
  }

  abrirDrawer(mode: DrawerMode) {
    this.drawerMode.set(mode);
    this.drawerVisible.set(true);
    this.dirty.set(false);

    if (mode === 'factura') {
      this.facturaForm.reset({
        idVehOrdenTrabajoFk: null,
        idsVehOrdenTrabajoRepuesto: '',
        tipoFacturacion: 'PARCIAL',
        observacion: '',
        dni: null,
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

    if (mode === 'cobro') {
      this.cobroForm.reset({
        idFacVenta: this.selectedFactura()?.idFacVenta ?? null,
        valor: 0,
        fecha: '',
        cen: this.selectedFactura()?.cen ?? null,
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

    if (mode === 'caja') {
      this.cajaForm.reset({
        idAdmPtoemi: null,
        cen: null,
        saldoCaja: 0,
        comentario: 'Caja creada desde frontend vehicular.',
        estadoInicial: 'p',
      });
    }

    if (mode === 'contabilizar') {
      this.contabilizarForm.reset({
        idFacVenta: this.selectedFactura()?.idFacVenta ?? null,
        idCntTipoFk: 20,
        fechaContable: '',
        concepto: 'Factura vehicular',
      });
    }

    if (mode === 'workflow') {
      this.workflowForm.reset({
        idVehOrdenTrabajoFk: null,
        idsVehOrdenTrabajoRepuesto: '',
        observacionFactura: '',
        dni: null,
        subtotalCero: 0,
        subtotalIva: 0,
        iva: 0,
        descuento: 0,
        total: 0,
        usu: null,
      });
    }
  }

  cerrarDrawer = async () => {
    if (this.dirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.drawerVisible.set(false);
    this.drawerMode.set(null);
    this.dirty.set(false);
  };

  submit() {
    const mode = this.drawerMode();
    if (!mode) return;

    this.saving.set(true);
    let request$: Observable<any>;

    if (mode === 'factura') {
      if (this.facturaForm.invalid) {
        this.facturaForm.markAllAsTouched();
        this.saving.set(false);
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
        this.saving.set(false);
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
    } else if (mode === 'caja') {
      request$ = this.repo.asegurarCaja({
        idAdmPtoemi: this.cajaForm.value.idAdmPtoemi ?? null,
        cen: this.cajaForm.value.cen ?? null,
        saldoCaja: Number(this.cajaForm.value.saldoCaja || 0),
        comentario: this.cajaForm.value.comentario?.trim() || null,
        estadoInicial: this.cajaForm.value.estadoInicial?.trim() || null,
      });
    } else if (mode === 'contabilizar') {
      if (this.contabilizarForm.invalid) {
        this.contabilizarForm.markAllAsTouched();
        this.saving.set(false);
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
        this.saving.set(false);
        this.notify.warn('Formulario incompleto', 'Debes indicar la OT para el workflow.');
        return;
      }
      const idsVehOrdenTrabajoRepuesto =
        this.toIdList(this.workflowForm.value.idsVehOrdenTrabajoRepuesto) ?? [];

      const dni = this.workflowForm.value.dni;
      if (dni == null) {
        this.saving.set(false);
        this.notify.warn('Formulario incompleto', 'Debes indicar el DNI del cliente.');
        return;
      }

      const payload: VehFacturacionWorkflowRequest = {
        idVehOrdenTrabajoFk: Number(this.workflowForm.value.idVehOrdenTrabajoFk),
        dni: Number(dni),
        idsVehOrdenTrabajoRepuesto,
        subtotalCero: Number(this.workflowForm.value.subtotalCero || 0),
        subtotalIva: Number(this.workflowForm.value.subtotalIva || 0),
        iva: Number(this.workflowForm.value.iva || 0),
        descuento: Number(this.workflowForm.value.descuento || 0),
        total: Number(this.workflowForm.value.total || 0),
        observacionFactura: this.workflowForm.value.observacionFactura?.trim() || null,
        usu: this.workflowForm.value.usu ?? null,
      };
      request$ = this.repo.facturarCobrarWorkflow(payload);
    }

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res: any) => {
        this.notify.success('Operación exitosa', res?.mensaje || 'Proceso ejecutado correctamente.');
        if (mode === 'workflow') this.workflowResultado.set(res.data as VehFacturacionWorkflowResultado);
        this.drawerVisible.set(false);
        this.drawerMode.set(null);
        this.dirty.set(false);
        this.cargar();
      },
      error: (err: any) => this.notify.error('No se pudo ejecutar la operación', err?.message),
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
    return value.includes('T') || value.includes(' ') ? value : `${value} 00:00:00`;
  }

  private toIsoStartOfDayWithOffset(value?: string | null) {
    if (!value) return null;
    return value.includes('T') ? value : `${value}T00:00:00-05:00`;
  }
  
}
