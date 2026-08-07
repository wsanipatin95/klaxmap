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
      <span style="font-weight:700;font-size:16px">🛠️ Configurar OLT</span>
      <span style="margin-left:auto;font-size:12px;color:var(--red)">⚠ Escribe en producción · siempre revisá la vista previa</span>
    </div>

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
        <span style="font-size:12px;color:var(--muted);flex:1;min-width:240px">Interruptor maestro. En OFF no se envía ningún comando (ni los <code>show</code>). Los comandos destructivos quedan bloqueados aparte aunque esté en ON.</span>
      </div>
    </div>

    <!-- CONFIG DE SEGURIDAD · allowlist + auto-apagado + retención -->
    <div class="panel">
      <div class="ph">🔒 Seguridad del módulo</div>
      <div class="pb" style="display:flex;flex-direction:column;gap:12px;max-width:660px">
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
            <span class="chip">🏷️ {{ oltVendor() }}</span>
            <span class="chip">🌐 {{ oltHost() }}</span>
          }
        </div>
      </div>
    </div>

    @if (!oltId) {
      <div class="panel"><div class="pb" style="text-align:center;color:var(--muted);padding:26px">
        👆 Elegí una OLT para ver las operaciones disponibles.
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
                  ✅ <b>{{ o.clientName || 'ONU' }}</b> · índice <b class="mono">{{ o.rawIndex }}</b>
                  <button class="btn sm ghost" (click)="selectedOnu.set(null)">cambiar</button>
                </div>
              } @else {
                <input class="inp" style="max-width:360px" placeholder="🔍 buscar por cliente, serial o índice (1/1/1:5)…" [(ngModel)]="onuFilter">
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
            <button class="btn" (click)="doPreview()">🔍 Ver vista previa</button>
          </div>
        </div>
      </div>

      <!-- PASO 4 · Vista previa + enviar -->
      @if (preview(); as pv) {
        <div class="panel">
          <div class="ph"><span class="stepn">4</span> Vista previa</div>
          <div class="pb">
            @if (pv.missing?.length) {
              <div class="warnbox">⚠ Faltan datos: <b>{{ pv.missing.join(', ') }}</b></div>
            } @else {
              <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Estos comandos exactos se enviarán por Telnet a <b>{{ oltName() }}</b>:</div>
              <pre class="cmdbox">{{ cmdText(pv.commands) }}</pre>
              <button class="btn big" [style.background]="dangerColor(t.danger)" (click)="doExecute()" [disabled]="running()">
                {{ running() ? '⏳ Enviando…' : '⚡ Confirmar y enviar a la OLT' }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Resultado -->
      @if (execResult(); as ex) {
        <div class="panel">
          <div class="ph">
            <span class="badge" [style.background]="ex.status==='ok' ? '#e8f5e9' : '#fdecea'" [style.color]="ex.status==='ok' ? 'var(--green)' : 'var(--red)'">
              {{ ex.status==='ok' ? '✓ Ejecutado correctamente' : '⚠ Ejecutado con errores' }}
            </span>
          </div>
          <div class="pb"><pre class="outbox">{{ ex.output }}</pre></div>
        </div>
      }

      <!-- Editar comandos (avanzado) -->
      <div class="panel">
        <div class="ph">⚙️ Comandos del template (avanzado)
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
      <div class="ph">🧾 Historial</div>
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
    this.loadLogs();
    this.loadWriteEnabled();
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
    this.api.oltcExecute(this.tplCode, this.oltId, this.buildParams(), 'Wilson S.').subscribe({
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
        const em = find('olt_admin_emails'); if (em != null) this.adminEmails = String(em);
        const ao = find('olt_write_auto_off_minutes'); if (ao != null) this.autoOffMin = Number(ao);
        const rd = find('olt_log_retention_days'); if (rd != null) this.logRetentionDays = Number(rd);
      },
      error: () => {},
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
