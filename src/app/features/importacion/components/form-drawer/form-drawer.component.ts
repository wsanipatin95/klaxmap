import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-importacion-form-drawer',
  standalone: true,
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './form-drawer.component.html',
  styleUrl: './form-drawer.component.scss',
})
export class ImportacionFormDrawerComponent {
  @Input() visible = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() dirty = false;
  @Input() saving = false;
  @Input() sizeClass = 'appDrawer appDrawer--lg';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() requestClose = new EventEmitter<void>();
  @Output() requestSave = new EventEmitter<void>();
}
