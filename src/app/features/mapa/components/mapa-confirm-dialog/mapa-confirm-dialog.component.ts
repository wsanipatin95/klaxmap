import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

export type MapaConfirmSeverity = 'danger' | 'warning' | 'info';

export interface MapaConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: MapaConfirmSeverity;
}

@Component({
  selector: 'app-mapa-confirm-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './mapa-confirm-dialog.component.html',
  styleUrl: './mapa-confirm-dialog.component.scss',
})
export class MapaConfirmDialogComponent {
  readonly visible = signal(false);
  readonly title = signal('Confirmar acción');
  readonly message = signal('');
  readonly confirmLabel = signal('Confirmar');
  readonly cancelLabel = signal('Cancelar');
  readonly severity = signal<MapaConfirmSeverity>('warning');

  private onConfirmCallback: (() => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  open(
    config: MapaConfirmDialogConfig,
    onConfirm?: () => void,
    onCancel?: () => void
  ) {
    this.title.set(config.title);
    this.message.set(config.message);
    this.confirmLabel.set(config.confirmLabel ?? 'Confirmar');
    this.cancelLabel.set(config.cancelLabel ?? 'Cancelar');
    this.severity.set(config.severity ?? 'warning');
    this.onConfirmCallback = onConfirm ?? null;
    this.onCancelCallback = onCancel ?? null;
    this.visible.set(true);
  }

  confirm() {
    const callback = this.onConfirmCallback;
    this.closeInternal();
    callback?.();
  }

  cancel() {
    const callback = this.onCancelCallback;
    this.closeInternal();
    callback?.();
  }

  onHide() {
    this.closeInternal(false);
  }

  confirmButtonSeverity(): 'danger' | 'warn' | 'info' | 'primary' {
    if (this.severity() === 'danger') return 'danger';
    if (this.severity() === 'warning') return 'warn';
    if (this.severity() === 'info') return 'info';
    return 'primary';
  }

  iconClass(): string {
    if (this.severity() === 'danger') return 'confirm-icon danger';
    if (this.severity() === 'warning') return 'confirm-icon warning';
    return 'confirm-icon info';
  }

  iconSymbol(): string {
    if (this.severity() === 'danger') return '!';
    if (this.severity() === 'warning') return '!';
    return 'i';
  }

  private closeInternal(resetCallbacks = true) {
    this.visible.set(false);

    if (resetCallbacks) {
      this.onConfirmCallback = null;
      this.onCancelCallback = null;
    }
  }
}