import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';

import type {
  MapaElemento,
  MapaNodo,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import type { MapaMaterialesCaja, MapaNapClientes } from '../../data-access/mapa.models';
import { MapaElementFormComponent } from '../mapa-element-form/mapa-element-form.component';
import { AuditoriaRegistroComponent } from '../auditoria-registro/auditoria-registro.component';

export type PropertiesPanelTab = 'edicion' | 'equipamiento' | 'historial' | 'soporte' | 'materiales';

@Component({
  selector: 'app-mapa-properties-panel',
  standalone: true,
  imports: [CommonModule, MapaElementFormComponent, AuditoriaRegistroComponent],
  templateUrl: './mapa-properties-panel.component.html',
  styleUrl: './mapa-properties-panel.component.scss',
})
export class MapaPropertiesPanelComponent implements OnChanges {
  @Input() elemento: MapaElemento | null = null;
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() nodos: MapaNodo[] = [];
  @Input() open = false;
  @Input() requestedTab: PropertiesPanelTab | null = null;

  /** Pestana Soporte: solo aplica donde cuelgan clientes (hoy, las NAP). */
  @Input() esNap = false;
  @Input() soporte: MapaNapClientes | null = null;
  @Input() soporteLoading = false;
  @Input() soporteError: string | null = null;

  /** Pestana Materiales: espejo de lo que el tecnico cargo en la orden. Solo vista. */
  @Input() materiales: MapaMaterialesCaja | null = null;
  @Input() materialesLoading = false;
  @Input() materialesError: string | null = null;

  @Output() saved = new EventEmitter<MapaElemento>();
  @Output() deleted = new EventEmitter<MapaElemento>();
  @Output() restored = new EventEmitter<MapaElemento>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() dirtyChange = new EventEmitter<boolean>();
  /** Se dispara al abrir Soporte (carga perezosa) y al apretar el boton de releer. */
  @Output() soporteRefresh = new EventEmitter<MapaElemento>();
  @Output() materialesRefresh = new EventEmitter<MapaElemento>();

  @ViewChild(MapaElementFormComponent) elementForm?: MapaElementFormComponent;

  readonly dirty = signal(false);
  readonly activeTab = signal<PropertiesPanelTab>('edicion');
  readonly auditRefreshKey = signal(0);

  ngOnChanges(changes: SimpleChanges): void {
    // Al REABRIR el modal volvemos a la pestana pedida. Sin esto, si cerraste en
    // "Historial" y vuelves a entrar al mismo elemento, te aparecia en Historial:
    // el input 'elemento' no cambia (es el mismo objeto) y nada reseteaba la pestana.
    if (changes['open'] && this.open && !changes['elemento']) {
      this.activeTab.set(this.requestedTab ?? 'edicion');
    }

    if (changes['elemento']) {
      if (this.elemento) {
        const pedida = this.requestedTab ?? 'edicion';
        // Si venia en Equipamiento y el punto nuevo no la admite, no dejarlo parado
        // en una pestana que ya no esta.
        this.activeTab.set(pedida === 'equipamiento' && !this.admiteEquipamiento() ? 'edicion' : pedida);
      } else {
        this.activeTab.set('edicion');
      }
      return;
    }

    if (changes['requestedTab'] && this.requestedTab) {
      this.activeTab.set(this.requestedTab);
    }
  }

  onSaved(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.elementForm?.markSaved(item);
    this.auditRefreshKey.update((v) => v + 1);
    this.saved.emit(item);
  }

  onDeleted(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.deleted.emit(item);
  }

  onRestored(item: MapaElemento) {
    this.dirty.set(false);
    this.dirtyChange.emit(false);
    this.elementForm?.markSaved(item);
    this.auditRefreshKey.update((v) => v + 1);
    this.restored.emit(item);
  }

  /**
   * Cambio de pestana. Soporte carga PEREZOSO: no tiene sentido pedir los clientes de
   * cada NAP en la que alguien hace clic de paso; se piden cuando de verdad abre la pestana.
   */
  setTab(tab: PropertiesPanelTab) {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    if (tab === 'soporte' && this.esNap && !this.soporte && !this.soporteLoading && this.elemento) {
      this.soporteRefresh.emit(this.elemento);
    }
    if (tab === 'materiales' && !this.materiales && !this.materialesLoading && this.elemento) {
      this.materialesRefresh.emit(this.elemento);
    }
  }

  /**
   * ¿Este punto admite equipamiento de sitio (candado, generador, baterias, UPS)?
   *
   * Lo decide el TIPO, marcado en el catalogo (atributos.tieneEquipamiento). Una NAP o
   * un poste no tienen generador, y mostrarles la pestana es ruido: el tecnico la abre,
   * la ve vacia y aprende a ignorarla.
   *
   * Se decide por el flag del catalogo y NO por el nombre del tipo: los nombres se
   * editan desde una pantalla, y el dia que alguien renombre "Nodo" se romperia en
   * silencio sin que nadie relacione una cosa con la otra.
   */
  admiteEquipamiento(): boolean {
    const el = this.elemento;
    if (!el) return false;
    const tipo = this.tipos.find((t) => t.idGeoTipoElemento === el.idGeoTipoElementoFk);
    const v = (tipo?.atributos ?? {})['tieneEquipamiento'];
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  /** Cantidades como 3 y no como 3.0, pero sin perder un 1.5 de cable. */
  cantidadCorta(v: number | null | undefined): string {
    if (v == null) return '—';
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  }

  esEstadoActivo(estado: string | null | undefined): boolean {
    const e = String(estado ?? '').trim().toLowerCase();
    return e === 'activo' || e === 'activa' || e === 'a';
  }

  requestClose() {
    this.closeRequested.emit();
  }

  onOverlayClick() {
    this.requestClose();
  }

  onPanelClick(event: MouseEvent) {
    event.stopPropagation();
  }

  onDirtyStateChanged(isDirty: boolean) {
    this.dirty.set(isDirty);
    this.dirtyChange.emit(isDirty);
  }

  headerTitle(): string {
    const elemento = this.elemento;
    if (!elemento) {
      return 'Elemento';
    }

    const tab = this.activeTab();
    const prefix =
      tab === 'historial' ? 'Historial'
      : tab === 'equipamiento' ? 'Equipamiento'
      : tab === 'soporte' ? 'Soporte'
      : tab === 'materiales' ? 'Materiales'
      : 'Información';
    const parts = [this.resolveTipoNombre(elemento), elemento.nombre?.trim() || 'Sin nombre'];

    const pointPosition = this.resolvePointPosition(elemento);
    if (pointPosition) {
      parts.push(pointPosition);
    }

    return `${prefix} · ${parts.filter(Boolean).join(' - ')}`;
  }

  headerSubtitle(): string {
    const elemento = this.elemento;
    if (!elemento) {
      return '';
    }

    const estadoLogico = elemento.fecFin ? 'eliminado' : 'activo';
    return `${elemento.geomTipo} · ${estadoLogico}`;
  }

  private resolveTipoNombre(elemento: MapaElemento): string {
    const enriched = String(elemento.tipoNombre ?? '').trim();
    if (enriched) {
      return enriched;
    }

    const tipo = this.tipos.find((item) => item.idGeoTipoElemento === elemento.idGeoTipoElementoFk);
    const local = String(tipo?.nombre ?? '').trim();

    return local || 'Elemento';
  }

  private resolvePointPosition(elemento: MapaElemento): string | null {
    const isPoint = String(elemento.geomTipo ?? '').toLowerCase() === 'point';
    if (!isPoint) {
      return null;
    }

    const value = String(elemento.latLon ?? '').trim();
    return value || null;
  }
}