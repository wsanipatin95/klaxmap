import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NocApi, OnuRow, ZteOltRow } from '../services/noc-api';
import { NocNotify } from '../services/noc-notify';

/**
 * Configurar OLT = módulo de la OLT en general (2026-11-16).
 *
 * Todo lo que se LEE sale por SNMP (barrido del NOC + lecturas en vivo); todo lo que se
 * ESCRIBE es un botón con plantilla del NOC (vista previa, confirmación, permiso, registro).
 * Nada de consola.
 *
 *   Resumen · Puertos PON · Tarjetas · VLAN y perfiles · Sistema · Historial
 *
 * Los botones de CLIENTE (reiniciar ONU, cortar, desenganchar, activar...) NO van aquí: se
 * usan desde Omni y el legacy con GET /api/olt-config/botonera/{onuId}. La versión de esta
 * pantalla con la botonera del cliente quedó en olt-config.ts.bak_cliente como referencia.
 */
type Tab = 'puertos' | 'tarjetas' | 'red' | 'sistema' | 'historial';

interface PuertoFila {
  nombre: string; shelf: number; slot: number; port: number;
  total: number; enLinea: number; caidas: number; los: number; libres: number;
  laser: number | null; bajada: number | null; subida: number | null;
}

@Component({
  selector: 'app-olt-config',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="oc">
    <!-- ENCABEZADO -->
    <header class="oc-head">
      <div>
        <h1><i class="pi pi-server"></i> Configurar OLT</h1>
        <p>Estado por SNMP y configuración de la OLT con botones, sin entrar por consola.</p>
      </div>
      <button type="button" class="oc-switch" [class.on]="writeEnabled()" (click)="toggleWrite()"
              title="Habilita las acciones que cambian algo en la OLT. Se apaga solo tras unos minutos sin uso.">
        <span class="knob"></span>
        <span class="lbl">
          <b>Envío a la OLT</b>
          <small>{{ writeEnabled() ? 'Encendido · las acciones se pueden enviar' : 'Apagado · solo consulta' }}</small>
        </span>
      </button>
    </header>

    @if (estado() && estado().puedeOperar === false) {
      <div class="oc-alert"><i class="pi pi-lock"></i>
        <span><b>Tu usuario no puede operar la OLT.</b> Puedes ver el estado, pero no ejecutar acciones. El permiso se asigna en el ERP.</span>
      </div>
    }

    <!-- OLT -->
    <div class="oc-bar">
      <div class="oc-field oc-olt">
        <i class="pi pi-server"></i>
        <select [ngModel]="oltId()" (ngModelChange)="elegirOlt($event)">
          <option [ngValue]="null">Selecciona la OLT</option>
          @for (o of olts(); track o.id) { <option [ngValue]="o.id">{{ o.name }}</option> }
        </select>
      </div>
      @if (olt(); as o) {
        <div class="oc-olt-meta">
          <span><i class="pi pi-globe"></i> <span class="mono">{{ o.host }}</span></span>
          <span><i class="pi pi-microchip"></i> {{ o.model || 'C300' }} · {{ familia() || '—' }}</span>
          <span [class.warn]="viejo(o.lastSnmpAt)"><i class="pi pi-clock"></i> Barrido {{ hace(o.lastSnmpAt) }}</span>
        </div>
        <button type="button" class="oc-btn ghost" (click)="recargar(true)" [disabled]="cargando()">
          <i class="pi pi-refresh" [class.oc-spin]="cargando()"></i> Leer ahora
        </button>
      }
    </div>

    @if (!olt()) {
      <section class="oc-card oc-empty">
        <div class="em-ic"><i class="pi pi-server"></i></div>
        <b>Selecciona una OLT</b>
        <span>Verás su estado por SNMP (puertos, tarjetas, clientes) y las acciones de configuración.</span>
      </section>
    } @else {
      @if (viejo(olt()!.lastSnmpAt)) {
        <div class="oc-stale"><i class="pi pi-exclamation-circle"></i>
          <span><b>El NOC no logra leer esta OLT por SNMP</b> desde {{ hace(olt()!.lastSnmpAt) }}. Los números de abajo son de la última lectura buena.
            Revisa que la OLT esté en línea y que el NOC le llegue.</span>
        </div>
      }

      <!-- PESTAÑAS -->
      <nav class="oc-tabs">
        @for (t of tabs; track t.id) {
          <button type="button" [class.on]="tab()===t.id" (click)="tab.set(t.id)">
            <i [class]="'pi ' + t.icono"></i> {{ t.label }}
            @if (t.id === 'puertos') { <em>{{ puertos().length }}</em> }
            @if (t.id === 'tarjetas' && tarjetasLista().length) { <em>{{ tarjetasLista().length }}</em> }
          </button>
        }
      </nav>

      <!-- ===================== PUERTOS PON ===================== -->
      @if (tab() === 'puertos') {
        <section class="oc-card">
          <header class="oc-ch">
            <h2>Puertos PON</h2>
            <div class="oc-slots">
              <button type="button" [class.on]="slotFiltro() === null" (click)="slotFiltro.set(null)">Todos</button>
              @for (sl of slots(); track sl) {
                <button type="button" [class.on]="slotFiltro() === sl" (click)="slotFiltro.set(sl)">Slot {{ sl }}</button>
              }
            </div>
          </header>
          <div class="oc-cards">
            @for (p of puertosVisibles(); track p.nombre) {
              <div class="oc-tcard">
                <div class="t-top">
                  <span class="t-slot mono">{{ p.nombre }}</span>
                  <span class="t-kind">Puerto PON</span>
                </div>
                <div class="t-cli">{{ p.total ? p.total + ' clientes · ' + p.enLinea + ' en línea' : 'Sin clientes' }}</div>
                <div class="p-btns">
                  @for (b of botonesPuerto(); track b.accion) {
                    <button type="button" class="oc-btn ghost sm" (click)="abrir(b, p)">
                      <i [class]="'pi ' + icono(b.accion)"></i> {{ corto(b.accion) }}
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <div class="oc-none">Sin puertos.</div>
            }
          </div>
        </section>
      }

      <!-- ===================== TARJETAS ===================== -->
      @if (tab() === 'tarjetas') {
        <section class="oc-card">
          <header class="oc-ch">
            <h2>Tarjetas</h2>
            <span class="mut">Temperatura leída en vivo por SNMP {{ tarjetasEn() ? '· ' + hace(tarjetasEn()) : '' }}</span>
            <button type="button" class="oc-btn ghost sm" style="margin-left:auto" (click)="leerTarjetas()" [disabled]="leyendoTarjetas()">
              <i class="pi pi-refresh" [class.oc-spin]="leyendoTarjetas()"></i> Leer
            </button>
          </header>
          @if (tarjetasMsg()) { <div class="oc-stale inner"><i class="pi pi-info-circle"></i><span>{{ tarjetasMsg() }}</span></div> }
          <div class="oc-cards">
            @for (t of tarjetasLista(); track t.slot) {
              <div class="oc-tcard">
                <div class="t-top">
                  <span class="t-slot">Slot {{ t.slot }}</span>
                  <span class="t-kind">{{ t.pon ? 'GPON · ' + t.pon + ' puertos' : 'Control / uplink' }}</span>
                </div>
                <div class="t-temp" [class]="'t-temp ' + claseTemp(t.temp)">{{ t.temp ?? '—' }}<em>°C</em></div>
                <div class="t-cli">{{ t.clientes ? t.clientes + ' clientes · ' + t.enLinea + ' en línea' : 'Sin clientes' }}</div>
                @if (botonTarjeta(); as b) {
                  <button type="button" class="oc-btn ghost sm full" (click)="abrir(b, null, t.slot)">
                    <i [class]="'pi ' + icono(b.accion)"></i> Reiniciar tarjeta
                  </button>
                }
              </div>
            } @empty {
              <div class="oc-none">{{ leyendoTarjetas() ? 'Leyendo tarjetas…' : 'Sin datos de tarjetas.' }}</div>
            }
          </div>
        </section>
      }

      <!-- ===================== VLAN Y PERFILES ===================== -->
      @if (tab() === 'red') {
        <section class="oc-card">
          <header class="oc-ch"><h2>VLAN y perfiles de tráfico</h2>
            <span class="mut">Se crean en la OLT; no cambian a ningún cliente.</span></header>
          <div class="oc-acts">
            @for (b of botonesDe(['crear_vlan','vlan_uplink','perfil_subida','perfil_bajada']); track b.accion) {
              <button type="button" [class]="'oc-act ' + b.danger" (click)="abrir(b)">
                <span class="ic"><i [class]="'pi ' + icono(b.accion)"></i></span>
                <span class="tx"><b>{{ b.name }}</b><small>{{ descripcion(b.accion) }}</small></span>
                @if (!b.validado) { <span class="tag">Sin probar</span> }
              </button>
            }
          </div>
          <div class="oc-note-foot"><i class="pi pi-info-circle"></i>
            La lista de VLAN y perfiles que ya existen en la OLT todavía no se puede leer por SNMP (no hay OID validado).</div>
        </section>
      }

      <!-- ===================== SISTEMA ===================== -->
      @if (tab() === 'sistema') {
        <section class="oc-card">
          <header class="oc-ch"><h2>Sistema</h2><span class="mut">{{ olt()!.name }}</span></header>
          <div class="oc-acts">
            @for (b of botonesDe(['guardar','rogue_detect','reboot_olt']); track b.accion) {
              <button type="button" [class]="'oc-act ' + b.danger" (click)="abrir(b)">
                <span class="ic"><i [class]="'pi ' + icono(b.accion)"></i></span>
                <span class="tx"><b>{{ b.name }}</b><small>{{ descripcion(b.accion) }}</small></span>
                @if (!b.validado) { <span class="tag">Sin probar</span> }
              </button>
            }
            <a class="oc-act baja" routerLink="/app/monitoreo/backup">
              <span class="ic"><i class="pi pi-save"></i></span>
              <span class="tx"><b>Respaldos de configuración</b><small>Copias de la configuración de la OLT</small></span>
            </a>
          </div>
        </section>
      }

      <!-- ===================== HISTORIAL ===================== -->
      @if (tab() === 'historial') {
        <section class="oc-card">
          <header class="oc-ch"><h2>Historial de esta OLT</h2><span class="mut">{{ logs().length }} registros</span></header>
          <div class="oc-table tall">
            @if (logs().length) {
              <table>
                <thead><tr><th style="width:120px">Fecha</th><th>Acción</th><th style="width:90px">Estado</th><th style="width:180px">Usuario</th></tr></thead>
                <tbody>
                  @for (l of logs(); track l.id) {
                    <tr (click)="logAbierto.set(logAbierto() === l.id ? null : l.id)">
                      <td class="mono">{{ fmt(l.created_at) }}</td>
                      <td>{{ l.template_name }}</td>
                      <td><span class="badge" [class.ok]="l.status==='ok'">{{ l.status === 'ok' ? 'OK' : 'Error' }}</span></td>
                      <td class="mut">{{ l.executed_by || '—' }}</td>
                    </tr>
                    @if (logAbierto() === l.id) {
                      <tr class="det nohover"><td colspan="4"><pre>{{ l.output || l.commands_sent }}</pre></td></tr>
                    }
                  }
                </tbody>
              </table>
            } @else { <div class="oc-none">Aún no hay acciones registradas en esta OLT.</div> }
          </div>
        </section>
      }
    }

    <!-- ===================== DIÁLOGO DE LA ACCIÓN ===================== -->
    @if (boton(); as b) {
      <div class="oc-overlay" (click)="cerrarAccion()">
        <div [class]="'oc-dialog ' + b.danger" (click)="$event.stopPropagation()">
          <div class="cf-head">
            <span class="ic"><i [class]="'pi ' + icono(b.accion)"></i></span>
            <div>
              <b>{{ b.name }}</b>
              <small>{{ sujeto() }}</small>
            </div>
            <button type="button" class="oc-x" (click)="cerrarAccion()"><i class="pi pi-times"></i></button>
          </div>

          @if (afectados(); as a) {
            <div class="note warn"><i class="pi pi-users"></i>
              <span>Afecta a <b>{{ a.total }}</b> clientes ({{ a.enLinea }} en línea ahora).</span></div>
          }
          @if (b.aviso) { <div class="note"><i class="pi pi-info-circle"></i><span>{{ b.aviso }}</span></div> }
          @if (!b.validado) {
            <div class="note warn"><i class="pi pi-exclamation-triangle"></i>
              <span>Esta acción aún no se ha probado en producción. Úsala primero en un momento sin clientes.</span></div>
          }

          @if (campos().length) {
            <div class="cf-fields">
              @for (p of campos(); track p.key) {
                <label [class.full]="p.type === 'confirm'">
                  <span>{{ p.label }}</span>
                  <input class="mono" [type]="p.type==='number' ? 'number' : 'text'"
                         [placeholder]="p.type === 'confirm' ? esperado(p.expect) : (p.placeholder || '')"
                         [readonly]="p.key === 'slot' && slotFijo() != null"
                         [(ngModel)]="valores[p.key]" (ngModelChange)="previa.set(null)">
                </label>
              }
            </div>
          }

          @if (previa(); as pv) {
            @if (pv.ok === false && pv.error) {
              <div class="note err"><i class="pi pi-times-circle"></i><span>{{ pv.error }}</span></div>
            } @else if (pv.missing?.length) {
              <div class="note err"><i class="pi pi-times-circle"></i><span>Faltan datos: {{ pv.missing.join(', ') }}</span></div>
            } @else if (pv.commands?.length) {
              <details class="cmds"><summary>Ver comandos ({{ pv.commands.length }})</summary>
                <pre>{{ pv.commands.join('\\n') }}</pre></details>
            }
          }

          @if (resultado(); as r) {
            <div class="oc-result" [class.ok]="r.status==='ok'">
              <i class="pi" [class.pi-check-circle]="r.status==='ok'" [class.pi-times-circle]="r.status!=='ok'"></i>
              <div>
                <b>{{ r.status==='ok' ? 'Acción completada' : (r.ok===false && !r.status ? 'No se envió' : 'La OLT respondió con error') }}</b>
                @if (r.error && !r.output) { <small>{{ r.error }}</small> }
                @if (r.output) { <details><summary>Respuesta de la OLT</summary><pre>{{ r.output }}</pre></details> }
              </div>
            </div>
          }

          <footer class="cf-foot">
            @if (motivoBloqueo(); as m) { <span class="blk"><i class="pi pi-lock"></i> {{ m }}</span> } @else { <span></span> }
            <div class="cf-btns">
              <button type="button" class="oc-btn ghost" (click)="cerrarAccion()">{{ resultado()?.status === 'ok' ? 'Cerrar' : 'Cancelar' }}</button>
              @if (resultado()?.status !== 'ok') {
                <button type="button" [class]="'oc-btn solid ' + b.danger" (click)="ejecutar()"
                        [disabled]="corriendo() || !puedeEnviar() || !listoParaEnviar()">
                  <i class="pi" [class.pi-spinner]="corriendo()" [class.oc-spin]="corriendo()" [class.pi-check]="!corriendo()"></i>
                  {{ corriendo() ? 'Enviando…' : 'Confirmar' }}
                </button>
              }
            </div>
          </footer>
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    :host { display:block; }
    .oc { --ok:#16a34a; --warn:#d97706; --bad:#dc2626; --soft:#f6f7fb;
          display:flex; flex-direction:column; gap:14px; color:var(--text,#0f172a); }
    .mono { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-variant-numeric:tabular-nums; }
    .mut { color:var(--muted,#6b7280); font-size:12px; }
    .b { font-weight:700; }
    .rx-ok { color:var(--ok); } .rx-warn { color:var(--warn); } .rx-bad { color:var(--bad); }
    .oc-spin { animation:ocspin 1s linear infinite; }
    @keyframes ocspin { to { transform:rotate(360deg); } }

    .oc-head { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
    .oc-head h1 { margin:0; font-size:18px; font-weight:700; display:flex; align-items:center; gap:8px; }
    .oc-head h1 i { color:var(--primary); font-size:16px; }
    .oc-head p { margin:3px 0 0; font-size:12.5px; color:var(--muted); }
    .oc-switch { display:flex; align-items:center; gap:10px; padding:8px 14px 8px 10px; border-radius:12px; cursor:pointer;
                 border:1px solid var(--border,#e3e6ee); background:var(--panel,#fff); text-align:left; color:inherit; }
    .oc-switch .knob { width:36px; height:20px; border-radius:20px; background:#cbd5e1; position:relative; flex-shrink:0; transition:.15s; }
    .oc-switch .knob::after { content:''; position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:.15s; }
    .oc-switch.on { border-color:rgba(22,163,74,.35); background:rgba(22,163,74,.06); }
    .oc-switch.on .knob { background:var(--ok); }
    .oc-switch.on .knob::after { left:19px; }
    .oc-switch .lbl { display:flex; flex-direction:column; line-height:1.25; }
    .oc-switch b { font-size:12.5px; } .oc-switch small { font-size:11px; color:var(--muted); }
    .oc-alert, .oc-stale { display:flex; gap:10px; align-items:flex-start; padding:10px 14px; border-radius:12px; font-size:12.5px; line-height:1.5; }
    .oc-alert { background:#fffbeb; border:1px solid #fde68a; color:#78350f; }
    .oc-stale { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }
    .oc-stale i, .oc-alert i { margin-top:3px; }
    .oc-stale.inner { margin:14px 18px 0; background:#fffbeb; border-color:#fde68a; color:#92400e; }

    .oc-bar { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
    .oc-field { position:relative; display:flex; align-items:center; background:var(--panel,#fff); border:1px solid var(--border,#e3e6ee);
                border-radius:12px; height:42px; transition:border-color .12s, box-shadow .12s; }
    .oc-field:focus-within { border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-soft,#f8e9f3); }
    .oc-field > i.pi { position:absolute; left:13px; color:var(--muted); font-size:13px; pointer-events:none; }
    .oc-field select, .oc-field input { border:none; outline:none; background:transparent; height:100%; width:100%;
                padding:0 14px 0 36px; font-size:13.5px; color:inherit; border-radius:12px; }
    .oc-field.sm { height:34px; width:200px; border-radius:10px; }
    .oc-field.sm input { font-size:12.5px; }
    .oc-olt { width:280px; }
    .oc-olt-meta { display:flex; gap:16px; flex-wrap:wrap; font-size:12.5px; color:var(--muted); flex:1; }
    .oc-olt-meta i { font-size:11px; margin-right:3px; }
    .oc-olt-meta .warn { color:var(--bad); font-weight:600; }

    .oc-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border,#e3e6ee); overflow-x:auto; }
    .oc-tabs button { display:inline-flex; align-items:center; gap:7px; padding:10px 14px; border:none; background:transparent;
                      font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; border-bottom:2px solid transparent;
                      margin-bottom:-1px; white-space:nowrap; }
    .oc-tabs button i { font-size:12px; }
    .oc-tabs button:hover { color:var(--text); }
    .oc-tabs button.on { color:var(--primary); border-bottom-color:var(--primary); }
    .oc-tabs em { font-style:normal; font-size:10.5px; font-weight:700; background:var(--soft); color:var(--muted);
                  border-radius:8px; padding:1px 7px; }
    .oc-tabs button.on em { background:var(--primary-soft,#f8e9f3); color:var(--primary); }

    .oc-card { position:relative; background:var(--panel,#fff); border:1px solid var(--border,#e3e6ee); border-radius:14px;
               box-shadow:var(--shadow, 0 1px 2px rgba(15,23,42,.04)); }
    .oc-ch { display:flex; align-items:center; gap:12px; padding:14px 18px; border-bottom:1px solid var(--border,#e3e6ee); flex-wrap:wrap; }
    .oc-ch h2 { margin:0; font-size:14px; font-weight:700; }
    .oc-link { margin-left:auto; border:none; background:transparent; color:var(--primary); font-size:12.5px; font-weight:600; cursor:pointer; }
    .oc-link i { font-size:10px; margin-left:4px; }
    .oc-none { padding:20px; text-align:center; font-size:12.5px; color:var(--muted); }
    .oc-x { margin-left:auto; width:30px; height:30px; border-radius:8px; border:none; background:transparent; color:var(--muted); cursor:pointer; }
    .oc-x:hover { background:var(--soft); }

    .bar { height:5px; border-radius:4px; background:#eef0f4; overflow:hidden; }
    .bar > span { display:block; height:100%; border-radius:4px; background:#94a3b8; }
    .bar > span.rx-ok { background:var(--ok); }

    .oc-table { overflow:auto; max-height:420px; }
    .oc-table.tall { max-height:620px; }
    .oc-table table { width:100%; border-collapse:collapse; font-size:12.5px; }
    .oc-table th { position:sticky; top:0; z-index:1; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em;
                   color:var(--muted); font-weight:600; padding:9px 14px; background:#fafbfc; border-bottom:1px solid var(--border,#e3e6ee); white-space:nowrap; }
    .oc-table td { padding:8px 14px; border-bottom:1px solid #f1f3f7; white-space:nowrap; }
    .oc-table tbody tr { cursor:pointer; transition:background .1s; }
    .oc-table tbody tr:hover { background:var(--soft); }
    .oc-table tbody tr.nohover { cursor:default; }
    .oc-table tr.det td { white-space:normal; }
    .sig { display:flex; align-items:center; gap:10px; }
    .sig .bar { width:60px; }
    td.acts { text-align:right; }
    .ic-btn { --c:var(--primary); width:30px; height:30px; border-radius:8px; border:1px solid var(--border,#e3e6ee); background:var(--panel,#fff);
              color:var(--c); cursor:pointer; margin-left:4px; transition:.12s; }
    .ic-btn.media { --c:var(--warn); } .ic-btn.alta { --c:var(--bad); } .ic-btn.baja { --c:var(--ok); }
    .ic-btn:hover { border-color:var(--c); background:color-mix(in srgb, var(--c) 10%, transparent); }
    .ic-btn i { font-size:12px; }
    .oc-legend { display:flex; gap:18px; flex-wrap:wrap; padding:10px 18px; border-top:1px solid var(--border,#e3e6ee); font-size:12px; color:var(--muted); }
    .oc-legend i { font-size:11px; margin-right:4px; }
    .oc-legend i.media { color:var(--warn); } .oc-legend i.alta { color:var(--bad); } .oc-legend i.baja { color:var(--ok); }
    .badge { font-size:11px; font-weight:700; border-radius:8px; padding:3px 8px; background:#fee2e2; color:#b91c1c; }
    .badge.ok { background:#dcfce7; color:#15803d; }
    pre { background:#0f172a; color:#e2e8f0; padding:12px 14px; border-radius:10px; font-size:12px; line-height:1.55; overflow:auto;
          max-height:260px; margin:8px 0 0; white-space:pre; }

    .oc-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; padding:16px 18px; }
    .oc-tcard { border:1px solid var(--border,#e3e6ee); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:6px; }
    .p-btns { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:4px; }
    .p-btns .oc-btn { padding:0 6px; }
    .oc-slots { display:flex; gap:6px; flex-wrap:wrap; margin-left:auto; }
    .oc-slots button { height:30px; padding:0 12px; border-radius:999px; border:1px solid var(--border,#e3e6ee); background:var(--panel,#fff);
                       color:var(--muted); font-size:12px; font-weight:600; cursor:pointer; }
    .oc-slots button.on { background:var(--primary); border-color:var(--primary); color:#fff; }
    .t-top { display:flex; flex-direction:column; }
    .t-slot { font-weight:700; font-size:14px; }
    .t-kind { font-size:11.5px; color:var(--muted); }
    .t-temp { font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; }
    .t-temp em { font-style:normal; font-size:12px; color:var(--muted); margin-left:3px; }
    .t-cli { font-size:12px; color:var(--muted); margin-bottom:4px; }

    .oc-acts { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:10px; padding:16px 18px; }
    .oc-act { --c:var(--primary); position:relative; display:flex; align-items:center; gap:12px; padding:12px 14px; text-align:left;
              border:1px solid var(--border,#e3e6ee); background:var(--panel,#fff); border-radius:12px; cursor:pointer; color:inherit;
              text-decoration:none; transition:border-color .12s, box-shadow .12s, transform .05s; }
    .oc-act.media { --c:var(--warn); } .oc-act.alta { --c:var(--bad); } .oc-act.baja { --c:var(--ok); }
    .oc-act:hover { border-color:var(--c); box-shadow:0 2px 10px rgba(15,23,42,.06); }
    .oc-act:active { transform:translateY(1px); }
    .oc-act .ic, .cf-head .ic { width:38px; height:38px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
              background:color-mix(in srgb, var(--c) 12%, transparent); color:var(--c); font-size:16px; }
    .oc-act .tx { display:flex; flex-direction:column; min-width:0; }
    .oc-act .tx b { font-size:13px; font-weight:600; }
    .oc-act .tx small { font-size:11.5px; color:var(--muted); line-height:1.35; }
    .oc-act .tag { position:absolute; top:-8px; right:10px; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
              padding:2px 7px; border-radius:6px; background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; }
    .oc-note-foot { padding:0 18px 16px; font-size:12px; color:var(--muted); }
    .oc-note-foot i { font-size:11px; margin-right:4px; }

    .oc-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:36px; padding:0 16px; border-radius:10px;
              font-size:13px; font-weight:600; cursor:pointer; border:1px solid transparent; transition:filter .12s; white-space:nowrap; }
    .oc-btn.sm { height:30px; padding:0 12px; font-size:12px; }
    .oc-btn.full { width:100%; }
    .oc-btn i { font-size:12px; }
    .oc-btn.ghost { background:var(--panel,#fff); border-color:var(--border,#e3e6ee); color:var(--text); }
    .oc-btn.ghost:hover { background:var(--soft); }
    .oc-btn.solid { color:#fff; background:var(--primary); }
    .oc-btn.solid.media { background:var(--warn); } .oc-btn.solid.alta { background:var(--bad); } .oc-btn.solid.baja { background:var(--ok); }
    .oc-btn.solid:hover { filter:brightness(1.07); }
    .oc-btn:disabled { opacity:.5; cursor:not-allowed; filter:none; }

    .oc-empty { display:flex; flex-direction:column; align-items:center; gap:6px; padding:44px 20px; text-align:center; }
    .oc-empty .em-ic { width:54px; height:54px; border-radius:16px; display:flex; align-items:center; justify-content:center;
                       background:var(--primary-soft,#f8e9f3); color:var(--primary); font-size:20px; margin-bottom:6px; }
    .oc-empty b { font-size:15px; } .oc-empty span { font-size:12.5px; color:var(--muted); max-width:440px; }

    /* diálogo */
    .oc-overlay { position:fixed; inset:0; z-index:1000; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; padding:16px; }
    .oc-dialog { --c:var(--primary); width:min(560px,100%); max-height:calc(100vh - 32px); overflow:auto; background:var(--panel,#fff);
                 border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 24px 60px rgba(15,23,42,.3);
                 border-top:4px solid var(--c); }
    .oc-dialog.media { --c:var(--warn); } .oc-dialog.alta { --c:var(--bad); } .oc-dialog.baja { --c:var(--ok); }
    .cf-head { display:flex; align-items:center; gap:12px; }
    .cf-head b { font-size:15px; display:block; } .cf-head small { font-size:12px; color:var(--muted); }
    .note { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; line-height:1.5; padding:9px 12px; border-radius:10px;
            background:rgba(59,130,246,.07); color:#1e3a8a; }
    .note i { margin-top:3px; font-size:12px; }
    .note.warn { background:#fff7ed; color:#9a3412; } .note.err { background:#fef2f2; color:#b91c1c; }
    .cf-fields { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
    .cf-fields label { display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--muted); }
    .cf-fields label.full { grid-column:1/-1; }
    .cf-fields input { height:38px; padding:0 12px; border:1px solid var(--border,#e3e6ee); border-radius:10px; font-size:13.5px;
            background:var(--panel,#fff); color:var(--text); outline:none; }
    .cf-fields input[readonly] { background:var(--soft); }
    .cf-fields input:focus { border-color:var(--c); box-shadow:0 0 0 3px color-mix(in srgb, var(--c) 15%, transparent); }
    .cmds summary, .oc-result summary { cursor:pointer; font-size:12px; color:var(--muted); }
    .oc-result { display:flex; gap:12px; align-items:flex-start; padding:12px 14px; border-radius:12px; background:#fef2f2; border:1px solid #fecaca; }
    .oc-result.ok { background:#f0fdf4; border-color:#bbf7d0; }
    .oc-result > i { font-size:18px; color:var(--bad); margin-top:1px; }
    .oc-result.ok > i { color:var(--ok); }
    .oc-result div { display:flex; flex-direction:column; gap:4px; font-size:13px; min-width:0; flex:1; }
    .oc-result small { color:var(--muted); font-size:12px; }
    .cf-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding-top:12px;
               border-top:1px solid var(--border,#e3e6ee); }
    .cf-btns { display:flex; gap:8px; margin-left:auto; }
    .blk { font-size:12px; color:#b45309; max-width:300px; }
  `],
})
export class OltConfig {
  private api = inject(NocApi);
  private notify = inject(NocNotify);

  readonly tabs: { id: Tab; label: string; icono: string }[] = [
    { id: 'puertos', label: 'Puertos PON', icono: 'pi-sitemap' },
    { id: 'tarjetas', label: 'Tarjetas', icono: 'pi-th-large' },
    { id: 'red', label: 'VLAN y perfiles', icono: 'pi-tags' },
    { id: 'sistema', label: 'Sistema', icono: 'pi-cog' },
    { id: 'historial', label: 'Historial', icono: 'pi-history' },
  ];
  tab = signal<Tab>('puertos');

  estado = signal<any>(null);
  writeEnabled = signal(false);
  olts = signal<ZteOltRow[]>([]);
  oltId = signal<number | null>(null);
  olt = computed(() => this.olts().find((x) => x.id === this.oltId()) || null);
  familia = signal<string | null>(null);
  cargando = signal(false);

  onus = signal<OnuRow[]>([]);
  puertosSnmp = signal<any[]>([]);
  /** Slot elegido en Puertos PON (null = todos). */
  slotFiltro = signal<number | null>(null);

  tarjetasRaw = signal<{ slot: number; tempC: number }[]>([]);
  tarjetasEn = signal<string | null>(null);
  tarjetasMsg = signal<string | null>(null);
  leyendoTarjetas = signal(false);

  botones = signal<any[]>([]);
  logs = signal<any[]>([]);
  logAbierto = signal<number | null>(null);

  // acción abierta
  boton = signal<any>(null);
  puertoAccion = signal<PuertoFila | null>(null);
  slotFijo = signal<number | null>(null);
  valores: Record<string, any> = {};
  previa = signal<any>(null);
  corriendo = signal(false);
  resultado = signal<any>(null);
  campos = computed(() => {
    const b = this.boton();
    if (!b?.params) return [];
    try { return JSON.parse(b.params); } catch { return []; }
  });

  constructor() {
    this.api.zteOlts().subscribe({ next: (o) => this.olts.set(o || []), error: () => {} });
    this.api.oltcEstado().subscribe({ next: (e) => this.estado.set(e), error: () => {} });
    this.loadWriteEnabled();
  }

  // ---------------- carga ----------------
  elegirOlt(id: number | null) {
    this.oltId.set(id);
    this.onus.set([]); this.puertosSnmp.set([]); this.tarjetasRaw.set([]); this.tarjetasEn.set(null);
    this.tarjetasMsg.set(null); this.botones.set([]); this.logs.set([]); this.familia.set(null);
    this.slotFiltro.set(null);
    if (!id) return;
    this.recargar(false);
    this.api.oltcBotoneraOlt(id, 'olt').subscribe({
      next: (r) => { this.botones.set(r?.botones || []); this.familia.set(r?.olt?.familia || null); },
      error: () => {},
    });
  }

  /** Relee lo que el NOC tiene de la OLT; con 'vivo' además pide lecturas SNMP nuevas. */
  recargar(vivo: boolean) {
    const id = this.oltId();
    if (!id) return;
    this.cargando.set(true);
    let pend = 2;
    const fin = () => { if (--pend <= 0) this.cargando.set(false); };
    this.api.zteOnusOfOlt(id).subscribe({ next: (o) => { this.onus.set(o || []); fin(); }, error: fin });
    const puertos = () => this.api.zteOltPorts(id).subscribe({ next: (p) => { this.puertosSnmp.set(p || []); fin(); }, error: fin });
    if (vivo) this.api.ztePortsCollect(id).subscribe({ next: puertos, error: puertos });
    else puertos();
    this.leerTarjetas();
    this.loadLogs();
    this.api.zteOlts().subscribe({ next: (o) => this.olts.set(o || []), error: () => {} });
  }

  leerTarjetas() {
    const id = this.oltId();
    if (!id) return;
    this.leyendoTarjetas.set(true);
    this.tarjetasMsg.set(null);
    this.api.oltcTarjetas(id).subscribe({
      next: (r) => {
        this.leyendoTarjetas.set(false);
        if (r?.ocupada) { this.tarjetasMsg.set('La OLT está ocupada con otra lectura SNMP. Intenta en unos segundos.'); return; }
        this.tarjetasRaw.set(r?.tarjetas || []);
        this.tarjetasEn.set(r?.leidoEn || null);
        if (!(r?.tarjetas || []).length) this.tarjetasMsg.set('La OLT no respondió la temperatura por SNMP. Se muestran las tarjetas que tienen clientes.');
      },
      error: () => { this.leyendoTarjetas.set(false); this.tarjetasMsg.set('No se pudieron leer las tarjetas.'); },
    });
  }

  loadLogs() {
    const id = this.oltId();
    this.api.oltcLogs(id || undefined).subscribe({ next: (l) => this.logs.set(l || []), error: () => {} });
  }

  // ---------------- datos derivados ----------------
  private esOn(o: OnuRow) { return (o.phaseState || '').toLowerCase() === 'working'; }
  private esLos(o: OnuRow) { return (o.phaseState || '').toLowerCase().includes('los'); }

  puertos = computed<PuertoFila[]>(() => {
    const m = new Map<string, PuertoFila>();
    const fila = (s: number, sl: number, p: number): PuertoFila => {
      const k = `${s}/${sl}/${p}`;
      let f = m.get(k);
      if (!f) { f = { nombre: k, shelf: s, slot: sl, port: p, total: 0, enLinea: 0, caidas: 0, los: 0, libres: 128, laser: null, bajada: null, subida: null }; m.set(k, f); }
      return f;
    };
    for (const o of this.onus()) {
      const f = fila(o.shelf, o.slot, o.port);
      f.total++; f.libres--;
      if (this.esOn(o)) f.enLinea++; else { f.caidas++; if (this.esLos(o)) f.los++; }
    }
    for (const p of this.puertosSnmp()) {
      if (p.shelf == null || p.slot == null || p.port == null) continue;
      const f = fila(Number(p.shelf), Number(p.slot), Number(p.port));
      f.laser = p.tx_dbm != null ? Number(p.tx_dbm) : null;
      f.bajada = p.tx_bps != null ? Number(p.tx_bps) : null;
      f.subida = p.rx_bps != null ? Number(p.rx_bps) : null;
    }
    return [...m.values()].sort((a, b) => a.shelf - b.shelf || a.slot - b.slot || a.port - b.port);
  });
  slots = computed(() => [...new Set(this.puertos().map((p) => p.slot))].sort((a, b) => a - b));
  puertosVisibles = computed(() => {
    const sl = this.slotFiltro();
    return sl == null ? this.puertos() : this.puertos().filter((p) => p.slot === sl);
  });

  totales = computed(() => {
    let total = 0, enLinea = 0, los = 0;
    for (const o of this.onus()) { total++; if (this.esOn(o)) enLinea++; else if (this.esLos(o)) los++; }
    let bajada = 0, subida = 0;
    for (const p of this.puertosSnmp()) { bajada += Number(p.tx_bps) || 0; subida += Number(p.rx_bps) || 0; }
    return { total, enLinea, caidas: total - enLinea, los, bajada, subida };
  });

  tarjetasLista = computed(() => {
    const m = new Map<number, { slot: number; temp: number | null; pon: number; clientes: number; enLinea: number }>();
    const t = (s: number) => { let x = m.get(s); if (!x) { x = { slot: s, temp: null, pon: 0, clientes: 0, enLinea: 0 }; m.set(s, x); } return x; };
    for (const r of this.tarjetasRaw()) t(r.slot).temp = r.tempC;
    for (const p of this.puertos()) { const x = t(p.slot); x.pon++; x.clientes += p.total; x.enLinea += p.enLinea; }
    return [...m.values()].sort((a, b) => a.slot - b.slot);
  });

  botonesDe(acciones: string[]): any[] {
    return acciones.map((a) => this.botones().find((b) => b.accion === a)).filter((b) => !!b);
  }
  botonesPuerto = computed(() => this.botonesDe(['subir_puerto', 'reset_puerto', 'bajar_puerto']));
  botonTarjeta = computed(() => this.botones().find((b) => b.accion === 'reset_tarjeta') || null);

  // ---------------- acciones ----------------
  abrir(b: any, puerto: PuertoFila | null = null, slot: number | null = null) {
    this.boton.set(b);
    this.puertoAccion.set(puerto);
    this.slotFijo.set(slot);
    this.previa.set(null);
    this.resultado.set(null);
    const v: Record<string, any> = {};
    for (const p of this.campos()) if (p.default != null) v[p.key] = p.default;
    if (slot != null) v['slot'] = slot;
    this.valores = v;
    if (!this.campos().length) this.verPrevia();
  }

  cerrarAccion() { this.boton.set(null); this.puertoAccion.set(null); this.slotFijo.set(null); this.valores = {}; this.previa.set(null); this.resultado.set(null); }

  sujeto(): string {
    const b = this.boton(); const o = this.olt();
    if (!b || !o) return '';
    if (b.scope === 'puerto' && this.puertoAccion()) return 'Puerto ' + this.puertoAccion()!.nombre + ' · ' + o.name;
    if (b.accion === 'reset_tarjeta' && this.valores['slot']) return 'Slot ' + this.valores['slot'] + ' · ' + o.name;
    return o.name;
  }

  /** Cuántos clientes tumba la acción (para avisar antes de confirmar). */
  afectados = computed(() => {
    const b = this.boton();
    if (!b) return null;
    if (['bajar_puerto', 'reset_puerto'].includes(b.accion) && this.puertoAccion()) {
      const p = this.puertoAccion()!; return { total: p.total, enLinea: p.enLinea };
    }
    if (b.accion === 'reset_tarjeta' && this.slotFijo() != null) {
      const t = this.tarjetasLista().find((x) => x.slot === this.slotFijo());
      return t ? { total: t.clientes, enLinea: t.enLinea } : null;
    }
    if (b.accion === 'reboot_olt') return { total: this.totales().total, enLinea: this.totales().enLinea };
    return null;
  });

  esperado(e: string): string {
    if (e === 'puerto') return this.puertoAccion()?.nombre || '';
    if (e === 'slot') return String(this.valores['slot'] ?? '');
    if (e === 'olt') return this.olt()?.name || '';
    return '';
  }

  listoParaEnviar(): boolean {
    return this.campos().every((p: any) => {
      const v = String(this.valores[p.key] ?? '').trim();
      if (p.type === 'confirm') return v !== '' && v === this.esperado(p.expect);
      return !p.required || v !== '';
    });
  }

  private cuerpo(): any { return { ...this.valores, puerto: this.puertoAccion()?.nombre || '' }; }

  private verPrevia(cb?: (pv: any) => void) {
    const b = this.boton(); const id = this.oltId();
    if (!b || !id) return;
    this.api.oltcBotonPreview(b.accion, null, id, this.cuerpo()).subscribe({
      next: (pv) => { this.previa.set(pv); cb?.(pv); },
      error: (e) => this.previa.set({ ok: false, error: e?.message || 'No se pudo armar la vista previa.' }),
    });
  }

  ejecutar() {
    const b = this.boton(); const id = this.oltId();
    if (!b || !id) return;
    this.corriendo.set(true);
    this.verPrevia((pv) => {
      if (pv?.ok === false || pv?.missing?.length) { this.corriendo.set(false); return; }
      this.api.oltcBotonEjecutar(b.accion, null, id, this.cuerpo()).subscribe({
        next: (r) => {
          this.corriendo.set(false);
          this.resultado.set(r);
          this.loadLogs();
          if (r?.status === 'ok') {
            this.notify.ok(`${b.name}: listo.`);
            if (b.scope === 'puerto') setTimeout(() => this.recargar(true), 60000);
          }
        },
        error: (e) => { this.corriendo.set(false); this.resultado.set({ ok: false, error: e?.message || 'No se pudo enviar.' }); },
      });
    });
  }

  puedeEnviar(): boolean {
    const st = this.estado();
    if (st && st.puedeOperar === false) return false;
    if (st && st.cliEnabled === false) return false;
    return this.writeEnabled();
  }

  motivoBloqueo(): string | null {
    const st = this.estado();
    if (st && st.puedeOperar === false) return 'Tu usuario no tiene permiso para operar la OLT.';
    if (st && st.cliEnabled === false) return st.motivo || 'El envío a la OLT está cerrado en el NOC.';
    if (!this.writeEnabled()) return 'Enciende "Envío a la OLT" (arriba a la derecha) para poder confirmar.';
    return null;
  }

  // ---------------- interruptor ----------------
  loadWriteEnabled() {
    const k = (x: any) => x.settingKey ?? x.setting_key ?? x.key;
    const v = (x: any) => x.settingValue ?? x.setting_value ?? x.value;
    this.api.settings().subscribe({
      next: (list: any[]) => {
        const r = (list || []).find((x: any) => k(x) === 'olt_write_enabled');
        const t = String(r != null ? v(r) : '').trim().toLowerCase();
        this.writeEnabled.set(['1', 'true', 'on', 'si', 'sí'].includes(t));
      },
      error: () => {},
    });
  }

  toggleWrite() {
    const on = !this.writeEnabled();
    this.writeEnabled.set(on);
    this.api.updateSetting('olt_write_enabled', on ? '1' : '0').subscribe({
      error: () => { this.writeEnabled.set(!on); this.notify.error('No se pudo cambiar el envío a la OLT.'); },
    });
  }

  // ---------------- formato ----------------
  icono(a: string): string {
    return ({ bajar_puerto: 'pi-arrow-circle-down', subir_puerto: 'pi-arrow-circle-up', reset_puerto: 'pi-replay',
              reset_tarjeta: 'pi-refresh', perfil_subida: 'pi-arrow-up', perfil_bajada: 'pi-arrow-down',
              crear_vlan: 'pi-tag', vlan_uplink: 'pi-link', rogue_detect: 'pi-eye', guardar: 'pi-save',
              reboot_olt: 'pi-power-off' } as any)[a] || 'pi-bolt';
  }
  /** Texto corto del botón en la tarjeta del puerto. */
  corto(a: string): string {
    return ({ subir_puerto: 'Subir', reset_puerto: 'Reiniciar', bajar_puerto: 'Bajar' } as any)[a] || a;
  }
  descripcion(a: string): string {
    return ({ perfil_subida: 'Nuevo perfil tcont para planes', perfil_bajada: 'Nuevo perfil de tráfico (bajada)',
              crear_vlan: 'Crea una VLAN en la OLT', vlan_uplink: 'Deja pasar una VLAN por el uplink',
              rogue_detect: 'La OLT vigila ONU que emiten fuera de turno', guardar: 'Guarda la configuración actual (write)',
              reboot_olt: 'Reinicia la OLT completa' } as any)[a] || '';
  }
  claseTemp(t: number | null | undefined): string {
    if (t == null) return '';
    return t >= 70 ? 'rx-bad' : t >= 55 ? 'rx-warn' : 'rx-ok';
  }
  pct(a: number, b: number): number { return b ? Math.round((a / b) * 100) : 0; }
  bps(v: number | null): string {
    if (v == null) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + ' Gbps';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + ' Mbps';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + ' kbps';
    return v + ' bps';
  }
  viejo(t: string | null | undefined): boolean {
    if (!t) return true;
    const lim = Math.max(900, 3 * (Number(this.olt()?.snmpPollSeconds) || 300)) * 1000;
    return Date.now() - new Date(t).getTime() > lim;
  }
  hace(t: string | null | undefined): string {
    if (!t) return 'sin dato';
    const s = Math.round((Date.now() - new Date(t).getTime()) / 1000);
    if (isNaN(s)) return 'sin dato';
    if (s < 60) return 'hace ' + Math.max(s, 0) + ' s';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    return 'hace ' + Math.round(s / 86400) + ' d';
  }
  fmt(t: string): string {
    const d = new Date(t);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
