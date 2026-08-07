import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccesoService } from '../../../core/services/acceso.service';
import { NocApi, Device, OltMarca } from '../services/noc-api';
import { NocNotify } from '../services/noc-notify';
import { cpuColor } from '../shared/charts';
import { TableSort } from '../shared/table-sort';

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tools">
      @if (showBack()) { <button class="btn ghost sm" (click)="back()" title="Volver">← Atrás</button> }
      <input class="inp" style="min-width:240px" placeholder="🔍 Buscar equipo, IP, zona..." [(ngModel)]="q" />
      <span class="chip" [class.on]="filter()==='all'" (click)="filter.set('all')">Todos</span>
      <span class="chip" [class.on]="filter()==='core'" (click)="filter.set('core')">Core</span>
      <span class="chip" [class.on]="filter()==='borde'" (click)="filter.set('borde')">Borde</span>
      <span class="chip" [class.on]="filter()==='down'" (click)="filter.set('down')">Down</span>
      <button class="btn ghost" style="margin-left:auto" (click)="sincronizar()" [disabled]="sincronizando()" title="Traer las OLT/equipos del ERP y enlazarlos en el NOC (erp_olt_id)">{{ sincronizando() ? '⏳ Sincronizando…' : '↻ Sincronizar ERP' }}</button>
      <button class="btn" (click)="nuevo()">+ Nuevo equipo</button>
    </div>

    <div class="panel">
      <table>
        <thead><tr>
          <th class="srt" (click)="sort.by('nombre')">Nombre NOC{{ sort.arrow('nombre') }}</th>
          <th class="srt" (click)="sort.by('vendor')">Vendor{{ sort.arrow('vendor') }}</th>
          <th class="srt" (click)="sort.by('zona')">Zona{{ sort.arrow('zona') }}</th>
          <th class="srt" (click)="sort.by('tipo')">Tipo{{ sort.arrow('tipo') }}</th>
          <th class="srt" (click)="sort.by('ip')">IP{{ sort.arrow('ip') }}</th>
          <th class="srt" (click)="sort.by('estado')">Estado{{ sort.arrow('estado') }}</th>
          <th class="srt" (click)="sort.by('cpu')">CPU{{ sort.arrow('cpu') }}</th>
          <th class="srt" (click)="sort.by('ping')">Ping{{ sort.arrow('ping') }}</th>
          @if (esSupervisor()) { <th style="width:96px;text-align:right">Acciones</th> }
        </tr></thead>
        <tbody>
          @for (d of rows(); track d.id) {
            <tr class="clk" (click)="open(d)">
              <td><b>{{ d.name }}</b></td>
              <td>{{ d.vendor }}</td>
              <td>{{ d.zone || '—' }}</td>
              <td>@if (d.device_type==='core') { <span class="badge b-ack">CORE</span> } @else if (d.device_type==='olt') { <span class="badge b-olt">OLT</span> } @else if (d.device_type==='borde') { <span class="badge b-borde">BORDE</span> } @else { <span class="badge b-maint">{{ d.device_type }}</span> }</td>
              <td class="mono">{{ d.ip_address }}</td>
              <td [innerHTML]="badge(d.status)"></td>
              <td>@if (d.status==='up' && d.snmp_enabled && d.cpu_percent!=null) { <b [style.color]="cpuColor(d.cpu_percent)">{{ d.cpu_percent }}%</b> } @else { <span style="color:var(--muted)" title="Requiere SNMP habilitado para leer CPU real">—</span> }</td>
              <td>@if (d.ping_ms!=null) { {{ d.ping_ms }} ms } @else { <span style="color:var(--red)">timeout</span> }</td>
              @if (esSupervisor()) {
                <td style="text-align:right;white-space:nowrap" (click)="$event.stopPropagation()">
                  <button class="btn ghost sm" title="Editar equipo" (click)="editar(d)">✎</button>
                  <button class="btn ghost sm" style="margin-left:4px;color:var(--red)" title="Eliminar equipo" (click)="pedirBorrar(d)">🗑</button>
                </td>
              }
            </tr>
          } @empty {
            <tr><td [attr.colspan]="esSupervisor() ? 9 : 8" style="text-align:center;color:var(--muted);padding:34px">
              {{ loaded() ? 'No hay equipos. Usa "+ Nuevo equipo".' : 'Cargando… (si no aparece, revisa que el backend corra en :8081).' }}
            </td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (showAdd()) {
      <div class="overlay on" (click)="showAdd.set(false)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="showAdd.set(false)">
        <div class="panel" style="width:520px;max-width:92vw" (click)="$event.stopPropagation()">
          <div class="ph">{{ f.id ? 'Editar equipo' : 'Agregar equipo' }}</div>
          <div class="pb" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="grid-column:1/3"><label class="k">Nombre NOC</label><input class="inp" style="width:100%" [(ngModel)]="f.name"></div>
            @if (f.device_type === 'olt') {
              <div style="grid-column:1/3"><label class="k">Tipo de OLT</label>
                <select class="inp" style="width:100%" [(ngModel)]="f.id_red_olt_marca" (ngModelChange)="applyMarca($event)">
                  <option [ngValue]="undefined">— Selecciona la marca —</option>
                  @for (m of marcas(); track m.idRedOltMarca) {
                    <option [ngValue]="m.idRedOltMarca">{{ m.marca }}</option>
                  }
                </select>
              </div>
            } @else {
              <div><label class="k">Vendor</label><button type="button" class="inp" style="width:100%;text-align:left;cursor:pointer" (click)="openPicker('vendor')">{{ f.vendor || '— Elegir marca —' }}</button></div>
              <div><label class="k">Modelo</label><button type="button" class="inp" style="width:100%;text-align:left;cursor:pointer" (click)="openPicker('model')">{{ f.model || '— Elegir modelo —' }}</button></div>
            }
            <div><label class="k">Tipo</label>
              <select class="inp" style="width:100%" [(ngModel)]="f.device_type"><option value="borde">Borde</option><option value="core">Core</option><option value="olt">OLT</option></select></div>
            <div><label class="k">Zona</label><input class="inp" style="width:100%" [(ngModel)]="f.zone"></div>
            <div><label class="k">IP</label><input class="inp" style="width:100%" [(ngModel)]="f.ip_address"></div>
            <div><label class="k">Community SNMP</label><input class="inp" style="width:100%" [(ngModel)]="f.snmp_community"></div>
            <div><label class="k">SNMP puerto</label><input type="number" class="inp" style="width:100%" [(ngModel)]="f.snmp_port" placeholder="161"></div>
            <div><label class="k">Versión SNMP</label><select class="inp" style="width:100%" [(ngModel)]="f.snmp_version"><option value="v2c">v2c</option><option value="v1">v1</option><option value="v3">v3</option></select></div>
            <div style="grid-column:1/3;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <input type="checkbox" [(ngModel)]="f.snmp_enabled"> <span>Habilitar SNMP</span>
              <button type="button" class="btn ghost sm" style="margin-left:auto" (click)="probarSnmp()" [disabled]="probandoSnmp()">{{ probandoSnmp() ? 'Probando…' : '🔌 Probar SNMP' }}</button></div>

            @if (f.device_type === 'olt') {
              <div><label class="k">Telnet usuario</label><input class="inp" style="width:100%" [(ngModel)]="f.telnet_user"></div>
              <div><label class="k">Telnet clave</label><input type="password" class="inp" style="width:100%" [(ngModel)]="f.telnet_pass"></div>
              <div><label class="k">Telnet puerto</label><input type="number" class="inp" style="width:100%" [(ngModel)]="f.telnet_port" placeholder="23"></div>
              <div style="display:flex;align-items:center;gap:8px;padding-top:20px"><input type="checkbox" [(ngModel)]="f.snmp_poll_enabled"> <span>Barrido SNMP automático</span></div>
              <div><label class="k">Intervalo barrido (seg)</label><input type="number" class="inp" style="width:100%" [(ngModel)]="f.snmp_poll_seconds" placeholder="300"></div>
            }
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;justify-content:flex-end">
            <button class="btn ghost" (click)="showAdd.set(false)">Cancelar</button>
            <button class="btn" (click)="save()">Guardar</button>
          </div>
        </div>
      </div>
    }

    @if (picker()) {
      <div class="overlay on" style="z-index:70" (click)="picker.set(null)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:71" (click)="picker.set(null)">
        <div class="panel" style="width:340px;max-width:92vw" (click)="$event.stopPropagation()">
          <div class="ph">{{ picker()==='vendor' ? 'Marca del equipo' : 'Modelo del equipo' }}</div>
          <div class="pb" style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow:auto">
            @for (o of pickerOpts(); track o) {
              <button type="button" class="btn ghost" [class.on]="o === (picker()==='vendor' ? f.vendor : f.model)" style="justify-content:flex-start" (click)="choosePicker(o)">{{ o }}</button>
            }
            @if (pickerOpts().length === 0) { <div style="color:var(--muted);font-size:12px">Aún no hay valores registrados. Escribe uno nuevo abajo.</div> }
            <div style="display:flex;gap:6px;margin-top:6px">
              <input class="inp" style="flex:1" placeholder="Otro / nuevo…" [(ngModel)]="pickerCustom">
              <button class="btn" (click)="choosePicker(pickerCustom)">Usar</button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (testing()) {
      <div class="overlay on" style="z-index:90"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:91">
        <div class="panel" style="width:380px;text-align:center">
          <div class="pb" style="padding:32px 24px">
            <div style="font-size:32px;margin-bottom:14px">⏳</div>
            <div style="font-weight:600;font-size:15px;line-height:1.7">Probando conexión Telnet<br>Espere Por Favor</div>
          </div>
        </div>
      </div>
    }
    @if (saveErr()) {
      <div class="overlay on" style="z-index:96" (click)="saveErr.set('')"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:97" (click)="saveErr.set('')">
        <div class="panel" style="width:440px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">⚠️</div>
            <div style="font-weight:600;font-size:14px;line-height:1.7;color:var(--red)">No se pudo completar la operación</div>
            <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:8px">{{ saveErr() }}</div>
            <div style="display:flex;justify-content:center;margin-top:16px">
              <button class="btn" (click)="saveErr.set('')">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    }
    @if (borrar()) {
      <div class="overlay on" style="z-index:94" (click)="borrar.set(null)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:95" (click)="borrar.set(null)">
        <div class="panel" style="width:420px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">🗑</div>
            <div style="font-weight:600;font-size:15px;line-height:1.7">Eliminar equipo</div>
            <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:8px">
              Se eliminará <b>{{ borrar()?.name }}</b> ({{ borrar()?.ip_address }}) del <b>ERP y del NOC</b>.
              Esta acción no se puede deshacer.
            </div>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
              <button class="btn ghost" (click)="borrar.set(null)">Cancelar</button>
              <button class="btn" style="background:var(--red);border-color:var(--red)" (click)="confirmarBorrar()">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    }
    @if (dupErr()) {
      <div class="overlay on" style="z-index:92" (click)="dupErr.set(false)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:93" (click)="dupErr.set(false)">
        <div class="panel" style="width:400px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">⚠️</div>
            <div style="font-weight:600;font-size:15px;line-height:1.7">Equipo Ya Agregado</div>
            <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:8px">
              Ya existe un equipo registrado con la IP <b>{{ f.ip_address }}</b> y el puerto <b>{{ f.snmp_port || 161 }}</b>.
            </div>
            <div style="display:flex;justify-content:center;margin-top:16px">
              <button class="btn" (click)="dupErr.set(false)">Entendido</button>
            </div>
          </div>
        </div>
      </div>
    }
    @if (testErr()) {
      <div class="overlay on" style="z-index:90" (click)="testErr.set('')"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:91" (click)="testErr.set('')">
        <div class="panel" style="width:440px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">⚠️</div>
            <div style="font-weight:600;font-size:14px;line-height:1.7;color:var(--red)">Sin conexión Telnet a la OLT</div>
            <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:8px">{{ testErr() }}</div>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
              <button class="btn ghost" (click)="testErr.set('')">Corregir</button>
              <button class="btn" (click)="doSave()">Guardar igual</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class Equipos implements OnDestroy {
  private api = inject(NocApi);
  private notify = inject(NocNotify);
  probandoSnmp = signal(false);
  /** Prueba SNMP en vivo del equipo con la community/puerto/version del formulario. */
  probarSnmp() {
    if (!this.f.ip_address) { this.notify.error('Escribe la IP del equipo antes de probar SNMP.'); return; }
    this.probandoSnmp.set(true);
    this.api.testSnmp({ host: this.f.ip_address, port: this.f.snmp_port || 161, community: this.f.snmp_community || 'public', version: this.f.snmp_version || 'v2c' }).subscribe({
      next: (r: any) => {
        this.probandoSnmp.set(false);
        if (r?.ok) this.notify.ok((r.sysName ? r.sysName + '\n' : '') + 'El equipo responde por SNMP. Marca “Habilitar SNMP” y guarda para que empiece a recolectar CPU/memoria/uptime.', 'SNMP OK');
        else this.notify.error(r?.error || 'El equipo no respondió por SNMP.', 'SNMP sin respuesta');
      },
      error: (e: any) => { this.probandoSnmp.set(false); this.notify.error(e?.message || 'No se pudo ejecutar la prueba SNMP.'); },
    });
  }
  private acceso = inject(AccesoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private timer: any;
  cpuColor = cpuColor;
  showBack = signal(this.route.snapshot.queryParamMap.get('back') === '1');
  back() { history.back(); }

  devices = signal<Device[]>([]);
  loaded = signal(false);
  q = '';
  filter = signal<'all' | 'core' | 'borde' | 'down'>('all');
  showAdd = signal(false);
  testing = signal(false);
  testErr = signal('');
  dupErr = signal(false);       // equipo repetido (misma IP + puerto)
  saveErr = signal('');         // error al guardar/eliminar (NO es un fallo de Telnet)
  borrar = signal<Device | null>(null);   // equipo pendiente de confirmar borrado
  sincronizando = signal(false);           // sync ERP->NOC en curso

  /**
   * Editar y eliminar equipos quedan reservados a nivel supervisor:
   * administrador de la organización o privilegio de empresa NOC_EQUIPOS_ADMIN.
   *
   * OJO: esto solo OCULTA los botones. El control real tiene que estar en el
   * servidor (ver nota al pie de este archivo); el front no es una barrera de
   * seguridad, solo evita que un operador se equivoque.
   */
  esSupervisor = computed(() => this.acceso.esSupervisorEquipos());
  f: any = { device_type: 'borde', snmp_community: 'public', snmp_version: 'v2c', snmp_enabled: true, snmp_poll_enabled: true, snmp_poll_seconds: 300 };
  marcas = signal<OltMarca[]>([]);   // marcas del ERP (kxt_red_olt_marca) para "Tipo de OLT"

  // Picker de Vendor/Modelo (foto 4): la lista sale de lo YA registrado en los equipos.
  picker = signal<null | 'vendor' | 'model'>(null);
  pickerCustom = '';
  vendorOpts = computed(() => Array.from(new Set(this.devices().map((d) => d.vendor).filter((v) => !!v && String(v).trim() !== ''))).sort());
  modelOpts = computed(() => Array.from(new Set(this.devices().map((d: any) => d.model).filter((v: any) => !!v && String(v).trim() !== ''))).sort());
  pickerOpts = computed(() => (this.picker() === 'vendor' ? this.vendorOpts() : this.modelOpts()));
  openPicker(which: 'vendor' | 'model') { this.pickerCustom = ''; this.picker.set(which); }
  choosePicker(v: string) { if (!v || !String(v).trim()) return; if (this.picker() === 'vendor') this.f.vendor = v; else this.f.model = v; this.picker.set(null); }

  constructor() {
    this.load();
    this.api.catalogoMarcas().subscribe((m) => this.marcas.set(m || []));
    // Auto-refresco cada 15s (la pantalla se mantiene viva).
    this.timer = setInterval(() => this.load(), 15000);
  }

  /** Al elegir la marca del ERP, guarda su id y refleja el nombre en vendor (llave del motor). */
  applyMarca(id: any) {
    const m = this.marcas().find((x) => x.idRedOltMarca === id);
    if (!m) return;
    this.f.vendor = m.marca;
  }

  ngOnDestroy(): void { clearInterval(this.timer); }

  load() {
    this.api.devices().subscribe({
      next: (d) => { this.devices.set(d); this.loaded.set(true); },
      error: () => this.loaded.set(true),
    });
  }

  /** Trae del ERP el catalogo de OLT/equipos y los enlaza en el NOC (erp_olt_id). */
  sincronizar() {
    if (this.sincronizando()) return;
    this.sincronizando.set(true);
    this.api.syncCheck().subscribe({
      next: () => { this.sincronizando.set(false); this.load(); this.notify.ok('Sincronización con el ERP completada.'); },
      error: (e) => { this.sincronizando.set(false); this.notify.error('No se pudo sincronizar con el ERP: ' + (e?.message || 'error')); },
    });
  }

  sort = new TableSort<Device>({
    nombre: (d) => d.name,
    vendor: (d) => d.vendor,
    zona: (d) => d.zone,
    tipo: (d) => d.device_type,
    ip: (d) => d.ip_address,
    estado: (d) => d.status,
    cpu: (d) => d.cpu_percent,
    ping: (d) => d.ping_ms,
  }, 'nombre');

  view(): Device[] {
    const q = this.q.toLowerCase().trim();
    return this.devices().filter((d) => {
      if (this.filter() === 'core' && d.device_type !== 'core') return false;
      if (this.filter() === 'borde' && d.device_type !== 'borde') return false;
      if (this.filter() === 'down' && d.status === 'up') return false;
      if (q && !(`${d.name} ${d.ip_address} ${d.zone}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  /** Lista filtrada + ordenada por la cabecera elegida. */
  rows(): Device[] { return this.sort.apply(this.view()); }

  badge(s: string): string {
    if (s === 'up') return '<span class="badge b-up">UP</span>';
    if (s === 'down') return '<span class="badge b-down">DOWN</span>';
    return '<span class="badge b-maint">UNKNOWN</span>';
  }

  open(d: Device) { this.router.navigate(['/app/monitoreo/equipos', d.id]); }

  /** Abre el mismo modal del alta, precargado. El id en 'f' marca que es edición. */
  editar(d: Device) {
    this.f = { ...(d as any) };
    this.testErr.set(''); this.dupErr.set(false); this.saveErr.set('');
    this.showAdd.set(true);
    // Si es OLT, prefila telnet/barrido/community desde su fila en kxt_olt (lo que usa el
    // motor). Emparejar por NOMBRE (único): varias OLT comparten IP, por host fallaba.
    if (d.device_type === 'olt') {
      this.api.zteOlts().subscribe((olts) => {
        const o = olts.find((x) => x.name === d.name) || olts.find((x) => x.host === d.ip_address);
        if (o) {
          this.f.telnet_user = o.telnetUser;
          this.f.telnet_port = o.telnetPort;
          this.f.snmp_poll_enabled = o.snmpPollEnabled;
          this.f.snmp_poll_seconds = o.snmpPollSeconds;
          if (o.snmpCommunity) this.f.snmp_community = o.snmpCommunity;
          this.f.id_red_olt_marca = o.idRedOltMarca ?? undefined;
          if (o.softwareVersion) this.f.software_version = o.softwareVersion;
        }
      });
    }
  }

  pedirBorrar(d: Device) { this.borrar.set(d); }

  confirmarBorrar() {
    const d = this.borrar();
    if (!d) return;
    this.api.deleteDevice(d.id).subscribe({
      next: () => { this.borrar.set(null); this.load(); this.notify.ok('Equipo eliminado.'); },
      error: (e: any) => { this.borrar.set(null); this.notify.error(e?.message || 'No se pudo eliminar el equipo.'); },
    });
  }

  nuevo() {
    this.f = { device_type: 'borde', snmp_community: 'public', snmp_version: 'v2c', snmp_enabled: true, snmp_poll_enabled: true, snmp_poll_seconds: 300 };
    this.testErr.set(''); this.dupErr.set(false); this.saveErr.set('');
    this.showAdd.set(true);
  }

  /** ¿Ya hay un equipo cargado con esta misma IP y puerto SNMP? (chequeo inmediato, sin ir al server) */
  private esDuplicado(): boolean {
    const ip = (this.f.ip_address || '').trim();
    if (!ip) return false;
    const port = Number(this.f.snmp_port) || 161;
    return this.devices().some((d: any) =>
      (d.ip_address || '').trim() === ip && (Number(d.snmp_port) || 161) === port && d.id !== this.f.id);
  }

  save() {
    if (!this.f.name) return;
    // Duplicado por IP + puerto: se corta acá, antes incluso de probar Telnet.
    if (this.esDuplicado()) { this.dupErr.set(true); return; }
    // Si es OLT con credenciales Telnet, validar la conexión antes de guardar.
    if (!this.f.id && this.f.device_type === 'olt' && this.f.telnet_user) {   // solo al AGREGAR; al EDITAR/actualizar NO se reprueba Telnet
      this.testing.set(true); this.testErr.set('');
      this.api.testTelnet({ host: this.f.ip_address, port: this.f.telnet_port || 23, user: this.f.telnet_user, pass: this.f.telnet_pass })
        .subscribe({
          next: (r: any) => {
            this.testing.set(false);
            if (r?.ok) this.doSave();
            else this.testErr.set(r?.error || 'No se pudo conectar por Telnet a la OLT.');
          },
          error: () => { this.testing.set(false); this.testErr.set('No se pudo probar la conexión Telnet.'); },
        });
    } else {
      this.doSave();
    }
  }

  doSave() {
    // Con id -> edición (PUT); sin id -> alta (POST). Ambos escriben en ERP y NOC.
    const req = this.f.id
      ? this.api.updateDevice(this.f.id, this.f)
      : this.api.createDevice(this.f);
    req.subscribe({
      next: () => { this.showAdd.set(false); this.testErr.set(''); this.load(); this.notify.ok(this.f.id ? 'Equipo actualizado.' : 'Equipo creado.'); },
      // El backend valida lo mismo (IP + puerto). Si dos usuarios cargan a la vez, acá cae.
      error: (e: any) => {
        if (String(e?.message || '').includes('Ya Agregado')) { this.testErr.set(''); this.dupErr.set(true); }
        else { this.testErr.set(''); this.notify.error(e?.message || 'No se pudo guardar el equipo.'); }
      },
    });
  }
}
