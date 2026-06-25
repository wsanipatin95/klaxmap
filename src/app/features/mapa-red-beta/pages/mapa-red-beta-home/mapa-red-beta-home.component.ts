import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { RedBetaFacade } from '../../application/red-beta.facade';
import type { RedSeleccion } from '../../application/red-beta.facade';
import { RedBetaCapasStore } from '../../store/red-beta-capas.store';
import type { RedAccionEvento, RedCapaKey } from '../../data-access/red-beta.models';

import { RedBetaMapComponent } from '../../components/red-beta-map/red-beta-map.component';
import { RedBetaToolbarComponent, RedProcesoKind } from '../../components/red-beta-toolbar/red-beta-toolbar.component';
import { RedBetaLayerPanelComponent } from '../../components/red-beta-layer-panel/red-beta-layer-panel.component';
import { RedBetaLeyendaComponent } from '../../components/red-beta-leyenda/red-beta-leyenda.component';
import { RedBetaResumenPanelComponent } from '../../components/red-beta-resumen-panel/red-beta-resumen-panel.component';
import { RedBetaRelacionesPanelComponent } from '../../components/red-beta-relaciones-panel/red-beta-relaciones-panel.component';
import { RedBetaSplittersPanelComponent } from '../../components/red-beta-splitters-panel/red-beta-splitters-panel.component';
import { RedBetaPonFoPanelComponent } from '../../components/red-beta-pon-fo-panel/red-beta-pon-fo-panel.component';
import { RedBetaHilosPanelComponent } from '../../components/red-beta-hilos-panel/red-beta-hilos-panel.component';
import { RedBetaPuertosPanelComponent } from '../../components/red-beta-puertos-panel/red-beta-puertos-panel.component';
import { RedBetaConflictosPanelComponent } from '../../components/red-beta-conflictos-panel/red-beta-conflictos-panel.component';
import { RedBetaDetallePanelComponent } from '../../components/red-beta-detalle-panel/red-beta-detalle-panel.component';
import { RedBetaProcesoDialogComponent, RedProcesoParams } from '../../components/red-beta-proceso-dialog/red-beta-proceso-dialog.component';

type TabKey = 'resumen' | 'relaciones' | 'splitters' | 'ponfo' | 'hilos' | 'puertos' | 'conflictos';

/**
 * Pantalla principal de la beta de red operativa (/app/mapa-red-beta).
 * Mapa fisico base + capas de red operativa, paneles por bloque y panel de detalle explicativo.
 * No toca el mapa principal /app/mapa; reutiliza Leaflet, el envelope y el endpoint de elementos.
 */
@Component({
  selector: 'app-mapa-red-beta-home',
  standalone: true,
  providers: [RedBetaFacade, RedBetaCapasStore],
  imports: [
    RedBetaMapComponent,
    RedBetaToolbarComponent,
    RedBetaLayerPanelComponent,
    RedBetaLeyendaComponent,
    RedBetaResumenPanelComponent,
    RedBetaRelacionesPanelComponent,
    RedBetaSplittersPanelComponent,
    RedBetaPonFoPanelComponent,
    RedBetaHilosPanelComponent,
    RedBetaPuertosPanelComponent,
    RedBetaConflictosPanelComponent,
    RedBetaDetallePanelComponent,
    RedBetaProcesoDialogComponent,
  ],
  template: `
    <div class="flex flex-col h-[calc(100vh-4rem)] p-3 gap-3 bg-slate-100">
      <!-- Toolbar -->
      <div class="bg-white rounded-lg shadow-sm p-3">
        <app-red-beta-toolbar [loading]="facade.loading()" (recargar)="facade.cargarTodo()" (proceso)="onProceso($event)" />
      </div>

      <!-- Avisos -->
      @if (facade.error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{{ facade.error() }}</div>
      }
      @if (facade.mensaje()) {
        <div class="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-2">{{ facade.mensaje() }}</div>
      }

      <!-- Cuerpo: izquierda capas/leyenda | centro mapa | derecha paneles -->
      <div class="flex-1 grid grid-cols-12 gap-3 min-h-0">
        <!-- Izquierda -->
        <aside class="col-span-12 lg:col-span-2 bg-white rounded-lg shadow-sm p-3 space-y-4 overflow-auto" [class.hidden]="!panelIzq()">
          <app-red-beta-layer-panel [hidden]="capas.ocultas()" (toggle)="onToggleCapa($event)" />
          <hr class="border-slate-100" />
          <app-red-beta-leyenda />
        </aside>

        <!-- Centro: mapa -->
        <section
          class="col-span-12 bg-white rounded-lg shadow-sm p-2 min-h-[60vh] flex flex-col"
          [class.lg:col-span-6]="panelIzq() && panelDer()"
          [class.lg:col-span-8]="!panelIzq() && panelDer()"
          [class.lg:col-span-10]="panelIzq() && !panelDer()"
          [class.lg:col-span-12]="!panelIzq() && !panelDer()"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <button class="ctrl" (click)="panelIzq.set(!panelIzq())" title="Mostrar/ocultar capas">&#9776; Capas</button>
              <button class="ctrl" (click)="panelDer.set(!panelDer())" title="Mostrar/ocultar paneles">&#9776; Paneles</button>
            </div>
            <button class="ctrl" (click)="etiquetasBase.set(!etiquetasBase())">
              {{ etiquetasBase() ? 'Ocultar etiquetas' : 'Mostrar etiquetas' }}
            </button>
          </div>
          <app-red-beta-map
            class="block flex-1 w-full"
            [baseElementos]="facade.baseElementos()"
            [relaciones]="facade.relaciones()"
            [splitters]="facade.splitters()"
            [ponFo]="facade.ponFo()"
            [hilos]="facade.hilos()"
            [puertos]="facade.puertos()"
            [hiddenCapas]="capas.ocultas()"
            [etiquetas]="etiquetasBase()"
            [seleccion]="facade.seleccion()"
            (seleccionar)="facade.seleccionar($event)"
          />
        </section>

        <!-- Derecha: tabs de paneles + detalle -->
        <aside class="col-span-12 lg:col-span-4 flex flex-col gap-3 min-h-0" [class.hidden]="!panelDer()">
          <div class="bg-white rounded-lg shadow-sm p-3 flex-1 overflow-auto">
            <div class="flex flex-wrap gap-1 mb-3">
              @for (t of tabs; track t.key) {
                <button
                  class="px-2 py-1 text-xs rounded-md border"
                  [class.bg-blue-600]="tab() === t.key"
                  [class.text-white]="tab() === t.key"
                  [class.border-blue-600]="tab() === t.key"
                  [class.text-slate-600]="tab() !== t.key"
                  [class.border-slate-200]="tab() !== t.key"
                  (click)="tab.set(t.key)"
                >
                  {{ t.label }}
                </button>
              }
            </div>

            @switch (tab()) {
              @case ('resumen') { <app-red-beta-resumen-panel [items]="facade.resumen()" /> }
              @case ('relaciones') {
                <app-red-beta-relaciones-panel [items]="facade.relaciones()" (seleccionar)="facade.seleccionar($event)" (accionEmit)="onAccion($event)" />
              }
              @case ('splitters') {
                <app-red-beta-splitters-panel [items]="facade.splitters()" (seleccionar)="facade.seleccionar($event)" (accionEmit)="onAccion($event)" />
              }
              @case ('ponfo') { <app-red-beta-pon-fo-panel [items]="facade.ponFo()" (seleccionar)="facade.seleccionar($event)" /> }
              @case ('hilos') { <app-red-beta-hilos-panel [items]="facade.hilos()" (seleccionar)="facade.seleccionar($event)" /> }
              @case ('puertos') { <app-red-beta-puertos-panel [items]="facade.puertos()" (seleccionar)="facade.seleccionar($event)" /> }
              @case ('conflictos') { <app-red-beta-conflictos-panel [data]="facade.conflictos()" (seleccionar)="facade.seleccionar($event)" /> }
            }
          </div>

          <div class="bg-white rounded-lg shadow-sm p-3 max-h-[45%] overflow-auto">
            <h3 class="font-semibold text-slate-700 mb-2">Detalle / explicacion</h3>
            <app-red-beta-detalle-panel [seleccionInput]="facade.seleccion()" [conexiones]="facade.conexiones()" [puertos]="facade.puertosSeleccion()" (accionEmit)="onAccion($event)" (irA)="facade.seleccionar($event)" />
          </div>
        </aside>
      </div>

      <app-red-beta-proceso-dialog
        [kind]="procesoPendiente()"
        (confirmar)="onConfirmarProceso($event)"
        (cancelar)="procesoPendiente.set(null)"
      />
    </div>
  `,
  styles: [
    `.ctrl{font-size:.72rem;padding:.2rem .6rem;border-radius:.375rem;border:1px solid #cbd5e1;color:#475569;background:#fff;}
     .ctrl:hover{background:#f1f5f9;}`,
  ],
})
export class MapaRedBetaHomeComponent implements OnInit {
  readonly facade = inject(RedBetaFacade);
  readonly capas = inject(RedBetaCapasStore);

  readonly tab = signal<TabKey>('resumen');
  readonly panelIzq = signal(false);
  readonly panelDer = signal(true);
  readonly etiquetasBase = signal(true);
  readonly procesoPendiente = signal<RedProcesoKind | null>(null);
  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'relaciones', label: 'Relaciones' },
    { key: 'splitters', label: 'Splitters' },
    { key: 'ponfo', label: 'PON→FO' },
    { key: 'hilos', label: 'Hilos' },
    { key: 'puertos', label: 'Puertos' },
    { key: 'conflictos', label: 'Conflictos' },
  ];

  // referenciado para evitar warnings de import no usado en algunos linters
  readonly conflictosTotal = computed(() => this.facade.conflictos().total);

  ngOnInit(): void {
    this.facade.cargarTodo();
  }

  onToggleCapa(key: RedCapaKey) {
    this.capas.toggle(key);
  }

  onAccion(ev: RedAccionEvento) {
    this.facade.ejecutarAccion(ev);
  }

  onProceso(kind: RedProcesoKind) {
    this.procesoPendiente.set(kind);
  }

  onConfirmarProceso(ev: { kind: RedProcesoKind; params: RedProcesoParams }) {
    this.procesoPendiente.set(null);
    this.facade.generar(ev.kind, ev.params);
  }

  onSeleccion(sel: RedSeleccion) {
    this.facade.seleccionar(sel);
  }
}
