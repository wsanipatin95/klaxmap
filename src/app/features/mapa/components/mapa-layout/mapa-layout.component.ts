import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MapaSidebarMode } from '../../store/mapa-ui.store';

@Component({
  selector: 'app-mapa-layout',
  standalone: true,
  templateUrl: './mapa-layout.component.html',
  styleUrl: './mapa-layout.component.scss',
})
export class MapaLayoutComponent {
  @Input() propertiesOpen = false;
  @Input() sidebarMode: MapaSidebarMode = 'expanded';

  @Output() sidebarBackdropRequested = new EventEmitter<void>();
}
