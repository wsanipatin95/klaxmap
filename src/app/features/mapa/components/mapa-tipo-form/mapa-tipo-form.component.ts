import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaTipoElemento,
  MapaTipoElementoSaveRequest,
  MapaPatchRequest,
} from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-tipo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-tipo-form.component.html',
  styleUrl: './mapa-tipo-form.component.scss',
})
export class MapaTipoFormComponent {
  @Input() tipo: MapaTipoElemento | null = null;
  @Input() modo: 'crear' | 'editar' = 'crear';

  @Output() createSubmitted = new EventEmitter<MapaTipoElementoSaveRequest>();
  @Output() updateSubmitted = new EventEmitter<MapaPatchRequest>();

  form: MapaTipoElementoSaveRequest = {
    codigo: '',
    nombre: '',
    descripcion: '',
    geometriaPermitida: 'point',
    snapping: false,
    conectable: false,
    maxPuertosDefault: 0,
    permiteImportAuto: true,
    requiereRevision: false,
    prioridadClasificacion: 100,
    activo: true,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipo'] && this.tipo) {
      this.form = {
        codigo: this.tipo.codigo,
        nombre: this.tipo.nombre,
        descripcion: this.tipo.descripcion ?? '',
        icono: this.tipo.icono ?? '',
        iconoFuente: this.tipo.iconoFuente ?? '',
        iconoClase: this.tipo.iconoClase ?? '',
        shapeBase: this.tipo.shapeBase ?? '',
        colorFill: this.tipo.colorFill ?? '',
        colorStroke: this.tipo.colorStroke ?? '',
        colorTexto: this.tipo.colorTexto ?? '',
        strokeWidth: this.tipo.strokeWidth,
        zIndex: this.tipo.zIndex,
        tamanoIcono: this.tipo.tamanoIcono ?? null,
        geometriaPermitida: this.tipo.geometriaPermitida,
        snapping: this.tipo.snapping,
        conectable: this.tipo.conectable,
        maxPuertosDefault: this.tipo.maxPuertosDefault,
        permiteImportAuto: this.tipo.permiteImportAuto,
        requiereRevision: this.tipo.requiereRevision,
        prioridadClasificacion: this.tipo.prioridadClasificacion,
        activo: this.tipo.activo,
        atributos: this.tipo.atributos ?? {},
      };
    }
  }

  submit() {
    if (this.modo === 'crear') {
      this.createSubmitted.emit(this.form);
      return;
    }

    if (!this.tipo) return;

    this.updateSubmitted.emit({
      id: this.tipo.idGeoTipoElemento,
      cambios: { ...this.form },
    });
  }
}