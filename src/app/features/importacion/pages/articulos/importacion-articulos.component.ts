import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
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
import { ImportacionArticulosRepository } from '../../data-access/articulos.repository';
import { ArticuloProspecto, ArticuloImagen, ArticuloAtributo } from '../../data-access/articulos.models';
import { PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-importacion-articulos',
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
  templateUrl: './importacion-articulos.component.html',
  styleUrl: './importacion-articulos.component.scss',
})
export class ImportacionArticulosComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(ImportacionArticulosRepository);
  private notify = inject(NotifyService);
  private confirm = inject(ImportacionConfirmService);
  private destroyRef = inject(DestroyRef);

  q = '';
  loading = signal(false);
  saving = signal(false);
  items = signal<ArticuloProspecto[]>([]);
  drawerVisible = signal(false);
  dirty = signal(false);
  editingId = signal<number | null>(null);

  private originalImagenIds: number[] = [];
  private originalAtributoIds: number[] = [];

  form = this.fb.group({
    idImpProveedorProspectoFk: [null as number | null, Validators.required],
    codigoArticuloProveedor: [''],
    nombreArticuloProveedor: ['', Validators.required],
    descripcionArticuloProveedor: [''],
    idActInventarioFk: [null as number | null],
    idActInventarioUnidadFk: [null as number | null],
    factorConversion: [null as number | null],
    cantidadPorEmpaque: [null as number | null],
    tipoEmpaque: [''],
    pesoUnitario: [null as number | null],
    cbmUnitario: [null as number | null],
    idCiuPaisOrigenFk: [null as number | null],
    marca: [''],
    modelo: [''],
    color: [''],
    tamano: [''],
    precioReferencial: [null as number | null],
    idMonMonedaFk: [null as number | null],
    estadoProspecto: ['LEVANTADO'],
    clasificacionConfirmada: [false],
    idImpCodigoArancelarioFk: [null as number | null],
    observacion: [''],
    imagenes: this.fb.array([]),
    atributos: this.fb.array([]),
    homologarDespuesGuardar: [false],
    clasificarDespuesGuardar: [false],
  });

  get imagenes(): FormArray { return this.form.get('imagenes') as FormArray; }
  get atributos(): FormArray { return this.form.get('atributos') as FormArray; }

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
      .subscribe({
        next: (paged) => this.items.set(paged.items ?? []),
        error: (err) => this.notify.error('No se pudo cargar artículos prospecto', err?.message),
      });
  }

  nuevo() {
    this.editingId.set(null);
    this.originalImagenIds = [];
    this.originalAtributoIds = [];
    this.form.reset({ estadoProspecto: 'LEVANTADO', clasificacionConfirmada: false, homologarDespuesGuardar: false, clasificarDespuesGuardar: false });
    this.imagenes.clear();
    this.atributos.clear();
    this.addImagen();
    this.addAtributo();
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editar(item: ArticuloProspecto) {
    if (!item.idImpProveedorArticuloProspecto) return;
    this.loading.set(true);
    forkJoin({
      imagenes: this.repo.listarImagenes(item.idImpProveedorArticuloProspecto),
      atributos: this.repo.listarAtributos(item.idImpProveedorArticuloProspecto),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ imagenes, atributos }) => {
        this.editingId.set(item.idImpProveedorArticuloProspecto!);
        this.form.patchValue({
          idImpProveedorProspectoFk: item.idImpProveedorProspectoFk,
          codigoArticuloProveedor: item.codigoArticuloProveedor ?? '',
          nombreArticuloProveedor: item.nombreArticuloProveedor,
          descripcionArticuloProveedor: item.descripcionArticuloProveedor ?? '',
          idActInventarioFk: item.idActInventarioFk ?? null,
          idActInventarioUnidadFk: item.idActInventarioUnidadFk ?? null,
          factorConversion: item.factorConversion ?? null,
          cantidadPorEmpaque: item.cantidadPorEmpaque ?? null,
          tipoEmpaque: item.tipoEmpaque ?? '',
          pesoUnitario: item.pesoUnitario ?? null,
          cbmUnitario: item.cbmUnitario ?? null,
          idCiuPaisOrigenFk: item.idCiuPaisOrigenFk ?? null,
          marca: item.marca ?? '',
          modelo: item.modelo ?? '',
          color: item.color ?? '',
          tamano: item.tamano ?? '',
          precioReferencial: item.precioReferencial ?? null,
          idMonMonedaFk: item.idMonMonedaFk ?? null,
          estadoProspecto: item.estadoProspecto ?? 'LEVANTADO',
          clasificacionConfirmada: !!item.clasificacionConfirmada,
          idImpCodigoArancelarioFk: item.idImpCodigoArancelarioFk ?? null,
          observacion: item.observacion ?? '',
          homologarDespuesGuardar: false,
          clasificarDespuesGuardar: false,
        }, { emitEvent: false });
        this.imagenes.clear();
        this.atributos.clear();
        (imagenes.items ?? []).forEach((x) => this.addImagen(x));
        (atributos.items ?? []).forEach((x) => this.addAtributo(x));
        this.originalImagenIds = (imagenes.items ?? []).map((x) => x.idImpProveedorArticuloProspectoImagen!).filter(Boolean);
        this.originalAtributoIds = (atributos.items ?? []).map((x) => x.idImpProveedorArticuloProspectoAtributo!).filter(Boolean);
        this.drawerVisible.set(true);
        this.dirty.set(false);
      },
      error: (err) => this.notify.error('No se pudo cargar detalle del artículo', err?.message),
    });
  }

  async eliminar(item: ArticuloProspecto) {
    if (!item.idImpProveedorArticuloProspecto) return;
    const ok = await this.confirm.confirmDelete(item.nombreArticuloProveedor || 'el artículo');
    if (!ok) return;
    this.repo.eliminar(item.idImpProveedorArticuloProspecto).subscribe({
      next: (res) => { this.notify.success('Artículo eliminado', res.mensaje); this.cargar(); },
      error: (err) => this.notify.error('No se pudo eliminar', err?.message),
    });
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
      this.notify.warn('Formulario incompleto', 'Completa proveedor prospecto y nombre del artículo.');
      return;
    }
    const payload = this.normalizePayload();
    this.saving.set(true);
    const request$ = this.editingId()
      ? this.repo.editar({ idImpProveedorArticuloProspecto: this.editingId()!, cambios: payload })
      : this.repo.crear(payload);

    request$
      .pipe(
        switchMap((res) => {
          const id = this.editingId() ?? Number((res.data as any)?.idImpProveedorArticuloProspecto);
          if (!id) return of(res);
          return this.syncDependientes(id).pipe(switchMap(() => this.runPostActions(id).pipe(switchMap(() => of(res)))));
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.notify.success(this.editingId() ? 'Artículo actualizado' : 'Artículo creado', res.mensaje);
          this.drawerVisible.set(false);
          this.dirty.set(false);
          this.cargar();
        },
        error: (err) => this.notify.error('No se pudo guardar', err?.message),
      });
  }

  addImagen(item?: Partial<ArticuloImagen>) {
    this.imagenes.push(this.fb.group({
      idImpProveedorArticuloProspectoImagen: [item?.idImpProveedorArticuloProspectoImagen ?? null],
      nombreArchivo: [item?.nombreArchivo ?? ''],
      urlArchivo: [item?.urlArchivo ?? ''],
      mimeType: [item?.mimeType ?? ''],
      imagenPrincipal: [!!item?.imagenPrincipal],
      ordenVisual: [item?.ordenVisual ?? 1],
      observacion: [item?.observacion ?? ''],
    }));
  }

  removeImagen(index: number) { this.imagenes.removeAt(index); this.dirty.set(true); }

  addAtributo(item?: Partial<ArticuloAtributo>) {
    this.atributos.push(this.fb.group({
      idImpProveedorArticuloProspectoAtributo: [item?.idImpProveedorArticuloProspectoAtributo ?? null],
      nombreAtributo: [item?.nombreAtributo ?? '', Validators.required],
      valorAtributo: [item?.valorAtributo ?? ''],
      unidadAtributo: [item?.unidadAtributo ?? ''],
      ordenVisual: [item?.ordenVisual ?? 1],
      observacion: [item?.observacion ?? ''],
    }));
  }

  removeAtributo(index: number) { this.atributos.removeAt(index); this.dirty.set(true); }

  private normalizePayload() {
    const raw = this.form.getRawValue();
    return {
      idImpProveedorProspectoFk: Number(raw.idImpProveedorProspectoFk),
      codigoArticuloProveedor: raw.codigoArticuloProveedor?.trim() || null,
      nombreArticuloProveedor: raw.nombreArticuloProveedor?.trim(),
      descripcionArticuloProveedor: raw.descripcionArticuloProveedor?.trim() || null,
      idActInventarioFk: raw.idActInventarioFk ?? null,
      idActInventarioUnidadFk: raw.idActInventarioUnidadFk ?? null,
      factorConversion: raw.factorConversion ?? null,
      cantidadPorEmpaque: raw.cantidadPorEmpaque ?? null,
      tipoEmpaque: raw.tipoEmpaque?.trim() || null,
      pesoUnitario: raw.pesoUnitario ?? null,
      cbmUnitario: raw.cbmUnitario ?? null,
      idCiuPaisOrigenFk: raw.idCiuPaisOrigenFk ?? null,
      marca: raw.marca?.trim() || null,
      modelo: raw.modelo?.trim() || null,
      color: raw.color?.trim() || null,
      tamano: raw.tamano?.trim() || null,
      precioReferencial: raw.precioReferencial ?? null,
      idMonMonedaFk: raw.idMonMonedaFk ?? null,
      estadoProspecto: raw.estadoProspecto || 'LEVANTADO',
      clasificacionConfirmada: !!raw.clasificacionConfirmada,
      idImpCodigoArancelarioFk: raw.idImpCodigoArancelarioFk ?? null,
      observacion: raw.observacion?.trim() || null,
    };
  }

  private syncDependientes(id: number) {
    const imagenOps = this.buildImagenOps(id);
    const atributoOps = this.buildAtributoOps(id);
    const ops = [...imagenOps, ...atributoOps];
    return ops.length ? forkJoin(ops) : of([]);
  }

  private buildImagenOps(id: number) {
    const current = this.imagenes.getRawValue();
    const currentIds = current.map((x: any) => x.idImpProveedorArticuloProspectoImagen).filter(Boolean);
    const removals = this.originalImagenIds.filter((orig) => !currentIds.includes(orig)).map((orig) => this.repo.eliminarImagen(orig));
    const upserts = current.map((row: any) => {
      const payload = {
        idImpProveedorArticuloProspectoFk: id,
        nombreArchivo: row.nombreArchivo?.trim() || null,
        urlArchivo: row.urlArchivo?.trim() || null,
        mimeType: row.mimeType?.trim() || null,
        imagenPrincipal: !!row.imagenPrincipal,
        ordenVisual: Number(row.ordenVisual || 1),
        observacion: row.observacion?.trim() || null,
      };
      return row.idImpProveedorArticuloProspectoImagen
        ? this.repo.editarImagen({ idImpProveedorArticuloProspectoImagen: row.idImpProveedorArticuloProspectoImagen, cambios: payload })
        : this.repo.crearImagen(payload);
    });
    return [...removals, ...upserts];
  }

  private buildAtributoOps(id: number) {
    const current = this.atributos.getRawValue();
    const currentIds = current.map((x: any) => x.idImpProveedorArticuloProspectoAtributo).filter(Boolean);
    const removals = this.originalAtributoIds.filter((orig) => !currentIds.includes(orig)).map((orig) => this.repo.eliminarAtributo(orig));
    const upserts = current.map((row: any) => {
      const payload = {
        idImpProveedorArticuloProspectoFk: id,
        nombreAtributo: row.nombreAtributo?.trim(),
        valorAtributo: row.valorAtributo?.trim() || null,
        unidadAtributo: row.unidadAtributo?.trim() || null,
        ordenVisual: Number(row.ordenVisual || 1),
        observacion: row.observacion?.trim() || null,
      };
      return row.idImpProveedorArticuloProspectoAtributo
        ? this.repo.editarAtributo({ idImpProveedorArticuloProspectoAtributo: row.idImpProveedorArticuloProspectoAtributo, cambios: payload })
        : this.repo.crearAtributo(payload);
    });
    return [...removals, ...upserts];
  }

  private runPostActions(id: number) {
    const raw = this.form.getRawValue();
    const ops = [] as any[];
    if (raw.homologarDespuesGuardar) {
      ops.push(this.repo.crearHomologacion({
        idImpProveedorArticuloProspectoFk: id,
        idActInventarioFk: raw.idActInventarioFk ?? null,
        idActInventarioUnidadFk: raw.idActInventarioUnidadFk ?? null,
        idImpCodigoArancelarioFk: raw.idImpCodigoArancelarioFk ?? null,
        clasificacionConfirmada: !!raw.clasificacionConfirmada,
        estadoHomologacion: 'PROPUESTA',
        vigente: true,
        aplicarEnArticulo: true,
        observacion: 'Homologación inicial creada desde frontend IMP.',
      }));
    }
    if (raw.clasificarDespuesGuardar && raw.idImpCodigoArancelarioFk) {
      ops.push(this.repo.crearClasificacion({
        idImpProveedorArticuloProspectoFk: id,
        idActInventarioFk: raw.idActInventarioFk ?? null,
        idImpCodigoArancelarioFk: raw.idImpCodigoArancelarioFk,
        tipoClasificacion: 'MANUAL',
        estadoClasificacion: 'PROPUESTA',
        nivelConfianza: 100,
        clasificacionConfirmada: !!raw.clasificacionConfirmada,
        sustentoClasificacion: 'Clasificación inicial creada desde frontend IMP.',
        fechaClasificacion: null,
        observacion: 'Alta automática posterior al guardado del artículo prospecto.',
      }));
    }
    return ops.length ? forkJoin(ops) : of([]);
  }
}
