import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { RedRepository } from '../../data-access/red.repository';
import type { RedIndicador } from '../../data-access/red.models';
import { NotifyService } from 'src/app/core/services/notify.service';

interface GrupoIndicadores {
  grupo: string;
  items: RedIndicador[];
}

@Component({
  selector: 'app-red-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './red-dashboard.component.html',
  styleUrl: './red-dashboard.component.scss',
})
export class RedDashboardComponent {
  private repo = inject(RedRepository);
  private notify = inject(NotifyService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly indicadores = signal<RedIndicador[]>([]);

  readonly grupos = computed<GrupoIndicadores[]>(() => {
    const m = new Map<string, RedIndicador[]>();
    for (const it of this.indicadores()) {
      const arr = m.get(it.grupo) ?? [];
      arr.push(it);
      m.set(it.grupo, arr);
    }
    return Array.from(m, ([grupo, items]) => ({ grupo, items }));
  });

  constructor() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);

    this.repo.indicadores()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.indicadores.set(data ?? []),
        error: (e) => {
          const msg = e?.message ?? 'No se pudieron cargar los indicadores';
          this.error.set(msg);
          this.notify.error('Error al cargar', msg);
        },
      });
  }
}
