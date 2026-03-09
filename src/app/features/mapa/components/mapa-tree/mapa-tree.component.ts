import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { MapaNodo } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-tree.component.html',
  styleUrl: './mapa-tree.component.scss',
})
export class MapaTreeComponent {
  @Input() nodos: MapaNodo[] = [];
  @Input() selectedNodoId: number | null = null;
  @Output() selected = new EventEmitter<MapaNodo | null>();

  get ordered(): MapaNodo[] {
    return [...this.nodos].sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      return (a.orden ?? 0) - (b.orden ?? 0);
    });
  }
}