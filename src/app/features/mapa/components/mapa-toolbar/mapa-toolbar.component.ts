import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { MapaSidebarMode, MapaToolMode, MapaUiStore } from '../../store/mapa-ui.store';
import {
  BasemapKey,
  MAPA_BASEMAP_OPTIONS,
  MapaBasemapOption,
  getMapaBasemapLabel,
} from '../../models/mapa-basemap.models';
import { SessionStore } from '../../../seg/store/session.store';

@Component({
  selector: 'app-mapa-toolbar',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './mapa-toolbar.component.html',
  styleUrl: './mapa-toolbar.component.scss',
})
export class MapaToolbarComponent {
  readonly ui = inject(MapaUiStore);
  private readonly sessionStore = inject(SessionStore);

  @Input() selectedName: string | null = null;
  @Input() totalElementos = 0;
  @Input() editSessionActive = false;
  @Input() editSessionDirty = false;
  @Input() editSessionElementName: string | null = null;
  @Input() sidebarMode: MapaSidebarMode = 'expanded';
  @Input() basemap: BasemapKey = 'osm';
  @Input() basemapOptions: ReadonlyArray<MapaBasemapOption> = MAPA_BASEMAP_OPTIONS;
  @Input() labelsVisible = true;
  @Input() locatingMyPosition = false;

  @Output() refreshRequested = new EventEmitter<void>();
  @Output() exportRequested = new EventEmitter<void>();
  @Output() importRequested = new EventEmitter<void>();
  @Output() manageTiposRequested = new EventEmitter<void>();
  @Output() saveEditRequested = new EventEmitter<void>();
  @Output() cancelEditRequested = new EventEmitter<void>();
  @Output() selectModeRequested = new EventEmitter<void>();
  @Output() editGeometryModeRequested = new EventEmitter<void>();
  @Output() drawPointModeRequested = new EventEmitter<void>();
  @Output() drawLineModeRequested = new EventEmitter<void>();
  @Output() drawPolygonModeRequested = new EventEmitter<void>();
  @Output() measureModeRequested = new EventEmitter<void>();
  @Output() sidebarToggleRequested = new EventEmitter<void>();
  @Output() sidebarCompactRequested = new EventEmitter<void>();
  @Output() myLocationRequested = new EventEmitter<void>();
  @Output() basemapSelectRequested = new EventEmitter<BasemapKey>();
  @Output() labelsToggleRequested = new EventEmitter<void>();

  basemapMenuOpen = false;

  readonly editarTipoElemento = computed(() =>
    this.sessionStore.hasCompanyPrivilege('etm_red_red')
  );

  readonly editarElemento = computed(() =>
    this.sessionStore.hasCompanyPrivilege('eem_red_red')
  );

  readonly help = computed(() => {
    const mode = this.ui.toolMode();
    return this.buildHelp(mode);
  });

  @HostListener('document:click')
  closeBasemapMenuFromDocument() {
    this.basemapMenuOpen = false;
  }

  isActive(mode: MapaToolMode): boolean {
    return this.ui.toolMode() === mode;
  }

  get sidebarHidden(): boolean {
    return this.sidebarMode === 'hidden';
  }

  get sidebarCompact(): boolean {
    return this.sidebarMode === 'compact';
  }

  get basemapLabel(): string {
    return getMapaBasemapLabel(this.basemap);
  }

  get labelsTitle(): string {
    return this.labelsVisible ? 'Ocultar etiquetas inteligentes' : 'Mostrar etiquetas inteligentes';
  }

  get myLocationTitle(): string {
    return this.locatingMyPosition ? 'Obteniendo ubicación actual...' : 'Ir a mi ubicación';
  }

  sidebarToggleTitle(): string {
    return this.sidebarHidden ? 'Mostrar panel lateral' : 'Ocultar panel lateral';
  }

  sidebarCompactTitle(): string {
    return this.sidebarCompact ? 'Expandir panel lateral' : 'Comprimir panel lateral';
  }

  modeName(mode: MapaToolMode): string {
    switch (mode) {
      case 'draw-point':
        return 'Crear punto';
      case 'draw-line':
        return 'Crear línea';
      case 'draw-polygon':
        return 'Crear polígono';
      case 'edit-geometry':
        return 'Editar forma';
      case 'move':
        return 'Mover mapa';
      case 'measure':
        return 'Medir distancia';
      case 'select':
      default:
        return 'Seleccionar elementos';
    }
  }

  toggleBasemapMenu(event: Event) {
    event.stopPropagation();
    this.basemapMenuOpen = !this.basemapMenuOpen;
  }

  selectBasemap(key: BasemapKey, event?: Event) {
    event?.stopPropagation();
    this.basemapMenuOpen = false;
    this.basemapSelectRequested.emit(key);
  }

  onLabelsToggle() {
    this.labelsToggleRequested.emit();
  }

  onMyLocationRequested() {
    if (this.locatingMyPosition) {
      return;
    }

    this.myLocationRequested.emit();
  }

  private buildHelp(mode: MapaToolMode) {
    if (this.editSessionActive) {
      return {
        title: 'Edición de forma activa',
        text: this.editSessionDirty
          ? `Estás editando "${this.editSessionElementName || 'elemento'}". Guarda para aplicar o cancela para descartar.`
          : `Estás editando "${this.editSessionElementName || 'elemento'}". Haz cambios en la geometría y luego guarda o cancela.`,
      };
    }

    switch (mode) {
      case 'draw-point':
        return {
          title: 'Crear punto',
          text: 'Haz clic una vez sobre el mapa para colocar el punto. Luego se abrirá el formulario.',
        };

      case 'draw-line':
        return {
          title: 'Crear línea',
          text: 'Haz clic para iniciar, sigue marcando puntos y termina con doble clic.',
        };

      case 'draw-polygon':
        return {
          title: 'Crear polígono',
          text: 'Haz clic en varios puntos para formar el área y cierra la figura para terminar.',
        };

      case 'edit-geometry':
        return {
          title: 'Editar forma',
          text: this.selectedName
            ? `Elemento listo para edición: "${this.selectedName}".`
            : 'Primero selecciona un elemento para editar su forma.',
        };

      case 'measure':
        return {
          title: 'Medir distancia',
          text: 'Haz clic en el mapa para empezar, sigue marcando puntos y termina con doble clic.',
        };

      case 'select':
      default:
        return {
          title: 'Seleccionar elementos',
          text: this.selectedName
            ? `Elemento seleccionado: "${this.selectedName}".`
            : 'Haz clic sobre un elemento para verlo o editarlo.',
        };
    }
  }
}
