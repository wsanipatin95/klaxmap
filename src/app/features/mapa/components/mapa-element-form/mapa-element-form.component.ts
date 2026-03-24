import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaElemento,
  MapaNodo,
  MapaPatchRequest,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaConfirmDialogComponent } from '../mapa-confirm-dialog/mapa-confirm-dialog.component';

interface ElementFormState {
  nombre: string;
  descripcion: string;
  estado: string;
  visible: boolean;
  idRedNodoFk: number | null;
  idGeoTipoElementoFk: number | null;
}

@Component({
  selector: 'app-mapa-element-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaConfirmDialogComponent],
  templateUrl: './mapa-element-form.component.html',
  styleUrl: './mapa-element-form.component.scss',
})
export class MapaElementFormComponent implements OnChanges {
  @Input() elemento: MapaElemento | null = null;
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() saving = false;

  @Output() submitted = new EventEmitter<MapaPatchRequest>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;

  form: ElementFormState = this.buildFormState(null);
  private initialForm: ElementFormState = this.buildFormState(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['elemento']) {
      this.resetFromElemento(this.elemento);
    }
  }

  onFieldChanged() {
    this.emitDirtyState();
  }

  guardar() {
    if (!this.elemento || this.saving || !this.hasUnsavedChanges()) {
      return;
    }

    const payload: MapaPatchRequest = {
      id: this.elemento.idGeoElemento,
      cambios: {
        nombre: this.form.nombre.trim(),
        descripcion: this.form.descripcion.trim(),
        estado: this.form.estado,
        visible: this.form.visible,
        idRedNodoFk: this.form.idRedNodoFk,
        idGeoTipoElementoFk: this.form.idGeoTipoElementoFk,
      },
    };

    this.confirmDialog?.open(
      {
        title: 'Guardar cambios del elemento',
        message:
          'Se guardarán los cambios de la información del elemento.\n\n¿Deseas continuar?',
        confirmLabel: 'Guardar',
        cancelLabel: 'Seguir editando',
        alternateLabel: 'Descartar',
        severity: 'info',
      },
      () => {
        this.submitted.emit(payload);
      },
      undefined,
      () => {
        this.discardChanges();
      }
    );
  }

  hasUnsavedChanges(): boolean {
    return !this.statesEqual(this.form, this.initialForm);
  }

  discardChanges() {
    this.resetFromElemento(this.elemento);
  }

  markSaved(elemento: MapaElemento | null = this.elemento) {
    this.resetFromElemento(elemento);
  }

  resetFromElemento(elemento: MapaElemento | null) {
    const state = this.buildFormState(elemento);
    this.form = this.cloneState(state);
    this.initialForm = this.cloneState(state);
    this.emitDirtyState();
  }

  private emitDirtyState() {
    this.dirtyChange.emit(this.hasUnsavedChanges());
  }

  private buildFormState(elemento: MapaElemento | null): ElementFormState {
    return {
      nombre: elemento?.nombre ?? '',
      descripcion: elemento?.descripcion ?? '',
      estado: elemento?.estado ?? 'activo',
      visible: elemento?.visible ?? true,
      idRedNodoFk: elemento?.idRedNodoFk ?? null,
      idGeoTipoElementoFk: elemento?.idGeoTipoElementoFk ?? null,
    };
  }

  private cloneState(state: ElementFormState): ElementFormState {
    return {
      nombre: state.nombre,
      descripcion: state.descripcion,
      estado: state.estado,
      visible: state.visible,
      idRedNodoFk: state.idRedNodoFk,
      idGeoTipoElementoFk: state.idGeoTipoElementoFk,
    };
  }

  private statesEqual(a: ElementFormState, b: ElementFormState): boolean {
    return (
      a.nombre === b.nombre &&
      a.descripcion === b.descripcion &&
      a.estado === b.estado &&
      a.visible === b.visible &&
      a.idRedNodoFk === b.idRedNodoFk &&
      a.idGeoTipoElementoFk === b.idGeoTipoElementoFk
    );
  }
}