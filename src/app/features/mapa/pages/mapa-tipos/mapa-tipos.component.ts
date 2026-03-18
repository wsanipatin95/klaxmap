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

@Component({
  selector: 'app-mapa-tipos',
  standalone: true,
  imports: [CommonModule, MapaTipoFormComponent, MapaConfirmDialogComponent],
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

  readonly currentTitle = computed(() =>
    this.mode() === 'crear' ? 'Nuevo tipo de elemento' : 'Editar tipo de elemento'
  );

  constructor() {
    this.cargar();
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
            }
          }
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar tipos');
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
            this.success.set('Tipo creado correctamente.');
            this.cargar();
            this.mode.set('crear');
            this.selected.set(null);
            queueMicrotask(() => {
              this.tipoForm?.resetForNew();
              this.formDirty.set(false);
            });
          },
          error: (err) => {
            console.error(err);
            this.error.set(err?.message || 'No se pudo crear');
          },
        });

      return;
    }

    const current = this.selected();
    if (!current) {
      this.saving.set(false);
      this.error.set('No hay un tipo seleccionado para editar.');
      return;
    }

    this.repo.editar({
      id: current.idGeoTipoElemento,
      cambios: { ...payload },
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('Tipo actualizado correctamente.');
          this.formDirty.set(false);
          this.cargar();
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo editar');
        },
      });
  }

  eliminarActual() {
    const current = this.selected();
    if (!current) return;

    this.confirmDialog?.open(
      {
        title: 'Eliminar tipo de elemento',
        message: `Vas a eliminar el tipo "${current.nombre}".\n\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar tipo',
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
              this.success.set('Tipo eliminado correctamente.');
              this.selected.set(null);
              this.mode.set('crear');
              this.formDirty.set(false);
              this.cargar();
              queueMicrotask(() => {
                this.tipoForm?.resetForNew();
              });
            },
            error: (err) => {
              console.error(err);
              this.error.set(err?.message || 'No se pudo eliminar');
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
        title: 'Descartar cambios pendientes',
        message:
          'Tienes cambios sin guardar en el tipo de elemento.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar cambios',
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

  previewShapeClass(tipo: MapaTipoElemento): string {
    const source = (tipo.iconoFuente ?? '').toLowerCase();
    const shape = (tipo.shapeBase ?? '').toLowerCase();
    const geom = (tipo.geometriaPermitida ?? 'point').toLowerCase();

    if (geom === 'linestring') return 'is-line';
    if (geom === 'polygon') return 'is-polygon';
    if (geom === 'mixed') return 'is-mixed';

    if (source.includes('triangle') || shape.includes('triangle')) return 'is-triangle';
    if (source.includes('target') || shape.includes('target')) return 'is-target';
    if (source.includes('donut') || shape.includes('donut')) return 'is-donut';
    if (shape.includes('square') || shape.includes('rect')) return 'is-square';

    return 'is-point';
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    return {
      '--preview-stroke': tipo.colorStroke || '#2563eb',
      '--preview-fill': tipo.colorFill || '#93c5fd',
      '--preview-stroke-width': `${tipo.strokeWidth ?? 1}`,
    };
  }

  private runWithDiscardGuard(action: () => void) {
    if (!this.formDirty()) {
      action();
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Descartar cambios pendientes',
        message:
          'Tienes cambios sin guardar en el tipo de elemento.\n\nSi continúas, esos cambios se perderán.',
        confirmLabel: 'Descartar cambios',
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