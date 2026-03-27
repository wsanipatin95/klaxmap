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
import { ImportacionProveedoresRepository } from '../../data-access/proveedores.repository';
import { ProveedorProspecto, ProveedorProspectoContacto, ProveedorProspectoDocumento } from '../../data-access/proveedores.models';
import { pendingChangesGuard, PendingChangesAware } from '../../guards/pending-changes.guard';

@Component({
  selector: 'app-importacion-proveedores',
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
  templateUrl: './importacion-proveedores.component.html',
  styleUrl: './importacion-proveedores.component.scss',
})
export class ImportacionProveedoresComponent implements PendingChangesAware {
  private fb = inject(FormBuilder);
  private repo = inject(ImportacionProveedoresRepository);
  private notify = inject(NotifyService);
  private confirm = inject(ImportacionConfirmService);
  private destroyRef = inject(DestroyRef);

  q = '';
  loading = signal(false);
  saving = signal(false);
  items = signal<ProveedorProspecto[]>([]);
  drawerVisible = signal(false);
  dirty = signal(false);
  editingId = signal<number | null>(null);

  private originalContactIds: number[] = [];
  private originalDocumentoIds: number[] = [];

  form = this.fb.group({
    nombreProveedor: ['', Validators.required],
    nombreComercial: [''],
    identificacion: [''],
    idCiuPaisFk: [null as number | null],
    ciudad: [''],
    direccion: [''],
    sitioWeb: [''],
    correoPrincipal: [''],
    telefonoPrincipal: [''],
    whatsapp: [''],
    condicionesGenerales: [''],
    estadoProspecto: ['BORRADOR'],
    dniAdqProveedorFk: [null as number | null],
    bloqueado: [false],
    observacion: [''],
    contactos: this.fb.array([]),
    documentos: this.fb.array([]),
  });

  get contactos(): FormArray {
    return this.form.get('contactos') as FormArray;
  }

  get documentos(): FormArray {
    return this.form.get('documentos') as FormArray;
  }

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
        error: (err) => this.notify.error('No se pudo cargar proveedores', err?.message),
      });
  }

  nuevo() {
    this.editingId.set(null);
    this.originalContactIds = [];
    this.originalDocumentoIds = [];
    this.form.reset({ estadoProspecto: 'BORRADOR', bloqueado: false });
    this.contactos.clear();
    this.documentos.clear();
    this.addContacto();
    this.drawerVisible.set(true);
    this.dirty.set(false);
  }

  editar(item: ProveedorProspecto) {
    if (!item.idImpProveedorProspecto) return;
    this.loading.set(true);
    forkJoin({
      contactos: this.repo.listarContactos(item.idImpProveedorProspecto),
      documentos: this.repo.listarDocumentos(item.idImpProveedorProspecto),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ contactos, documentos }) => {
        this.editingId.set(item.idImpProveedorProspecto!);
        this.form.patchValue({
          nombreProveedor: item.nombreProveedor,
          nombreComercial: item.nombreComercial ?? '',
          identificacion: item.identificacion ?? '',
          idCiuPaisFk: item.idCiuPaisFk ?? null,
          ciudad: item.ciudad ?? '',
          direccion: item.direccion ?? '',
          sitioWeb: item.sitioWeb ?? '',
          correoPrincipal: item.correoPrincipal ?? '',
          telefonoPrincipal: item.telefonoPrincipal ?? '',
          whatsapp: item.whatsapp ?? '',
          condicionesGenerales: item.condicionesGenerales ?? '',
          estadoProspecto: item.estadoProspecto ?? 'BORRADOR',
          dniAdqProveedorFk: item.dniAdqProveedorFk ?? null,
          bloqueado: !!item.bloqueado,
          observacion: item.observacion ?? '',
        }, { emitEvent: false });
        this.contactos.clear();
        this.documentos.clear();
        (contactos.items ?? []).forEach((x) => this.addContacto(x));
        (documentos.items ?? []).forEach((x) => this.addDocumento(x));
        this.originalContactIds = (contactos.items ?? []).map((x) => x.idImpProveedorProspectoContacto!).filter(Boolean);
        this.originalDocumentoIds = (documentos.items ?? []).map((x) => x.idImpProveedorProspectoDocumento!).filter(Boolean);
        this.drawerVisible.set(true);
        this.dirty.set(false);
      },
      error: (err) => this.notify.error('No se pudo cargar detalle del proveedor', err?.message),
    });
  }

  async eliminar(item: ProveedorProspecto) {
    if (!item.idImpProveedorProspecto) return;
    const ok = await this.confirm.confirmDelete(item.nombreProveedor || 'el proveedor');
    if (!ok) return;
    this.repo.eliminar(item.idImpProveedorProspecto).subscribe({
      next: (res) => {
        this.notify.success('Proveedor eliminado', res.mensaje);
        this.cargar();
      },
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
      this.notify.warn('Formulario incompleto', 'Revisa los campos obligatorios del proveedor prospecto.');
      return;
    }

    const payload = this.normalizePayload();
    this.saving.set(true);

    const request$ = this.editingId()
      ? this.repo.editar({ idImpProveedorProspecto: this.editingId()!, cambios: payload })
      : this.repo.crear(payload);

    request$
      .pipe(
        switchMap((res) => {
          const id = this.editingId() ?? Number((res.data as any)?.idImpProveedorProspecto);
          if (!id) return of(res);
          return this.syncDependientes(id).pipe(switchMap(() => of(res)));
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.notify.success(this.editingId() ? 'Proveedor actualizado' : 'Proveedor creado', res.mensaje);
          this.drawerVisible.set(false);
          this.dirty.set(false);
          this.cargar();
        },
        error: (err) => this.notify.error('No se pudo guardar', err?.message),
      });
  }

  addContacto(item?: Partial<ProveedorProspectoContacto>) {
    this.contactos.push(this.fb.group({
      idImpProveedorProspectoContacto: [item?.idImpProveedorProspectoContacto ?? null],
      nombreContacto: [item?.nombreContacto ?? '', Validators.required],
      cargo: [item?.cargo ?? ''],
      correo: [item?.correo ?? ''],
      telefono: [item?.telefono ?? ''],
      whatsapp: [item?.whatsapp ?? ''],
      idioma: [item?.idioma ?? ''],
      principal: [!!item?.principal],
      observacion: [item?.observacion ?? ''],
    }));
  }

  removeContacto(index: number) {
    this.contactos.removeAt(index);
    this.dirty.set(true);
  }

  addDocumento(item?: Partial<ProveedorProspectoDocumento>) {
    this.documentos.push(this.fb.group({
      idImpProveedorProspectoDocumento: [item?.idImpProveedorProspectoDocumento ?? null],
      tipoDocumento: [item?.tipoDocumento ?? '', Validators.required],
      nombreArchivo: [item?.nombreArchivo ?? ''],
      urlArchivo: [item?.urlArchivo ?? ''],
      numeroDocumento: [item?.numeroDocumento ?? ''],
      fechaDocumento: [item?.fechaDocumento ?? ''],
      versionDocumento: [item?.versionDocumento ?? 1],
      vigente: [item?.vigente ?? true],
      observacion: [item?.observacion ?? ''],
    }));
  }

  removeDocumento(index: number) {
    this.documentos.removeAt(index);
    this.dirty.set(true);
  }

private normalizePayload() {
  const raw = this.form.getRawValue();
  return {
    nombreProveedor: String(raw.nombreProveedor ?? '').trim(),
    nombreComercial: raw.nombreComercial?.trim() || null,
    identificacion: raw.identificacion?.trim() || null,
    idCiuPaisFk: raw.idCiuPaisFk ?? null,
    ciudad: raw.ciudad?.trim() || null,
    direccion: raw.direccion?.trim() || null,
    sitioWeb: raw.sitioWeb?.trim() || null,
    correoPrincipal: raw.correoPrincipal?.trim() || null,
    telefonoPrincipal: raw.telefonoPrincipal?.trim() || null,
    whatsapp: raw.whatsapp?.trim() || null,
    condicionesGenerales: raw.condicionesGenerales?.trim() || null,
    estadoProspecto: raw.estadoProspecto ?? 'BORRADOR',
    dniAdqProveedorFk: raw.dniAdqProveedorFk ?? null,
    bloqueado: !!raw.bloqueado,
    observacion: raw.observacion?.trim() || null,
  };
}

  private syncDependientes(idImpProveedorProspectoFk: number) {
    const contactoOps = this.buildContactoOps(idImpProveedorProspectoFk);
    const documentoOps = this.buildDocumentoOps(idImpProveedorProspectoFk);
    const ops = [...contactoOps, ...documentoOps];
    return ops.length ? forkJoin(ops) : of([]);
  }

  private buildContactoOps(idImpProveedorProspectoFk: number) {
    const current = this.contactos.getRawValue();
    const currentIds = current.map((x: any) => x.idImpProveedorProspectoContacto).filter(Boolean);
    const removals = this.originalContactIds.filter((id) => !currentIds.includes(id)).map((id) => this.repo.eliminarContacto(id));
    const upserts = current.map((row: any) => {
      const payload = {
        idImpProveedorProspectoFk,
        nombreContacto: row.nombreContacto?.trim() || null,
        cargo: row.cargo?.trim() || null,
        correo: row.correo?.trim() || null,
        telefono: row.telefono?.trim() || null,
        whatsapp: row.whatsapp?.trim() || null,
        idioma: row.idioma?.trim() || null,
        principal: !!row.principal,
        observacion: row.observacion?.trim() || null,
      };
      return row.idImpProveedorProspectoContacto
        ? this.repo.editarContacto({ idImpProveedorProspectoContacto: row.idImpProveedorProspectoContacto, cambios: payload })
        : this.repo.crearContacto(payload);
    });
    return [...removals, ...upserts];
  }

  private buildDocumentoOps(idImpProveedorProspectoFk: number) {
    const current = this.documentos.getRawValue();
    const currentIds = current.map((x: any) => x.idImpProveedorProspectoDocumento).filter(Boolean);
    const removals = this.originalDocumentoIds.filter((id) => !currentIds.includes(id)).map((id) => this.repo.eliminarDocumento(id));
    const upserts = current.map((row: any) => {
      const payload = {
        idImpProveedorProspectoFk,
        tipoDocumento: row.tipoDocumento?.trim(),
        nombreArchivo: row.nombreArchivo?.trim() || null,
        urlArchivo: row.urlArchivo?.trim() || null,
        numeroDocumento: row.numeroDocumento?.trim() || null,
        fechaDocumento: row.fechaDocumento || null,
        versionDocumento: Number(row.versionDocumento || 1),
        vigente: !!row.vigente,
        observacion: row.observacion?.trim() || null,
      };
      return row.idImpProveedorProspectoDocumento
        ? this.repo.editarDocumento({ idImpProveedorProspectoDocumento: row.idImpProveedorProspectoDocumento, cambios: payload })
        : this.repo.crearDocumento(payload);
    });
    return [...removals, ...upserts];
  }
}
