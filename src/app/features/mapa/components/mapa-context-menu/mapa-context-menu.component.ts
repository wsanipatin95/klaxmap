import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { MapaElemento } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-context-menu',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './mapa-context-menu.component.html',
  styleUrl: './mapa-context-menu.component.scss',
})
export class MapaContextMenuComponent {
  @Input() elemento: MapaElemento | null = null;

  @Output() editRequested = new EventEmitter<MapaElemento>();
  @Output() deleteRequested = new EventEmitter<MapaElemento>();
  @Output() centerRequested = new EventEmitter<MapaElemento>();
}