import { Component, signal } from '@angular/core';
import { TiemposConfig } from './tiempos';
import { Notificaciones } from './notificaciones';
import { SaludGponConfig } from './salud-gpon-config';
import { OltConfig } from './olt-config';
import { CatalogoComandos } from './catalogo-comandos';

/**
 * Página única de Configuración con pestañas. Agrupa los módulos configurables
 * (Tiempos, Notificaciones y a futuro Umbrales/Seguridad) en un solo lugar.
 */
@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [TiemposConfig, Notificaciones, SaludGponConfig, OltConfig, CatalogoComandos],
  template: `
    <div class="tools">
      <span style="font-weight:700;font-size:16px">⚙️ Configuración</span>
    </div>

    <div class="ctabs">
      <button [class.on]="tab()==='tiempos'" (click)="tab.set('tiempos')">⏱ Tiempos</button>
      <button [class.on]="tab()==='gpon'" (click)="tab.set('gpon')">🩺 Monitoreo y alertas</button>
      <button [class.on]="tab()==='notif'" (click)="tab.set('notif')">🔔 Notificaciones</button>
      <button [class.on]="tab()==='olt'" (click)="tab.set('olt')">🛠️ Configurar OLT</button>
      <button [class.on]="tab()==='catalogo'" (click)="tab.set('catalogo')">📜 Catálogo de comandos</button>
    </div>

    @if (tab() === 'tiempos') { <app-tiempos /> }
    @else if (tab() === 'gpon') { <app-salud-gpon-config /> }
    @else if (tab() === 'olt') { <app-olt-config /> }
    @else if (tab() === 'catalogo') { <app-catalogo-comandos /> }
    @else { <app-notificaciones /> }
  `,
  styles: [`
    .ctabs { display:flex; gap:6px; margin-bottom:14px; border-bottom:1px solid var(--border); }
    .ctabs button { border:none; background:none; padding:9px 16px; font-size:13.5px; font-weight:600;
                    color:var(--muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
    .ctabs button.on { color:#7b0061; border-bottom-color:#7b0061; }
  `],
})
export class Configuracion {
  tab = signal<'tiempos' | 'gpon' | 'notif' | 'olt' | 'catalogo'>('tiempos');
}
