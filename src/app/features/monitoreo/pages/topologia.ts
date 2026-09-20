import { Component, signal, inject, effect, HostListener, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
interface AlarmCfg {
  on: boolean; vol: number; tono: 'sirena' | 'beep' | 'campana';
  repetirSeg: number;                 // 0 = una sola vez; >0 = repite cada N s mientras haya caidas sin silenciar
  recuperacion: boolean;              // tono corto cuando un equipo caido vuelve
  alInicio: boolean;                  // avisar tambien por lo que ya esta caido al abrir la pantalla
  tipos: Record<string, boolean>;     // core / borde / olt / servidor / otro
}
interface Caida { id: number; name: string; desde: string; }

@Component({
  selector: 'app-topologia',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { --c-ok:#16a34a; --c-down:#dc2626; --c-idle:#94a3b8; --c-ink:#0b2239; --c-mute:#64748b; }
    .wrap.full { position:fixed; inset:0; z-index:5000; background:var(--bg,#fff); padding:12px 16px; overflow:auto; }
    .top { display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
    .top h2 { margin:0; font-size:17px; font-weight:600; display:flex; align-items:center; gap:8px; color:var(--c-ink); letter-spacing:-.01em; }
    .top h2 i { color:var(--c-mute); font-size:15px; }
    .toolbar { display:flex; gap:8px; align-items:center; flex-wrap:nowrap; }
    .toolbar .btn { height:30px; padding:0 13px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:500; }
    .toolbar .btn i { font-size:12px; }
    .toolbar .btn.icon { width:30px; padding:0; justify-content:center; }
    .btn.on { background:#2563eb; color:#fff; border-color:#2563eb; }
    .btn.alarm-on { background:#fff; color:#b45309; border-color:#fbbf24; box-shadow:inset 0 0 0 1px #fde68a; }
    .ham { border:none; background:none; cursor:pointer; width:34px; height:34px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:var(--c-mute); font-size:16px; }
    .ham:hover { background:#eef1f4; color:var(--c-ink); }

    .autochip { height:30px; display:inline-flex; align-items:center; gap:7px; padding:0 13px; border-radius:8px;
      background:#f1f5f9; color:var(--c-mute); font-size:12px; font-weight:500; white-space:nowrap; border:1px solid #e2e8f0; }
    .autochip .dot { width:6px; height:6px; border-radius:50%; background:var(--c-ok); box-shadow:0 0 0 2.5px rgba(22,163,74,.16); }

    .canvas-outer { position:relative; }
    .hud { position:absolute; top:12px; left:12px; z-index:6; display:flex; gap:7px; flex-wrap:wrap; align-items:center; pointer-events:none; }
    .chip { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:4px 11px; font-size:12px; color:var(--c-mute); font-weight:500; }
    .chip b { margin-left:6px; color:var(--c-ink); font-weight:600; }
    .chip.ok b { color:var(--c-ok); } .chip.bad b { color:var(--c-down); } .chip.lnk b { color:#1d4ed8; }
    .hud .chip { box-shadow:0 1px 3px rgba(11,34,57,.07); }

    .hud-note { position:absolute; top:52px; left:12px; z-index:6; background:#fff; border:1px solid #e2e8f0; border-radius:10px;
      padding:8px 13px; font-size:12.5px; color:#334; box-shadow:0 4px 14px rgba(11,34,57,.12); display:inline-flex; align-items:center; gap:10px; max-width:74%; }
    .hud-note { pointer-events:none; } .hud-note button { pointer-events:auto; }
    .hud-note.lnk { border-color:#bfdbfe; background:#eff6ff; color:#1d4ed8; }
    .hud-note.caida { border-color:#fecaca; background:#fef2f2; color:#991b1b; padding-left:11px; }
    .hud-note.caida .lbl { font-weight:600; }
    .hud-note.caida .eq { color:#7f1d1d; }
    .hud-note.caida .hint { color:#b45309; font-size:11.5px; }
    .pulse { width:8px; height:8px; border-radius:50%; background:var(--c-down); flex:none; animation:pulse 1.6s ease-out infinite; }
    .hud-note.caida.silenciada .pulse { animation:none; opacity:.55; }
    @keyframes pulse { 0% { box-shadow:0 0 0 0 rgba(220,38,38,.45); } 70% { box-shadow:0 0 0 7px rgba(220,38,38,0); } 100% { box-shadow:0 0 0 0 rgba(220,38,38,0); } }

    .canvas-wrap { border:1px solid var(--border); border-radius:12px; overflow:auto; height:calc(100vh - 132px);
      background:
        linear-gradient(90deg, #eef2f6 1px, transparent 1px) 0 0 / 26px 26px,
        linear-gradient(#eef2f6 1px, transparent 1px) 0 0 / 26px 26px, #fbfcfd; }
    .full .canvas-wrap { height:calc(100vh - 92px); }
    .zoombox { position:absolute; right:16px; bottom:16px; display:flex; align-items:center; gap:4px;
      background:#fff; border:1px solid var(--border); border-radius:10px; padding:4px 6px; box-shadow:0 2px 8px rgba(11,34,57,.1); }
    .zoombox .btn { width:26px; height:26px; padding:0; justify-content:center; border-radius:7px; }
    svg text { user-select:none; pointer-events:none; }

    /* ---- Panel de configuracion de la alarma ---- */
    .ac-backdrop { position:fixed; inset:0; z-index:88; }
    .ac { position:absolute; right:0; top:44px; z-index:89; width:318px; background:#fff; border:1px solid #e2e8f0; border-radius:12px;
      box-shadow:0 12px 34px rgba(11,34,57,.16); font-size:12.5px; color:#334; overflow:hidden; }
    .ac-head { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-bottom:1px solid #eef2f6; }
    .ac-head h4 { margin:0; font-size:13px; font-weight:600; color:var(--c-ink); }
    .ac-x { border:none; background:none; cursor:pointer; color:#94a3b8; width:24px; height:24px; border-radius:6px; font-size:12px; }
    .ac-x:hover { background:#f1f5f9; color:var(--c-ink); }
    .ac-body { padding:6px 14px 12px; }
    .ac-row { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:34px; }
    .ac-row + .ac-row { border-top:1px solid #f4f7fa; }
    .ac-row label.k { color:var(--c-mute); font-size:12.5px; font-weight:400; margin:0; }
    .ac-row .inp { height:28px; font-size:12.5px; max-width:152px; }
    .ac-sec { font-size:11px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#94a3b8; margin:12px 0 7px; }
    .ac-foot { display:flex; justify-content:flex-end; gap:7px; padding:11px 14px; border-top:1px solid #eef2f6; background:#fafbfc; }
    .vol { display:flex; align-items:center; gap:9px; }
    .vol input[type=range] { width:108px; accent-color:#2563eb; }
    .vol b { width:34px; text-align:right; font-weight:600; color:var(--c-ink); font-variant-numeric:tabular-nums; }
    .pills { display:flex; flex-wrap:wrap; gap:6px; }
    .pill { border:1px solid #e2e8f0; background:#fff; color:var(--c-mute); border-radius:16px; padding:4px 11px; font-size:11.5px; font-weight:500; cursor:pointer; }
    .pill:hover { border-color:#cbd5e1; }
    .pill.on { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
    .sw { position:relative; display:inline-block; width:34px; height:19px; flex:none; }
    .sw input { opacity:0; width:0; height:0; position:absolute; }
    .sw span { position:absolute; inset:0; background:#cbd5e1; border-radius:19px; transition:background .15s; cursor:pointer; }
    .sw span::after { content:''; position:absolute; width:15px; height:15px; left:2px; top:2px; background:#fff; border-radius:50%; transition:transform .15s; box-shadow:0 1px 2px rgba(11,34,57,.25); }
    .sw input:checked + span { background:#2563eb; }
    .sw input:checked + span::after { transform:translateX(15px); }
    .sw input:focus-visible + span { box-shadow:0 0 0 3px rgba(37,99,235,.25); }
  `],
  template: `
    <div class="wrap" [class.full]="fullscreen()">
    <div class="top">
      <button class="ham" (click)="toggleFull()" title="Menú (Esc para salir)"><i class="pi pi-bars"></i></button>
      <h2><i class="pi pi-sitemap"></i> Topología de Red</h2>
      <span class="toolbar" style="margin-left:auto;position:relative">
        <button class="btn ghost" (click)="importar()" title="Traer o actualizar equipos del ERP"><i class="pi pi-download"></i> Importar</button>
        <span class="autochip" title="El estado se refresca automáticamente"><span class="dot"></span> Auto {{ autoSecs }}s</span>
        <button class="btn" [class.alarm-on]="alarm().on" (click)="toggleAlarma()"
                [title]="alarm().on ? 'Alarma sonora activada' : 'Alarma sonora desactivada'">
          <i class="pi pi-bell"></i> Alarma</button>
        <button class="btn ghost icon" (click)="alarmCfgOpen.set(!alarmCfgOpen())" title="Configurar alarma"><i class="pi pi-cog"></i></button>

        @if (alarmCfgOpen()) {
          <div class="ac-backdrop" (click)="alarmCfgOpen.set(false)"></div>
          <div class="ac" (click)="$event.stopPropagation()">
            <div class="ac-head">
              <h4>Alarma de caída</h4>
              <button class="ac-x" (click)="alarmCfgOpen.set(false)" title="Cerrar"><i class="pi pi-times"></i></button>
            </div>
            <div class="ac-body">
              <div class="ac-row">
                <label class="k">Alarma sonora</label>
                <label class="sw"><input type="checkbox" [ngModel]="alarm().on" (ngModelChange)="setOn($event)"><span></span></label>
              </div>
              <div class="ac-row">
                <label class="k">Volumen</label>
                <span class="vol">
                  <input type="range" min="0" max="100" step="5" [ngModel]="alarm().vol" (ngModelChange)="setAlarm({ vol: +$event })">
                  <b>{{ alarm().vol }}%</b>
                </span>
              </div>
              <div class="ac-row">
                <label class="k">Tono</label>
                <select class="inp" [ngModel]="alarm().tono" (ngModelChange)="setAlarm({ tono: $event })">
                  <option value="sirena">Sirena</option><option value="beep">Beep</option><option value="campana">Campana</option>
                </select>
              </div>
              <div class="ac-row">
                <label class="k">Repetición</label>
                <select class="inp" [ngModel]="alarm().repetirSeg" (ngModelChange)="setAlarm({ repetirSeg: +$event })">
                  <option [ngValue]="0">Una sola vez</option>
                  <option [ngValue]="4">Continua</option>
                  <option [ngValue]="15">Cada 15 s</option>
                  <option [ngValue]="30">Cada 30 s</option>
                  <option [ngValue]="60">Cada 60 s</option>
                </select>
              </div>

              <div class="ac-sec">Equipos que disparan la alarma</div>
              <div class="pills">
                @for (t of tiposAlarma; track t.k) {
                  <button class="pill" [class.on]="alarm().tipos[t.k]" (click)="setTipo(t.k, !alarm().tipos[t.k])">{{ t.label }}</button>
                }
              </div>

              <div class="ac-sec">Avisos adicionales</div>
              <div class="ac-row">
                <label class="k">Tono al recuperarse</label>
                <label class="sw"><input type="checkbox" [ngModel]="alarm().recuperacion" (ngModelChange)="setAlarm({ recuperacion: !!$event })"><span></span></label>
              </div>
              <div class="ac-row">
                <label class="k">Avisar lo ya caído al abrir</label>
                <label class="sw"><input type="checkbox" [ngModel]="alarm().alInicio" (ngModelChange)="setAlarm({ alInicio: !!$event })"><span></span></label>
              </div>
            </div>
            <div class="ac-foot">
              <button class="btn sm ghost" (click)="probarAlarma()"><i class="pi pi-play"></i> Probar</button>
              <button class="btn sm" (click)="alarmCfgOpen.set(false)">Listo</button>
            </div>
          </div>
        }
      </span>
    </div>

    <div class="canvas-outer">
      <div class="hud">
        <span class="chip">Total <b>{{ nodes().length }}</b></span>
        <span class="chip ok">Online <b>{{ upCount() }}</b></span>
        <span class="chip bad">Caídos <b>{{ downCount() }}</b></span>
        <span class="chip lnk">Enlaces <b>{{ links().length }}</b></span>
      </div>

      @if (caidas().length) {
        <div class="hud-note caida" [class.silenciada]="silenciado()">
          <span class="pulse"></span>
          <span class="lbl">{{ caidas().length === 1 ? 'Equipo caído' : caidas().length + ' equipos caídos' }}</span>
          <span class="eq">{{ nombresCaidas() }}</span>
          @if (audioBloqueado() && alarm().on) { <span class="hint">Hacé clic en la pantalla para habilitar el audio</span> }
          @if (alarm().on && !silenciado()) { <button class="btn sm ghost" (click)="silenciar()"><i class="pi pi-volume-off"></i> Silenciar</button> }
          <button class="btn sm ghost" (click)="descartarCaidas()">Descartar</button>
        </div>
      } @else if (linkFrom(); as lf) {
        <div class="hud-note lnk"><i class="pi pi-link"></i> Conectando desde <b>{{ lf.deviceName }} · {{ lf.portLabel }}</b> — abrí otro equipo y elegí "Conectar aquí".
          <button class="btn sm ghost" (click)="cancelLink()">Cancelar</button></div>
      } @else if (note()) { <div class="hud-note">{{ note() }}</div> }

      <div class="canvas-wrap">
        <svg #svg [attr.viewBox]="'0 0 ' + W + ' ' + H" [attr.width]="W * zoom()" [attr.height]="H * zoom()"
             (wheel)="onWheel($event)" (mousemove)="onMove($event)" (mouseup)="onUp()" (mouseleave)="onUp()">
          <defs>
            <symbol id="topo-ic-core" viewBox="0 0 16 16">
              <path d="M8 1.1l6.1 3.5v6.8L8 14.9 1.9 11.4V4.6z"/>
            </symbol>
            <symbol id="topo-ic-borde" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="2.7"/>
              <path d="M8 .7l2 2.6H6zM8 15.3l2-2.6H6zM.7 8l2.6 2V6zM15.3 8l-2.6 2V6z"/>
            </symbol>
            <symbol id="topo-ic-olt" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M2 4h12a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1zm1.3 5.3h1.6v1.5H3.3zm2.9 0h1.6v1.5H6.2zm2.9 0h1.6v1.5H9.1z"/>
            </symbol>
            <symbol id="topo-ic-servidor" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M2 2h12a1 1 0 011 1v3.4a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1zm.9 1.8h1.6v1.6H2.9zM2 8.6h12a1 1 0 011 1V13a1 1 0 01-1 1H2a1 1 0 01-1-1V9.6a1 1 0 011-1zm.9 1.8h1.6V12H2.9z"/>
            </symbol>
            <symbol id="topo-ic-otro" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M2.6 2.6h10.8a1 1 0 011 1v8.8a1 1 0 01-1 1H2.6a1 1 0 01-1-1V3.6a1 1 0 011-1zm1.3 2.2h2.1v2.1H3.9z"/>
            </symbol>
          </defs>

          @for (l of links(); track l.id) {
            @if (nodeById(l.src_id); as a) {
              @if (nodeById(l.dst_id); as b) {
                <line [attr.x1]="cx(a)" [attr.y1]="cy(a)" [attr.x2]="cx(b)" [attr.y2]="cy(b)"
                      [attr.stroke]="linkColor(a,b)" stroke-width="2.4" stroke-dasharray="7 5"
                      style="cursor:pointer;pointer-events:stroke" (click)="delLink(l)"><title>{{ portInfo(l) }}</title></line>
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
              <rect [attr.width]="NW" height="64" rx="12" fill="#ffffff" [attr.stroke]="stroke(n)" [attr.stroke-width]="connectFrom() === n.id ? 3.5 : 1.6"></rect>
              <use [attr.href]="'#topo-ic-' + tipoDe(n)" x="13" y="11" width="15" height="15" [attr.fill]="stroke(n)"></use>
              <text x="34" y="22" font-size="12" font-weight="600" fill="#0b2239" [attr.textLength]="nameLen(n)" lengthAdjust="spacingAndGlyphs">{{ n.name }}</text>
              <text x="13" y="38" font-size="10.5" fill="#5b6b7b">{{ n.ip_address || 'sin IP' }}</text>
              <rect x="13" y="45" [attr.width]="statusText(n) === 'Online' ? 58 : 54" height="14" rx="7" [attr.fill]="chipFill(n)"></rect>
              <circle cx="22" cy="52" r="3.2" [attr.fill]="stroke(n)"></circle>
              <text x="29" y="55" font-size="9.5" font-weight="700" [attr.fill]="stroke(n)">{{ statusText(n) }}</text>
              <text [attr.x]="NW - 13" y="55" font-size="9" fill="#9aa8b6" text-anchor="end">{{ n.device_type }}</text>
            </g>
          }
        </svg>
      </div>
      <div class="zoombox">
        <button class="btn sm ghost" (click)="zoomBy(0.8)" title="Alejar"><i class="pi pi-minus"></i></button>
        <span style="font-size:12px;color:var(--c-mute);min-width:42px;text-align:center;font-variant-numeric:tabular-nums">{{ zoomPct() }}%</span>
        <button class="btn sm ghost" (click)="zoomBy(1.25)" title="Acercar"><i class="pi pi-plus"></i></button>
        <button class="btn sm ghost" (click)="zoomReset()" title="Restablecer"><i class="pi pi-refresh"></i></button>
      </div>
    </div>

    @if (panel(); as d) {
      <div class="overlay on" style="z-index:80" (click)="panel.set(null)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:81" (click)="panel.set(null)">
        <div class="panel" style="width:min(760px,96vw);max-height:86vh;overflow:auto;border-radius:16px" (click)="$event.stopPropagation()">
          <div class="ph">{{ d.name }} · <span style="color:var(--muted);font-weight:400">{{ d.device_type }} · {{ d.ip_address || 'sin IP' }}</span></div>
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
                      <button class="btn sm ghost" (click)="connectPort(p)"><i class="pi pi-link"></i> {{ linkFrom() && linkFrom()!.deviceId !== d.id ? 'Conectar aquí' : 'Conectar' }}</button>
                      <button class="btn sm ghost" (click)="delPort(p)" title="Borrar puerto"><i class="pi pi-trash"></i></button>
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
              <button class="btn sm" (click)="addPort()"><i class="pi pi-plus"></i> Agregar puerto</button>
            </div>
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;display:flex;justify-content:space-between;align-items:center">
            <button class="btn ghost" style="color:#dc2626;border-color:#f0b4b4" (click)="borrarEquipo(d)"><i class="pi pi-trash"></i> Borrar equipo</button>
            <button class="btn ghost" (click)="panel.set(null)">Cerrar</button>
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
  fullscreen = signal(true);
  autoSecs = 30;

  // ---- Alarma sonora de caidas (configurable, se guarda en el navegador) ----
  alarm = signal<AlarmCfg>(this.cargarAlarm());
  alarmCfgOpen = signal(false);
  caidas = signal<Caida[]>([]);        // caidas nuevas detectadas (hasta que vuelvan o se descarten)
  silenciado = signal(false);
  audioBloqueado = signal(false);      // el navegador exige un clic del usuario antes de reproducir audio
  readonly tiposAlarma = [
    { k: 'core', label: 'Core' },
    { k: 'borde', label: 'Borde / MikroTik / Cisco' },
    { k: 'olt', label: 'OLT' },
    { k: 'servidor', label: 'Servidor' },
    { k: 'otro', label: 'Otros' },
  ];
  private prevDown: Set<number> | null = null;
  private repTimer: any = null;
  private ctx: AudioContext | null = null;
  private baseTitle = typeof document !== 'undefined' ? document.title : '';

  nvName = ''; nvType = 'borde'; nvIp = '';
  npLabel = ''; npRole = 'lan';
  W = 2600; H = 1600;
  NW = 210;   // ancho de tarjeta de equipo (para que quepa el nombre completo)

  private dragId: number | null = null;
  private downNode: TopoNode | null = null;
  private offX = 0; private offY = 0; private moved = false; private startX = 0; private startY = 0;
  private timer: any = null;

  constructor() {
    // La nota (ej. "Enlace creado.") se auto-oculta para no quedarse encima del tablero.
    effect(() => { const n = this.note(); if (n) { setTimeout(() => { if (this.note() === n) this.note.set(''); }, 3500); } });
  }
  @HostListener('document:keydown.escape')
  onEsc() { if (this.alarmCfgOpen()) { this.alarmCfgOpen.set(false); return; } if (this.fullscreen()) this.fullscreen.set(false); }

  ngOnInit() {
    // Solo lee y refresca el estado (ping/caidas) cada autoSecs. La sincronizacion con el ERP la hace
    // el scheduler de fondo (cada ~5 min) y el boton Importar - NO en cada entrada, para no arrastrar
    // ni empujar equipos (evita duplicados).
    this.load();
    this.timer = setInterval(() => this.load(), this.autoSecs * 1000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); this.pararRepeticion(); this.ponerTitulo(0); }

  load() {
    this.api.topologia().subscribe((r: any) => {
      const nodes: TopoNode[] = (r?.nodes || []).map((n: any) => ({ ...n, vlan: n.vlan ?? null, x: 0, y: 0 }));
      this.layout(nodes);
      this.nodes.set(nodes);
      this.links.set(r?.links || []);
      this.evaluarCaidas(nodes);
    });
  }

  // =====================================================================
  //  ALARMA DE CAIDA
  //  - Se dispara cuando un equipo pasa de Online a Caido entre dos refrescos.
  //  - Configurable: volumen, tono, repeticion, tipos de equipo, aviso de recuperacion.
  //  - Sin archivos de audio: el tono se sintetiza con Web Audio (funciona sin internet).
  //  - El navegador bloquea el audio hasta el primer clic del usuario: se avisa en el banner.
  // =====================================================================
  private cargarAlarm(): AlarmCfg {
    const def: AlarmCfg = { on: false, vol: 70, tono: 'sirena', repetirSeg: 15, recuperacion: true, alInicio: false,
      tipos: { core: true, borde: true, olt: true, servidor: true, otro: true } };
    try {
      const raw = localStorage.getItem('klax.topo.alarma');
      if (raw) { const j = JSON.parse(raw); return { ...def, ...j, tipos: { ...def.tipos, ...(j.tipos || {}) } }; }
    } catch { /* sin storage: valores por defecto */ }
    return def;
  }
  private guardarAlarm() { try { localStorage.setItem('klax.topo.alarma', JSON.stringify(this.alarm())); } catch { /* ignorar */ } }
  setAlarm(p: Partial<AlarmCfg>) { this.alarm.update((a) => ({ ...a, ...p })); this.guardarAlarm(); if (p.repetirSeg !== undefined) this.reprogramarRepeticion(); }
  setTipo(t: string, v: boolean) { this.alarm.update((a) => ({ ...a, tipos: { ...a.tipos, [t]: !!v } })); this.guardarAlarm(); }
  setOn(v: boolean) {
    this.setAlarm({ on: !!v });
    if (v) { this.ensureCtx(); this.tocar(this.alarm().tono, this.alarm().vol, 0.35); }
    else this.pararRepeticion();
  }
  toggleAlarma() {
    const on = !this.alarm().on;
    this.setOn(on);
    this.note.set(on ? 'Alarma sonora activada.' : 'Alarma sonora desactivada.');
  }
  probarAlarma() { this.ensureCtx(); this.tocar(this.alarm().tono, this.alarm().vol); }
  silenciar() { this.silenciado.set(true); this.pararRepeticion(); }
  descartarCaidas() { this.caidas.set([]); this.silenciado.set(false); this.pararRepeticion(); this.ponerTitulo(0); }
  nombresCaidas() { return this.caidas().map((c) => c.name + ' (' + c.desde + ')').join(', '); }

  @HostListener('document:pointerdown')
  onPointer() { if (this.audioBloqueado() || this.alarm().on) this.ensureCtx(); }

  /** Agrupa el device_type en las categorias que usan la alarma y los iconos del tablero. */
  tipoDe(n: TopoNode): string {
    const t = (n.device_type || '').toLowerCase();
    if (t === 'mikrotik' || t === 'cisco' || t === 'borde') return 'borde';
    if (t === 'core' || t === 'olt' || t === 'servidor') return t;
    return 'otro';
  }
  private esDown(n: TopoNode) { return (n.status || '').toLowerCase() === 'down'; }

  private evaluarCaidas(nodes: TopoNode[]) {
    const cfg = this.alarm();
    const down = new Set(nodes.filter((n) => this.esDown(n)).map((n) => n.id));
    if (this.prevDown === null) {
      // Primer refresco: lo que ya estaba caido al abrir no dispara la alarma (salvo que se pida).
      this.prevDown = down;
      if (cfg.alInicio) this.registrarCaidas(nodes.filter((n) => down.has(n.id) && cfg.tipos[this.tipoDe(n)]));
      return;
    }
    const prev = this.prevDown;
    const nuevas = nodes.filter((n) => down.has(n.id) && !prev.has(n.id) && cfg.tipos[this.tipoDe(n)]);
    const volvieron = this.caidas().filter((c) => !down.has(c.id));
    this.prevDown = down;
    if (volvieron.length) {
      this.caidas.update((l) => l.filter((c) => down.has(c.id)));
      this.note.set('Recuperado: ' + volvieron.map((c) => c.name).join(', '));
      if (cfg.on && cfg.recuperacion) this.tocarRecuperacion(cfg.vol);
      if (!this.caidas().length) { this.pararRepeticion(); this.silenciado.set(false); }
    }
    if (nuevas.length) this.registrarCaidas(nuevas);
    this.ponerTitulo(this.caidas().length);
  }
  private registrarCaidas(nuevas: TopoNode[]) {
    if (!nuevas.length) return;
    const hora = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    this.caidas.update((l) => [...l, ...nuevas.filter((n) => !l.some((c) => c.id === n.id)).map((n) => ({ id: n.id, name: n.name, desde: hora }))]);
    this.silenciado.set(false);
    this.ponerTitulo(this.caidas().length);
    if (this.alarm().on) { this.sonar(); this.reprogramarRepeticion(); }
  }
  private sonar() {
    const c = this.alarm();
    if (!c.on || this.silenciado() || !this.caidas().length) return;
    this.tocar(c.tono, c.vol);
  }
  private reprogramarRepeticion() {
    this.pararRepeticion();
    const seg = this.alarm().repetirSeg;
    if (seg > 0 && this.caidas().length && this.alarm().on && !this.silenciado())
      this.repTimer = setInterval(() => this.sonar(), seg * 1000);
  }
  private pararRepeticion() { if (this.repTimer) { clearInterval(this.repTimer); this.repTimer = null; } }
  private ponerTitulo(n: number) {
    try { document.title = n > 0 ? '(' + n + ') Caída · ' + this.baseTitle : this.baseTitle; } catch { /* ignorar */ }
  }

  // --- Web Audio: tonos sintetizados (sin archivos de audio) ---
  private ensureCtx(): AudioContext | null {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx!.state === 'suspended') this.ctx!.resume().then(() => this.audioBloqueado.set(this.ctx!.state !== 'running'));
      this.audioBloqueado.set(this.ctx!.state !== 'running');
      return this.ctx;
    } catch { return null; }
  }
  private tocar(tono: string, vol: number, escala = 1) {
    const ctx = this.ensureCtx(); if (!ctx) return;
    if (ctx.state !== 'running') { this.audioBloqueado.set(true); return; }
    const v = Math.max(0, Math.min(1, vol / 100)) * 0.35 * escala;
    if (v <= 0) return;
    const t0 = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.connect(ctx.destination);
    const o = ctx.createOscillator(); o.connect(g);
    if (tono === 'beep') {
      o.type = 'square'; o.frequency.setValueAtTime(880, t0);
      for (let i = 0; i < 4; i++) { g.gain.setValueAtTime(v, t0 + i * 0.35); g.gain.setValueAtTime(0, t0 + i * 0.35 + 0.18); }
      o.start(t0); o.stop(t0 + 1.5);
    } else if (tono === 'campana') {
      o.type = 'sine'; o.frequency.setValueAtTime(1318, t0);
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      o.start(t0); o.stop(t0 + 1.7);
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(1318 * 1.5, t0);
      g2.gain.setValueAtTime(v * 0.4, t0); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      o2.connect(g2); g2.connect(ctx.destination); o2.start(t0); o2.stop(t0 + 1.1);
    } else {   // sirena
      o.type = 'sawtooth';
      for (let i = 0; i < 3; i++) {
        o.frequency.setValueAtTime(600, t0 + i * 0.8);
        o.frequency.linearRampToValueAtTime(950, t0 + i * 0.8 + 0.4);
        o.frequency.linearRampToValueAtTime(600, t0 + i * 0.8 + 0.8);
      }
      g.gain.setValueAtTime(v, t0); g.gain.setValueAtTime(v, t0 + 2.3); g.gain.linearRampToValueAtTime(0, t0 + 2.4);
      o.start(t0); o.stop(t0 + 2.45);
    }
  }
  private tocarRecuperacion(vol: number) {
    const ctx = this.ensureCtx(); if (!ctx || ctx.state !== 'running') return;
    const v = Math.max(0, Math.min(1, vol / 100)) * 0.3; if (v <= 0) return;
    const t0 = ctx.currentTime;
    [[523, 0], [659, 0.18], [784, 0.36]].forEach(([f, d]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f, t0 + d);
      g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(v, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.35);
      o.connect(g); g.connect(ctx.destination); o.start(t0 + d); o.stop(t0 + d + 0.4);
    });
  }

  private layout(nodes: TopoNode[]) {
    const order = ['core', 'borde', 'mikrotik', 'cisco', 'olt', 'servidor'];
    const perRow = Math.max(1, Math.floor((this.W - 80) / (this.NW + 30)));
    const rowH = 64 + 46;                       // alto de tarjeta + separacion
    const auto: Record<string, TopoNode[]> = {};
    for (const n of nodes) {
      if (n.topo_x != null && n.topo_y != null) { n.x = n.topo_x; n.y = n.topo_y; continue; }
      (auto[n.device_type || 'otro'] ||= []).push(n);
    }
    const types = [...order.filter((t) => auto[t]), ...Object.keys(auto).filter((t) => !order.includes(t))];
    let y = 96;
    for (const t of types) {
      const arr = auto[t];
      arr.forEach((n, i) => { n.x = 40 + (i % perRow) * (this.NW + 30); n.y = y + Math.floor(i / perRow) * rowH; });
      y += Math.ceil(arr.length / perRow) * rowH + 26;   // separacion entre grupos de tipo
    }
    this.H = Math.max(1000, y + 40);            // el lienzo crece con las filas que hagan falta
  }

  upCount() { return this.nodes().filter((n) => (n.status || '').toLowerCase() === 'up').length; }
  downCount() { return this.nodes().filter((n) => (n.status || '').toLowerCase() === 'down').length; }

  nodeById(id: number) { return this.nodes().find((n) => n.id === id) || null; }
  cx(n: TopoNode) { return n.x + this.NW / 2; }
  cy(n: TopoNode) { return n.y + 32; }
  lx(a: TopoNode, b: TopoNode, t: number) { return this.cx(a) + t * (this.cx(b) - this.cx(a)); }
  ly(a: TopoNode, b: TopoNode, t: number) { return this.cy(a) + t * (this.cy(b) - this.cy(a)); }
  portInfo(l: any): string {
    const a = l.src_port_label, b = l.dst_port_label;
    if (a || b) return (a || '?') + ' ↔ ' + (b || '?') + ' · clic para borrar';
    return 'Enlace sin puertos definidos · reconéctalo por puerto · clic para borrar';
  }
  nameLen(n: TopoNode): number | null {
    const w = (n.name || '').length * 7;
    const max = this.NW - 47;                   // deja lugar al icono y al margen derecho
    return w > max ? max : null;                // solo limita si se pasaria del ancho
  }
  pillW(label: string | null) { return (label || '').length * 6 + 12; }
  statusText(n: TopoNode) { const s = (n.status || '').toLowerCase(); return s === 'up' ? 'Online' : s === 'down' ? 'Caído' : '?'; }
  stroke(n: TopoNode) { const s = (n.status || '').toLowerCase(); return s === 'up' ? '#16a34a' : s === 'down' ? '#dc2626' : '#94a3b8'; }
  chipFill(n: TopoNode) { const s = (n.status || '').toLowerCase(); return s === 'up' ? '#e8f7ee' : s === 'down' ? '#fdecec' : '#eef1f4'; }
  linkColor(a: TopoNode, b: TopoNode) {
    const down = (a.status || '').toLowerCase() === 'down' || (b.status || '').toLowerCase() === 'down';
    return down ? '#dc2626' : '#16a34a';
  }
  roleColor(r: string | null) {
    const x = (r || '').toLowerCase();
    return x === 'wan' || x === 'uplink' ? '#dc2626' : x === 'lan' || x === 'access' ? '#16a34a'
      : x === 'trunk' ? '#d97706' : x === 'mgmt' ? '#2563eb' : '#64748b';
  }

  toggleConnect() { this.connectMode.update((v) => !v); this.connectFrom.set(null); this.linkFrom.set(null); this.note.set(this.connectMode() ? 'Modo conectar: tocá un equipo y elegí el puerto a enlazar.' : ''); }
  toggleFull() { this.fullscreen.update((v) => !v); }
  importar() { this.note.set('Importando del ERP…'); this.api.syncCheck().subscribe({ next: () => { this.note.set('Equipos actualizados.'); this.load(); }, error: () => this.load() }); }

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
    n.x = Math.max(0, Math.min(this.W - this.NW, (ev.clientX - r.left) / z - this.offX));
    n.y = Math.max(0, Math.min(this.H - 64, (ev.clientY - r.top) / z - this.offY));
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
    // Conexion SIEMPRE por puerto: abre el panel del equipo para elegir el puerto a enlazar.
    this.openDevice(n);
    this.note.set(this.linkFrom()
      ? 'Elegí el puerto de ' + n.name + ' y tocá "Conectar aquí".'
      : 'Elegí el puerto de ' + n.name + ' y tocá "Conectar".');
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
  borrarEquipo(d: any) {
    if (!d) return;
    if (!confirm('¿Borrar el equipo "' + d.name + '" del NOC de forma permanente?')) return;
    this.api.deleteDevice(d.id).subscribe({
      next: () => { this.panel.set(null); this.note.set('Equipo "' + d.name + '" borrado.'); this.load(); },
      error: (e: any) => this.note.set(e?.error?.mensaje || e?.message || 'No se pudo borrar el equipo.'),
    });
  }
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
