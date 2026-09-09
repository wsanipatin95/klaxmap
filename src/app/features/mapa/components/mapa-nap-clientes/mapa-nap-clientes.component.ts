import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';

import type { MapaNapClientes } from '../../data-access/mapa.models';

/**
 * Modal de "clientes de una NAP" en KlaxMap.
 * Cabecera: tipo de splitter (1/8 o 1/16) + contador de puertos (ocupados/total, disponibles).
 * Cuerpo: cada cliente asignado en un solo renglón (puerto · cliente · documento · estado).
 *
 * El splitter no vive en una tabla nueva: se guarda en el atributo `splitter` del propio elemento
 * (kxt_geo_elemento.atributos). Al cambiarlo, el padre persiste con el PATCH de edición (queda auditado)
 * y recarga.
 *
 * Bloqueo (set-once): en cuanto la NAP tiene un splitter guardado queda BLOQUEADA (solo lectura).
 * Para cambiarlo — por ejemplo si se eligió la NAP equivocada — hay que "Desbloquear", acción que
 * solo aparece a quien tiene el privilegio (puedeDesbloquear). El desbloqueo es temporal: se cierra
 * el modal o se guarda un cambio y vuelve a quedar bloqueada.
 */
@Component({
  selector: 'app-mapa-nap-clientes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-nap-clientes.component.html',
  styleUrl: './mapa-nap-clientes.component.scss',
})
export class MapaNapClientesComponent implements OnChanges {
  @Input() open = false;
  @Input() titulo = 'NAP';
  @Input() data: MapaNapClientes | null = null;
  @Input() loading = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  /** Permiso para elegir/cambiar el tipo de splitter (mismo que editar red). */
  @Input() puedeEditar = false;
  /** La NAP ya tiene un splitter fijado (set-once) => solo lectura salvo desbloqueo. */
  @Input() bloqueado = false;
  /** Privilegio para desbloquear una NAP ya bloqueada y corregir el splitter. */
  @Input() puedeDesbloquear = false;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() splitterChange = new EventEmitter<string>();

  /** Desbloqueo temporal en curso (solo mientras el modal está abierto). */
  desbloqueado = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Cada vez que se abre el modal (o cambia la NAP) arrancamos bloqueado de nuevo.
    if (changes['open'] && this.open) {
      this.desbloqueado = false;
    }
    if (changes['data']) {
      this.desbloqueado = false;
    }
  }

  /** ¿Se pueden tocar los botones de splitter ahora mismo? */
  get editable(): boolean {
    if (!this.puedeEditar) return false;
    if (this.saving || this.loading) return false;
    // Si nunca se eligió (no bloqueado) se puede fijar; si está bloqueado, solo tras desbloquear.
    return !this.bloqueado || this.desbloqueado;
  }

  /** ¿Mostrar el botón "Desbloquear"? */
  get puedeMostrarDesbloqueo(): boolean {
    return this.bloqueado && !this.desbloqueado && this.puedeDesbloquear && !this.saving;
  }

  desbloquear() {
    if (!this.puedeDesbloquear || this.saving) return;
    this.desbloqueado = true;
  }

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
    if (!this.editable) return;
    if (this.data?.splitter === valor) return;
    // Al confirmar un cambio volvemos a bloquear: el padre persiste y recarga.
    this.desbloqueado = false;
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
