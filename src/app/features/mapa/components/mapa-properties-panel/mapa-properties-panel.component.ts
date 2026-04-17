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
import { MapaElementFormComponent } from '../mapa-element-form/mapa-element-form.component';
import { AuditoriaRegistroComponent } from '../auditoria-registro/auditoria-registro.component';

export type PropertiesPanelTab = 'edicion' | 'historial';

@Component({
  selector: 'app-mapa-properties-panel',
  standalone: true,
  imports: [CommonModule, MapaElementFormComponent, AuditoriaRegistroComponent],
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

  @ViewChild(MapaElementFormComponent) elementForm?: MapaElementFormComponent;

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

  onSaved(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.elementForm?.markSaved(item);
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
    this.elementForm?.markSaved(item);
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

  headerTitle(): string {
    const elemento = this.elemento;
    if (!elemento) {
      return 'Elemento';
    }

    const prefix = this.activeTab() === 'historial' ? 'Historial' : 'Edición';
    const parts = [this.resolveTipoNombre(elemento), elemento.nombre?.trim() || 'Sin nombre'];

    const pointPosition = this.resolvePointPosition(elemento);
    if (pointPosition) {
      parts.push(pointPosition);
    }

    return `${prefix} · ${parts.filter(Boolean).join(' - ')}`;
  }

  headerSubtitle(): string {
    const elemento = this.elemento;
    if (!elemento) {
      return '';
    }

    const estadoLogico = elemento.fecFin ? 'eliminado' : 'activo';
    return `${elemento.geomTipo} · ${estadoLogico}`;
  }

  private resolveTipoNombre(elemento: MapaElemento): string {
    const enriched = String(elemento.tipoNombre ?? '').trim();
    if (enriched) {
      return enriched;
    }

    const tipo = this.tipos.find((item) => item.idGeoTipoElemento === elemento.idGeoTipoElementoFk);
    const local = String(tipo?.nombre ?? '').trim();

    return local || 'Elemento';
  }

  private resolvePointPosition(elemento: MapaElemento): string | null {
    const isPoint = String(elemento.geomTipo ?? '').toLowerCase() === 'point';
    if (!isPoint) {
      return null;
    }

    const value = String(elemento.latLon ?? '').trim();
    return value || null;
  }
}