import { CommonModule } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { MapaTiposRepository } from '../../data-access/tipo-elemento/mapa-tipos.repository';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
  PagedResponse,
} from '../../data-access/mapa.models';
import { MapaTipoFormComponent } from '../../components/mapa-tipo-form/mapa-tipo-form.component';
import { MapaConfirmDialogComponent } from '../../components/mapa-confirm-dialog/mapa-confirm-dialog.component';
import { AuditoriaRegistroComponent } from '../../components/auditoria-registro/auditoria-registro.component';

type TipoPanelTab = 'edicion' | 'historial';

@Component({
  selector: 'app-mapa-tipos',
  standalone: true,
  imports: [CommonModule, MapaTipoFormComponent, MapaConfirmDialogComponent, AuditoriaRegistroComponent],
  templateUrl: './mapa-tipos.component.html',
  styleUrl: './mapa-tipos.component.scss',
})
export class MapaTiposComponent {
  private repo = inject(MapaTiposRepository);
  private router = inject(Router);

  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;
  @ViewChild('tipoForm') tipoForm?: MapaTipoFormComponent;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly tipos = signal<MapaTipoElemento[]>([]);
  readonly selected = signal<MapaTipoElemento | null>(null);
  readonly mode = signal<'crear' | 'editar'>('crear');
  readonly formDirty = signal(false);
  readonly activeTab = signal<TipoPanelTab>('edicion');
  readonly auditRefreshKey = signal(0);

  readonly currentTitle = computed(() =>
    this.mode() === 'crear' ? 'Nuevo tipo' : 'Editar tipo'
  );

  readonly currentSubtitle = computed(() => {
    if (this.mode() === 'crear') {
      return 'Completa los datos básicos.';
    }

    const current = this.selected();
    return current ? `Editando: ${current.nombre}` : 'Editar tipo';
  });

  constructor() {
    this.cargar();
  }

  setTab(tab: TipoPanelTab) {
    this.activeTab.set(tab);
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    this.repo.listar({ all: true })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          const items = Array.isArray(data)
            ? data
            : (data as PagedResponse<MapaTipoElemento>).content ?? [];

          this.tipos.set(items);

          const current = this.selected();
          if (current) {
            const updated = items.find((x) => x.idGeoTipoElemento === current.idGeoTipoElemento) ?? null;
            this.selected.set(updated);

            if (!updated) {
              this.mode.set('crear');
              this.activeTab.set('edicion');
            }
          }
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar tipos.');
        },
      });
  }

  irAlMapa() {
    this.runWithDiscardGuard(() => {
      this.router.navigate(['/app/mapa/home']);
    });
  }

  nuevoTipo() {
    this.runWithDiscardGuard(() => {
      this.selected.set(null);
      this.mode.set('crear');
      this.activeTab.set('edicion');
      this.success.set(null);
      queueMicrotask(() => {
        this.tipoForm?.resetForNew();
      });
    });
  }

  seleccionar(t: MapaTipoElemento) {
    if (this.selected()?.idGeoTipoElemento === t.idGeoTipoElemento && this.mode() === 'editar') {
      return;
    }

    this.runWithDiscardGuard(() => {
      this.selected.set(t);
      this.mode.set('editar');
      this.activeTab.set('edicion');
      this.success.set(null);
    });
  }

  guardar(payload: MapaTipoElementoSaveRequest) {
    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    if (this.mode() === 'crear') {
      this.repo.crear(payload)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.success.set('Tipo creado.');
            this.cargar();
            this.mode.set('crear');
            this.activeTab.set('edicion');
            this.selected.set(null);
            queueMicrotask(() => {
              this.tipoForm?.resetForNew();
              this.formDirty.set(false);
            });
          },
          error: (err) => {
            console.error(err);
            this.error.set(err?.message || 'No se pudo crear.');
          },
        });

      return;
    }

    const current = this.selected();
    if (!current) {
      this.saving.set(false);
      this.error.set('No hay un tipo seleccionado.');
      return;
    }

    this.repo.editar({
      id: current.idGeoTipoElemento,
      cambios: { ...payload },
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Tipo actualizado.');
          this.formDirty.set(false);
          this.auditRefreshKey.update(v => v + 1);
          this.cargar();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo editar.');
        },
      });
  }

  eliminarActual() {
    const current = this.selected();
    if (!current) return;

    this.confirmDialog?.open(
      {
        title: 'Eliminar tipo',
        message: `Se eliminará "${current.nombre}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.saving.set(true);
        this.error.set(null);
        this.success.set(null);

        this.repo.eliminar(current.idGeoTipoElemento)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.success.set('Tipo eliminado.');
              this.selected.set(null);
              this.mode.set('crear');
              this.activeTab.set('edicion');
              this.formDirty.set(false);
              this.cargar();
              queueMicrotask(() => {
                this.tipoForm?.resetForNew();
              });
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar.');
            },
          });
      }
    );
  }

  onFormCancel() {
    if (!this.formDirty()) {
      if (this.mode() === 'editar' && this.selected()) {
        queueMicrotask(() => this.tipoForm?.markSaved(this.selected()));
      } else {
        this.nuevoTipo();
      }
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.formDirty.set(false);

        if (this.mode() === 'editar' && this.selected()) {
          queueMicrotask(() => this.tipoForm?.markSaved(this.selected()));
        } else {
          this.nuevoTipo();
        }
      }
    );
  }

  onDirtyChange(dirty: boolean) {
    this.formDirty.set(dirty);
  }

  geometryLabel(tipo: MapaTipoElemento): string {
    const geom = String(tipo.geometriaPermitida ?? 'point').toLowerCase();

    if (geom === 'linestring') return 'línea';
    if (geom === 'polygon') return 'polígono';
    if (geom === 'mixed') return 'mixto';
    return 'punto';
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    const stroke = tipo.colorStroke || '#7b0061';
    const fill = tipo.colorFill || '#f3aad6';
    const text = tipo.colorTexto || stroke;
    const size = `${tipo.tamanoIcono ?? 16}px`;

    return {
      '--preview-stroke': stroke,
      '--preview-fill': fill,
      '--preview-text': text,
      '--preview-size': size,
      '--preview-stroke-width': `${tipo.strokeWidth ?? 1}`,
    };
  }

  previewShapeClass(tipo: MapaTipoElemento): string {
    const source = this.normalizedSource(tipo);
    const shape = String(tipo.shapeBase ?? '').toLowerCase();
    const geom = String(tipo.geometriaPermitida ?? 'point').toLowerCase();

    if (geom === 'linestring') return 'is-line';
    if (geom === 'polygon') return 'is-polygon';
    if (geom === 'mixed') return 'is-mixed';

    if (this.previewVisualMode(tipo) !== 'shape') return 'is-icon-host';
    if (source.includes('triangle') || shape.includes('triangle')) return 'is-triangle';
    if (source.includes('target') || shape.includes('target')) return 'is-target';
    if (source.includes('donut') || shape.includes('donut')) return 'is-donut';
    if (shape.includes('square') || shape.includes('rect')) return 'is-square';

    return 'is-point';
  }

  previewVisualMode(tipo: MapaTipoElemento): 'material' | 'class' | 'url' | 'shape' {
    const geom = String(tipo.geometriaPermitida ?? 'point').toLowerCase();
    const source = this.normalizedSource(tipo);

    if (geom !== 'point') {
      return 'shape';
    }

    if (this.isMaterialSource(source)) return 'material';
    if (this.isCssClassSource(source)) return 'class';
    if (this.isUrlSource(source)) return 'url';

    return 'shape';
  }

  previewMaterialFamilyClass(tipo: MapaTipoElemento): string {
    const source = this.normalizedSource(tipo);

    if (source.includes('rounded')) return 'material-symbols-rounded';
    if (source.includes('sharp')) return 'material-symbols-sharp';

    return 'material-symbols-outlined';
  }

  previewMaterialGlyph(tipo: MapaTipoElemento): string {
    return tipo.icono?.trim() || 'radio_button_checked';
  }

  previewClassName(tipo: MapaTipoElemento): string {
    return tipo.iconoClase?.trim() || tipo.icono?.trim() || 'pi pi-circle';
  }

  previewImageUrl(tipo: MapaTipoElemento): string {
    return tipo.icono?.trim() || '';
  }

  private normalizedSource(tipo: MapaTipoElemento): string {
    return String(tipo.iconoFuente ?? '').trim().toLowerCase();
  }

  private isMaterialSource(source: string): boolean {
    return (
      source === 'material-symbols-outlined' ||
      source === 'material-symbols-rounded' ||
      source === 'material-symbols-sharp' ||
      source === 'material symbols' ||
      source === 'material-symbols'
    );
  }

  private isCssClassSource(source: string): boolean {
    return source === 'class' || source === 'css' || source === 'primeicons' || source === 'fontawesome' || source === 'mdi';
  }

  private isUrlSource(source: string): boolean {
    return source === 'url' || source === 'image' || source === 'img';
  }

  private runWithDiscardGuard(action: () => void) {
    if (!this.formDirty()) {
      action();
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Descartar cambios',
        message: 'Hay cambios sin guardar.\n\nSi continúas, se perderán.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.formDirty.set(false);
        action();
      }
    );
  }
}