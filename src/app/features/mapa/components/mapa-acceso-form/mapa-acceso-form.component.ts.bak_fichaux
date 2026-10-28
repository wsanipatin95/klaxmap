import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MapaAccesosRepository } from '../../data-access/acceso/mapa-accesos.repository';
import type { MapaAcceso, MapaAccesoHorario } from '../../data-access/mapa.models';

/**
 * Editor de una ficha de acceso.
 *
 * Vive como componente propio y NO dentro de una pantalla porque se usa en dos lados:
 * el repositorio de Accesos y el modal del elemento en el mapa, donde hace falta poder
 * crear una ficha al vuelo sin salir de lo que estabas haciendo. Si lo hubiera copiado
 * en los dos, en un mes estarian desincronizados — es exactamente lo que paso con los
 * dos olt-config.ts.
 */
@Component({
  selector: 'app-mapa-acceso-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-acceso-form.component.html',
  styleUrl: './mapa-acceso-form.component.scss',
})
export class MapaAccesoFormComponent {
  private repo = inject(MapaAccesosRepository);

  readonly DIAS = [
    { n: 1, corto: 'Lun' },
    { n: 2, corto: 'Mar' },
    { n: 3, corto: 'Mié' },
    { n: 4, corto: 'Jue' },
    { n: 5, corto: 'Vie' },
    { n: 6, corto: 'Sáb' },
    { n: 7, corto: 'Dom' },
  ];

  /** Ficha a editar. null = una nueva. */
  @Input() set acceso(v: MapaAcceso | null) {
    // Copia PROFUNDA de los horarios: si se edita el objeto que vino de la lista y
    // despues se cancela, la tabla de atras queda mostrando cambios que nunca se guardaron.
    this.modelo = v
      ? { ...v, horarios: (v.horarios ?? []).map((h) => ({ ...h })) }
      : { nombre: '', horarios: [] };
    this.error.set(null);
  }

  @Output() guardado = new EventEmitter<MapaAcceso>();
  @Output() cancelado = new EventEmitter<void>();

  modelo: MapaAcceso = { nombre: '', horarios: [] };
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  agregarTramo(dia: number) {
    this.modelo.horarios = [...(this.modelo.horarios ?? []), { dia, desde: '08:00', hasta: '17:00' }];
  }

  quitarTramo(h: MapaAccesoHorario) {
    this.modelo.horarios = (this.modelo.horarios ?? []).filter((x) => x !== h);
  }

  tramosDe(dia: number): MapaAccesoHorario[] {
    return (this.modelo.horarios ?? []).filter((h) => h.dia === dia);
  }

  guardar() {
    if (!this.modelo.nombre?.trim()) {
      this.error.set('Ponle un nombre al acceso.');
      return;
    }
    // Un tramo que empieza y termina a la misma hora casi siempre es un dedazo. Se avisa
    // en vez de guardar algo que despues miente sobre cuando se puede entrar.
    if ((this.modelo.horarios ?? []).some((h) => h.desde === h.hasta)) {
      this.error.set('Hay un tramo que empieza y termina a la misma hora. Revísalo.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.repo
      .guardar(this.modelo)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (r: any) => this.guardado.emit(r?.data ?? r),
        error: (e) => this.error.set(e?.message || 'No se pudo guardar'),
      });
  }
}
