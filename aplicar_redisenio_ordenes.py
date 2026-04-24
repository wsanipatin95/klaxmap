from __future__ import annotations

from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()

FILES = {
    'ordenes_ts': ROOT / 'src/app/features/vehiculos/pages/ordenes/ordenes.component.ts',
    'ordenes_html': ROOT / 'src/app/features/vehiculos/pages/ordenes/ordenes.component.html',
    'detail_html': ROOT / 'src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.html',
    'detail_scss': ROOT / 'src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.scss',
}

TYPES_BLOCK = """type OrdenEstadoFilter = 'TODOS' | 'RECIBIDO' | 'EN_PROCESO' | 'FINALIZADO' | 'ANULADO';

type EstadoFilterTone = 'all' | 'received' | 'process' | 'success' | 'danger';

type EstadoFilterOption = {
  key: OrdenEstadoFilter;
  label: string;
  tone: EstadoFilterTone;
};

"""

STATE_BLOCK = """  readonly estadoFilters: EstadoFilterOption[] = [
    { key: 'TODOS', label: 'TODOS', tone: 'all' },
    { key: 'RECIBIDO', label: 'RECIBIDO', tone: 'received' },
    { key: 'EN_PROCESO', label: 'EN_PROCESO', tone: 'process' },
    { key: 'FINALIZADO', label: 'FINALIZADO', tone: 'success' },
    { key: 'ANULADO', label: 'ANULADO', tone: 'danger' },
  ];

  estadoFilter = signal<OrdenEstadoFilter>('TODOS');
  filtrosAvanzadosVisible = signal(false);

"""

COMPUTED_BLOCK = """  readonly ordenesFiltradas = computed(() => {
    const filter = this.estadoFilter();
    const items = this.ordenes();

    if (filter === 'TODOS') {
      return items;
    }

    return items.filter((item) => this.matchesEstadoFilter(item.estadoOrden, filter));
  });

"""

CARGAR_BLOCK = """  cargar() {
    this.loading.set(true);

    this.repo.listarOrdenes(this.q, 0, this.MAIN_DRAWER_PAGE_SIZE, false)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res.items ?? [];
          this.ordenes.set(items);
          this.syncSelectedOrdenWithFilters();
        },
        error: (err) => this.notify.error('No se pudieron cargar órdenes', err?.message),
      });
  }
"""

METHODS_BLOCK = """  setEstadoFilter(filter: OrdenEstadoFilter) {
    this.estadoFilter.set(filter);
    this.syncSelectedOrdenWithFilters();
  }

  toggleFiltrosAvanzados() {
    this.filtrosAvanzadosVisible.update((value) => !value);
  }

  aplicarBusquedaOrdenes() {
    this.cargar();
  }

  limpiarFiltrosOrdenes() {
    this.q = '';
    this.estadoFilter.set('TODOS');
    this.filtrosAvanzadosVisible.set(false);
    this.cargar();
  }

  activeFilterCount(): number {
    let count = 0;

    if (this.estadoFilter() !== 'TODOS') {
      count += 1;
    }

    if (this.q.trim()) {
      count += 1;
    }

    return count;
  }

  estadoFilterCount(filter: OrdenEstadoFilter): number {
    if (filter === 'TODOS') {
      return this.ordenes().length;
    }

    return this.ordenes().filter((item) => this.matchesEstadoFilter(item.estadoOrden, filter)).length;
  }

  estadoFilterText(): string {
    const found = this.estadoFilters.find((item) => item.key === this.estadoFilter());
    return found?.label ?? 'TODOS';
  }

  private syncSelectedOrdenWithFilters() {
    const visibleItems = this.ordenesFiltradas();
    const current = this.selectedOrden();

    if (current) {
      const found = visibleItems.find((item) => item.idVehOrdenTrabajo === current.idVehOrdenTrabajo) ?? null;

      if (found) {
        this.selectedOrden.set(found);
        this.cargarDetalle(found);
        return;
      }
    }

    const next = visibleItems[0] ?? null;
    this.selectedOrden.set(next);

    if (next) {
      this.cargarDetalle(next);
      return;
    }

    this.resetDetalle();
  }

  private matchesEstadoFilter(rawEstado: string | null | undefined, filter: OrdenEstadoFilter): boolean {
    const estado = this.normalizeEstadoFilter(rawEstado);

    if (filter === 'TODOS') {
      return true;
    }

    if (filter === 'FINALIZADO') {
      return estado.includes('FINALIZADO') || estado.includes('ENTREGADO') || estado.includes('FACTURADO');
    }

    if (filter === 'ANULADO') {
      return estado.includes('ANULADO');
    }

    return estado === filter;
  }

  private normalizeEstadoFilter(rawEstado: string | null | undefined): string {
    return String(rawEstado || 'RECIBIDO').trim().toUpperCase();
  }

"""

TOP_HTML = """<div class=\"vehPageShell vehPageShell--ordenes\">
  <app-vehiculos-page-header title=\"Órdenes de trabajo\" subtitle=\"Recepción, ejecución y cobro en una sola vista.\">
    <button pButton type=\"button\" severity=\"secondary\" icon=\"pi pi-arrow-left\" label=\"Volver\"
      (click)=\"volver()\"></button>
    <button pButton type=\"button\" icon=\"pi pi-plus\" label=\"Nueva OT\" (click)=\"nuevo()\"></button>
  </app-vehiculos-page-header>

  <p-confirmDialog></p-confirmDialog>

  <section class=\"statusFilterRail\" aria-label=\"Estados de órdenes\">
    <button
      type=\"button\"
      class=\"statusFilterButton\"
      *ngFor=\"let filter of estadoFilters\"
      [class.active]=\"estadoFilter() === filter.key\"
      [class.statusFilterButton--all]=\"filter.tone === 'all'\"
      [class.statusFilterButton--received]=\"filter.tone === 'received'\"
      [class.statusFilterButton--process]=\"filter.tone === 'process'\"
      [class.statusFilterButton--success]=\"filter.tone === 'success'\"
      [class.statusFilterButton--danger]=\"filter.tone === 'danger'\"
      (click)=\"setEstadoFilter(filter.key)\">
      <span>{{ filter.label }}</span>
      <strong>{{ estadoFilterCount(filter.key) }}</strong>
    </button>
  </section>

  <section class=\"compactSearchRail\">
    <div class=\"compactSearchRail__main\">
      <div class=\"searchBox searchBox--compact\">
        <i class=\"pi pi-search\"></i>
        <input
          pInputText
          type=\"text\"
          [(ngModel)]=\"q\"
          placeholder=\"Buscar orden, cliente, placa o detalle...\"
          (keyup.enter)=\"aplicarBusquedaOrdenes()\">
      </div>

      <button
        type=\"button\"
        class=\"searchIconButton\"
        title=\"Buscar\"
        (click)=\"aplicarBusquedaOrdenes()\">
        <i class=\"pi pi-search\"></i>
      </button>

      <button
        type=\"button\"
        class=\"filterIconButton\"
        title=\"Más filtros\"
        [class.active]=\"filtrosAvanzadosVisible() || activeFilterCount() > 0\"
        (click)=\"toggleFiltrosAvanzados()\">
        <i class=\"pi pi-filter\"></i>
        <span *ngIf=\"activeFilterCount() > 0\">{{ activeFilterCount() }}</span>
      </button>
    </div>

    <div class=\"compactSearchRail__actions\">
      <button
        pButton
        type=\"button\"
        severity=\"secondary\"
        [text]=\"true\"
        label=\"Limpiar\"
        [disabled]=\"!q.trim() && estadoFilter() === 'TODOS'\"
        (click)=\"limpiarFiltrosOrdenes()\">
      </button>

      <button
        pButton
        type=\"button\"
        icon=\"pi pi-refresh\"
        label=\"Recargar\"
        [loading]=\"loading()\"
        (click)=\"cargar()\">
      </button>
    </div>

    <div class=\"filterMiniPanel\" *ngIf=\"filtrosAvanzadosVisible()\">
      <div class=\"filterMiniPanel__item\">
        <span>Estado</span>
        <strong>{{ estadoFilterText() }}</strong>
      </div>

      <div class=\"filterMiniPanel__item\">
        <span>Búsqueda</span>
        <strong>{{ q.trim() || 'Sin texto' }}</strong>
      </div>

      <div class=\"filterMiniPanel__item\">
        <span>Resultado visible</span>
        <strong>{{ ordenesFiltradas().length }} OT</strong>
      </div>
    </div>
  </section>

  <div class=\"ordenesLayout ordenesLayout--dense\">
    <section class=\"backlogCard backlogCard--dense\">
      <div class=\"backlogCard__header backlogCard__header--dense\">
        <div class=\"backlogCard__title\">
          <h3>Órdenes</h3>
          <span class=\"secondaryCell secondaryCell--compact\">Cola visible de trabajo</span>
        </div>

        <div class=\"backlogCard__headerMeta\">
          <span class=\"panelHint\">{{ ordenesFiltradas().length }} OT</span>
          <span class=\"panelHint\" *ngIf=\"selectedOrden() as ordenActual\">#{{ ordenActual.idVehOrdenTrabajo }}</span>
        </div>
      </div>

      <div class=\"backlogCard__body backlogCard__body--compact\" *ngIf=\"ordenesFiltradas().length; else noOrdenes\">
        <article
          class=\"jiraLikeRow jiraLikeRow--compact jiraLikeRow--ultra\"
          *ngFor=\"let item of ordenesFiltradas()\"
          [class.selected]=\"selectedOrden()?.idVehOrdenTrabajo === item.idVehOrdenTrabajo\"
          (click)=\"seleccionarOrden(item)\">

          <div class=\"orderRowTop\">
            <div class=\"orderRowTitle\">
              <strong>OT #{{ item.idVehOrdenTrabajo }} · {{ item.tipoServicio || 'SERVICIO' }}</strong>
              <p-tag [value]=\"item.estadoOrden || 'RECIBIDO'\" [severity]=\"severityEstado(item.estadoOrden)\"></p-tag>
            </div>

            <div class=\"orderRowActions\">
              <button pButton type=\"button\" size=\"small\" [text]=\"true\" icon=\"pi pi-pencil\" title=\"Editar\"
                [disabled]=\"isOrdenBloqueada(item)\" (click)=\"editarOrden(item); $event.stopPropagation()\"></button>
              <button pButton type=\"button\" size=\"small\" [text]=\"true\" severity=\"success\" icon=\"pi pi-check-circle\" title=\"Finalizar\"
                [disabled]=\"!canFinalizeOrden(item)\" (click)=\"finalizarOrden(item); $event.stopPropagation()\"></button>
              <button pButton type=\"button\" size=\"small\" [text]=\"true\" severity=\"secondary\" icon=\"pi pi-replay\" title=\"Devolver\"
                [disabled]=\"!canDevolverOrden(item)\" (click)=\"devolverOrden(item); $event.stopPropagation()\"></button>
              <button pButton type=\"button\" size=\"small\" [text]=\"true\" severity=\"warn\" icon=\"pi pi-ban\" title=\"Anular\"
                [disabled]=\"isOrdenBloqueada(item)\" (click)=\"anularOrden(item); $event.stopPropagation()\"></button>
              <button pButton type=\"button\" size=\"small\" [text]=\"true\" severity=\"danger\" icon=\"pi pi-trash\" title=\"Eliminar\"
                [disabled]=\"isOrdenBloqueada(item)\" (click)=\"eliminarOrden(item); $event.stopPropagation()\"></button>
            </div>
          </div>

          <div class=\"orderRowGrid\">
            <span>{{ item.nombre || item.ruc || ('Cliente #' + item.dni) }}</span>
            <span>{{ [item.marca, item.modelo, item.placa].filter(x => !!x).join(' · ') || 'Vehículo' }}</span>
            <span>{{ formatDateTimeFriendly(item.fechaIngreso || item.fecGen) }}</span>
          </div>

          <div class=\"orderRowDetail\">
            {{ item.fallaReportada || item.detalleCliente || item.observaciones || 'Sin detalle operativo' }}
          </div>
        </article>
      </div>
    </section>

    <section class=\"workspaceCard workspaceCard--unified\">
      <div class=\"selectedOrderBar\" *ngIf=\"selectedOrden() as ordenActual\">
        <div class=\"selectedOrderBar__copy\">
          <div class=\"selectedOrderBar__title\">
            <strong>OT #{{ ordenActual.idVehOrdenTrabajo }} · {{ ordenActual.tipoServicio || 'SERVICIO' }}</strong>
            <span class=\"stateInlinePill\" [class.is-danger]=\"isOrdenAnulada(ordenActual)\" [class.is-success]=\"isOrdenFinalizada(ordenActual)\" [class.is-process]=\"!isOrdenAnulada(ordenActual) && !isOrdenFinalizada(ordenActual)\">
              {{ ordenActual.estadoOrden || 'RECIBIDO' }}
            </span>
          </div>
          <span class=\"selectedOrderBar__meta\">Ingreso: {{ formatDateTimeFriendly(ordenActual.fechaIngreso || ordenActual.fecGen) }}</span>
        </div>

        <div class=\"selectedOrderBar__actions\">
          <button pButton type=\"button\" size=\"small\" severity=\"success\" icon=\"pi pi-check-circle\" label=\"Finalizar orden\" [disabled]=\"!canFinalizeOrden(ordenActual)\" (click)=\"finalizarOrden(ordenActual)\"></button>
          <button pButton type=\"button\" size=\"small\" severity=\"secondary\" icon=\"pi pi-replay\" label=\"Devolver orden\" [disabled]=\"!canDevolverOrden(ordenActual)\" (click)=\"devolverOrden(ordenActual)\"></button>
          <app-orden-reportes-panel [orden]=\"selectedOrden()\"></app-orden-reportes-panel>
        </div>
      </div>

      <app-orden-detail-panel [orden]=\"selectedOrden()\" [clienteNombre]=\"clienteNombreSeleccionado()\"
        [vehiculoNombre]=\"vehiculoNombreSeleccionado()\" [responsableRecepcionNombre]=\"responsableRecepcionNombre()\"
        [responsableTecnicoNombre]=\"responsableTecnicoNombre()\" [checklist]=\"checklist()\"
        [checklistOpciones]=\"checklistOpciones()\" [trabajos]=\"trabajos()\" [hallazgos]=\"hallazgos()\"
        [selectedHallazgo]=\"selectedHallazgo()\" [marcas]=\"marcas()\" [fotos]=\"fotos()\" [repuestos]=\"repuestos()\"
        [autorizaciones]=\"autorizaciones()\" [ordenFacturas]=\"ordenFacturas()\" [vistas]=\"vistas()\"
        [selectedVista]=\"selectedVista()\" [facturasOt]=\"facturasOt()\" [selectedFacturaOt]=\"selectedFacturaOt()\"
        [facturaDetalle]=\"facturaDetalle()\" [cobrosFactura]=\"cobrosFactura()\" [workflowResultado]=\"workflowResultado()\"
        [checklistLabelMap]=\"checklistLabelMap()\" [trabajoLabelMap]=\"trabajoLabelMap()\"
        [articuloLabelMap]=\"articuloLabelMap()\" [articulosCatalogo]=\"articulosCatalogo()\"
        [readonlyMode]=\"isOrdenBloqueada(selectedOrden())\" [garantias]=\"garantias()\"
        [selectedGarantia]=\"selectedGarantia()\" [garantiaDetalles]=\"garantiaDetalles()\" [garantiaMovimientos]=\"garantiaMovimientos()\"
        (saveChecklist)=\"guardarChecklistMasivo($event)\" (saveTrabajo)=\"guardarTrabajoWorkbench($event)\"
        (saveHallazgo)=\"guardarHallazgoWorkbench($event)\" (saveFoto)=\"guardarFotoWorkbench($event)\"
        (saveRepuesto)=\"guardarRepuestoWorkbench($event)\" (deleteRepuesto)=\"eliminarRepuestoWorkbench($event)\"
        (articuloQueryChange)=\"onRepuestoArticuloQueryChange($event)\" (articuloSelected)=\"seleccionarArticuloRepuesto($event)\"
        (selectHallazgo)=\"seleccionarHallazgo($event)\" (clearHallazgoSelection)=\"limpiarSeleccionHallazgoWorkbench()\"
        (selectVista)=\"seleccionarVista($event)\" (selectFactura)=\"seleccionarFacturaOt($event)\"
        (pointMarked)=\"createMarcaDesdeCanvas($event)\" (createFactura)=\"guardarFacturaDesdePanel($event)\"
        (openCobro)=\"abrirComercialDrawer('cobro')\" (openContabilizar)=\"abrirComercialDrawer('contabilizar')\"
        (selectGarantia)=\"seleccionarGarantia($event)\" (openGarantia)=\"abrirGarantiaDrawer()\"
        (openGarantiaDetalle)=\"abrirGarantiaDetalleDrawer()\" (openGarantiaMovimiento)=\"abrirGarantiaMovimientoDrawer()\">
      </app-orden-detail-panel>
    </section>
  </div>

  <ng-template #noOrdenes>
    <app-vehiculos-empty-state icon=\"pi pi-briefcase\" title=\"Sin órdenes\" subtitle=\"No hay órdenes para el estado o búsqueda aplicada.\"></app-vehiculos-empty-state>
  </ng-template>

"""

DETAIL_HEADER = """<ng-container *ngIf=\"orden; else noSelection\">
  <section class=\"detailWorkspace detailWorkspace--compact\">
    <section class=\"readonlyStrip\" *ngIf=\"readonlyMode\">
      <span class=\"readonlyPill\">{{ readonlyStateLabel() }}</span>
    </section>

    <section class=\"contextStrip contextStrip--dense\">
      <article class=\"contextPill\">
        <span>Cliente</span>
        <strong>{{ clienteNombre }}</strong>
      </article>

      <article class=\"contextPill\">
        <span>Vehículo</span>
        <strong>{{ vehiculoNombre }}</strong>
      </article>

      <article class=\"contextPill\">
        <span>Recibe</span>
        <strong>{{ responsableRecepcionNombre }}</strong>
      </article>

      <article class=\"contextPill\">
        <span>Técnico</span>
        <strong>{{ responsableTecnicoNombre }}</strong>
      </article>
    </section>

"""

SUMMARY_BLOCK = """    <section class=\"panelCard panelCard--summary\" *ngIf=\"activeTab()==='resumen'\">
      <div class=\"summaryMetrics\">
        <article class=\"summaryMetric\"><span>Checklist</span><strong>{{ checklist.length }}</strong></article>
        <article class=\"summaryMetric\"><span>Trabajos</span><strong>{{ trabajos.length }}</strong></article>
        <article class=\"summaryMetric\"><span>Hallazgos</span><strong>{{ hallazgos.length }}</strong></article>
        <article class=\"summaryMetric\"><span>Repuestos</span><strong>{{ repuestos.length }}</strong></article>
        <article class=\"summaryMetric\"><span>Pend. facturar</span><strong>{{ repuestosPendientesCount() }}</strong></article>
        <article class=\"summaryMetric\"><span>Facturas</span><strong>{{ facturasOt.length }}</strong></article>
        <article class=\"summaryMetric\"><span>Cobros</span><strong>{{ cobrosFactura.length }}</strong></article>
        <article class=\"summaryMetric\"><span>Relaciones</span><strong>{{ ordenFacturas.length }}</strong></article>
      </div>

      <div class=\"summaryFacts\">
        <article class=\"summaryFact\"><span>Fecha de ingreso</span><strong>{{ formatDateTimeShort(orden.fechaIngreso || orden.fecGen) }}</strong></article>
        <article class=\"summaryFact\"><span>Fecha promesa</span><strong>{{ formatDateTimeShort(orden.fechaPrometida) }}</strong></article>
        <article class=\"summaryFact\"><span>Kilometraje</span><strong>{{ orden.kilometrajeIngreso || 0 }}</strong></article>
        <article class=\"summaryFact\"><span>Combustible / batería</span><strong>{{ orden.nivelCombustible || '-' }} · {{ orden.nivelBateria || '-' }}</strong></article>
      </div>
    </section>

"""

DETAIL_SCSS_APPEND = r'''

/* ===== Compact redesign: ordenes workbench ===== */
.detailWorkspace--compact {
  gap: 0.42rem;
}

.contextStrip--dense {
  gap: 0.34rem;
}

.contextStrip--dense .contextPill {
  padding: 0.42rem 0.52rem;
  border-radius: 0.62rem;
}

.contextStrip--dense .contextPill span {
  font-size: 0.58rem;
}

.contextStrip--dense .contextPill strong {
  font-size: 0.76rem;
  font-weight: 800;
}

.panelCard,
.workEditorCard,
.workbenchCard,
.sideCard,
.listCard,
.detailMiniCard {
  height: auto;
  min-height: 0;
  overflow-x: visible;
  align-content: start;
}

.panelCard--summary {
  gap: 0.42rem;
  padding: 0.46rem;
}

.summaryMetrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.34rem;
}

.summaryMetric {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.38rem;
  min-height: 3.1rem;
  padding: 0.48rem 0.56rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.66rem;
  background: #f8fafc;
}

.summaryMetric span {
  min-width: 0;
  color: #64748b;
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summaryMetric strong {
  color: #0f172a;
  font-size: 0.92rem;
  line-height: 1;
}

.summaryFacts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.34rem;
}

.summaryFact {
  display: grid;
  gap: 0.1rem;
  min-height: 3rem;
  padding: 0.46rem 0.56rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.66rem;
  background: #f8fafc;
}

.summaryFact span {
  color: #64748b;
  font-size: 0.62rem;
  font-weight: 800;
}

.summaryFact strong {
  color: #0f172a;
  font-size: 0.75rem;
  line-height: 1.18;
}

@media (max-width: 1200px) {
  .summaryMetrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summaryFacts {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .summaryMetrics {
    grid-template-columns: 1fr;
  }
}
'''


def backup(path: Path) -> None:
    if path.exists():
        bak = path.with_suffix(path.suffix + '.bak-redisenio')
        if not bak.exists():
            shutil.copy2(path, bak)


def read(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(path)
    return path.read_text(encoding='utf-8')


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding='utf-8')


def patch_ts() -> None:
    path = FILES['ordenes_ts']
    backup(path)
    text = read(path)

    if 'type OrdenEstadoFilter =' not in text:
        marker = "type AtributoRowForm = FormGroup<{"
        text = text.replace(marker, TYPES_BLOCK + marker)

    if 'readonly estadoFilters: EstadoFilterOption[]' not in text:
        marker = "  readonly TIPO_FACTURACION_OPTIONS = ['PARCIAL', 'TOTAL'];\n\n"
        text = text.replace(marker, marker + STATE_BLOCK)

    if 'readonly ordenesFiltradas = computed' not in text:
        marker = "  readonly articulosCatalogo = computed<VehArticuloCatalogo[]>(() =>\n    Object.values(this.articuloCache()).sort((a, b) =>\n      String(a.articulo || '').localeCompare(String(b.articulo || '')),\n    ),\n  );\n\n"
        if marker not in text:
            raise RuntimeError('No encontre el bloque articulosCatalogo para insertar ordenesFiltradas.')
        text = text.replace(marker, marker + COMPUTED_BLOCK)

    text = re.sub(r"  cargar\(\) \{.*?\n  \}\n\n  seleccionarOrden", CARGAR_BLOCK + "\n  seleccionarOrden", text, flags=re.S, count=1)

    if 'setEstadoFilter(filter: OrdenEstadoFilter)' not in text:
        marker = "  seleccionarOrden(item: VehOrdenTrabajo) {\n    this.selectedOrden.set(item);\n    this.cargarDetalle(item);\n  }\n\n"
        if marker not in text:
            raise RuntimeError('No encontre seleccionarOrden para insertar metodos de filtro.')
        text = text.replace(marker, marker + METHODS_BLOCK)

    write(path, text)


def patch_ordenes_html() -> None:
    path = FILES['ordenes_html']
    backup(path)
    text = read(path)
    marker = '  <app-orden-main-form-drawer'
    idx = text.find(marker)
    if idx == -1:
        raise RuntimeError('No encontre app-orden-main-form-drawer para preservar drawers.')
    text = TOP_HTML + text[idx:]
    write(path, text)


def patch_detail_html() -> None:
    path = FILES['detail_html']
    backup(path)
    text = read(path)

    tab_marker = '    <section class="tabRail">'
    idx = text.find(tab_marker)
    if idx == -1:
        raise RuntimeError('No encontre tabRail en orden-detail-panel.component.html.')
    text = DETAIL_HEADER + text[idx:]

    start = text.find('    <section class="panelCard" *ngIf="activeTab()===\'resumen\'">')
    if start == -1:
        start = text.find('    <section class="panelCard" *ngIf="activeTab()===\"resumen\"">')
    end = text.find('    <section class="panelCard" *ngIf="activeTab()===\'checklist\'">')
    if end == -1:
        end = text.find('    <section class="panelCard" *ngIf="activeTab()===\"checklist\"">')
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError('No encontre el bloque Resumen para reemplazarlo.')
    text = text[:start] + SUMMARY_BLOCK + text[end:]
    write(path, text)


def patch_detail_scss() -> None:
    path = FILES['detail_scss']
    backup(path)
    text = read(path)
    if 'Compact redesign: ordenes workbench' not in text:
      text = text.rstrip() + DETAIL_SCSS_APPEND + '\n'
    write(path, text)


def main() -> None:
    missing = [str(p) for p in FILES.values() if not p.exists()]
    if missing:
        print('No encontre estos archivos. Ejecuta este script desde la raiz del proyecto Angular:', file=sys.stderr)
        for item in missing:
            print(' - ' + item, file=sys.stderr)
        sys.exit(1)

    patch_ts()
    patch_ordenes_html()
    patch_detail_html()
    patch_detail_scss()
    print('[OK] Redisenio aplicado. Ahora copia los 3 archivos completos del folder copiar_y_reemplazar y corre npm run build.')


if __name__ == '__main__':
    main()
