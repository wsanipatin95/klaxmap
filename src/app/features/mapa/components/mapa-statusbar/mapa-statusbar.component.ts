import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { MapaToolMode } from '../../store/mapa-ui.store';

@Component({
  selector: 'app-mapa-statusbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-statusbar.component.html',
  styleUrl: './mapa-statusbar.component.scss',
})
export class MapaStatusbarComponent {
  @Input() totalElementos = 0;
  @Input() modo: MapaToolMode = 'select';
  @Input() loading = false;
  @Input() selectedName: string | null = null;
}