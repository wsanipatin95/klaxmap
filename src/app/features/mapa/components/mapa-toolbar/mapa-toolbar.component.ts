import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MapaUiStore } from '../../store/mapa-ui.store';

@Component({
  selector: 'app-mapa-toolbar',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './mapa-toolbar.component.html',
  styleUrl: './mapa-toolbar.component.scss',
})
export class MapaToolbarComponent {
  readonly ui = inject(MapaUiStore);

  @Output() refreshRequested = new EventEmitter<void>();
  @Output() exportRequested = new EventEmitter<void>();
  @Output() importRequested = new EventEmitter<void>();
}