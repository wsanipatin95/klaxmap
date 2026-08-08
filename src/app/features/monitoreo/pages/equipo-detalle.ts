import { Component, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NocApi, Device, Iface, OltMarca } from '../services/noc-api';
import { TableSort } from '../shared/table-sort';
import { LineChart } from '../shared/line-chart';
import { areaDs, zabbixDs, cpuColor, fmtUptime, fmtBps, fmtCap, fmtG, stats } from '../shared/charts';

@Component({
  selector: 'app-equipo-detalle',
  standalone: true,
  imports: [LineChart, FormsModule],
  styles: [`.lg{display:inline-block;width:11px;height:11px;border-radius:2px;margin-right:7px;vertical-align:-1px}`],
  template: `
    <a class="back" (click)="back()" style="cursor:pointer">← Equipos</a>
    @if (dev(); as d) {
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <h2 style="font-size:20px">{{ d.name }}</h2>
        <span class="badge" [class.b-up]="d.status==='up'" [class.b-down]="d.status==='down'" [class.b-maint]="d.status!=='up'&&d.status!=='down'">{{ d.status.toUpperCase() }}</span>
        @if (d.snmp_enabled) { <span class="badge b-maint">SNMP</span> }
        <span style="margin-left:auto;color:var(--red);font-size:12px;font-weight:600">● en vivo · {{ countdown() }} s</span>
        <button class="btn ghost" (click)="openEdit(d)">✎ Editar equipo</button>
      </div>

      <div class="meta">
        <div class="m"><div class="k">Vendor / Modelo</div><div class="v">{{ d.vendor }} / {{ d.model || '—' }}</div></div>
        <div class="m"><div class="k">Zona</div><div class="v">{{ d.zone || '—' }}</div></div>
        <div class="m"><div class="k">IP</div><div class="v mono">{{ d.ip_address }}</div></div>
        <div class="m"><div class="k">Nombre SNMP</div><div class="v">{{ d.sys_name || '—' }}</div></div>
        <div class="m"><div class="k">Uptime</div><div class="v">{{ upt(d.uptime_seconds) }}</div></div>
        <div class="m"><div class="k">Último visto</div><div class="v">{{ d.status==='up' ? 'hace instantes' : 'sin respuesta' }}</div></div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
        <span style="font-size:12px;color:var(--muted)">🕒 Histórico:</span>
        <span class="segT">
          @for (r of ranges; track r.min) {
            <button [class.on]="range()===r.min" (click)="setRange(r.min)">{{ r.label }}</button>
          }
        </span>
      </div>

      <div class="row4">
        <div class="panel" style="cursor:pointer" (click)="openLog('cpu_percent','CPU','#dc2626')"><div class="ph">CPU</div><div class="pb" style="text-align:center">
          <div class="gauge" [style.color]="cpuColor(d.cpu_percent)">{{ d.cpu_percent!=null ? d.cpu_percent+'%' : '—' }}</div>
          <div class="chart-sm"><app-line-chart [labels]="lab()" [datasets]="cpuDs()" [mini]="true"></app-line-chart></div></div></div>
        <div class="panel" style="cursor:pointer" (click)="openLog('memory_percent','Memoria','#2563eb')"><div class="ph">Memoria</div><div class="pb" style="text-align:center">
          <div class="gauge">{{ d.memory_percent!=null ? d.memory_percent+'%' : '—' }}</div>
          <div class="chart-sm"><app-line-chart [labels]="lab()" [datasets]="memDs()" [mini]="true"></app-line-chart></div></div></div>
        <div class="panel" style="cursor:pointer" (click)="openLog('temperature_celsius','Temperatura','#d97706')"><div class="ph">Temperatura</div><div class="pb" style="text-align:center">
          <div class="gauge" style="color:var(--amber)">{{ d.temp_celsius!=null ? d.temp_celsius+'°C' : '—' }}</div>
          <div class="chart-sm"><app-line-chart [labels]="lab()" [datasets]="tempDs()" [mini]="true"></app-line-chart></div></div></div>
        <div class="panel" style="cursor:pointer" (click)="openLog('ping_ms','Ping','#16a34a')"><div class="ph">Ping</div><div class="pb" style="text-align:center">
          <div class="gauge">{{ d.ping_ms!=null ? d.ping_ms+' ms' : 'timeout' }}</div>
          <div class="chart-sm"><app-line-chart [labels]="lab()" [datasets]="pingDs()" [mini]="true"></app-line-chart></div></div></div>
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="ph">Tráfico {{ trafIface() === 0 ? 'del equipo (suma de interfaces)' : 'de interfaz' }}
          <select class="inp" style="margin-left:auto;max-width:300px;font-size:12px;padding:5px 10px" [(ngModel)]="trafSel" (ngModelChange)="onTrafChange()">
            <option [ngValue]="0">Todo el equipo (suma)</option>
            @for (f of myIfaces(); track f.id) { <option [ngValue]="f.id">{{ f.noc_alias || f.real_name }}</option> }
          </select>
        </div>
        <div class="pb">
          <div class="big" style="cursor:pointer" (click)="openTraf()"><app-line-chart [labels]="trafLab()" [datasets]="trafDs()" [fmt]="'gbps'"></app-line-chart></div>
          @if (trafLab().length) {
            <table class="zbx" style="margin-top:8px;width:100%"><thead><tr><th></th><th>last</th><th>min</th><th>avg</th><th>max</th></tr></thead><tbody>
              <tr><td><span class="lg" style="background:#2a9d2a"></span>Bits recibidos</td><td><b>{{ g(rxStat().last) }}</b></td><td>{{ g(rxStat().min) }}</td><td>{{ g(rxStat().avg) }}</td><td>{{ g(rxStat().max) }}</td></tr>
              <tr><td><span class="lg" style="background:#e8730c"></span>Bits enviados</td><td><b>{{ g(txStat().last) }}</b></td><td>{{ g(txStat().min) }}</td><td>{{ g(txStat().avg) }}</td><td>{{ g(txStat().max) }}</td></tr>
              @if (trafIface() !== 0) {
                <tr><td><span class="lg" style="background:#0b7a3b"></span>Errores de salida (pps)</td><td><b>{{ pk(outErrS().last) }}</b></td><td>{{ pk(outErrS().min) }}</td><td>{{ pk(outErrS().avg) }}</td><td>{{ pk(outErrS().max) }}</td></tr>
                <tr><td><span class="lg" style="background:#c0392b"></span>Errores de entrada (pps)</td><td><b>{{ pk(inErrS().last) }}</b></td><td>{{ pk(inErrS().min) }}</td><td>{{ pk(inErrS().avg) }}</td><td>{{ pk(inErrS().max) }}</td></tr>
                <tr><td><span class="lg" style="background:#e75f9c"></span>Descartes de salida (pps)</td><td><b>{{ pk(outDiscS().last) }}</b></td><td>{{ pk(outDiscS().min) }}</td><td>{{ pk(outDiscS().avg) }}</td><td>{{ pk(outDiscS().max) }}</td></tr>
                <tr><td><span class="lg" style="background:#7c5cff"></span>Descartes de entrada (pps)</td><td><b>{{ pk(inDiscS().last) }}</b></td><td>{{ pk(inDiscS().min) }}</td><td>{{ pk(inDiscS().avg) }}</td><td>{{ pk(inDiscS().max) }}</td></tr>
              }
            </tbody></table>
          } @else {
            <div style="color:var(--muted);font-size:12.5px;padding:10px 0">Sin datos de tráfico en este rango. Verifica que el SNMP descubra interfaces (log del backend: ifaces=N) y espera 1–2 sondeos.</div>
          }
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="ph">Interfaces del equipo (SNMP) <span class="mini">{{ myIfaces().length }} interfaces</span></div>
        <table><thead><tr>
          <th class="srt" (click)="ifSort.by('interfaz')">Interfaz{{ ifSort.arrow('interfaz') }}</th>
          <th class="srt" (click)="ifSort.by('capacidad')">Capacidad{{ ifSort.arrow('capacidad') }}</th>
          <th class="srt" (click)="ifSort.by('rx')">RX{{ ifSort.arrow('rx') }}</th>
          <th class="srt" (click)="ifSort.by('tx')">TX{{ ifSort.arrow('tx') }}</th>
          <th class="srt" (click)="ifSort.by('util')">Utilización{{ ifSort.arrow('util') }}</th>
          <th class="srt" (click)="ifSort.by('estado')">Estado{{ ifSort.arrow('estado') }}</th>
        </tr></thead><tbody>
          @for (f of ifaceRows(); track f.id) {
            <tr style="cursor:pointer" (click)="openIfaceLog(f)" title="Clic para ver el gráfico de tráfico de esta interfaz (estilo Zabbix)">
              <td><b>{{ f.real_name }}</b></td><td>{{ cap(f.capacity_bps) }}</td><td>{{ bps(f.rx_bps) }}</td><td>{{ bps(f.tx_bps) }}</td>
              <td>@if (f.status==='up') { <span class="ubar"><i [style.width.%]="f.util_percent" [style.background]="utilColor(f.util_percent)"></i></span>{{ f.util_percent }}% } @else { — }</td>
              <td [innerHTML]="ifBadge(f.status)"></td></tr>
          } @empty {
            <tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Sin interfaces aún. Si el equipo tiene SNMP habilitado aparecerán en el próximo sondeo.</td></tr>
          }
        </tbody></table>
      </div>

      @if (showEdit()) {
        <div class="overlay on" (click)="showEdit.set(false)"></div>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="showEdit.set(false)">
          <div class="panel" style="width:580px;max-width:94vw" (click)="$event.stopPropagation()">
            <div class="ph">Editar equipo · configuración</div>
            <div class="pb" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div style="grid-column:1/3"><label class="k">Nombre NOC</label><input class="inp" style="width:100%" [(ngModel)]="ef.name"></div>
              @if (ef.device_type === 'olt') {
                <div style="grid-column:1/3"><label class="k">Tipo de OLT</label>
                  <select class="inp" style="width:100%" [(ngModel)]="ef.id_red_olt_marca" (ngModelChange)="applyMarca($event)">
                    <option [ngValue]="undefined">— Selecciona la marca —</option>
                    @for (m of marcas(); track m.idRedOltMarca) {
                      <option [ngValue]="m.idRedOltMarca">{{ m.marca }}</option>
                    }
                  </select>
                </div>
              } @else {
                <div><label class="k">Vendor</label><input class="inp" style="width:100%" [(ngModel)]="ef.vendor"></div>
                <div><label class="k">Modelo</label><input class="inp" style="width:100%" [(ngModel)]="ef.model"></div>
              }
              <div><label class="k">Tipo</label><select class="inp" style="width:100%" [(ngModel)]="ef.device_type"><option value="borde">Borde</option><option value="core">Core</option><option value="olt">OLT</option></select></div>
              <div><label class="k">Zona</label><input class="inp" style="width:100%" [(ngModel)]="ef.zone"></div>
              <div><label class="k">IP de gestión</label><input class="inp" style="width:100%" [(ngModel)]="ef.ip_address"></div>
              <div><label class="k">Versión SNMP</label><select class="inp" style="width:100%" [(ngModel)]="ef.snmp_version"><option value="v2c">v2c</option><option value="v3">v3</option></select></div>
              <div><label class="k">Community SNMP</label><input class="inp" style="width:100%" [(ngModel)]="ef.snmp_community"></div>
              <div><label class="k">Puerto SNMP</label><input class="inp" type="number" style="width:100%" [(ngModel)]="ef.snmp_port"></div>
              <div style="display:flex;align-items:center;gap:8px;padding-top:20px"><input type="checkbox" [(ngModel)]="ef.snmp_enabled"> <span>Habilitar SNMP</span></div>
              <div style="display:flex;align-items:center;gap:8px;padding-top:20px"><input type="checkbox" [(ngModel)]="ef.mon_temp"> <span>Monitorear temperatura</span></div>

              @if (ef.device_type === 'olt') {
                <div><label class="k">Telnet usuario</label><input class="inp" style="width:100%" [(ngModel)]="ef.telnet_user"></div>
                <div><label class="k">Telnet clave</label><input type="password" class="inp" style="width:100%" [(ngModel)]="ef.telnet_pass" placeholder="(sin cambios)"></div>
                <div><label class="k">Telnet puerto</label><input type="number" class="inp" style="width:100%" [(ngModel)]="ef.telnet_port" placeholder="23"></div>
                <div style="display:flex;align-items:center;gap:8px;padding-top:20px"><input type="checkbox" [(ngModel)]="ef.snmp_poll_enabled"> <span>Barrido SNMP automático</span></div>
                <div><label class="k">Intervalo barrido (seg)</label><input type="number" class="inp" style="width:100%" [(ngModel)]="ef.snmp_poll_seconds" placeholder="300"></div>
              }
            </div>
            <div class="ph" style="border-top:1px solid var(--border);border-bottom:none">
              <button class="btn ghost" style="color:var(--red)" (click)="removeDevice()">🗑 Eliminar equipo</button>
              <span style="margin-left:auto;display:flex;gap:10px">
                <button class="btn ghost" (click)="showEdit.set(false)">Cancelar</button>
                <button class="btn" (click)="saveEdit()">Guardar cambios</button>
              </span>
            </div>
          </div>
        </div>
      }
      @if (showLog()) {
        <div class="overlay on" (click)="showLog.set(false)"></div>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="showLog.set(false)">
          <div class="panel" style="width:760px;max-width:95vw" (click)="$event.stopPropagation()">
            <div class="ph">{{ logTitle() }} <button class="btn sm ghost" (click)="showLog.set(false)">×</button></div>
            <div class="pb">
              <div style="height:230px"><app-line-chart [labels]="logLab()" [datasets]="logDs()" [fmt]="logFmt()"></app-line-chart></div>
              <h4 style="font-size:13px;margin:14px 0 8px">Registro histórico</h4>
              <div style="max-height:230px;overflow:auto;border:1px solid var(--border);border-radius:9px">
                @for (l of logList(); track $index) {
                  <div style="display:flex;gap:12px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;font-family:'Consolas',monospace">
                    <span style="color:var(--muted)">{{ l.t }}</span><span>{{ l.v }}</span>
                  </div>
                } @empty {
                  <div style="padding:14px;color:var(--muted)">Sin datos en este rango todavía. La recolección los irá llenando.</div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    } @else {
      <div class="empty"><span class="ic">⏳</span>Cargando equipo…</div>
    }

    @if (testing()) {
      <div class="overlay on" style="z-index:90"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:91">
        <div class="panel" style="width:380px;text-align:center">
          <div class="pb" style="padding:32px 24px">
            <div style="font-size:32px;margin-bottom:14px">⏳</div>
            <div style="font-weight:600;font-size:15px;line-height:1.7">Probando conexión Telnet<br>Espere Por Favor</div>
          </div>
        </div>
      </div>
    }
    @if (saveErr()) {
      <div class="overlay on" style="z-index:96" (click)="saveErr.set('')"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:97" (click)="saveErr.set('')">
        <div class="panel" style="width:440px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">⚠️</div>
            <div style="font-weight:600;font-size:14px;line-height:1.7;color:var(--red)">No se pudieron guardar los cambios</div>
            <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:8px">{{ saveErr() }}</div>
            <div style="display:flex;justify-content:center;margin-top:16px">
              <button class="btn" (click)="saveErr.set('')">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    }
    @if (testErr()) {
      <div class="overlay on" style="z-index:90" (click)="testErr.set('')"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:91" (click)="testErr.set('')">
        <div class="panel" style="width:440px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">⚠️</div>
            <div style="font-weight:600;font-size:14px;line-height:1.7;color:var(--red)">Sin conexión Telnet a la OLT</div>
            <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:8px">{{ testErr() }}</div>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
              <button class="btn ghost" (click)="testErr.set('')">Corregir</button>
              <button class="btn" (click)="doSaveEdit()">Guardar igual</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class EquipoDetalle implements OnDestroy {
  private api = inject(NocApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private timer: any;
  showBack = signal(this.route.snapshot.queryParamMap.get('back') === '1');
  cpuColor = cpuColor; upt = fmtUptime; cap = fmtCap; bps = fmtBps; g = fmtG;

  id = 0;
  dev = signal<Device | null>(null);
  showEdit = signal(false);
  testing = signal(false);
  testErr = signal('');
  saveErr = signal('');   // error al guardar (NO es un fallo de Telnet)
  ef: any = {};
  marcas = signal<OltMarca[]>([]);   // marcas del ERP (kxt_red_olt_marca) para "Tipo de OLT"
  showLog = signal(false);
  logTitle = signal('');
  logLab = signal<string[]>([]);
  logDs = signal<any[]>([]);
  logList = signal<{ t: string; v: string }[]>([]);
  logFmt = signal<'' | 'gbps'>('');
  ifaces = signal<Iface[]>([]);
  range = signal(15);
  countdown = signal(60);   // refresco del detalle: 60s (igual al sondeo del colector)
  ranges = [
    { min: 15, label: 'En vivo' },
    { min: 1440, label: '24h' }, { min: 2880, label: '2d' }, { min: 10080, label: '7d' },
    { min: 43200, label: '30d' }, { min: 259200, label: '6m' }, { min: 525600, label: '1a' },
  ];

  lab = signal<string[]>([]);
  cpuDs = signal<any[]>([]); memDs = signal<any[]>([]); tempDs = signal<any[]>([]); pingDs = signal<any[]>([]);
  trafLab = signal<string[]>([]); trafDs = signal<any[]>([]);
  rxStat = signal(stats([])); txStat = signal(stats([]));
  inErrS = signal(stats([])); outErrS = signal(stats([]));
  inDiscS = signal(stats([])); outDiscS = signal(stats([]));
  trafIface = signal<number>(0);   // 0 = suma del equipo; >0 = id de interfaz (estilo Zabbix)
  trafSel = 0;

  constructor() {
    this.id = +this.route.snapshot.paramMap.get('id')!;
    // Toma SNMP INMEDIATA al entrar (no esperamos al primer salto del contador).
    this.api.devicePoll(this.id).subscribe({ next: () => this.refrescarVivo(), error: () => {} });
    this.api.devices().subscribe((ds) => {
      this.dev.set(ds.find((d) => d.id === this.id) || null);
      this.api.interfaces().subscribe((all) => {
        this.ifaces.set(all);
        // Default: la mejor interfaz UP con capacidad (el uplink), como en Zabbix.
        const best = this.bestIface(all.filter((f) => f.device_name === this.dev()?.name));
        if (this.trafIface() === 0 && best) {
          this.trafSel = best.id;
          this.trafIface.set(best.id);
          this.loadCharts();
        }
      });
    });
    this.loadCharts();
    this.api.catalogoMarcas().subscribe((m) => this.marcas.set(m || []));
    // Auto-refresco en vivo con cuenta regresiva de 1s (refresca gráficos + interfaces).
    this.timer = setInterval(() => {
      const c = this.countdown() - 1;
      if (c <= 0) {
        this.countdown.set(60);
        // El contador FUERZA una toma SNMP real del equipo y recién ahí re-lee, así actualiza datos
        // de verdad (no solo re-muestra lo cacheado). Si el sondeo falla, re-lee igual.
        this.api.devicePoll(this.id).subscribe({ next: () => this.refrescarVivo(), error: () => this.refrescarVivo() });
      } else this.countdown.set(c);
    }, 1000);
  }

  ngOnDestroy(): void { clearInterval(this.timer); }

  myIfaces(): Iface[] {
    const name = this.dev()?.name;
    return this.ifaces().filter((f) => f.device_name === name);
  }

  ifSort = new TableSort<Iface>({
    interfaz: (f) => f.real_name,
    capacidad: (f) => f.capacity_bps,
    rx: (f) => f.rx_bps,
    tx: (f) => f.tx_bps,
    util: (f) => f.util_percent,
    estado: (f) => f.status,
  }, 'interfaz');

  ifaceRows(): Iface[] { return this.ifSort.apply(this.myIfaces()); }

  setRange(min: number) { this.range.set(min); this.loadCharts(); }

  /** Re-lectura tras el sondeo forzado: detalle + interfaces + gráficos. */
  private refrescarVivo() {
    this.loadCharts();
    this.api.devices().subscribe((ds) => this.dev.set(ds.find((d) => d.id === this.id) || null));
    this.api.interfaces().subscribe((all) => this.ifaces.set(all));
  }

  private loadCharts() {
    const id = this.id, r = this.range();
    const pad = r !== 15;   // 'En vivo' (15) sin relleno; rangos fijos rellenan el eje (con spanGaps la línea no cae a 0).
    const nv = (v: any) => (v == null ? null : +v);
    this.api.deviceMetric(id, 'cpu_percent', r, 60, pad).subscribe((p) => { this.lab.set(p.map((x) => x.t)); this.cpuDs.set([areaDs('CPU', '#dc2626', p.map((x) => nv(x.v)))]); });
    this.api.deviceMetric(id, 'memory_percent', r, 60, pad).subscribe((p) => this.memDs.set([areaDs('Mem', '#2563eb', p.map((x) => nv(x.v)))]));
    this.api.deviceMetric(id, 'temperature_celsius', r, 60, pad).subscribe((p) => this.tempDs.set([areaDs('Temp', '#d97706', p.map((x) => nv(x.v)))]));
    this.api.deviceMetric(id, 'ping_ms', r, 60, pad).subscribe((p) => this.pingDs.set([areaDs('Ping', '#16a34a', p.map((x) => nv(x.v)))]));
    const st = (p: any[], k: string) => stats(p.map((x) => nv(x[k])).filter((v) => v != null) as number[]);
    const applyTraf = (p: any[]) => {
      const rx = p.map((x) => nv(x.rx)), tx = p.map((x) => nv(x.tx));
      this.trafLab.set(p.map((x) => x.t));
      this.trafDs.set(zabbixDs(rx, tx));
      this.rxStat.set(stats(rx.filter((v) => v != null) as number[]));
      this.txStat.set(stats(tx.filter((v) => v != null) as number[]));
      this.inErrS.set(st(p, 'in_err')); this.outErrS.set(st(p, 'out_err'));
      this.inDiscS.set(st(p, 'in_disc')); this.outDiscS.set(st(p, 'out_disc'));
    };
    if (this.trafIface() === 0) this.api.deviceTraffic(id, r, 60, pad).subscribe(applyTraf);
    else this.api.interfaceTraffic(this.trafIface(), r, 60, pad).subscribe(applyTraf);
  }

  /** Mejor interfaz para graficar por defecto: UP, con más capacidad (excluye loopback/bridges vacíos). */
  private bestIface(list: Iface[]): Iface | null {
    if (!list.length) return null;
    const up = list.filter((f) => f.status === 'up' && !/^(lo|bridge)/i.test(f.real_name || ''));
    const pool = up.length ? up : list;
    // Arranca en la interfaz con MÁS tráfico real (uplink); si empatan en 0, la de mayor capacidad.
    return [...pool].sort((a, b) =>
      ((b.rx_bps + b.tx_bps) - (a.rx_bps + a.tx_bps)) || (b.capacity_bps - a.capacity_bps))[0];
  }

  onTrafChange() { this.trafIface.set(this.trafSel); this.loadCharts(); }
  /** Abre el modal grande del tráfico actual (equipo o interfaz seleccionada). */
  openTraf() {
    if (this.trafIface() === 0) { this.openLog('traffic', 'Tráfico del equipo', '#2a9d2a'); return; }
    const f = this.myIfaces().find((x) => x.id === this.trafIface());
    if (f) this.openIfaceLog(f);
  }

  rangeLabel() { return this.ranges.find((r) => r.min === this.range())?.label || ''; }

  /** Gráfico de tráfico de UNA interfaz (estilo Zabbix): RX área verde, TX línea roja, min/avg/máx. */
  openIfaceLog(f: Iface) {
    this.logTitle.set(`${f.noc_alias || f.real_name} — tráfico (${this.rangeLabel()})`);
    this.showLog.set(true);
    this.logFmt.set('gbps');
    this.logLab.set([]); this.logDs.set([]); this.logList.set([]);
    const pad = this.range() !== 15;
    const nv = (v: any) => (v == null ? null : +v);
    this.api.interfaceTraffic(f.id, this.range(), 120, pad).subscribe((p) => {
      this.logLab.set(p.map((x) => x.t));
      this.logDs.set(zabbixDs(p.map((x) => nv(x.rx)), p.map((x) => nv(x.tx))));
      this.logList.set(p.slice().reverse().filter((x) => x.rx != null || x.tx != null)
        .map((x) => ({ t: x.t, v: `RX ${(+x.rx! || 0).toFixed(2)} Gbps · TX ${(+x.tx! || 0).toFixed(2)} Gbps` })));
    });
  }

  openLog(metric: string, label: string, color: string) {
    this.logTitle.set(`${this.dev()?.name} · ${label} — histórico (${this.rangeLabel()})`);
    this.showLog.set(true);
    this.logFmt.set(metric === 'traffic' ? 'gbps' : '');
    this.logLab.set([]); this.logDs.set([]); this.logList.set([]);
    const pad = this.range() !== 15;
    const nv = (v: any) => (v == null ? null : +v);
    if (metric === 'traffic') {
      this.api.deviceTraffic(this.id, this.range(), 120, pad).subscribe((p) => {
        this.logLab.set(p.map((x) => x.t));
        this.logDs.set(zabbixDs(p.map((x) => nv(x.rx)), p.map((x) => nv(x.tx))));
        this.logList.set(p.slice().reverse().filter((x) => x.rx != null || x.tx != null)
          .map((x) => ({ t: x.t, v: `RX ${(+x.rx! || 0).toFixed(2)} Gbps · TX ${(+x.tx! || 0).toFixed(2)} Gbps` })));
      });
    } else {
      this.api.deviceMetric(this.id, metric, this.range(), 120, pad).subscribe((p) => {
        this.logLab.set(p.map((x) => x.t));
        this.logDs.set([areaDs(label, color, p.map((x) => nv(x.v)))]);
        this.logList.set(p.slice().reverse().filter((x) => x.v != null).map((x) => ({ t: x.t, v: String(x.v) })));
      });
    }
  }

  openEdit(d: Device) {
    this.ef = { ...d };
    this.showEdit.set(true);
    // Si es OLT, prefilea la config Telnet + barrido desde su fila en kxt_olt.
    if (d.device_type === 'olt') {
      this.api.zteOlts().subscribe((olts) => {
        // Emparejar por NOMBRE (único), NO por host: varias OLT comparten IP y por host
        // agarraba la fila equivocada -> los datos "no quedaban" al reabrir.
        const o = olts.find((x) => x.name === d.name) || olts.find((x) => x.host === d.ip_address);
        if (o) {
          this.ef.telnet_user = o.telnetUser;
          this.ef.telnet_port = o.telnetPort;
          this.ef.snmp_poll_enabled = o.snmpPollEnabled;
          this.ef.snmp_poll_seconds = o.snmpPollSeconds;
          // La community que usa el MOTOR vive en kxt_olt; mostrar esa.
          if (o.snmpCommunity) this.ef.snmp_community = o.snmpCommunity;
          // Preselecciona el perfil del catálogo (Tipo de OLT) si ya está asignado.
          this.ef.id_red_olt_marca = o.idRedOltMarca ?? undefined;
          if (o.softwareVersion) this.ef.software_version = o.softwareVersion;
        }
      });
    }
  }

  /** Al elegir la marca del ERP, guarda su id y refleja el nombre en vendor (llave del motor). */
  applyMarca(id: any) {
    const m = this.marcas().find((x) => x.idRedOltMarca === id);
    if (!m) return;
    this.ef.vendor = m.marca;
  }
  saveEdit() {
    // Si es OLT y se ingresaron credenciales Telnet, validar la conexión antes de guardar.
    if (!this.ef.id && this.ef.device_type === 'olt' && this.ef.telnet_user) {   // detalle = siempre EDICION -> no se prueba Telnet (solo al AGREGAR)
      this.testing.set(true); this.testErr.set('');
      this.api.testTelnet({ host: this.ef.ip_address, port: this.ef.telnet_port || 23, user: this.ef.telnet_user, pass: this.ef.telnet_pass })
        .subscribe({
          next: (r: any) => {
            this.testing.set(false);
            if (r?.ok) this.doSaveEdit();
            else this.testErr.set(r?.error || 'No se pudo conectar por Telnet a la OLT.');
          },
          error: () => { this.testing.set(false); this.testErr.set('No se pudo probar la conexión Telnet.'); },
        });
    } else {
      this.doSaveEdit();
    }
  }

  doSaveEdit() {
    this.saveErr.set('');
    this.api.updateDevice(this.id, this.ef).subscribe({
      next: () => {
        this.showEdit.set(false); this.testErr.set('');
        this.api.devices().subscribe((ds) => this.dev.set(ds.find((x) => x.id === this.id) || null));
      },
      // Antes el error no se capturaba: el guardado fallaba en silencio y solo quedaba
      // rastro en la consola del navegador.
      error: (e: any) => {
        this.testErr.set('');
        this.saveErr.set(e?.message || 'No se pudieron guardar los cambios.');
      },
    });
  }
  back() { this.router.navigate(['/app/monitoreo/equipos']); }
  removeDevice() {
    if (!confirm('¿Eliminar este equipo y todos sus datos históricos?')) return;
    this.api.deleteDevice(this.id).subscribe(() => this.router.navigate(['/app/monitoreo/equipos']));
  }

  /** Formatea paquetes/seg (errores/descartes) estilo Zabbix. */
  pk(v: number): string {
    if (v == null || v < 0.005) return '0';
    return v < 10 ? v.toFixed(2) : Math.round(v).toString();
  }
  utilColor(u: number) { return u >= 90 ? '#dc2626' : u >= 80 ? '#d97706' : '#16a34a'; }
  ifBadge(s: string) { return s === 'up' ? '<span class="badge b-up">UP</span>' : s === 'down' ? '<span class="badge b-down">DOWN</span>' : '<span class="badge b-maint">UNKNOWN</span>'; }
}
