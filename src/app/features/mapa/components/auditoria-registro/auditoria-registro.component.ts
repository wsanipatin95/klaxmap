import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AuditoriaRepository } from 'src/app/features/adm/data-access/auditoria.repository';
import type { AuditoriaGrupo, AuditoriaRegistroResponse } from 'src/app/features/adm/data-access/auditoria.models';

@Component({
  selector: 'app-auditoria-registro',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './auditoria-registro.component.html',
  styleUrl: './auditoria-registro.component.scss',
})
export class AuditoriaRegistroComponent implements OnChanges {
  private repo = inject(AuditoriaRepository);

  @Input({ required: true }) tabla!: string;
  @Input() idRegistro: string | number | null = null;
  @Input() titulo = 'Historial';
  @Input() subtitulo = 'Trazabilidad del registro';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<AuditoriaRegistroResponse | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tabla'] || changes['idRegistro']) {
      this.cargar();
    }
  }

  cargar() {
    if (!this.tabla || this.idRegistro == null || this.idRegistro === '') {
      this.data.set(null);
      this.error.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.repo.historialRegistro(this.tabla, this.idRegistro)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.data.set(resp);
        },
        error: (err) => {
          console.error(err);
          this.error.set(err?.message || 'No se pudo cargar el historial.');
        },
      });
  }

  trackGrupo(_: number, item: AuditoriaGrupo) {
    return item.grupoId;
  }

  shortValue(value: string | null | undefined, max = 140): string {
    if (value == null || value === '') return '—';
    return value.length > max ? value.slice(0, max) + '…' : value;
  }
}