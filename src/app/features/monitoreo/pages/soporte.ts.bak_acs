import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

/**
 * Módulo Soporte (Fase 1). Busca cliente, abre ticket con datos de red en vivo,
 * diagnostica con botones (rellenan texto), acciones de consulta + ping (quedan en el
 * historial) y genera la orden técnica ya llena. No toca equipos.
 */
@Component({
  selector: 'app-soporte',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="tools">
      <span style="font-weight:700;font-size:16px">🎧 Soporte</span>
      <div class="ctabs" style="margin-left:12px">
        <button [class.on]="view()==='search'" (click)="view.set('search')">🔎 Buscar / Nuevo</button>
        <button [class.on]="view()==='tickets'" (click)="goTickets()">🎫 Tickets</button>
        <button [class.on]="view()==='orders'" (click)="goOrders()">📋 Órdenes</button>
      </div>
    </div>

    @if (view()==='search') {
      <div class="panel"><div class="pb">
        <div style="display:flex;gap:10px">
          <input class="inp" style="flex:1" placeholder="🔍 Buscar por nombre, contrato, IP o serial…"
                 [(ngModel)]="q" (keyup.enter)="doSearch()">
          <button class="btn" (click)="doSearch()">Buscar</button>
        </div>
        @if (results().length) {
          <table style="margin-top:12px">
            <thead><tr><th>Cliente</th><th>Contrato</th><th>ONU</th><th>OLT</th><th>IP</th><th>Estado</th><th>Señal</th><th></th></tr></thead>
            <tbody>
              @for (r of results(); track r.id) {
                <tr>
                  <td><b>{{ clientOnly(r.client_name) }}</b></td>
                  <td class="mono">{{ contrato(r.client_name) || '—' }}</td>
                  <td class="mono">{{ r.raw_index }}</td>
                  <td>{{ r.olt_name || '—' }}</td>
                  <td class="mono">{{ r.client_ip || '—' }}</td>
                  <td [innerHTML]="stBadge(r.phase_state)"></td>
                  <td>{{ r.onu_rx_dbm!=null ? (r.onu_rx_dbm | number:'1.2-2') + ' dBm' : '—' }}</td>
                  <td><button class="btn sm" (click)="openClient(r)">Abrir soporte →</button></td>
                </tr>
              }
            </tbody>
          </table>
        } @else if (searched()) {
          <div style="color:var(--muted);padding:16px 0">Sin resultados. Probá con otro nombre, contrato o IP.</div>
        }
      </div></div>
    }

    @if (view()==='ticket' && ticket(); as t) {
      <a class="back" (click)="view.set('search')">← Volver</a>
      <div class="row2sup">
        <!-- Cliente + red -->
        <div class="panel">
          <div class="ph">🧾 Ticket #{{ t.id }} · {{ t.cliente }} <span class="mini">contrato {{ t.contrato || '—' }}</span>
            <span class="badge b-ack" style="margin-left:auto">{{ t.estado }}</span>
          </div>
          <div class="pb">
            <div class="meta" style="grid-template-columns:repeat(3,1fr)">
              <div class="m"><div class="k">IP cliente</div><div class="v mono">{{ t.client_ip || '—' }}</div></div>
              <div class="m"><div class="k">OLT</div><div class="v">{{ t.olt_name || '—' }}</div></div>
              <div class="m"><div class="k">PON</div><div class="v mono">{{ t.pon }}</div></div>
              <div class="m"><div class="k">ONU ID</div><div class="v">{{ t.onu_num }}</div></div>
              <div class="m"><div class="k">Estado ONU</div><div class="v" [innerHTML]="stBadge(t.phase_state)"></div></div>
              <div class="m"><div class="k">Potencia RX</div><div class="v" [style.color]="rxColor(t.rx_dbm)">{{ t.rx_dbm!=null ? (t.rx_dbm | number:'1.2-2')+' dBm' : '—' }}</div></div>
              <div class="m"><div class="k">Distancia</div><div class="v">{{ t.distance_m!=null ? t.distance_m+' m' : '—' }}</div></div>
              <div class="m"><div class="k">Consumo</div><div class="v">{{ rate(t.out_rate_bps) }} ↓ / {{ rate(t.in_rate_bps) }} ↑</div></div>
              <div class="m" style="grid-column:1/-1;background:#fff8e1"><div class="k">Datos comerciales</div><div class="v" style="font-size:12px;color:var(--muted)">Teléfono, dirección, plan, nodo, corte — se integran con el ERP KLAX</div></div>
            </div>

            <div class="sec">📝 Diagnóstico rápido</div>
            <div class="chips">
              @for (d of diagBtns; track d.l) { <button class="chip" (click)="addDiag(d.t)">{{ d.l }}</button> }
            </div>
            <textarea class="inp" rows="4" style="width:100%;margin-top:8px;resize:vertical" [(ngModel)]="diag" placeholder="Diagnóstico…"></textarea>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
              <button class="btn ghost sm" (click)="saveDiag()">💾 Guardar diagnóstico</button>
              <button class="btn ghost sm" (click)="copyDiag()">📋 Copiar diagnóstico</button>
              <button class="btn sm" style="background:var(--green)" (click)="setEstado('Solucionado','Solucionado remoto')">✅ Solucionado</button>
              <button class="btn sm" style="background:var(--flotante-color)" (click)="showOrder.set(true)">🔧 Crear Orden Técnica</button>
            </div>
          </div>
        </div>

        <!-- Acciones remotas + historial -->
        <div class="panel">
          <div class="ph">🛠 Acciones remotas <span class="mini">consulta + ping</span></div>
          <div class="pb">
            <div class="chips">
              <button class="chip" (click)="runAction('estado')">Consultar estado</button>
              <button class="chip" (click)="runAction('potencia')">Ver potencia</button>
              <button class="chip" (click)="runAction('caidas')">Ver caídas</button>
              <button class="chip" (click)="runAction('consumo')">Ver consumo</button>
              <button class="chip" (click)="runAction('ping')">Ping cliente</button>
              <button class="chip" (click)="copyIp()">Copiar IP</button>
              <button class="chip" (click)="openRouter()">Abrir router ↗</button>
            </div>
            @if (lastResult()) { <div style="margin-top:8px;font-size:12.5px;color:#2563eb">{{ lastResult() }}</div> }

            <div class="sec">🕒 Historial</div>
            <div class="log">
              @for (e of t.log; track $index) {
                <div class="row">
                  <span class="hora">{{ e.hora }}</span>
                  <span class="u">{{ e.usuario }}</span>
                  <span class="txt"><b>{{ e.accion }}</b>{{ e.resultado ? ' → ' + e.resultado : '' }}</span>
                </div>
              } @empty { <div style="color:var(--muted);padding:10px">Sin acciones todavía.</div> }
            </div>
          </div>
        </div>
      </div>

      @if (showOrder()) {
        <div class="overlay on" (click)="showOrder.set(false)"></div>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="showOrder.set(false)">
          <div class="panel" style="width:min(560px,94vw)" (click)="$event.stopPropagation()">
            <div class="ph">🔧 Crear Orden Técnica <span class="mini">datos del cliente ya van cargados</span></div>
            <div class="pb" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="fld"><label>Prioridad</label>
                <select class="inp" [(ngModel)]="of.prioridad"><option>Alta</option><option>Media</option><option>Baja</option></select></div>
              <div class="fld"><label>Tipo de visita</label>
                <select class="inp" [(ngModel)]="of.tipo_visita"><option>Reparación</option><option>Instalación</option><option>Revisión</option><option>Cambio de equipo</option></select></div>
              <div class="fld"><label>Técnico asignado</label><input class="inp" [(ngModel)]="of.tecnico" placeholder="(opcional)"></div>
              <div class="fld"><label>Fecha tentativa</label><input class="inp" type="date" [(ngModel)]="of.fecha"></div>
              <div class="fld" style="grid-column:1/-1"><label>Observación adicional</label><textarea class="inp" rows="2" style="resize:vertical" [(ngModel)]="of.observacion"></textarea></div>
            </div>
            <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;justify-content:flex-end;gap:8px">
              <button class="btn ghost" (click)="showOrder.set(false)">Cancelar</button>
              <button class="btn" (click)="createOrder()">Crear orden</button>
            </div>
          </div>
        </div>
      }
    }

    @if (view()==='tickets') {
      <div class="panel"><table>
        <thead><tr><th>#</th><th>Cliente</th><th>Contrato</th><th>OLT</th><th>PON</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
        <tbody>
          @for (t of tickets(); track t.id) {
            <tr><td>{{ t.id }}</td><td><b>{{ t.cliente }}</b></td><td class="mono">{{ t.contrato || '—' }}</td>
              <td>{{ t.olt_name || '—' }}</td><td class="mono">{{ t.pon }}</td>
              <td><span class="badge b-ack">{{ t.estado }}</span></td><td style="font-size:12px;color:var(--muted)">{{ t.creado }}</td>
              <td><button class="btn sm ghost" (click)="openTicket(t.id)">Abrir →</button></td></tr>
          } @empty { <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Sin tickets.</td></tr> }
        </tbody></table></div>
    }

    @if (view()==='orders') {
      <div class="panel"><table>
        <thead><tr><th>N°</th><th>Cliente</th><th>Contrato</th><th>OLT</th><th>Prioridad</th><th>Técnico</th><th>Estado</th><th>Creada</th></tr></thead>
        <tbody>
          @for (o of orders(); track o.id) {
            <tr style="cursor:pointer" (click)="openOrder(o.id)"><td class="mono">{{ o.numero }}</td><td><b>{{ o.cliente }}</b></td>
              <td class="mono">{{ o.contrato || '—' }}</td><td>{{ o.olt_name || '—' }}</td>
              <td>{{ o.prioridad }}</td><td>{{ o.tecnico || '—' }}</td>
              <td><span class="badge b-maint">{{ o.estado }}</span></td><td style="font-size:12px;color:var(--muted)">{{ o.creado }}</td></tr>
          } @empty { <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Sin órdenes.</td></tr> }
        </tbody></table></div>

      @if (orderSel(); as o) {
        <div class="overlay on" (click)="orderSel.set(null)"></div>
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="orderSel.set(null)">
          <div class="panel" style="width:min(620px,94vw);max-height:90vh;overflow:auto" (click)="$event.stopPropagation()">
            <div class="ph">🔧 {{ o.numero }} <span class="mini">{{ o.cliente }}</span><button class="btn sm ghost" style="margin-left:auto" (click)="orderSel.set(null)">✕</button></div>
            <div class="pb" style="white-space:pre-line;font-size:13px;line-height:1.6">{{ orderText(o) }}</div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .ctabs { display:flex; gap:4px; }
    .ctabs button { border:none;background:none;padding:7px 12px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent }
    .ctabs button.on { color:#7c0061;border-bottom-color:#7c0061 }
    .row2sup { display:grid; grid-template-columns:1.1fr .9fr; gap:12px; align-items:start; }
    @media (max-width:1000px){ .row2sup{ grid-template-columns:1fr } }
    .sec { font-size:13px; font-weight:700; margin:14px 0 6px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; }
    .chips .chip { cursor:pointer; }
    .fld { display:flex; flex-direction:column; gap:3px; } .fld label { font-size:11px;color:var(--muted);font-weight:600 }
    .log { border:1px solid var(--border); border-radius:9px; max-height:340px; overflow:auto; }
    .log .row { display:flex; gap:10px; padding:7px 10px; border-bottom:1px solid var(--border); font-size:12.5px; }
    .log .row:last-child { border-bottom:none; }
    .log .hora { font-family:'Consolas',monospace; color:var(--muted); white-space:nowrap; }
    .log .u { font-weight:600; white-space:nowrap; } .log .txt { flex:1; }
    .back { color:var(--primary); cursor:pointer; display:inline-block; margin-bottom:10px; }
  `],
})
export class Soporte {
  private api = inject(NocApi);
  private readonly usuario = 'Wilson S.';

  view = signal<'search' | 'ticket' | 'tickets' | 'orders'>('search');
  q = '';
  searched = signal(false);
  results = signal<any[]>([]);
  ticket = signal<any | null>(null);
  diag = '';
  lastResult = signal('');
  tickets = signal<any[]>([]);
  orders = signal<any[]>([]);
  showOrder = signal(false);
  orderSel = signal<any | null>(null);
  of: any = { prioridad: 'Alta', tipo_visita: 'Reparación', tecnico: '', fecha: '', observacion: '' };

  diagBtns = [
    { l: 'Sin internet', t: 'Cliente reporta que no tiene internet. Se valida estado de ONU y potencia.' },
    { l: 'Internet lento', t: 'Cliente reporta internet lento. Se revisa consumo y potencia.' },
    { l: 'Intermitente', t: 'Servicio intermitente. Se revisa historial de caídas y potencia.' },
    { l: 'LOS roja', t: 'Cliente indica luz LOS roja en la ONU. Posible causa: corte de fibra, conector dañado o potencia baja. Acción: se valida con cliente estado de luces y reinicio básico. Resultado: requiere visita técnica.' },
    { l: 'ONU apagada', t: 'ONU apagada / sin luces. Se pide al cliente verificar energía y conexión.' },
    { l: 'Router apagado', t: 'Router del cliente apagado. Se pide verificar energía del router.' },
    { l: 'Cambio clave WiFi', t: 'Cliente solicita cambio de clave WiFi.' },
    { l: 'Cliente no responde', t: 'No se logra contactar al cliente.' },
    { l: 'Problema masivo', t: 'Posible problema masivo en el sector/nodo.' },
    { l: 'Requiere visita', t: 'Requiere visita técnica.' },
  ];

  doSearch() {
    if (!this.q.trim()) return;
    this.api.supSearch(this.q).subscribe((r) => { this.results.set(r); this.searched.set(true); });
  }

  openClient(r: any) {
    this.api.supCreateTicket({ onuId: r.id, createdBy: this.usuario }).subscribe((res) => this.openTicket(res.id));
  }

  openTicket(id: number) {
    this.api.supTicket(id).subscribe((t) => { this.ticket.set(t); this.diag = t.diagnostico || ''; this.lastResult.set(''); this.view.set('ticket'); });
  }
  private reload() { const t = this.ticket(); if (t) this.api.supTicket(t.id).subscribe((x) => this.ticket.set(x)); }

  addDiag(text: string) { this.diag = (this.diag ? this.diag + '\n' : '') + text; }
  saveDiag() { const t = this.ticket(); if (t) this.api.supUpdateTicket(t.id, { diagnostico: this.diag, usuario: this.usuario }).subscribe(() => this.reload()); }
  copyDiag() { navigator.clipboard?.writeText(this.diag || ''); this.lastResult.set('Diagnóstico copiado.'); }

  runAction(action: string) {
    const t = this.ticket(); if (!t) return;
    this.lastResult.set('Consultando…');
    this.api.supAction(t.id, action, this.usuario).subscribe((r) => { this.lastResult.set(r.accion + ' → ' + r.resultado); this.reload(); });
  }
  copyIp() { const t = this.ticket(); if (t?.client_ip) { navigator.clipboard?.writeText(t.client_ip); this.lastResult.set('IP copiada: ' + t.client_ip); this.api.supLog(t.id, 'Copió IP', t.client_ip, this.usuario).subscribe(() => this.reload()); } }
  openRouter() { const t = this.ticket(); if (t?.client_ip) { window.open('http://' + t.client_ip, '_blank'); this.api.supLog(t.id, 'Abrió router', 'http://' + t.client_ip, this.usuario).subscribe(() => this.reload()); } }

  setEstado(estado: string, resultado: string) {
    const t = this.ticket(); if (!t) return;
    this.api.supUpdateTicket(t.id, { estado, resultado, usuario: this.usuario }).subscribe(() => this.reload());
  }

  createOrder() {
    const t = this.ticket(); if (!t) return;
    this.api.supCreateOrder(t.id, { ...this.of, usuario: this.usuario }).subscribe((r) => {
      this.showOrder.set(false);
      this.lastResult.set('✅ Orden técnica ' + r.numero + ' creada.');
      this.reload();
    });
  }

  goTickets() { this.view.set('tickets'); this.api.supTickets().subscribe((t) => this.tickets.set(t)); }
  goOrders() { this.view.set('orders'); this.api.supOrders().subscribe((o) => this.orders.set(o)); }
  openOrder(id: number) { this.api.supOrder(id).subscribe((o) => this.orderSel.set(o)); }

  orderText(o: any): string {
    return `ORDEN TÉCNICA ${o.numero}\n\n` +
      `Cliente: ${o.cliente}\nContrato: ${o.contrato || '—'}\nIP: ${o.client_ip || '—'}\n\n` +
      `OLT: ${o.olt_name || '—'}   PON: ${o.pon}   ONU: ${o.onu_num}\n` +
      `Potencia: ${o.rx_dbm != null ? o.rx_dbm + ' dBm' : '—'}   Estado: ${o.phase_state || '—'}   Distancia: ${o.distance_m != null ? o.distance_m + ' m' : '—'}\n\n` +
      `Diagnóstico:\n${o.diagnostico || '—'}\n\nAcciones remotas realizadas:\n${o.acciones || '—'}\n` +
      `Prioridad: ${o.prioridad}   Tipo: ${o.tipo_visita}   Técnico: ${o.tecnico || 'sin asignar'}\n` +
      `Fecha tentativa: ${o.fecha || '—'}   Estado: ${o.estado}\n` +
      (o.observacion ? `\nObservación: ${o.observacion}` : '');
  }

  // ---- presentación ----
  stBadge(s: string): string {
    const p = (s || '').toLowerCase();
    if (p === 'working') return '<span class="badge b-up">ONLINE</span>';
    if (p === 'los') return '<span class="badge b-down">LOS</span>';
    return '<span class="badge b-maint">OFFLINE</span>';
  }
  rxColor(v: number | null): string {
    if (v == null) return 'var(--muted)';
    if (v <= -28) return 'var(--red)'; if (v <= -25) return 'var(--amber)'; return 'var(--green)';
  }
  rate(bps: number | null): string {
    if (bps == null) return '—';
    const b = bps * 8;
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' Mbps';
    if (b >= 1e3) return (b / 1e3).toFixed(0) + ' Kbps';
    return b + ' bps';
  }
  contrato(name: string | null): string { if (!name) return ''; const m = name.match(/^\s*(\d+)\s*[-_]/); return m ? m[1] : ''; }
  clientOnly(name: string | null): string {
    if (!name) return '(sin nombre)';
    let n = name.trim().replace(/^\s*\d+\s*[-_]+\s*/, '').replace(/[-_]+\s*\d{1,3}(\.\d{1,3}){3}\s*$/, '').replace(/[-_\s]+$/, '').trim();
    return n || name;
  }
}
