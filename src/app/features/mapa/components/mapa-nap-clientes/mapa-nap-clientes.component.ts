import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { MapaNapClientes } from '../../data-access/mapa.models';

/**
 * Modal de "clientes de una NAP" en KlaxMap.
 * Cabecera: tipo de splitter (1/8 o 1/16, editable) + contador de puertos (ocupados/total, disponibles).
 * Cuerpo: cada cliente asignado en un solo renglón (puerto · cliente · documento · estado).
 *
 * El splitter no vive en una tabla nueva: se guarda en el atributo `splitter` del propio elemento
 * (kxt_geo_elemento.atributos). Al cambiarlo, el padre persiste con el PATCH de edición y recarga.
 */
@Component({
  selector: 'app-mapa-nap-clientes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-nap-clientes.component.html',
  styleUrl: './mapa-nap-clientes.component.scss',
})
export class MapaNapClientesComponent {
  @Input() open = false;
  @Input() titulo = 'NAP';
  @Input() data: MapaNapClientes | null = null;
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  /** Permiso para cambiar el tipo de splitter (mismo que editar red). */
  @Input() puedeEditar = false;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() splitterChange = new EventEmitter<string>();

  close() {
    this.closeRequested.emit();
  }

  onOverlayClick() {
    this.close();
  }

  onDialogClick(event: MouseEvent) {
    event.stopPropagation();
  }

  seleccionarSplitter(valor: string) {
    if (this.saving || this.loading) return;
    if (!this.puedeEditar) return;
    if (this.data?.splitter === valor) return;
    this.splitterChange.emit(valor);
  }

  estadoClase(estado: string | null | undefined): string {
    const t = String(estado || '').toLowerCase();
    if (t.includes('activ')) return 'is-activo';
    if (t.includes('suspend') || t.includes('cort')) return 'is-suspendido';
    if (t.includes('anul') || t.includes('retir') || t.includes('baja')) return 'is-baja';
    return 'is-otro';
  }

  estadoLabel(estado: string | null | undefined): string {
    const t = String(estado || '').trim();
    return t || 'Sin estado';
  }
}
