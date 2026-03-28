import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-vehiculos-workbench-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workbench-shell.component.html',
  styleUrl: './workbench-shell.component.scss',
})
export class VehiculosWorkbenchShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() selectionTitle = 'Detalle';
  @Input() compact = false;
}
