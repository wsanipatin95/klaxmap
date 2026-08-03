import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

interface Listing { cat: string; sev: 'crit' | 'spam' | 'info'; label: string; meaning: string; }

/**
 * SEGURIDAD · Paso 1 — Reputación de IPs en listas negras (RBL/DNSBL).
 * Pura consulta a listas externas: no se envía ningún paquete al cliente.
 * Interpreta los códigos DNSBL para mostrar la GRAVEDAD real:
 *   · XBL/CBL  → equipo infectado / botnet   (crítico, rojo)
 *   · SBL/spam → fuente de spam              (advertencia, naranja)
 *   · PBL      → espacio de usuario final    (normal, azul — no es infección)
 */
@Component({
  selector: 'app-seguridad',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tools">
      <span style="font-weight:700;font-size:16px">🛡️ Seguridad · Reputación IP</span>
      <span style="margin-left:auto;font-size:12px;color:var(--muted)">Actualizado {{ clock() }}</span>
    </div>

    <div class="panel"><div class="pb" style="display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:18px">🔒</span>
      <div style="font-size:12.5px;color:var(--muted)">
        <b style="color:var(--text,#222)">Pura consulta, sin tocar al cliente.</b>
        Se le pregunta a las listas negras públicas si la IP está marcada. <u>No se envía ningún paquete al equipo del cliente.</u>
      </div>
    </div></div>

    <!-- Consulta instantánea -->
    <div class="panel">
      <div class="ph">🔎 Consultar una IP</div>
      <div class="pb">
        <div style="display:flex;gap:10px">
          <input class="inp" style="flex:1;max-width:280px" placeholder="Ej. 186.209.212.5"
                 [(ngModel)]="ip" (keyup.enter)="check()">
          <button class="btn" (click)="check()" [disabled]="checking()">{{ checking() ? 'Consultando…' : 'Consultar' }}</button>
        </div>
        @if (result(); as r) {
          @if (r.ok === false) {
            <div style="margin-top:12px;color:var(--red)">⚠ {{ r.error }}</div>
          } @else if (r.listed) {
            <div style="margin-top:12px;padding:12px;border-radius:10px"
                 [style.background]="sevBg(resSev())" [style.border]="'1px solid ' + sevBorder(resSev())">
              <b [style.color]="sevColor(resSev())">{{ sevIcon(resSev()) }} {{ r.ip }} — {{ sevHead(resSev()) }}</b>
              <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
                @for (l of resListings(); track l.label) {
                  <span class="badge" [style.background]="sevBg(l.sev)" [style.color]="sevColor(l.sev)"
                        [style.border]="'1px solid ' + sevBorder(l.sev)" [title]="l.meaning">{{ l.label }}</span>
                }
              </div>
              <div style="margin-top:8px;font-size:12px;color:var(--muted)">{{ resListings()[0]?.meaning }}</div>
            </div>
          } @else {
            <div style="margin-top:12px;padding:12px;border-radius:10px;background:#e8f5e9;border:1px solid #c8e6c9">
              <b style="color:var(--green)">✓ {{ r.ip }} está limpia</b>
              <span style="font-size:12px;color:var(--muted)"> — no aparece en las listas consultadas</span>
            </div>
          }
          @if (r.warn) { <div style="margin-top:8px;font-size:12px;color:#b26a00">⚠ {{ r.warn }}</div> }
        }
      </div>
    </div>

    <!-- Resumen visual por gravedad -->
    @if (summary().total > 0) {
      <div class="panel">
        <div class="ph">📊 Resumen por gravedad</div>
        <div class="pb">
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="stat" style="border-left:4px solid #e02424">
              <div class="sv" style="color:#e02424">{{ summary().crit }}</div>
              <div class="sl">🚨 Infectadas / botnet<br><span>XBL · acción urgente</span></div>
            </div>
            <div class="stat" style="border-left:4px solid #f39c12">
              <div class="sv" style="color:#e08600">{{ summary().spam }}</div>
              <div class="sl">⚠ Reputación de spam<br><span>SBL / SpamCop / etc.</span></div>
            </div>
            <div class="stat" style="border-left:4px solid #3b82f6">
              <div class="sv" style="color:#2563eb">{{ summary().info }}</div>
              <div class="sl">ℹ Usuario final (PBL)<br><span>normal en residencial/CGNAT</span></div>
            </div>
          </div>
          <!-- barra de proporción -->
          <div style="margin-top:14px;height:14px;border-radius:8px;overflow:hidden;display:flex;background:#eee">
            @if (summary().crit) { <div [style.width.%]="prop(summary().crit)" style="background:#e02424" [title]="summary().crit + ' infectadas'"></div> }
            @if (summary().spam) { <div [style.width.%]="prop(summary().spam)" style="background:#f39c12" [title]="summary().spam + ' spam'"></div> }
            @if (summary().info) { <div [style.width.%]="prop(summary().info)" style="background:#3b82f6" [title]="summary().info + ' PBL'"></div> }
          </div>
          <div style="margin-top:8px;font-size:11.5px;color:var(--muted)">
            Lo accionable son las <b style="color:#e02424">rojas (infectadas/botnet)</b> y las <b style="color:#e08600">naranjas (spam)</b>.
            Las <b style="color:#2563eb">azules (PBL)</b> son normales: solo indican que es IP de usuario final que no debe enviar correo directo.
          </div>
        </div>
      </div>
    }

    <!-- Barrido del pool -->
    <div class="panel">
      <div class="ph">📡 Barrido del pool público
        <button class="btn sm" style="margin-left:auto" (click)="sweep()" [disabled]="running()">
          {{ running() ? 'Barriendo…' : 'Barrer pool ahora' }}
        </button>
      </div>
      <div class="pb">
        @if (st(); as s) {
          <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12.5px">
            <div><span style="color:var(--muted)">IPs marcadas ahora</span><br>
              <b style="font-size:20px" [style.color]="listedNow()>0 ? 'var(--red)' : 'var(--green)'">{{ listedNow() }}</b></div>
            <div><span style="color:var(--muted)">Revisadas</span><br>
              <b style="font-size:20px">{{ s.checked || 0 }}<span style="font-size:13px;color:var(--muted)"> / {{ s.total || 0 }}</span></b></div>
            <div><span style="color:var(--muted)">Último barrido</span><br>
              <b>{{ fmt(s.finished_at) || (running() ? 'en curso…' : '—') }}</b></div>
          </div>
          @if (running() && s.total > 0) {
            <div style="margin-top:10px;height:8px;border-radius:6px;background:#eee;overflow:hidden">
              <div style="height:100%;background:var(--primary,#4b3bff);transition:width .4s" [style.width.%]="pct(s)"></div>
            </div>
          }
          @if (s.note) { <div style="margin-top:8px;font-size:12px;color:#b26a00">⚠ {{ s.note }}</div> }
        }
        <div style="margin-top:8px;font-size:11.5px;color:var(--muted)">
          El barrido corre en segundo plano y es lento a propósito (pausa entre consultas) para no ser bloqueado por las listas.
          Programalo diario en <b>Configuración → Reputación IP</b>.
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="panel">
      <div class="ph">🧾 IPs marcadas ({{ listed().length }})</div>
      <div class="pb">
        @if (listed().length) {
          <table>
            <thead><tr><th>IP</th><th>Gravedad</th><th>Motivo</th><th>Listas</th><th>Primera vez</th><th>Última vez</th></tr></thead>
            <tbody>
              @for (r of listed(); track r.ip) {
                <tr>
                  <td class="mono"><b>{{ r.ip }}</b></td>
                  <td>
                    @if (!r.listed) { <span class="badge" style="background:#e8f5e9;color:var(--green)">✓ Limpia</span> }
                    @else { <span class="badge" [style.background]="sevBg(rowSev(r))" [style.color]="sevColor(rowSev(r))"
                                  [style.border]="'1px solid ' + sevBorder(rowSev(r))">{{ sevIcon(rowSev(r)) }} {{ sevShort(rowSev(r)) }}</span> }
                  </td>
                  <td style="font-size:12px">
                    @for (l of rowListings(r); track l.label) {
                      <span class="badge" [style.background]="sevBg(l.sev)" [style.color]="sevColor(l.sev)"
                            [title]="l.meaning" style="margin:1px">{{ l.label }}</span>
                    }
                  </td>
                  <td style="font-size:11.5px;color:var(--muted)">{{ r.zones || '—' }}</td>
                  <td style="font-size:12px;color:var(--muted)">{{ fmt(r.first_listed) || '—' }}</td>
                  <td style="font-size:12px">{{ fmt(r.last_listed) || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div style="color:var(--muted);padding:12px 0">
            Todavía no hay IPs marcadas. Corré un barrido o consultá una IP puntual arriba.
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .stat { flex:1;min-width:150px;background:#fafafa;border:1px solid #eee;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:12px }
    .stat .sv { font-size:30px;font-weight:800;line-height:1 }
    .stat .sl { font-size:12px;font-weight:600 }
    .stat .sl span { font-weight:400;color:var(--muted);font-size:11px }
  `],
})
export class Seguridad implements OnDestroy {
  private api = inject(NocApi);

  ip = '';
  checking = signal(false);
  result = signal<any>(null);

  st = signal<any>(null);
  listed = signal<any[]>([]);
  listedNow = signal(0);
  running = signal(false);
  clock = signal('');

  private timer: any;

  constructor() {
    this.load();
    this.tick();
    this.timer = setInterval(() => { this.load(); this.tick(); }, 5000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  // ---- Interpretación de códigos DNSBL ----
  decode(zone: string, code: string): Listing {
    const z = (zone || '').toLowerCase();
    const c = (code || '').trim();
    if (c.startsWith('127.255.255')) return { cat: 'ERR', sev: 'info', label: 'Consulta bloqueada', meaning: 'La lista bloqueó la consulta (resolver público o cuota). Usá el DNS propio del ISP.' };
    if (z.includes('spamhaus')) {
      if (c === '127.0.0.10' || c === '127.0.0.11')
        return { cat: 'PBL', sev: 'info', label: 'PBL', meaning: 'Espacio de usuario final: no debería enviar correo directo. Normal en IP residencial/CGNAT — no es infección.' };
      if (c === '127.0.0.4' || c === '127.0.0.5' || c === '127.0.0.6' || c === '127.0.0.7')
        return { cat: 'XBL', sev: 'crit', label: 'XBL / CBL', meaning: 'Equipo infectado enviando spam (botnet/malware). Requiere revisión del cliente.' };
      if (c === '127.0.0.9')
        return { cat: 'DROP', sev: 'crit', label: 'SBL DROP', meaning: 'Rango marcado para no rutear (DROP/EDROP).' };
      if (c === '127.0.0.2' || c === '127.0.0.3')
        return { cat: 'SBL', sev: 'spam', label: 'SBL', meaning: 'Fuente de spam identificada por Spamhaus.' };
      return { cat: 'SBL', sev: 'spam', label: 'Spamhaus', meaning: 'Listada en Spamhaus.' };
    }
    if (z.includes('spamcop')) return { cat: 'SPAM', sev: 'spam', label: 'SpamCop', meaning: 'Reportada como origen de spam (SpamCop).' };
    if (z.includes('barracuda')) return { cat: 'SPAM', sev: 'spam', label: 'Barracuda', meaning: 'Mala reputación en Barracuda.' };
    if (z.includes('sorbs')) return { cat: 'SPAM', sev: 'spam', label: 'SORBS', meaning: 'Listada en SORBS.' };
    return { cat: 'LIST', sev: 'spam', label: zone, meaning: 'Listada en ' + zone + '.' };
  }

  private worst(ls: Listing[]): 'crit' | 'spam' | 'info' {
    if (ls.some((l) => l.sev === 'crit')) return 'crit';
    if (ls.some((l) => l.sev === 'spam')) return 'spam';
    return 'info';
  }

  resListings = computed<Listing[]>(() => {
    const r = this.result();
    if (!r || !r.listed) return [];
    const zs: string[] = r.zones || [];
    const cs: string[] = r.codes || [];
    return zs.map((z, i) => this.decode(z, cs[i] || ''));
  });
  resSev = computed<'crit' | 'spam' | 'info'>(() => this.worst(this.resListings()));

  rowListings(r: any): Listing[] {
    const zs = (r.zones || '').split(',').filter(Boolean);
    const cs = (r.codes || '').split(',');
    return zs.map((z: string, i: number) => this.decode(z.trim(), (cs[i] || '').trim()));
  }
  rowSev(r: any): 'crit' | 'spam' | 'info' { return this.worst(this.rowListings(r)); }

  summary = computed(() => {
    const rows = this.listed().filter((r) => r.listed);
    let crit = 0, spam = 0, info = 0;
    for (const r of rows) {
      const s = this.rowSev(r);
      if (s === 'crit') crit++; else if (s === 'spam') spam++; else info++;
    }
    return { crit, spam, info, total: rows.length };
  });
  prop(n: number): number { const t = this.summary().total; return t ? (100 * n) / t : 0; }

  // ---- Colores por severidad ----
  sevColor(s: string) { return s === 'crit' ? '#e02424' : s === 'spam' ? '#e08600' : '#2563eb'; }
  sevBg(s: string) { return s === 'crit' ? '#fdecea' : s === 'spam' ? '#fff4e5' : '#eaf1fe'; }
  sevBorder(s: string) { return s === 'crit' ? '#f5c6cb' : s === 'spam' ? '#ffe0b2' : '#c7dbfb'; }
  sevIcon(s: string) { return s === 'crit' ? '🚨' : s === 'spam' ? '⚠' : 'ℹ'; }
  sevShort(s: string) { return s === 'crit' ? 'Infectada' : s === 'spam' ? 'Spam' : 'PBL'; }
  sevHead(s: string) { return s === 'crit' ? 'posible equipo infectado / botnet' : s === 'spam' ? 'reputación de spam' : 'espacio de usuario final (normal)'; }

  // ---- Datos ----
  load() {
    this.api.secRbl().subscribe({
      next: (d) => {
        this.st.set(d.status);
        this.listed.set(d.listed || []);
        this.listedNow.set(d.listedNow || 0);
        this.running.set(!!d.running || !!(d.status && d.status.running));
      },
      error: () => {},
    });
  }
  check() {
    const ip = (this.ip || '').trim();
    if (!ip) return;
    this.checking.set(true);
    this.result.set(null);
    this.api.secCheck(ip).subscribe({
      next: (r) => { this.result.set(r); this.checking.set(false); this.load(); },
      error: (e) => { this.result.set({ ok: false, error: e.message || 'Error' }); this.checking.set(false); },
    });
  }
  sweep() {
    this.running.set(true);
    this.api.secSweep().subscribe({
      next: () => setTimeout(() => this.load(), 800),
      error: (e) => { this.running.set(false); alert(e.message || 'No se pudo iniciar el barrido'); },
    });
  }

  pct(s: any): number { return !s || !s.total ? 0 : Math.min(100, Math.round((100 * (s.checked || 0)) / s.total)); }
  fmt(t: string | null): string {
    if (!t) return '';
    const d = new Date(t);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  private tick() { this.clock.set(new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }
}
