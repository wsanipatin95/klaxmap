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
 * Pantalla principal de la beta (/app/mapa-red-beta).
 * Lista (izq, se oculta con un boton) | mapa (centro, toolbar + panel flotante) |
 * inspector (der) que solo aparece cuando hay un elemento enfocado y se cierra con la X.
 * No toca /app/mapa.
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
    <div class="flex flex-col h-[calc(100vh-4rem)] p-2 gap-2 bg-slate-100">
      <!-- Avisos (banda fina, solo si hay) -->
      @if (facade.error()) {
        <div class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-1.5">{{ facade.error() }}</div>
      }
      @if (facade.mensaje()) {
        <div class="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md px-3 py-1.5">{{ facade.mensaje() }}</div>
      }

      <div class="flex-1 grid grid-cols-12 gap-2 min-h-0">
        <!-- IZQUIERDA: tabs + lista (compacta) -->
        <aside class="col-span-12 lg:col-span-3 bg-white rounded-lg shadow-sm p-2 flex flex-col min-h-0" [class.hidden]="!panelLista()">
          <div class="flex flex-wrap gap-1 mb-2">
            @for (t of tabs; track t.key) {
              <button
                class="px-1.5 py-0.5 text-[11px] rounded border"
                [class.bg-blue-600]="tab() === t.key"
                [class.text-white]="tab() === t.key"
                [class.border-blue-600]="tab() === t.key"
                [class.text-slate-600]="tab() !== t.key"
                [class.border-slate-200]="tab() !== t.key"
                (click)="tab.set(t.key)"
              >{{ t.label }}</button>
            }
          </div>
          <div class="flex-1 overflow-auto pr-1">
            @switch (tab()) {
              @case ('resumen') { <app-red-beta-resumen-panel [items]="facade.resumen()" /> }
              @case ('relaciones') {
                <app-red-beta-relaciones-panel [items]="facade.relaciones()" [selectedKey]="facade.selectedKey()" (seleccionar)="elegir($event)" (accionEmit)="onAccion($event)" />
              }
              @case ('splitters') {
                <app-red-beta-splitters-panel [items]="facade.splitters()" [selectedKey]="facade.selectedKey()" (seleccionar)="elegir($event)" (accionEmit)="onAccion($event)" />
              }
              @case ('ponfo') { <app-red-beta-pon-fo-panel [items]="facade.ponFo()" [selectedKey]="facade.selectedKey()" (seleccionar)="elegir($event)" /> }
              @case ('hilos') { <app-red-beta-hilos-panel [items]="facade.hilos()" [selectedKey]="facade.selectedKey()" (seleccionar)="elegir($event)" /> }
              @case ('puertos') { <app-red-beta-puertos-panel [items]="facade.puertos()" [selectedKey]="facade.selectedKey()" (seleccionar)="elegir($event)" /> }
              @case ('conflictos') { <app-red-beta-conflictos-panel [data]="facade.conflictos()" (seleccionar)="elegir($event)" /> }
            }
          </div>
        </aside>

        <!-- CENTRO: mapa -->
        <section
          class="col-span-12 bg-white rounded-lg shadow-sm p-2 min-h-[60vh] flex flex-col"
          [class.lg:col-span-5]="panelLista() && !!facade.seleccion()"
          [class.lg:col-span-9]="panelLista() && !facade.seleccion()"
          [class.lg:col-span-8]="!panelLista() && !!facade.seleccion()"
          [class.lg:col-span-12]="!panelLista() && !facade.seleccion()"
        >
          <div class="flex items-center gap-1.5 mb-2">
            <button class="cic" (click)="panelLista.set(!panelLista())" [title]="panelLista() ? 'Ocultar lista' : 'Mostrar lista'" aria-label="Lista">&#9776;</button>
            <button class="cic" [class.cic-on]="etiquetasBase()" (click)="etiquetasBase.set(!etiquetasBase())" [title]="etiquetasBase() ? 'Ocultar etiquetas' : 'Mostrar etiquetas'" aria-label="Etiquetas">Aa</button>
            <div class="h-5 w-px bg-slate-200 mx-0.5"></div>
            <app-red-beta-toolbar [loading]="facade.loading()" (recargar)="facade.cargarTodo()" (proceso)="onProceso($event)" />
          </div>

          <div class="relative flex-1 min-h-0">
            <app-red-beta-map
              class="block h-full w-full"
              [baseElementos]="facade.baseElementos()"
              [relaciones]="facade.relaciones()"
              [splitters]="facade.splitters()"
              [ponFo]="facade.ponFo()"
              [hilos]="facade.hilos()"
              [puertos]="facade.puertos()"
              [hiddenCapas]="capas.ocultas()"
              [etiquetas]="etiquetasBase()"
              [seleccion]="facade.seleccion()"
              [relatedGeoIds]="facade.relatedGeoIds()"
              [soloAnillo]="facade.soloAnillo()"
              [centrarReq]="facade.centrarReq()"
              (seleccionar)="onFocus($event)"
            />

            <!-- Panel de capas/leyenda: esquina inferior izquierda, colapsado por defecto -->
            <div class="rb-float">
              @if (!floatOpen()) {
                <button class="rb-chip" (click)="floatOpen.set(true)" title="Mostrar capas y leyenda">&#9636; Capas / leyenda</button>
              } @else {
                <div class="rb-float-body">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-bold text-slate-700">Capas / leyenda</span>
                    <button class="rb-min" (click)="floatOpen.set(false)" title="Colapsar">&#8211;</button>
                  </div>
                  <div class="space-y-2">
                    <app-red-beta-layer-panel [hidden]="capas.ocultas()" (toggle)="onToggleCapa($event)" />
                    <hr class="border-slate-100" />
                    <app-red-beta-leyenda />
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- DERECHA: inspector — solo aparece cuando hay un elemento enfocado -->
        @if (facade.seleccion()) {
          <aside class="col-span-12 lg:col-span-4 bg-white rounded-lg shadow-sm p-3 flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-2 shrink-0">
              <h3 class="font-semibold text-slate-700">Inspector</h3>
              <div class="flex items-center gap-1">
                <button class="ctrl" (click)="inspectorModal.set(true)" title="Ver el inspector en grande">&#10530; Ampliar</button>
                <button class="ctrl ctrl-x" (click)="cerrarInspector()" title="Cerrar inspector (deseleccionar)">&#10005;</button>
              </div>
            </div>
            <div class="flex-1 overflow-auto pr-1">
              <app-red-beta-detalle-panel [seleccionInput]="facade.seleccion()" [conexiones]="facade.conexiones()" [puertos]="facade.puertosSeleccion()" [anillo]="facade.anillo()" [soloAnillo]="facade.soloAnillo()" [hilosCandidatos]="facade.hilosCandidatos()" [destinoCandidatos]="facade.destinoCandidatos()" [puedeVolver]="historial().length > 0" (accionEmit)="onAccion($event)" (irA)="navegar($event)" (volver)="volver()" (centrar)="facade.centrar()" (verAnillo)="facade.toggleSoloAnillo()" />
            </div>
          </aside>
        }
      </div>

      <!-- Modal del inspector (Ampliar) -->
      @if (inspectorModal() && facade.seleccion()) {
        <div class="fixed inset-0 z-[2000] bg-black/40 flex items-start justify-center p-4 overflow-auto" (click)="inspectorModal.set(false)">
          <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-6 max-h-[88vh] overflow-auto p-5" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-3 sticky top-0 bg-white pb-2 border-b border-slate-100">
              <h3 class="font-bold text-slate-800">Inspector detallado</h3>
              <button class="ctrl" (click)="inspectorModal.set(false)" title="Cerrar">&#10005; Cerrar</button>
            </div>
            <app-red-beta-detalle-panel [seleccionInput]="facade.seleccion()" [conexiones]="facade.conexiones()" [puertos]="facade.puertosSeleccion()" [anillo]="facade.anillo()" [soloAnillo]="facade.soloAnillo()" [hilosCandidatos]="facade.hilosCandidatos()" [destinoCandidatos]="facade.destinoCandidatos()" [puedeVolver]="historial().length > 0" (accionEmit)="onAccion($event)" (irA)="navegar($event)" (volver)="volver()" (centrar)="facade.centrar()" (verAnillo)="facade.toggleSoloAnillo()" />
          </div>
        </div>
      }

      <app-red-beta-proceso-dialog
        [kind]="procesoPendiente()"
        (confirmar)="onConfirmarProceso($event)"
        (cancelar)="procesoPendiente.set(null)"
      />
    </div>
  `,
  styles: [
    `.ctrl{font-size:.72rem;padding:.2rem .6rem;border-radius:.375rem;border:1px solid #cbd5e1;color:#475569;background:#fff;cursor:pointer;}
     .ctrl:hover{background:#f1f5f9;}
     .ctrl:disabled{opacity:.45;cursor:default;}
     .ctrl-x:hover{background:#fee2e2;border-color:#ef4444;color:#b91c1c;}
     .rb-float{position:absolute;bottom:.5rem;left:.5rem;z-index:1100;max-width:14rem;}
     .rb-float-body{width:13rem;max-height:calc(100vh - 16rem);overflow:auto;background:rgba(255,255,255,.97);border:1px solid #e2e8f0;border-radius:.6rem;box-shadow:0 6px 20px rgba(15,23,42,.18);padding:.55rem .65rem;backdrop-filter:blur(2px);}
     .rb-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;color:#334155;background:rgba(255,255,255,.97);border:1px solid #cbd5e1;border-radius:.5rem;padding:.3rem .55rem;box-shadow:0 4px 14px rgba(15,23,42,.15);cursor:pointer;}
     .rb-chip:hover{background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;}
     .cic{width:1.85rem;height:1.85rem;display:inline-flex;align-items:center;justify-content:center;font-size:.9rem;line-height:1;border-radius:.5rem;border:1px solid #cbd5e1;color:#475569;background:#fff;cursor:pointer;}
     .cic:hover{background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;}
     .cic-on{background:#dbeafe;border-color:#3b82f6;color:#1d4ed8;}
     .rb-min{width:1.4rem;height:1.4rem;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;line-height:1;border-radius:.35rem;border:1px solid #cbd5e1;color:#475569;background:#fff;cursor:pointer;}
     .rb-min:hover{background:#eff6ff;border-color:#3b82f6;color:#1d4ed8;}`,
  ],
})
export class MapaRedBetaHomeComponent implements OnInit {
  readonly facade = inject(RedBetaFacade);
  readonly capas = inject(RedBetaCapasStore);

  readonly tab = signal<TabKey>('resumen');
  readonly panelLista = signal(true);
  readonly floatOpen = signal(false);
  readonly inspectorModal = signal(false);
  readonly etiquetasBase = signal(false);
  readonly procesoPendiente = signal<RedProcesoKind | null>(null);
  readonly historial = signal<RedSeleccion[]>([]);
  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'relaciones', label: 'Relaciones' },
    { key: 'splitters', label: 'Splitters' },
    { key: 'ponfo', label: 'PON→FO' },
    { key: 'hilos', label: 'Hilos' },
    { key: 'puertos', label: 'Puertos' },
    { key: 'conflictos', label: 'Conflictos' },
  ];

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

  /** Cierra el inspector: deselecciona el elemento (el panel desaparece). */
  cerrarInspector() {
    this.inspectorModal.set(false);
    this.facade.seleccionar(null);
    this.historial.set([]);
  }

  /** Cambia la pestaña de la lista al tipo del elemento, para no perder el foco. */
  private switchTab(sel: RedSeleccion) {
    const map: Partial<Record<string, TabKey>> = {
      relacion: 'relaciones', splitter: 'splitters', ponfo: 'ponfo', hilo: 'hilos', puerto: 'puertos',
    };
    const t = map[sel.tipo];
    if (t && this.tab() !== t) this.tab.set(t);
  }

  private descripcion(sel: RedSeleccion): string {
    const d = sel.data;
    switch (sel.tipo) {
      case 'relacion': return `${d.origenNombre} \u2192 ${d.destinoNombre}`;
      case 'splitter': return d.nombreOperativo;
      case 'ponfo': return `VLAN ${d.idRedVlanFk} \u2192 ${d.elementoNombre}`;
      case 'hilo': return `Hilo ${d.numeroHilo} ${d.colorHilo}`;
      case 'puerto': return `${d.nombrePuerto} de ${d.dispositivoNombre}`;
      case 'base': return d.etiqueta || d.nombre || '';
      default: return '';
    }
  }

  /** Clic en el MAPA: enfoca y sincroniza pestaña, sin mover el mapa (ya estas viendo ese punto). */
  onFocus(sel: RedSeleccion) {
    this.historial.set([]);
    this.facade.soloAnillo.set(false);
    this.facade.seleccionar(sel);
    this.switchTab(sel);
  }

  /** Seleccion desde una LISTA: enfoca, marca y centra el mapa (el item puede estar lejos). */
  elegir(sel: RedSeleccion) {
    this.historial.set([]);
    this.facade.soloAnillo.set(false);
    this.facade.seleccionar(sel);
    this.switchTab(sel);
    this.facade.centrar();
  }

  /** Navegacion desde el ARBOL ("Abrir"): enfoca SIN saltar el mapa, avisa y guarda historial para volver. */
  navegar(sel: RedSeleccion) {
    const cur = this.facade.seleccion();
    if (cur) this.historial.update((h) => [...h, cur]);
    this.facade.seleccionar(sel);
    this.switchTab(sel);
    this.facade.error.set(null);
    this.facade.mensaje.set('Abriste: ' + this.descripcion(sel) + '. Pulsa "Centrar" para verlo en el mapa.');
  }

  /** Vuelve al elemento anterior del historial de navegacion. */
  volver() {
    const h = this.historial();
    if (!h.length) return;
    const prev = h[h.length - 1];
    this.historial.set(h.slice(0, -1));
    this.facade.seleccionar(prev);
    this.switchTab(prev);
  }
}
