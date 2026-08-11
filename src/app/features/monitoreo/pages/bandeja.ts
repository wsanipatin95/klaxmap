import { Component, EventEmitter, inject, Output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';
import { SessionStore } from '../../seg/store/session.store';

/**
 * Bandeja (cola del agente), acotada por ÁREA. Barra limpia + estados en píldoras + cola tipo
 * bandeja de correo. Al hacer clic en un ticket, emite `abrir` (el padre abre la ficha).
 */
@Component({
  selector: 'app-bandeja',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bnj">
      <div class="bar">
        <div class="ttl"><div class="h">Bandeja</div><div class="s">Atención de tickets</div></div>
        <div class="sp"></div>
        <span class="lb">Área</span>
        <select class="ip" [(ngModel)]="selArea" (ngModelChange)="onArea()">
          @for (g of grupos(); track g.id) { <option [ngValue]="g.id">{{ g.nombre }}</option> }
        </select>
        <button class="tg" [class.on]="mio" (click)="toggleMio()">👤 Míos</button>
        <input class="ip srch" [(ngModel)]="q" placeholder="🔍 Contrato, cédula, móvil…">
        <button class="tg ic" (click)="reload()" title="Actualizar">🔄</button>
      </div>

      <div class="pills">
        <div class="pill" [class.on]="selEstado===null" (click)="pick(null)"><span>Todos</span><b>{{ totalArea() }}</b></div>
        @for (t of tiles(); track t.id) {
          <div class="pill" [class.on]="selEstado===t.id" (click)="pick(t.id)">
            <span class="dt" [style.background]="t.color"></span><span>{{ t.nombre }}</span><b>{{ t.n }}</b>
          </div>
        }
      </div>

      @if (err()) { <div class="empty err">{{ err() }}</div> }

      <div class="queue">
        <div class="qhd">Cola <span class="c">{{ filtered().length }} ticket(s)</span> @if (loading()) { <span class="c">· cargando…</span> }</div>
        @for (r of filtered(); track r.id_tic_ticket) {
          <div class="qr" (click)="abrir.emit(r)">
            <div class="av" [style.background]="softColor(estadoNombre(r))" [style.color]="estadoColor(estadoNombre(r))">{{ ini(r) }}</div>
            <div class="mn">
              <div class="nm">Contrato {{ r.con }} <span class="hash">#{{ r.id_tic_ticket }}</span></div>
              <div class="mt">{{ r.requerimiento || reqNombre(r) }} · CI {{ r.dni }} · {{ r.movil }}</div>
            </div>
            <div class="rt">
              <span class="bdg" [style.background]="softColor(estadoNombre(r))" [style.color]="estadoColor(estadoNombre(r))">
                <span class="dt" [style.background]="estadoColor(estadoNombre(r))"></span>{{ estadoNombre(r) }}
              </span>
              @if (flag(r)) { <div class="fl">{{ flag(r) }}</div> }
            </div>
          </div>
        } @empty { <div class="empty">Nada en esta cola. 🎉</div> }
      </div>
    </div>
  `,
  styles: [`
    .bnj { --bd:#ece8f1; --mu:#7a7391; }
    .bar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
    .ttl .h { font-size:18px; font-weight:800; letter-spacing:-.3px; line-height:1.1; }
    .ttl .s { font-size:12px; color:var(--mu); }
    .sp { flex:1; }
    .lb { font-size:12px; color:var(--mu); font-weight:600; }
    .ip { height:38px; border:1px solid var(--bd); border-radius:10px; background:#fff; padding:0 12px; font-size:13.5px; outline:none; color:#1a1526; }
    .ip.srch { width:220px; }
    select.ip { font-weight:600; min-width:150px; }
    .tg { height:38px; border:1px solid var(--bd); border-radius:10px; background:#fff; padding:0 14px; font-weight:600; cursor:pointer; font-size:13.5px; }
    .tg.ic { padding:0 12px; }
    .tg.on { background:#7c0061; color:#fff; border-color:#7c0061; }
    .pills { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
    .pill { display:inline-flex; align-items:center; gap:8px; height:34px; padding:0 13px; border-radius:999px; background:#fff; border:1px solid var(--bd); cursor:pointer; font-weight:600; font-size:13px; color:var(--mu); }
    .pill.on { border-color:#7c0061; color:#7c0061; background:#faf3f8; }
    .pill b { color:#1a1526; font-weight:800; }
    .pill .dt, .qr .dt, .bdg .dt { width:8px; height:8px; border-radius:50%; display:inline-block; }
    .queue { background:#fff; border:1px solid var(--bd); border-radius:16px; box-shadow:0 1px 2px rgba(26,21,38,.04),0 6px 24px rgba(26,21,38,.05); overflow:hidden; }
    .qhd { padding:12px 16px; border-bottom:1px solid var(--bd); font-weight:700; font-size:13.5px; }
    .qhd .c { color:var(--mu); font-weight:600; font-size:12.5px; margin-left:6px; }
    .qr { display:flex; gap:12px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--bd); cursor:pointer; }
    .qr:last-child { border-bottom:none; }
    .qr:hover { background:#faf8fc; }
    .av { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12.5px; flex:0 0 38px; }
    .mn { flex:1; min-width:0; }
    .nm { font-weight:700; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nm .hash { color:var(--mu); font-weight:600; font-size:12px; }
    .mt { color:var(--mu); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .rt { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
    .bdg { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px; white-space:nowrap; }
    .fl { font-size:13px; }
    .empty { padding:26px; text-align:center; color:var(--mu); background:#fff; border:1px solid var(--bd); border-radius:16px; }
    .empty.err { color:#e11d48; }
  `],
})
export class Bandeja implements OnInit {
  private api = inject(NocApi);
  private session = inject(SessionStore);
  @Output() abrir = new EventEmitter<any>();

  rows = signal<any[]>([]);
  resumen = signal<any[]>([]);
  grupos = signal<{ id: any; nombre: string }[]>([]);
  estados = signal<{ id: any; nombre: string }[]>([]);
  loading = signal(false);
  err = signal('');

  selArea: number | null = null;
  selEstado: number | null = null;
  mio = false;
  q = '';

  private estMap = new Map<string, string>();
  private grpMap = new Map<string, string>();
  private reqMap = new Map<string, string>();

  ngOnInit() { this.loadCatalogos(); }

  private get userId(): number | null { return this.session.user()?.id ?? null; }

  loadCatalogos() {
    this.api.supInboxCatalogos().subscribe({
      next: (c: any) => {
        this.estados.set(this.mapCat(c?.estados, ['id_tic_estado', 'id'], ['estado', 'nombre', 'descripcion', 'detalle'], this.estMap));
        const gr = this.mapCat(c?.grupos, ['id_tic_grupo', 'id'], ['grupo', 'nombre', 'descripcion', 'area'], this.grpMap);
        this.grupos.set(gr);
        this.mapCat(c?.requerimientos, ['id_tic_requer', 'id'], ['requerimiento', 'requer', 'nombre', 'descripcion'], this.reqMap);
        if (this.selArea == null && gr.length) this.selArea = Number(gr[0].id);
        this.reload();
      },
      error: (e: any) => this.err.set(e?.error?.mensaje || 'No se pudieron leer los catálogos (¿sesión iniciada?).'),
    });
  }

  reload() { this.loadResumen(); this.load(); }
  onArea() { this.selEstado = null; this.reload(); }
  pick(estadoId: number | null) { this.selEstado = estadoId; this.load(); }
  toggleMio() { this.mio = !this.mio; this.load(); }

  loadResumen() { this.api.supInboxResumen(this.selArea).subscribe({ next: (r: any[]) => this.resumen.set(r || []), error: () => this.resumen.set([]) }); }

  load() {
    this.err.set(''); this.loading.set(true);
    const mioId = this.mio ? this.userId : null;
    this.api.supInbox(this.selEstado, this.selArea, mioId, 200).subscribe({
      next: (rs: any[]) => { this.rows.set(rs || []); this.loading.set(false); },
      error: (e: any) => { this.err.set(e?.error?.mensaje || 'No se pudo leer la cola.'); this.loading.set(false); },
    });
  }

  totalArea(): number { return this.resumen().reduce((a, r) => a + Number(r.n || 0), 0); }

  tiles(): { id: any; nombre: string; n: number; color: string }[] {
    return this.resumen()
      .map((r) => { const id = r.estado; const nombre = this.estMap.get(String(id)) || ('estado ' + id); return { id, nombre, n: Number(r.n || 0), color: this.estadoColor(nombre) }; })
      .sort((a, b) => this.rank(a.nombre) - this.rank(b.nombre) || b.n - a.n);
  }

  private rank(n: string): number {
    const u = (n || '').toUpperCase();
    if (u.includes('SIN LEER')) return 0;
    if (u.includes('CONTACT')) return 1;
    if (u.includes('ESCAL')) return 2;
    if (u.includes('ORDEN')) return 3;
    if (u.includes('EJECUC') || u.includes('ENRUT')) return 4;
    if (u.includes('TERMIN')) return 5;
    return 7;
  }

  estadoColor(n: string): string {
    const u = (n || '').toUpperCase();
    if (u.includes('SIN LEER')) return '#e11d48';
    if (u.includes('CONTACT')) return '#b45309';
    if (u.includes('ESCAL')) return '#be185d';
    if (u.includes('ORDEN') || u.includes('ENRUT') || u.includes('EJECUC')) return '#15803d';
    if (u.includes('TERMIN')) return '#0f766e';
    return '#64748b';
  }
  softColor(n: string): string {
    const u = (n || '').toUpperCase();
    if (u.includes('SIN LEER')) return '#fee2e2';
    if (u.includes('CONTACT')) return '#fef3c7';
    if (u.includes('ESCAL')) return '#fce7f3';
    if (u.includes('ORDEN') || u.includes('ENRUT') || u.includes('EJECUC')) return '#dcfce7';
    if (u.includes('TERMIN')) return '#ccfbf1';
    return '#eef1f6';
  }
  ini(r: any): string { const c = String(r?.con ?? ''); return (c.slice(-2) || '—').padStart(2, '0'); }

  filtered(): any[] {
    const term = this.q.trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter((r) => [r.con, r.dni, r.movil, r.requerimiento].map((x) => String(x ?? '').toLowerCase()).join(' ').includes(term));
  }

  private mapCat(arr: any[], idKeys: string[], nameKeys: string[], map: Map<string, string>): { id: any; nombre: string }[] {
    const out: { id: any; nombre: string }[] = [];
    map.clear();
    for (const row of arr || []) {
      const idk = idKeys.find((k) => row[k] != null);
      const nk = nameKeys.find((k) => row[k] != null);
      if (idk == null) continue;
      const id = row[idk];
      const nombre = nk ? String(row[nk]) : String(id);
      map.set(String(id), nombre);
      out.push({ id, nombre });
    }
    out.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return out;
  }

  estadoNombre(r: any): string { return this.estMap.get(String(r.id_tic_estado_fk)) || ('estado ' + (r.id_tic_estado_fk ?? '—')); }
  reqNombre(r: any): string { return this.reqMap.get(String(r.id_tic_requer_fk ?? r.id_tic_requer)) || ''; }
  flag(r: any): string { return (String(r.adjunto) === 'true' ? '📎' : '') + (String(r.observacion) === 'true' ? '📝' : ''); }
}
