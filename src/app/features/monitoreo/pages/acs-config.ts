import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';
import { NocNotify } from '../services/noc-notify';

/** Configuración del ACS (TR-069): URL pública para el router, switch de escritura,
 *  intervalos, y "empujar config" de gestión a un CPE. */
@Component({
  selector: 'app-acs-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tools"><span style="font-weight:700;font-size:16px">📶 Configurar ACS <span class="mini">TR-069</span></span></div>

    <div class="panel"><div class="pb">
      <div class="sec">URL del ACS — esto es lo que va en el router</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input class="inp" style="flex:1;min-width:240px" [(ngModel)]="cfg.acs_public_url" placeholder="http://tu-noc:8085">
        <button class="btn sm" (click)="save()">Guardar URL</button>
      </div>
      <div class="mini" style="margin-top:8px">ACS URL para el CPE:
        <b class="mono">{{ cfg.acs_url }}</b>
        <button class="btn sm ghost" (click)="copiar(cfg.acs_url)">📋 Copiar</button></div>

      <div class="sec" style="margin-top:16px">Parámetros</div>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;cursor:pointer">
        <input type="checkbox" [(ngModel)]="cfg.write_enabled"> Escritura habilitada (reboot / cambiar WiFi)
      </label>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div class="fld"><label>Intervalo de Inform (seg)</label>
          <input class="inp" type="number" [(ngModel)]="cfg.inform_interval_seconds"></div>
        <div class="fld"><label>Expiración de tareas (seg)</label>
          <input class="inp" type="number" [(ngModel)]="cfg.task_ttl_seconds"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn" (click)="save()">💾 Guardar configuración</button>
        @if (msg()) { <span style="margin-left:10px;color:#2563eb">{{ msg() }}</span> }
      </div>
    </div></div>

    <div class="panel"><div class="pb">
      <div class="sec">Empujar config de gestión a un router</div>
      <div class="mini">Le manda al CPE su ACS URL + el intervalo por TR-069 (se aplica en el próximo contacto).
        Sirve para estandarizar un router sin entrar a su interfaz. Requiere el contrato del cliente y la escritura habilitada.</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
        <input class="inp" style="width:200px" [(ngModel)]="contrato" placeholder="Contrato del cliente">
        <button class="btn sm" (click)="push()">Empujar config</button>
        @if (pushMsg()) { <span style="color:#2563eb">{{ pushMsg() }}</span> }
      </div>
    </div></div>

    <div class="panel"><div class="pb">
      <div class="sec" style="display:flex;align-items:center;gap:8px">📶 Routers registrados en el ACS
        <span class="mini">{{ devices().length }} equipo(s)</span>
        <button class="btn sm ghost" style="margin-left:auto" (click)="loadDevices()">🔄 Actualizar</button></div>
      @if (devices().length) {
        <div style="overflow:auto;margin-top:6px">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr style="text-align:left;color:var(--muted)">
              <th style="padding:6px 8px">Estado</th><th style="padding:6px 8px">Equipo</th>
              <th style="padding:6px 8px">Serie</th><th style="padding:6px 8px">Contrato</th>
              <th style="padding:6px 8px">IP KLAX</th><th style="padding:6px 8px">Firmware</th><th style="padding:6px 8px">Modelo datos</th>
              <th style="padding:6px 8px">Último Inform</th><th style="padding:6px 8px">ConnReq</th></tr></thead>
            <tbody>
              @for (d of devices(); track d.id) {
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:6px 8px"><span [style.display]="'inline-block'" [style.width.px]="8" [style.height.px]="8" [style.borderRadius.%]="50" [style.marginRight.px]="6" [style.background]="dOnline(d) ? '#16a34a' : '#9ca3af'"></span>{{ d.status || '—' }}</td>
                  <td style="padding:6px 8px"><b>{{ d.manufacturer || '—' }}</b> {{ d.modelName || '' }}</td>
                  <td style="padding:6px 8px" class="mono">{{ d.serialNumber || '—' }}</td>
                  <td style="padding:6px 8px" class="mono">
                    @if (d.contrato) { {{ d.contrato }} }
                    @else {
                      <input [(ngModel)]="asignar[d.id]" placeholder="contrato" style="width:88px;padding:2px 6px;font-size:12px;border:1px solid var(--border);border-radius:6px">
                      <button class="btn sm" style="padding:2px 8px;margin-left:4px" (click)="asignarContrato(d)">✔</button>
                    }
                  </td>
                  <td style="padding:6px 8px" class="mono">{{ d.ipKlax || '—' }}</td>
                  <td style="padding:6px 8px" class="mono">{{ d.softwareVersion || '—' }}</td>
                  <td style="padding:6px 8px">{{ d.dataModel || '—' }}</td>
                  <td style="padding:6px 8px;font-size:11.5px">{{ d.lastInformAt || '—' }}</td>
                  <td style="padding:6px 8px">{{ d.hasConnReq ? '✔' : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="mini" style="margin-top:8px;color:var(--muted)">Todavía ningún router hizo Inform. Apunta un CPE al ACS URL de arriba y aparecerá aquí en el próximo contacto.</div>
      }
    </div></div>

    <div class="panel"><div class="pb">
      <div class="sec">Cómo apuntar un router al ACS</div>
      <div class="mini" style="line-height:1.7">
        En la página TR-069 / CWMP / “Gestión remota” del router:<br>
        · <b>ACS URL</b>: la de arriba · <b>Periodic Inform</b>: ON, intervalo {{ cfg.inform_interval_seconds }} s<br>
        · Usuario/clave del ACS: por ahora se pueden dejar vacíos (endpoint abierto en el MVP; se protege con TLS+auth luego).<br>
        A escala se aprovisiona desde la OLT (perfil TR-069 de la ONU) o config por defecto del router.
      </div>
    </div></div>
  `,
})
export class AcsConfig implements OnInit {
  private api = inject(NocApi);
  private notify = inject(NocNotify);
  cfg: any = { acs_public_url: '', acs_url: '', write_enabled: false, inform_interval_seconds: 900, task_ttl_seconds: 86400 };
  msg = signal(''); pushMsg = signal(''); contrato = '';
  devices = signal<any[]>([]);
  asignar: any = {};

  ngOnInit() { this.load(); this.loadDevices(); }
  load() { this.api.acsConfig().subscribe((c) => (this.cfg = c)); }
  save() {
    this.api.acsSaveConfig(this.cfg).subscribe({
      next: (c) => { this.cfg = c; this.msg.set('✅ Guardado'); setTimeout(() => this.msg.set(''), 2500); this.notify.ok('Configuración del ACS guardada.'); },
      error: (e: any) => this.notify.error(e?.message || 'No se pudo guardar la configuración del ACS.'),
    });
  }
  push() {
    if (!this.contrato.trim()) { this.pushMsg.set('Escribe el contrato del cliente.'); return; }
    this.api.acsPushMgmt(this.contrato.trim(), {}).subscribe({
      next: () => this.pushMsg.set('✅ Config encolada para el router'),
      error: (e) => this.pushMsg.set('⚠ ' + (e?.error?.mensaje || 'No se pudo encolar')),
    });
  }
  loadDevices() { this.api.acsDevices().subscribe((d) => this.devices.set(d || [])); }
  asignarContrato(d: any) {
    const c = (this.asignar[d.id] || '').trim();
    if (!c) return;
    this.api.acsAsignarContrato(d.id, c).subscribe({
      next: () => { this.msg.set('✅ Contrato asignado'); setTimeout(() => this.msg.set(''), 2000); this.asignar[d.id] = ''; this.loadDevices(); },
      error: (e: any) => this.msg.set('⚠ ' + (e?.error?.mensaje || 'No se pudo asignar el contrato')),
    });
  }
  dOnline(d: any): boolean { return String(d?.status || '').toLowerCase() === 'online'; }
  copiar(v: string) { navigator.clipboard?.writeText(v || ''); this.msg.set('📋 Copiado'); setTimeout(() => this.msg.set(''), 1500); }
}
