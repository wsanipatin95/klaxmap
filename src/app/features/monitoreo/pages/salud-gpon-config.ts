import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

/**
 * Umbrales de MONITOREO Y ALERTAS, con 3 niveles por métrica en la MISMA fila.
 *   - GPON (señal óptica): en riesgo / débil / crítica
 *   - Equipos (Core/Borde/MikroTik): mínimo / warning / máximo, para CPU, memoria, temperatura, interfaz.
 */
@Component({
  selector: 'app-salud-gpon-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="panel">
      <div class="pb">
        @if (loaded()) {
          <div class="sec">📡 GPON · señal óptica del cliente</div>
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

          <div class="sec" style="margin-top:22px">🖧 Equipos · Core / Borde / MikroTik</div>
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
          <div class="sec" style="margin-top:22px">🔔 Reglas de notificación</div>
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
  `,
  styles: [`
    .sec { font-size:13px; font-weight:700; color:var(--primary); margin-bottom:8px;
           border-bottom:2px solid var(--primary-soft); padding-bottom:6px; }
    table.lvl { width:100%; }
    table.lvl th { text-align:left; }
    table.lvl td { padding:8px 6px; }
    table.lvl input.inp { width:100px; }
    .u { color:var(--muted); font-weight:400; font-size:11px; }
  `],
})
export class SaludGponConfig {
  private api = inject(NocApi);
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
    { key: 'alert_require_client', label: 'No alertar ONUs sin cliente (1=sí, 0=no)', unit: '' },
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
         ...this.notifyRules.map((r) => r.key)].forEach((k) => { if (!this.map[k]) this.map[k] = { settingKey: k, settingValue: '', unit: '' }; });
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  saveGroup(keys: string[]) {
    let done = 0;
    keys.forEach((k) => {
      const s = this.map[k];
      if (!s) { done++; return; }
      this.api.updateSetting(k, String(s.settingValue)).subscribe({
        next: () => { if (++done === keys.length) this.flash('✓ Umbrales guardados.'); },
        error: () => this.flash('No se pudo guardar.'),
      });
    });
  }

  private flash(m: string) { this.msg.set(m); setTimeout(() => { if (this.msg() === m) this.msg.set(''); }, 3500); }
}
