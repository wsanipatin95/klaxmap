import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import type {
  MapaAcceso,
  MapaElemento,
  MapaMetadata,
  MapaNodo,
  MapaPatchRequest,
  MapaTipoElemento,
} from '../../data-access/mapa.models';
import { MapaAccesosRepository } from '../../data-access/acceso/mapa-accesos.repository';
import { MapaElementosRepository } from '../../data-access/elemento/mapa-elementos.repository';
import { MapaConfirmDialogComponent } from '../mapa-confirm-dialog/mapa-confirm-dialog.component';
import { MapaAccesoFormComponent } from '../mapa-acceso-form/mapa-acceso-form.component';
import type { MapaItemVisualPreview } from '../../utils/mapa-element-visual.utils';
import {
  previewClassForVisual,
  previewImageUrlForVisual,
  previewMaterialFamilyForVisual,
  previewMaterialGlyphForVisual,
  previewShapeClassForVisual,
  previewStyleForVisual,
  resolveMapaTipoVisual,
  showClassPreviewForVisual,
  showMaterialPreviewForVisual,
  showUrlPreviewForVisual,
} from '../../utils/mapa-element-visual.utils';

/**
 * Equipamiento y acceso del punto, tal como se edita en pantalla (plano).
 * Se vuelca a `atributos.sitio` recien al guardar.
 */
interface SitioState {
  candado: boolean;
  candadoClave: string;
  candadoNota: string;
  generador: boolean;
  generadorCantidad: number;
  generadorMarca: string;
  baterias: boolean;
  bateriasCantidad: number;
  bateriasAh: number;
  ups: boolean;
  upsAutonomiaMin: number;
  medidor: string;
  aire: boolean;
  ventilacion: boolean;
  acceso: string;
  mantenimientoFecha: string;
  mantenimientoPor: string;
  notas: string;
}

function sitioVacio(): SitioState {
  return {
    candado: false, candadoClave: '', candadoNota: '',
    generador: false, generadorCantidad: 0, generadorMarca: '',
    baterias: false, bateriasCantidad: 0, bateriasAh: 0,
    ups: false, upsAutonomiaMin: 0,
    medidor: '', aire: false, ventilacion: false,
    acceso: '', mantenimientoFecha: '', mantenimientoPor: '', notas: '',
  };
}

/** Lee `atributos.sitio` con tolerancia: lo que falte queda vacio y nada revienta. */
function leerSitio(atributos: MapaMetadata | null | undefined): SitioState {
  const base = sitioVacio();
  const raw = (atributos ?? {})['sitio'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const v = raw as Record<string, unknown>;
  const bool = (x: unknown) => x === true || x === 'true' || x === 1 || x === '1';
  const txt = (x: unknown) => (x == null ? '' : String(x));
  const num = (x: unknown) => {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    candado: bool(v['candado']),
    candadoClave: txt(v['candadoClave']),
    candadoNota: txt(v['candadoNota']),
    generador: bool(v['generador']),
    generadorCantidad: num(v['generadorCantidad']),
    generadorMarca: txt(v['generadorMarca']),
    baterias: bool(v['baterias']),
    bateriasCantidad: num(v['bateriasCantidad']),
    bateriasAh: num(v['bateriasAh']),
    ups: bool(v['ups']),
    upsAutonomiaMin: num(v['upsAutonomiaMin']),
    medidor: txt(v['medidor']),
    aire: bool(v['aire']),
    ventilacion: bool(v['ventilacion']),
    acceso: txt(v['acceso']),
    mantenimientoFecha: txt(v['mantenimientoFecha']),
    mantenimientoPor: txt(v['mantenimientoPor']),
    notas: txt(v['notas']),
  };
}

interface ElementFormState {
  nombre: string;
  descripcion: string;
  estado: string;
  visible: boolean;
  idRedNodoFk: number | null;
  idGeoTipoElementoFk: number | null;
  idGeoAccesoFk: number | null;
  sitio: SitioState;
}

interface TipoAgrupadoVm {
  agrupacion: string;
  tipos: MapaTipoElemento[];
}

interface NodoSelectOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-mapa-element-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, MapaConfirmDialogComponent, MapaAccesoFormComponent],
  templateUrl: './mapa-element-form.component.html',
  styleUrl: './mapa-element-form.component.scss',
})
export class MapaElementFormComponent implements OnChanges {
  @Input() elemento: MapaElemento | null = null;
  @Input() nodos: MapaNodo[] = [];
  @Input() tipos: MapaTipoElemento[] = [];
  @Input() saving = false;
  /**
   * Que parte del formulario se ve. Lo decide la pestana del modal.
   * 'datos' = los campos de siempre; 'sitio' = equipamiento y acceso.
   * Es UNA sola instancia: mismo estado sucio y un unico Guardar para las dos.
   */
  @Input() seccion: 'datos' | 'sitio' = 'datos';

  @Output() saved = new EventEmitter<MapaElemento>();
  @Output() deleted = new EventEmitter<MapaElemento>();
  @Output() restored = new EventEmitter<MapaElemento>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  @ViewChild('confirmDialog') confirmDialog?: MapaConfirmDialogComponent;

  private accesosRepo = inject(MapaAccesosRepository);

  constructor() {
    this.accesosRepo.listar().subscribe({
      next: (lista) => this.accesos.set(lista ?? []),
      error: () => this.accesos.set([]),
    });
  }

  /** Fichas de acceso del catalogo. Si no cargan, el resto del formulario sigue sirviendo. */
  readonly accesos = signal<MapaAcceso[]>([]);
  claveVisible = false;

  private readonly repo = inject(MapaElementosRepository);

  readonly actionBusy = signal(false);
  private readonly currentElemento = signal<MapaElemento | null>(null);
  readonly isDeleted = computed(() => !!this.currentElemento()?.fecFin);

  form: ElementFormState = this.buildFormState(null);
  private initialForm: ElementFormState = this.buildFormState(null);

  submittedAttempt = false;
  error: string | null = null;
  successMessage: string | null = null;

  nodeOptions: NodoSelectOption[] = [];
  tiposAgrupados: TipoAgrupadoVm[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['elemento']) {
      this.syncCurrentElemento(this.elemento);
      this.resetFromElemento(this.currentElemento());
      return;
    }

    this.rebuildNodeOptions();
    this.rebuildCompatibleTypeGroups();

    if (changes['nodos'] || changes['tipos']) {
      this.ensureCurrentSelectionsStillValid();
      this.emitDirtyState();
    }
  }

  onFieldChanged() {
    this.error = null;

    if (this.successMessage) {
      this.successMessage = null;
    }

    this.emitDirtyState();
  }

  onTipoPicked(tipoId: number) {
    if (this.form.idGeoTipoElementoFk === tipoId) {
      return;
    }

    this.form.idGeoTipoElementoFk = tipoId;
    this.error = null;

    if (this.successMessage) {
      this.successMessage = null;
    }

    this.emitDirtyState();
  }

  guardar() {
    const current = this.currentElemento();

    if (!current || this.isWorking() || !this.hasUnsavedChanges()) {
      return;
    }

    this.submittedAttempt = true;
    this.error = null;
    this.successMessage = null;

    if (!this.isValid()) {
      this.error = 'Revisa los campos obligatorios.';
      return;
    }

    const payload: MapaPatchRequest = {
      id: current.idGeoElemento,
      cambios: {
        nombre: this.form.nombre.trim(),
        descripcion: this.form.descripcion.trim(),
        estado: this.form.estado,
        visible: this.form.visible,
        idRedNodoFk: this.form.idRedNodoFk,
        idGeoTipoElementoFk: this.form.idGeoTipoElementoFk,
        idGeoAccesoFk: this.form.idGeoAccesoFk,
        atributos: this.atributosParaGuardar(),
      },
    };

    this.confirmDialog?.open(
      {
        title: 'Guardar cambios del elemento',
        message:
          'Se guardarán los cambios de la información del elemento.\n\n¿Deseas continuar?',
        confirmLabel: 'Guardar',
        cancelLabel: 'Seguir editando',
        alternateLabel: 'Descartar',
        severity: 'info',
      },
      () => {
        this.executeSave(payload);
      },
      undefined,
      () => {
        this.discardChanges();
      }
    );
  }

  requestStateAction() {
    const current = this.currentElemento();

    if (!current || this.isWorking()) {
      return;
    }

    if (this.isDeleted()) {
      this.confirmRestore();
      return;
    }

    this.confirmDelete();
  }

  /**
   * Vuelve a leer el catalogo de fichas, sin cerrar el modal ni perder lo escrito.
   *
   * Hace falta porque las fichas se crean en OTRA pantalla: si no, habria que cerrar
   * el formulario —perdiendo los cambios— solo para que aparezca la que acabas de crear.
   */
  recargarAccesos() {
    this.accesosRepo.listar().subscribe({
      next: (lista) => this.accesos.set(lista ?? []),
      error: () => {},
    });
  }

  /**
   * Alta de ficha AQUI MISMO, encima del modal del elemento.
   *
   * Antes esto abria el repositorio en otra pestana. Era un rodeo: te saca de lo que
   * estabas haciendo para cargar dos datos y volver. Ahora se crea sin salir, y al
   * guardar queda seleccionada sola — que es lo que uno espera cuando aprieta "+ Nueva".
   */
  readonly creandoAcceso = signal(false);

  nuevoAcceso() { this.creandoAcceso.set(true); }

  accesoCreado(a: MapaAcceso | null) {
    this.creandoAcceso.set(false);
    if (!a?.idGeoAcceso) { this.recargarAccesos(); return; }
    // Se mete en la lista y se elige, sin pedir otra vuelta al servidor.
    this.accesos.set([...this.accesos(), a].sort((x, y) =>
      (x.nombre || '').localeCompare(y.nombre || '')));
    this.form.idGeoAccesoFk = a.idGeoAcceso;
  }

  /** true si este punto YA tiene algo cargado: entonces la seccion se abre sola. */
  tieneDatosDeSitio(): boolean {
    const s = this.form.sitio;
    return (
      s.candado || s.generador || s.baterias || s.ups || s.aire || s.ventilacion ||
      !!s.medidor.trim() || !!s.acceso.trim() || !!s.notas.trim() ||
      !!s.mantenimientoFecha.trim() || !!s.mantenimientoPor.trim() ||
      this.form.idGeoAccesoFk != null
    );
  }

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

  /**
   * Arma el jsonb a guardar. Respeta las demas llaves de `atributos` (el splitter de
   * la NAP vive ahi tambien) y solo reemplaza `sitio`.
   */
  private atributosParaGuardar(): MapaMetadata {
    const previos: MapaMetadata = { ...(this.currentElemento()?.atributos ?? {}) };
    const s = this.form.sitio;
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
      mantenimientoFecha: s.mantenimientoFecha.trim(),
      mantenimientoPor: s.mantenimientoPor.trim(),
      notas: s.notas.trim(),
    };
    return previos;
  }

  hasUnsavedChanges(): boolean {
    return !this.statesEqual(this.form, this.initialForm);
  }

  discardChanges() {
    this.resetFromElemento(this.currentElemento());
  }

  markSaved(elemento: MapaElemento | null = this.currentElemento()) {
    this.syncCurrentElemento(elemento);
    this.resetFromElemento(this.currentElemento());
  }

  resetFromElemento(elemento: MapaElemento | null) {
    const state = this.buildFormState(elemento);
    this.form = this.cloneState(state);
    this.initialForm = this.cloneState(state);
    this.submittedAttempt = false;
    this.error = null;
    this.successMessage = null;
    // La clave no queda destapada al pasar al siguiente punto.
    this.claveVisible = false;

    this.rebuildNodeOptions();
    this.rebuildCompatibleTypeGroups();
    this.ensureCurrentSelectionsStillValid();
    this.emitDirtyState();
  }

  controlError(name: 'nombre' | 'idRedNodoFk' | 'idGeoTipoElementoFk' | 'descripcion'): string | null {
    if (!this.submittedAttempt) {
      return null;
    }

    switch (name) {
      case 'nombre':
        if (!this.form.nombre.trim()) return 'Ingresa el nombre.';
        if (this.form.nombre.trim().length > 180) return 'Máximo 180 caracteres.';
        return null;

      case 'descripcion':
        if ((this.form.descripcion || '').trim().length > 500) return 'Máximo 500 caracteres.';
        return null;

      case 'idRedNodoFk':
        return this.form.idRedNodoFk == null ? 'Selecciona un nodo.' : null;

      case 'idGeoTipoElementoFk':
        return this.form.idGeoTipoElementoFk == null ? 'Selecciona un tipo.' : null;

      default:
        return null;
    }
  }

  isTipoSelected(tipo: MapaTipoElemento): boolean {
    return this.form.idGeoTipoElementoFk === tipo.idGeoTipoElemento;
  }

  visual(tipo: MapaTipoElemento): MapaItemVisualPreview {
    return resolveMapaTipoVisual(tipo);
  }

  previewShapeClass(tipo: MapaTipoElemento): string {
    return previewShapeClassForVisual(this.visual(tipo));
  }

  previewStyle(tipo: MapaTipoElemento): Record<string, string> {
    return previewStyleForVisual(this.visual(tipo));
  }

  previewMaterialFamily(tipo: MapaTipoElemento): string {
    return previewMaterialFamilyForVisual(this.visual(tipo));
  }

  previewMaterialGlyph(tipo: MapaTipoElemento): string {
    return previewMaterialGlyphForVisual(this.visual(tipo));
  }

  previewClass(tipo: MapaTipoElemento): string {
    return previewClassForVisual(this.visual(tipo));
  }

  previewImageUrl(tipo: MapaTipoElemento): string {
    return previewImageUrlForVisual(this.visual(tipo));
  }

  showMaterialPreview(tipo: MapaTipoElemento): boolean {
    return showMaterialPreviewForVisual(this.visual(tipo));
  }

  showClassPreview(tipo: MapaTipoElemento): boolean {
    return showClassPreviewForVisual(this.visual(tipo));
  }

  showUrlPreview(tipo: MapaTipoElemento): boolean {
    return showUrlPreviewForVisual(this.visual(tipo));
  }

  selectedNodoDisplay(): string {
    if (this.form.idRedNodoFk == null) return '';

    const found = this.nodos.find((n) => n.idRedNodo === this.form.idRedNodoFk);
    if (found) return found.nodo;

    return `Nodo #${this.form.idRedNodoFk}`;
  }

  showCoordinates(): boolean {
    return !!this.coordinatesValue();
  }

  coordinatesLabel(): string {
    return this.isPointGeometry() ? 'Posición GPS' : 'Referencia geográfica';
  }

  coordinatesValue(): string {
    const current = this.currentElemento();

    const latLon = this.trimmed(current?.latLon);
    if (latLon) {
      return latLon;
    }

    const bbox = this.trimmed(current?.bbox);
    if (bbox) {
      return bbox;
    }

    const fromPayload = this.coordinatesFromGeometryPayload(current?.geometria);
    if (fromPayload) {
      return fromPayload;
    }

    const fromWkt = this.coordinatesFromWkt(current?.wkt);
    if (fromWkt) {
      return fromWkt;
    }

    return '';
  }

  copyCoordinates() {
    const value = this.coordinatesValue();
    if (!value) {
      return;
    }

    this.error = null;
    this.successMessage = null;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => {
          this.successMessage = 'Coordenadas copiadas.';
        },
        () => {
          this.error = 'No se pudieron copiar las coordenadas.';
        }
      );
      return;
    }

    this.successMessage = 'Selecciona y copia manualmente las coordenadas.';
  }

  trackByTipo = (_: number, item: MapaTipoElemento) => item.idGeoTipoElemento;
  trackByGrupo = (_: number, item: TipoAgrupadoVm) => item.agrupacion;

  private isWorking(): boolean {
    return this.saving || this.actionBusy();
  }

  private executeSave(payload: MapaPatchRequest) {
    this.actionBusy.set(true);
    this.error = null;
    this.successMessage = null;

    this.repo.editar(payload).subscribe({
      next: (resp) => {
        this.actionBusy.set(false);
        this.error = null;
        this.successMessage = 'Los cambios se guardaron correctamente.';
        this.markSaved(resp.data);
        this.saved.emit(resp.data);
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.successMessage = null;
        this.error = err?.message || 'No se pudieron guardar los cambios.';
      },
    });
  }

  private confirmDelete() {
    const elemento = this.currentElemento();
    if (!elemento) {
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Eliminar elemento',
        message:
          `El elemento "${elemento.nombre}" se moverá a la carpeta Eliminados.\n\nPodrás restaurarlo luego desde este mismo formulario.` +
          this.buildPendingChangesWarning(),
        confirmLabel: 'Eliminar elemento',
        cancelLabel: 'Cancelar',
        severity: 'danger',
      },
      () => {
        this.executeDelete(elemento);
      }
    );
  }

  private confirmRestore() {
    const elemento = this.currentElemento();
    if (!elemento) {
      return;
    }

    this.confirmDialog?.open(
      {
        title: 'Restaurar elemento',
        message:
          `El elemento "${elemento.nombre}" volverá a estar activo y regresará a su ubicación original dentro del árbol.` +
          this.buildPendingChangesWarning(),
        confirmLabel: 'Restaurar elemento',
        cancelLabel: 'Cancelar',
        severity: 'info',
      },
      () => {
        this.executeRestore(elemento);
      }
    );
  }

  private executeDelete(elemento: MapaElemento) {
    this.actionBusy.set(true);
    this.error = null;
    this.successMessage = null;

    this.repo.eliminar(elemento.idGeoElemento).subscribe({
      next: (resp) => {
        this.actionBusy.set(false);
        this.markSaved(resp.data);
        this.deleted.emit(resp.data);
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.error = err?.message || 'No se pudo eliminar el elemento.';
      },
    });
  }

  private executeRestore(elemento: MapaElemento) {
    this.actionBusy.set(true);
    this.error = null;
    this.successMessage = null;

    this.repo.restaurar(elemento.idGeoElemento).subscribe({
      next: (resp) => {
        this.actionBusy.set(false);
        this.markSaved(resp.data);
        this.restored.emit(resp.data);
      },
      error: (err) => {
        this.actionBusy.set(false);
        this.error = err?.message || 'No se pudo restaurar el elemento.';
      },
    });
  }

  private buildPendingChangesWarning(): string {
    return this.hasUnsavedChanges()
      ? '\n\nHay cambios sin guardar en el formulario. Esa edición no se guardará antes de continuar.'
      : '';
  }

  private emitDirtyState() {
    this.dirtyChange.emit(this.hasUnsavedChanges());
  }

  private buildFormState(elemento: MapaElemento | null): ElementFormState {
    return {
      nombre: elemento?.nombre ?? '',
      descripcion: elemento?.descripcion ?? '',
      estado: elemento?.estado ?? 'activo',
      visible: elemento?.visible ?? true,
      idRedNodoFk: elemento?.idRedNodoFk ?? null,
      idGeoTipoElementoFk: elemento?.idGeoTipoElementoFk ?? null,
      idGeoAccesoFk: elemento?.idGeoAccesoFk ?? null,
      sitio: leerSitio(elemento?.atributos),
    };
  }

  private cloneState(state: ElementFormState): ElementFormState {
    return {
      nombre: state.nombre,
      descripcion: state.descripcion,
      estado: state.estado,
      visible: state.visible,
      idRedNodoFk: state.idRedNodoFk,
      idGeoTipoElementoFk: state.idGeoTipoElementoFk,
      idGeoAccesoFk: state.idGeoAccesoFk,
      // Copia PROPIA del sitio: compartir el objeto haria que "Revertir cambios"
      // no revirtiera nada, porque form e initialForm serian el mismo objeto.
      sitio: { ...state.sitio },
    };
  }

  private statesEqual(a: ElementFormState, b: ElementFormState): boolean {
    return (
      a.nombre.trim() === b.nombre.trim() &&
      a.descripcion.trim() === b.descripcion.trim() &&
      a.estado === b.estado &&
      a.visible === b.visible &&
      a.idRedNodoFk === b.idRedNodoFk &&
      a.idGeoTipoElementoFk === b.idGeoTipoElementoFk &&
      a.idGeoAccesoFk === b.idGeoAccesoFk &&
      JSON.stringify(a.sitio) === JSON.stringify(b.sitio)
    );
  }

  private isValid(): boolean {
    return (
      !!this.form.nombre.trim() &&
      this.form.nombre.trim().length <= 180 &&
      this.form.descripcion.trim().length <= 500 &&
      this.form.idRedNodoFk != null &&
      this.form.idGeoTipoElementoFk != null
    );
  }

  private rebuildNodeOptions() {
    const options = this.nodos.map((n) => ({
      value: n.idRedNodo,
      label: n.nodo,
    }));

    if (
      this.form.idRedNodoFk != null &&
      !options.some((x) => x.value === this.form.idRedNodoFk)
    ) {
      options.unshift({
        value: this.form.idRedNodoFk,
        label: this.selectedNodoDisplay() || `Nodo #${this.form.idRedNodoFk}`,
      });
    }

    this.nodeOptions = options;
  }

  private rebuildCompatibleTypeGroups() {
    const geom = this.currentElemento()?.geomTipo ?? null;
    const compatibles = this.tipos.filter((t) => {
      if (!geom) return true;
      return t.geometriaPermitida === geom || t.geometriaPermitida === 'mixed';
    });

    const orderedGroups: TipoAgrupadoVm[] = [];
    const byGroup = new Map<string, TipoAgrupadoVm>();

    for (const tipo of compatibles) {
      const agrupacion = this.normalizeGrouping(tipo.agrupacion);

      let group = byGroup.get(agrupacion);
      if (!group) {
        group = { agrupacion, tipos: [] };
        byGroup.set(agrupacion, group);
        orderedGroups.push(group);
      }

      group.tipos.push(tipo);
    }

    this.tiposAgrupados = orderedGroups;
  }

  private ensureCurrentSelectionsStillValid() {
    if (
      this.form.idRedNodoFk != null &&
      !this.nodeOptions.some((x) => x.value === this.form.idRedNodoFk)
    ) {
      this.form.idRedNodoFk = null;
    }

    const compatibles = this.tiposAgrupados.flatMap((g) => g.tipos);

    if (!compatibles.length) {
      this.form.idGeoTipoElementoFk = null;
      return;
    }

    const exists = compatibles.some((t) => t.idGeoTipoElemento === this.form.idGeoTipoElementoFk);
    if (!exists) {
      this.form.idGeoTipoElementoFk = compatibles[0].idGeoTipoElemento;
    }
  }

  private normalizeGrouping(value: string | null | undefined): string {
    const normalized = String(value ?? '').trim();
    return normalized || 'Sin agrupación';
  }

  private isPointGeometry(): boolean {
    return String(this.currentElemento()?.geomTipo ?? '').toLowerCase() === 'point';
  }

  private syncCurrentElemento(elemento: MapaElemento | null) {
    this.currentElemento.set(elemento);
  }

  private coordinatesFromGeometryPayload(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return this.coordinatesFromWkt(value);
    }

    if (typeof value !== 'object') {
      return null;
    }

    const payload = value as Record<string, unknown>;

    const payloadWkt = this.trimmed(payload['wkt']);
    if (payloadWkt) {
      return this.coordinatesFromWkt(payloadWkt);
    }

    const type = this.trimmed(payload['type'])?.toLowerCase();
    const coordinates = payload['coordinates'];

    if (!type || coordinates == null) {
      return null;
    }

    if (type === 'point') {
      return this.formatPair(coordinates);
    }

    if (type === 'linestring') {
      return this.formatLineCoordinates(coordinates);
    }

    if (type === 'polygon') {
      return this.formatPolygonReference(coordinates);
    }

    if (type === 'multilinestring' && Array.isArray(coordinates) && coordinates.length > 0) {
      return this.formatLineCoordinates(coordinates[0]);
    }

    if (type === 'multipolygon' && Array.isArray(coordinates) && coordinates.length > 0) {
      return this.formatPolygonReference(coordinates[0]);
    }

    return null;
  }

  private coordinatesFromWkt(value: string | null | undefined): string | null {
    const text = this.trimmed(value);
    if (!text) {
      return null;
    }

    const pointMatch = text.match(
      /POINT(?:\s+Z|\s+M|\s+ZM)?\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*(?:[-\d.]+\s*)?\)/i
    );

    if (pointMatch) {
      return this.joinPair(pointMatch[1], pointMatch[2]);
    }

    const pairMatches = Array.from(
      text.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)
    );

    if (!pairMatches.length) {
      return null;
    }

    const first = this.joinPair(pairMatches[0][1], pairMatches[0][2]);
    const lastMatch = pairMatches[pairMatches.length - 1];
    const last = this.joinPair(lastMatch[1], lastMatch[2]);
    const upper = text.toUpperCase();

    if (upper.startsWith('LINESTRING') || upper.startsWith('MULTILINESTRING')) {
      if (first && last && first !== last) {
        return `Inicio: ${first} · Fin: ${last}`;
      }
      return first;
    }

    if (upper.startsWith('POLYGON') || upper.startsWith('MULTIPOLYGON')) {
      return first ? `Ref: ${first}` : null;
    }

    return first;
  }

  private formatLineCoordinates(value: unknown): string | null {
    if (!Array.isArray(value) || !value.length) {
      return null;
    }

    const first = this.formatPair(value[0]);
    const last = this.formatPair(value[value.length - 1]);

    if (first && last && first !== last) {
      return `Inicio: ${first} · Fin: ${last}`;
    }

    return first || last;
  }

  private formatPolygonReference(value: unknown): string | null {
    if (!Array.isArray(value) || !value.length) {
      return null;
    }

    const firstRing = Array.isArray(value[0]) ? value[0] : value;
    if (!Array.isArray(firstRing) || !firstRing.length) {
      return null;
    }

    const first = this.formatPair(firstRing[0]);
    return first ? `Ref: ${first}` : null;
  }

  private formatPair(value: unknown): string | null {
    if (!Array.isArray(value) || value.length < 2) {
      return null;
    }

    return this.joinPair(value[0], value[1]);
  }

  private joinPair(lon: unknown, lat: unknown): string | null {
    const x = this.normalizeCoordinate(lon);
    const y = this.normalizeCoordinate(lat);

    if (x == null || y == null) {
      return null;
    }

    return `${x},${y}`;
  }

  private normalizeCoordinate(value: unknown): string | null {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      return null;
    }

    return `${Math.round(num * 1_000_000) / 1_000_000}`;
  }

  private trimmed(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }
}