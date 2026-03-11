import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mapa-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-search.component.html',
  styleUrl: './mapa-search.component.scss',
})
export class MapaSearchComponent {
  @Input() value = '';
  @Input() loading = false;
  @Input() resultCount = 0;
  @Input() placeholder = 'Buscar en mapa...';

  @Output() valueChange = new EventEmitter<string>();
  @Output() clearRequested = new EventEmitter<void>();
}