import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';

import type {
  MapaElemento,
  MapaNodo,
  MapaPatchRequest,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';
import { MapaPropertiesTabsComponent } from '../mapa-properties-tabs/mapa-properties-tabs.component';
import { AuditoriaRegistroComponent } from '../auditoria-registro/auditoria-registro.component';

type PropertiesPanelTab = 'edicion' | 'historial';

@Component({
  selector: 'app-mapa-properties-panel',
  standalone: true,
  imports: [CommonModule, MapaPropertiesTabsComponent, AuditoriaRegistroComponent],
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

  @ViewChild(MapaPropertiesTabsComponent) tabs?: MapaPropertiesTabsComponent;

  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly statusKind = signal<'success' | 'error' | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly activeTab = signal<PropertiesPanelTab>('edicion');
  readonly auditRefreshKey = signal(0);

  setTab(tab: PropertiesPanelTab) {
    this.activeTab.set(tab);
  }

  guardar(payload: MapaPatchRequest) {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.statusKind.set(null);
    this.statusMessage.set(null);

    this.repo.editar(payload).subscribe({
      next: (resp) => {
        this.saving.set(false);
        this.dirty.set(false);
        this.dirtyChange.emit(false);
        this.tabs?.markSaved(resp.data);
        this.statusKind.set('success');
        this.statusMessage.set('Los cambios se guardaron correctamente.');
        this.auditRefreshKey.update(v => v + 1);
        this.saved.emit(resp.data);
      },
      error: (err) => {
        console.error(err);
        this.saving.set(false);
        this.statusKind.set('error');
        this.statusMessage.set(err?.message || 'No se pudieron guardar los cambios.');
      },
    });
  }

  eliminar() {
    if (!this.elemento || this.saving()) return;

    this.repo.eliminar(this.elemento.idGeoElemento).subscribe({
      next: () => this.deleted.emit(this.elemento!.idGeoElemento),
      error: (err) => console.error(err),
    });
  }

  requestClose() {
    if (this.saving()) {
      return;
    }

    this.closeRequested.emit();
  }

  onOverlayClick() {
    if (this.saving()) {
      return;
    }

    this.requestClose();
  }

  onPanelClick(event: MouseEvent) {
    event.stopPropagation();
  }

  onDirtyStateChanged(isDirty: boolean) {
    this.dirty.set(isDirty);
    this.dirtyChange.emit(isDirty);

    if (isDirty && this.statusKind() === 'success') {
      this.statusKind.set(null);
      this.statusMessage.set(null);
    }
  }
}