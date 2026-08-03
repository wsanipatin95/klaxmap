import { Component, inject, signal } from '@angular/core';
import { NocApi, Iface } from '../services/noc-api';
import { fmtBps, fmtCap } from '../shared/charts';

@Component({
  selector: 'app-interfaces',
  standalone: true,
  template: `
    <div class="tools"><span style="font-weight:600;font-size:15px">⇄ Interfaces / LACP</span><span style="color:var(--muted);font-size:12.5px">— {{ list().length }} interfaces</span></div>
    <div class="panel">
      <table>
        <thead><tr><th>Equipo</th><th>Interfaz</th><th>Alias NOC</th><th>Uso</th><th>Capacidad</th><th>RX</th><th>TX</th><th>Utilización</th><th>Errores</th><th>Estado</th></tr></thead>
        <tbody>
          @for (f of list(); track f.id) {
            <tr>
              <td style="font-size:12px">{{ f.device_name }}</td>
              <td class="mono">{{ f.real_name }}</td>
              <td><b>{{ f.noc_alias }}</b></td>
              <td>{{ f.usage_type }}</td>
              <td>{{ cap(f.capacity_bps) }}</td>
              <td>{{ bps(f.rx_bps) }}</td>
              <td>{{ bps(f.tx_bps) }}</td>
              <td>@if (f.status==='up') { <span class="ubar"><i [style.width.%]="f.util_percent" [style.background]="uc(f.util_percent)"></i></span>{{ f.util_percent }}% } @else { — }</td>
              <td>{{ f.errors }}</td>
              <td [innerHTML]="badge(f.status)"></td>
            </tr>
          } @empty {
            <tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">Sin interfaces. Habilita SNMP en un equipo para descubrirlas.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class Interfaces {
  private api = inject(NocApi);
  cap = fmtCap; bps = fmtBps;
  list = signal<Iface[]>([]);
  constructor() { this.api.interfaces().subscribe((d) => this.list.set(d)); }
  uc(u: number) { return u >= 90 ? '#dc2626' : u >= 80 ? '#d97706' : '#16a34a'; }
  badge(s: string) { return s === 'up' ? '<span class="badge b-up">UP</span>' : s === 'down' ? '<span class="badge b-down">DOWN</span>' : '<span class="badge b-maint">UNKNOWN</span>'; }
}
