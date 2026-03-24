import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mapa-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-search.component.html',
  styleUrl: './mapa-search.component.scss',
})
export class MapaSearchComponent implements OnChanges {
  @Input() value = '';
  @Input() loading = false;
  @Input() resultCount = 0;
  @Input() currentIndex = -1;
  @Input() placeholder = 'Buscar';

  @Output() searchRequested = new EventEmitter<string>();
  @Output() clearRequested = new EventEmitter<void>();
  @Output() prevRequested = new EventEmitter<void>();
  @Output() nextRequested = new EventEmitter<void>();

  draftValue = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.draftValue = this.value ?? '';
    }
  }

  get counterLabel(): string {
    if (!this.resultCount) {
      return '0 / 0';
    }

    const safeIndex = this.currentIndex >= 0 ? this.currentIndex + 1 : 1;
    return `${safeIndex} / ${this.resultCount}`;
  }

  onDraftChange(value: string) {
    this.draftValue = value;
  }

  submitSearch() {
    this.searchRequested.emit((this.draftValue ?? '').trim());
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitSearch();
    }
  }

  clear() {
    this.draftValue = '';
    this.clearRequested.emit();
  }
}