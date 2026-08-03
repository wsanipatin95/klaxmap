import { Component, signal, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

interface TopoNode {
  id: number; name: string; device_type: string; ip_address: string; status: string;
  zone: string; cidr: string; gateway: string; vlan: number | null; mgmt_iface: string;
  topo_x: number | null; topo_y: number | null; x: number; y: number;
}
interface TopoLink {
  id: number; src_id: number; dst_id: number; label: string; capacity: string;
  src_port_label: string | null; src_port_role: string | null;
  dst_port_label: string | null; dst_port_role: string | null;
}
interface Port { id: number; device_id: number; label: string; role: string; ip: string; vlan: number | null; descr: string; origin: string; if_index: number | null; }
interface LinkFrom { deviceId: number; deviceName: string; portId: number; portLabel: string; }

@Component({
  selector: 'app-topologia',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .wrap.full { position:fixed; inset:0; z-index:5000; background:var(--bg,#fff); padding:12px 16px; overflow:auto; }
    .top { display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
    .top h2 { margin:0; font-size:18px; display:flex; align-items:center; gap:8px; }
    .toolbar { display:flex; gap:8px; align-items:center; flex-wrap:nowrap; overflow-x:auto; max-width:100%; }
    .stats { display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
    .chip { background:#eef1f4; border-radius:20px; padding:3px 12px; font-size:12.5px; color:#334; }
    .chip b { margin-left:5px; }
    .chip.ok { background:#e6f7ec; color:#137a3b; } .chip.bad { background:#fdecec; color:#b91c1c; }
    .chip.lnk { background:#e8f0fe; color:#1a56c4; }
    .canvas-outer { position:relative; }
    .canvas-wrap { border:1px solid var(--border); border-radius:12px; overflow:auto; height:calc(100vh - 205px);
      background:
        linear-gradient(90deg, #eef2f6 1px, transparent 1px) 0 0 / 26px 26px,
        linear-gradient(#eef2f6 1px, transparent 1px) 0 0 / 26px 26px, #fbfcfd; }
    .full .canvas-wrap { height:calc(100vh - 150px); }
    .zoombox { position:absolute; right:16px; bottom:16px; display:flex; align-items:center; gap:6px;
      background:#fff; border:1px solid var(--border); border-radius:10px; padding:5px 8px; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    svg text { user-select:none; pointer-events:none; }
    .btn.on { background:#2563eb; color:#fff; border-color:#2563eb; }
  `],
  template: `
    <div class="wrap" [class.full]="fullscreen()">
    <div class="top">
      <h2>🖧 Topología de Red</h2>
      <span class="toolbar" style="margin-left:auto">
        <button class="btn" (click)="nuevo.set(true)">⊕ Nuevo Equipo</button>
        <button class="btn" [class.on]="connectMode()" (click)="toggleConnect()">🔗 {{ connectMode() ? 'Conectando…' : 'Modo Conectar' }}</button>
        <button class="btn ghost" (click)="importar()" title="Traer/actualizar equipos del ERP">⬇ Importar</button>
        <select class="inp" [(ngModel)]="pingSecs" (ngModelChange)="setPing()">
          <option [ngValue]="0">Ping: manual</option>
          <option [ngValue]="5">cada 5s</option>
          <option [ngValue]="10">cada 10s</option>
          <option [ngValue]="30">cada 30s</option>
          <option [ngValue]="60">cada 60s</option>
        </select>
        <button class="btn" (click)="load()">▶ Ping Ahora</button>
        <button class="btn ghost" (click)="toggleFull()" title="Pantalla completa">⛶</button>
      </span>
    </div>

    <div class="stats">
      <span class="chip">Total <b>{{ nodes().length }}</b></span>
      <span class="chip ok">Online <b>{{ upCount() }}</b></span>
      <span class="chip bad">Caídos <b>{{ downCount() }}</b></span>
      <span class="chip lnk">Enlaces <b>{{ links().length }}</b></span>
    </div>

    @if (linkFrom(); as lf) {
      <div class="chip lnk" style="margin-bottom:8px;display:inline-flex;align-items:center;gap:10px">🔗 Conectando desde <b>{{ lf.deviceName }} · {{ lf.portLabel }}</b> — abrí otro equipo y tocá "Conectar aquí".
        <button class="btn sm ghost" (click)="cancelLink()">Cancelar</button></div>
    }
    @if (note()) { <div class="chip" style="margin-bottom:8px;display:inline-block">{{ note() }}</div> }

    <div class="canvas-outer">
      <div class="canvas-wrap">
        <svg #svg [attr.viewBox]="'0 0 ' + W + ' ' + H" [attr.width]="W * zoom()" [attr.height]="H * zoom()"
             (wheel)="onWheel($event)" (mousemove)="onMove($event)" (mouseup)="onUp()" (mouseleave)="onUp()">
          @for (l of links(); track l.id) {
            @if (nodeById(l.src_id); as a) {
              @if (nodeById(l.dst_id); as b) {
                <line [attr.x1]="cx(a)" [attr.y1]="cy(a)" [attr.x2]="cx(b)" [attr.y2]="cy(b)"
                      [attr.stroke]="linkColor(a,b)" stroke-width="2.4" stroke-dasharray="7 5"
                      style="cursor:pointer;pointer-events:stroke" (click)="delLink(l)"><title>Click para borrar el enlace</title></line>
                @if (l.src_port_label) {
                  <rect [attr.x]="lx(a,b,0.26) - pillW(l.src_port_label)/2" [attr.y]="ly(a,b,0.26) - 9" [attr.width]="pillW(l.src_port_label)" height="15" rx="4" fill="#fff" [attr.stroke]="roleColor(l.src_port_role)"></rect>
                  <text [attr.x]="lx(a,b,0.26)" [attr.y]="ly(a,b,0.26) + 2" text-anchor="middle" font-size="9.5" font-weight="700" [attr.fill]="roleColor(l.src_port_role)">{{ l.src_port_label }}</text>
                }
                @if (l.dst_port_label) {
                  <rect [attr.x]="lx(a,b,0.74) - pillW(l.dst_port_label)/2" [attr.y]="ly(a,b,0.74) - 9" [attr.width]="pillW(l.dst_port_label)" height="15" rx="4" fill="#fff" [attr.stroke]="roleColor(l.dst_port_role)"></rect>
                  <text [attr.x]="lx(a,b,0.74)" [attr.y]="ly(a,b,0.74) + 2" text-anchor="middle" font-size="9.5" font-weight="700" [attr.fill]="roleColor(l.dst_port_role)">{{ l.dst_port_label }}</text>
                }
              }
            }
          }
          @for (n of nodes(); track n.id) {
            <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'" [style.cursor]="connectMode() ? 'pointer' : 'grab'" (mousedown)="onNodeDown($event, n)">
              <rect width="164" height="62" rx="11" fill="#ffffff" [attr.stroke]="stroke(n)" [attr.stroke-width]="connectFrom() === n.id ? 3.5 : 1.6"></rect>
              <text x="12" y="20" font-size="12.5" font-weight="700" fill="#0b2239">{{ ic(n) }} {{ n.name }}</text>
              <text x="12" y="36" font-size="10.5" fill="#5b6b7b">{{ n.ip_address || '— sin IP —' }}</text>
              <rect x="12" y="43" [attr.width]="statusText(n) === 'Online' ? 58 : 54" height="14" rx="7" [attr.fill]="chipFill(n)"></rect>
              <circle cx="21" cy="50" r="3.2" [attr.fill]="stroke(n)"></circle>
              <text x="28" y="53" font-size="9.5" font-weight="700" [attr.fill]="stroke(n)">{{ statusText(n) }}</text>
              <text x="120" y="53" font-size="9" fill="#9aa8b6">{{ n.device_type }}</text>
            </g>
          }
        </svg>
      </div>
      <div class="zoombox">
        <button class="btn sm ghost" (click)="zoomBy(0.8)" title="Alejar">－</button>
        <span style="font-size:12px;color:var(--muted);min-width:42px;text-align:center">{{ zoomPct() }}%</span>
        <button class="btn sm ghost" (click)="zoomBy(1.25)" title="Acercar">＋</button>
        <button class="btn sm ghost" (click)="zoomReset()" title="Restablecer">⟳</button>
      </div>
    </div>

    @if (panel(); as d) {
      <div class="overlay on" style="z-index:80" (click)="panel.set(null)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:81" (click)="panel.set(null)">
        <div class="panel" style="width:min(760px,96vw);max-height:86vh;overflow:auto;border-radius:16px" (click)="$event.stopPropagation()">
          <div class="ph">{{ ic(d) }} {{ d.name }} · <span style="color:var(--muted);font-weight:400">{{ d.device_type }} · {{ d.ip_address || 's/IP' }}</span></div>
          <div class="pb">
            <table class="zbx" style="width:100%">
              <thead><tr><th>Puerto</th><th>Rol</th><th>IP</th><th>VLAN</th><th>Descripción</th><th></th></tr></thead>
              <tbody>
                @for (p of ports(); track p.id) {
                  <tr>
                    <td><b style="font-size:12.5px">{{ p.label }}</b> <span style="font-size:9.5px;color:var(--muted)">· {{ p.origin }}</span></td>
                    <td>
                      <select class="inp" [(ngModel)]="p.role">
                        <option value="lan">LAN</option><option value="wan">WAN</option><option value="uplink">Uplink</option>
                        <option value="trunk">Trunk</option><option value="access">Access</option><option value="mgmt">Mgmt</option>
                      </select>
                    </td>
                    <td><input class="inp" style="width:110px" [(ngModel)]="p.ip"></td>
                    <td><input class="inp" type="number" style="width:66px" [(ngModel)]="p.vlan"></td>
                    <td><input class="inp" style="width:150px" [(ngModel)]="p.descr"></td>
                    <td style="white-space:nowrap">
                      <button class="btn sm" (click)="savePort(p)">Guardar</button>
                      <button class="btn sm ghost" (click)="connectPort(p)">{{ linkFrom() && linkFrom()!.deviceId !== d.id ? '🔗 Conectar aquí' : '🔗 Conectar' }}</button>
                      <button class="btn sm ghost" (click)="delPort(p)" title="Borrar puerto">🗑</button>
                    </td>
                  </tr>
                }
                @if (!ports().length) { <tr><td colspan="6" style="text-align:center;color:var(--muted);padding:14px">Sin puertos aún. Se traen solos por SNMP; agregá los que falten.</td></tr> }
              </tbody>
            </table>
            <div style="display:flex;gap:8px;align-items:center;margin-top:12px;border-top:1px dashed var(--border);padding-top:12px;flex-wrap:wrap">
              <span style="font-size:12px;color:var(--muted)">Nuevo puerto:</span>
              <input class="inp" style="width:130px" [(ngModel)]="npLabel" placeholder="ether1 / SFP1">
              <select class="inp" [(ngModel)]="npRole">
                <option value="lan">LAN</option><option value="wan">WAN</option><option value="uplink">Uplink</option>
                <option value="trunk">Trunk</option><option value="access">Access</option><option value="mgmt">Mgmt</option>
              </select>
              <button class="btn sm" (click)="addPort()">＋ Agregar puerto</button>
            </div>
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;text-align:right">
            <button class="btn ghost" (click)="panel.set(null)">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (nuevo()) {
      <div class="overlay on" style="z-index:80" (click)="nuevo.set(false)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:81" (click)="nuevo.set(false)">
        <div class="panel" style="width:min(460px,95vw);border-radius:16px;overflow:hidden" (click)="$event.stopPropagation()">
          <div class="ph">⊕ Nuevo equipo</div>
          <div class="pb" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="grid-column:1/3"><label class="k">Nombre</label><input class="inp" style="width:100%" [(ngModel)]="nvName" placeholder="CORE-1 / OLT-XYZ"></div>
            <div><label class="k">Tipo</label>
              <select class="inp" style="width:100%" [(ngModel)]="nvType">
                <option value="core">Core</option><option value="borde">Borde</option><option value="olt">OLT</option>
                <option value="servidor">Servidor</option><option value="mikrotik">MikroTik</option>
              </select>
            </div>
            <div><label class="k">IP de gestión</label><input class="inp" style="width:100%" [(ngModel)]="nvIp" placeholder="10.0.0.1"></div>
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;text-align:right">
            <button class="btn ghost" (click)="nuevo.set(false)">Cancelar</button>
            <button class="btn" (click)="crearEquipo()">Crear</button>
          </div>
        </div>
      </div>
    }
    </div>
  `,
})
export class Topologia implements OnInit, OnDestroy {
  private api = inject(NocApi);
  @ViewChild('svg') svgRef!: ElementRef<SVGSVGElement>;

  nodes = signal<TopoNode[]>([]);
  links = signal<TopoLink[]>([]);
  panel = signal<TopoNode | null>(null);
  ports = signal<Port[]>([]);
  linkFrom = signal<LinkFrom | null>(null);
  note = signal('');
  zoom = signal(1);
  nuevo = signal(false);
  connectMode = signal(false);
  connectFrom = signal<number | null>(null);
  fullscreen = signal(false);
  pingSecs = 0;
  nvName = ''; nvType = 'borde'; nvIp = '';
  npLabel = ''; npRole = 'lan';
  W = 2600; H = 1600;

  private dragId: number | null = null;
  private downNode: TopoNode | null = null;
  private offX = 0; private offY = 0; private moved = false; private startX = 0; private startY = 0;
  private timer: any = null;

  ngOnInit() { this.load(); }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  load() {
    this.api.topologia().subscribe((r: any) => {
      const nodes: TopoNode[] = (r?.nodes || []).map((n: any) => ({ ...n, vlan: n.vlan ?? null, x: 0, y: 0 }));
      this.layout(nodes);
      this.nodes.set(nodes);
      this.links.set(r?.links || []);
    });
  }

  private layout(nodes: TopoNode[]) {
    const band: Record<string, number> = { core: 60, borde: 260, mikrotik: 260, cisco: 260, olt: 470, servidor: 680 };
    const count: Record<string, number> = {};
    for (const n of nodes) {
      if (n.topo_x != null && n.topo_y != null) { n.x = n.topo_x; n.y = n.topo_y; continue; }
      const y = band[n.device_type] ?? 470;
      const key = n.device_type || 'otro';
      const i = (count[key] = (count[key] || 0) + 1) - 1;
      n.x = 40 + i * 190; n.y = y;
    }
  }

  upCount() { return this.nodes().filter((n) => (n.status || '').toLowerCase() === 'up').length; }
  downCount() { return this.nodes().filter((n) => (n.status || '').toLowerCase() === 'down').length; }

  nodeById(id: number) { return this.nodes().find((n) => n.id === id) || null; }
  cx(n: TopoNode) { return n.x + 82; }
  cy(n: TopoNode) { return n.y + 31; }
  lx(a: TopoNode, b: TopoNode, t: number) { return this.cx(a) + t * (this.cx(b) - this.cx(a)); }
  ly(a: TopoNode, b: TopoNode, t: number) { return this.cy(a) + t * (this.cy(b) - this.cy(a)); }
  pillW(label: string | null) { return (label || '').length * 6 + 12; }
  ic(n: TopoNode) {
    const t = (n.device_type || '').toLowerCase();
    return t === 'core' ? '🧠' : t === 'olt' ? '📡' : t === 'servidor' ? '🖥️' : t === 'mikrotik' ? '🛰️' : t === 'borde' ? '🌐' : '🔌';
  }
  statusText(n: TopoNode) { const s = (n.status || '').toLowerCase(); return s === 'up' ? 'Online' : s === 'down' ? 'Caído' : '?'; }
  stroke(n: TopoNode) { const s = (n.status || '').toLowerCase(); return s === 'up' ? '#22a06b' : s === 'down' ? '#dc2626' : '#94a3b8'; }
  chipFill(n: TopoNode) { const s = (n.status || '').toLowerCase(); return s === 'up' ? '#e6f7ec' : s === 'down' ? '#fdecec' : '#eef1f4'; }
  linkColor(a: TopoNode, b: TopoNode) {
    const down = (a.status || '').toLowerCase() === 'down' || (b.status || '').toLowerCase() === 'down';
    return down ? '#dc2626' : '#22a06b';
  }
  roleColor(r: string | null) {
    const x = (r || '').toLowerCase();
    return x === 'wan' || x === 'uplink' ? '#dc2626' : x === 'lan' || x === 'access' ? '#22a06b'
      : x === 'trunk' ? '#d97706' : x === 'mgmt' ? '#2563eb' : '#64748b';
  }

  toggleConnect() { this.connectMode.update((v) => !v); this.connectFrom.set(null); this.note.set(this.connectMode() ? 'Elegí el primer equipo…' : ''); }
  toggleFull() { this.fullscreen.update((v) => !v); }
  importar() { this.note.set('Importando del ERP…'); this.api.syncCheck().subscribe({ next: () => { this.note.set('Equipos actualizados.'); this.load(); }, error: () => this.load() }); }
  setPing() { if (this.timer) clearInterval(this.timer); if (this.pingSecs > 0) this.timer = setInterval(() => this.load(), this.pingSecs * 1000); }

  onNodeDown(ev: MouseEvent, n: TopoNode) {
    ev.preventDefault();
    if (this.connectMode()) { this.connectNodeClick(n); return; }
    const r = this.svgRef.nativeElement.getBoundingClientRect();
    this.dragId = n.id; this.downNode = n; this.moved = false;
    this.startX = ev.clientX; this.startY = ev.clientY;
    const z = this.zoom();
    this.offX = (ev.clientX - r.left) / z - n.x; this.offY = (ev.clientY - r.top) / z - n.y;
  }
  onMove(ev: MouseEvent) {
    if (this.dragId == null) return;
    if (!this.moved && Math.abs(ev.clientX - this.startX) < 4 && Math.abs(ev.clientY - this.startY) < 4) return;
    this.moved = true;
    const r = this.svgRef.nativeElement.getBoundingClientRect();
    const n = this.downNode; if (!n) return;
    const z = this.zoom();
    n.x = Math.max(0, Math.min(this.W - 164, (ev.clientX - r.left) / z - this.offX));
    n.y = Math.max(0, Math.min(this.H - 62, (ev.clientY - r.top) / z - this.offY));
    this.nodes.set([...this.nodes()]);
  }
  onUp() {
    if (this.dragId == null) return;
    const n = this.downNode; const moved = this.moved;
    this.dragId = null; this.downNode = null; this.moved = false;
    if (!n) return;
    if (moved) this.api.topoSavePos(n.id, Math.round(n.x), Math.round(n.y)).subscribe();
    else this.openDevice(n);
  }

  private connectNodeClick(n: TopoNode) {
    const from = this.connectFrom();
    if (from == null) { this.connectFrom.set(n.id); this.note.set('Ahora elegí el segundo equipo para conectar con ' + n.name + '.'); return; }
    if (from === n.id) { this.connectFrom.set(null); this.note.set('Cancelado.'); return; }
    this.api.topoAddLink({ src: from, dst: n.id }).subscribe({
      next: () => { this.connectFrom.set(null); this.note.set('Enlace creado.'); this.load(); },
      error: (e) => { this.connectFrom.set(null); this.note.set(e?.message || 'No se pudo crear el enlace.'); },
    });
  }

  openDevice(n: TopoNode) { this.panel.set(n); this.loadPorts(n.id); }
  loadPorts(id: number) { this.api.topoPorts(id).subscribe((p: any) => this.ports.set((p || []).map((x: any) => ({ ...x, vlan: x.vlan ?? null })))); }
  savePort(p: Port) { this.api.topoEditPort(p.id, { label: p.label, role: p.role, ip: p.ip, vlan: p.vlan, descr: p.descr }).subscribe(() => this.note.set('Puerto ' + p.label + ' guardado.')); }
  addPort() {
    const d = this.panel(); if (!d || !this.npLabel.trim()) return;
    this.api.topoAddPort({ device_id: d.id, label: this.npLabel.trim(), role: this.npRole }).subscribe(() => { this.npLabel = ''; this.loadPorts(d.id); });
  }
  delPort(p: Port) {
    if (!confirm('¿Borrar el puerto ' + p.label + '?')) return;
    const d = this.panel();
    this.api.topoDelPort(p.id).subscribe(() => { if (d) this.loadPorts(d.id); });
  }
  connectPort(p: Port) {
    const d = this.panel(); if (!d) return;
    const from = this.linkFrom();
    if (!from) {
      this.linkFrom.set({ deviceId: d.id, deviceName: d.name, portId: p.id, portLabel: p.label });
      this.panel.set(null);
      this.note.set('Elegí el puerto destino: abrí otro equipo y tocá "Conectar aquí".');
      return;
    }
    if (from.deviceId === d.id) { this.note.set('Elegí un equipo DISTINTO para el otro extremo.'); return; }
    this.api.topoAddLink({ src: from.deviceId, dst: d.id, src_port: from.portId, dst_port: p.id }).subscribe({
      next: () => { this.linkFrom.set(null); this.panel.set(null); this.note.set('Enlace creado.'); this.load(); },
      error: (e) => this.note.set(e?.message || 'No se pudo crear el enlace.'),
    });
  }
  cancelLink() { this.linkFrom.set(null); this.note.set(''); }
  delLink(l: TopoLink) { if (this.connectMode()) return; if (!confirm('¿Borrar este enlace?')) return; this.api.topoDelLink(l.id).subscribe(() => this.load()); }

  crearEquipo() {
    if (!this.nvName.trim()) { this.note.set('Poné un nombre.'); return; }
    this.api.createDevice({ name: this.nvName.trim(), device_type: this.nvType, ip_address: this.nvIp.trim() }).subscribe({
      next: () => { this.nuevo.set(false); this.nvName = ''; this.nvIp = ''; this.note.set('Equipo creado.'); this.load(); },
      error: (e) => this.note.set(e?.message || 'No se pudo crear el equipo.'),
    });
  }

  zoomBy(f: number) { this.zoom.set(Math.min(3, Math.max(0.3, +(this.zoom() * f).toFixed(3)))); }
  zoomReset() { this.zoom.set(1); }
  zoomPct() { return Math.round(this.zoom() * 100); }
  onWheel(ev: WheelEvent) { ev.preventDefault(); this.zoomBy(ev.deltaY < 0 ? 1.1 : 0.9); }
}
