import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize, forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
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
  VehOrdenTrabajo,
  VehOrdenTrabajoGuardarRequest,
  VehOrdenTrabajoTrabajo,
  VehOrdenTrabajoTrabajoGuardarRequest,
  VehOrdenTrabajoHallazgo,
  VehOrdenTrabajoHallazgoGuardarRequest,
  VehOrdenTrabajoHallazgoMarcaGuardarRequest,
  VehOrdenTrabajoHallazgoFotoGuardarRequest,
  VehOrdenTrabajoHallazgoMarca,
  VehOrdenTrabajoHallazgoFoto,
  VehOrdenTrabajoRepuesto,
  VehOrdenTrabajoRepuestoGuardarRequest,
  VehOrdenTrabajoAutorizacion,
  VehOrdenTrabajoAutorizacionGuardarRequest,
  VehOrdenTrabajoFactura,
  VehOrdenTrabajoCheckList,
  VehTipoVehiculoVista,
  VehCheckListVehiculo,
} from '../../data-access/vehiculos.models';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehiculosConfirmService } from '../../services/vehiculos-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

type OrdenTab = 'resumen' | 'checklist' | 'trabajos' | 'hallazgos' | 'repuestos' | 'autorizaciones' | 'facturas';

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

  drawerVisible = signal(false);
  childDrawerVisible = signal(false);
  childMode = signal<'trabajo' | 'hallazgo' | 'repuesto' | 'autorizacion' | 'foto' | 'checklist' | null>(null);
  dirty = signal(false);
  childDirty = signal(false);
  editingOrdenId = signal<number | null>(null);

  form = this.fb.group({
    dni: [null as number | null, Validators.required],
    idCliVehiculoFk: [null as number | null, Validators.required],
    tipoServicio: ['REPARACION'],
    estadoOrden: ['RECIBIDO'],
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
    requiereCambio: [1],
    motivoCambio: [''],
    aprobadoCliente: [0],
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
    principal: [0],
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.dirty.set(true));
    this.checklistForm.valueChanges.subscribe(() => this.childDirty.set(true));
    this.trabajoForm.valueChanges.subscribe(() => this.childDirty.set(true));
    this.hallazgoForm.valueChanges.subscribe(() => this.childDirty.set(true));
    this.repuestoForm.valueChanges.subscribe(() => this.childDirty.set(true));
    this.autorizacionForm.valueChanges.subscribe(() => this.childDirty.set(true));
    this.fotoForm.valueChanges.subscribe(() => this.childDirty.set(true));
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.drawerVisible() && this.dirty()) return this.confirm.confirmDiscard();
    if (this.childDrawerVisible() && this.childDirty()) return this.confirm.confirmDiscard();
    return true;
  }

  cargar() {
    this.loading.set(true);
    this.repo.listarOrdenes(this.q, 0, 200, true)
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
      facturas: this.repo.listarOrdenFacturas({ idVehOrdenTrabajoFk: item.idVehOrdenTrabajo }),
      vehiculos: this.repo.listarClientesVehiculo({ dni: item.dni }),
    }).subscribe({
      next: ({ checklist, trabajos, hallazgos, repuestos, autorizaciones, facturas, vehiculos }) => {
        this.checklist.set(checklist.items ?? []);
        this.trabajos.set(trabajos.items ?? []);
        this.hallazgos.set(hallazgos.items ?? []);
        this.repuestos.set(repuestos.items ?? []);
        this.autorizaciones.set(autorizaciones.items ?? []);
        this.ordenFacturas.set(facturas.items ?? []);

        const vehiculo = (vehiculos.items ?? []).find((x) => x.idCliVehiculo === item.idCliVehiculoFk);
        if (vehiculo) {
          this.repo.listarChecklistsVehiculo({ idVehTipoVehiculoFk: vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => this.checklistOpciones.set(r.items ?? []),
          });
          this.repo.listarVistas({ idVehTipoVehiculoFk: vehiculo.idVehTipoVehiculoFk }).subscribe({
            next: (r) => {
              this.vistas.set(r.items ?? []);
              this.selectedVista.set((r.items ?? [])[0] ?? null);
            },
          });
        } else {
          this.checklistOpciones.set([]);
          this.vistas.set([]);
          this.selectedVista.set(null);
        }

        const firstHallazgo = (hallazgos.items ?? [])[0] ?? null;
        this.selectedHallazgo.set(firstHallazgo);
        if (firstHallazgo) this.cargarHallazgoDetalle(firstHallazgo.idVehOrdenTrabajoHallazgo);
        else {
          this.marcas.set([]);
          this.fotos.set([]);
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

  severityEstado(estado?: string | null) {
    const v = (estado || '').toUpperCase();
    if (v.includes('ENTREG')) return 'success';
    if (v.includes('FACTUR')) return 'info';
    if (v.includes('PEND') || v.includes('ESPERA')) return 'warn';
    if (v.includes('ANUL')) return 'danger';
    return 'secondary';
  }

  nuevo() {
    this.editingOrdenId.set(null);
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
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editarOrden(item: VehOrdenTrabajo) {
    this.editingOrdenId.set(item.idVehOrdenTrabajo);
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
    this.drawerVisible.set(true);
    this.dirty.set(false);
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
        }
        this.cargar();
      },
      error: (err) => this.notify.error('No se pudo eliminar la orden', err?.message),
    });
  }

  submitOrden() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Formulario incompleto', 'DNI e ID de vehículo son obligatorios.');
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
        this.notify.success(this.editingOrdenId() ? 'Orden actualizada' : 'Orden creada', 'La orden fue guardada correctamente.');
        this.drawerVisible.set(false);
        this.dirty.set(false);
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
    this.dirty.set(false);
  };

  abrirChild(mode: 'trabajo' | 'hallazgo' | 'repuesto' | 'autorizacion' | 'foto' | 'checklist') {
    const orden = this.selectedOrden();
    if (!orden) {
      this.notify.warn('Selecciona una orden', 'Primero selecciona una orden de trabajo.');
      return;
    }
    this.childMode.set(mode);
    this.childDrawerVisible.set(true);
    this.childDirty.set(false);

    if (mode === 'checklist') this.checklistForm.reset({ idVehVehiculoCheckListVehiculoFk: null, estadoCheckList: 'PENDIENTE', observaciones: '' });
    if (mode === 'trabajo') this.trabajoForm.reset({ tipoTrabajo: 'DIAGNOSTICO', descripcionInicial: '', descripcionRealizada: '', resultado: '', estadoTrabajo: 'PENDIENTE', fechaInicio: '', fechaFin: '', motivo: '', observaciones: '' });
    if (mode === 'hallazgo') this.hallazgoForm.reset({ idVehOrdenTrabajoTrabajoFk: null, tipoHallazgo: 'RECEPCION', categoria: 'GENERAL', descripcion: '', severidad: 'MEDIA', estadoHallazgo: 'REPORTADO', requiereCambio: 1, motivoCambio: '', aprobadoCliente: 0, fechaAprobacion: '', observaciones: '', atributosJson: '{}' });
    if (mode === 'repuesto') this.repuestoForm.reset({ art: null, cantidad: 1, precioUnitario: 0, motivoCambio: '', detalleInstalacion: '', serieAnterior: '', serieNueva: '', observaciones: '' });
    if (mode === 'autorizacion') this.autorizacionForm.reset({ tipoAutorizacion: 'ADICIONAL', referenciaTabla: '', referenciaId: null, descripcion: '', estadoAutorizacion: 'PENDIENTE', fechaRespuesta: '', observaciones: '' });
    if (mode === 'foto') this.fotoForm.reset({ etapa: 'ANTES', descripcion: '', principal: 0 });
  }

  cerrarChildDrawer = async () => {
    if (this.childDirty()) {
      const ok = await this.confirm.confirmDiscard();
      if (!ok) return;
    }
    this.childDrawerVisible.set(false);
    this.childMode.set(null);
    this.childDirty.set(false);
  };

  submitChild() {
    const orden = this.selectedOrden();
    if (!orden) return;
    const mode = this.childMode();
    if (!mode) return;

    let request$ = of(null);
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
    }

    if (mode === 'trabajo') {
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
    }

    if (mode === 'hallazgo') {
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
        requiereCambio: Number(this.hallazgoForm.value.requiereCambio || 0),
        motivoCambio: this.hallazgoForm.value.motivoCambio?.trim() || null,
        aprobadoCliente: Number(this.hallazgoForm.value.aprobadoCliente || 0),
        fechaAprobacion: this.toTimestamp(this.hallazgoForm.value.fechaAprobacion),
        observaciones: this.hallazgoForm.value.observaciones?.trim() || null,
        atributos: this.parseJson(this.hallazgoForm.value.atributosJson),
      };
      request$ = this.repo.crearHallazgo(payload);
    }

    if (mode === 'repuesto') {
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
    }

    if (mode === 'autorizacion') {
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
    }

    if (mode === 'foto') {
      const hallazgo = this.selectedHallazgo();
      if (!hallazgo) {
        this.notify.warn('Selecciona un hallazgo', 'La foto se registra sobre un hallazgo concreto.');
        return;
      }
      const payload: VehOrdenTrabajoHallazgoFotoGuardarRequest = {
        idVehOrdenTrabajoHallazgoFk: hallazgo.idVehOrdenTrabajoHallazgo,
        etapa: this.fotoForm.value.etapa || null,
        descripcion: this.fotoForm.value.descripcion?.trim() || null,
        principal: Number(this.fotoForm.value.principal || 0),
      };
      request$ = this.repo.crearHallazgoFoto(payload);
    }

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notify.success('Registro guardado', 'La operación se ejecutó correctamente.');
        this.childDrawerVisible.set(false);
        this.childMode.set(null);
        this.childDirty.set(false);
        this.cargarDetalle(orden);
      },
      error: (err) => this.notify.error('No se pudo guardar el registro', err?.message),
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

  nombreChecklistRelacionado(idRel?: number | null) {
    return this.checklistOpciones().find((x) => x.idVehVehiculoCheckListVehiculo === idRel)?.idVehVehiculoCheckListFk || idRel || '-';
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
}
