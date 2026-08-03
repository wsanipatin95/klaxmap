import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NocApi } from '../services/noc-api';

/**
 * Pantalla de INICIO — panel de ALERTA TEMPRANA del NOC (global).
 * Un vistazo: ¿qué está mal y qué es urgente? — antes de ir a la topología/detalle.
 * Se alimenta de /api/overview (alertas + OLTs + equipos). Auto-refresco + pantalla completa.
 */
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="tools">
      <span style="font-weight:800;font-size:18px">🚨 Alerta temprana</span>
      <span class="badge" [class.b-down]="(c().crit||0)>0" [class.b-up]="(c().crit||0)===0" style="margin-left:6px">
        {{ (c().crit||0)>0 ? 'ATENCIÓN' : 'TODO EN ORDEN' }}
      </span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:14px">
        <span style="font-family:'Consolas',monospace;font-size:15px;font-weight:700">{{ clock() }}</span>
        <span style="color:var(--red);font-size:11px;font-weight:600">● en vivo · {{ countdown() }}s</span>
        <button class="btn ghost sm" (click)="full()">⛶ Pantalla completa</button>
      </span>
    </div>

    @if (err()) {
      <div class="panel" style="border-color:#f3b4b4;background:#fdeaea;margin-bottom:12px"><div class="pb" style="color:var(--red);font-weight:600">⚠ {{ err() }}</div></div>
    }

    <!-- Semáforo global: cada tarjeta FILTRA la lista de alertas de abajo (sin salir) -->
    <div class="sem">
      <div class="tile" [class.hot]="(c().crit||0)>0" [class.sel]="filter()==='crit'" (click)="toggle('crit')" title="Filtrar críticas"><div class="n">{{ c().crit||0 }}</div><div class="l">🔴 Críticas</div></div>
      <div class="tile" [class.warm]="(c().warn||0)>0" [class.sel]="filter()==='warn'" (click)="toggle('warn')" title="Filtrar advertencias"><div class="n">{{ c().warn||0 }}</div><div class="l">🟠 Advertencias</div></div>
      <div class="tile" [class.warm]="(oltsProblem()||0)>0" [class.sel]="filter()==='oltprob'" (click)="toggle('oltprob')" title="Filtrar alertas de OLT/GPON"><div class="n">{{ oltsProblem()||0 }}</div><div class="l">OLTs con problema</div></div>
      <div class="tile" [class.hot]="(c().ponDown||0)>0" [class.sel]="filter()==='pon'" (click)="toggle('pon')" title="Filtrar puertos PON"><div class="n">{{ c().ponDown||0 }}</div><div class="l">Puertos PON caídos</div></div>
      <div class="tile" [class.hot]="(c().onusLos||0)>0" [class.sel]="filter()==='los'" (click)="toggle('los')" title="Filtrar cortes de fibra (LOS)"><div class="n">{{ c().onusLos||0 }}</div><div class="l">ONUs en LOS (fibra)</div></div>
      <div class="tile" [class.warm]="(c().signalRisk||0)>0" [class.sel]="filter()==='signal'" (click)="toggle('signal')" title="Filtrar señal en riesgo"><div class="n">{{ c().signalRisk||0 }}</div><div class="l">Señal en riesgo</div></div>
      <div class="tile" [class.hot]="(c().equiposDown||0)>0" [class.sel]="filter()==='equipos'" (click)="toggle('equipos')" title="Filtrar equipos"><div class="n">{{ c().equiposDown||0 }}</div><div class="l">Equipos caídos</div></div>
      <div class="tile info" title="ONUs apagadas (router del cliente). Es informativo — no genera alerta."><div class="n" style="color:var(--muted)">{{ c().onusOffline||0 }}</div><div class="l">ONUs offline</div></div>
    </div>

    <!-- Cambios de estado (transiciones) en la ventana elegida -->
    <div class="panel">
      <div class="ph">🔀 Cambios de estado
        <span class="mini">clientes que pasaron de OK a otro estado, por OLT · equipos también</span>
        <span class="segT" style="margin-left:auto">
          @for (w of transWins; track w.m) { <button [class.on]="transWin()===w.m" (click)="setTransWin(w.m)">{{ w.label }}</button> }
        </span>
      </div>
      <div class="pb">
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px;font-size:12.5px">
          <span><b style="color:var(--red)">{{ transTot('a_sin') }}</b> → sin servicio</span>
          <span><b style="color:var(--amber)">{{ transTot('a_riesgo') }}</b> → señal en riesgo</span>
          <span><b style="color:var(--green)">{{ transTot('recuperados') }}</b> recuperados</span>
          <span style="margin-left:auto"><b>{{ trans()?.equipos?.caidos || 0 }}</b> equipos caídos · <b style="color:var(--green)">{{ trans()?.equipos?.recuperados || 0 }}</b> recuperados</span>
        </div>
        @if (transOlts().length) {
          <table>
            <thead><tr><th>OLT</th><th>→ sin servicio</th><th>→ riesgo</th><th>OK→riesgo</th><th>OK→sin serv.</th><th>recuperados</th></tr></thead>
            <tbody>
              @for (o of transOlts(); track o.olt_id) {
                <tr>
                  <td><b>{{ o.name }}</b></td>
                  <td><b style="color:var(--red)">{{ o.a_sin }}</b></td>
                  <td style="color:var(--amber)">{{ o.a_riesgo }}</td>
                  <td>{{ o.ok_riesgo }}</td>
                  <td>{{ o.ok_sin }}</td>
                  <td style="color:var(--green)">{{ o.recuperados }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div style="padding:16px;text-align:center;color:var(--muted)">Sin cambios de estado en esta ventana. (Se empieza a acumular desde que corre el job de transiciones en NOC.)</div>
        }
      </div>
    </div>

    <div class="split">
      <!-- Alertas activas priorizadas -->
      <div class="panel">
        <div class="ph">⚠ Alertas activas
          @if (filter()) {
            <span class="badge b-ack" style="margin-left:8px">{{ filterLabel() }} · {{ shown().length }}</span>
            <button class="btn ghost sm" style="margin-left:6px" (click)="filter.set('')">✕ Todas</button>
          } @else {
            <span class="mini">{{ alerts().length }} abiertas · críticas primero</span>
          }
        </div>
        <div class="alist">
          @for (a of paged(); track a.id) {
            <a class="arow" [class.crit]="a.severity==='crit'" [routerLink]="alertRoute(a)" [queryParams]="alertQuery(a)" title="Ir al detalle">
              <span class="dot" [style.background]="a.severity==='crit' ? 'var(--red)' : 'var(--amber)'"></span>
              <div class="atxt">
                <div class="ad">{{ a.description }}</div>
                <div class="am"><b>{{ a.device_name }}</b> · {{ catLabel(a.category) }}</div>
              </div>
              <span class="ago">{{ ago(a.ago) }}</span>
            </a>
          } @empty {
            @if (filter()) {
              <div style="padding:24px;text-align:center;color:var(--muted)">Sin alertas de "{{ filterLabel() }}" en la lista activa.</div>
            } @else {
              <div style="padding:24px;text-align:center;color:var(--green);font-weight:600">✅ Sin alertas activas. Todo operando normal.</div>
            }
          }
        </div>
        @if (shown().length > pageSize) {
          <div class="pager">
            <button class="btn ghost sm" [disabled]="page()===0" (click)="prevPage()">← Anterior</button>
            <span style="font-size:12px;color:var(--muted)">Página {{ page()+1 }} de {{ totalPages() }} · {{ shown().length }} alertas</span>
            <button class="btn ghost sm" [disabled]="page()>=totalPages()-1" (click)="nextPage()">Siguiente →</button>
          </div>
        }
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <!-- Mapa de calor de OLTs -->
        <div class="panel">
          <div class="ph">🩺 OLTs <span class="mini">estado GPON</span></div>
          <div class="pb">
            <div class="heat">
              @for (o of olts(); track o.id) {
                <a class="olt" [class.crit]="o.worst==='crit'" [class.warn]="o.worst==='warn'" routerLink="/app/monitoreo/salud-gpon" [queryParams]="{olt: o.id, back:1}" title="Ver Salud GPON de esta OLT">
                  <div class="on">{{ o.name }}</div>
                  <div class="ostat">
                    <span>{{ o.online }}/{{ o.total }} online</span>
                    @if (o.los>0) { <span class="chip cr">LOS {{ o.los }}</span> }
                    @if (o.pon_down>0) { <span class="chip cr">PON {{ o.pon_down }}</span> }
                    @if (o.signal_risk>0) { <span class="chip wr">señal {{ o.signal_risk }}</span> }
                  </div>
                </a>
              } @empty { <div style="color:var(--muted);padding:8px">Sin OLTs.</div> }
            </div>
          </div>
        </div>

        <!-- Equipos (toda la flota: core / borde / MikroTik) -->
        <div class="panel">
          <div class="ph">🖧 Equipos <span class="mini">core / borde / MikroTik · {{ equipos().length }}</span></div>
          <div class="pb">
            <div class="heat">
              @for (e of equipos(); track e.id) {
                <a class="olt" [class.crit]="e.worst==='crit'" [class.warn]="e.worst==='warn'" [routerLink]="['/app/monitoreo/equipos', e.id]" [queryParams]="{back:1}" title="Ver equipo">
                  <div class="on">{{ e.name }}</div>
                  <div class="ostat">
                    @if (e.worst==='crit') { <span class="chip cr">CAÍDO</span> } @else { <span style="color:var(--green);font-weight:700">OK</span> }
                    @if (e.cpu_percent!=null) { <span>· CPU {{ e.cpu_percent }}%</span> }
                    @if (e.temp_celsius!=null) { <span>· {{ e.temp_celsius }}°C</span> }
                  </div>
                </a>
              } @empty { <div style="color:var(--muted);padding:8px">Sin equipos.</div> }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sem { display:grid; grid-template-columns:repeat(8,1fr); gap:10px; margin-bottom:14px; }
    @media(max-width:1100px){ .sem{ grid-template-columns:repeat(4,1fr) } }
    .tile { display:block; background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:12px 10px; text-align:center; box-shadow:var(--shadow); text-decoration:none; color:var(--text); cursor:pointer; transition:.12s; }
    .tile:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.12); }
    .tile.info { cursor:default; } .tile.info:hover { transform:none; box-shadow:var(--shadow); }
    .tile.sel { outline:3px solid var(--primary); outline-offset:1px; background:var(--primary-soft); }
    .tile.sel .n { color:var(--primary); }
    .tile .n { font-size:30px; font-weight:800; line-height:1; }
    .tile .l { font-size:11px; color:var(--muted); margin-top:6px; }
    .tile.hot { background:#fdeaea; border-color:#f3b4b4; } .tile.hot .n { color:var(--red); }
    .tile.warm { background:#fff6e6; border-color:#f3d69a; } .tile.warm .n { color:var(--amber); }
    .split { display:grid; grid-template-columns:1.2fr .8fr; gap:12px; align-items:start; }
    @media(max-width:1000px){ .split{ grid-template-columns:1fr } }
    .alist { max-height:58vh; overflow:auto; }
    .pager { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 14px; border-top:1px solid var(--border); }
    .arow { display:flex; align-items:center; gap:10px; padding:9px 14px; border-bottom:1px solid var(--border); text-decoration:none; color:var(--text); cursor:pointer; }
    .arow:hover { background:var(--primary-soft); }
    .arow.crit { background:#fdf3f3; }
    .arow .dot { width:9px; height:9px; border-radius:50%; flex:none; }
    .atxt { flex:1; min-width:0; } .ad { font-size:13px; font-weight:600; }
    .am { font-size:11.5px; color:var(--muted); }
    .ago { font-size:11px; color:var(--muted); white-space:nowrap; }
    .heat { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
    .olt { display:block; border:1px solid var(--border); border-radius:10px; padding:9px 10px; text-decoration:none; color:var(--text); background:#f7fbf8; }
    .olt.warn { background:#fff6e6; border-color:#f3d69a; } .olt.crit { background:#fdeaea; border-color:#f3b4b4; }
    .olt .on { font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .olt .ostat { font-size:11px; color:var(--muted); margin-top:4px; display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
    .chip { padding:1px 6px; border-radius:6px; font-size:10px; font-weight:700; }
    .chip.cr { background:#fdeaea; color:var(--red); } .chip.wr { background:#fff6e6; color:var(--amber); }
    .eqrow { display:flex; align-items:center; gap:9px; padding:7px 4px; border-bottom:1px solid var(--border); text-decoration:none; color:var(--text); }
    .eqrow .dot { width:9px; height:9px; border-radius:50%; }
    .eqm { font-size:11.5px; color:var(--muted); }
  `],
})
export class Inicio implements OnDestroy {
  private api = inject(NocApi);
  private readonly REFRESH = 15;
  c = signal<any>({});
  oltsProblem = signal(0);
  alerts = signal<any[]>([]);
  olts = signal<any[]>([]);
  equipos = signal<any[]>([]);
  clock = signal('');
  countdown = signal(15);
  filter = signal('');   // filtro activo del semáforo (vacío = todas)
  private timer: any;

  // Transiciones de estado (cambios OK→riesgo/sin servicio, recuperaciones, equipos)
  trans = signal<any>(null);
  transWin = signal(60);                                   // ventana en minutos
  readonly transWins = [{ label: '1h', m: 60 }, { label: '6h', m: 360 }, { label: '24h', m: 1440 }];
  transOlts = computed(() => (this.trans()?.olts ?? []) as any[]);
  transTot(key: string): number { return this.transOlts().reduce((s, o) => s + (+o[key] || 0), 0); }
  setTransWin(m: number) { this.transWin.set(m); this.loadTrans(); }
  loadTrans() { this.api.transiciones(this.transWin()).subscribe({ next: (t) => this.trans.set(t), error: () => {} }); }

  page = signal(0);
  readonly pageSize = 25;

  /** Alterna el filtro del semáforo (clic de nuevo = quita el filtro). Reinicia la página. */
  toggle(key: string) { this.filter.set(this.filter() === key ? '' : key); this.page.set(0); }

  /** Alertas mostradas según el filtro seleccionado. */
  shown = computed(() => {
    const f = this.filter();
    if (!f) return this.alerts();
    return this.alerts().filter((a) => this.matchFilter(a, f));
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.shown().length / this.pageSize)));
  paged = computed(() => {
    const p = Math.min(this.page(), this.totalPages() - 1);
    return this.shown().slice(p * this.pageSize, p * this.pageSize + this.pageSize);
  });
  prevPage() { this.page.set(Math.max(0, this.page() - 1)); }
  nextPage() { this.page.set(Math.min(this.totalPages() - 1, this.page() + 1)); }

  private matchFilter(a: any, key: string): boolean {
    const cat = a.category || '';
    const d = (a.description || '').toLowerCase();
    switch (key) {
      case 'crit': return a.severity === 'crit';
      case 'warn': return a.severity !== 'crit';
      case 'oltprob': return cat === 'signal' || cat === 'pon';
      case 'pon': return cat === 'pon';
      case 'los': return d.includes('(los)') || d.includes('corte de fibra') || d.includes('fibra cortada');
      case 'signal': return cat === 'signal' && d.includes('señal');
      case 'equipos': return cat === 'down';
      case 'offline': return d.includes('(offline)') || d.includes('caíd');
      default: return true;
    }
  }

  filterLabel = computed(() => {
    const m: Record<string, string> = { crit: 'Críticas', warn: 'Advertencias', oltprob: 'OLT/GPON',
      pon: 'Puertos PON', los: 'Cortes de fibra (LOS)', signal: 'Señal en riesgo', equipos: 'Equipos', offline: 'ONUs offline' };
    return m[this.filter()] || '';
  });

  constructor() {
    this.load();
    this.loadTrans();
    this.timer = setInterval(() => {
      this.clock.set(new Date().toLocaleTimeString('es-EC'));
      const n = this.countdown() - 1;
      if (n <= 0) { this.countdown.set(this.REFRESH); this.load(); this.loadTrans(); } else this.countdown.set(n);
    }, 1000);
    this.clock.set(new Date().toLocaleTimeString('es-EC'));
    document.addEventListener('fullscreenchange', this.fsHandler);
  }
  ngOnDestroy() {
    clearInterval(this.timer);
    document.removeEventListener('fullscreenchange', this.fsHandler);
    document.body.classList.remove('noc-full');
    if (document.fullscreenElement) document.exitFullscreen?.();
  }
  /** Al salir de pantalla completa con Esc, quita la clase que oculta el chrome. */
  private fsHandler = () => { if (!document.fullscreenElement) document.body.classList.remove('noc-full'); };

  err = signal('');
  private load() {
    this.api.overview().subscribe({
      next: (r) => {
        this.err.set('');
        this.c.set(r.counters || {});
        this.oltsProblem.set(r.oltsProblem || 0);
        this.alerts.set(r.alerts || []);
        this.olts.set(r.olts || []);
        this.equipos.set(r.equipos || []);
      },
      error: () => this.err.set('No se pudo leer /api/overview — ¿está corriendo el backend recompilado?'),
    });
  }

  ago(s: number): string {
    s = +s || 0;
    if (s < 60) return 'hace ' + s + 's';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + 'm';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + 'h';
    return 'hace ' + Math.floor(s / 86400) + 'd';
  }
  /** Drill fino de cada alerta: GPON -> Salud GPON de esa OLT; equipo -> su detalle. */
  alertRoute(a: any): any[] {
    if (a.category === 'signal' || a.category === 'pon') return ['/app/monitoreo/salud-gpon'];
    if (a.device_id != null) return ['/app/monitoreo/equipos', a.device_id];
    if (a.category) return ['/app/monitoreo/equipos'];
    return ['/app/monitoreo/alertas'];
  }
  alertQuery(a: any): any {
    if ((a.category === 'signal' || a.category === 'pon') && a.olt_id != null) return { olt: a.olt_id, back: 1 };
    return { back: 1 };
  }
  catLabel(cat: string): string {
    const m: Record<string, string> = { down: 'caída', cpu: 'CPU', mem: 'memoria', temp: 'temperatura',
      iface: 'interfaz', iface_err: 'errores if.', reboot: 'reinicio', signal: 'ONU/señal', pon: 'puerto PON' };
    return m[cat] || cat || '—';
  }
  full() {
    const el: any = document.documentElement;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); document.body.classList.add('noc-full'); }
    else { document.exitFullscreen?.(); document.body.classList.remove('noc-full'); }
  }
}
