import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

/**
 * Laboratorio SNMP: elige una OLT y dispara walks/scans de diagnóstico contra ella
 * para cazar OIDs (p. ej. el tráfico por ONU). Usa las credenciales guardadas de la OLT.
 * REQUIERE que el NOC tenga noc.diag.enabled=true (NOC_DIAG_ENABLED), si no responde 404.
 */
@Component({
  selector: 'app-lab-snmp',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="lab">
      <div class="hd">
        <span class="ttl">🔬 Laboratorio SNMP</span>
        <span class="sub">Cazar el OID de tráfico por ONU sin saturar la OLT</span>
      </div>

      <!-- Prueba de conexión NetFlow (Traffic Flow del MikroTik) -->
      <div class="card nf">
        <div class="nfhd">
          <span class="nftl">🛰️ Prueba de conexión NetFlow</span>
          <label class="nfauto"><input type="checkbox" [(ngModel)]="nfAuto" (ngModelChange)="nfToggle()"> Auto (3s)</label>
          <button class="b pri" [disabled]="nfBusy()" (click)="nfProbe()">Probar ahora</button>
        </div>
        @if (nf(); as s) {
          <div class="verdict" [class.ok]="nfState()==='ok'" [class.wait]="nfState()==='wait'" [class.bad]="nfState()==='bad'">
            <div class="vico">{{ nfIcon() }}</div>
            <div class="vtx">
              <div class="vt1">{{ nfTitle() }}</div>
              <div class="vt2">{{ nfSub() }}</div>
            </div>
          </div>
          <div class="nfgrid">
            <div><span>Colector</span><b>{{ s.listening ? 'escuchando' : 'apagado' }}</b></div>
            <div><span>Puerto</span><b>{{ s.port || '—' }}</b></div>
            <div><span>Paquetes recibidos</span><b>{{ s.packetsTotal || 0 }}</b></div>
            <div><span>Flujos parseados</span><b>{{ s.flowsTotal || 0 }}</b></div>
            <div><span>Último exportador</span><b>{{ s.lastExporter || '—' }}</b></div>
            <div><span>Último paquete</span><b>{{ s.secsSincePacket==null ? 'nunca' : 'hace ' + s.secsSincePacket + 's' }}</b></div>
          </div>
          @if (s.lastError) { <div class="nferr">⚠ {{ s.lastError }}</div> }
        } @else {
          <div class="nfempty">Tocá "Probar ahora" para preguntarle al colector del NOC si le está llegando algo.</div>
        }
        <div class="hint">💡 Apuntá el MikroTik con <code>/ip traffic-flow target</code> a la IP del NOC, puerto {{ nf()?.port || 2055 }}, versión 9. Si "Paquetes recibidos" sube, ¡ya conecta!</div>
      </div>

      <div class="card">
        <div class="row">
          <label>OLT</label>
          <select [(ngModel)]="oltId" (ngModelChange)="onPick()">
            <option [ngValue]="null">— Elige una OLT —</option>
            @for (o of olts(); track o.id) { <option [ngValue]="o.id">{{ o.name }} · {{ o.ip_address }}</option> }
          </select>
        </div>
        @if (sel(); as o) {
          <div class="meta">IP <b>{{ o.ip_address }}</b> · community <b>{{ o.snmp_community || 'public' }}</b> · puerto <b>{{ o.snmp_port || 161 }}</b></div>
        }
        <div class="btns">
          <button class="b" [disabled]="!sel() || busy()" (click)="probar()">1 · Probar conexión</button>
          <button class="b pri" [disabled]="!sel() || busy()" (click)="buscarTrafico()">2 · Buscar tráfico por ONU</button>
          <button class="b" [disabled]="!sel() || busy()" (click)="ifmib()">3 · Ver octetos IF-MIB</button>
        </div>

        <div class="adv">
          <input [(ngModel)]="oidManual" placeholder="OID manual (avanzado) — ej. 1.3.6.1.4.1.3902.1012.3.50.12.2.1">
          <button class="b" [disabled]="!sel() || busy() || !oidManual.trim()" (click)="walkManual()">Walk</button>
          <button class="b" [disabled]="!sel() || busy() || !oidManual.trim()" (click)="scanManual()">Scan columnas</button>
        </div>
      </div>

      <div class="card out">
        <div class="ohd">
          <span>Resultado {{ busy() ? '· ⏳ corriendo…' : '' }}</span>
          <button class="b xs" [disabled]="!salida()" (click)="copiar()">📋 Copiar</button>
          <button class="b xs" [disabled]="!salida()" (click)="salida.set('')">Limpiar</button>
        </div>
        <textarea readonly [value]="salida()" placeholder="Aquí sale el resultado. Cópialo y pégamelo en el chat."></textarea>
        <div class="hint">💡 Cuando termine, copia todo y pégamelo — yo te digo cuál columna es el tráfico ↓/↑.</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .lab { max-width:1000px; margin:0 auto; padding:14px 18px 50px; }
    .hd { margin-bottom:12px; }
    .ttl { font-weight:800; font-size:18px; }
    .sub { color:var(--muted,#8a8296); font-size:13px; margin-left:8px; }
    .card { background:#fff; border:1px solid #ece8f1; border-radius:14px; padding:14px 16px; margin-bottom:14px; box-shadow:0 1px 2px rgba(26,21,38,.04); }
    .row { display:flex; align-items:center; gap:10px; }
    .row label { font-size:12px; font-weight:700; color:var(--muted,#8a8296); width:40px; }
    select, input, textarea { border:1px solid #ece8f1; border-radius:9px; padding:8px 10px; font-size:13px; font-family:inherit; outline:none; }
    select { min-width:340px; }
    .meta { font-size:12.5px; color:var(--muted,#8a8296); margin:9px 0 2px; }
    .meta b { color:#1a1526; font-family:'Consolas',monospace; }
    .btns { display:flex; gap:9px; flex-wrap:wrap; margin-top:12px; }
    .adv { display:flex; gap:8px; margin-top:12px; align-items:center; }
    .adv input { flex:1; font-family:'Consolas',monospace; }
    .b { height:36px; border:1px solid #ece8f1; background:#fff; border-radius:9px; padding:0 14px; font-weight:600; font-size:13px; cursor:pointer; }
    .b:hover:not(:disabled) { background:#faf8fc; }
    .b.pri { background:#7c0061; color:#fff; border-color:#7c0061; }
    .b.xs { height:28px; padding:0 10px; font-size:12px; }
    .b:disabled { opacity:.5; cursor:not-allowed; }
    .out .ohd { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:700; font-size:13px; }
    .out .ohd span { margin-right:auto; }
    textarea { width:100%; height:340px; resize:vertical; background:#0c1024; color:#c9d3ff; border-color:#2c3355; white-space:pre; font-size:12px; }
    .hint { font-size:12px; color:var(--muted,#8a8296); margin-top:8px; }
    .nf .nfhd { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
    .nf .nftl { font-weight:800; font-size:15px; margin-right:auto; }
    .nf .nfauto { font-size:12px; color:var(--muted,#8a8296); display:flex; align-items:center; gap:5px; cursor:pointer; }
    .verdict { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:12px; border:1px solid #ece8f1; background:#faf8fc; margin-bottom:12px; }
    .verdict.ok { background:#eafaf0; border-color:#bfead0; }
    .verdict.wait { background:#fff7ea; border-color:#f0dcb8; }
    .verdict.bad { background:#fdecec; border-color:#f2c9c9; }
    .verdict .vico { font-size:30px; line-height:1; }
    .verdict .vt1 { font-weight:800; font-size:15px; }
    .verdict .vt2 { font-size:12.5px; color:#5b5566; margin-top:2px; }
    .nfgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:9px 16px; }
    @media(max-width:640px){ .nfgrid { grid-template-columns:repeat(2,1fr); } }
    .nfgrid > div { display:flex; flex-direction:column; }
    .nfgrid span { font-size:11px; color:var(--muted,#8a8296); font-weight:600; }
    .nfgrid b { font-size:13.5px; font-family:'Consolas',monospace; }
    .nferr { margin-top:10px; font-size:12.5px; color:#b42318; }
    .nfempty { font-size:13px; color:var(--muted,#8a8296); padding:8px 0; }
    .nf code { background:#f3eef7; padding:1px 5px; border-radius:5px; font-size:12px; }
  `],
})
export class LabSnmp implements OnDestroy {
  private api = inject(NocApi);

  olts = signal<any[]>([]);
  oltId: number | null = null;
  salida = signal('');
  busy = signal(false);
  oidManual = '';

  // ---- Prueba de conexión NetFlow (semáforo en vivo) ----
  nf = signal<any | null>(null);
  nfBusy = signal(false);
  nfAuto = false;
  private nfTimer: any = null;

  ngOnDestroy() { if (this.nfTimer) { clearInterval(this.nfTimer); this.nfTimer = null; } }

  nfProbe() {
    this.nfBusy.set(true);
    this.api.flowStatus().subscribe({
      next: (st) => { this.nf.set(st); this.nfBusy.set(false); },
      error: () => { this.nfBusy.set(false); },
    });
  }
  nfToggle() {
    if (this.nfTimer) { clearInterval(this.nfTimer); this.nfTimer = null; }
    if (this.nfAuto) { this.nfProbe(); this.nfTimer = setInterval(() => this.nfProbe(), 3000); }
  }
  nfState(): 'ok' | 'wait' | 'bad' {
    const s = this.nf(); if (!s) return 'wait';
    if (!s.listening) return 'bad';
    if ((s.packetsTotal || 0) > 0 && s.receiving) return 'ok';
    return 'wait';
  }
  nfIcon(): string { const st = this.nfState(); return st === 'ok' ? '✅' : st === 'bad' ? '❌' : '⏳'; }
  nfTitle(): string {
    const s = this.nf(); if (!s) return '';
    if (!s.listening) return 'Colector apagado';
    if ((s.packetsTotal || 0) > 0 && s.receiving) return '¡Conecta! Están llegando flujos';
    if ((s.packetsTotal || 0) > 0 && !s.receiving) return 'Recibió antes, pero ahora no llega nada';
    return 'Escuchando, sin paquetes todavía';
  }
  nfSub(): string {
    const s = this.nf(); if (!s) return '';
    if (!s.listening) return s.lastError || 'El colector NetFlow no está activo en el NOC.';
    if ((s.packetsTotal || 0) > 0 && s.receiving) return 'Exportador ' + (s.lastExporter || '?') + ' · ' + (s.flowsTotal || 0) + ' flujos parseados.';
    if ((s.packetsTotal || 0) > 0 && !s.receiving) return 'Último de ' + (s.lastExporter || '?') + ' hace ' + s.secsSincePacket + 's. Revisá que el MikroTik siga exportando.';
    return 'Escucha en el puerto ' + s.port + ' pero el MikroTik aún no exporta a esta IP.';
  }

  // Subárboles candidatos donde suele vivir el tráfico/performance por ONU en ZTE (enterprise 3902).
  private basesTrafico = [
    '1.3.6.1.4.1.3902.1012.3.50.12.2.1',
    '1.3.6.1.4.1.3902.1012.3.28.2.1',
    '1.3.6.1.4.1.3902.1012.3.50.11.2.1',
  ];

  constructor() {
    this.api.devices().subscribe({
      next: (d: any[]) => this.olts.set((d || []).filter((x) => x.device_type === 'olt')),
      error: () => {},
    });
  }

  sel() { return this.olts().find((o) => o.id === this.oltId) || null; }
  onPick() { /* solo refresca la vista */ }

  private append(t: string) { this.salida.set(this.salida() + t); }
  private errText(e: any): string {
    if (e?.status === 404) return '\n⚠ El modo laboratorio está APAGADO en el NOC. Pídele a quien administra el servidor que ponga NOC_DIAG_ENABLED=true y reinicie el NOC.\n';
    if (e?.status === 401 || e?.status === 403) return '\n⚠ Sesión/permiso. Vuelve a entrar a la app e intenta de nuevo.\n';
    return '\n⚠ Error: ' + (e?.message || 'no se pudo conectar') + '\n';
  }

  probar() {
    const o = this.sel(); if (!o) return;
    this.busy.set(true);
    this.append('\n===== PROBAR CONEXIÓN (sysDescr) =====\n');
    this.api.diagSnmpGet(o.ip_address, o.snmp_community || 'public', '1.3.6.1.2.1.1.1.0', o.snmp_port || 161).subscribe({
      next: (t) => { this.append(t + '\n'); this.busy.set(false); },
      error: (e) => { this.append(this.errText(e)); this.busy.set(false); },
    });
  }

  buscarTrafico() {
    const o = this.sel(); if (!o) return;
    this.busy.set(true);
    const steps = this.basesTrafico.map((base) => ({
      label: 'SCAN columnas ' + base,
      run: () => this.api.diagScanColumns(o.ip_address, o.snmp_community || 'public', base, 1, 30, 3, o.snmp_port || 161, 250),
    }));
    this.runSeq(steps, 0);
  }

  ifmib() {
    const o = this.sel(); if (!o) return;
    this.busy.set(true);
    const steps = [
      { label: 'IF-MIB ifHCInOctets', run: () => this.api.diagSnmpWalk(o.ip_address, o.snmp_community || 'public', '1.3.6.1.2.1.31.1.1.1.6', o.snmp_port || 161, 40) },
      { label: 'IF-MIB ifHCOutOctets', run: () => this.api.diagSnmpWalk(o.ip_address, o.snmp_community || 'public', '1.3.6.1.2.1.31.1.1.1.10', o.snmp_port || 161, 40) },
    ];
    this.runSeq(steps, 0);
  }

  walkManual() {
    const o = this.sel(); if (!o || !this.oidManual.trim()) return;
    this.busy.set(true);
    this.append('\n===== WALK ' + this.oidManual.trim() + ' =====\n');
    this.api.diagSnmpWalk(o.ip_address, o.snmp_community || 'public', this.oidManual.trim(), o.snmp_port || 161, 60).subscribe({
      next: (t) => { this.append(t + '\n'); this.busy.set(false); },
      error: (e) => { this.append(this.errText(e)); this.busy.set(false); },
    });
  }
  scanManual() {
    const o = this.sel(); if (!o || !this.oidManual.trim()) return;
    this.busy.set(true);
    this.append('\n===== SCAN columnas ' + this.oidManual.trim() + ' =====\n');
    this.api.diagScanColumns(o.ip_address, o.snmp_community || 'public', this.oidManual.trim(), 1, 30, 3, o.snmp_port || 161, 250).subscribe({
      next: (t) => { this.append(t + '\n'); this.busy.set(false); },
      error: (e) => { this.append(this.errText(e)); this.busy.set(false); },
    });
  }

  private runSeq(steps: { label: string; run: () => any }[], i: number) {
    if (i >= steps.length) { this.busy.set(false); return; }
    this.append('\n===== ' + steps[i].label + ' =====\n');
    steps[i].run().subscribe({
      next: (t: string) => { this.append(t + '\n'); this.runSeq(steps, i + 1); },
      error: (e: any) => { this.append(this.errText(e)); this.runSeq(steps, i + 1); },
    });
  }

  copiar() { navigator.clipboard?.writeText(this.salida() || ''); }
}
