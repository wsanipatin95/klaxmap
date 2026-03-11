import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MapaUiStore, MapaToolMode } from '../../store/mapa-ui.store';

@Component({
  selector: 'app-mapa-toolbar',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './mapa-toolbar.component.html',
  styleUrl: './mapa-toolbar.component.scss',
})
export class MapaToolbarComponent {
  readonly ui = inject(MapaUiStore);

  @Input() selectedName: string | null = null;
  @Input() totalElementos = 0;
  @Input() editSessionActive = false;
  @Input() editSessionDirty = false;
  @Input() editSessionElementName: string | null = null;

  @Output() refreshRequested = new EventEmitter<void>();
  @Output() exportRequested = new EventEmitter<void>();
  @Output() importRequested = new EventEmitter<void>();
  @Output() saveEditRequested = new EventEmitter<void>();
  @Output() cancelEditRequested = new EventEmitter<void>();
  @Output() selectModeRequested = new EventEmitter<void>();
  @Output() editGeometryModeRequested = new EventEmitter<void>();
  @Output() drawPointModeRequested = new EventEmitter<void>();
  @Output() drawLineModeRequested = new EventEmitter<void>();
  @Output() drawPolygonModeRequested = new EventEmitter<void>();

  readonly help = computed(() => {
    const mode = this.ui.toolMode();
    return this.buildHelp(mode);
  });

  isActive(mode: MapaToolMode): boolean {
    return this.ui.toolMode() === mode;
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
      case 'select':
      default:
        return 'Seleccionar elementos';
    }
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