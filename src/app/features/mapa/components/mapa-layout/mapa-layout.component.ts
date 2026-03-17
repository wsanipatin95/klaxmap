import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-mapa-layout',
  standalone: true,
  templateUrl: './mapa-layout.component.html',
  styleUrl: './mapa-layout.component.scss',
})
export class MapaLayoutComponent {
  @Input() propertiesOpen = false;
}