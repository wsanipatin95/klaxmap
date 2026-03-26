import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule  } from 'primeng/textarea';
import { ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({
  selector: 'app-importacion-articulos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TextareaModule ,
    DialogModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './importacion-articulos.component.html',
  styleUrl: './importacion-articulos.component.scss',
})
export class ImportacionArticulosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotifyService);
  private readonly confirmation = inject(ConfirmationService);

  readonly loading = signal(false);
  readonly dialogVisible = signal(false);
  readonly saving = signal(false);
  readonly total = signal(0);
  readonly items = signal<any[]>([]);
  editingId: number | null = null;
  q = '';
  page = 0;
  size = 10;

  readonly form = this.fb.group({
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
    this.page = event?.first ? Math.floor(event.first / event.rows) : 0;
    this.size = event?.rows ?? this.size;
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
