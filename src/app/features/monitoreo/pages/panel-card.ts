import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';
import { LineChart } from '../shared/line-chart';
import { areaDs, zabbixDs, metColor, stats, fmtG, Stat } from '../shared/charts';

// Paleta para líneas por núcleo (estilo PRTG multi-serie).
const CORE_PALETTE = ['#e6194B', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
  '#fabed4', '#469990', '#dcbeff', '#9A6324', '#800000', '#808000', '#000075', '#a9a9a9', '#e8730c', '#2a9d2a'];

export const METLABEL: Record<string, string> = {
  traffic: 'Tráfico WAN (RX+TX)',
  iface_traffic: 'Tráfico por interfaz',
  cpu_percent: 'CPU (%)',
  cpu_cores: 'CPU por núcleo (%)',
  memory_percent: 'Memoria (%)',
  ping_ms: 'Ping (ms)',
  temperature_celsius: 'Temperatura (°C)',
  wan_rx_gbps: 'Tráfico RX (Gbps)',
  wan_tx_gbps: 'Tráfico TX (Gbps)',
  onu_top_consumo: 'Top clientes ONU (consumo)',
  olt_ports_consumo: 'Consumo por puerto PON (vivo)',
};

@Component({
  selector: 'app-panel-card',
  standalone: true,
  imports: [LineChart, FormsModule],
  styles: [`
    .topbar { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .gauge-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(148px,1fr)); gap:10px; }
    .gauge-card { border:1px solid var(--border); border-radius:12px; padding:8px 8px 10px; text-align:center; cursor:pointer; background:var(--panel); transition:.15s; }
    .gauge-card:hover { box-shadow:var(--shadow); transform:translateY(-1px); border-color:var(--primary); }
    .gauge-card svg { width:100%; height:auto; display:block; }
    .gc-name { font-weight:700; font-size:12px; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gc-meta { font-size:11px; color:var(--muted); }
    .gc-sub { font-size:10.5px; color:var(--muted); margin-top:1px; }
  `],
  template: `
    <div class="panel">
      <div class="ph">{{ deviceName }} · {{ metric === 'iface_traffic' ? (ifaceName || 'interfaz') : label }}
        <span style="margin-left:auto;display:flex;align-items:center;gap:10px">
          @if (isLive()) { <span style="color:var(--red);font-size:11px;font-weight:600">● en vivo · {{ countdown() }}s</span> }
          @if (!locked) { <button class="btn sm ghost" (click)="remove.emit()" title="Quitar">✕</button> }
        </span>
      </div>
      <div class="pb">
        @if (metric === 'olt_ports_consumo') {
          @if (portRows().length) {
            <table style="width:100%">
              <thead><tr><th>#</th><th>Puerto PON</th><th>Descarga</th><th>Subida</th><th>Actualizado</th></tr></thead>
              <tbody>
                @for (p of portRows(); track $index) {
                  <tr>
                    <td>{{ $index + 1 }}</td>
                    <td class="mono">{{ p.port_name }}</td>
                    <td><b>{{ bps(p.tx_bps) }}</b></td>
                    <td>{{ bps(p.rx_bps) }}</td>
                    <td style="color:var(--muted)">{{ p.last_at || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div style="color:var(--muted);font-size:12px;padding:8px 0">Sin datos de puertos aún (se llena solo cada 30 s por SNMP).</div>
          }
        } @else if (metric === 'onu_top_consumo') {
          @if (topRows().length) {
            <div class="topbar">
              <button class="btn sm" [class.ghost]="topView()!=='gauge'" (click)="topView.set('gauge')">🚀 Medidores</button>
              <button class="btn sm" [class.ghost]="topView()!=='tabla'" (click)="topView.set('tabla')">Tabla</button>
              <label style="font-size:12px;color:var(--muted);margin-left:auto;display:flex;align-items:center;gap:6px">Top
                <input class="inp" type="number" min="1" max="60" style="width:62px;padding:4px 8px" [(ngModel)]="topN"></label>
            </div>
          }
          @if (topRows().length && topView()==='gauge') {
            <div class="gauge-grid">
              @for (o of topSlice(); track o.id) {
                <div class="gauge-card" (click)="openHistory(o)" title="Ver histórico de consumo">
                  <svg viewBox="0 0 120 74">
                    <path d="M12,66 A48,48 0 0 1 108,66" fill="none" stroke="#eceff4" stroke-width="10" stroke-linecap="round"/>
                    <path d="M12,66 A48,48 0 0 1 108,66" fill="none" [attr.stroke]="gColor(o)" stroke-width="10" stroke-linecap="round"
                          stroke-dasharray="150.8" [attr.stroke-dashoffset]="150.8*(1-gPct(o))"/>
                    <line x1="60" y1="66" [attr.x2]="ndX(o)" [attr.y2]="ndY(o)" stroke="#2b3442" stroke-width="2"/>
                    <circle cx="60" cy="66" r="4" fill="#2b3442"/>
                    <text x="60" y="52" text-anchor="middle" font-size="18" font-weight="700" fill="#2b3442">{{ dl(o) }}</text>
                    <text x="60" y="63" text-anchor="middle" font-size="8" fill="#8a93a2">Mbps ↓</text>
                  </svg>
                  <div class="gc-name">{{ clientOnly(o.client_name) }}</div>
                  <div class="gc-meta"><span class="mono">{{ o.raw_index }}</span> · <span [style.color]="rxColor(o.onu_rx_dbm)">{{ o.onu_rx_dbm != null ? o.onu_rx_dbm + ' dBm' : '—' }}</span></div>
                  <div class="gc-sub">↑ {{ mbps(o.onu_in_rate_bps) }} · máx {{ mbps(o.max_bps) }}</div>
                </div>
              }
            </div>
          }
          @if (topRows().length && topView()==='tabla') {
            <table style="width:100%">
              <thead><tr>
                <th>#</th>
                <th style="cursor:pointer" (click)="sortBy('client_name')">Cliente{{ arrow('client_name') }}</th>
                <th style="cursor:pointer" (click)="sortBy('raw_index')">ONU{{ arrow('raw_index') }}</th>
                <th style="cursor:pointer" (click)="sortBy('onu_rx_dbm')">Señal{{ arrow('onu_rx_dbm') }}</th>
                <th style="cursor:pointer" (click)="sortBy('onu_out_rate_bps')">Descarga{{ arrow('onu_out_rate_bps') }}</th>
                <th style="cursor:pointer" (click)="sortBy('min_bps')" title="Consumo mínimo (24h)">Mín{{ arrow('min_bps') }}</th>
                <th style="cursor:pointer" (click)="sortBy('avg_bps')" title="Consumo promedio (24h)">Prom{{ arrow('avg_bps') }}</th>
                <th style="cursor:pointer" (click)="sortBy('max_bps')" title="Consumo máximo (24h)">Máx{{ arrow('max_bps') }}</th>
                <th style="cursor:pointer" (click)="sortBy('onu_in_rate_bps')">Subida{{ arrow('onu_in_rate_bps') }}</th>
              </tr></thead>
              <tbody>
                @for (o of sortedTop(); track o.id) {
                  <tr style="cursor:pointer" (click)="openHistory(o)" title="Clic para ver histórico de consumo">
                    <td>{{ $index + 1 }}</td>
                    <td><b>{{ o.client_name || '—' }}</b></td>
                    <td class="mono">{{ o.raw_index }}</td>
                    <td [style.color]="rxColor(o.onu_rx_dbm)">{{ o.onu_rx_dbm != null ? o.onu_rx_dbm + ' dBm' : '—' }}</td>
                    <td><b>{{ mbps(o.onu_out_rate_bps) }}</b></td>
                    <td style="color:var(--muted)">{{ mbps(o.min_bps) }}</td>
                    <td>{{ mbps(o.avg_bps) }}</td>
                    <td style="color:var(--muted)">{{ mbps(o.max_bps) }}</td>
                    <td>{{ mbps(o.onu_in_rate_bps) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @if (!topRows().length) {
            <div style="color:var(--muted);font-size:12px;padding:8px 0">
              Sin consumo aún. En Clientes/ONUs corré <b>👤 Datos cliente</b> sobre esta OLT.
            </div>
          }
        } @else {
          @let isTraffic = metric === 'traffic' || metric === 'iface_traffic';
          <div style="height:280px"><app-line-chart [labels]="lab()" [datasets]="ds()" [fmt]="isTraffic ? 'gbps' : ''"></app-line-chart></div>
          @if (isTraffic && lab().length) {
            <table class="zbx" style="margin-top:6px;width:100%"><thead><tr><th></th><th>last</th><th>min</th><th>avg</th><th>max</th></tr></thead><tbody>
              <tr><td><span style="display:inline-block;width:11px;height:11px;background:#2a9d2a;border-radius:2px;margin-right:7px;vertical-align:-1px"></span>Bits recibidos</td>
                <td><b>{{ g(rxS().last) }}</b></td><td>{{ g(rxS().min) }}</td><td>{{ g(rxS().avg) }}</td><td>{{ g(rxS().max) }}</td></tr>
              <tr><td><span style="display:inline-block;width:11px;height:11px;background:#e8730c;border-radius:2px;margin-right:7px;vertical-align:-1px"></span>Bits enviados</td>
                <td><b>{{ g(txS().last) }}</b></td><td>{{ g(txS().min) }}</td><td>{{ g(txS().avg) }}</td><td>{{ g(txS().max) }}</td></tr>
              @if (metric === 'iface_traffic') {
                <tr><td><span style="display:inline-block;width:11px;height:11px;background:#0b7a3b;border-radius:2px;margin-right:7px;vertical-align:-1px"></span>Errores de salida (pps)</td>
                  <td><b>{{ pk(outErrS().last) }}</b></td><td>{{ pk(outErrS().min) }}</td><td>{{ pk(outErrS().avg) }}</td><td>{{ pk(outErrS().max) }}</td></tr>
                <tr><td><span style="display:inline-block;width:11px;height:11px;background:#c0392b;border-radius:2px;margin-right:7px;vertical-align:-1px"></span>Errores de entrada (pps)</td>
                  <td><b>{{ pk(inErrS().last) }}</b></td><td>{{ pk(inErrS().min) }}</td><td>{{ pk(inErrS().avg) }}</td><td>{{ pk(inErrS().max) }}</td></tr>
                <tr><td><span style="display:inline-block;width:11px;height:11px;background:#e75f9c;border-radius:2px;margin-right:7px;vertical-align:-1px"></span>Descartes de salida (pps)</td>
                  <td><b>{{ pk(outDiscS().last) }}</b></td><td>{{ pk(outDiscS().min) }}</td><td>{{ pk(outDiscS().avg) }}</td><td>{{ pk(outDiscS().max) }}</td></tr>
                <tr><td><span style="display:inline-block;width:11px;height:11px;background:#7c5cff;border-radius:2px;margin-right:7px;vertical-align:-1px"></span>Descartes de entrada (pps)</td>
                  <td><b>{{ pk(inDiscS().last) }}</b></td><td>{{ pk(inDiscS().min) }}</td><td>{{ pk(inDiscS().avg) }}</td><td>{{ pk(inDiscS().max) }}</td></tr>
              }
            </tbody></table>
          }
          @if (metric === 'cpu_cores' && cpuStat(); as cs) {
            <div style="margin-top:8px;display:flex;gap:20px;font-size:13px;align-items:center">
              <span>🔺 Pico más alto: <b style="color:var(--red);font-size:15px">{{ cs.max }}%</b></span>
              <span>Promedio: <b>{{ cs.avg }}%</b></span>
              <span>Mínimo: <b style="color:var(--muted)">{{ cs.min }}%</b></span>
            </div>
          }
          @if (!lab().length) { <div style="color:var(--muted);font-size:12px;padding:8px 0">Sin datos aún.</div> }
        }
      </div>
    </div>

    @if (histSel(); as h) {
      <div class="overlay on" style="z-index:80" (click)="closeHist()"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:81" (click)="closeHist()">
        <div class="panel" style="width:80vw;max-width:1100px" (click)="$event.stopPropagation()">
          <div class="ph">📈 {{ h.client_name || h.raw_index }} · histórico de consumo
            <span style="margin-left:auto;display:flex;align-items:center;gap:12px">
              <span style="color:var(--red);font-size:11px;font-weight:600">● en vivo · {{ histCountdown() }} s</span>
              <button class="btn sm ghost" (click)="closeHist()" title="Cerrar">✕</button>
            </span>
          </div>
          <div class="pb">
            <span class="segT" style="display:inline-flex;margin-bottom:10px">
              @for (r of histRanges; track r.h) {
                <button [class.on]="histHours() === r.h" (click)="loadHist(h, r.h)">{{ r.label }}</button>
              }
            </span>
            <div style="height:52vh">
              @if (histLab().length > 1) { <app-line-chart [labels]="histLab()" [datasets]="histDs()"></app-line-chart> }
              @else { <div style="color:var(--muted);padding:20px 0">Sin histórico suficiente. Se llena con cada refresco/enriquecimiento de la ONU.</div> }
            </div>
            <table style="margin-top:8px;width:auto">
              <thead><tr><th>Mínimo</th><th>Promedio</th><th>Máximo</th></tr></thead>
              <tbody><tr>
                <td><b>{{ histStat().min.toFixed(2) }} Mbps</b></td>
                <td><b>{{ histStat().avg.toFixed(2) }} Mbps</b></td>
                <td><b>{{ histStat().max.toFixed(2) }} Mbps</b></td>
              </tr></tbody>
            </table>
          </div>
        </div>
      </div>
    }
  `,
})
export class PanelCard implements OnChanges, OnDestroy {
  @Input() deviceId!: number;
  @Input() deviceName = '';
  @Input() metric = 'cpu_percent';
  @Input() ifaceId: number | null = null;
  @Input() ifaceName = '';
  @Input() rangeMin = 360;
  @Input() refreshSecs = 20;   // frecuencia de refresco en vivo (configurable desde el dashboard)
  @Input() locked = false;
  @Output() remove = new EventEmitter<void>();

  private api = inject(NocApi);
  private timer: any;
  private histTimer: any;
  private liveTimer: any;
  private refreshFn: (() => void) | null = null;
  countdown = signal(20);
  isLive(): boolean { return ['traffic', 'iface_traffic', 'cpu_cores', 'olt_ports_consumo', 'onu_top_consumo'].includes(this.metric); }

  // Ticker ÚNICO y continuo: no se reinicia al cambiar de rango/pestaña.
  // Al cambiar, se hace una consulta inmediata pero el conteo sigue su ritmo.
  private startTicker() {
    if (this.liveTimer) return;
    this.liveTimer = setInterval(() => {
      if (!this.refreshFn) return;                 // panel no-vivo: el ticker queda inactivo
      const c = this.countdown() - 1;
      if (c <= 0) { this.countdown.set(this.refreshSecs); this.refreshFn(); }
      else this.countdown.set(c);
    }, 1000);
  }
  private everStarted = false;
  private startLive(fn: () => void) {
    this.refreshFn = fn;
    fn();                                           // consulta inmediata (nuevo rango/página), SIN resetear el contador
    if (!this.everStarted) { this.countdown.set(this.refreshSecs); this.everStarted = true; }
    this.startTicker();
  }
  private stopLive() { this.refreshFn = null; }     // solo desactiva el refresco (panel no-vivo); NO toca el contador
  private oltIdResolved: number | null = null;
  g = fmtG;
  lab = signal<string[]>([]);
  ds = signal<any[]>([]);
  rxS = signal<Stat>(stats([]));
  txS = signal<Stat>(stats([]));
  inErrS = signal<Stat>(stats([])); outErrS = signal<Stat>(stats([]));
  inDiscS = signal<Stat>(stats([])); outDiscS = signal<Stat>(stats([]));
  cpuStat = signal<{ min: number; avg: number; max: number } | null>(null);
  topRows = signal<any[]>([]);
  portRows = signal<any[]>([]);
  histRanges = [{ label: '1h', h: 60 }, { label: '6h', h: 360 }, { label: '24h', h: 1440 }, { label: '7d', h: 10080 }];
  histSel = signal<any | null>(null);
  histHours = signal(360);
  histCountdown = signal(20);
  histLab = signal<string[]>([]);
  histDs = signal<any[]>([]);
  histStat = signal<Stat>(stats([]));

  sortKey = signal('onu_out_rate_bps');
  sortDir = signal<'asc' | 'desc'>('desc');

  sortBy(k: string) {
    if (this.sortKey() === k) this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    else { this.sortKey.set(k); this.sortDir.set(k === 'client_name' || k === 'raw_index' ? 'asc' : 'desc'); }
  }
  arrow(k: string): string { return this.sortKey() === k ? (this.sortDir() === 'asc' ? ' ▲' : ' ▼') : ''; }
  sortedTop(): any[] {
    const k = this.sortKey(), dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.topRows()].sort((a, b) => {
      const av = a[k], bv = b[k];
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      }
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * dir;
    });
  }

  // ---- Vista de medidores (velocímetro) del top de consumo ----
  topView = signal<'gauge' | 'tabla'>('gauge');
  topN = 12;
  /** Los N de mayor descarga, siempre ordenados por consumo (independiente del sort de la tabla). */
  topSlice(): any[] {
    return [...this.topRows()]
      .sort((a, b) => (b.onu_out_rate_bps ?? 0) - (a.onu_out_rate_bps ?? 0))
      .slice(0, this.topN);
  }
  /** Nombre de cliente limpio (sin prefijo de contrato ni IP al final). */
  clientOnly(name: string | null): string {
    if (!name) return '(sin nombre)';
    const n = name.trim().replace(/^\s*\d+\s*[-_]+\s*/, '').replace(/[-_]+\s*\d{1,3}(\.\d{1,3}){3}\s*$/, '').replace(/[-_\s]+$/, '').trim();
    return n || name;
  }
  /** Descarga en Mbps (entero) para el medidor. */
  dl(o: any): number { return Math.round((o.onu_out_rate_bps || 0) * 8 / 1e6); }
  /** Escala del velocímetro: el mayor consumo visible, redondeado hacia arriba (mín 20 Mbps). */
  private gMax(): number {
    const mx = Math.max(20, ...this.topSlice().map((o) => this.dl(o)));
    return Math.ceil(mx / 20) * 20;
  }
  gPct(o: any): number { return Math.max(0, Math.min(1, this.dl(o) / this.gMax())); }
  gColor(o: any): string {
    const p = this.gPct(o);
    return p >= 0.8 ? '#dc2626' : p >= 0.5 ? '#d97706' : '#16a34a';
  }
  private ndAngle(o: any): number { return Math.PI * (1 - this.gPct(o)); }   // 180°→0°
  ndX(o: any): number { return 60 + 40 * Math.cos(this.ndAngle(o)); }
  ndY(o: any): number { return 66 - 40 * Math.sin(this.ndAngle(o)); }

  openHistory(o: any) {
    clearInterval(this.histTimer);
    this.histSel.set(o);
    this.loadHist(o, 360);
    // Al abrir, jala el dato FRESCO de esta ONU ya mismo (no el guardado de hace minutos).
    this.resolveOlt((id) => { this.oltIdResolved = id; this.liveHist(o); });
    // EN VIVO: contador de 1s; al llegar a 0 refresca ESTA ONU y reinicia.
    this.histCountdown.set(20);
    this.histTimer = setInterval(() => {
      const c = this.histCountdown() - 1;
      if (c <= 0) { this.liveHist(o); this.histCountdown.set(20); }
      else this.histCountdown.set(c);
    }, 1000);
  }
  closeHist() { clearInterval(this.histTimer); this.histSel.set(null); }
  private liveHist(o: any) {
    if (this.oltIdResolved == null || !o.raw_index) return;
    const [port, onuStr] = String(o.raw_index).split(':');
    const onuId = +onuStr;
    if (!port || isNaN(onuId)) return;
    this.api.zteRefresh(this.oltIdResolved, onuId, port).subscribe({
      next: () => this.loadHist(o, this.histHours()),
      error: () => {},
    });
  }
  loadHist(o: any, hours: number) {
    this.histHours.set(hours);
    this.api.zteOnuHistory(o.id, 'onu_out_rate_bps', hours).subscribe((p) => {
      const v = p.map((x) => (+x.v! || 0) * 8 / 1e6);   // Bps → Mbps
      this.histLab.set(p.map((x) => x.t));
      this.histDs.set([areaDs('Consumo (Mbps)', '#7b0061', v)]);
      this.histStat.set(stats(v));
    });
  }

  get label(): string { return METLABEL[this.metric] || this.metric; }

  /** Formatea paquetes/seg (errores/descartes) estilo Zabbix. */
  pk(v: number): string {
    if (v == null || v < 0.005) return '0';
    return v < 10 ? v.toFixed(2) : Math.round(v).toString();
  }
  /** ONU rate viene en Bps (bytes/seg) del CLI → Mbps. */
  mbps(b: number | null): string { return b == null ? '—' : (b * 8 / 1e6).toFixed(1) + ' Mbps'; }
  /** Puerto rate ya viene en bits/seg del colector → Gbps/Mbps. */
  bps(b: number | null): string {
    if (b == null) return '—';
    if (b >= 1e9) return (b / 1e9).toFixed(2) + ' Gbps';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' Mbps';
    return (b / 1e3).toFixed(0) + ' Kbps';
  }
  rxColor(dbm: number | null): string {
    if (dbm == null) return 'var(--muted)';
    if (dbm <= -28) return 'var(--red)';
    if (dbm <= -25) return '#d98a00';
    return 'var(--green)';
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['refreshSecs'] && this.countdown() > this.refreshSecs) this.countdown.set(this.refreshSecs);
    if (ch['deviceId'] || ch['metric'] || ch['rangeMin'] || ch['ifaceId']) this.load();
  }
  ngOnDestroy(): void { clearInterval(this.timer); clearInterval(this.histTimer); clearInterval(this.liveTimer); }

  private resolveOlt(cb: (oltId: number) => void): void {
    this.api.zteOlts().subscribe((olts) => {
      const olt = olts.find((o) => o.name === this.deviceName);
      if (olt) cb(olt.id);
    });
  }

  load(): void {
    this.stopLive();

    if (this.metric === 'olt_ports_consumo') {
      this.startLive(() => this.resolveOlt((id) => this.api.zteOltPorts(id).subscribe((r) => this.portRows.set(r))));
      return;
    }
    if (this.metric === 'onu_top_consumo') {
      this.startLive(() => this.resolveOlt((id) => { this.oltIdResolved = id; this.api.zteTopConsumo(id, 50).subscribe((r) => this.topRows.set(r)); }));
      return;
    }

    // Tráfico por interfaz (estilo Zabbix): RX/TX exactos de UNA interfaz, en vivo.
    if (this.metric === 'iface_traffic') {
      if (!this.ifaceId) return;
      this.startLive(() => this.api.interfaceTraffic(this.ifaceId!, this.rangeMin, 60, this.rangeMin !== 15).subscribe((p) => {
        const rx = p.map((x) => (x.rx == null ? null : +x.rx)), tx = p.map((x) => (x.tx == null ? null : +x.tx));
        this.lab.set(p.map((x) => x.t));
        this.ds.set(zabbixDs(rx, tx));   // null = hueco (spanGaps conecta), NO 0
        this.rxS.set(stats(rx.filter((v) => v != null) as number[])); this.txS.set(stats(tx.filter((v) => v != null) as number[]));
        this.inErrS.set(stats(p.map((x) => +x.in_err! || 0))); this.outErrS.set(stats(p.map((x) => +x.out_err! || 0)));
        this.inDiscS.set(stats(p.map((x) => +x.in_disc! || 0))); this.outDiscS.set(stats(p.map((x) => +x.out_disc! || 0)));
      }));
      return;
    }

    if (!this.deviceId) return;

    // CPU por núcleo (estilo PRTG): una línea por procesador, en vivo.
    if (this.metric === 'cpu_cores') {
      this.startLive(() => this.api.cpuCores(this.deviceId, this.rangeMin, 60).subscribe((r) => {
        this.lab.set(r.labels);
        const coreDs = r.series.map((s, i) => ({
          label: s.name, data: s.data, borderColor: CORE_PALETTE[i % CORE_PALETTE.length],
          backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.3, spanGaps: true,
        }));
        // Estadísticas de TODOS los núcleos (pico más alto = máx global).
        const all = r.series.flatMap((s) => s.data).filter((v) => v != null) as number[];
        if (all.length) {
          const mx = Math.max(...all), mn = Math.min(...all);
          const av = +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(1);
          this.cpuStat.set({ min: mn, avg: av, max: mx });
          // Línea de referencia "Máx" (punteada roja), como PRTG.
          const maxLine = { label: 'Máx ' + mx + '%', data: r.labels.map(() => mx), borderColor: '#dc2626',
            borderDash: [6, 4], borderWidth: 1, pointRadius: 0, fill: false, tension: 0 };
          this.ds.set([...coreDs, maxLine]);
        } else { this.cpuStat.set(null); this.ds.set(coreDs); }
      }));
      return;
    }

    if (this.metric === 'traffic') {
      this.startLive(() => this.api.deviceTraffic(this.deviceId, this.rangeMin, 60, this.rangeMin !== 15).subscribe((p) => {
        const rx = p.map((x) => (x.rx == null ? null : +x.rx)), tx = p.map((x) => (x.tx == null ? null : +x.tx));
        this.lab.set(p.map((x) => x.t));
        this.ds.set(zabbixDs(rx, tx));   // null = hueco (spanGaps conecta), NO 0
        this.rxS.set(stats(rx.filter((v) => v != null) as number[])); this.txS.set(stats(tx.filter((v) => v != null) as number[]));
      }));
    } else {
      this.api.deviceMetric(this.deviceId, this.metric, this.rangeMin, 80).subscribe((p) => {
        this.lab.set(p.map((x) => x.t));
        this.ds.set([areaDs(this.label, metColor(this.metric), p.map((x) => +x.v! || 0))]);
      });
    }
  }
}
