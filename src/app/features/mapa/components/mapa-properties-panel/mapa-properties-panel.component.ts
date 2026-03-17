import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';

import type {
  MapaElemento,
  MapaNodo,
  MapaPatchRequest,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';
import { MapaPropertiesTabsComponent } from '../mapa-properties-tabs/mapa-properties-tabs.component';

@Component({
  selector: 'app-mapa-properties-panel',
  standalone: true,
  imports: [CommonModule, ButtonModule, MapaPropertiesTabsComponent],
  templateUrl: './mapa-properties-panel.component.html',
  styleUrl: './mapa-properties-panel.component.scss',
})
export class MapaPropertiesPanelComponent {
  private readonly repo = inject(MapaElementosRepository);

  @Input() elemento: MapaElemento | null = null;
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() nodos: MapaNodo[] = [];
  @Input() open = false;

  @Output() saved = new EventEmitter<MapaElemento>();
  @Output() deleted = new EventEmitter<number>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  readonly dirty = signal(false);

  guardar(payload: MapaPatchRequest) {
    this.repo.editar(payload).subscribe({
      next: (resp) => {
        this.dirty.set(false);
        this.dirtyChange.emit(false);
        this.saved.emit(resp.data);
      },
      error: (err) => console.error(err),
    });
  }

  eliminar() {
    if (!this.elemento) return;

    this.repo.eliminar(this.elemento.idGeoElemento).subscribe({
      next: () => this.deleted.emit(this.elemento!.idGeoElemento),
      error: (err) => console.error(err),
    });
  }

  requestClose() {
    this.closeRequested.emit();
  }

  onOverlayClick() {
    this.requestClose();
  }

  onPanelClick(event: MouseEvent) {
    event.stopPropagation();
  }

  onDirtyStateChanged(isDirty: boolean) {
    this.dirty.set(isDirty);
    this.dirtyChange.emit(isDirty);
  }
}