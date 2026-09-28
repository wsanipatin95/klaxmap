import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';
import { NocNotify } from '../services/noc-notify';

/**
 * Configurar OLT (multimarca) por la interfaz web. Flujo guiado por pasos:
 * 1) elegí la OLT · 2) elegí la operación · 3) completá los datos · 4) vista previa · 5) enviar.
 * Único módulo que ESCRIBE en la OLT: siempre vista previa + confirmación.
 */
@Component({
  selector: 'app-olt-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tools">
      <span class="pg-title" style="font-size:16px"><i class="pi pi-wrench"></i> Configurar OLT</span>
      <span class="aviso" style="margin-left:auto;font-size:12px;color:var(--red)"><i class="pi pi-exclamation-triangle"></i> Escribe en producción · revisá siempre la vista previa</span>
    </div>

    <!-- AVISO: el CLI global manda sobre todo lo demas. Si esta apagado, ningun comando sale,
         asi que se avisa ANTES de que el operador arme la operacion (antes se enteraba al final). -->
    @if (estado(); as st) {
      @if (!st.cliEnabled) {
        <div class="panel cli-off">
          <div class="pb">
            <div class="cli-off-t"><i class="pi pi-ban"></i> El Telnet maestro está apagado</div>
            <div class="cli-off-x">
              {{ st.motivo }}
            </div>
          </div>
        </div>
      }
    }

    <!-- SWITCH MAESTRO DE SEGURIDAD · olt_write_enabled (V54) -->
    <div class="panel" [style.borderLeft]="writeEnabled() ? '4px solid #2a9d2a' : '4px solid #c0392b'">
      <div class="pb" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;margin:0">
          <input type="checkbox" [checked]="writeEnabled()" (change)="toggleWrite($event)">
          Envío de comandos a la OLT
        </label>
        <span class="chip" [style.background]="writeEnabled() ? '#e7f6ec' : '#fdeaea'" [style.color]="writeEnabled() ? '#2a9d2a' : '#c0392b'">
          {{ writeEnabled() ? 'HABILITADO' : 'DESHABILITADO' }}
        </span>
        <span style="font-size:12px;color:var(--muted);flex:1;min-width:200px"
              title="Habilita las ESCRITURAS del módulo (riesgo medio y alto). Las consultas no dependen de este interruptor: salen por la puerta de consultas. Se apaga solo tras los minutos de inactividad configurados abajo.">Escrituras del módulo</span>
      </div>
    </div>

    <!-- CONFIG DE SEGURIDAD · allowlist + auto-apagado + retención -->
    <div class="panel">
      <div class="ph"><span class="t"><i class="pi pi-lock"></i> Seguridad del módulo</span></div>
      <div class="pb" style="display:flex;flex-direction:column;gap:12px;max-width:660px">

        <!-- Permisos: chips compactos. Toda la explicacion va en el title (flotante),
             no en leyendas: el panel se leia como un muro de texto. -->
        <div class="permrow">
          <span class="permk">Qué se puede ejecutar</span>
          <div class="pills">
            <button type="button" class="pill baja" [class.on]="bajaEnabled()"
                    (click)="toggleNivel('baja', !bajaEnabled())"
                    title="Consultas · riesgo BAJO — potencia, consumo, detalle de ONU, estado del puerto, tarjetas, temperatura, alarmas, versión, MAC. Solo comandos show: no cambian nada. No necesitan el Telnet maestro: salen por la puerta de consultas.">
              <i class="dot"></i>Consultas</button>
            <button type="button" class="pill media" [class.on]="mediaEnabled()"
                    (click)="toggleNivel('media', !mediaEnabled())"
                    title="Riesgo MEDIO — reiniciar ONU, habilitar (no shutdown), renombrar. Le cortan el servicio a un cliente por un rato. Piden además el interruptor maestro.">
              <i class="dot"></i>Medio</button>
            <button type="button" class="pill alta" [class.on]="altaEnabled()"
                    (click)="toggleNivel('alta', !altaEnabled())"
                    title="Riesgo ALTO — provisionar ONU, crear VLAN, cambiar plan, perfil de tráfico, clave WiFi, guardar configuración. Tocan la configuración de la OLT. Piden además el interruptor maestro.">
              <i class="dot"></i>Alto</button>
          </div>
        </div>

        <div class="permrow">
          <span class="permk">Puertas del Telnet</span>
          <div class="pills">
            <button type="button" class="pill baja" [class.on]="lecturaEnabled()"
                    (click)="toggleCli('lectura', !lecturaEnabled())"
                    title="Consultas a pedido — una sesión y un show, solo cuando alguien aprieta un botón. Es la puerta por la que el técnico ve la potencia de un cliente desde la OT-A.">
              <i class="dot"></i>Consultas</button>
            <button type="button" class="pill baja" [class.on]="respaldoEnabled()"
                    (click)="toggleCli('respaldo', !respaldoEnabled())"
                    title="Respaldo de configuración — una sesión por OLT, un comando de lectura, cada 12 horas.">
              <i class="dot"></i>Respaldo</button>
            <button type="button" class="pill alta" [class.on]="telnetEnabled()"
                    (click)="toggleCli('telnet', !telnetEnabled())"
                    title="Telnet MAESTRO — reabre el barrido periódico por CLI, el que saturaba el vty del C300 y botaba clientes. Las consultas no lo necesitan. Prenderlo solo para un caso puntual, por ejemplo si se cae el agente SNMP de una OLT.">
              <i class="dot"></i>Maestro</button>
          </div>
        </div>

        <div>
          <label class="k">Operadores autorizados (emails, separados por coma) · vacío = sin restricción</label>
          <div style="display:flex;gap:8px">
            <input class="inp" style="flex:1" [(ngModel)]="adminEmails" placeholder="juan@empresa.ec, maria@empresa.ec">
            <button class="btn" (click)="saveAdminEmails()">Guardar</button>
          </div>
        </div>
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <div>
            <label class="k">Auto-apagar envío tras (min) · 0 = nunca</label>
            <div style="display:flex;gap:8px">
              <input type="number" class="inp" style="width:120px" [(ngModel)]="autoOffMin">
              <button class="btn ghost" (click)="saveAutoOff()">Guardar</button>
            </div>
          </div>
          <div>
            <label class="k">Retención del log (días) · 0 = no borrar</label>
            <div style="display:flex;gap:8px">
              <input type="number" class="inp" style="width:120px" [(ngModel)]="logRetentionDays">
              <button class="btn ghost" (click)="saveRetention()">Guardar</button>
            </div>
          </div>
        </div>
        @if (secMsg()) { <span style="font-size:12.5px;color:#2a9d2a;font-weight:600">{{ secMsg() }}</span> }
      </div>
    </div>

    <!-- PASO 1 · OLT -->
    <div class="panel">
      <div class="ph"><span class="stepn">1</span> Elegí la OLT</div>
      <div class="pb">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <select class="inp" style="min-width:280px;font-size:14px" [(ngModel)]="oltId" (ngModelChange)="onOltChange()">
            <option [ngValue]="null">— elegí una OLT —</option>
            @for (o of olts(); track o.id) { <option [ngValue]="o.id">{{ o.name }} · {{ o.host }}</option> }
          </select>
          @if (oltId) {
            <span class="chip aviso"><i class="pi pi-tag"></i> {{ oltVendor() }}</span>
            <span class="chip aviso"><i class="pi pi-globe"></i> {{ oltHost() }}</span>
          }
        </div>
      </div>
    </div>

    @if (!oltId) {
      <div class="panel"><div class="pb" style="text-align:center;color:var(--muted);padding:26px">
        <span class="aviso" style="justify-content:center"><i class="pi pi-info-circle"></i> Elegí una OLT para ver las operaciones disponibles.</span>
      </div></div>
    }

    <!-- PASO 2 · Operación -->
    @if (oltId) {
      <div class="panel">
        <div class="ph"><span class="stepn">2</span> ¿Qué querés hacer?</div>
        <div class="pb">
          @if (opsForOlt().length) {
            <div class="opgrid">
              @for (t of opsForOlt(); track t.code) {
                <button class="opcard" [class.sel]="tplCode===t.code" (click)="selectOp(t)">
                  <span class="dot" [style.background]="dangerColor(t.danger)"></span>
                  <span>{{ t.name }}</span>
                  <small [style.color]="dangerColor(t.danger)">{{ t.danger }}</small>
                </button>
              }
            </div>
          } @else {
            <div style="color:var(--muted)">No hay operaciones cargadas para {{ oltVendor() }}.</div>
          }
        </div>
      </div>
    }

    <!-- PASO 3 · Datos -->
    @if (tpl(); as t) {
      <div class="panel">
        <div class="ph"><span class="stepn">3</span> Completá los datos · <span style="color:var(--muted);font-weight:400">{{ t.name }}</span></div>
        <div class="pb">
          <!-- Selección de ONU (solo templates de alcance ONU con ONUs en base) -->
          @if (t.scope === 'onu') {
            <div style="margin-bottom:14px">
              <div class="flabel">ONU objetivo <span style="color:var(--red)">*</span></div>
              @if (selectedOnu(); as o) {
                <div class="onusel">
                  <i class="pi pi-check-circle" style="color:var(--green)"></i> <b>{{ o.clientName || 'ONU' }}</b> · índice <b class="mono">{{ o.rawIndex }}</b>
                  <button class="btn sm ghost" (click)="selectedOnu.set(null)">cambiar</button>
                </div>
              } @else {
                <span class="buscador"><i class="pi pi-search"></i><input class="inp" style="max-width:360px" placeholder="Buscar por cliente, serial o índice (1/1/1:5)…" [(ngModel)]="onuFilter"></span>
                @if (filteredOnus().length) {
                  <div class="onulist">
                    @for (o of filteredOnus(); track o.id) {
                      <div class="onurow" (click)="pickOnu(o)">
                        <span class="mono" style="min-width:70px">{{ o.rawIndex }}</span>
                        <span style="flex:1">{{ o.clientName || '—' }}</span>
                        <span class="mono" style="font-size:11px;color:var(--muted)">{{ o.serial || '' }}</span>
                      </div>
                    }
                  </div>
                } @else if (onuFilter) {
                  <div style="color:var(--muted);font-size:12.5px;padding:6px 0">Sin coincidencias.</div>
                }
              }
            </div>
          }

          <!-- Campos del template -->
          @if (paramList().length) {
            <div class="fgrid">
              @for (p of paramList(); track p.key) {
                <div [class.full]="p.type==='textarea'">
                  <div class="flabel">{{ p.label }}@if (p.required) {<span style="color:var(--red)"> *</span>}</div>
                  @if (p.type === 'textarea') {
                    <textarea class="inp" style="width:100%;min-height:90px;font-family:monospace" [placeholder]="p.placeholder || ''" [(ngModel)]="pvals[p.key]"></textarea>
                  } @else {
                    <input class="inp" [type]="p.type==='number' ? 'number' : 'text'" [placeholder]="p.placeholder || ''" [(ngModel)]="pvals[p.key]">
                  }
                </div>
              }
            </div>
          }

          @if (t.scope !== 'onu' && !paramList().length) {
            <div style="color:var(--muted);font-size:12.5px">Esta operación no necesita datos extra.</div>
          }

          <div style="margin-top:14px">
            <button class="btn" (click)="doPreview()"><i class="pi pi-eye"></i> Ver vista previa</button>
          </div>
        </div>
      </div>

      <!-- PASO 4 · Vista previa + enviar -->
      @if (preview(); as pv) {
        <div class="panel">
          <div class="ph"><span class="stepn">4</span> Vista previa</div>
          <div class="pb">
            @if (pv.missing?.length) {
              <div class="warnbox aviso"><i class="pi pi-exclamation-triangle"></i> Faltan datos: <b>{{ pv.missing.join(', ') }}</b></div>
            } @else {
              <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Estos comandos exactos se enviarán por Telnet a <b>{{ oltName() }}</b>:</div>
              <pre class="cmdbox">{{ cmdText(pv.commands) }}</pre>
              <button class="btn big" [title]="motivoNivel(t.danger) || ''" [style.background]="puedeCorrer(t.danger) ? dangerColor(t.danger) : '#94a3b8'"
                      (click)="doExecute()" [disabled]="running() || !puedeEnviar()" [title]="motivoBloqueo() || ''">
                <i class="pi" [class.pi-spinner]="running()" [class.gira]="running()"
                   [class.pi-ban]="!running() && !puedeEnviar()" [class.pi-bolt]="!running() && puedeEnviar()"></i>
                {{ running() ? 'Enviando…' : (puedeEnviar() ? 'Confirmar y enviar a la OLT' : 'Envío bloqueado') }}
              </button>
              @if (motivoBloqueo(); as m) { <div class="bloqueo">{{ m }}</div> }
            }
          </div>
        </div>
      }

      <!-- Resultado -->
      @if (execResult(); as ex) {
        <div class="panel">
          <div class="ph">
            <span class="badge" [style.background]="ex.status==='ok' ? '#e8f5e9' : '#fdecea'" [style.color]="ex.status==='ok' ? 'var(--green)' : 'var(--red)'">
              {{ ex.status==='ok' ? 'Ejecutado correctamente' : (ex.ok===false ? 'No enviado' : 'Ejecutado con errores') }}
            </span>
          </div>
          <div class="pb"><pre class="outbox">{{ ex.output || ex.error }}</pre></div>
        </div>
      }

      <!-- Editar comandos (avanzado) -->
      <div class="panel">
        <div class="ph"><span class="t"><i class="pi pi-cog"></i> Comandos del template (avanzado)</span>
          <button class="btn sm ghost" style="margin-left:auto" (click)="toggleEdit()">{{ editing() ? 'Ocultar' : 'Editar' }}</button>
        </div>
        @if (editing()) {
          <div class="pb">
            <div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">
              Ajustá los comandos a tus perfiles. Placeholders: <span class="mono">{{ '{' }}shelf{{ '}' }} {{ '{' }}slot{{ '}' }} {{ '{' }}port{{ '}' }} {{ '{' }}onu{{ '}' }}</span> y los de los campos.
            </div>
            <textarea class="inp" style="width:100%;min-height:150px;font-family:monospace" [(ngModel)]="editBody"></textarea>
            <button class="btn sm" style="margin-top:8px" (click)="saveBody()">Guardar comandos</button>
          </div>
        }
      </div>
    }

    <!-- Historial -->
    <div class="panel">
      <div class="ph"><span class="t"><i class="pi pi-file"></i> Historial</span></div>
      <div class="pb">
        @if (logs().length) {
          <table>
            <thead><tr><th>Fecha</th><th>OLT</th><th>Operación</th><th>Estado</th><th>Por</th></tr></thead>
            <tbody>
              @for (l of logs(); track l.id) {
                <tr>
                  <td style="font-size:12px">{{ fmt(l.created_at) }}</td>
                  <td>{{ l.olt_name }}</td>
                  <td>{{ l.template_name }}</td>
                  <td><span class="badge" [style.background]="l.status==='ok' ? '#e8f5e9' : '#fdecea'" [style.color]="l.status==='ok' ? 'var(--green)' : 'var(--red)'">{{ l.status }}</span></td>
                  <td style="font-size:12px">{{ l.executed_by || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div style="color:var(--muted);padding:10px 0">Sin comandos ejecutados todavía.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    /* Permisos de la OLT: una fila por grupo, chips que se prenden. La ayuda va en el
       title del chip, no en leyendas debajo: el panel se volvia un muro de texto. */
    .permrow { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
    .permk { font-size:12px; color:var(--muted); min-width:150px; }
    .pills { display:flex; gap:6px; flex-wrap:wrap; }
    .pill { display:inline-flex; align-items:center; gap:6px; cursor:pointer;
            border:1px solid var(--line,#e5e7eb); background:#fff; color:#6b7280;
            border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:600;
            transition:background .15s,border-color .15s,color .15s; }
    .pill:hover { border-color:#c7ccd6; }
    .pill .dot { width:7px; height:7px; border-radius:50%; background:#cbd2dc; }
    .pill.on { color:#fff; }
    .pill.on .dot { background:rgba(255,255,255,.85); }
    .pill.baja.on  { background:#2e7d32; border-color:#2e7d32; }
    .pill.media.on { background:#e08600; border-color:#e08600; }
    .pill.alta.on  { background:#e02424; border-color:#e02424; }
    .cli-off { border-left:4px solid #b45309; background:#fffbeb; margin-bottom:12px; }
    .cli-off-t { display:flex; align-items:center; gap:8px; font-weight:700; color:#92400e; font-size:13.5px; }
    .cli-off-t i.pi { font-size:14px; }
    .cli-off-x { margin-top:6px; font-size:12.5px; color:#78350f; line-height:1.6; }
    .cli-off-x code { background:#fef3c7; border-radius:4px; padding:1px 5px; }
    .bloqueo { margin-top:8px; font-size:12px; color:#b45309; line-height:1.5; max-width:560px; }

    .stepn { display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
             background:var(--primary,#4b3bff);color:#fff;font-size:12px;font-weight:700;margin-right:6px }
    .chip { background:#eef;color:#334;border-radius:14px;padding:3px 10px;font-size:12px;font-weight:600 }
    .flabel { font-size:12px;color:var(--muted);margin-bottom:4px }
    .opgrid { display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px }
    .opcard { display:flex;align-items:center;gap:8px;text-align:left;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;
              background:#fff;cursor:pointer;font-size:13.5px;font-weight:600;transition:all .15s }
    .opcard:hover { border-color:var(--primary,#4b3bff);background:#fafaff }
    .opcard.sel { border-color:var(--primary,#4b3bff);background:#eef;box-shadow:0 0 0 2px rgba(75,59,255,.20) }
    .opcard .dot { width:9px;height:9px;border-radius:50%;flex-shrink:0 }
    .opcard small { margin-left:auto;font-size:10.5px;text-transform:uppercase;font-weight:700 }
    .fgrid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px }
    .fgrid .full { grid-column:1/-1 }
    .onusel { background:#e8f5e9;border:1px solid #c8e6c9;border-radius:8px;padding:8px 12px;font-size:13px;display:flex;align-items:center;gap:10px }
    .onulist { max-height:220px;overflow:auto;border:1px solid #eee;border-radius:8px;margin-top:8px }
    .onurow { display:flex;gap:10px;align-items:center;padding:8px 12px;cursor:pointer;border-bottom:1px solid #f3f3f3;font-size:13px }
    .onurow:hover { background:#fafaff }
    .cmdbox { background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;overflow:auto;font-size:13px;margin:0 0 12px }
    .outbox { background:#111;color:#9fef00;padding:14px;border-radius:8px;overflow:auto;font-size:12.5px;margin:0;max-height:360px }
    .warnbox { background:#fff4e5;border:1px solid #ffe0b2;color:#b26a00;border-radius:8px;padding:10px 12px;font-size:13px }
    .btn.big { font-size:14px;padding:11px 20px;color:#fff }
    .btn.ghost { background:transparent;border:1px solid #ddd;color:var(--muted) }
  `],
})
export class OltConfig {
  private api = inject(NocApi);
  private notify = inject(NocNotify);

  writeEnabled = signal(false);   // olt_write_enabled (kxt_setting)
  // Permiso por NIVEL DE RIESGO (V96). Las de riesgo BAJO son consultas y salen por una
  // puerta acotada que NO necesita el interruptor maestro de Telnet.
  bajaEnabled = signal(false);     // olt_cli_baja_enabled
  mediaEnabled = signal(false);    // olt_cli_media_enabled
  altaEnabled = signal(false);     // olt_cli_alta_enabled
  // Las puertas del Telnet (V97): antes solo por .env y reinicio, ahora desde esta pantalla.
  telnetEnabled = signal(false);   // olt_cli_telnet_enabled
  lecturaEnabled = signal(false);  // olt_cli_lectura_enabled
  respaldoEnabled = signal(false); // olt_cli_respaldo_enabled
  estado = signal<any>(null);     // GET /olt-config/estado: CLI global + escritura + motivo
  adminEmails = '';
  autoOffMin = 30;
  logRetentionDays = 365;
  secMsg = signal('');

  olts = signal<any[]>([]);
  templates = signal<any[]>([]);
  oltId: number | null = null;
  tplCode: string | null = null;
  tpl = signal<any>(null);
  paramList = signal<any[]>([]);
  pvals: any = {};

  onus = signal<any[]>([]);
  onuFilter = '';
  selectedOnu = signal<any>(null);

  preview = signal<any>(null);
  execResult = signal<any>(null);
  running = signal(false);
  logs = signal<any[]>([]);

  editing = signal(false);
  editBody = '';

  filteredOnus(): any[] {
    const f = (this.onuFilter || '').toLowerCase().trim();
    if (!f) return [];
    return this.onus().filter((o) =>
      (o.clientName || '').toLowerCase().includes(f) ||
      (o.serial || '').toLowerCase().includes(f) ||
      (o.rawIndex || '').toLowerCase().includes(f)).slice(0, 60);
  }

  constructor() {
    this.api.zteOlts().subscribe({ next: (o) => this.olts.set(o || []), error: () => {} });
    this.api.oltcTemplates().subscribe({ next: (t) => this.templates.set(t || []), error: () => {} });
    this.loadEstado();
    this.loadLogs();
    this.loadWriteEnabled();
  }

  /** Relee el estado del módulo (CLI global, escritura y permiso por nivel). */
  loadEstado() {
    this.api.oltcEstado().subscribe({ next: (e) => this.estado.set(e), error: () => {} });
  }

  onOltChange() {
    this.selectedOnu.set(null);
    this.onus.set([]);
    this.preview.set(null);
    this.execResult.set(null);
    this.tplCode = null;
    this.tpl.set(null);
    this.paramList.set([]);
    this.pvals = {};
    if (this.oltId) {
      this.api.zteOnusOfOlt(this.oltId).subscribe({ next: (o) => this.onus.set(o || []), error: () => {} });
      this.loadLogs();
    }
  }

  oltVendor(): string { const o = this.olts().find((x) => x.id === this.oltId); return o ? (o.vendor || 'ZTE') : ''; }
  oltHost(): string { const o = this.olts().find((x) => x.id === this.oltId); return o ? o.host : ''; }
  opsForOlt(): any[] {
    const v = this.oltVendor().trim().toLowerCase();
    if (!v) return [];
    // Emparejamiento TOLERANTE (mismo caso que catálogo/OID): la OLT trae "ZTE V1" y las
    // plantillas están como "ZTE" -> antes NO casaban y solo salía 'libre'. Prefijo, case-insensitive.
    return this.templates().filter((t) => {
      const tv = (t.vendor || 'ZTE').trim().toLowerCase();
      return tv === 'all' || tv === v || v.startsWith(tv) || tv.startsWith(v);
    });
  }

  selectOp(t: any) {
    this.tplCode = t.code;
    this.tpl.set(t);
    this.preview.set(null);
    this.execResult.set(null);
    this.pvals = {};
    this.editBody = t.body || '';
    this.editing.set(false);
    try { this.paramList.set(t.params ? JSON.parse(t.params) : []); } catch { this.paramList.set([]); }
  }

  pickOnu(o: any) { this.selectedOnu.set(o); this.preview.set(null); }

  private buildParams(): any {
    const p: any = { ...this.pvals };
    const t = this.tpl();
    if (t && t.scope === 'onu' && this.selectedOnu()) {
      const o = this.selectedOnu();
      p.shelf = o.shelf; p.slot = o.slot; p.port = o.port; p.onu = o.onuId;
    }
    return p;
  }

  doPreview() {
    if (!this.tplCode) return;
    this.execResult.set(null);
    this.api.oltcPreview(this.tplCode, this.buildParams()).subscribe({
      next: (r) => this.preview.set(r),
      error: (e) => alert(e.message || 'Error en la vista previa'),
    });
  }

  doExecute() {
    if (!this.tplCode || !this.oltId) return;
    const t = this.tpl();
    if (!confirm(`¿Enviar estos comandos a ${this.oltName()}?\n\nOperación: ${t.name}\nEsto ESCRIBE en la OLT de producción.`)) return;
    this.running.set(true);
    this.api.oltcExecute(this.tplCode, this.oltId, this.buildParams()).subscribe({
      next: (r) => { this.execResult.set(r); this.running.set(false); this.loadLogs(); this.notify.ok('Comando ejecutado en la OLT.'); },
      error: (e) => { this.running.set(false); this.notify.error(e?.message || 'No se pudo ejecutar el comando en la OLT.'); },
    });
  }

  toggleEdit() { this.editing.set(!this.editing()); }
  saveBody() {
    if (!this.tplCode) return;
    this.api.oltcUpdateBody(this.tplCode, this.editBody).subscribe({
      next: () => {
        const t = { ...this.tpl(), body: this.editBody };
        this.tpl.set(t);
        this.templates.set(this.templates().map((x) => x.code === t.code ? t : x));
        this.preview.set(null);
        alert('Comandos guardados.');
      },
      error: (e) => alert(e.message || 'No se pudo guardar'),
    });
  }

  /** ¿Puede salir un comando ahora mismo? Manda el CLI global; despues el switch del modulo. */
  puedeEnviar(): boolean {
    const st = this.estado();
    if (st && st.cliEnabled === false) return false;
    return this.writeEnabled();
  }

  /**
   * ¿Se puede correr ESTA operación? Depende de su nivel, no de un interruptor único.
   * Las de riesgo bajo son consultas: salen por la puerta acotada y no miran el maestro.
   */
  puedeCorrer(danger: string): boolean {
    const d = (danger || '').toLowerCase();
    if (d === 'baja') return this.bajaEnabled();
    if (!this.puedeEnviar()) return false;
    return d === 'media' ? this.mediaEnabled() : this.altaEnabled();
  }

  motivoNivel(danger: string): string | null {
    const d = (danger || '').toLowerCase();
    if (this.puedeCorrer(d)) return null;
    if (d === 'baja') return 'Las consultas (riesgo bajo) están apagadas en Seguridad del módulo.';
    if (!this.puedeEnviar()) return this.motivoBloqueo();
    return 'Las operaciones de riesgo ' + d.toUpperCase() + ' están apagadas en Seguridad del módulo.';
  }

  /** Texto que explica por que el boton esta bloqueado (o null si se puede enviar). */
  motivoBloqueo(): string | null {
    const st = this.estado();
    if (st && st.cliEnabled === false)
      return 'El CLI/Telnet está deshabilitado globalmente en el NOC: ningún comando sale hacia la OLT. '
           + 'La vista previa sí funciona.';
    if (!this.writeEnabled())
      return 'El interruptor "Envío de comandos a la OLT" está en OFF. Actívalo arriba para poder enviar.';
    return null;
  }

  loadLogs() { this.api.oltcLogs(this.oltId || undefined).subscribe({ next: (l) => this.logs.set(l || []), error: () => {} }); }

  private truthy(v: any): boolean {
    const t = String(v ?? '').trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'on' || t === 'si' || t === 'sí';
  }
  loadWriteEnabled() {
    const k = (x: any) => x.settingKey ?? x.setting_key ?? x.key;
    const v = (x: any) => x.settingValue ?? x.setting_value ?? x.value;
    this.api.settings().subscribe({
      next: (list: any[]) => {
        const find = (key: string) => { const r = (list || []).find((x: any) => k(x) === key); return r != null ? v(r) : undefined; };
        this.writeEnabled.set(this.truthy(find('olt_write_enabled')));
        this.bajaEnabled.set(this.truthy(find('olt_cli_baja_enabled')));
        this.mediaEnabled.set(this.truthy(find('olt_cli_media_enabled')));
        this.altaEnabled.set(this.truthy(find('olt_cli_alta_enabled')));
        this.telnetEnabled.set(this.truthy(find('olt_cli_telnet_enabled')));
        this.lecturaEnabled.set(this.truthy(find('olt_cli_lectura_enabled')));
        this.respaldoEnabled.set(this.truthy(find('olt_cli_respaldo_enabled')));
        const em = find('olt_admin_emails'); if (em != null) this.adminEmails = String(em);
        const ao = find('olt_write_auto_off_minutes'); if (ao != null) this.autoOffMin = Number(ao);
        const rd = find('olt_log_retention_days'); if (rd != null) this.logRetentionDays = Number(rd);
      },
      error: () => {},
    });
  }
  /** Prende o apaga un nivel de riesgo. Mismo camino que toggleWrite: kxt_setting, en vivo. */
  toggleNivel(nivel: 'baja' | 'media' | 'alta', on: boolean) {
    const clave = 'olt_cli_' + nivel + '_enabled';
    const sig = nivel === 'baja' ? this.bajaEnabled : nivel === 'media' ? this.mediaEnabled : this.altaEnabled;
    sig.set(on);
    this.api.updateSetting(clave, on ? '1' : '0').subscribe({
      next: () => this.loadEstado(),
      error: () => { sig.set(!on); alert('No se pudo cambiar el ajuste (' + clave + ').'); },
    });
  }

  /** Prende o apaga una puerta del Telnet. Tarda unos segundos en aplicarse en el NOC. */
  toggleCli(cual: 'telnet' | 'lectura' | 'respaldo', on: boolean) {
    const clave = 'olt_cli_' + cual + '_enabled';
    const sig = cual === 'telnet' ? this.telnetEnabled
              : cual === 'lectura' ? this.lecturaEnabled : this.respaldoEnabled;
    if (cual === 'telnet' && on &&
        !confirm('El Telnet maestro reabre el barrido por CLI, que satura el vty del C300 y '
               + 'puede botar clientes.\n\nLas consultas NO lo necesitan: ya entran por su '
               + 'propia puerta.\n\n¿Prenderlo igual?')) {
      return;
    }
    sig.set(on);
    this.api.updateSetting(clave, on ? '1' : '0').subscribe({
      next: () => setTimeout(() => this.loadEstado(), 1200),
      error: () => { sig.set(!on); alert('No se pudo cambiar el ajuste (' + clave + ').'); },
    });
  }

  toggleWrite(ev: any) {
    const on = !!ev?.target?.checked;
    this.api.updateSetting('olt_write_enabled', on ? '1' : '0').subscribe({
      next: () => this.writeEnabled.set(on),
      error: () => { this.writeEnabled.set(!on); alert('No se pudo cambiar el ajuste (olt_write_enabled).'); },
    });
  }
  private flash(m: string) { this.secMsg.set(m); setTimeout(() => this.secMsg.set(''), 2500); }
  saveAdminEmails() { this.api.updateSetting('olt_admin_emails', this.adminEmails ?? '').subscribe({ next: () => this.flash('Operadores autorizados guardados.'), error: () => this.flash('Error al guardar.') }); }
  saveAutoOff() { this.api.updateSetting('olt_write_auto_off_minutes', String(this.autoOffMin ?? 0)).subscribe({ next: () => this.flash('Auto-apagado guardado.'), error: () => this.flash('Error al guardar.') }); }
  saveRetention() { this.api.updateSetting('olt_log_retention_days', String(this.logRetentionDays ?? 0)).subscribe({ next: () => this.flash('Retención guardada.'), error: () => this.flash('Error al guardar.') }); }

  cmdText(cmds: string[]): string { return (cmds || []).join('\n'); }
  oltName(): string { const o = this.olts().find((x) => x.id === this.oltId); return o ? o.name : ''; }
  dangerColor(d: string) { return d === 'alta' ? '#e02424' : d === 'baja' ? '#2e7d32' : '#e08600'; }
  dangerBg(d: string) { return d === 'alta' ? '#fdecea' : d === 'baja' ? '#e8f5e9' : '#fff4e5'; }
  fmt(t: string): string { const d = new Date(t); return isNaN(d.getTime()) ? '' : d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
}
