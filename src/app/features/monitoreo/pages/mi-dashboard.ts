import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi, Device } from '../services/noc-api';
import { PanelCard, METLABEL } from './panel-card';

interface Panel { deviceId: number; deviceName: string; metric: string; ifaceId?: number | null; ifaceName?: string; }
interface Tab { name: string; panels: Panel[]; }

@Component({
  selector: 'app-mi-dashboard',
  standalone: true,
  imports: [FormsModule, PanelCard],
  template: `
    <div class="tools">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        @for (t of tabs(); track $index) {
          <span class="chip" [class.on]="cur()===$index" (click)="cur.set($index)" style="cursor:pointer">
            {{ t.name }}
            @if (tabs().length > 1 && !locked()) { <b style="margin-left:7px;opacity:.6" (click)="delTab($index, $event)">✕</b> }
          </span>
        }
      </div>
      @if (!locked()) { <button class="chip" (click)="openTab()">＋ pestaña</button> }
      <span style="margin-left:auto;display:flex;align-items:center;gap:10px">
        <span style="font-size:11px;color:var(--muted)">🕒 Histórico</span>
        <span class="segT">
          @for (r of ranges; track r.min) { <button [class.on]="range()===r.min" (click)="setRange(r.min)">{{ r.label }}</button> }
        </span>
        <span style="font-size:11px;color:var(--muted)">Refresco</span>
        <span class="segT">
          @for (r of refreshOpts; track r.s) { <button [class.on]="refreshSecs()===r.s" (click)="setRefresh(r.s)">{{ r.label }}</button> }
        </span>
        <span style="font-size:11px;color:var(--muted)">Rotación</span>
        <span class="segT">
          @for (s of rotOpts; track s) { <button [class.on]="rot()===s" (click)="setRot(s)">{{ s===0 ? 'Off' : s+'s' }}</button> }
        </span>
        <button class="btn ghost sm" (click)="full()" title="Pantalla completa (oculta barra y menú)">⛶ Pantalla completa</button>
        @if (!locked()) {
          <button class="btn" (click)="openAdd()">+ Agregar panel</button>
          <button class="btn ghost" (click)="lock()">💾 Guardar dashboard</button>
        } @else {
          <span class="badge b-ack">🔒 Bloqueado</span>
          <button class="btn ghost" (click)="unlock()">✎ Editar dashboard</button>
        }
      </span>
    </div>

    <div class="grid2">
      @for (p of panels(); track $index) {
        <app-panel-card [deviceId]="p.deviceId" [deviceName]="p.deviceName" [metric]="p.metric" [ifaceId]="p.ifaceId ?? null" [ifaceName]="p.ifaceName || ''" [rangeMin]="range()" [refreshSecs]="refreshSecs()" [locked]="locked()" (remove)="delPanel($index)"></app-panel-card>
      } @empty {
        <div class="panel"><div class="empty"><span class="ic">➕</span><h2>Pestaña vacía</h2><p>Clic en "Agregar panel" para elegir equipo y métrica a monitorear.</p></div></div>
      }
    </div>

    @if (showTab()) {
      <div class="overlay on" (click)="showTab.set(false)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="showTab.set(false)">
        <div class="panel" style="width:420px;max-width:92vw" (click)="$event.stopPropagation()">
          <div class="ph">Nueva pestaña</div>
          <div class="pb">
            <label class="k">Nombre de la pestaña</label>
            <input class="inp" style="width:100%" [(ngModel)]="newTabName" (keyup.enter)="confirmTab()" placeholder="Ej: Núcleo, Bordes, OLTs…" autofocus>
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;justify-content:flex-end">
            <button class="btn ghost" (click)="showTab.set(false)">Cancelar</button>
            <button class="btn" (click)="confirmTab()">Crear</button>
          </div>
        </div>
      </div>
    }

    @if (showAdd()) {
      <div class="overlay on" (click)="showAdd.set(false)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="showAdd.set(false)">
        <div class="panel" style="width:460px;max-width:92vw" (click)="$event.stopPropagation()">
          <div class="ph">Agregar panel</div>
          <div class="pb">
            <div style="margin-bottom:12px"><label class="k">Equipo</label>
              <select class="inp" style="width:100%" [(ngModel)]="selDev" (ngModelChange)="onDevChange()">@for (d of devices(); track d.id) { <option [ngValue]="d">{{ d.name }}</option> }</select></div>
            <div style="margin-bottom:12px"><label class="k">Métrica</label>
              <select class="inp" style="width:100%" [(ngModel)]="selMetric" (ngModelChange)="onMetricChange()">
                @for (m of metricKeys; track m) { <option [ngValue]="m">{{ label(m) }}</option> }
              </select></div>
            @if (selMetric === 'iface_traffic') {
              <div><label class="k">Interfaz</label>
                <select class="inp" style="width:100%" [(ngModel)]="selIface">
                  @for (i of ifaces(); track i.id) { <option [ngValue]="i">{{ i.noc_alias || i.real_name }} @if (i.noc_alias) { <span>({{ i.real_name }})</span> }</option> }
                  @if (!ifaces().length) { <option [ngValue]="null">Sin interfaces detectadas aún</option> }
                </select></div>
            }
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;justify-content:flex-end">
            <button class="btn ghost" (click)="showAdd.set(false)">Cancelar</button>
            <button class="btn" (click)="addPanel()">Agregar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MiDashboard implements OnDestroy {
  private api = inject(NocApi);
  tabs = signal<Tab[]>([{ name: 'Principal', panels: [] }]);
  cur = signal(0);
  rot = signal(0);
  locked = signal(false);
  range = signal(15);
  ranges = [
    { min: 15, label: 'En vivo' }, { min: 60, label: '1h' }, { min: 360, label: '6h' },
    { min: 1440, label: '24h' }, { min: 2880, label: '2d' }, { min: 10080, label: '7d' },
    { min: 43200, label: '30d' }, { min: 259200, label: '6m' }, { min: 525600, label: '1a' },
  ];
  rotOpts = [0, 10, 15, 30];
  refreshSecs = signal(60);   // default 1 min, como Zabbix
  refreshOpts = [{ s: 15, label: '15s' }, { s: 30, label: '30s' }, { s: 60, label: '1m' }, { s: 180, label: '3m' }];
  metricKeys = ['iface_traffic', 'traffic', 'cpu_cores', 'cpu_percent', 'memory_percent', 'ping_ms', 'temperature_celsius', 'wan_rx_gbps', 'wan_tx_gbps', 'onu_top_consumo', 'olt_ports_consumo'];

  devices = signal<Device[]>([]);
  ifaces = signal<any[]>([]);
  showAdd = signal(false);
  showTab = signal(false);
  newTabName = '';
  selDev: Device | null = null;
  selMetric = 'iface_traffic';
  selIface: any = null;
  private timer: any = null;

  constructor() {
    try {
      const sv = JSON.parse(localStorage.getItem('noc_ng_tabs') || 'null');
      if (sv && sv.length) this.tabs.set(sv);
      this.rot.set(+(localStorage.getItem('noc_ng_rot') || 0));
      this.refreshSecs.set(+(localStorage.getItem('noc_ng_refresh') || 60));
      this.range.set(+(localStorage.getItem('noc_ng_range') || 15));
      this.locked.set(localStorage.getItem('noc_ng_locked') === '1');
    } catch {}
    this.api.devices().subscribe((d) => { this.devices.set(d); if (!this.selDev && d.length) this.selDev = d[0]; });
    this.startRot();
    document.addEventListener('fullscreenchange', this.fsHandler);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    document.removeEventListener('fullscreenchange', this.fsHandler);
    document.body.classList.remove('noc-full');
    if (document.fullscreenElement) document.exitFullscreen?.();
  }

  /** Pantalla completa: oculta la barra KLAX y el menú (body.noc-full) y ocupa el monitor. */
  full() {
    const el: any = document.documentElement;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); document.body.classList.add('noc-full'); }
    else { document.exitFullscreen?.(); document.body.classList.remove('noc-full'); }
  }
  /** Al salir con Esc, restaura barra y menú. */
  private fsHandler = () => { if (!document.fullscreenElement) document.body.classList.remove('noc-full'); };

  panels(): Panel[] { return this.tabs()[this.cur()]?.panels || []; }
  label(m: string): string { return METLABEL[m] || m; }

  private save() {
    localStorage.setItem('noc_ng_tabs', JSON.stringify(this.tabs()));
    localStorage.setItem('noc_ng_rot', String(this.rot()));
    localStorage.setItem('noc_ng_locked', this.locked() ? '1' : '0');
  }

  lock() { this.locked.set(true); this.save(); }
  unlock() { this.locked.set(false); this.save(); }
  setRange(min: number) { this.range.set(min); localStorage.setItem('noc_ng_range', String(min)); }
  setRefresh(s: number) { this.refreshSecs.set(s); localStorage.setItem('noc_ng_refresh', String(s)); }

  openTab() { this.newTabName = 'Pestaña ' + (this.tabs().length + 1); this.showTab.set(true); }
  confirmTab() {
    const n = this.newTabName.trim();
    if (!n) return;
    this.tabs.update((t) => [...t, { name: n, panels: [] }]);
    this.cur.set(this.tabs().length - 1);
    this.showTab.set(false);
    this.save();
  }
  delTab(i: number, e: Event) {
    e.stopPropagation();
    if (this.tabs().length <= 1) return;
    this.tabs.update((t) => t.filter((_, idx) => idx !== i));
    if (this.cur() >= this.tabs().length) this.cur.set(this.tabs().length - 1);
    this.save();
  }

  openAdd() { this.showAdd.set(true); if (this.selMetric === 'iface_traffic') this.loadIfaces(); }
  onDevChange() { if (this.selMetric === 'iface_traffic') this.loadIfaces(); }
  onMetricChange() { if (this.selMetric === 'iface_traffic') this.loadIfaces(); }
  private loadIfaces() {
    this.api.interfaces().subscribe((all) => {
      const list = all.filter((i) => i.device_name === this.selDev?.name);
      this.ifaces.set(list);
      if (!this.selIface || !list.some((i) => i.id === this.selIface?.id)) {
        const up = list.filter((f: any) => f.status === 'up' && !/^(lo|bridge)/i.test(f.real_name || ''));
        const pool = up.length ? up : list;
        this.selIface = [...pool].sort((a: any, b: any) => (b.capacity_bps - a.capacity_bps) || (b.rx_bps - a.rx_bps))[0] || null;
      }
    });
  }
  addPanel() {
    if (!this.selDev) return;
    if (this.selMetric === 'iface_traffic' && !this.selIface) return;
    const p: Panel = { deviceId: this.selDev.id, deviceName: this.selDev.name, metric: this.selMetric };
    if (this.selMetric === 'iface_traffic') { p.ifaceId = this.selIface.id; p.ifaceName = this.selIface.noc_alias || this.selIface.real_name; }
    this.tabs.update((t) => t.map((tab, i) => (i === this.cur() ? { ...tab, panels: [...tab.panels, p] } : tab)));
    this.showAdd.set(false);
    this.save();
  }
  delPanel(i: number) {
    this.tabs.update((t) => t.map((tab, idx) => (idx === this.cur() ? { ...tab, panels: tab.panels.filter((_, j) => j !== i) } : tab)));
    this.save();
  }

  setRot(s: number) { this.rot.set(s); this.save(); this.startRot(); }
  private startRot() {
    clearInterval(this.timer);
    if (this.rot() > 0) {
      this.timer = setInterval(() => {
        if (this.tabs().length > 1) this.cur.set((this.cur() + 1) % this.tabs().length);
      }, this.rot() * 1000);
    }
  }
}
