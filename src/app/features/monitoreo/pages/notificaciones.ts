import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

/**
 * Configuración de NOTIFICACIONES (Telegram / correo / WhatsApp).
 * Lee y guarda los settings notify_* (config en vivo) y permite PROBAR cada canal.
 */
@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="tools">
      <span style="font-weight:700;font-size:16px">🔔 Notificaciones</span>
      <button class="btn" style="margin-left:auto" (click)="saveAll()">💾 Guardar cambios</button>
    </div>

    @if (msg()) { <div class="panel" style="margin-bottom:12px"><div class="pb" style="color:var(--green);font-weight:600;padding:10px 14px">{{ msg() }}</div></div> }

    <div class="cards">
    <!-- General -->
    <div class="panel">
      <div class="ph gen">⚙️ General</div>
      <div class="pb grid compact">
        <label class="chk">
          <input type="checkbox" [checked]="cfg['notify_enabled']==='1'" (change)="set('notify_enabled', $any($event.target).checked?'1':'0')">
          <b>Notificaciones activas</b>
        </label>
        <label class="chk">
          <input type="checkbox" [checked]="cfg['notify_recovery_enabled']==='1'" (change)="set('notify_recovery_enabled', $any($event.target).checked?'1':'0')">
          <b>Avisar recuperación</b> <span class="mut">manda "✅ Recuperado" al normalizarse</span>
        </label>
        <div class="fld wide"><label>Nivel mínimo a avisar</label>
          <select class="inp" [(ngModel)]="cfg['notify_min_severity']">
            <option value="crit">Solo críticas</option>
            <option value="warn">Todas (advertencias + críticas)</option>
          </select>
        </div>
        <div class="fld"><label>Silencio mismo aviso (seg)</label>
          <input class="inp" type="number" min="0" [(ngModel)]="cfg['notify_cooldown_seconds']">
        </div>
        <div class="fld"><label>Revisar alertas cada (seg)</label>
          <input class="inp" type="number" min="5" [(ngModel)]="cfg['notify_tick_seconds']">
        </div>
        <div class="fld wide"><label>Solo avisar cambios de los últimos (seg)</label>
          <input class="inp" type="number" min="60" [(ngModel)]="cfg['notify_max_age_seconds']">
        </div>
      </div>
    </div>

    <!-- Telegram -->
    <div class="panel">
      <div class="ph tg"><svg viewBox="0 0 240 240" width="18" height="18" style="margin-right:7px;flex:none"><defs><linearGradient id="tg" x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2AABEE"/><stop offset="1" stop-color="#229ED9"/></linearGradient></defs><circle cx="120" cy="120" r="120" fill="url(#tg)"/><path fill="#fff" d="M53 118c35-15 58-25 70-30 33-14 40-16 45-16 1 0 3 0 5 2 1 1 1 3 1 4 0 1 0 3-1 4-4 20-14 68-18 89-2 9-5 12-8 12-6 1-11-4-17-8-9-6-14-10-23-16-10-7-3-11 2-17 2-2 30-27 30-29 0-1-1-1-1-1-1 0-1 0-2 1-1 0-17 11-40 26-3 2-6 3-9 3-3 0-8-2-12-3-5-2-9-3-9-6 0-2 2-4 8-6z"/></svg>Telegram
        <button class="btn sm ghost" style="margin-left:auto" (click)="test('telegram')">Probar</button>
      </div>
      <div class="pb grid compact">
        <label class="chk">
          <input type="checkbox" [checked]="cfg['notify_telegram_enabled']==='1'" (change)="set('notify_telegram_enabled', $any($event.target).checked?'1':'0')">
          <b>Activar Telegram</b>
        </label>
        <div class="fld wide"><label>Token del bot</label>
          <input class="inp" type="password" [(ngModel)]="cfg['notify_telegram_token']" placeholder="123456:ABC-DEF...">
        </div>
        <div class="fld"><label>Chat / grupo ID <span class="mut">(Equipos: core/borde)</span></label>
          <input class="inp" [(ngModel)]="cfg['notify_telegram_chat']" placeholder="-1001234567890">
        </div>
        <div class="fld"><label>Chat GPON <span class="mut">(ONU/OLT · opcional)</span></label>
          <input class="inp" [(ngModel)]="cfg['notify_telegram_chat_gpon']" placeholder="vacío = usa el de arriba">
        </div>
      </div>
    </div>

    <!-- Correo -->
    <div class="panel">
      <div class="ph mail"><svg viewBox="0 0 48 48" width="18" height="18" style="margin-right:7px;flex:none"><path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75L35 40h7c1.66 0 3-1.34 3-3V16.2z"/><path fill="#1e88e5" d="M3 16.2l3.614 1.71L13 23.7V40H6c-1.66 0-3-1.34-3-3V16.2z"/><path fill="#e53935" d="M35 11.2L24 19.45 13 11.2 12 17l1 6.7L24 32l11-8.3 1-6.7z"/><path fill="#c62828" d="M3 12.298V16.2l10 7.5V11.2L9.876 8.859C9.132 8.301 8.228 8 7.298 8C4.924 8 3 9.924 3 12.298z"/><path fill="#fbc02d" d="M45 12.298V16.2l-10 7.5V11.2l3.124-2.341C38.868 8.301 39.772 8 40.702 8C43.076 8 45 9.924 45 12.298z"/></svg>Correo (SMTP)
        <button class="btn sm ghost" style="margin-left:auto" (click)="test('email')">Probar</button>
      </div>
      <div class="pb grid compact">
        <label class="chk">
          <input type="checkbox" [checked]="cfg['notify_email_enabled']==='1'" (change)="set('notify_email_enabled', $any($event.target).checked?'1':'0')">
          <b>Activar correo</b>
        </label>
        <div class="fld"><label>Servidor SMTP</label><input class="inp" [(ngModel)]="cfg['notify_email_host']" placeholder="smtp.gmail.com"></div>
        <div class="fld"><label>Puerto</label><input class="inp" type="number" [(ngModel)]="cfg['notify_email_port']" placeholder="587"></div>
        <div class="fld"><label>Usuario</label><input class="inp" [(ngModel)]="cfg['notify_email_user']" placeholder="noc@innofiber.ec"></div>
        <div class="fld"><label>Contraseña</label><input class="inp" type="password" [(ngModel)]="cfg['notify_email_pass']"></div>
        <div class="fld"><label>Remitente (From)</label><input class="inp" [(ngModel)]="cfg['notify_email_from']" placeholder="noc@innofiber.ec"></div>
        <div class="fld"><label>Destinatarios <span class="mut">(Equipos · coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_email_to']" placeholder="a@x.com, b@y.com"></div>
        <div class="fld"><label>Destinatarios GPON <span class="mut">(opcional · coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_email_to_gpon']" placeholder="vacío = usa los de arriba"></div>
      </div>
    </div>

    <!-- WhatsApp -->
    <div class="panel">
      <div class="ph wa"><svg viewBox="0 0 24 24" width="18" height="18" style="margin-right:7px;flex:none"><path fill="#25D366" d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15 3.5 13.5 3.5 12 3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20.2 12 20.2z"/><path fill="#25D366" d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/></svg>WhatsApp
        <button class="btn sm ghost" style="margin-left:auto" (click)="test('whatsapp')">Probar</button>
      </div>
      <div class="pb grid compact">
        <label class="chk">
          <input type="checkbox" [checked]="cfg['notify_whatsapp_enabled']==='1'" (change)="set('notify_whatsapp_enabled', $any($event.target).checked?'1':'0')">
          <b>Activar WhatsApp</b>
        </label>
        <div class="fld wide"><label>URL del proveedor / API</label><input class="inp" [(ngModel)]="cfg['notify_whatsapp_url']" placeholder="https://gateway/send"></div>
        <div class="fld"><label>Token / API key</label><input class="inp" type="password" [(ngModel)]="cfg['notify_whatsapp_token']"></div>
        <div class="fld"><label>Número(s) destino <span class="mut">(Equipos · coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_whatsapp_to']" placeholder="5939xxxxxxx"></div>
        <div class="fld"><label>Número(s) GPON <span class="mut">(opcional · coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_whatsapp_to_gpon']" placeholder="vacío = usa los de arriba"></div>
      </div>
    </div>

    <!-- Mensaje configurable -->
    <div class="panel" style="grid-column:1 / -1">
      <div class="ph msg">📝 Mensaje a enviar</div>
      <div class="pb">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
          <span style="font-weight:600">🧪 Probar</span>
          <select class="inp" [(ngModel)]="testType" (ngModelChange)="onTypeChange()">
            <option value="generic">Prueba genérica</option>
            <option value="cpu">CPU crítica (equipo)</option>
            <option value="down">Equipo caído</option>
            <option value="iface">Interfaz caída</option>
            <option value="iface_err">Errores de interfaz</option>
            <option value="reboot">Reinicio de equipo</option>
            <option value="los">Corte de fibra LOS (OLT)</option>
            <option value="signal">Señal crítica cliente (OLT)</option>
            <option value="offline">ONU caída (OLT)</option>
            <option value="pon">Puerto PON saturado (OLT)</option>
            <option value="pon_down">Puerto PON caído (OLT)</option>
            <option value="recovery">✅ Recuperación</option>
          </select>
          <span style="color:var(--muted)">por</span>
          <select class="inp" [(ngModel)]="testChannel">
            <option value="">Todos los canales</option>
            <option value="telegram">Telegram</option>
            <option value="email">Correo</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button class="btn" (click)="runTest()">Enviar</button>
        </div>

        <div class="msg2col">
          <div>
            <div class="lbl">✏️ Lo que va <span class="mut">editá todo el mensaje acá</span></div>
            <textarea class="inp" rows="8" [(ngModel)]="cfg['notify_body']" (ngModelChange)="onTypeChange()"
                      style="resize:vertical;font-family:inherit;width:100%"></textarea>
            <div class="vars">Variables (las rellena el sistema): {{ '{' }}severidad{{ '}' }} · {{ '{' }}descripcion{{ '}' }} · {{ '{' }}equipo{{ '}' }} · {{ '{' }}onu{{ '}' }} · {{ '{' }}hora{{ '}' }}</div>
          </div>
          <div>
            <div class="lbl">📤 Cómo se envía <span class="mut">así llega el aviso</span></div>
            <div class="bubble" [class.crit]="sevOf()==='crit'" [class.warn]="sevOf()!=='crit'">{{ testBody }}</div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Equipos Core/Borde/MikroTik: qué alertar de cada uno -->
    <div class="panel" style="margin-top:12px">
      <div class="ph gen">🖧 Equipos · Core / Borde / MikroTik</div>
      <div class="pb" style="padding:0;overflow:auto">
        <table>
          <thead><tr><th>Equipo</th><th>Tipo</th><th>Estado</th>
            @for (c of equipoCols; track c.k) { <th style="text-align:center">{{ c.l }}</th> }
          </tr></thead>
          <tbody>
            @for (d of eqDevs(); track d.id) {
              <tr>
                <td><b>{{ d.name }}</b></td><td>{{ d.device_type }}</td><td [innerHTML]="stBadge(d.status)"></td>
                @for (c of equipoCols; track c.k) {
                  <td style="text-align:center"><input type="checkbox" [checked]="isOn(d,c.k)" (change)="toggle(d,c.k,$any($event.target).checked)"></td>
                }
              </tr>
            } @empty { <tr><td [attr.colspan]="3 + equipoCols.length" style="text-align:center;color:var(--muted);padding:22px">Sin equipos Core/Borde/MikroTik.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <!-- OLTs: qué alertar -->
    <div class="panel" style="margin-top:12px">
      <div class="ph gen">📡 OLTs</div>
      <div class="pb" style="padding:0;overflow:auto">
        <table>
          <thead><tr><th>OLT</th><th>Estado</th>
            @for (c of oltCols; track c.k) { <th style="text-align:center">{{ c.l }}</th> }
          </tr></thead>
          <tbody>
            @for (d of oltDevs(); track d.id) {
              <tr>
                <td><b>{{ d.name }}</b></td><td [innerHTML]="stBadge(d.status)"></td>
                @for (c of oltCols; track c.k) {
                  <td style="text-align:center"><input type="checkbox" [checked]="isOn(d,c.k)" (change)="toggle(d,c.k,$any($event.target).checked)"></td>
                }
              </tr>
            } @empty { <tr><td [attr.colspan]="2 + oltCols.length" style="text-align:center;color:var(--muted);padding:22px">Sin OLTs.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (testResults().length) {
      <div class="panel" style="margin-top:12px">
        <div class="ph">🧪 Resultado de la prueba</div>
        <div class="pb">
          @for (r of testResults(); track r.channel) {
            <div style="display:flex;gap:10px;align-items:center;padding:6px 0;font-size:13px">
              <span style="width:90px;font-weight:600">{{ r.channel }}</span>
              @if (r.ok) { <span style="color:var(--green);font-weight:600">✓ Enviado</span> }
              @else { <span style="color:var(--red);font-weight:600">✕ Falló</span> <span style="color:var(--muted)">{{ r.error }}</span> }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Dos cuadros por fila (estilo compacto del NOC) */
    .cards { display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:stretch; }
    @media (max-width:1000px){ .cards{ grid-template-columns:1fr; } }
    .ph { padding:10px 14px; font-size:13.5px; border-radius:12px 12px 0 0; font-weight:700; }
    .ph.gen  { background:#fff1e6; color:#c2410c; }
    .ph.tg   { background:#e9f5fc; color:#1c7bbf; }
    .ph.mail { background:#fdf6e0; color:#8a6d00; }
    .ph.wa   { background:#e8f8ef; color:#128c4b; }
    .ph.msg  { background:#f1f0f8; color:#5b4b8a; }
    .pb { padding:12px 14px; }
    .grid { display:grid; grid-template-columns:1fr; gap:8px; }
    .fld.wide, .chk, .help { grid-column:1 / -1; }
    .fld { display:flex; flex-direction:column; gap:2px; }
    .fld label { font-size:11px; color:var(--muted); font-weight:600; }
    .fld .inp { padding:8px 12px; font-size:13px; width:100%; }
    .fld select.inp, .fld input.inp { height:38px; }
    .fld textarea.inp { height:auto; }
    /* card General compacto: 2 columnas, mismo look, misma altura que Telegram */
    .compact { grid-template-columns:1fr 1fr; gap:6px 10px; padding:10px 14px 12px; }
    .compact .chk { grid-column:1 / -1; font-size:11.5px; padding-bottom:0; gap:6px; }
    .compact .chk input { width:15px; height:15px; }
    .compact .chk .mut { display:none; }
    .compact .fld { gap:1px; }
    .compact .fld.wide { grid-column:auto; }
    .compact .fld label { font-size:11px; }
    .compact .fld select.inp, .compact .fld input.inp { height:30px; padding:3px 9px; font-size:12.5px; }
    .chk { display:flex; align-items:center; gap:8px; font-size:13px; padding-bottom:2px; }
    .chk input { width:16px; height:16px; }
    .mut { color:var(--muted); font-weight:400; }
    .help { font-size:11px; color:#555; background:#f8fafc; border:1px solid var(--border);
            border-radius:8px; padding:7px 10px; line-height:1.45; }
    .help code { background:#eef1f6; padding:1px 5px; border-radius:4px; font-size:11px; }
    .msg2col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    @media (max-width:800px){ .msg2col{ grid-template-columns:1fr; } }
    .lbl { font-size:11px; color:var(--muted); font-weight:600; margin-bottom:4px; }
    .vars { font-size:11px; color:var(--muted); margin-top:6px; }
    .bubble { white-space:pre-line; font-size:13px; line-height:1.55; padding:12px 14px; border:1px solid var(--border);
              border-radius:10px; background:#fff; min-height:130px; }
    .bubble.crit { border-left:3px solid var(--red); }
    .bubble.warn { border-left:3px solid var(--amber); }
  `],
})
export class Notificaciones {
  private api = inject(NocApi);
  cfg: Record<string, string> = {};
  msg = signal('');
  testResults = signal<any[]>([]);
  devs = signal<any[]>([]);
  testType = 'generic';
  testChannel = '';
  testBody = '';

  private SAMPLES: Record<string, { sev: string; desc: string; equipo: string; onu: string }> = {
    generic: { sev: 'crit', desc: '✅ Prueba de notificación del NOC Inno Fiber', equipo: 'Inno Fiber', onu: '—' },
    cpu: { sev: 'crit', desc: 'CPU crítica 96%', equipo: 'SERVER CAYAMBE 1', onu: 'CPU' },
    down: { sev: 'crit', desc: 'Equipo sin respuesta (caído) · 172.30.0.2', equipo: 'SERVER IBARRA 1', onu: 'EQUIPO' },
    iface: { sev: 'warn', desc: 'Interfaz caída: ether1', equipo: 'SERVER SAN JOSE DE MORAN', onu: 'ether1' },
    iface_err: { sev: 'warn', desc: 'Errores en interfaz ether5 (+45)', equipo: 'SERVER CAYAMBE 2', onu: 'ether5' },
    reboot: { sev: 'crit', desc: 'Equipo reinició (uptime 95 s)', equipo: 'SERVER IBARRA 1', onu: 'REBOOT' },
    los: { sev: 'crit', desc: 'Corte de fibra (LOS) · 2381 LEMA MARCIA ANTONIETA (1/2/1:5)', equipo: 'OLT ZTE CAYAMBE', onu: '1/2/1:5' },
    signal: { sev: 'crit', desc: 'Señal crítica -29.2 dBm · 2381 LEMA MARCIA ANTONIETA (1/3/8:12)', equipo: 'OLT ZTE TABACUNDO', onu: '1/3/8:12' },
    offline: { sev: 'warn', desc: 'ONU caída (offline) · 2381 LEMA MARCIA ANTONIETA (1/2/1:6)', equipo: 'OLT ZTE CAYAMBE', onu: '1/2/1:6' },
    pon: { sev: 'crit', desc: 'Puerto PON gpon_1/8/1 saturado · 920 Mbps', equipo: 'OLT ZTE CAYAMBE', onu: 'gpon_1/8/1' },
    pon_down: { sev: 'crit', desc: 'Puerto PON gpon_1/8/1 caído', equipo: 'OLT ZTE CAYAMBE', onu: 'gpon_1/8/1' },
    recovery: { sev: 'warn', desc: 'CPU volvió a la normalidad (42%)', equipo: 'SERVER CAYAMBE 1', onu: 'CPU' },
  };

  /** Arma el mensaje del tipo elegido con la plantilla actual (título + cuerpo con variables). */
  private render(type: string): string {
    const s = this.SAMPLES[type] || this.SAMPLES['generic'];
    const severidad = type === 'recovery' ? '✅ Recuperado' : (s.sev === 'crit' ? '🔴 CRÍTICA' : '🟠 Advertencia');
    return (this.cfg['notify_body'] || '')
      .replaceAll('{severidad}', severidad)
      .replaceAll('{descripcion}', s.desc)
      .replaceAll('{equipo}', s.equipo)
      .replaceAll('{onu}', s.onu)
      .replaceAll('{hora}', '04/07/2026 18:33:10')
      .trim();
  }

  /** Al cambiar el tipo (o editar la plantilla), re-renderiza cómo se envía. */
  onTypeChange() { this.testBody = this.render(this.testType); }
  /** Severidad del tipo elegido (para el color del globo). */
  sevOf(): string { return (this.SAMPLES[this.testType] || this.SAMPLES['generic']).sev; }

  equipoCols = [
    { k: 'down', l: 'Caída' }, { k: 'cpu', l: 'CPU' }, { k: 'mem', l: 'Memoria' }, { k: 'temp', l: 'Temp' },
    { k: 'iface', l: 'Tráfico if.' }, { k: 'iface_err', l: 'Errores if.' }, { k: 'reboot', l: 'Reinicios' },
  ];
  oltCols = [
    { k: 'down', l: 'Caída' }, { k: 'signal', l: 'Señal clientes' }, { k: 'pon', l: 'Puerto PON' },
    { k: 'lpu', l: 'Tarjeta (LPU)' }, { k: 'cpu', l: 'CPU' }, { k: 'temp', l: 'Temp' },
  ];

  eqDevs = () => this.devs().filter((d) => d.device_type !== 'olt');
  oltDevs = () => this.devs().filter((d) => d.device_type === 'olt');

  private colsFor(t: string): string[] {
    return (t === 'olt' ? this.oltCols : this.equipoCols).map((c) => c.k);
  }
  /** Categorías habilitadas de un equipo: null = todas (por defecto). */
  private enabled(d: any): string[] {
    return d.alert_cats == null ? this.colsFor(d.device_type) : String(d.alert_cats).split(',').filter(Boolean);
  }
  isOn(d: any, cat: string): boolean { return this.enabled(d).includes(cat); }

  toggle(d: any, cat: string, on: boolean) {
    const set = new Set(this.enabled(d));
    if (on) set.add(cat); else set.delete(cat);
    d.alert_cats = [...set].join(',');
    this.devs.set([...this.devs()]);
    this.api.notifyUpdateDeviceAlert(d.id, { cats: d.alert_cats }).subscribe();
  }

  constructor() {
    this.api.settings().subscribe((s) => {
      const m: Record<string, string> = {};
      s.filter((x) => String(x.settingKey).startsWith('notify_'))
        .forEach((x) => (m[x.settingKey] = String(x.settingValue ?? '')));
      this.cfg = m;
      this.onTypeChange();   // llena el cuadro editable con el tipo por defecto
    });
    this.api.notifyDeviceAlerts().subscribe((d) => this.devs.set(d));
  }

  /** Guarda la plantilla y manda el mensaje renderizado (columna "cómo se envía"). */
  runTest() {
    this.testResults.set([]);
    this.flash('Guardando y enviando…');
    this.saveAllSilent().then(() => {
      this.api.notifyTest(this.testChannel || undefined, this.testType, this.testBody).subscribe({
        next: (r) => { this.testResults.set(r); this.msg.set(''); },
        error: () => this.flash('No se pudo enviar la prueba.'),
      });
    });
  }

  stBadge(s: string): string {
    if (s === 'up') return '<span class="badge b-up">UP</span>';
    if (s === 'down') return '<span class="badge b-down">DOWN</span>';
    return '<span class="badge b-maint">—</span>';
  }

  /** Cambia un valor y lo guarda al instante (para los interruptores). */
  set(key: string, value: string) {
    this.cfg[key] = value;
    this.api.updateSetting(key, value).subscribe();
  }

  saveAll() {
    const keys = Object.keys(this.cfg);
    let done = 0;
    keys.forEach((k) => this.api.updateSetting(k, this.cfg[k]).subscribe({
      next: () => { if (++done === keys.length) this.flash('✓ Configuración guardada.'); },
      error: () => this.flash('No se pudo guardar todo.'),
    }));
  }

  test(channel: string) {
    this.testResults.set([]);
    this.flash('Enviando prueba…');
    // Guarda primero para que el backend use lo último tipeado.
    this.saveAllSilent().then(() => {
      this.api.notifyTest(channel).subscribe({
        next: (r) => { this.testResults.set(r); this.msg.set(''); },
        error: () => this.flash('No se pudo enviar la prueba.'),
      });
    });
  }

  private saveAllSilent(): Promise<void> {
    const keys = Object.keys(this.cfg);
    return Promise.all(keys.map((k) => new Promise<void>((res) =>
      this.api.updateSetting(k, this.cfg[k]).subscribe({ next: () => res(), error: () => res() })))).then(() => {});
  }

  private flash(m: string) { this.msg.set(m); setTimeout(() => { if (this.msg() === m) this.msg.set(''); }, 4000); }
}
