import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  MapaElemento,
  MapaNodo,
  MapaTipoElemento,
  MapaPatchRequest,
} from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-element-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-element-form.component.html',
  styleUrl: './mapa-element-form.component.scss',
})
export class MapaElementFormComponent {
  @Input() elemento: MapaElemento | null = null;
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];

  @Output() submitted = new EventEmitter<MapaPatchRequest>();

  form = {
    nombre: '',
    descripcion: '',
    estado: 'activo',
    visible: true,
    idRedNodoFk: null as number | null,
    idGeoTipoElementoFk: null as number | null,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['elemento']) {
      const e = this.elemento;
      this.form = {
        nombre: e?.nombre ?? '',
        descripcion: e?.descripcion ?? '',
        estado: e?.estado ?? 'activo',
        visible: e?.visible ?? true,
        idRedNodoFk: e?.idRedNodoFk ?? null,
        idGeoTipoElementoFk: e?.idGeoTipoElementoFk ?? null,
      };
    }
  }

  guardar() {
    if (!this.elemento) return;

    this.submitted.emit({
      id: this.elemento.idGeoElemento,
      cambios: {
        nombre: this.form.nombre,
        descripcion: this.form.descripcion,
        estado: this.form.estado,
        visible: this.form.visible,
        idRedNodoFk: this.form.idRedNodoFk,
        idGeoTipoElementoFk: this.form.idGeoTipoElementoFk,
      },
    });
  }
}