import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CardModule } from 'primeng/card';
import { ImportacionPageHeaderComponent } from '../../components/page-header/page-header.component';
import { ImportacionFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { ImportacionEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { NotifyService } from 'src/app/core/services/notify.service';
import { ImportacionConfirmService } from '../../services/importacion-confirm.service';
import { ImportacionSolicitudesRepository } from '../../data-access/solicitudes.repository';
import { SolicitudGeneral, WorkflowValidacionCierre } from '../../data-access/solicitudes.models';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-importacion-solicitudes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    DividerModule,
    ConfirmDialogModule,
    ToggleSwitchModule,
    CardModule,
    ImportacionPageHeaderComponent,
    ImportacionFormDrawerComponent,
    ImportacionEmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './importacion-solicitudes.component.html',
  styleUrl: './importacion-solicitudes.component.scss',
})
export class ImportacionSolicitudesComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(ImportacionSolicitudesRepository);
  private notify = inject(NotifyService);
  private confirm = inject(ImportacionConfirmService);
  private destroyRef = inject(DestroyRef);

  q = '';
  loading = signal(false);
  saving = signal(false);
  items = signal<SolicitudGeneral[]>([]);
  drawerVisible = signal(false);
  dirty = signal(false);
  editingId = signal<number | null>(null);
  seleccionada = signal<SolicitudGeneral | null>(null);
  validacion = signal<WorkflowValidacionCierre | null>(null);
  resumenRaw = signal<Record<string, unknown> | null>(null);

  form = this.fb.group({
    codigoSolicitud: ['', Validators.required],
    nombreSolicitud: ['', Validators.required],
    descripcion: [''],
    versionSolicitud: [1],
    idImpSolicitudGeneralOrigenFk: [null as number | null],
    fechaSolicitud: [''],
    estadoSolicitud: ['BORRADOR'],
    observacion: [''],
    cerrada: [false],
    detalles: this.fb.array([]),
  });

  workflowAgregarOferta = this.fb.group({ idImpOfertaProveedorFk: [null as number | null, Validators.required] });
  workflowCerrar = this.fb.group({ observacionCierre: [''] });
  workflowReabrir = this.fb.group({ motivoReapertura: ['', Validators.required] });
  workflowCrearVersion = this.fb.group({
    copiarRelacionesOferta: [true],
    copiarSoloOfertasSeleccionadas: [false],
    copiarSeleccionesBase: [false],
    liberarOfertasSeleccionadas: [false],
    conservarObservacionOrigen: [true],
    observacionNuevaVersion: [''],
  });
  workflowSeleccion = this.fb.group({
    idImpSolicitudGeneralDetalleFk: [null as number | null, Validators.required],
    idImpOfertaProveedorFk: [null as number | null, Validators.required],
    idImpOfertaProveedorDetalleFk: [null as number | null, Validators.required],
    dniAdqProveedorFk: [null as number | null],
    idImpProveedorProspectoFk: [null as number | null],
    idActInventarioFk: [null as number | null],
    cantidadFinal: [1, Validators.required],
    idActInventarioUnidadFk: ['UN'],
    precioUnitarioFinal: [0, Validators.required],
    colorFinal: [''],
    tamanoFinal: [''],
    empaqueFinal: [''],
    observacion: [''],
  });

  get detalles(): FormArray { return this.form.get('detalles') as FormArray; }

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { if (this.drawerVisible()) this.dirty.set(true); });
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.drawerVisible() || !this.dirty()) return true;
    return this.confirm.confirmDiscard();
  }

  cargar() {
    this.loading.set(true);
    this.repo.listar(this.q, 0, 100, true).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (paged) => this.items.set(paged.items ?? []),
      error: (err) => this.notify.error('No se pudo cargar solicitudes', err?.message),
    });
  }

  nuevo() {
    this.editingId.set(null);
    this.form.reset({ versionSolicitud: 1, estadoSolicitud: 'BORRADOR', cerrada: false });
    this.detalles.clear();
    this.addDetalle();
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editar(item: SolicitudGeneral) {
    this.editingId.set(item.idImpSolicitudGeneral!);
    this.form.patchValue({
      codigoSolicitud: item.codigoSolicitud,
      nombreSolicitud: item.nombreSolicitud,
      descripcion: item.descripcion ?? '',
      versionSolicitud: item.versionSolicitud ?? 1,
      idImpSolicitudGeneralOrigenFk: item.idImpSolicitudGeneralOrigenFk ?? null,
      fechaSolicitud: item.fechaSolicitud ?? '',
      estadoSolicitud: item.estadoSolicitud ?? 'BORRADOR',
      observacion: item.observacion ?? '',
      cerrada: !!item.cerrada,
    }, { emitEvent: false });
    this.detalles.clear();
    this.addDetalle();
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  seleccionar(item: SolicitudGeneral) {
    this.seleccionada.set(item);
    this.validacion.set(null);
    this.resumenRaw.set(null);
    if (item.idImpSolicitudGeneral) this.cargarValidacion(item.idImpSolicitudGeneral);
  }

  async eliminar(item: SolicitudGeneral) {
    if (!item.idImpSolicitudGeneral) return;
    const ok = await this.confirm.confirmDelete(item.codigoSolicitud || 'la solicitud');
    if (!ok) return;
    this.repo.eliminar(item.idImpSolicitudGeneral).subscribe({ next: (res) => { this.notify.success('Solicitud eliminada', res.mensaje); this.cargar(); }, error: (err) => this.notify.error('No se pudo eliminar', err?.message) });
  }

  async cerrarDrawer() {
    if (this.dirty()) {
      const discard = await this.confirm.confirmDiscard();
      if (!discard) return;
    }
    this.drawerVisible.set(false);
    this.dirty.set(false);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Solicitud incompleta', 'Completa cabecera y al menos un detalle.');
      return;
    }
    const payload = this.form.getRawValue();
    this.saving.set(true);
    const request$ = this.editingId()
      ? this.repo.editar({ idImpSolicitudGeneral: this.editingId()!, cambios: payload })
      : this.repo.crear(payload as any);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res) => { this.notify.success(this.editingId() ? 'Solicitud actualizada' : 'Solicitud creada', res.mensaje); this.drawerVisible.set(false); this.dirty.set(false); this.cargar(); },
      error: (err) => this.notify.error('No se pudo guardar', err?.message),
    });
  }

  addDetalle() {
    this.detalles.push(this.fb.group({ descripcionRequerida: ['', Validators.required], cantidadRequerida: [1, Validators.required], idActInventarioUnidadFk: ['UN', Validators.required], idActInventarioFk: [null], colorRequerido: [''], tamanoRequerido: [''], especificacionTecnica: [''], observacion: [''] }));
  }
  removeDetalle(i: number) { this.detalles.removeAt(i); this.dirty.set(true); }

  cargarValidacion(id: number) {
    this.repo.validarCierre(id).subscribe({ next: (dto) => this.validacion.set(dto), error: (err) => this.notify.error('No se pudo validar cierre', err?.message) });
    this.repo.resumen(id).subscribe({ next: (dto) => this.resumenRaw.set(dto), error: () => {} });
  }

  agregarOferta() {
    const solicitud = this.seleccionada();
    if (!solicitud?.idImpSolicitudGeneral || this.workflowAgregarOferta.invalid) return;
    this.repo.agregarOferta({ idImpSolicitudGeneralFk: solicitud.idImpSolicitudGeneral, idImpOfertaProveedorFk: Number(this.workflowAgregarOferta.value.idImpOfertaProveedorFk) }).subscribe({
      next: (res) => { this.notify.success('Oferta agregada', res.mensaje); this.cargarValidacion(solicitud.idImpSolicitudGeneral!); },
      error: (err) => this.notify.error('No se pudo agregar oferta', err?.message),
    });
  }

  seleccionarDetalle() {
    const solicitud = this.seleccionada();
    if (!solicitud?.idImpSolicitudGeneral || this.workflowSeleccion.invalid) return;
    this.repo.seleccionarDetalle({ idImpSolicitudGeneralFk: solicitud.idImpSolicitudGeneral, ...this.workflowSeleccion.getRawValue() } as any).subscribe({
      next: (res) => { this.notify.success('Selección guardada', res.mensaje); this.cargarValidacion(solicitud.idImpSolicitudGeneral!); },
      error: (err) => this.notify.error('No se pudo guardar selección', err?.message),
    });
  }

  cerrarSolicitud() {
    const solicitud = this.seleccionada();
    if (!solicitud?.idImpSolicitudGeneral) return;
    this.repo.cerrar({ idImpSolicitudGeneralFk: solicitud.idImpSolicitudGeneral, observacionCierre: this.workflowCerrar.value.observacionCierre || null }).subscribe({
      next: (res) => { this.notify.success('Solicitud cerrada', res.mensaje); this.cargar(); this.cargarValidacion(solicitud.idImpSolicitudGeneral!); },
      error: (err) => this.notify.error('No se pudo cerrar', err?.message),
    });
  }

  reabrirSolicitud() {
    const solicitud = this.seleccionada();
    if (!solicitud?.idImpSolicitudGeneral || this.workflowReabrir.invalid) return;
    this.repo.reabrir({ idImpSolicitudGeneralFk: solicitud.idImpSolicitudGeneral, motivoReapertura: this.workflowReabrir.value.motivoReapertura! }).subscribe({
      next: (res) => { this.notify.success('Solicitud reabierta', res.mensaje); this.cargar(); this.cargarValidacion(solicitud.idImpSolicitudGeneral!); },
      error: (err) => this.notify.error('No se pudo reabrir', err?.message),
    });
  }

  crearVersion() {
    const solicitud = this.seleccionada();
    if (!solicitud?.idImpSolicitudGeneral) return;
    this.repo.crearVersion({ idImpSolicitudGeneralFk: solicitud.idImpSolicitudGeneral, ...this.workflowCrearVersion.getRawValue() }).subscribe({
      next: (res) => { this.notify.success('Versión creada', res.mensaje); this.cargar(); this.cargarValidacion(solicitud.idImpSolicitudGeneral!); },
      error: (err) => this.notify.error('No se pudo crear versión', err?.message),
    });
  }
}
