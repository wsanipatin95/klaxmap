import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MapaChromeService } from '../../../../core/services/mapa-chrome.service';
import { MapaGeoSearchResult } from '../../models/mapa-geo-search.models';

@Component({
  selector: 'app-mapa-geo-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-geo-search.component.html',
  styleUrl: './mapa-geo-search.component.scss',
})
export class MapaGeoSearchComponent implements OnChanges {
  readonly mapaChrome = inject(MapaChromeService);

  @Input() value = '';
  @Input() loading = false;
  @Input() results: MapaGeoSearchResult[] = [];
  @Input() hasSearched = false;
  @Input() errorMessage: string | null = null;

  @Output() searchRequested = new EventEmitter<string>();
  @Output() clearRequested = new EventEmitter<void>();
  @Output() resultSelected = new EventEmitter<MapaGeoSearchResult>();

  draftValue = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.draftValue = this.value ?? '';
    }
  }

  get showPanel(): boolean {
    return !!(
      this.loading ||
      this.errorMessage ||
      this.results.length ||
      this.hasSearched
    );
  }

  get showEmptyState(): boolean {
    return this.hasSearched && !this.loading && !this.errorMessage && !this.results.length;
  }

  get chromeToggleTitle(): string {
    return this.mapaChrome.hidden() ? 'Mostrar menú principal' : 'Ocultar menú principal';
  }

  onDraftChange(value: string) {
    this.draftValue = value;
  }

  submitSearch(event?: Event) {
    event?.preventDefault();
    this.searchRequested.emit((this.draftValue || '').trim());
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

  selectResult(item: MapaGeoSearchResult) {
    this.resultSelected.emit(item);
  }

  toggleMapaChrome() {
    this.mapaChrome.toggle();
  }
}
