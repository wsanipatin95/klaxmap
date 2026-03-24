import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild, signal } from '@angular/core';
import type { MapaElemento, MapaNodo, MapaPatchRequest, MapaTipoElemento } from '../../data-access/mapa.models';
import { MapaElementFormComponent } from '../mapa-element-form/mapa-element-form.component';

@Component({
  selector: 'app-mapa-properties-tabs',
  standalone: true,
  imports: [CommonModule, MapaElementFormComponent],
  templateUrl: './mapa-properties-tabs.component.html',
  styleUrl: './mapa-properties-tabs.component.scss',
})
export class MapaPropertiesTabsComponent {
  @Input() elemento: MapaElemento | null = null;
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() nodos: MapaNodo[] = [];
  @Input() saving = false;

  @Output() submitted = new EventEmitter<MapaPatchRequest>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  @ViewChild(MapaElementFormComponent) elementForm?: MapaElementFormComponent;

  readonly tab = signal<'datos' | 'meta' | 'kml'>('datos');

  setTab(tab: 'datos' | 'meta' | 'kml') {
    this.tab.set(tab);
  }

  onDirtyChange(dirty: boolean) {
    this.dirtyChange.emit(dirty);
  }

  markSaved(updated: MapaElemento | null) {
    this.elementForm?.markSaved(updated);
  }

  discardPendingChanges() {
    this.elementForm?.discardChanges();
  }

  hasUnsavedChanges(): boolean {
    return this.elementForm?.hasUnsavedChanges() ?? false;
  }

  jsonPretty(value: unknown): string {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return '{}';
    }
  }

  isEmptyObject(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return true;
    }

    return Object.keys(value as Record<string, unknown>).length === 0;
  }
}