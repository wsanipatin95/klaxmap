import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapaAccesosRepository } from '../../data-access/acceso/mapa-accesos.repository';
import type { MapaAcceso } from '../../data-access/mapa.models';
import type {
  MapaMetadata,
  MapaNodo,
  MapaNodoSaveRequest,
  MapaPatchRequest,
} from '../../data-access/mapa.models';

@Component({
  selector: 'app-mapa-nodo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-nodo-form.component.html',
  styleUrl: './mapa-nodo-form.component.scss',
})
export class MapaNodoFormComponent implements OnChanges {
  @Input() nodo: MapaNodo | null = null;
  @Input() nodosPadre: MapaNodo[] = [];
  @Input() modo: 'crear' | 'editar' = 'crear';

  @Output() createSubmitted = new EventEmitter<MapaNodoSaveRequest>();
  @Output() updateSubmitted = new EventEmitter<MapaPatchRequest>();

  error: string | null = null;

  private accesosRepo = inject(MapaAccesosRepository);

  /**
   * Fichas de acceso disponibles. Se cargan UNA vez al abrir el formulario: son
   * pocas y no cambian mientras editas un nodo.
   */
  readonly accesos = signal<MapaAcceso[]>([]);

  /** La clave del candado arranca tapada; se destapa a proposito. */
  claveVisible = false;

  /**
   * EQUIPAMIENTO DEL SITIO.
   *
   * Vive dentro de `atributos.sitio` (kxt_red_nodo.atributos, jsonb) — la MISMA columna
   * donde ya vive el splitter de las NAP. No hace falta tabla ni migracion, y queda
   * auditado por el mismo camino que el resto de la edicion del nodo.
   *
   * Se trabaja sobre esta copia plana y se vuelca al JSON recien al guardar: asi un
   * nodo viejo sin `sitio` no revienta, y manana se le agregan campos sin romper lo guardado.
   */
  sitio = this.sitioVacio();

  private sitioVacio() {
    return {
      candado: false,
      candadoClave: '',
      candadoNota: '',
      generador: false,
      generadorCantidad: 0,
      generadorMarca: '',
      baterias: false,
      bateriasCantidad: 0,
      bateriasAh: 0,
      ups: false,
      upsAutonomiaMin: 0,
      medidor: '',
      aire: false,
      ventilacion: false,
      acceso: '',
      llaveNombre: '',
      llaveTelefono: '',
      mantenimientoFecha: '',
      mantenimientoPor: '',
      notas: '',
    };
  }

  constructor() {
    this.accesosRepo.listar().subscribe({
      next: (lista) => this.accesos.set(lista ?? []),
      // Si el catalogo no carga, el resto del formulario tiene que seguir sirviendo:
      // se queda sin opciones para elegir, pero no bloquea guardar el nodo.
      error: () => this.accesos.set([]),
    });
  }

  /** La ficha elegida, para mostrar su telefono y su horario sin ir a otra pantalla. */
  accesoElegido(): MapaAcceso | null {
    const id = this.form.idGeoAccesoFk;
    if (!id) return null;
    return this.accesos().find((a) => a.idGeoAcceso === id) ?? null;
  }

  resumenHorario(a: MapaAcceso | null): string {
    const hs = a?.horarios ?? [];
    if (!hs.length) return 'Sin restricción de horario';
    const dias = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return hs
      .slice()
      .sort((x, y) => x.dia - y.dia || x.desde.localeCompare(y.desde))
      .map((h) => `${dias[h.dia] ?? h.dia} ${h.desde}-${h.hasta}`)
      .join(' · ');
  }

  form: MapaNodoSaveRequest = {
    idRedNodoPadreFk: null,
    codigo: '',
    nodo: '',
    descripcion: '',
    tipoNodo: 'carpeta',
    orden: 0,
    visible: true,
    atributos: {},
    idGeoAccesoFk: null,
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodo']) {
      this.error = null;
      if (this.nodo) {
        this.form = {
          idRedNodoPadreFk: this.nodo.idRedNodoPadreFk ?? null,
          codigo: this.nodo.codigo ?? '',
          nodo: this.nodo.nodo,
          descripcion: this.nodo.descripcion ?? '',
          tipoNodo: this.nodo.tipoNodo,
          orden: this.nodo.orden,
          visible: this.nodo.visible,
          atributos: this.nodo.atributos ?? {},
          idGeoAccesoFk: this.nodo.idGeoAccesoFk ?? null,
        };
        this.claveVisible = false;
        this.cargarSitio(this.nodo.atributos);
      } else {
        this.claveVisible = false;
        this.sitio = this.sitioVacio();
      }
    }
  }

  /** Lee `atributos.sitio` con tolerancia: cualquier campo que falte queda en su vacio. */
  private cargarSitio(atributos: MapaMetadata | null | undefined) {
    const base = this.sitioVacio();
    const raw = (atributos ?? {})['sitio'];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      this.sitio = base;
      return;
    }
    const v = raw as Record<string, unknown>;
    this.sitio = {
      candado: this.bool(v['candado']),
      candadoClave: this.texto(v['candadoClave']),
      candadoNota: this.texto(v['candadoNota']),
      generador: this.bool(v['generador']),
      generadorCantidad: this.num(v['generadorCantidad']),
      generadorMarca: this.texto(v['generadorMarca']),
      baterias: this.bool(v['baterias']),
      bateriasCantidad: this.num(v['bateriasCantidad']),
      bateriasAh: this.num(v['bateriasAh']),
      ups: this.bool(v['ups']),
      upsAutonomiaMin: this.num(v['upsAutonomiaMin']),
      medidor: this.texto(v['medidor']),
      aire: this.bool(v['aire']),
      ventilacion: this.bool(v['ventilacion']),
      acceso: this.texto(v['acceso']),
      llaveNombre: this.texto(v['llaveNombre']),
      llaveTelefono: this.texto(v['llaveTelefono']),
      mantenimientoFecha: this.texto(v['mantenimientoFecha']),
      mantenimientoPor: this.texto(v['mantenimientoPor']),
      notas: this.texto(v['notas']),
    };
  }

  private bool(v: unknown): boolean { return v === true || v === 'true' || v === 1 || v === '1'; }
  private texto(v: unknown): string { return v == null ? '' : String(v); }
  private num(v: unknown): number { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }

  /**
   * Arma el JSON a guardar. Respeta lo que ya hubiera en `atributos` (otra pantalla puede
   * haber guardado sus propias llaves ahi) y solo reemplaza la llave `sitio`.
   */
  private atributosParaGuardar(): MapaMetadata {
    const previos: MapaMetadata = { ...(this.form.atributos ?? {}) };
    const s = this.sitio;
    previos['sitio'] = {
      candado: s.candado,
      // Sin candado no tiene sentido arrastrar la clave guardada.
      candadoClave: s.candado ? s.candadoClave.trim() : '',
      candadoNota: s.candado ? s.candadoNota.trim() : '',
      generador: s.generador,
      generadorCantidad: s.generador ? Number(s.generadorCantidad) || 0 : 0,
      generadorMarca: s.generador ? s.generadorMarca.trim() : '',
      baterias: s.baterias,
      bateriasCantidad: s.baterias ? Number(s.bateriasCantidad) || 0 : 0,
      bateriasAh: s.baterias ? Number(s.bateriasAh) || 0 : 0,
      ups: s.ups,
      upsAutonomiaMin: s.ups ? Number(s.upsAutonomiaMin) || 0 : 0,
      medidor: s.medidor.trim(),
      aire: s.aire,
      ventilacion: s.ventilacion,
      acceso: s.acceso.trim(),
      llaveNombre: s.llaveNombre.trim(),
      llaveTelefono: s.llaveTelefono.trim(),
      mantenimientoFecha: s.mantenimientoFecha.trim(),
      mantenimientoPor: s.mantenimientoPor.trim(),
      notas: s.notas.trim(),
    };
    return previos;
  }

  submit() {
    const nombre = (this.form.nodo ?? '').trim();
    if (!nombre) {
      this.error = 'El nombre del nodo es obligatorio.';
      return;
    }
    if (this.form.orden == null || this.form.orden < 0) {
      this.error = 'El orden debe ser 0 o mayor.';
      return;
    }
    this.error = null;
    this.form.nodo = nombre;

    const atributos = this.atributosParaGuardar();

    if (this.modo === 'crear') {
      this.createSubmitted.emit({ ...this.form, nodo: nombre, atributos });
      return;
    }

    if (!this.nodo) return;

    this.updateSubmitted.emit({
      id: this.nodo.idRedNodo,
      cambios: {
        idRedNodoPadreFk: this.form.idRedNodoPadreFk,
        codigo: this.form.codigo,
        nodo: nombre,
        descripcion: this.form.descripcion,
        tipoNodo: this.form.tipoNodo,
        orden: this.form.orden,
        visible: this.form.visible,
        idGeoAccesoFk: this.form.idGeoAccesoFk ?? null,
        // Faltaba: al EDITAR, los atributos no se mandaban nunca. Cualquier cosa guardada
        // ahi (hoy el equipamiento del sitio) se perdia en silencio al guardar el nodo.
        atributos,
      },
    });
  }
}
