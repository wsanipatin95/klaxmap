import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';

import type {
  MapaElemento,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaPropertiesTabsComponent } from '../mapa-properties-tabs/mapa-properties-tabs.component';
import { AuditoriaRegistroComponent } from '../auditoria-registro/auditoria-registro.component';

export type PropertiesPanelTab = 'edicion' | 'historial';

@Component({
  selector: 'app-mapa-properties-panel',
  standalone: true,
  imports: [CommonModule, MapaPropertiesTabsComponent, AuditoriaRegistroComponent],
  templateUrl: './mapa-properties-panel.component.html',
  styleUrl: './mapa-properties-panel.component.scss',
})
export class MapaPropertiesPanelComponent implements OnChanges {
  @Input() elemento: MapaElemento | null = null;
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() nodos: MapaNodo[] = [];
  @Input() open = false;
  @Input() requestedTab: PropertiesPanelTab | null = null;

  @Output() saved = new EventEmitter<MapaElemento>();
  @Output() deleted = new EventEmitter<MapaElemento>();
  @Output() restored = new EventEmitter<MapaElemento>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  @ViewChild(MapaPropertiesTabsComponent) tabs?: MapaPropertiesTabsComponent;

  readonly dirty = signal(false);
  readonly activeTab = signal<PropertiesPanelTab>('edicion');
  readonly auditRefreshKey = signal(0);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['elemento']) {
      if (this.elemento) {
        this.activeTab.set(this.requestedTab ?? 'edicion');
      } else {
        this.activeTab.set('edicion');
      }
      return;
    }

    if (changes['requestedTab'] && this.requestedTab) {
      this.activeTab.set(this.requestedTab);
    }
  }

  setTab(tab: PropertiesPanelTab) {
    this.activeTab.set(tab);
  }

  onSaved(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.tabs?.markSaved(item);
    this.auditRefreshKey.update((v) => v + 1);
    this.saved.emit(item);
  }

  onDeleted(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.deleted.emit(item);
  }

  onRestored(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.tabs?.markSaved(item);
    this.auditRefreshKey.update((v) => v + 1);
    this.restored.emit(item);
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