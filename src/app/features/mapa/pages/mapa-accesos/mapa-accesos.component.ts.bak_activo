import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MapaAccesosRepository } from '../../data-access/acceso/mapa-accesos.repository';
import type { MapaAcceso, MapaAccesoHorario } from '../../data-access/mapa.models';

/**
 * Repositorio de ACCESOS a sitios.
 *
 * Por que es una pantalla y no un campo del nodo: el mismo conserje abre varias
 * casetas. Si el dato vive en cada nodo, el dia que le cambia el telefono hay que
 * corregirlo en todos — y siempre queda uno sin corregir. Aca se corrige una vez.
 */
@Component({
  selector: 'app-mapa-accesos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-accesos.component.html',
  styleUrl: './mapa-accesos.component.scss',
})
export class MapaAccesosComponent {
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

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  msg = signal<string | null>(null);
  accesos = signal<MapaAcceso[]>([]);
  busqueda = '';
  edit = signal<MapaAcceso | null>(null);

  constructor() {
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.repo
      .listar(this.busqueda)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.accesos.set(data ?? []),
        error: (e) => this.error.set(e?.message || 'No se pudieron cargar los accesos'),
      });
  }

  nuevo() {
    this.edit.set({ nombre: '', horarios: [] });
  }

  abrir(a: MapaAcceso) {
    // Copia profunda de los horarios: si se edita el objeto de la lista y despues
    // se cancela, la tabla de atras queda mostrando cambios que nunca se guardaron.
    this.edit.set({ ...a, horarios: (a.horarios ?? []).map((h) => ({ ...h })) });
  }

  cerrar() {
    this.edit.set(null);
    this.msg.set(null);
  }

  agregarTramo(dia: number) {
    const a = this.edit();
    if (!a) return;
    a.horarios = [...(a.horarios ?? []), { dia, desde: '08:00', hasta: '17:00' }];
    this.edit.set({ ...a });
  }

  quitarTramo(h: MapaAccesoHorario) {
    const a = this.edit();
    if (!a) return;
    a.horarios = (a.horarios ?? []).filter((x) => x !== h);
    this.edit.set({ ...a });
  }

  tramosDe(dia: number): MapaAccesoHorario[] {
    return (this.edit()?.horarios ?? []).filter((h) => h.dia === dia);
  }

  guardar() {
    const a = this.edit();
    if (!a) return;
    if (!a.nombre?.trim()) {
      this.error.set('Ponle un nombre al acceso.');
      return;
    }
    // Un tramo al revés (sale a las 17 y entra a las 8) casi siempre es un dedazo,
    // no un turno nocturno. Se avisa en vez de guardar algo que después miente.
    const sospechoso = (a.horarios ?? []).find((h) => h.desde === h.hasta);
    if (sospechoso) {
      this.error.set('Hay un tramo que empieza y termina a la misma hora. Revísalo.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.repo
      .guardar(a)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.msg.set('Guardado');
          this.edit.set(null);
          this.cargar();
          setTimeout(() => this.msg.set(null), 2500);
        },
        error: (e) => this.error.set(e?.message || 'No se pudo guardar'),
      });
  }

  eliminar(a: MapaAcceso) {
    if (!a.idGeoAcceso) return;
    if (!confirm(`¿Eliminar el acceso "${a.nombre}"?`)) return;
    this.repo.eliminar(a.idGeoAcceso).subscribe({
      next: () => this.cargar(),
      error: (e) => this.error.set(e?.message || 'No se pudo eliminar'),
    });
  }

  /** "Lun-Vie 08:00-17:00 · Sáb 08:00-12:00", para la columna de la lista. */
  resumenHorario(a: MapaAcceso): string {
    const hs = a.horarios ?? [];
    if (!hs.length) return 'Sin restricción';
    return hs
      .slice()
      .sort((x, y) => x.dia - y.dia || x.desde.localeCompare(y.desde))
      .map((h) => `${this.DIAS.find((d) => d.n === h.dia)?.corto ?? h.dia} ${h.desde}-${h.hasta}`)
      .join(' · ');
  }
}
