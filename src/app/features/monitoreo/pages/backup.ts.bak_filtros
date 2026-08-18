import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';
import { NocNotify } from '../services/noc-notify';

/** Respaldos de configuración de equipos (OLT ZTE por Telnet + MikroTik por SSH /export).
 *  Pestañas: Respaldos (lista auto-refrescada + backup manual) / Configuración. */
@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bkp">
      <div class="hd">
        <div class="ttl">💾 Respaldos de equipos</div>
        <div class="sub">Configuración de OLT (ZTE) y MikroTik core/borde — guardada periódicamente</div>
      </div>

      <div class="tabs">
        <button class="tab" [class.act]="tab() === 'panel'" (click)="tab.set('panel')">Respaldos</button>
        <button class="tab" [class.act]="tab() === 'config'" (click)="tab.set('config')">Configuración</button>
      </div>

      @if (tab() === 'panel') {
        <div class="kpis">
          <div class="kpi"><div class="kn">{{ backups().length }}</div><div class="kl">Copias</div></div>
          <div class="kpi ok"><div class="kn">{{ nOk() }}</div><div class="kl">OK</div></div>
          <div class="kpi err"><div class="kn">{{ nErr() }}</div><div class="kl">Con error</div></div>
          <div class="kpi"><div class="kn">{{ ultimoTxt() }}</div><div class="kl">Último respaldo</div></div>
        </div>

        <div class="card">
          <div class="ch bar">
            <span>Respaldos recientes <span class="cnt">{{ filtered().length }}</span></span>
            <input class="search" [(ngModel)]="q" placeholder="Buscar equipo, host, tipo…">
            <button class="btn go" [disabled]="corriendo()" (click)="backupAhora()">
              {{ corriendo() ? 'Respaldando…' : '⟳ Backup ahora' }}
            </button>
            <span class="live" title="La lista se actualiza sola cada 10 s">● En vivo</span>
          </div>

          @if (filtered().length) {
            <div class="tw">
              <table>
                <thead><tr>
                  <th>Estado</th><th>Equipo</th><th>Tipo</th><th>Host</th>
                  <th>Fecha</th><th>Tamaño</th><th>Líneas</th><th>Por</th><th>Réplica</th><th></th>
                </tr></thead>
                <tbody>
                  @for (b of filtered(); track b.id) {
                    <tr>
                      <td>
                        @if (b.status === 'ok') { <span class="tag ok">OK</span> }
                        @else { <span class="tag err" [title]="b.error">error</span> }
                      </td>
                      <td><b>{{ b.deviceRef }}</b></td>
                      <td><span class="kind" [class.mk]="b.deviceKind === 'mikrotik'">{{ b.deviceKind === 'mikrotik' ? 'MikroTik' : 'OLT' }}</span></td>
                      <td class="mono">{{ b.host || '—' }}</td>
                      <td>{{ rel(b.createdAt) }} <span class="mut">· {{ abs(b.createdAt) }}</span></td>
                      <td>{{ b.status === 'ok' ? fmtBytes(b.bytes) : '—' }}</td>
                      <td>{{ b.status === 'ok' ? b.lines : '—' }}</td>
                      <td class="mut">{{ b.createdBy }}</td>
                      <td>
                        @if (b.replica) { <span class="rep" [class.bad]="(b.replica || '').includes('err')">{{ b.replica }}</span> }
                        @else { <span class="mut">—</span> }
                      </td>
                      <td class="act">
                        @if (b.status === 'ok') {
                          <button class="mini" (click)="ver(b)">Ver</button>
                          <button class="mini" (click)="descargar(b)">Descargar</button>
                        } @else {
                          <span class="mut" [title]="b.error">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="empty">Todavía no hay respaldos. Tocá “Backup ahora” o esperá el próximo ciclo automático.</div>
          }
        </div>
      }

      @if (tab() === 'config') {
        <div class="card cfg">
          <div class="ch">Configuración del respaldo</div>
          <div class="grid">
            <label class="fld chk">
              <input type="checkbox" [(ngModel)]="cfg.cfgbkp_enabled"> Respaldo automático activo
            </label>
            <div class="fld">
              <span>Frecuencia</span>
              <button type="button" class="pick" (click)="freqOpen.set(true)">{{ freqLabel() }} <i>▾</i></button>
              <small>Cada cuánto corre el respaldo automático.</small>
            </div>
            <div class="fld">
              <span>Copias a conservar por equipo</span>
              <button type="button" class="pick" (click)="keepOpen.set(true)">{{ cfg.cfgbkp_keep }} copias <i>▾</i></button>
              <small>Las más viejas se borran solas.</small>
            </div>
            <label class="fld">
              <span>Carpeta destino (en el servidor)</span>
              <input [(ngModel)]="cfg.cfgbkp_dir" placeholder="backups/config">
            </label>
            <div class="sep">Destino externo 1 (SFTP — ej. la nube)</div>
            <label class="fld chk"><input type="checkbox" [(ngModel)]="cfg.cfgbkp_r1_enabled"> Réplica 1 activa</label>
            <label class="fld"><span>Nombre</span><input [(ngModel)]="cfg.cfgbkp_r1_label" placeholder="Nube"></label>
            <label class="fld"><span>Host</span><input [(ngModel)]="cfg.cfgbkp_r1_host" placeholder="respaldos.midominio.com"></label>
            <label class="fld"><span>Puerto</span><input type="number" min="1" [(ngModel)]="cfg.cfgbkp_r1_port"></label>
            <label class="fld"><span>Usuario</span><input [(ngModel)]="cfg.cfgbkp_r1_user" placeholder="backup"></label>
            <label class="fld"><span>Clave</span><input type="password" [(ngModel)]="r1Pass" [placeholder]="cfg.cfgbkp_r1_pass_set ? '•••••• (guardada)' : 'sin configurar'"></label>
            <label class="fld"><span>Carpeta destino</span><input [(ngModel)]="cfg.cfgbkp_r1_dir" placeholder="noc-backups"></label>

            <div class="sep">Destino externo 2 (SFTP — ej. otro nodo tuyo)</div>
            <label class="fld chk"><input type="checkbox" [(ngModel)]="cfg.cfgbkp_r2_enabled"> Réplica 2 activa</label>
            <label class="fld"><span>Nombre</span><input [(ngModel)]="cfg.cfgbkp_r2_label" placeholder="Nodo local"></label>
            <label class="fld"><span>Host</span><input [(ngModel)]="cfg.cfgbkp_r2_host" placeholder="192.168.50.10"></label>
            <label class="fld"><span>Puerto</span><input type="number" min="1" [(ngModel)]="cfg.cfgbkp_r2_port"></label>
            <label class="fld"><span>Usuario</span><input [(ngModel)]="cfg.cfgbkp_r2_user" placeholder="backup"></label>
            <label class="fld"><span>Clave</span><input type="password" [(ngModel)]="r2Pass" [placeholder]="cfg.cfgbkp_r2_pass_set ? '•••••• (guardada)' : 'sin configurar'"></label>
            <label class="fld"><span>Carpeta destino</span><input [(ngModel)]="cfg.cfgbkp_r2_dir" placeholder="noc-backups"></label>
          </div>
          <div class="cfgbtns">
            <button class="btn go" [disabled]="guardando()" (click)="guardar()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
            <span class="hint">Las credenciales de cada equipo (SSH del MikroTik, Telnet de la OLT) se configuran en el módulo Equipos, no acá.</span>
          </div>
        </div>
      }
    </div>

    @if (freqOpen()) {
      <div class="bkov" (click)="freqOpen.set(false)">
        <div class="bkmd sm" (click)="$event.stopPropagation()">
          <div class="mh"><b>Frecuencia del respaldo</b><button class="x" (click)="freqOpen.set(false)">✕</button></div>
          <div class="opts">
            @for (o of freqOpts; track o.cron) {
              <button class="opt" [class.sel]="cfg.cfgbkp_cron === o.cron" (click)="setFreq(o.cron)">{{ o.label }}<span class="mono">{{ o.cron }}</span></button>
            }
          </div>
        </div>
      </div>
    }

    @if (keepOpen()) {
      <div class="bkov" (click)="keepOpen.set(false)">
        <div class="bkmd sm" (click)="$event.stopPropagation()">
          <div class="mh"><b>Copias a conservar por equipo</b><button class="x" (click)="keepOpen.set(false)">✕</button></div>
          <div class="opts">
            @for (n of keepOpts; track n) {
              <button class="opt" [class.sel]="cfg.cfgbkp_keep == n" (click)="setKeep(n)">{{ n }} copias</button>
            }
          </div>
        </div>
      </div>
    }

    @if (verOpen()) {
      <div class="bkov" (click)="verOpen.set(false)">
        <div class="bkmd" (click)="$event.stopPropagation()">
          <div class="mh">
            <b>{{ verRef() }}</b> <span class="mut">{{ verName() }}</span>
            <button class="x" (click)="verOpen.set(false)">✕</button>
          </div>
          <pre class="cfgtxt">{{ verTxt() }}</pre>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; --pri:#7c0061; --ink:#1a1526; --mut:#8a8296; --line:#ece8f1; }
    .bkp { max-width:1240px; margin:0 auto; padding:14px 18px 60px; color:var(--ink); }
    .hd { margin-bottom:12px; }
    .ttl { font-weight:800; font-size:19px; display:flex; align-items:center; gap:8px; }
    .sub { color:var(--mut); font-size:13px; margin-top:2px; }
    .tabs { display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:16px; }
    .tab { border:none; background:transparent; padding:10px 16px; font-size:13.5px; font-weight:700; color:var(--mut); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
    .tab:hover { color:var(--ink); }
    .tab.act { color:var(--pri); border-bottom-color:var(--pri); }
    .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
    @media(max-width:720px){ .kpis { grid-template-columns:repeat(2,1fr); } }
    .kpi { background:#fff; border:1px solid var(--line); border-radius:14px; padding:12px 16px; box-shadow:0 1px 2px rgba(26,21,38,.04); }
    .kpi .kn { font-size:22px; font-weight:800; line-height:1; }
    .kpi .kl { font-size:12px; color:var(--mut); font-weight:600; margin-top:5px; }
    .kpi.ok .kn { color:#16a34a; }
    .kpi.err .kn { color:#dc2626; }
    .card { background:#fff; border:1px solid var(--line); border-radius:16px; box-shadow:0 1px 2px rgba(26,21,38,.04),0 6px 24px rgba(26,21,38,.05); overflow:hidden; margin-bottom:14px; }
    .ch { font-weight:700; font-size:13.5px; padding:13px 16px; border-bottom:1px solid var(--line); background:#faf9fc; }
    .ch.bar { display:flex; align-items:center; gap:12px; }
    .ch.bar > span:first-child { margin-right:auto; }
    .cnt { font-size:11px; font-weight:700; color:var(--pri); background:#f3eef7; padding:2px 8px; border-radius:999px; margin-left:6px; }
    .search { height:32px; border:1px solid var(--line); border-radius:9px; padding:0 11px; font-size:12.5px; width:240px; max-width:42vw; outline:none; font-family:inherit; }
    .search:focus { border-color:var(--pri); }
    .live { font-size:11.5px; font-weight:700; color:#16a34a; display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }
    .btn { height:34px; border:1px solid var(--line); background:#fff; border-radius:9px; padding:0 14px; font-weight:600; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; color:var(--ink); white-space:nowrap; }
    .btn:hover { background:#faf8fc; }
    .btn.go { background:var(--pri); color:#fff; border-color:var(--pri); }
    .btn.go:hover { filter:brightness(1.06); background:var(--pri); }
    .btn:disabled { opacity:.6; cursor:default; }
    .tw { overflow:auto; }
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    thead th { text-align:left; color:var(--mut); font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.3px; padding:9px 10px; border-bottom:1px solid var(--line); white-space:nowrap; background:#fbfafc; }
    tbody td { padding:9px 10px; border-bottom:1px solid #f4f1f7; vertical-align:middle; white-space:nowrap; }
    tbody tr:hover { background:#f9f6fc; }
    .mono { font-family:'Consolas','SFMono-Regular',monospace; }
    .mut { color:var(--mut); }
    .tag { display:inline-block; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:6px; }
    .tag.ok { background:#eafaf0; color:#16794a; }
    .tag.err { background:#fdecec; color:#b42318; cursor:help; }
    .kind { display:inline-block; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:6px; background:#f1f0f3; color:#6b6577; }
    .kind.mk { background:#eef2ff; color:#4338ca; }
    .rep { display:inline-block; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:6px; background:#eafaf0; color:#16794a; }
    .rep.bad { background:#fff4e5; color:#b45309; }
    .act { display:flex; gap:6px; }
    .mini { height:27px; padding:0 10px; border-radius:7px; border:1px solid var(--line); background:#fff; color:var(--ink); cursor:pointer; font-size:12px; font-weight:600; }
    .mini:hover { background:#f6f2f9; border-color:var(--pri); color:var(--pri); }
    .empty { padding:26px 16px; text-align:center; color:var(--mut); font-size:13px; }
    .cfg .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px 18px; padding:16px; }
    @media(max-width:720px){ .cfg .grid { grid-template-columns:1fr; } }
    .fld { display:flex; flex-direction:column; gap:5px; font-size:13px; }
    .fld > span { color:var(--mut); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; }
    .fld input { height:36px; border:1px solid var(--line); border-radius:9px; padding:0 11px; font-size:13px; font-family:inherit; outline:none; background:#fff; color:var(--ink); }
    .fld input:focus { border-color:var(--pri); }
    .fld small { color:var(--mut); font-size:11px; }
    .fld.chk { flex-direction:row; align-items:center; gap:8px; grid-column:1 / -1; font-weight:600; }
    .sep { grid-column:1 / -1; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.4px; color:var(--mut); border-top:1px solid var(--line); padding-top:12px; }
    .cfgbtns { display:flex; align-items:center; gap:12px; padding:0 16px 16px; }
    .hint { color:var(--mut); font-size:12px; }
    .bkov { position:fixed; inset:0; background:rgba(26,21,38,.42); backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; z-index:100050; padding:20px; }
    .bkmd { background:#fff; border:1px solid var(--line); border-radius:16px; width:min(880px,94vw); max-height:86vh; display:flex; flex-direction:column; box-shadow:0 24px 70px rgba(26,21,38,.3); z-index:100051; overflow:hidden; }
    .mh { display:flex; align-items:center; gap:8px; padding:14px 16px; border-bottom:1px solid var(--line); }
    .mh b { font-size:14px; }
    .mh .x { margin-left:auto; background:transparent; border:none; color:var(--mut); font-size:16px; cursor:pointer; width:30px; height:30px; border-radius:8px; }
    .mh .x:hover { background:#f4f1f7; color:var(--ink); }
    .pick { height:36px; border:1px solid var(--line); border-radius:9px; padding:0 11px; background:#fff; color:var(--ink); text-align:left; cursor:pointer; display:flex; align-items:center; justify-content:space-between; font-size:13px; font-family:inherit; }
    .pick:hover { border-color:var(--pri); }
    .pick i { color:var(--mut); font-style:normal; margin-left:8px; }
    .bkmd.sm { width:min(440px,94vw); }
    .opts { padding:10px; display:flex; flex-direction:column; gap:6px; }
    .opt { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 13px; border:1px solid var(--line); border-radius:9px; background:#fff; cursor:pointer; font-size:13px; font-weight:600; color:var(--ink); text-align:left; }
    .opt:hover { background:#f6f2f9; border-color:var(--pri); }
    .opt.sel { border-color:var(--pri); background:#f3eef7; color:var(--pri); }
    .opt .mono { font-weight:500; color:var(--mut); font-size:11px; }
    .cfgtxt { margin:0; padding:14px 16px; overflow:auto; font-family:'Consolas','SFMono-Regular',monospace; font-size:12px; line-height:1.5; white-space:pre; color:var(--ink); background:#fbfafc; }
  `],
})
export class Backup implements OnInit, OnDestroy {
  private api = inject(NocApi);
  private notify = inject(NocNotify);

  tab = signal<'panel' | 'config'>('panel');
  backups = signal<any[]>([]);
  cfg: any = { cfgbkp_enabled: true, cfgbkp_cron: '0 0 */12 * * *', cfgbkp_keep: 60, cfgbkp_dir: 'backups/config',
    cfgbkp_r1_enabled: false, cfgbkp_r1_label: 'Nube', cfgbkp_r1_host: '', cfgbkp_r1_port: 22, cfgbkp_r1_user: '', cfgbkp_r1_dir: 'noc-backups', cfgbkp_r1_pass_set: false,
    cfgbkp_r2_enabled: false, cfgbkp_r2_label: 'Nodo local', cfgbkp_r2_host: '', cfgbkp_r2_port: 22, cfgbkp_r2_user: '', cfgbkp_r2_dir: 'noc-backups', cfgbkp_r2_pass_set: false };
  r1Pass = '';
  r2Pass = '';
  q = '';
  corriendo = signal(false);
  guardando = signal(false);
  private timer: any = null;

  // modal ver
  verOpen = signal(false);
  verTxt = signal('');
  verRef = signal('');
  verName = signal('');

  // pickers de agenda (sin escritura libre)
  freqOpen = signal(false);
  keepOpen = signal(false);
  freqOpts = [
    { label: 'Cada 6 horas', cron: '0 0 */6 * * *' },
    { label: 'Cada 12 horas', cron: '0 0 */12 * * *' },
    { label: 'Cada día (3 AM)', cron: '0 0 3 * * *' },
    { label: 'Cada 2 días (3 AM)', cron: '0 0 3 */2 * *' },
    { label: 'Semanal (domingo 3 AM)', cron: '0 0 3 * * 0' },
  ];
  keepOpts = [15, 30, 60, 90, 120, 180];
  freqLabel(): string {
    const o = this.freqOpts.find((x) => x.cron === this.cfg.cfgbkp_cron);
    return o ? o.label : (this.cfg.cfgbkp_cron || 'Sin definir');
  }
  setFreq(cron: string) { this.cfg.cfgbkp_cron = cron; this.freqOpen.set(false); }
  setKeep(n: number) { this.cfg.cfgbkp_keep = n; this.keepOpen.set(false); }

  ngOnInit() { this.load(); this.timer = setInterval(() => this.reloadList(), 10000); }
  ngOnDestroy() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  private load() {
    this.api.backupState().subscribe({
      next: (r: any) => { this.backups.set(r?.backups || []); if (r?.cfg) this.cfg = { ...this.cfg, ...r.cfg }; },
      error: () => {},
    });
  }
  private reloadList() {
    this.api.backupState().subscribe({ next: (r: any) => this.backups.set(r?.backups || []), error: () => {} });
  }

  nOk = computed(() => this.backups().filter((b) => b.status === 'ok').length);
  nErr = computed(() => this.backups().filter((b) => b.status === 'error').length);
  ultimoTxt = computed(() => {
    const b = this.backups()[0];
    return b ? this.rel(b.createdAt) : '—';
  });

  filtered() {
    const q = this.q.trim().toLowerCase();
    const arr = this.backups();
    if (!q) return arr;
    return arr.filter((b) =>
      (b.deviceRef || '').toLowerCase().includes(q) ||
      (b.host || '').toLowerCase().includes(q) ||
      (b.deviceKind || '').toLowerCase().includes(q));
  }

  backupAhora() {
    this.corriendo.set(true);
    this.api.backupRun().subscribe({
      next: (r: any) => {
        this.corriendo.set(false);
        this.notify.ok('Respaldo: ' + (r?.ok ?? 0) + ' OK, ' + (r?.error ?? 0) + ' con error');
        this.reloadList();
      },
      error: (e) => { this.corriendo.set(false); this.notify.error(e?.message || 'No se pudo respaldar'); },
    });
  }

  guardar() {
    this.guardando.set(true);
    const body: any = {
      cfgbkp_enabled: this.cfg.cfgbkp_enabled,
      cfgbkp_cron: this.cfg.cfgbkp_cron,
      cfgbkp_keep: this.cfg.cfgbkp_keep,
      cfgbkp_dir: this.cfg.cfgbkp_dir,
    };
    for (const slot of ['r1', 'r2']) {
      body['cfgbkp_' + slot + '_enabled'] = this.cfg['cfgbkp_' + slot + '_enabled'];
      body['cfgbkp_' + slot + '_label'] = this.cfg['cfgbkp_' + slot + '_label'];
      body['cfgbkp_' + slot + '_host'] = this.cfg['cfgbkp_' + slot + '_host'];
      body['cfgbkp_' + slot + '_port'] = this.cfg['cfgbkp_' + slot + '_port'];
      body['cfgbkp_' + slot + '_user'] = this.cfg['cfgbkp_' + slot + '_user'];
      body['cfgbkp_' + slot + '_dir'] = this.cfg['cfgbkp_' + slot + '_dir'];
    }
    if (this.r1Pass && this.r1Pass.trim()) body.cfgbkp_r1_pass = this.r1Pass.trim();
    if (this.r2Pass && this.r2Pass.trim()) body.cfgbkp_r2_pass = this.r2Pass.trim();
    this.api.backupSaveCfg(body).subscribe({
      next: (r: any) => { this.guardando.set(false); this.r1Pass = ''; this.r2Pass = ''; if (r) this.cfg = { ...this.cfg, ...r }; this.notify.ok('Configuración guardada'); },
      error: (e) => { this.guardando.set(false); this.notify.error(e?.message || 'No se pudo guardar'); },
    });
  }

  ver(b: any) {
    this.api.backupVer(b.id).subscribe({
      next: (r: any) => { this.verRef.set(r?.ref || b.deviceRef); this.verName.set(r?.filename || ''); this.verTxt.set(r?.content || ''); this.verOpen.set(true); },
      error: (e) => this.notify.error(e?.message || 'No se pudo abrir'),
    });
  }

  descargar(b: any) {
    this.api.backupDownload(b.id).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = b.filename || ('backup-' + b.id + '.txt');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      },
      error: (e) => this.notify.error(e?.message || 'No se pudo descargar'),
    });
  }

  fmtBytes(n: number) {
    if (n == null) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  rel(iso: string) {
    if (!iso) return '—';
    const t = new Date(iso).getTime(); if (isNaN(t)) return '—';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'hace ' + s + 's';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + 'm';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + 'h';
    return 'hace ' + Math.floor(s / 86400) + 'd';
  }
  abs(iso: string) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  }
}
