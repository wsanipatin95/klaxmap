import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import type {
  MapaElementoSaveRequest,
  MapaGeomTipo,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-create-element-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  templateUrl: './mapa-create-element-dialog.component.html',
  styleUrl: './mapa-create-element-dialog.component.scss',
})
export class MapaCreateElementDialogComponent {
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];

  @Output() submitted = new EventEmitter<MapaElementoSaveRequest>();

  visible = signal(false);
  error = signal<string | null>(null);

  private currentWkt: string | null = null;
  private currentGeomTipo: MapaGeomTipo | null = null;

  form: MapaElementoSaveRequest = {
    idRedNodoFk: 0,
    idGeoTipoElementoFk: 0,
    nombre: '',
    descripcion: '',
    estado: 'activo',
    visible: true,
    origen: 'manual',
    wkt: '',
    ordenDibujo: 0,
  };

  open(params: { wkt: string; geomTipo: MapaGeomTipo; nodoId?: number | null }) {
    this.visible.set(true);
    this.error.set(null);

    this.currentWkt = params.wkt;
    this.currentGeomTipo = params.geomTipo;

    const tiposCompatibles = this.tiposFiltrados(params.geomTipo);
    const firstTipo = tiposCompatibles[0]?.idGeoTipoElemento ?? 0;
    const firstNodo = params.nodoId ?? this.nodos[0]?.idRedNodo ?? 0;

    this.form = {
      idRedNodoFk: firstNodo,
      idGeoTipoElementoFk: firstTipo,
      nombre: '',
      descripcion: '',
      estado: 'activo',
      visible: true,
      origen: 'manual',
      wkt: params.wkt,
      ordenDibujo: 0,
    };
  }

  close() {
    this.visible.set(false);
  }

  tiposFiltrados(geomTipo: MapaGeomTipo | null = this.currentGeomTipo): MapaTipoElemento[] {
    if (!geomTipo) return this.tipos;
    return this.tipos.filter(
      (t) => t.geometriaPermitida === geomTipo || t.geometriaPermitida === 'mixed'
    );
  }

  guardar() {
    if (!this.form.idRedNodoFk) {
      this.error.set('Debe seleccionar un nodo');
      return;
    }
    if (!this.form.idGeoTipoElementoFk) {
      this.error.set('Debe seleccionar un tipo');
      return;
    }
    if (!this.form.nombre?.trim()) {
      this.error.set('Debe ingresar un nombre');
      return;
    }
    if (!this.currentWkt) {
      this.error.set('No hay geometría a guardar');
      return;
    }

    this.submitted.emit({
      ...this.form,
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion?.trim() || '',
      wkt: this.currentWkt,
    });

    this.close();
  }
}