import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NocApi, ZteOltRow, OnuRow } from '../services/noc-api';
import { TableSort } from '../shared/table-sort';

type SigLevel = 'crit' | 'weak' | 'warn';
type DownKind = 'los' | 'off' | 'noresp';
type Sel = 'ok' | 'sig' | 'down' | 'all';

/**
 * Panel operativo del NOC (para mostrárselo al cliente).
 *   - Pestañas: una por OLT.
 *   - Los 4 recuadros de arriba son ACCIONES: al presionar uno, se despliega su lista abajo.
 *   - Botón de pantalla completa (oculta la barra superior).
 *
 * Umbrales de señal (dBm): advertencia ≤ -25 · débil ≤ -26.5 · crítica ≤ -28
 * "Sin servicio": sin respuesta, LOS, offline o potencia nula.
 */
@Component({
  selector: 'app-panel-noc',
  standalone: true,
  imports: [],
  template: `
    <div class="tools">
      @if (showBack()) { <button class="btn ghost sm" (click)="back()" title="Volver">← Atrás</button> }
      <span style="font-weight:700;font-size:16px">🩺 Salud GPON</span>
      <span style="margin-left:auto;font-family:'Consolas',monospace;font-size:14px;font-weight:700;color:#333">🕒 {{ clock() }}</span>
      @if (olts().length > 1) {
        <button class="btn ghost" (click)="toggleRotate()" [title]="rotate() ? 'Pausar rotación de OLTs' : 'Rotar OLTs automáticamente'">{{ rotate() ? '⏸ Fijar' : '🔄 Rotar' }}</button>
        @if (rotate()) { <span style="color:var(--primary);font-size:12px;font-weight:600">rota en {{ rotateLeft() }}s</span> }
      }
      <button class="btn ghost" (click)="toggleFull()">{{ full() ? '✕ Salir de pantalla completa' : '⛶ Pantalla completa' }}</button>
      <span style="color:var(--red);font-size:12px;font-weight:600">● en vivo · {{ countdown() }} s</span>
    </div>

    @if (olts().length) {
      <div class="tabs">
        @for (o of olts(); track o.id) {
          <button class="tab" [class.on]="o.id === oltId()" (click)="selectOlt(o.id)">
            {{ o.name }}
            @if (badge(o.id) > 0) { <span class="tab-badge">{{ badge(o.id) }}</span> }
          </button>
        }
      </div>
    } @else {
      <div class="panel"><div class="pb" style="color:var(--muted)">No hay OLTs registradas todavía.</div></div>
    }

    @if (oltId()) {
      <!-- 4 recuadros = acciones (clic para desplegar la lista abajo) -->
      <div class="kpis">
        <button class="kpi ok"    [class.on]="sel()==='ok'"   (click)="sel.set('ok')">
          <div class="n">{{ okList().length }}</div><div class="l">Con servicio OK</div></button>
        <button class="kpi warn"  [class.on]="sel()==='sig'"  (click)="sel.set('sig')">
          <div class="n">{{ senal().length }}</div><div class="l">Señal en riesgo</div></button>
        <button class="kpi bad"   [class.on]="sel()==='down'" (click)="sel.set('down')">
          <div class="n">{{ caidos().length }}</div><div class="l">Sin servicio</div></button>
        <button class="kpi total" [class.on]="sel()==='all'"  (click)="sel.set('all')">
          <div class="n">{{ onus().length }}</div><div class="l">Clientes en la OLT</div></button>
      </div>

      <!-- Lista desplegada de la acción elegida -->
      <div class="panel" style="margin-top:12px">
        <div class="ph">{{ selIcon() }} {{ selTitle() }} <span class="cnt" style="margin-left:auto">{{ current().length }}</span></div>
        @if (current().length) {
          <div class="tbl">
            @if (sel() === 'down') {
              <table>
                <thead><tr>
                  <th class="srt" (click)="sort.by('cliente')">Cliente{{ sort.arrow('cliente') }}</th>
                  <th class="srt" (click)="sort.by('contrato')">Contrato{{ sort.arrow('contrato') }}</th>
                  <th class="srt" (click)="sort.by('onu')">ONU{{ sort.arrow('onu') }}</th>
                  <th class="srt" (click)="sort.by('motivo')">Motivo{{ sort.arrow('motivo') }}</th>
                  <th class="srt" (click)="sort.by('desde')">Desde{{ sort.arrow('desde') }}</th>
                  <th class="srt" (click)="sort.by('actualizado')">Actualizado{{ sort.arrow('actualizado') }}</th>
                </tr></thead>
                <tbody>
                  @for (o of rows(); track o.id) {
                    <tr style="cursor:pointer" (click)="openLog(o)" title="Ver log de eventos">
                      <td><b>{{ clientOnly(o.clientName) }}</b></td>
                      <td class="mono">{{ contrato(o.clientName) || '—' }}</td>
                      <td class="mono">{{ o.rawIndex }}</td>
                      <td><span class="badge" [style.background]="downBg(o)" style="color:#fff">{{ downLabel(o) }}</span></td>
                      <td style="font-size:12px;color:var(--muted)">{{ downSince(o) }}</td>
                      <td style="font-size:12px;color:var(--muted)">{{ fmtTs(o.updatedAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <table>
                <thead><tr>
                  <th class="srt" (click)="sort.by('cliente')">Cliente{{ sort.arrow('cliente') }}</th>
                  <th class="srt" (click)="sort.by('contrato')">Contrato{{ sort.arrow('contrato') }}</th>
                  <th class="srt" (click)="sort.by('onu')">ONU{{ sort.arrow('onu') }}</th>
                  <th class="srt" (click)="sort.by('rx')">Señal RX{{ sort.arrow('rx') }}</th>
                  <th class="srt" (click)="sort.by('estado')">{{ sel()==='sig' ? 'Nivel' : 'Estado' }}{{ sort.arrow('estado') }}</th>
                  <th class="srt" (click)="sort.by('actualizado')">Actualizado{{ sort.arrow('actualizado') }}</th>
                </tr></thead>
                <tbody>
                  @for (o of rows(); track o.id) {
                    <tr style="cursor:pointer" (click)="openLog(o)" title="Ver log de eventos">
                      <td><b>{{ clientOnly(o.clientName) }}</b></td>
                      <td class="mono">{{ contrato(o.clientName) || '—' }}</td>
                      <td class="mono">{{ o.rawIndex }}</td>
                      <td><b [style.color]="rxColor(o.onuRxDbm)">{{ o.onuRxDbm!=null ? o.onuRxDbm.toFixed(2)+' dBm' : '—' }}</b></td>
                      @if (sel()==='sig') {
                        <td><span class="badge" [style.background]="sevBg(o.onuRxDbm)" style="color:#fff">{{ sevLabel(o.onuRxDbm) }}</span></td>
                      } @else {
                        <td [innerHTML]="stateBadge(o)"></td>
                      }
                      <td style="font-size:12px;color:var(--muted)">{{ fmtTs(o.updatedAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        } @else { <div class="empty">✅ Sin clientes en esta categoría.</div> }
      </div>
    }

    <!-- Ventana emergente: log de eventos / cambios de estado del cliente -->
    @if (evt(); as o) {
      <div class="overlay on" (click)="closeLog()"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="closeLog()">
        <div class="panel" style="width:46vw;min-width:560px;max-width:720px;max-height:90vh;overflow:auto" (click)="$event.stopPropagation()">
          <div class="ph">📜 Log de eventos <span class="mut" style="font-weight:400">{{ clientOnly(o.clientName) }} · {{ o.rawIndex }}</span>
            <button class="btn sm ghost" style="margin-left:auto" (click)="closeLog()">✕</button>
          </div>
          <div class="pb">
            <!-- estado actual -->
            <div class="now">
              <div><span class="k">Estado</span> <span [innerHTML]="stateBadge(o)"></span></div>
              <div><span class="k">Señal</span> <b [style.color]="rxColor(o.onuRxDbm)">{{ o.onuRxDbm!=null ? o.onuRxDbm.toFixed(2)+' dBm' : '—' }}</b></div>
              <div><span class="k">Última lectura</span> <b>{{ fmtTs(o.updatedAt) }}</b></div>
            </div>

            <div class="sec">Eventos / alertas</div>
            @if (evtRows().length) {
              <div class="log">
                @for (e of evtRows(); track $index) {
                  <div class="row">
                    <span class="hora">{{ e.time }}</span>
                    <span class="badge" [class.b-crit]="e.kind==='crit'" [class.b-warn]="e.kind==='warn'" [class.b-down]="e.kind==='down'" [class.b-up]="e.kind==='up'">{{ e.tag }}</span>
                    <span class="txt">{{ e.text }}</span>
                  </div>
                }
              </div>
            } @else { <div class="empty2">Sin eventos registrados para este cliente.</div> }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
    .tab { position:relative; border:1px solid var(--border); background:#fff; border-radius:9px 9px 0 0;
           padding:8px 14px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; }
    .tab.on { color:#7b0061; border-color:#7b0061; border-bottom-color:#fff; background:#fdf5fb; }
    .tab-badge { display:inline-block; margin-left:6px; background:var(--red); color:#fff; font-size:10.5px;
                 border-radius:99px; padding:1px 6px; }
    .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
    .kpi { border:1px solid var(--border); border-radius:12px; padding:16px; text-align:center; background:#fff;
           cursor:pointer; transition:.15s; }
    .kpi:hover { box-shadow:0 2px 10px rgba(16,24,40,.10); transform:translateY(-1px); }
    .kpi .n { font-size:30px; font-weight:800; line-height:1; }
    .kpi .l { font-size:12px; color:var(--muted); margin-top:6px; }
    .kpi.ok .n { color:var(--green); } .kpi.warn .n { color:var(--amber); }
    .kpi.bad .n { color:var(--red); } .kpi.total .n { color:#333; }
    .kpi.on { border-width:2px; }
    .kpi.ok.on { border-color:var(--green); background:#f0fdf4; }
    .kpi.warn.on { border-color:var(--amber); background:#fffbeb; }
    .kpi.bad.on { border-color:var(--red); background:#fef2f2; }
    .kpi.total.on { border-color:#333; background:#f8fafc; }
    @media (max-width:800px){ .kpis{ grid-template-columns:repeat(2,1fr);} }
    .cnt { background:#eef1f6; color:#333; font-weight:700; border-radius:99px; padding:2px 10px; font-size:12.5px; }
    .tbl { overflow:visible; }
    th.srt { cursor:pointer; user-select:none; white-space:nowrap; }
    th.srt:hover { color:var(--primary); }
    .empty { padding:24px; text-align:center; color:var(--green); font-size:13.5px; }
    .mut { color:var(--muted); }
    .now { display:flex; gap:22px; flex-wrap:wrap; padding:10px 12px; background:#f8fafc; border:1px solid var(--border);
           border-radius:9px; font-size:13px; }
    .now .k { color:var(--muted); font-size:11px; display:block; }
    .sec { font-size:13px; font-weight:700; margin:16px 0 8px; }
    .log { border:1px solid var(--border); border-radius:9px; overflow:hidden; }
    .log .row { display:flex; gap:12px; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border); font-size:12.5px; }
    .log .row:last-child { border-bottom:none; }
    .log .hora { font-family:'Consolas',monospace; color:var(--muted); min-width:96px; }
    .log .txt { flex:1; }
    .empty2 { padding:16px; text-align:center; color:var(--muted); font-size:12.5px; }
  `],
})
export class PanelNoc implements OnDestroy {
  private api = inject(NocApi);
  private route = inject(ActivatedRoute);
  showBack = signal(false);
  back() { history.back(); }
  private timer: any;
  private badgeTimer: any;
  private fsHandler = () => {
    if (!document.fullscreenElement) { document.body.classList.remove('noc-full'); this.full.set(false); }
  };

  olts = signal<ZteOltRow[]>([]);
  oltId = signal(0);
  onus = signal<OnuRow[]>([]);
  countdown = signal(20);
  sel = signal<Sel>('down');
  full = signal(false);
  clock = signal('');
  rotate = signal(true);                    // rotación automática de pestañas (modo dashboard)
  rotateLeft = signal(15);
  evt = signal<OnuRow | null>(null);       // cliente cuyo log está abierto
  evtAlerts = signal<any[]>([]);
  private badges = signal<Record<number, number>>({});

  /** Log combinado: caídas del historial + alertas de la ONU, con su hora. */
  evtRows = computed(() => {
    const rows: { time: string; kind: string; tag: string; text: string }[] = [];
    const o = this.evt();
    if (o?.offlineHistory) {
      o.offlineHistory.split(';').filter((s) => s).forEach((s) => {
        const [t, c] = s.split('|');
        rows.push({ time: t, kind: 'down', tag: this.causeTag(c), text: 'Cambio de estado: caída' });
      });
    }
    this.evtAlerts().forEach((a) => {
      const resolved = a.status === 'resolved';
      rows.push({
        time: a.started || '',
        kind: a.severity === 'crit' ? 'crit' : resolved ? 'up' : 'warn',
        tag: a.severity === 'crit' ? 'CRÍTICA' : resolved ? 'RESUELTA' : 'ALERTA',
        text: a.description || '',
      });
    });
    return rows;
  });

  // Umbrales e intervalos (configurables en Configuración → Salud GPON).
  warnT = signal(-25);
  weakT = signal(-26.5);
  critT = signal(-28);
  rotateSecs = signal(15);
  refreshSecs = signal(20);

  senal = computed(() =>
    this.onus()
      .filter((o) => o.onuRxDbm != null && o.onuRxDbm <= this.warnT())
      .sort((a, b) => (a.onuRxDbm ?? 0) - (b.onuRxDbm ?? 0)));

  caidos = computed(() => {
    const rank = { los: 0, off: 1, noresp: 2 };   // primero los cortes de fibra (LOS)
    return this.onus()
      .filter((o) => (o.phaseState || '').toLowerCase() !== 'working')   // offline / LOS
      .sort((a, b) => rank[this.downKind(a)] - rank[this.downKind(b)]);
  });

  // Con servicio OK: online y sin señal en riesgo (RX buena o sin lectura óptica).
  okList = computed(() =>
    this.onus().filter((o) => (o.phaseState || '').toLowerCase() === 'working'
      && (o.onuRxDbm == null || o.onuRxDbm > this.warnT())));

  current = computed<OnuRow[]>(() => {
    switch (this.sel()) {
      case 'ok': return this.okList();
      case 'sig': return this.senal();
      case 'down': return this.caidos();
      default: return this.onus();
    }
  });

  sort = new TableSort<OnuRow>({
    cliente: (o) => this.clientOnly(o.clientName),
    contrato: (o) => { const n = parseInt(this.contrato(o.clientName), 10); return isNaN(n) ? -1 : n; },
    onu: (o) => o.shelf * 1e9 + o.slot * 1e6 + o.port * 1e3 + o.onuId,
    rx: (o) => o.onuRxDbm,
    estado: (o) => o.phaseState,
    motivo: (o) => (({ los: 0, off: 1, noresp: 2 } as any)[this.downKind(o)]),
    desde: (o) => o.lastSeenAt,
    actualizado: (o) => o.updatedAt,
  }, 'onu');

  rows = computed(() => this.sort.apply(this.current()));

  constructor() {
    // Carga umbrales e intervalos configurables (Configuración → Salud GPON).
    this.api.settings().subscribe((s: any[]) => {
      const m: Record<string, string> = {};
      s.forEach((x) => (m[x.settingKey] = String(x.settingValue)));
      const num = (k: string, d: number) => { const v = parseFloat(m[k]); return isNaN(v) ? d : v; };
      this.warnT.set(num('gpon_rx_warn', -25));
      this.weakT.set(num('gpon_rx_weak', -26.5));
      this.critT.set(num('gpon_rx_crit', -28));
      this.rotateSecs.set(num('gpon_rotate_seconds', 15));
      this.refreshSecs.set(num('gpon_refresh_seconds', 20));
      this.rotateLeft.set(this.rotateSecs());
      this.countdown.set(this.refreshSecs());
    });
    this.showBack.set(this.route.snapshot.queryParamMap.get('back') === '1');
    this.api.zteOlts().subscribe((o) => {
      this.olts.set(o);
      // Si venís de un drill (?olt=id), abrí esa OLT y pausá la rotación para que se quede ahí.
      const wanted = +(this.route.snapshot.queryParamMap.get('olt') || 0);
      const target = o.find((x) => x.id === wanted);
      if (target) { this.selectOlt(target.id); this.rotate.set(false); }
      else if (o.length) this.selectOlt(o[0].id);
      this.refreshBadges();
    });
    this.clock.set(this.fullNow());
    this.timer = setInterval(() => {
      this.clock.set(this.fullNow());
      const c = this.countdown() - 1;
      if (c <= 0) { this.loadOnus(); this.countdown.set(this.refreshSecs()); } else this.countdown.set(c);
      // Rotación automática de OLTs (pausa si hay un log abierto o el usuario la fijó).
      if (this.rotate() && !this.evt() && this.olts().length > 1) {
        const r = this.rotateLeft() - 1;
        if (r <= 0) { this.nextOlt(); this.rotateLeft.set(this.rotateSecs()); } else this.rotateLeft.set(r);
      }
    }, 1000);
    this.badgeTimer = setInterval(() => this.refreshBadges(), 60000);
    document.addEventListener('fullscreenchange', this.fsHandler);
  }

  selectOlt(id: number) { this.oltId.set(id); this.countdown.set(this.refreshSecs()); this.rotateLeft.set(this.rotateSecs()); this.loadOnus(); }

  /** Activa/pausa la rotación automática de OLTs. */
  toggleRotate() { this.rotate.set(!this.rotate()); this.rotateLeft.set(this.rotateSecs()); }

  /** Salta a la siguiente OLT (rotación tipo dashboard). */
  private nextOlt() {
    const list = this.olts();
    if (list.length < 2) return;
    const i = list.findIndex((o) => o.id === this.oltId());
    const next = list[(i + 1) % list.length];
    this.oltId.set(next.id);
    this.countdown.set(this.refreshSecs());
    this.loadOnus();
  }

  /** Abre el log de eventos/cambios de estado del cliente en ventana emergente. */
  openLog(o: OnuRow) {
    this.evt.set(o);
    this.evtAlerts.set([]);
    this.api.zteOnuAlerts(o.rawIndex).subscribe((a) => this.evtAlerts.set(a));
  }
  closeLog() { this.evt.set(null); }

  /** Etiqueta legible de la causa de caída. */
  causeTag(c: string): string {
    if (!c) return 'CAÍDA';
    const u = c.toUpperCase();
    if (u.includes('LOS')) return 'LOS';
    if (u.includes('DYING')) return 'SIN ENERGÍA';
    return u;
  }
  /** Fecha-hora actual dd/MM/aaaa HH:mm:ss. */
  fullNow(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  fmtTs(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  private loadOnus() {
    const id = this.oltId();
    if (!id) return;
    this.api.zteOnusOfOlt(id).subscribe((r) => {
      this.onus.set(r);
      this.badges.update((b) => ({ ...b, [id]: this.problemCount(r) }));
    });
  }

  badge(id: number): number { return this.badges()[id] || 0; }
  private problemCount(list: OnuRow[]): number {
    const s = list.filter((o) => o.onuRxDbm != null && o.onuRxDbm <= this.warnT()).length;
    const d = list.filter((o) => (o.phaseState || '').toLowerCase() !== 'working').length;
    return s + d;
  }
  private refreshBadges() {
    for (const o of this.olts()) {
      if (o.id === this.oltId()) continue;
      this.api.zteOnusOfOlt(o.id).subscribe((r) =>
        this.badges.update((b) => ({ ...b, [o.id]: this.problemCount(r) })));
    }
  }

  /** Pantalla completa: oculta la barra superior y ocupa todo el monitor. */
  toggleFull() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      document.body.classList.add('noc-full');
      this.full.set(true);
    } else {
      document.exitFullscreen?.();
      document.body.classList.remove('noc-full');
      this.full.set(false);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer); clearInterval(this.badgeTimer);
    document.removeEventListener('fullscreenchange', this.fsHandler);
    document.body.classList.remove('noc-full');
    if (document.fullscreenElement) document.exitFullscreen?.();
  }

  // ---- títulos de la acción ----
  selTitle(): string {
    switch (this.sel()) {
      case 'ok': return 'Clientes con servicio OK';
      case 'sig': return 'Clientes con señal en riesgo';
      case 'down': return 'Clientes sin servicio';
      default: return 'Todos los clientes de la OLT';
    }
  }
  selIcon(): string {
    switch (this.sel()) {
      case 'ok': return '✅'; case 'sig': return '⚠️'; case 'down': return '🔌'; default: return '📋';
    }
  }

  // ---- niveles de señal ----
  sev(rx: number | null): SigLevel | null {
    if (rx == null) return null;
    if (rx <= this.critT()) return 'crit';
    if (rx <= this.weakT()) return 'weak';
    if (rx <= this.warnT()) return 'warn';
    return null;
  }
  sevLabel(rx: number | null): string {
    const s = this.sev(rx);
    return s === 'crit' ? 'CRÍTICA' : s === 'weak' ? 'DÉBIL' : s === 'warn' ? 'ADVERTENCIA' : '—';
  }
  sevBg(rx: number | null): string {
    const s = this.sev(rx);
    return s === 'crit' ? 'var(--red)' : s === 'weak' ? '#ea580c' : 'var(--amber)';
  }
  rxColor(v: number | null): string {
    if (v == null) return 'var(--muted)';
    if (v <= this.critT()) return 'var(--red)';
    if (v <= this.weakT()) return '#ea580c';
    if (v <= this.warnT()) return 'var(--amber)';
    return 'var(--green)';
  }

  // ---- motivo de caída ----
  private isLos(o: OnuRow): boolean {
    return (o.phaseState || '').toUpperCase() === 'LOS' || (o.lastCause || '').toUpperCase().includes('LOS');
  }
  downKind(o: OnuRow): DownKind {
    if (this.isLos(o)) return 'los';
    if ((o.phaseState || '').toLowerCase() !== 'working') return 'off';
    return 'noresp';
  }
  downLabel(o: OnuRow): string {
    const k = this.downKind(o);
    return k === 'los' ? 'FIBRA CORTADA' : k === 'off' ? 'APAGADA' : 'SIN RESPUESTA';
  }
  downBg(o: OnuRow): string {
    const k = this.downKind(o);
    return k === 'los' ? 'var(--red)' : k === 'off' ? '#64748b' : 'var(--amber)';
  }
  downSince(o: OnuRow): string {
    const ts = o.lastSeenAt;
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  stateBadge(o: OnuRow): string {
    const p = (o.phaseState || '').toLowerCase();
    if (p === 'working') return '<span class="badge b-up">ONLINE</span>';
    if (p === 'los') return '<span class="badge b-down">LOS</span>';
    return '<span class="badge b-maint">OFFLINE</span>';
  }

  contrato(name: string | null): string {
    if (!name) return '';
    const m = name.match(/^\s*(\d+)\s*[-_]/);
    return m ? m[1] : '';
  }
  clientOnly(name: string | null): string {
    if (!name) return '(sin nombre)';
    let n = name.trim();
    n = n.replace(/^\s*\d+\s*[-_]+\s*/, '');
    n = n.replace(/[-_]+\s*\d{1,3}(\.\d{1,3}){3}\s*$/, '');
    n = n.replace(/[-_\s]+$/, '').trim();
    return n || name;
  }
}
