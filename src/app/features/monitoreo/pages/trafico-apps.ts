import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { NocApi } from '../services/noc-api';

/**
 * MONITOREO · Tráfico por aplicación (NetFlow).
 * Muestra qué consumen más los clientes (YouTube, TikTok, Netflix, Meta…) según
 * los flujos que exporta el MikroTik. El colector es pasivo; nada toca al cliente.
 */
@Component({
  selector: 'app-trafico-apps',
  standalone: true,
  imports: [],
  template: `
    <div class="tools">
      <span style="font-weight:700;font-size:16px">📺 Tráfico por aplicación</span>
      <div class="ctabs" style="margin-left:12px">
        <button [class.on]="dir()==='d'" (click)="setDir('d')">⬇ Bajada</button>
        <button [class.on]="dir()==='u'" (click)="setDir('u')">⬆ Subida</button>
      </div>
      <div class="ctabs" style="margin-left:8px">
        <button [class.on]="hours()===1" (click)="setHours(1)">1h</button>
        <button [class.on]="hours()===6" (click)="setHours(6)">6h</button>
        <button [class.on]="hours()===24" (click)="setHours(24)">24h</button>
      </div>
      <span style="margin-left:auto;font-size:12px;color:var(--muted)">Actualizado {{ clock() }}</span>
    </div>

    <!-- Estado del colector -->
    <div class="panel"><div class="pb">
      @if (st(); as s) {
        @if (s.receiving) {
          <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;font-size:12.5px">
            <span class="badge" style="background:#e8f5e9;color:var(--green)">● Recibiendo flujos</span>
            <div><span style="color:var(--muted)">Puerto UDP</span><br><b class="mono">{{ s.port }}</b></div>
            <div><span style="color:var(--muted)">Exportador</span><br><b class="mono">{{ s.lastExporter || '—' }}</b></div>
            <div><span style="color:var(--muted)">Paquetes</span><br><b>{{ s.packetsTotal }}</b></div>
            <div><span style="color:var(--muted)">Flujos</span><br><b>{{ s.flowsTotal }}</b></div>
            <div><span style="color:var(--muted)">Último paquete</span><br><b>hace {{ s.secsSincePacket }} s</b></div>
          </div>
        } @else {
          <div style="display:flex;gap:10px;align-items:flex-start">
            <span style="font-size:18px">⏳</span>
            <div style="font-size:12.5px">
              <b style="color:#b26a00">Esperando flujos del MikroTik…</b>
              <div style="color:var(--muted);margin-top:4px">
                El colector {{ s.listening ? 'está escuchando en el puerto ' + s.port : 'no está escuchando' }}.
                @if (s.lastError) { <span style="color:var(--red)"> · {{ s.lastError }}</span> }
                <br>Verificá en el MikroTik: <span class="mono">/ip traffic-flow target</span> apuntando a la IP del NOC, puerto {{ s.port }}, versión 9.
              </div>
            </div>
          </div>
        }
      }
    </div></div>

    <!-- Top apps -->
    <div class="panel">
      <div class="ph">🏆 Aplicaciones más consumidas · {{ dir()==='d' ? 'bajada' : 'subida' }} · últimas {{ hours() }}h</div>
      <div class="pb">
        @if (apps().length) {
          @for (a of apps(); track a.app) {
            <div style="margin:8px 0">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
                <b>{{ a.app }}</b>
                <span><b>{{ fmt(a.bytes) }}</b> <span style="color:var(--muted)">· {{ a.pct }}%</span></span>
              </div>
              <div style="height:14px;border-radius:7px;background:#f0f0f0;overflow:hidden">
                <div style="height:100%;border-radius:7px;transition:width .4s"
                     [style.width.%]="barPct(a)" [style.background]="a.color"></div>
              </div>
            </div>
          }
          <div style="margin-top:10px;font-size:11.5px;color:var(--muted)">
            Total {{ dir()==='d' ? 'descargado' : 'subido' }} en el período: <b>{{ fmt(total()) }}</b>.
            Lo que no se puede identificar por ASN cae en <b>“Otro”</b> (tráfico a CDNs sin ASN propio o si el MikroTik no manda DST_AS).
          </div>
        } @else {
          <div style="color:var(--muted);padding:12px 0">Sin datos todavía. Cuando lleguen flujos vas a ver el ranking acá.</div>
        }
      </div>
    </div>

    <!-- Top clientes -->
    <div class="panel">
      <div class="ph">👥 Clientes que más consumen · últimas {{ hours() }}h</div>
      <div class="pb">
        @if (clients().length) {
          <table>
            <thead><tr><th>Cliente</th><th>IP</th><th>App principal</th><th style="text-align:right">Bajada</th><th style="text-align:right">Subida</th></tr></thead>
            <tbody>
              @for (c of clients(); track c.ip) {
                <tr>
                  <td>{{ c.name || '—' }}</td>
                  <td class="mono">{{ c.ip }}</td>
                  <td><span class="badge" [style.background]="c.topAppColor+'22'" [style.color]="c.topAppColor">{{ c.topApp }}</span></td>
                  <td class="mono" style="text-align:right"><b>{{ fmt(c.down) }}</b></td>
                  <td class="mono" style="text-align:right;color:var(--muted)">{{ fmt(c.up) }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div style="color:var(--muted);padding:12px 0">Sin datos de clientes todavía.</div>
        }
      </div>
    </div>
  `,
})
export class TraficoApps implements OnDestroy {
  private api = inject(NocApi);

  hours = signal(6);
  dir = signal<'d' | 'u'>('d');
  st = signal<any>(null);
  apps = signal<any[]>([]);
  clients = signal<any[]>([]);
  clock = signal('');

  total = computed(() => this.apps().reduce((s, a) => s + (+a.bytes || 0), 0));
  private maxBytes = computed(() => Math.max(1, ...this.apps().map((a) => +a.bytes || 0)));

  private timer: any;

  constructor() {
    this.load();
    this.tick();
    this.timer = setInterval(() => { this.load(); this.tick(); }, 10000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  setHours(h: number) { this.hours.set(h); this.load(); }
  setDir(d: 'd' | 'u') { this.dir.set(d); this.load(); }

  load() {
    this.api.flowOverview(this.hours(), this.dir()).subscribe({
      next: (d) => { this.st.set(d.status); this.apps.set(d.topApps || []); },
      error: () => {},
    });
    this.api.flowTopClients(this.hours(), 50).subscribe({
      next: (c) => this.clients.set(c || []),
      error: () => {},
    });
  }

  barPct(a: any): number { return Math.max(2, Math.round((100 * (+a.bytes || 0)) / this.maxBytes())); }

  fmt(n: number): string {
    n = +n || 0;
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB';
    return n + ' B';
  }

  private tick() { this.clock.set(new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }
}
