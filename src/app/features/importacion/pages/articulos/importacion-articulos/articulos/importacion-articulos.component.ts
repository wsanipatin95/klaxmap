import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Dialog } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({
  selector: 'app-importacion-articulos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, InputTextModule, Dialog, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './articulos/importacion-articulos.component.html',
  styleUrl: './articulos/importacion-articulos.component.scss',
})
export class ImportacionArticulosComponent {
  private fb = inject(FormBuilder);
  private notify = inject(NotifyService);
  private confirmation = inject(ConfirmationService);

  loading = signal(false);
  dialogVisible = signal(false);
  saving = signal(false);
  q = '';
  page = 0;
  size = 10;
  total = signal(0);
  items = signal<any[]>([]);
  editingId: number | null = null;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    observacion: ['', [Validators.maxLength(1000)]],
  });

  cargar() {
    this.loading.set(true);
    setTimeout(() => {
      this.items.set([]);
      this.total.set(0);
      this.loading.set(false);
    }, 150);
  }

  onLazyLoad(event: any) {
    this.page = event.first ? Math.floor(event.first / event.rows) : 0;
    this.size = event.rows ?? this.size;
    this.cargar();
  }

  nuevo() {
    this.editingId = null;
    this.form.reset({ nombre: '', observacion: '' });
    this.dialogVisible.set(true);
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.warn('Revisa los campos obligatorios');
      return;
    }

    this.confirmation.confirm({
      message: '¿Confirmas guardar los cambios?',
      header: 'Guardar',
      icon: 'pi pi-save',
      acceptLabel: 'Confirmar',
      rejectLabel: 'Seguir editando',
      accept: () => {
        this.saving.set(true);
        setTimeout(() => {
          this.saving.set(false);
          this.notify.success('Guardado');
          this.dialogVisible.set(false);
        }, 300);
      },
    });
  }

  confirmarCerrar() {
    if (!this.form.dirty) {
      this.dialogVisible.set(false);
      return;
    }

    this.confirmation.confirm({
      message: 'Tienes cambios sin guardar. ¿Deseas descartarlos?',
      header: 'Descartar cambios',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Descartar',
      rejectLabel: 'Seguir editando',
      accept: () => this.dialogVisible.set(false),
    });
  }
}
