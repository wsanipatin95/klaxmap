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
  @Output() valueChange = new EventEmitter<string>();
}