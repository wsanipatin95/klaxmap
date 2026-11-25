import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';
import { NocNotify } from '../services/noc-notify';
import { AlertasPorEquipo } from './alertas-por-equipo';

/**
 * Umbrales de MONITOREO Y ALERTAS, con 3 niveles por métrica en la MISMA fila.
 *   - GPON (señal óptica): en riesgo / débil / crítica
 *   - Equipos (Core/Borde/MikroTik): mínimo / warning / máximo, para CPU, memoria, temperatura, interfaz.
 */
@Component({
  selector: 'app-salud-gpon-config',
  standalone: true,
  imports: [FormsModule, AlertasPorEquipo],
  template: `
    <div class="panel">
      <div class="pb">
        @if (loaded()) {
          <div class="sec aviso"><i class="pi pi-wifi"></i> GPON · señal óptica del cliente</div>
          <table class="lvl">
            <thead><tr><th>Métrica</th><th>En riesgo</th><th>Débil</th><th>Crítica</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td><b>Señal <span class="u">dBm</span></b></td>
                <td><input class="inp" type="number" step="0.5" [(ngModel)]="map['gpon_rx_warn'].settingValue"></td>
                <td><input class="inp" type="number" step="0.5" [(ngModel)]="map['gpon_rx_weak'].settingValue"></td>
                <td><input class="inp" type="number" step="0.5" [(ngModel)]="map['gpon_rx_crit'].settingValue"></td>
                <td><button class="btn sm" (click)="saveGroup(['gpon_rx_warn','gpon_rx_weak','gpon_rx_crit'])">Guardar</button></td>
              </tr>
            </tbody>
          </table>

          <div class="sec aviso" style="margin-top:22px"><i class="pi pi-sitemap"></i> Equipos · Core / Borde / MikroTik</div>
          <table class="lvl">
            <thead><tr><th>Métrica</th><th>Mínimo</th><th>Warning</th><th>Máximo (crítico)</th><th></th></tr></thead>
            <tbody>
              @for (g of equipoGroups; track g.label) {
                <tr>
                  <td><b>{{ g.label }} <span class="u">{{ g.unit }}</span></b></td>
                  <td><input class="inp" type="number" [(ngModel)]="map[g.keys[0]].settingValue"></td>
                  <td><input class="inp" type="number" [(ngModel)]="map[g.keys[1]].settingValue"></td>
                  <td><input class="inp" type="number" [(ngModel)]="map[g.keys[2]].settingValue"></td>
                  <td><button class="btn sm" (click)="saveGroup(g.keys)">Guardar</button></td>
                </tr>
              }
            </tbody>
          </table>
          <div class="sec aviso" style="margin-top:22px"><i class="pi pi-bolt"></i> Energía · breakers WiFi</div>
          <table class="lvl">
            <thead><tr><th>Aviso</th><th>Activo</th><th>Gravedad</th><th>Valores</th><th></th></tr></thead>
            <tbody>
              <tr>
                <td><b>Lectura del breaker</b></td>
                <td></td><td></td>
                <td>Cada <input class="inp" type="number" min="10" max="3600" [(ngModel)]="map['energia_lectura_cada'].settingValue"> <span class="u">seg</span></td>
                <td><button class="btn sm" (click)="saveEnergia(['energia_lectura_cada'])">Guardar</button></td>
              </tr>
              <tr>
                <td><b>Breaker sin respuesta</b></td>
                <td></td><td></td>
                <td>Marcar caído tras <input class="inp" type="number" min="30" [(ngModel)]="map['device_down_after_seconds'].settingValue"> <span class="u">seg · aplica a todos los equipos</span></td>
                <td><button class="btn sm" (click)="saveEnergia(['device_down_after_seconds'])">Guardar</button></td>
              </tr>
              <tr>
                <td><b>Relé abierto</b> <span class="u">el breaker cortó la energía</span></td>
                <td><input type="checkbox" [checked]="on('energia_alerta_rele')" (change)="set('energia_alerta_rele', $any($event.target).checked)"></td>
                <td><select class="inp" [(ngModel)]="map['energia_sev_rele'].settingValue"><option value="crit">Crítica</option><option value="warn">Aviso</option></select></td>
                <td></td>
                <td><button class="btn sm" (click)="saveEnergia(['energia_alerta_rele', 'energia_sev_rele'])">Guardar</button></td>
              </tr>
              <tr>
                <td><b>Voltaje fuera de rango</b></td>
                <td><input type="checkbox" [checked]="on('energia_alerta_voltaje')" (change)="set('energia_alerta_voltaje', $any($event.target).checked)"></td>
                <td><select class="inp" [(ngModel)]="map['energia_sev_voltaje'].settingValue"><option value="crit">Crítica</option><option value="warn">Aviso</option></select></td>
                <td class="vals">
                  Mín. <input class="inp" type="number" step="1" [(ngModel)]="map['energia_volt_min'].settingValue"> <span class="u">V</span>
                  Máx. <input class="inp" type="number" step="1" [(ngModel)]="map['energia_volt_max'].settingValue"> <span class="u">V</span>
                  Margen para cerrar <input class="inp" type="number" step="0.5" min="0" [(ngModel)]="map['energia_histeresis_v'].settingValue"> <span class="u">V</span>
                </td>
                <td><button class="btn sm" (click)="saveEnergia(['energia_alerta_voltaje', 'energia_sev_voltaje', 'energia_volt_min', 'energia_volt_max', 'energia_histeresis_v'])">Guardar</button></td>
              </tr>
              <tr>
                <td><b>Falla del breaker</b> <span class="u">código que reporta el medidor</span></td>
                <td><input type="checkbox" [checked]="on('energia_alerta_falla')" (change)="set('energia_alerta_falla', $any($event.target).checked)"></td>
                <td><select class="inp" [(ngModel)]="map['energia_sev_falla'].settingValue"><option value="crit">Crítica</option><option value="warn">Aviso</option></select></td>
                <td></td>
                <td><button class="btn sm" (click)="saveEnergia(['energia_alerta_falla', 'energia_sev_falla'])">Guardar</button></td>
              </tr>
            </tbody>
          </table>

          <div class="sec aviso" style="margin-top:22px"><i class="pi pi-bell"></i> Reglas de notificación</div>
          <table class="lvl">
            <thead><tr><th>Regla</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              @for (r of notifyRules; track r.key) {
                <tr>
                  <td><b>{{ r.label }}</b></td>
                  <td><input class="inp" [(ngModel)]="map[r.key].settingValue"> <span class="u">{{ r.unit }}</span></td>
                  <td><button class="btn sm" (click)="saveGroup([r.key])">Guardar</button></td>
                </tr>
              }
            </tbody>
          </table>
        } @else { <div style="color:var(--muted);padding:14px">Cargando…</div> }

        @if (msg()) { <div style="color:var(--green);margin-top:12px;font-weight:600">{{ msg() }}</div> }
      </div>
    </div>

    <!-- Que genera alerta cada equipo (antes en Notificaciones > Que avisar). -->
    <app-alertas-por-equipo />
  `,
  styles: [`
    .sec { font-size:13px; font-weight:700; color:var(--primary); margin-bottom:8px;
           border-bottom:2px solid var(--primary-soft); padding-bottom:6px; }
    table.lvl { width:100%; }
    table.lvl th { text-align:left; }
    table.lvl td { padding:8px 6px; }
    table.lvl input.inp { width:100px; }
    table.lvl select.inp { width:110px; }
    table.lvl td.vals input.inp { width:80px; margin-right:2px; }
    table.lvl td.vals .u { margin-right:12px; }
    .u { color:var(--muted); font-weight:400; font-size:11px; }
  `],
})
export class SaludGponConfig {
  private api = inject(NocApi);
  private notify = inject(NocNotify);
  map: Record<string, any> = {};
  loaded = signal(false);
  msg = signal('');

  equipoGroups = [
    { label: 'CPU', unit: '%', keys: ['alert_cpu_min', 'alert_cpu_warn', 'alert_cpu_max'] },
    { label: 'Memoria', unit: '%', keys: ['alert_mem_min', 'alert_mem_warn', 'alert_mem_max'] },
    { label: 'Temperatura', unit: '°C', keys: ['alert_temp_min', 'alert_temp_warn', 'alert_temp_max'] },
    { label: 'Interfaz · utilización', unit: '%', keys: ['alert_iface_util_min', 'alert_iface_util_warn', 'alert_iface_util_max'] },
    { label: 'Interfaz · tráfico', unit: 'Mbps', keys: ['alert_iface_mbps_min', 'alert_iface_mbps_warn', 'alert_iface_mbps_max'] },
    { label: 'Interfaz · errores', unit: 'pps', keys: ['alert_iface_err_min', 'alert_iface_err_warn', 'alert_iface_err_max'] },
    { label: 'Interfaz · descartes', unit: 'pps', keys: ['alert_iface_disc_min', 'alert_iface_disc_warn', 'alert_iface_disc_max'] },
  ];

  notifyRules = [
    { key: 'alert_confirm_polls', label: 'Confirmar alerta tras N barridos (anti-flap)', unit: 'barridos' },
    { key: 'alert_pon_mass_down', label: 'Caída masiva: ONUs caídas por puerto para agrupar', unit: 'ONUs' },
    { key: 'alert_pon_mass_ventana_min', label: 'Caída masiva: solo cuentan las ONU caídas en los últimos', unit: 'minutos' },
    { key: 'onu_abandonada_horas', label: 'ONU abandonada (no desenganchada): caída más de', unit: 'horas' },
    { key: 'alert_require_client', label: 'No alertar ONUs sin cliente (1=sí, 0=no)', unit: '' },
    { key: 'alert_iface_sin_velocidad', label: 'Alertar carga de interfaces sin velocidad conocida, como L2TP o túneles (1=sí, 0=no)', unit: '' },
    { key: 'notify_quiet_from', label: 'Horario silencio: desde (hora 0-23, vacío=off)', unit: 'h' },
    { key: 'notify_quiet_to', label: 'Horario silencio: hasta (hora 0-23)', unit: 'h' },
    { key: 'notify_quiet_only_crit', label: 'En silencio solo enviar críticas (1=sí)', unit: '' },
  ];

  constructor() {
    this.api.settings().subscribe({
      next: (s) => {
        s.forEach((x) => (this.map[x.settingKey] = x));
        // Asegura que las claves esperadas existan (evita errores si falta alguna migración).
        ['gpon_rx_warn', 'gpon_rx_weak', 'gpon_rx_crit',
         ...this.equipoGroups.flatMap((g) => g.keys),
         ...this.notifyRules.map((r) => r.key), ...this.energiaKeys].forEach((k) => { if (!this.map[k]) this.map[k] = { settingKey: k, settingValue: '', unit: '' }; });
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  /** Ajustes de los breakers WiFi (V127 del NOC + el umbral de caída general). */
  energiaKeys = ['energia_lectura_cada', 'device_down_after_seconds', 'energia_alerta_rele', 'energia_sev_rele',
                 'energia_alerta_voltaje', 'energia_sev_voltaje', 'energia_volt_min', 'energia_volt_max',
                 'energia_histeresis_v', 'energia_alerta_falla', 'energia_sev_falla'];

  on(k: string): boolean {
    const v = String(this.map[k]?.settingValue ?? '1').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'on';
  }

  set(k: string, activo: boolean) { this.map[k].settingValue = activo ? '1' : '0'; }

  /** Valida antes de guardar: un rango al revés o un margen mayor que el rango dejaría la alerta sin sentido. */
  saveEnergia(keys: string[]) {
    const n = (k: string) => Number(this.map[k]?.settingValue);
    if (keys.includes('energia_lectura_cada') && !(n('energia_lectura_cada') >= 10 && n('energia_lectura_cada') <= 3600)) {
      this.notify.error('La lectura debe ser entre 10 y 3600 segundos.'); return;
    }
    if (keys.includes('device_down_after_seconds') && !(n('device_down_after_seconds') >= 30)) {
      this.notify.error('El tiempo para marcar caído debe ser de al menos 30 segundos.'); return;
    }
    if (keys.includes('energia_volt_min')) {
      const min = n('energia_volt_min'), max = n('energia_volt_max'), m = n('energia_histeresis_v');
      if (!(min > 0 && max > min)) { this.notify.error('El voltaje máximo tiene que ser mayor que el mínimo.'); return; }
      if (!(m >= 0 && m * 2 < max - min)) { this.notify.error('El margen tiene que ser menor que la mitad del rango.'); return; }
    }
    this.saveGroup(keys);
  }

  saveGroup(keys: string[]) {
    let done = 0;
    keys.forEach((k) => {
      const s = this.map[k];
      if (!s) { done++; return; }
      this.api.updateSetting(k, String(s.settingValue)).subscribe({
        next: () => { if (++done === keys.length) { this.flash('Umbrales guardados.'); this.notify.ok('Configuración de Salud GPON guardada.'); } },
        error: () => { this.flash('No se pudo guardar.'); this.notify.error('No se pudo guardar la configuración de Salud GPON.'); },
      });
    });
  }

  private flash(m: string) { this.msg.set(m); setTimeout(() => { if (this.msg() === m) this.msg.set(''); }, 3500); }
}
