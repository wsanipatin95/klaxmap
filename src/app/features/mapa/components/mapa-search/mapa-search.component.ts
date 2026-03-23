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
  @Input() currentIndex = -1;
  @Input() placeholder = 'Buscar';

  @Output() valueChange = new EventEmitter<string>();
  @Output() clearRequested = new EventEmitter<void>();
  @Output() prevRequested = new EventEmitter<void>();
  @Output() nextRequested = new EventEmitter<void>();

  get counterLabel(): string {
    if (!this.resultCount) {
      return '0 / 0';
    }

    const safeIndex = this.currentIndex >= 0 ? this.currentIndex + 1 : 1;
    return `${safeIndex} / ${this.resultCount}`;
  }

  onInput(value: string) {
    this.valueChange.emit(value);
  }

  clear() {
    this.clearRequested.emit();
  }
}