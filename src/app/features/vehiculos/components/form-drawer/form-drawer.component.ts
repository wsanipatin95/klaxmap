import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-vehiculos-form-drawer',
  standalone: true,
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './form-drawer.component.html',
  styleUrl: './form-drawer.component.scss',
})
export class VehiculosFormDrawerComponent {
  @Input() visible = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() dirty = false;
  @Input() saving = false;
  @Input() sizeClass = 'appDrawer appDrawer--lg';

  /**
   * Para UX tipo Jira / workbench:
   * por defecto NO bloquea la pantalla completa.
   */
  @Input() modal = false;
  @Input() dismissible = true;
  @Input() showCloseIcon = true;
  @Input() closeOnEscape = true;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() requestClose = new EventEmitter<void>();
  @Output() requestSave = new EventEmitter<void>();

  onVisibleChange(nextVisible: boolean) {
    this.visibleChange.emit(nextVisible);
  }

  onRequestClose() {
    this.requestClose.emit();
  }

  onRequestSave() {
    this.requestSave.emit();
  }
}