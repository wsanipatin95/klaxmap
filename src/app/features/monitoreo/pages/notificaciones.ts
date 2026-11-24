import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

/**
 * Configuración de NOTIFICACIONES (Telegram / correo / WhatsApp / teléfono).
 * Lee y guarda los settings notify_* (config en vivo) y permite PROBAR cada canal.
 */
@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [FormsModule],
  template: `

    @if (msg()) { <div class="panel" style="margin-bottom:12px"><div class="pb" style="color:var(--green);font-weight:600;padding:10px 14px">{{ msg() }}</div></div> }

    <!-- Submenus: un canal a la vez, para que no quede todo amontonado. El punto verde dice si
         el canal esta activado. -->
    <!-- Submenus y Guardar en una sola fila: el titulo «Notificaciones» ya lo dice la pestaña de arriba. -->
    <div class="barra">
      <div class="subtabs" role="tablist">
        @for (t of subtabs; track t.k) {
          <button type="button" role="tab" [class.on]="sub() === t.k" [attr.aria-selected]="sub() === t.k" (click)="sub.set(t.k)">
            <i [class]="'pi ' + t.i"></i>{{ t.l }}
            @if (t.canal) { <span class="dot" [class.on]="cfg['notify_' + t.canal + '_enabled'] === '1'"></span> }
          </button>
        }
      </div>
      <button class="btn" (click)="saveAll()"><i class="pi pi-save"></i> Guardar cambios</button>
    </div>

    <div class="cards" [class.dos]="sub() === 'general'" [class.canal]="!!canalActual()">
    @if (sub() === 'general') {
    <!-- General -->
    <div class="panel">
      <div class="ph gen"><span class="t"><i class="pi pi-cog"></i> General</span></div>
      <div class="pb ajustes">
        <div class="aj">
          <div class="aj-t"><b>Notificaciones activas</b><small>Apagado, no sale ningún aviso por ningún canal</small></div>
          <input type="checkbox" class="sw" [checked]="cfg['notify_enabled']==='1'" (change)="set('notify_enabled', $any($event.target).checked?'1':'0')" aria-label="Notificaciones activas">
        </div>
        <div class="aj">
          <div class="aj-t"><b>Avisar recuperación</b><small>Manda «✅ Recuperado» cuando la alerta se normaliza</small></div>
          <input type="checkbox" class="sw" [checked]="cfg['notify_recovery_enabled']==='1'" (change)="set('notify_recovery_enabled', $any($event.target).checked?'1':'0')" aria-label="Avisar recuperación">
        </div>
        <div class="aj">
          <div class="aj-t"><b>Nivel mínimo</b><small>Qué alertas se avisan</small></div>
          <select class="inp" [(ngModel)]="cfg['notify_min_severity']">
            <option value="crit">Solo críticas</option>
            <option value="warn">Advertencias y críticas</option>
          </select>
        </div>
        <div class="aj">
          <div class="aj-t"><b>Silencio del mismo aviso</b><small>No repetir el mismo aviso antes de</small></div>
          <span class="num"><input class="inp" type="number" min="0" [(ngModel)]="cfg['notify_cooldown_seconds']"><em>seg</em></span>
        </div>
        <div class="aj">
          <div class="aj-t"><b>Revisar alertas cada</b><small>Cada cuánto busca alertas nuevas</small></div>
          <span class="num"><input class="inp" type="number" min="5" [(ngModel)]="cfg['notify_tick_seconds']"><em>seg</em></span>
        </div>
        <div class="aj">
          <div class="aj-t"><b>Solo cambios recientes</b><small>Ignora alertas más viejas que</small></div>
          <span class="num"><input class="inp" type="number" min="60" [(ngModel)]="cfg['notify_max_age_seconds']"><em>seg</em></span>
        </div>
      </div>
    </div>

    }
    @if (sub() === 'telegram') {
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
        <div class="fld"><label>Chat Infraestructura <span class="mut">(core, borde, OLT, energía)</span></label>
          <input class="inp" [(ngModel)]="cfg['notify_telegram_chat']" placeholder="-1001234567890">
        </div>
        <div class="fld"><label>Chat Clientes <span class="mut">(cada ONU · opcional)</span></label>
          <input class="inp" [(ngModel)]="cfg['notify_telegram_chat_gpon']" placeholder="vacío = usa el de arriba">
        </div>
      </div>
    </div>

    }
    @if (sub() === 'email') {
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
        <div class="fld"><label>Destinatarios Infraestructura <span class="mut">(coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_email_to']" placeholder="a@x.com, b@y.com"></div>
        <div class="fld"><label>Destinatarios Clientes <span class="mut">(cada ONU · opcional · coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_email_to_gpon']" placeholder="vacío = usa los de arriba"></div>
      </div>
    </div>

    }
    @if (sub() === 'whatsapp') {
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
        <div class="fld"><label>Número(s) Infraestructura <span class="mut">(coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_whatsapp_to']" placeholder="5939xxxxxxx"></div>
        <div class="fld"><label>Número(s) Clientes <span class="mut">(cada ONU · opcional · coma)</span></label><input class="inp" [(ngModel)]="cfg['notify_whatsapp_to_gpon']" placeholder="vacío = usa los de arriba"></div>
      </div>
    </div>

    }
    @if (sub() === 'push') {
    <!-- Telefono (app de monitoreo) -->
    <div class="panel">
      <div class="ph"><i class="pi pi-mobile" style="margin-right:7px"></i>Teléfono (app de monitoreo)
        <button class="btn sm ghost" style="margin-left:auto" (click)="test('push')">Probar</button>
      </div>
      <div class="pb grid compact">
        <div class="fld wide"><label>URL de omnicanal</label><input class="inp" [(ngModel)]="cfg['notify_push_url']" placeholder="http://localhost:8087/api/erp/public/push/avisar-tokens"></div>
        <div class="fld"><label>Token de servicio</label><input class="inp" type="password" [(ngModel)]="cfg['notify_push_token']"></div>
        <div class="fld wide mut" style="font-size:12px">Siempre encendido: le llega a todos los que tengan sesión abierta en la app de monitoreo. Esto se configura una sola vez. En la app, la campanita de Alertas manda una prueba.</div>
      </div>
    </div>

    }
    @if (canalActual(); as c) {
    <!-- Que avisa el canal elegido: lista con interruptores, agrupada en Infraestructura y Clientes. -->
    <div class="panel avisa">
      <div class="ph av">
        <span class="t"><i class="pi pi-filter"></i> Qué avisa</span>
        <span class="cuenta">{{ cuantos(c) }} de {{ totalItems() }}</span>
      </div>
      <div class="pb">
        @for (g of gruposAviso; track g.k) {
          <div class="avg">
            <div class="avg-h">
              <div class="avg-t"><b>{{ g.l }}</b><small>{{ g.d }}</small></div>
              <input type="checkbox" class="sw" [checked]="grupoOn(c, g)" [indeterminate]="grupoParcial(c, g)"
                     (change)="setGrupo(c, g, $any($event.target).checked)" [attr.aria-label]="'Todo ' + g.l">
            </div>
            <div class="avg-list">
              @for (it of g.items; track it.l) {
                <label class="row" [class.off]="!itemOn(c, it)">
                  <span>{{ it.l }}</span>
                  <input type="checkbox" class="sw sm" [checked]="itemOn(c, it)" (change)="setItem(c, it, $any($event.target).checked)">
                </label>
              }
            </div>
          </div>
        }
      </div>
    </div>
    }
    @if (sub() === 'general') {
    <!-- Mensaje configurable -->
    <div class="panel">
      <div class="ph msg msg-h">
        <span class="t"><i class="pi pi-pencil"></i> Mensaje a enviar</span>
        <div class="prueba">
          <select class="inp sm" [(ngModel)]="testType" (ngModelChange)="onTypeChange()">
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
            <option value="recovery">Recuperación</option>
          </select>
          <select class="inp sm" [(ngModel)]="testChannel">
            <option value="">Todos los canales</option>
            <option value="telegram">Telegram</option>
            <option value="email">Correo</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="push">Teléfono</option>
          </select>
          <button class="btn sm" (click)="runTest()"><i class="pi pi-send"></i> Probar</button>
        </div>
      </div>
      <div class="pb">

        <div class="msg2col">
          <div>
            <div class="lbl aviso"><i class="pi pi-pencil"></i> Lo que va <span class="mut">editá todo el mensaje acá</span></div>
            <textarea class="inp cuerpo" [(ngModel)]="cfg['notify_body']" (ngModelChange)="onTypeChange()"></textarea>
            <div class="vars">Variables (las rellena el sistema): {{ '{' }}severidad{{ '}' }} · {{ '{' }}descripcion{{ '}' }} · {{ '{' }}equipo{{ '}' }} · {{ '{' }}onu{{ '}' }} · {{ '{' }}hora{{ '}' }}</div>
          </div>
          <div>
            <div class="lbl aviso"><i class="pi pi-send"></i> Cómo se envía <span class="mut">así llega el aviso</span></div>
            <div class="bubble" [class.crit]="sevOf()==='crit'" [class.warn]="sevOf()!=='crit'">{{ testBody }}</div>
          </div>
        </div>
      </div>
    </div>
    }
    </div>


    @if (testResults().length) {
      <div class="panel" style="margin-top:12px">
        <div class="ph"><span class="t"><i class="pi pi-play"></i> Resultado de la prueba</span></div>
        <div class="pb">
          @for (r of testResults(); track r.channel) {
            <div style="display:flex;gap:10px;align-items:center;padding:6px 0;font-size:13px">
              <span style="width:90px;font-weight:600">{{ r.channel }}</span>
              @if (r.ok) { <span style="color:var(--green);font-weight:600">Enviado</span> }
              @else { <span style="color:var(--red);font-weight:600">Falló</span> <span style="color:var(--muted)">{{ r.error }}</span> }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Dos cuadros por fila (estilo compacto del NOC) */
    /* Un canal a la vez (submenus): una columna con ancho de lectura comodo. */
    .cards { display:grid; grid-template-columns:minmax(0, 920px); gap:12px; align-items:start; }
    .barra { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:0 0 12px; }
    .barra .btn { margin-left:auto; }
    .subtabs { display:flex; flex-wrap:wrap; gap:4px; width:fit-content; max-width:100%; margin:0;
               padding:4px; background:#f1f5f9; border-radius:10px; }
    .subtabs button { display:inline-flex; align-items:center; gap:7px; border:0; background:transparent;
                      padding:7px 14px; border-radius:8px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; }
    .subtabs button:hover:not(.on) { color:#1f2937; }
    .subtabs button.on { background:#fff; color:#7b0061; box-shadow:0 1px 2px rgba(16,24,40,.12); }
    .subtabs .dot { width:7px; height:7px; border-radius:50%; background:#cbd5e1; }
    .subtabs .dot.on { background:#16a34a; }
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
    /* Interruptores (en vez de casillas): el estado se lee de un vistazo. */
    .chk input[type=checkbox], input.sw { appearance:none; -webkit-appearance:none; position:relative; flex:none; margin:0;
      width:36px !important; height:20px !important; border-radius:999px; background:#cbd5e1; cursor:pointer; transition:background .15s; }
    .chk input[type=checkbox]::after, input.sw::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px;
      border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(15,23,42,.25); transition:transform .15s; }
    .chk input[type=checkbox]:checked, input.sw:checked { background:#7b0061; }
    .chk input[type=checkbox]:checked::after, input.sw:checked::after { transform:translateX(16px); }
    input.sw:indeterminate { background:#c98bb8; }
    input.sw:indeterminate::after { transform:translateX(8px); }
    input.sw.sm { width:30px !important; height:17px !important; }
    input.sw.sm::after { width:13px; height:13px; }
    input.sw.sm:checked::after { transform:translateX(13px); }
    .chk input[type=checkbox]:focus-visible, input.sw:focus-visible { outline:2px solid #e7b9da; outline-offset:2px; }
    .chk { display:flex; align-items:center; gap:10px; }

    /* Canal: conexion a la izquierda, «Que avisa» a la derecha. */
    .cards.canal { grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); max-width:1240px; align-items:start; }
    @media (max-width:1100px) { .cards.canal { grid-template-columns:1fr; } }
    .ph.av { display:flex; align-items:center; background:#f6f2f8; color:#6b2160; }
    .ph.av .cuenta { margin-left:auto; font-size:11.5px; font-weight:600; color:#7b0061; background:#fff;
                     border:1px solid #ecd6e6; border-radius:999px; padding:2px 10px; }
    .avisa .pb { display:flex; flex-direction:column; gap:10px; padding:10px 14px 12px; }
    .avg-h { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:6px;
             border-bottom:1px solid var(--border); }
    .avg-t b { display:block; font-size:13px; color:#1f2937; }
    .avg-t small { display:block; font-size:11.5px; color:var(--muted); margin-top:1px; }
    .avg-list { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; padding-top:4px; }
    .avg-list .row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:4px 8px;
                     border-radius:8px; font-size:12.5px; color:#334155; cursor:pointer; }
    .avg-list .row:hover { background:#f8fafc; }
    .avg-list .row.off span { color:#94a3b8; }
    /* General como lista de ajustes: nombre y explicacion a la izquierda, control a la derecha. */
    .ajustes { display:flex; flex-direction:column; padding:2px 14px 6px; }
    .aj { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 0; border-bottom:1px solid var(--border); }
    .aj:last-child { border-bottom:0; }
    .aj-t b { display:block; font-size:12.5px; color:#1f2937; }
    .aj-t small { display:block; font-size:11px; color:var(--muted); margin-top:1px; }
    .aj select.inp { width:170px; height:32px; padding:4px 8px; font-size:12.5px; }
    .aj .num { display:inline-flex; align-items:center; gap:6px; }
    .aj .num input.inp { width:84px; height:32px; padding:4px 8px; font-size:12.5px; text-align:right; }
    .aj .num em { font-style:normal; font-size:11.5px; color:var(--muted); width:24px; }
    /* Mensaje: la prueba va en la cabecera; texto y vista previa del mismo alto. */
    .msg-h { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:7px 14px; }
    .prueba { margin-left:auto; display:flex; align-items:center; gap:6px; }
    .prueba select.inp.sm { height:30px; padding:2px 8px; font-size:12px; width:auto; max-width:190px; }
    textarea.inp.cuerpo { width:100%; height:170px; resize:none; font-family:inherit; font-size:13px; line-height:1.55; }
    .msg2col .bubble { height:170px; overflow:auto; box-sizing:border-box; }
    /* General: los ajustes y el mensaje lado a lado, para que entre en una pantalla sin scroll. */
    .cards.dos { grid-template-columns:minmax(300px, 380px) minmax(0, 1fr); max-width:none; }
    @media (max-width:1100px) { .cards.dos { grid-template-columns:1fr; } }
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


  constructor() {
    this.api.settings().subscribe((s) => {
      const m: Record<string, string> = {};
      s.filter((x) => String(x.settingKey).startsWith('notify_'))
        .forEach((x) => (m[x.settingKey] = String(x.settingValue ?? '')));
      this.cfg = m;
      this.onTypeChange();   // llena el cuadro editable con el tipo por defecto
    });
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


  /** Submenu visible. «canal» = clave de su interruptor (notify_<canal>_enabled) para el punto verde. */
  readonly sub = signal<'general' | 'telegram' | 'email' | 'whatsapp' | 'push'>('general');
  readonly subtabs: { k: 'general' | 'telegram' | 'email' | 'whatsapp' | 'push'; l: string; i: string; canal?: string }[] = [
    { k: 'general', l: 'General', i: 'pi-cog' },
    { k: 'telegram', l: 'Telegram', i: 'pi-telegram', canal: 'telegram' },
    { k: 'email', l: 'Correo', i: 'pi-envelope', canal: 'email' },
    { k: 'whatsapp', l: 'WhatsApp', i: 'pi-whatsapp', canal: 'whatsapp' },
    { k: 'push', l: 'Teléfono', i: 'pi-mobile' },
  ];

  /**
   * Lo que puede avisar cada canal, con las categorias REALES de las alertas del NOC. Se guarda
   * en notify_<canal>_cats: '' = todas (como siempre), 'ninguna' = nada, o la lista.
   */
  readonly gruposAviso: { k: string; l: string; d: string; items: { l: string; cats: string[] }[] }[] = [
    { k: 'infra', l: 'Infraestructura', d: 'Core, borde, OLT y energía', items: [
      { l: 'Equipo caído', cats: ['down'] },
      { l: 'Energía · generador, relé, voltaje', cats: ['energia'] },
      { l: 'Puerto PON caído', cats: ['pon'] },
      { l: 'CPU', cats: ['cpu'] },
      { l: 'Memoria', cats: ['mem'] },
      { l: 'Temperatura', cats: ['temp'] },
      { l: 'Interfaces', cats: ['iface'] },
      { l: 'Errores de interfaz', cats: ['iface_err', 'iface_crc'] },
      { l: 'Reinicios', cats: ['reboot'] },
      { l: 'Respaldos', cats: ['respaldo'] },
    ] },
    { k: 'clientes', l: 'Clientes', d: 'Cada ONU de cliente', items: [
      { l: 'Señal y caída de cada ONU', cats: ['signal'] },
    ] },
  ];

  /** Canal del submenu abierto (null en General). */
  canalActual(): string | null {
    const k = this.sub();
    return k === 'general' ? null : k;
  }

  totalItems(): number { return this.gruposAviso.reduce((n, g) => n + g.items.length, 0); }

  cuantos(c: string): number { return this.gruposAviso.reduce((n, g) => n + g.items.filter((i) => this.itemOn(c, i)).length, 0); }

  private todasCats(): string[] { return this.gruposAviso.flatMap((g) => g.items.flatMap((i) => i.cats)); }

  private catsDe(c: string): Set<string> {
    const v = (this.cfg['notify_' + c + '_cats'] ?? '').trim();
    if (v === '') return new Set(this.todasCats());
    if (v === 'ninguna') return new Set();
    return new Set(v.split(',').map((x) => x.trim()).filter(Boolean));
  }

  private guardarCats(c: string, sel: Set<string>) {
    const v = this.todasCats().every((k) => sel.has(k)) ? '' : (sel.size ? [...sel].join(',') : 'ninguna');
    this.set('notify_' + c + '_cats', v);
  }

  itemOn(c: string, it: { cats: string[] }): boolean { const sel = this.catsDe(c); return it.cats.every((k) => sel.has(k)); }

  setItem(c: string, it: { cats: string[] }, on: boolean) {
    const sel = this.catsDe(c);
    it.cats.forEach((k) => (on ? sel.add(k) : sel.delete(k)));
    this.guardarCats(c, sel);
  }

  grupoOn(c: string, g: { items: { cats: string[] }[] }): boolean { return g.items.every((i) => this.itemOn(c, i)); }

  grupoParcial(c: string, g: { items: { cats: string[] }[] }): boolean {
    const n = g.items.filter((i) => this.itemOn(c, i)).length;
    return n > 0 && n < g.items.length;
  }

  setGrupo(c: string, g: { items: { cats: string[] }[] }, on: boolean) {
    const sel = this.catsDe(c);
    g.items.forEach((i) => i.cats.forEach((k) => (on ? sel.add(k) : sel.delete(k))));
    this.guardarCats(c, sel);
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
      next: () => { if (++done === keys.length) this.flash('Configuración guardada.'); },
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
