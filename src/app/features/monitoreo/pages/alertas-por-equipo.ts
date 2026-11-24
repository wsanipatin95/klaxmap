import { Component, inject, signal } from '@angular/core';
import { NocApi } from '../services/noc-api';

/**
 * Que GENERA alerta cada equipo (routers, breakers y OLTs). Vive en Configuracion > Monitoreo y
 * alertas. Antes estaba en Notificaciones, pero no decide a donde se manda un aviso sino si el
 * aviso existe: es configuracion de monitoreo. Lo que manda cada canal (Telegram, correo...) se
 * elige en el submenu de ese canal.
 */
@Component({
  selector: 'app-alertas-por-equipo',
  standalone: true,
  template: `
    <!-- Equipos Core/Borde/MikroTik: qué alertar de cada uno -->
    <div class="panel" style="margin-top:12px">
      <div class="ph gen"><span class="t"><i class="pi pi-sitemap"></i> Equipos · Core / Borde / MikroTik</span></div>
      <div class="pb" style="padding:0;overflow:auto">
        <table>
          <thead><tr><th>Equipo</th><th>Tipo</th><th>Estado</th>
            @for (c of equipoCols; track c.k) { <th style="text-align:center">{{ c.l }}</th> }
          </tr></thead>
          <tbody>
            @for (d of eqDevs(); track d.id) {
              <tr>
                <td><b>{{ d.name }}</b></td><td>{{ d.device_type }}</td><td [innerHTML]="stBadge(d.status)"></td>
                @for (c of equipoCols; track c.k) {
                  <td style="text-align:center"><input type="checkbox" [checked]="isOn(d,c.k)" (change)="toggle(d,c.k,$any($event.target).checked)"></td>
                }
              </tr>
            } @empty { <tr><td [attr.colspan]="3 + equipoCols.length" style="text-align:center;color:var(--muted);padding:22px">Sin equipos Core/Borde/MikroTik.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Breakers WiFi (energia): sus avisos son de categoria «energia» (generador encendido, rele
         abierto, voltaje, falla). Antes iban en la tabla de routers, que no tenia esa columna: al
         tocar cualquier casilla la categoria se perdia y el aviso del generador dejaba de enviarse. -->
    <div class="panel" style="margin-top:12px">
      <div class="ph gen"><span class="t"><i class="pi pi-bolt"></i> Energía · breakers WiFi</span></div>
      <div class="pb" style="padding:0;overflow:auto">
        <table>
          <thead><tr><th>Breaker</th><th>Rol</th><th>Estado</th>
            @for (c of energiaCols; track c.k) { <th style="text-align:center">{{ c.l }}</th> }
          </tr></thead>
          <tbody>
            @for (d of energiaDevs(); track d.id) {
              <tr>
                <td><b>{{ d.name }}</b></td>
                <td>{{ d.energia_rol === 'generador' ? 'Generador' : 'Red eléctrica' }}</td>
                <td [innerHTML]="stBadge(d.status)"></td>
                @for (c of energiaCols; track c.k) {
                  <td style="text-align:center">
                    @if (c.k === 'down' && d.energia_rol === 'generador') {
                      <span style="color:var(--muted)" title="El breaker del generador no contesta cuando el generador está apagado: eso es lo normal, no se avisa como caída.">no aplica</span>
                    } @else {
                      <input type="checkbox" [checked]="isOn(d,c.k)" (change)="toggle(d,c.k,$any($event.target).checked)">
                    }
                  </td>
                }
              </tr>
            } @empty { <tr><td [attr.colspan]="3 + energiaCols.length" style="text-align:center;color:var(--muted);padding:22px">Sin breakers.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <!-- OLTs: qué alertar -->
    <div class="panel" style="margin-top:12px">
      <div class="ph gen"><span class="t"><i class="pi pi-wifi"></i> OLTs</span></div>
      <div class="pb" style="padding:0;overflow:auto">
        <table>
          <thead><tr><th>OLT</th><th>Estado</th>
            @for (c of oltCols; track c.k) { <th style="text-align:center">{{ c.l }}</th> }
          </tr></thead>
          <tbody>
            @for (d of oltDevs(); track d.id) {
              <tr>
                <td><b>{{ d.name }}</b></td><td [innerHTML]="stBadge(d.status)"></td>
                @for (c of oltCols; track c.k) {
                  <td style="text-align:center"><input type="checkbox" [checked]="isOn(d,c.k)" (change)="toggle(d,c.k,$any($event.target).checked)"></td>
                }
              </tr>
            } @empty { <tr><td [attr.colspan]="2 + oltCols.length" style="text-align:center;color:var(--muted);padding:22px">Sin OLTs.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

  `,
  styles: [`
    .ph { padding:10px 14px; font-size:13.5px; border-radius:12px 12px 0 0; font-weight:700; }
    .ph.gen { background:#fff1e6; color:#c2410c; }
  `],
})
export class AlertasPorEquipo {
  private api = inject(NocApi);
  devs = signal<any[]>([]);

  constructor() {
    this.api.notifyDeviceAlerts().subscribe((d) => this.devs.set(d));
  }

  equipoCols = [
    { k: 'down', l: 'Caída' }, { k: 'cpu', l: 'CPU' }, { k: 'mem', l: 'Memoria' }, { k: 'temp', l: 'Temp' },
    { k: 'iface', l: 'Tráfico if.' }, { k: 'iface_err', l: 'Errores if.' }, { k: 'reboot', l: 'Reinicios' },
  ];
  oltCols = [
    { k: 'down', l: 'Caída' }, { k: 'signal', l: 'Señal clientes' }, { k: 'pon', l: 'Puerto PON' },
    { k: 'lpu', l: 'Tarjeta (LPU)' }, { k: 'cpu', l: 'CPU' }, { k: 'temp', l: 'Temp' },
  ];

  /** Avisos de un breaker: «Energía» agrupa generador encendido, relé abierto, voltaje y falla. */
  energiaCols = [
    { k: 'down', l: 'Sin respuesta' },
    { k: 'energia', l: 'Energía · generador, relé, voltaje, falla' },
  ];

  eqDevs = () => this.devs().filter((d) => d.device_type !== 'olt' && d.device_type !== 'energia');
  energiaDevs = () => this.devs().filter((d) => d.device_type === 'energia');
  oltDevs = () => this.devs().filter((d) => d.device_type === 'olt');

  private colsFor(t: string): string[] {
    return (t === 'olt' ? this.oltCols : t === 'energia' ? this.energiaCols : this.equipoCols).map((c) => c.k);
  }
  /** Categorías habilitadas de un equipo: null = todas (por defecto). */
  private enabled(d: any): string[] {
    return d.alert_cats == null ? this.colsFor(d.device_type) : String(d.alert_cats).split(',').filter(Boolean);
  }
  isOn(d: any, cat: string): boolean { return this.enabled(d).includes(cat); }

  toggle(d: any, cat: string, on: boolean) {
    const set = new Set(this.enabled(d));
    if (on) set.add(cat); else set.delete(cat);
    d.alert_cats = [...set].join(',');
    this.devs.set([...this.devs()]);
    this.api.notifyUpdateDeviceAlert(d.id, { cats: d.alert_cats }).subscribe();
  }

  stBadge(s: string): string {
    if (s === 'up') return '<span class="badge b-up">UP</span>';
    if (s === 'down') return '<span class="badge b-down">DOWN</span>';
    if (s === 'encendido') return '<span class="badge b-gen">GENERADOR ON</span>';
    if (s === 'standby') return '<span class="badge b-maint">EN ESPERA</span>';
    return '<span class="badge b-maint">—</span>';
  }
}
