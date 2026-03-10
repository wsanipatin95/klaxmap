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

  @Output() refreshRequested = new EventEmitter<void>();
  @Output() exportRequested = new EventEmitter<void>();
  @Output() importRequested = new EventEmitter<void>();

  readonly help = computed(() => {
    const mode = this.ui.toolMode();
    return this.buildHelp(mode, this.selectedName);
  });

  private buildHelp(mode: MapaToolMode, selectedName: string | null) {
    switch (mode) {
      case 'draw-point':
        return {
          title: 'Crear punto',
          text: 'Haz clic una vez sobre el mapa para colocar el punto. Luego se abrirá el formulario para completar los datos.',
        };

      case 'draw-line':
        return {
          title: 'Crear línea',
          text: 'Haz clic para iniciar la línea, sigue marcando el recorrido y termina el dibujo para abrir el formulario del elemento.',
        };

      case 'draw-polygon':
        return {
          title: 'Crear polígono',
          text: 'Haz clic en varios puntos para formar el área. Al cerrar la figura se abrirá el formulario del elemento.',
        };

      case 'edit-geometry':
        return {
          title: 'Editar forma',
          text: selectedName
            ? `Estás listo para editar la forma de "${selectedName}". Arrastra sus puntos en el mapa y guarda el cambio.`
            : 'Primero selecciona un elemento y luego modifica su forma en el mapa.',
        };

      case 'move':
        return {
          title: 'Mover mapa',
          text: 'Puedes arrastrar el mapa libremente. Este modo ya no se mostrará al usuario final.',
        };

      case 'select':
      default:
        return {
          title: 'Seleccionar elementos',
          text: selectedName
            ? `Elemento seleccionado: "${selectedName}". Puedes editar sus datos en el panel derecho o usar clic derecho para más acciones.`
            : 'Haz clic sobre un elemento para ver sus datos. También puedes mover el mapa arrastrando normalmente.',
        };
    }
  }

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
}