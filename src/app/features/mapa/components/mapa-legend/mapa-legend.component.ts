import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { MapaLegendItem } from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-legend',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-legend.component.html',
  styleUrl: './mapa-legend.component.scss',
})
export class MapaLegendComponent {
  @Input() items: MapaLegendItem[] = [];

  hasImage(iconoFuente?: string | null): boolean {
    if (!iconoFuente) return false;
    return iconoFuente.includes('/') || iconoFuente.includes('.png') || iconoFuente.includes('.svg');
  }
}