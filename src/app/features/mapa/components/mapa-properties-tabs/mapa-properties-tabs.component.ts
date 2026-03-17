import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
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

  @Output() submitted = new EventEmitter<MapaPatchRequest>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  readonly tab = signal<'propiedades' | 'metadatos' | 'kml'>('propiedades');

  setTab(tab: 'propiedades' | 'metadatos' | 'kml') {
    this.tab.set(tab);
  }

  onDirtyChange(dirty: boolean) {
    this.dirtyChange.emit(dirty);
  }

  jsonPretty(value: unknown): string {
    try {
      return JSON.stringify(value ?? {}, null, 2);
    } catch {
      return '{}';
    }
  }
}