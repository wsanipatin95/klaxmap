import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap, type Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ImportacionPageHeaderComponent } from '../../components/page-header/page-header.component';
import { ImportacionFormDrawerComponent } from '../../components/form-drawer/form-drawer.component';
import { ImportacionEmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { NotifyService } from 'src/app/core/services/notify.service';
import { ImportacionConfirmService } from '../../services/importacion-confirm.service';
import { ImportacionOfertasRepository } from '../../data-access/ofertas.repository';
import {
  OfertaProveedor,
  OfertaProveedorDocumento,
  OfertaProveedorGuardarRequest,
} from '../../data-access/ofertas.models';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-importacion-ofertas',
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
    ImportacionPageHeaderComponent,
    ImportacionFormDrawerComponent,
    ImportacionEmptyStateComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './importacion-ofertas.component.html',
  styleUrl: './importacion-ofertas.component.scss',
})
export class ImportacionOfertasComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(ImportacionOfertasRepository);
  private notify = inject(NotifyService);
  private confirm = inject(ImportacionConfirmService);
  private destroyRef = inject(DestroyRef);

  q = '';
  loading = signal(false);
  saving = signal(false);
  items = signal<OfertaProveedor[]>([]);
  drawerVisible = signal(false);
  dirty = signal(false);
  editingId = signal<number | null>(null);
  originalDocumentoIds: number[] = [];

  form = this.fb.group({
    tipoOferta: ['COTIZACION', Validators.required],
    idImpProveedorProspectoFk: [null as number | null],
    dniAdqProveedorFk: [null as number | null],
    numeroDocumento: [''],
    numeroVersion: [1],
    fechaOferta: [''],
    fechaVigenciaDesde: [''],
    fechaVigenciaHasta: [''],
    idMonMonedaFk: [null as number | null, Validators.required],
    incoterm: [''],
    lugarEntrega: [''],
    formaPago: [''],
    tiempoEntregaDias: [null as number | null],
    vigente: [true],
    bloqueadaParaSondeo: [false],
    observacion: [''],
    detalles: this.fb.array([]),
    packings: this.fb.array([]),
    packingResumenes: this.fb.array([]),
    documentos: this.fb.array([]),
  });

  get detalles(): FormArray { return this.form.get('detalles') as FormArray; }
  get packings(): FormArray { return this.form.get('packings') as FormArray; }
  get packingResumenes(): FormArray { return this.form.get('packingResumenes') as FormArray; }
  get documentos(): FormArray { return this.form.get('documentos') as FormArray; }

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.drawerVisible()) this.dirty.set(true);
    });
    this.cargar();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.drawerVisible() || !this.dirty()) return true;
    return this.confirm.confirmDiscard();
  }

  cargar() {
    this.loading.set(true);
    this.repo.listar(this.q, 0, 100, true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: (paged) => this.items.set(paged.items ?? []), error: (err) => this.notify.error('No se pudo cargar ofertas', err?.message) });
  }

  nuevo() {
    this.editingId.set(null);
    this.form.reset({ tipoOferta: 'COTIZACION', numeroVersion: 1, vigente: true, bloqueadaParaSondeo: false });
    this.detalles.clear(); this.packings.clear(); this.packingResumenes.clear(); this.documentos.clear();
    this.addDetalle(); this.addPackingResumen(); this.addDocumento();
    this.drawerVisible.set(true); this.dirty.set(false); this.originalDocumentoIds = [];
  }

  editar(item: OfertaProveedor) {
    if (!item.idImpOfertaProveedor) return;
    this.loading.set(true);
    this.repo.listarDocumentos(item.idImpOfertaProveedor).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (docs) => {
        this.editingId.set(item.idImpOfertaProveedor!);
        this.form.patchValue({
          tipoOferta: item.tipoOferta,
          idImpProveedorProspectoFk: item.idImpProveedorProspectoFk ?? null,
          dniAdqProveedorFk: item.dniAdqProveedorFk ?? null,
          numeroDocumento: item.numeroDocumento ?? '',
          numeroVersion: item.numeroVersion ?? item.versionOferta ?? 1,
          fechaOferta: item.fechaOferta ?? '',
          fechaVigenciaDesde: item.fechaVigenciaDesde ?? '',
          fechaVigenciaHasta: item.fechaVigenciaHasta ?? '',
          idMonMonedaFk: item.idMonMonedaFk ?? null,
          incoterm: item.incoterm ?? '',
          lugarEntrega: item.lugarEntrega ?? '',
          formaPago: item.formaPago ?? '',
          tiempoEntregaDias: item.tiempoEntregaDias ?? null,
          vigente: item.vigente ?? true,
          bloqueadaParaSondeo: item.bloqueadaParaSondeo ?? false,
          observacion: item.observacion ?? '',
        }, { emitEvent: false });
        this.detalles.clear(); this.packings.clear(); this.packingResumenes.clear(); this.documentos.clear();
        this.addDetalle(); this.addPackingResumen();
        (docs.items ?? []).forEach((x) => this.addDocumento(x));
        this.originalDocumentoIds = (docs.items ?? []).map((x) => x.idImpOfertaProveedorDocumento!).filter(Boolean);
        this.drawerVisible.set(true); this.dirty.set(false);
      },
      error: (err) => this.notify.error('No se pudo abrir la oferta', err?.message),
    });
  }

  async eliminar(item: OfertaProveedor) {
    if (!item.idImpOfertaProveedor) return;
    const ok = await this.confirm.confirmDelete(item.numeroDocumento || 'la oferta');
    if (!ok) return;
    this.repo.eliminar(item.idImpOfertaProveedor).subscribe({ next: (res) => { this.notify.success('Oferta eliminada', res.mensaje); this.cargar(); }, error: (err) => this.notify.error('No se pudo eliminar', err?.message) });
  }

  async cerrarDrawer() {
    if (this.dirty()) {
      const discard = await this.confirm.confirmDiscard();
      if (!discard) return;
    }
    this.drawerVisible.set(false); this.dirty.set(false);
  }

  submit() {
    if (this.form.invalid || !this.detalles.length) {
      this.form.markAllAsTouched();
      this.notify.warn('Oferta incompleta', 'Debes ingresar moneda y al menos una línea de detalle.');
      return;
    }

    this.saving.set(true);

    type SaveResult = { data: any; mensaje: string };

    const request$: Observable<SaveResult> = (
      this.editingId()
        ? this.repo.editar({
          idImpOfertaProveedor: this.editingId()!,
          cambios: this.normalizeEditarPayload(),
        })
        : this.repo.crear(this.normalizeGuardarPayload())
    ) as Observable<SaveResult>;

    request$
      .pipe(
        switchMap((res: SaveResult) => {
          const id =
            this.editingId() ??
            Number((res.data as { idImpOfertaProveedor?: number } | null)?.idImpOfertaProveedor);

          if (!id) return of(res);

          return this.syncDocumentos(id).pipe(
            map((): SaveResult => res)
          );
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: (res: SaveResult) => {
          this.notify.success(
            this.editingId() ? 'Oferta actualizada' : 'Oferta creada',
            res.mensaje
          );
          this.drawerVisible.set(false);
          this.dirty.set(false);
          this.cargar();
        },
        error: (err) => this.notify.error('No se pudo guardar', err?.message),
      });
  }

  addDetalle() {
    this.detalles.push(this.fb.group({
      idImpArticuloProspectoFk: [null as number | null],
      idActInventarioFk: [null as number | null],
      codigoArticuloProveedor: [''],
      descripcionItem: ['', Validators.required],
      color: [''],
      tamano: [''],
      cantidadMinima: [null as number | null],
      cantidadOfertada: [1, Validators.required],
      idActInventarioUnidadFk: ['UN', Validators.required],
      precioUnitario: [0],
      descuentoPct: [0],
      subtotal: [0],
      paisOrigenFk: [null as number | null],
      pesoUnitario: [null as number | null],
      cbmUnitario: [null as number | null],
      idImpCodigoArancelarioFk: [null as number | null],
      observacion: [''],
    }));
  }

  addPacking() {
    this.packings.push(this.fb.group({ detalleIndex: [0], tipoEmpaque: [''], cantidadPorEmpaque: [null], largo: [null], ancho: [null], alto: [null], cbm: [null], pesoBruto: [null], pesoNeto: [null], observacion: [''] }));
  }

  addPackingResumen() {
    this.packingResumenes.push(this.fb.group({ ordenResumen: [1], tipoBulto: [''], cantidadBultos: [1], largoCm: [null], anchoCm: [null], altoCm: [null], cbmTotal: [null], pesoBrutoTotal: [null], pesoNetoTotal: [null], observacion: [''] }));
  }

  addDocumento(item?: Partial<OfertaProveedorDocumento>) {
    this.documentos.push(this.fb.group({ idImpOfertaProveedorDocumento: [item?.idImpOfertaProveedorDocumento ?? null], tipoDocumento: [item?.tipoDocumento ?? '', Validators.required], nombreArchivo: [item?.nombreArchivo ?? ''], urlArchivo: [item?.urlArchivo ?? ''], numeroDocumento: [item?.numeroDocumento ?? ''], fechaDocumento: [item?.fechaDocumento ?? ''], versionDocumento: [item?.versionDocumento ?? 1], vigente: [item?.vigente ?? true], observacion: [item?.observacion ?? ''] }));
  }

  removeDetalle(i: number) { this.detalles.removeAt(i); this.dirty.set(true); }
  removePacking(i: number) { this.packings.removeAt(i); this.dirty.set(true); }
  removePackingResumen(i: number) { this.packingResumenes.removeAt(i); this.dirty.set(true); }
  removeDocumento(i: number) { this.documentos.removeAt(i); this.dirty.set(true); }



  private syncDocumentos(idImpOfertaProveedorFk: number) {
    const current = this.documentos.getRawValue();
    const currentIds = current.map((x: any) => x.idImpOfertaProveedorDocumento).filter(Boolean);
    const removals = this.originalDocumentoIds.filter((id) => !currentIds.includes(id)).map((id) => this.repo.eliminarDocumento(id));
    const upserts = current.map((row: any) => {
      const payload = {
        idImpOfertaProveedorFk,
        tipoDocumento: row.tipoDocumento?.trim(),
        nombreArchivo: row.nombreArchivo?.trim() || null,
        urlArchivo: row.urlArchivo?.trim() || null,
        numeroDocumento: row.numeroDocumento?.trim() || null,
        fechaDocumento: row.fechaDocumento || null,
        versionDocumento: Number(row.versionDocumento || 1),
        vigente: !!row.vigente,
        observacion: row.observacion?.trim() || null,
      };
      return row.idImpOfertaProveedorDocumento
        ? this.repo.editarDocumento({ idImpOfertaProveedorDocumento: row.idImpOfertaProveedorDocumento, cambios: payload })
        : this.repo.crearDocumento(payload as any);
    });
    const ops = [...removals, ...upserts];
    return ops.length ? forkJoin(ops) : of([]);
  }

  private normalizeGuardarPayload(): OfertaProveedorGuardarRequest {
    const raw = this.form.getRawValue();

    return {
      tipoOferta: raw.tipoOferta ?? 'COTIZACION',
      idImpProveedorProspectoFk: raw.idImpProveedorProspectoFk ?? null,
      dniAdqProveedorFk: raw.dniAdqProveedorFk ?? null,
      numeroDocumento: raw.numeroDocumento?.trim() || null,
      numeroVersion: raw.numeroVersion ?? 1,
      fechaOferta: raw.fechaOferta || null,
      fechaVigenciaDesde: raw.fechaVigenciaDesde || null,
      fechaVigenciaHasta: raw.fechaVigenciaHasta || null,
      idMonMonedaFk: Number(raw.idMonMonedaFk),
      incoterm: raw.incoterm?.trim() || null,
      lugarEntrega: raw.lugarEntrega?.trim() || null,
      formaPago: raw.formaPago?.trim() || null,
      tiempoEntregaDias: raw.tiempoEntregaDias ?? null,
      vigente: !!raw.vigente,
      bloqueadaParaSondeo: !!raw.bloqueadaParaSondeo,
      observacion: raw.observacion?.trim() || null,

      detalles: ((raw.detalles ?? []) as any[]).map((d) => ({
        idImpArticuloProspectoFk: d.idImpArticuloProspectoFk ?? null,
        idActInventarioFk: d.idActInventarioFk ?? null,
        codigoArticuloProveedor: d.codigoArticuloProveedor?.trim() || null,
        descripcionItem: String(d.descripcionItem ?? '').trim(),
        color: d.color?.trim() || null,
        tamano: d.tamano?.trim() || null,
        cantidadMinima: d.cantidadMinima ?? null,
        cantidadOfertada: Number(d.cantidadOfertada ?? 0),
        idActInventarioUnidadFk: String(d.idActInventarioUnidadFk ?? 'UN').trim(),
        precioUnitario: d.precioUnitario ?? null,
        descuentoPct: d.descuentoPct ?? null,
        subtotal: d.subtotal ?? null,
        paisOrigenFk: d.paisOrigenFk ?? null,
        pesoUnitario: d.pesoUnitario ?? null,
        cbmUnitario: d.cbmUnitario ?? null,
        idImpCodigoArancelarioFk: d.idImpCodigoArancelarioFk ?? null,
        observacion: d.observacion?.trim() || null,
      })),

      packings: ((raw.packings ?? []) as any[]).map((p) => ({
        idImpOfertaProveedorDetalleFk: p.idImpOfertaProveedorDetalleFk ?? null,
        detalleIndex: p.detalleIndex ?? null,
        tipoEmpaque: p.tipoEmpaque?.trim() || null,
        cantidadPorEmpaque: p.cantidadPorEmpaque ?? null,
        largo: p.largo ?? null,
        ancho: p.ancho ?? null,
        alto: p.alto ?? null,
        cbm: p.cbm ?? null,
        pesoBruto: p.pesoBruto ?? null,
        pesoNeto: p.pesoNeto ?? null,
        observacion: p.observacion?.trim() || null,
      })),

      packingResumenes: ((raw.packingResumenes ?? []) as any[]).map((r) => ({
        ordenResumen: r.ordenResumen ?? null,
        tipoBulto: r.tipoBulto?.trim() || null,
        cantidadBultos: r.cantidadBultos ?? null,
        largoCm: r.largoCm ?? null,
        anchoCm: r.anchoCm ?? null,
        altoCm: r.altoCm ?? null,
        cbmTotal: r.cbmTotal ?? null,
        pesoBrutoTotal: r.pesoBrutoTotal ?? null,
        pesoNetoTotal: r.pesoNetoTotal ?? null,
        observacion: r.observacion?.trim() || null,
      })),
    };
  }

  private normalizeEditarPayload(): Partial<OfertaProveedor> {
    const raw = this.form.getRawValue();

    return {
      tipoOferta: raw.tipoOferta ?? 'COTIZACION',
      idImpProveedorProspectoFk: raw.idImpProveedorProspectoFk ?? null,
      dniAdqProveedorFk: raw.dniAdqProveedorFk ?? null,
      numeroDocumento: raw.numeroDocumento?.trim() || null,
      numeroVersion: raw.numeroVersion ?? 1,
      fechaOferta: raw.fechaOferta || null,
      fechaVigenciaDesde: raw.fechaVigenciaDesde || null,
      fechaVigenciaHasta: raw.fechaVigenciaHasta || null,
      idMonMonedaFk: Number(raw.idMonMonedaFk),
      incoterm: raw.incoterm?.trim() || null,
      lugarEntrega: raw.lugarEntrega?.trim() || null,
      formaPago: raw.formaPago?.trim() || null,
      tiempoEntregaDias: raw.tiempoEntregaDias ?? null,
      vigente: !!raw.vigente,
      bloqueadaParaSondeo: !!raw.bloqueadaParaSondeo,
      observacion: raw.observacion?.trim() || null,
    };
  }
}
