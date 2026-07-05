import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MapaNodo, MapaNodoSaveRequest, MapaPatchRequest } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-nodo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-nodo-form.component.html',
  styleUrl: './mapa-nodo-form.component.scss',
})
export class MapaNodoFormComponent implements OnChanges {
  @Input() nodo: MapaNodo | null = null;
  @Input() nodosPadre: MapaNodo[] = [];
  @Input() modo: 'crear' | 'editar' = 'crear';

  @Output() createSubmitted = new EventEmitter<MapaNodoSaveRequest>();
  @Output() updateSubmitted = new EventEmitter<MapaPatchRequest>();

  error: string | null = null;

  form: MapaNodoSaveRequest = {
    idRedNodoPadreFk: null,
    codigo: '',
    nodo: '',
    descripcion: '',
    tipoNodo: 'carpeta',
    orden: 0,
    visible: true,
    atributos: {},
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodo']) {
      this.error = null;
      if (this.nodo) {
        this.form = {
          idRedNodoPadreFk: this.nodo.idRedNodoPadreFk ?? null,
          codigo: this.nodo.codigo ?? '',
          nodo: this.nodo.nodo,
          descripcion: this.nodo.descripcion ?? '',
          tipoNodo: this.nodo.tipoNodo,
          orden: this.nodo.orden,
          visible: this.nodo.visible,
          atributos: this.nodo.atributos ?? {},
        };
      }
    }
  }

  submit() {
    const nombre = (this.form.nodo ?? '').trim();
    if (!nombre) {
      this.error = 'El nombre del nodo es obligatorio.';
      return;
    }
    if (this.form.orden == null || this.form.orden < 0) {
      this.error = 'El orden debe ser 0 o mayor.';
      return;
    }
    this.error = null;
    this.form.nodo = nombre;

    if (this.modo === 'crear') {
      this.createSubmitted.emit({ ...this.form, nodo: nombre });
      return;
    }

    if (!this.nodo) return;

    this.updateSubmitted.emit({
      id: this.nodo.idRedNodo,
      cambios: {
        idRedNodoPadreFk: this.form.idRedNodoPadreFk,
        codigo: this.form.codigo,
        nodo: nombre,
        descripcion: this.form.descripcion,
        tipoNodo: this.form.tipoNodo,
        orden: this.form.orden,
        visible: this.form.visible,
      },
    });
  }
}
