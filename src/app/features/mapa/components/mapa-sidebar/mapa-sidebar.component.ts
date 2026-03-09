import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MapaNodo, MapaTipoElemento } from '../../data-access/mapa.models';
import { MapaTreeComponent } from '../mapa-tree/mapa-tree.component';
import { MapaSearchComponent } from '../mapa-search/mapa-search.component';

@Component({
  selector: 'app-mapa-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaTreeComponent, MapaSearchComponent],
  templateUrl: './mapa-sidebar.component.html',
  styleUrl: './mapa-sidebar.component.scss',
})
export class MapaSidebarComponent {
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() selectedNodoId: number | null = null;
  @Input() selectedTipoId: number | null = null;
  @Input() searchValue = '';

  @Output() searchChange = new EventEmitter<string>();
  @Output() nodoSelected = new EventEmitter<MapaNodo | null>();
  @Output() tipoSelected = new EventEmitter<number | null>();
}