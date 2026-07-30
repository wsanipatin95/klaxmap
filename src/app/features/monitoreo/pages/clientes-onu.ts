import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi, ZteOltRow, OnuRow } from '../services/noc-api';
import { LineChart } from '../shared/line-chart';
import { areaDs } from '../shared/charts';

@Component({
  selector: 'app-clientes-onu',
  standalone: true,
  imports: [FormsModule, LineChart],
  template: `
    <div class="tools">
      <span style="font-weight:600;font-size:15px">📡 Clientes / ONUs</span>
      @if (olts().length) {
        <select class="inp" [(ngModel)]="oltId" (ngModelChange)="onOltChange()" title="Elegí la OLT a ver">
          @for (o of olts(); track o.id) { <option [ngValue]="o.id">{{ o.name }} ({{ o.host }})</option> }
        </select>
        @if (ports().length) {
          <button class="btn" (click)="lpuModal.set(true)" title="Elegir LPU-PON (tarjeta/puerto)">🔌 LPU-PON · {{ port || 'Todos' }}</button>
        } @else {
          <input class="inp" style="min-width:110px" [(ngModel)]="port" placeholder="ej: 1/12/1" title="Filtra las ONUs por LPU-PON">
        }
        <button class="btn ghost" (click)="oltSystem()" [disabled]="busy()"
                title="Leer la temperatura por tarjeta de la OLT.">🌡 Estado OLT</button>
        <button class="btn ghost" (click)="verificar()"
                title="Confirma que los datos mostrados se recolectaron de verdad: cuántas ONU, con señal, y cuántas cruzaron con contratos del ERP.">✓ Verificar datos</button>
        @if (curOlt()?.tempMaxC != null) {
          <span class="badge" [style.background]="tempBg(curOlt()!.tempMaxC!)" [style.color]="'#fff'"
                title="Temperatura máxima de la OLT y el slot más caliente">OLT {{ curOlt()!.tempMaxC }}°C (slot {{ curOlt()!.tempHotSlot }})</span>
        }
        <input class="inp" style="min-width:200px" [(ngModel)]="q"
               placeholder="🔍 Buscar cliente, IP, serial, ONU..."
               title="Filtra la tabla por nombre de cliente, IP, serial o índice de ONU.">
      } @else {
        <span style="color:var(--muted);font-size:12.5px">No hay OLTs registradas. Registrá un equipo tipo OLT en el módulo Equipos.</span>
      }
      <span style="margin-left:auto;display:flex;gap:14px;font-size:12.5px">
        <span>Total: <b>{{ portOnus().length }}</b></span>
        <span style="color:var(--green)">Online: <b>{{ online() }}</b></span>
        <span style="color:var(--muted)">Offline: <b>{{ offline() }}</b></span>
        <span style="color:var(--red)">LOS: <b>{{ los() }}</b></span>
      </span>
    </div>

    @if (verif(); as v) {
      <div class="panel" style="margin-bottom:12px">
        <div class="pb" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:12.5px">
          <b [style.color]="v.recoleccion_ok ? 'var(--green)' : 'var(--red)'">
            {{ v.recoleccion_ok ? '✓ Recolección OK' : '✕ Sin datos recolectados' }}
          </b>
          <span>ONUs leídas: <b>{{ v.onus }}</b></span>
          <span>con señal: <b>{{ v.con_senal }}</b></span>
          <span>con serial: <b>{{ v.con_serial }}</b></span>
          <span>cruzadas con ERP: <b style="color:var(--green)">{{ v.cruzadas_con_erp }}</b> / {{ v.contratos_en_erp }} contratos</span>
          @if (v.sin_cliente_erp > 0) {
            <span style="color:var(--amber)">sin contrato en ERP: <b>{{ v.sin_cliente_erp }}</b></span>
          }
          <span style="color:var(--muted)">último dato: {{ v.ultimo_dato || '—' }}</span>
          <button class="btn sm ghost" style="margin-left:auto" (click)="verif.set(null)" title="Cerrar">✕</button>
        </div>
      </div>
    }
    @if (busy()) { <div class="panel" style="margin-bottom:12px"><div class="pb" style="color:var(--muted)">⏳ Consultando la OLT…</div></div> }
    @if (note()) {
      <div class="panel" style="margin-bottom:12px">
        <div class="pb" style="color:#2563eb;display:flex;align-items:center;gap:12px">
          <span style="flex:1">{{ note() }}</span>
          <button class="btn sm ghost" (click)="note.set('')" title="Cerrar aviso">✕</button>
        </div>
      </div>
    }

    @if (loadingOlt()) {
      <div class="overlay on" style="z-index:90"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:91">
        <div class="panel" style="width:420px;text-align:center">
          <div class="pb" style="padding:30px 24px">
            <div style="font-size:32px;margin-bottom:12px">⏳</div>
            @if (loadingPhase() === 'snmp') {
              <div style="font-weight:600;font-size:15px;line-height:1.7">Obteniendo Información de OLT<br>Espere Por Favor</div>
              <div style="margin-top:16px;font-size:12px;color:var(--muted)">Paso 1 de 2 · Estado y señal (SNMP)</div>
              <div style="margin-top:12px;height:7px;background:#eef1f6;border-radius:99px;overflow:hidden">
                <div class="prog-bar"></div>
              </div>
              <div style="margin-top:10px;font-size:12.5px;color:var(--muted)">
                @if (loadingCount() > 0) { Leyendo la OLT… <b style="color:#7b0061">{{ loadingCount() }}</b> ONUs } @else { Consultando la OLT por SNMP… }
              </div>
            } @else {
              <div style="font-weight:600;font-size:15px;line-height:1.6">Completando datos de clientes<br><span style="font-weight:400;font-size:12px;color:var(--muted)">Nombre · Contrato · IP · Serial · Distancia</span></div>
              <div style="margin-top:14px;font-size:12px;color:var(--muted)">Paso 2 de 2 · Leyendo la configuración de la OLT (un solo comando)</div>
              <div style="margin-top:12px;height:9px;background:#eef1f6;border-radius:99px;overflow:hidden">
                @if (loadingNamed() > 0) {
                  <div style="height:100%;border-radius:99px;background:#7b0061;transition:width .4s ease" [style.width.%]="enrichPct()"></div>
                } @else {
                  <div class="prog-bar"></div>
                }
              </div>
              <div style="margin-top:10px;font-size:13px">
                @if (loadingNamed() > 0) {
                  <b style="color:#7b0061">{{ loadingNamed() }}</b> de <b>{{ loadingTotal() }}</b> clientes obtenidos
                  <span style="color:var(--muted)"> ({{ enrichPct() }}%)</span>
                } @else {
                  <span style="color:var(--muted)">Descargando la configuración de la OLT…</span>
                }
              </div>
              <div style="margin-top:6px;font-size:11.5px;color:var(--muted)">No cierres la ventana; se está trayendo toda la información.</div>
              <button class="btn ghost sm" style="margin-top:14px" (click)="dismissLoading()"
                      title="Ocultar y seguir llenando la tabla en segundo plano">Continuar en segundo plano</button>
            }
            <div style="margin-top:14px;font-size:12px;color:var(--muted)">⏱ Tiempo: <b style="color:#333">{{ elapsedStr() }}</b></div>
          </div>
        </div>
      </div>
    }
    @if (loadingErr()) {
      <div class="overlay on" style="z-index:90" (click)="loadingErr.set('')"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:91" (click)="loadingErr.set('')">
        <div class="panel" style="width:420px;text-align:center" (click)="$event.stopPropagation()">
          <div class="pb" style="padding:28px 24px">
            <div style="font-size:30px;margin-bottom:12px">⚠️</div>
            <div style="font-weight:600;font-size:14px;line-height:1.7">{{ loadingErr() }}</div>
            <button class="btn" style="margin-top:16px" (click)="loadingErr.set('')">Cerrar</button>
          </div>
        </div>
      </div>
    }

    <!-- Modal centrado: elegir LPU-PON con botones -->
    @if (lpuModal()) {
      <div class="overlay on" style="z-index:80" (click)="lpuModal.set(false)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:81" (click)="lpuModal.set(false)">
        <div class="panel" style="width:min(560px,92vw);max-height:80vh;overflow:auto" (click)="$event.stopPropagation()">
          <div class="ph">🔌 Elegí LPU-PON <span class="mini">tarjeta / puerto</span>
            <button class="btn sm ghost" style="margin-left:auto" (click)="lpuModal.set(false)">✕</button>
          </div>
          <div class="pb">
            <div class="lpu-grid">
              <button class="lpu-b" [class.on]="port===''" (click)="selectPort('')">Todos</button>
              @for (p of ports(); track p) {
                <button class="lpu-b" [class.on]="port===p" (click)="selectPort(p)">{{ p }}</button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <div class="panel">
      <table>
        <thead><tr>
          <th class="srt" (click)="sortBy('onu')">ONU{{ arrow('onu') }}</th>
          <th class="srt" (click)="sortBy('contrato')">Contrato{{ arrow('contrato') }}</th>
          <th class="srt" (click)="sortBy('cliente')">Cliente{{ arrow('cliente') }}</th>
          <th class="srt" (click)="sortBy('ip')">IP{{ arrow('ip') }}</th>
          <th class="srt" (click)="sortBy('serial')">Serial{{ arrow('serial') }}</th>
          <th class="srt" (click)="sortBy('distancia')">Distancia{{ arrow('distancia') }}</th>
          <th class="srt" (click)="sortBy('estado')">Estado{{ arrow('estado') }}</th>
          <th class="srt" (click)="sortBy('rx')">Señal RX (dBm){{ arrow('rx') }}</th>
        </tr></thead>
        <tbody>
          @for (o of filtered(); track o.id) {
            <tr style="cursor:pointer" (click)="openOnu(o)">
              <td class="mono">{{ o.rawIndex }}</td>
              <td class="mono">{{ contrato(o.clientName) || '—' }}</td>
              <td><b>{{ clientOnly(o.clientName) }}</b></td>
              <td class="mono">{{ o.clientIp || '—' }}</td>
              <td class="mono" style="font-size:11.5px">{{ o.serial || '—' }}</td>
              <td>{{ o.distanceM != null ? o.distanceM + ' m' : '—' }}</td>
              <td [innerHTML]="stateBadge(o.phaseState)"></td>
              <td>@if (o.onuRxDbm != null) { <b [style.color]="rxColor(o.onuRxDbm)">{{ o.onuRxDbm.toFixed(2) }}</b> } @else { <span style="color:var(--muted)">—</span> }</td>
            </tr>
          } @empty {
            <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:30px">
              {{ loaded() ? 'Sin ONUs todavía. Se traen solas por SNMP; esperá el barrido o revisá la config SNMP de la OLT.' : 'Cargando…' }}
            </td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (sel(); as o) {
      <div class="overlay on" (click)="closeModal()"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:60" (click)="closeModal()">
        <div class="panel" style="width:42vw;min-width:540px;max-width:680px;max-height:92vh;overflow:auto" (click)="$event.stopPropagation()">
          <div class="ph">📡 {{ clientOnly(o.clientName) }} <span class="mini">{{ o.rawIndex }} · {{ o.serial || 'sin serial' }}</span>
            <span style="margin-left:auto;color:var(--red);font-size:11px;font-weight:600">● en vivo · {{ modalCountdown() }} s</span>
          </div>
          <div class="pb">
            <div class="meta onu-cards">
              <div class="m"><div class="k">Estado</div><div class="v" [innerHTML]="stateBadge(o.phaseState)"></div></div>
              <div class="m"><div class="k">Señal RX (cliente)</div><div class="v" [style.color]="o.onuRxDbm!=null ? rxColor(o.onuRxDbm) : ''">{{ o.onuRxDbm!=null ? o.onuRxDbm.toFixed(2)+' dBm' : '—' }}</div></div>
              <div class="m"><div class="k">ONU TX</div><div class="v">{{ o.onuTxDbm!=null ? o.onuTxDbm.toFixed(2)+' dBm' : '—' }}</div></div>
              <div class="m"><div class="k">OLT RX</div><div class="v">{{ o.oltRxDbm!=null ? o.oltRxDbm.toFixed(2)+' dBm' : '—' }}</div></div>
              <div class="m"><div class="k">OLT TX</div><div class="v">{{ o.oltTxDbm!=null ? o.oltTxDbm.toFixed(2)+' dBm' : '—' }}</div></div>
              <div class="m"><div class="k">Distancia</div><div class="v">{{ o.distanceM!=null ? o.distanceM+' m' : '—' }}</div></div>
              <div class="m"><div class="k">IP</div><div class="v mono">{{ o.clientIp || '—' }}</div></div>
              <div class="m"><div class="k">Descripción</div><div class="v">{{ o.description || '—' }}</div></div>
              <div class="m"><div class="k">Contrato</div><div class="v mono">{{ contrato(o.clientName) || '—' }}</div></div>
              <div class="m"><div class="k">Admin</div><div class="v">{{ o.adminState || '—' }}</div></div>
              <div class="m"><div class="k">Serial</div><div class="v mono">{{ o.serial || '—' }}</div></div>
              <div class="m"><div class="k">Última causa</div><div class="v">{{ o.lastCause || '—' }}</div></div>
              <div class="m"><div class="k">Última lectura</div><div class="v" style="font-size:12px">{{ fmtTs(o.updatedAt) }}</div></div>
            </div>

            <div style="margin-top:14px">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px">Consumo del cliente</div>
              <div class="meta onu-cards">
                <div class="m"><div class="k">Descarga (ahora)</div><div class="v" style="color:var(--primary)">{{ rate(o.onuOutRateBps) }}</div></div>
                <div class="m"><div class="k">Subida (ahora)</div><div class="v" style="color:var(--green)">{{ rate(o.onuInRateBps) }}</div></div>
                <div class="m"><div class="k">Total descargado</div><div class="v">{{ bytes(o.onuOutTotalBytes) }}</div></div>
                <div class="m"><div class="k">Total subido</div><div class="v">{{ bytes(o.onuInTotalBytes) }}</div></div>
              </div>
              <div style="height:130px;margin-top:8px;cursor:pointer" title="Clic para ampliar"
                   (click)="openBig('traf', 'Consumo · Descarga (Mbps)')">
                @if (trafLab().length > 1) { <app-line-chart [labels]="trafLab()" [datasets]="trafDs()"></app-line-chart> }
                @else { <div style="color:var(--muted);font-size:12px;padding:16px 0">El histórico de consumo se llena con cada refresco/sondeo.</div> }
              </div>
            </div>

            <div style="margin-top:14px">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px">Señal RX en el tiempo</div>
              <div style="height:130px;cursor:pointer" title="Clic para ampliar"
                   (click)="openBig('rx', 'Señal RX en el tiempo (dBm)')">
                @if (histLab().length > 1) { <app-line-chart [labels]="histLab()" [datasets]="histDs()"></app-line-chart> }
                @else { <div style="color:var(--muted);font-size:12px;padding:20px 0">Aún no hay histórico suficiente. Se llena solo cada vez que se sondea la ONU (automático).</div> }
              </div>
            </div>

            <div style="margin-top:14px">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px">Causas de caída (historial)</div>
              @if (causes(o).length) {
                <div style="border:1px solid var(--border);border-radius:9px;overflow:hidden">
                  @for (c of causes(o); track $index) {
                    <div style="display:flex;gap:12px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12.5px">
                      <span style="color:var(--muted);font-family:'Consolas',monospace">{{ c.time }}</span>
                      <span class="badge" [class.b-crit]="c.cause==='LOS'" [class.b-warn]="c.cause!=='LOS'">{{ causeLabel(c.cause) }}</span>
                    </div>
                  }
                </div>
              } @else { <div style="color:var(--muted);font-size:12px">Sin caídas registradas.</div> }
            </div>

            <div style="margin-top:14px">
              <div style="font-size:13px;font-weight:600;margin-bottom:6px">Alertas de esta ONU</div>
              @if (onuAlerts().length) {
                <div style="border:1px solid var(--border);border-radius:9px;overflow:hidden">
                  @for (a of onuAlerts(); track $index) {
                    <div style="display:flex;gap:12px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12.5px">
                      <span class="badge" [class.b-crit]="a.severity==='crit'" [class.b-warn]="a.severity!=='crit'">{{ a.severity==='crit' ? 'CRÍTICA' : 'ALERTA' }}</span>
                      <span style="flex:1">{{ a.description }}</span>
                      <span [style.color]="a.status==='open' ? 'var(--red)' : 'var(--green)'" style="font-weight:600">{{ a.status==='open' ? 'ABIERTA' : 'resuelta' }}</span>
                      <span style="color:var(--muted);font-family:monospace">{{ a.started }}</span>
                    </div>
                  }
                </div>
              } @else { <div style="color:var(--muted);font-size:12px">Sin alertas para esta ONU. 👍</div> }
            </div>
          </div>
          <div class="ph" style="border-top:1px solid var(--border);border-bottom:none;justify-content:flex-end">
            @if (busy()) { <span style="color:var(--muted);font-size:12.5px;margin-right:auto">⏳ Actualizando en vivo…</span> }
            <button class="btn" (click)="closeModal()">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (big(); as b) {
      <div class="overlay on" style="z-index:70" (click)="big.set(null)"></div>
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:71" (click)="big.set(null)">
        <div class="panel" style="width:92vw;max-width:1200px" (click)="$event.stopPropagation()">
          <div class="ph">{{ b.title }}
            <span style="margin-left:auto;display:flex;align-items:center;gap:12px">
              <span style="color:var(--red);font-size:11px;font-weight:600">● en vivo · {{ modalCountdown() }} s</span>
              <button class="btn sm ghost" (click)="big.set(null)" title="Cerrar">✕</button>
            </span>
          </div>
          <div class="pb">
            <div style="height:62vh">
              @if (b.kind === 'rx') {
                @if (histLab().length > 1) { <app-line-chart [labels]="histLab()" [datasets]="histDs()"></app-line-chart> }
                @else { <div style="color:var(--muted);padding:20px 0">Sin datos suficientes para graficar.</div> }
              } @else {
                @if (trafLab().length > 1) { <app-line-chart [labels]="trafLab()" [datasets]="trafDs()"></app-line-chart> }
                @else { <div style="color:var(--muted);padding:20px 0">Sin datos suficientes para graficar.</div> }
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .onu-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 0; }
    .onu-cards .m { text-align: left; padding: 5px 9px; min-height: 0; }
    .onu-cards .m .k { font-size: 10.5px; margin-bottom: 1px; text-align: left; line-height: 1.1; }
    .onu-cards .m .v { font-size: 13px; font-weight: 600; line-height: 1.15; text-align: left;
                       white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 1024px) { .onu-cards { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px)  { .onu-cards { grid-template-columns: 1fr; } }
    th.srt { cursor:pointer; user-select:none; white-space:nowrap; }
    th.srt:hover { color:var(--primary); }
    .lpu-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:8px; }
    .lpu-b { padding:11px 8px; border:1px solid var(--border); border-radius:8px; background:#fff; font-size:13px;
             font-weight:600; cursor:pointer; font-family:'Consolas',monospace; transition:.12s; }
    .lpu-b:hover { border-color:var(--primary); background:var(--primary-soft); }
    .lpu-b.on { background:var(--primary); color:#fff; border-color:var(--primary); }
    .prog-bar { height: 100%; width: 42%; border-radius: 99px; background: #7b0061; animation: progslide 1.1s ease-in-out infinite; }
    @keyframes progslide { 0% { margin-left: -45%; } 100% { margin-left: 100%; } }
  `],
})
export class ClientesOnu implements OnDestroy {
  private api = inject(NocApi);
  private modalTimer: any;
  private tableTimer: any;
  private enrichTimer: any;
  private elapsedTimer: any;
  private noteTimer: any;
  olts = signal<ZteOltRow[]>([]);
  onus = signal<OnuRow[]>([]);
  oltId = 0;
  port = '1/12/1';
  busy = signal(false);
  note = signal('');
  loaded = signal(false);
  loadingOlt = signal(false);
  loadingErr = signal('');
  loadingCount = signal(0);
  lpuModal = signal(false);
  loadingPhase = signal<'snmp' | 'enrich'>('snmp');
  loadingNamed = signal(0);
  loadingTotal = signal(0);
  loadingT0 = 0;
  loadingElapsed = signal(0);
  sel = signal<OnuRow | null>(null);
  histLab = signal<string[]>([]);
  histDs = signal<any[]>([]);
  trafLab = signal<string[]>([]);
  trafDs = signal<any[]>([]);
  onuAlerts = signal<any[]>([]);
  big = signal<{ kind: 'rx' | 'traf'; title: string } | null>(null);
  modalCountdown = signal(30);

  q = '';
  /** Puertos PON derivados de las ONUs ya cargadas (aparecen solos, sin botón de descubrir). */
  ports = computed(() => {
    const set = new Set<string>();
    // Base: TODOS los puertos físicos de la OLT (incluye los que no tienen ONUs).
    this.oltPorts().forEach((p) => set.add(p));
    // Además, los puertos que tengan ONUs (por si algún puerto no salió en la lista física).
    this.onus().forEach((o) => set.add(`${o.shelf}/${o.slot}/${o.port}`));
    return [...set].sort((a, b) => {
      const pa = a.split('/').map(Number), pb = b.split('/').map(Number);
      return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
    });
  });

  /** ONUs del puerto seleccionado (si no hay puerto, todas). */
  portOnus(): OnuRow[] {
    const p = (this.port || '').trim();
    return this.onus().filter((o) => !p || `${o.shelf}/${o.slot}/${o.port}` === p);
  }
  online() { return this.portOnus().filter((o) => o.phaseState?.toLowerCase() === 'working').length; }
  offline() { return this.portOnus().filter((o) => (o.phaseState || '').toLowerCase().startsWith('off')).length; }
  los() { return this.portOnus().filter((o) => (o.phaseState || '').toUpperCase() === 'LOS').length; }

  sortKey = signal<string>('onu');
  sortDir = signal<1 | -1>(1);

  sortBy(k: string) {
    if (this.sortKey() === k) this.sortDir.set(this.sortDir() === 1 ? -1 : 1);
    else { this.sortKey.set(k); this.sortDir.set(1); }
  }
  arrow(k: string): string {
    if (this.sortKey() !== k) return '';
    return this.sortDir() === 1 ? ' ▲' : ' ▼';
  }

  filtered(): OnuRow[] {
    const s = this.q.toLowerCase().trim();
    const list = this.portOnus().filter((o) =>
      !s || `${o.rawIndex} ${o.clientName || ''} ${o.clientIp || ''} ${o.serial || ''}`.toLowerCase().includes(s));
    return list.sort((a, b) => this.cmp(a, b));
  }

  /** Comparador según la cabecera elegida. */
  private cmp(a: OnuRow, b: OnuRow): number {
    const d = this.sortDir();
    let r = 0;
    switch (this.sortKey()) {
      case 'onu': r = a.shelf - b.shelf || a.slot - b.slot || a.port - b.port || a.onuId - b.onuId; break;
      case 'contrato': r = this.numOr(this.contrato(a.clientName)) - this.numOr(this.contrato(b.clientName)); break;
      case 'cliente': r = this.clientOnly(a.clientName).localeCompare(this.clientOnly(b.clientName)); break;
      case 'ip': r = this.ipNum(a.clientIp) - this.ipNum(b.clientIp); break;
      case 'serial': r = (a.serial || '').localeCompare(b.serial || ''); break;
      case 'distancia': r = (a.distanceM ?? -1) - (b.distanceM ?? -1); break;
      case 'estado': r = (a.phaseState || '').localeCompare(b.phaseState || ''); break;
      case 'rx': r = (a.onuRxDbm ?? 9999) - (b.onuRxDbm ?? 9999); break;
    }
    return r * d;
  }
  private numOr(s: string): number { const n = parseInt(s, 10); return isNaN(n) ? -1 : n; }
  private ipNum(ip: string | null): number {
    if (!ip) return -1;
    return ip.split('.').reduce((acc, p) => acc * 256 + (parseInt(p, 10) || 0), 0);
  }

  onOltChange() {
    this.port = '';        // por defecto: todas las ONUs de la OLT
    this.loadOltPorts();   // trae TODOS los puertos físicos de la OLT (incluidos los vacíos)
    this.autoLoad();
  }

  /** Todos los puertos PON físicos de la OLT (de kxt_olt_port, vía ifName). Incluye los sin ONUs. */
  oltPorts = signal<string[]>([]);
  loadOltPorts() {
    if (!this.oltId) { this.oltPorts.set([]); return; }
    this.api.zteOltPorts(this.oltId).subscribe({
      next: (r) => this.oltPorts.set(
        (r || []).map((p: any) => String(p.port_name || '').replace(/^gpon[_-]?/i, '').trim()).filter((s: string) => !!s)),
      error: () => this.oltPorts.set([]),
    });
  }

  /**
   * Carga las ONUs de la OLT y garantiza data COMPLETA:
   *   - Si no hay ONUs todavía → barrido SNMP + enriquecimiento (autoCollect).
   *   - Si ya hay ONUs pero les faltan datos de cliente → completa por CLI (paso 2)
   *     con la ventana de progreso, sin cerrar hasta terminar.
   */
  autoLoad() {
    if (!this.oltId) return;
    clearInterval(this.enrichTimer);
    this.api.zteOnusOfOlt(this.oltId).subscribe({
      next: (r) => {
        this.onus.set(r); this.loaded.set(true);
        if (!r.length) { this.autoCollect(); return; }
        const named = r.filter((o) => (o.clientName || '').trim()).length;
        const faltan = r.length - named;
        // La data cacheada se muestra AL INSTANTE. El popup bloqueante SOLO aparece en una
        // OLT totalmente fría (0 con nombre). Si hay data pero falta completar, se enriquece
        // en SEGUNDO PLANO (sin popup): la tabla se va llenando sola y el scheduler de fondo
        // (NOC_ZTE_ENRICH_ENABLED) la mantiene al día. Antes esto re-disparaba el popup en
        // CADA entrada porque muchas ONU responden por SNMP sin tener cliente asignado.
        // Solo enriquecemos al abrir si la OLT está FRÍA (0 con nombre). Si ya hay data,
        // se muestra tal cual (instantáneo, sin Telnet): el scheduler de fondo la mantiene
        // y el botón "Verificar datos" fuerza un refresco manual cuando el operador quiera.
        if (named === 0) {
          this.loadingErr.set(''); this.loadingNamed.set(named); this.loadingTotal.set(r.length);
          this.loadingOlt.set(true);
          this.startElapsed();
          this.startEnrichPhase();
        }
        void faltan;
      },
      error: () => this.loaded.set(true),
    });
  }

  /** Arranca el cronómetro visible de la obtención. */
  private startElapsed() {
    this.loadingT0 = Date.now();
    this.loadingElapsed.set(0);
    clearInterval(this.elapsedTimer);
    this.elapsedTimer = setInterval(() => this.loadingElapsed.set(Math.floor((Date.now() - this.loadingT0) / 1000)), 1000);
  }
  private stopElapsed() { clearInterval(this.elapsedTimer); }

  /** Formatea segundos como mm:ss. */
  elapsedStr(): string {
    const s = this.loadingElapsed();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** % de clientes ya obtenidos por CLI (para la barra determinada del paso 2). */
  enrichPct(): number {
    const t = this.loadingTotal();
    return t > 0 ? Math.min(100, Math.round((this.loadingNamed() / t) * 100)) : 0;
  }

  /**
   * Obtención automática y COMPLETA de la OLT, en 2 pasos. La ventana NO se cierra
   * hasta terminar el paso 2 (datos de cliente).
   *   Paso 1 (SNMP): estado + señal de todas las ONUs (rápido).
   *   Paso 2 (CLI):  nombre / contrato / IP / serial / distancia, cliente por cliente.
   */
  autoCollect() {
    if (!this.oltId) return;
    clearInterval(this.enrichTimer);
    this.loadingOlt.set(true); this.loadingErr.set(''); this.loadingCount.set(0);
    this.loadingPhase.set('snmp'); this.loadingNamed.set(0); this.loadingTotal.set(0);
    this.startElapsed();
    // Avance REAL del paso 1: mientras el backend inserta ONUs, poll del conteo para verlo crecer.
    const poll = setInterval(() => {
      if (!this.oltId) return;
      this.api.zteOnusOfOlt(this.oltId).subscribe((r) => this.loadingCount.set(r.length));
    }, 1500);
    this.api.zteCollectSnmp(this.oltId).subscribe({
      next: () => { clearInterval(poll); this.loadOnus(); this.startEnrichPhase(); },
      error: (err) => {
        clearInterval(poll);
        this.stopElapsed();
        this.loadingOlt.set(false);
        // Muestra la causa REAL que devuelve el backend (OLT sin IP / no responde SNMP);
        // si no hay mensaje (error de red), cae al texto genérico.
        this.loadingErr.set(err?.message || 'No se pudo obtener la información de la OLT. Revisá el SNMP: community, puerto y alcance de red hacia la OLT.');
      },
    });
  }

  /** Paso 2: dispara el enriquecimiento CLI y sondea su avance hasta terminar. */
  private startEnrichPhase() {
    this.loadingPhase.set('enrich');
    // Lanza el enriquecimiento (o se engancha al que ya corre el scheduler).
    this.api.zteEnrich(this.oltId, false).subscribe({ next: () => this.pollEnrich(), error: () => this.pollEnrich() });
  }

  private pollEnrich() {
    clearInterval(this.enrichTimer);
    let started = false, idle = 0;
    this.enrichTimer = setInterval(() => {
      if (!this.oltId) { clearInterval(this.enrichTimer); return; }
      this.api.zteEnrichStatus(this.oltId).subscribe({
        next: (s: any) => {
          this.loadingNamed.set(s.named || 0);
          this.loadingTotal.set(s.total || 0);
          this.loadOnus(); // la tabla se va llenando en vivo detrás del popup
          if (s.running) started = true;
          // Cerrar cuando la Fase A (nombres/serial/IP) esté lista; la distancia/consumo siguen en 2º plano.
          if (s.namesReady || (started && !s.running) || (!s.running && ++idle >= 5)) {
            clearInterval(this.enrichTimer);
            this.stopElapsed();
            const pend = (s.total || 0) - (s.withDistance || 0);
            this.flash(pend > 0 && s.running
              ? `✅ Nombres, contrato, IP y serial listos en ${this.elapsedStr()}. Completando distancia y consumo de ${pend} clientes en segundo plano…`
              : `✅ OLT completa en ${this.elapsedStr()} · ${s.named}/${s.total} clientes con datos.`);
            this.loadingOlt.set(false);
            this.loadOnus();
          }
        },
        error: () => { clearInterval(this.enrichTimer); this.stopElapsed(); this.loadingOlt.set(false); },
      });
    }, 2000);
  }

  /** Muestra un aviso que se limpia solo (para no dejarlo pegado). */
  private flash(msg: string, ms = 90000) {
    this.note.set(msg);
    clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => this.note.set(''), ms);
  }

  /** Oculta el popup pero deja el enriquecimiento corriendo en segundo plano. */
  dismissLoading() {
    clearInterval(this.enrichTimer);
    this.stopElapsed();
    this.loadingOlt.set(false);
    this.flash('👤 Completando datos de clientes en segundo plano. La tabla se irá llenando sola.');
    this.loadOnus();
  }

  /** Elige un LPU-PON desde el modal: fija el filtro, cierra y refresca la tabla. */
  selectPort(p: string) {
    this.port = p;
    this.lpuModal.set(false);
    this.loadOnus();
  }

  curOlt() { return this.olts().find((x) => x.id === this.oltId); }

  /** Abre el gráfico en grande en una ventana emergente (usa los datos EN VIVO del modal). */
  openBig(kind: 'rx' | 'traf', title: string) { this.big.set({ kind, title }); }

  tempBg(t: number): string {
    if (t >= 55) return 'var(--red)';
    if (t >= 45) return 'var(--amber)';
    return 'var(--green)';
  }

  /** Confirmador: valida que lo mostrado se recolectó de verdad y cuánto cruzó con el ERP. */
  verif = signal<any>(null);
  verificar() {
    if (!this.oltId) return;
    this.api.zteVerificacion(this.oltId).subscribe({
      next: (v) => this.verif.set(v),
      error: () => this.verif.set({ recoleccion_ok: false, onus: 0, con_senal: 0, con_serial: 0,
                                    cruzadas_con_erp: 0, contratos_en_erp: 0, sin_cliente_erp: 0 }),
    });
  }

  oltSystem() {
    this.busy.set(true);
    this.api.zteOltSystem(this.oltId).subscribe({
      next: (olt) => { this.busy.set(false); this.olts.update((l) => l.map((x) => (x.id === olt.id ? olt : x))); },
      error: () => this.busy.set(false),
    });
  }

  discover() {
    this.busy.set(true);
    this.api.zteDiscoverCards(this.oltId).subscribe({
      next: (olt) => {
        this.busy.set(false);
        this.olts.update((list) => list.map((x) => (x.id === olt.id ? olt : x)));
      },
      error: () => this.busy.set(false),
    });
  }

  constructor() {
    this.api.zteOlts().subscribe((o) => {
      this.olts.set(o);
      if (o.length) { this.oltId = o[0].id; this.port = ''; this.loadOltPorts(); this.autoLoad(); }
      else this.loaded.set(true);
    });
    // La tabla se refresca sola cada 30s (salvo mientras hay algo en curso).
    this.tableTimer = setInterval(() => {
      if (this.oltId && !this.busy()) this.loadOnus();
    }, 30000);
  }

  loadOnus() {
    if (!this.oltId) return;
    this.api.zteOnusOfOlt(this.oltId).subscribe({
      next: (r) => { this.onus.set(r); this.loaded.set(true); },
      error: () => this.loaded.set(true),
    });
  }

  collect(full: boolean) {
    if (!this.oltId || !this.port) return;
    this.busy.set(true);
    const call = full ? this.api.zteCollectFull(this.oltId, this.port) : this.api.zteCollect(this.oltId, this.port);
    call.subscribe({ next: () => { this.busy.set(false); this.loadOnus(); }, error: () => this.busy.set(false) });
  }

  /** Barrido SNMP masivo de toda la OLT (estado + potencia + alertas) en 2 walks. */
  collectSnmp() {
    if (!this.oltId) return;
    this.busy.set(true);
    this.api.zteCollectSnmp(this.oltId).subscribe({
      next: () => { this.busy.set(false); this.loadOnus(); },
      error: () => this.busy.set(false),
    });
  }

  /** Enriquecimiento CLI en background: nombre de cliente / serial / distancia. */
  enrichClients() {
    if (!this.oltId) return;
    this.busy.set(true);
    this.api.zteEnrich(this.oltId).subscribe({
      next: (r: any) => {
        this.busy.set(false);
        this.note.set(`👤 Enriquecimiento iniciado: ${r?.encoladas ?? 0} ONUs en cola. La tabla se irá llenando sola; recargá en unos minutos.`);
        setTimeout(() => this.loadOnus(), 10000);
      },
      error: () => this.busy.set(false),
    });
  }

  refresh(o: OnuRow) {
    this.busy.set(true);
    this.api.zteRefresh(this.oltId, o.onuId, `${o.shelf}/${o.slot}/${o.port}`).subscribe({
      next: () => { this.busy.set(false); this.loadOnus(); }, error: () => this.busy.set(false),
    });
  }

  openOnu(o: OnuRow) {
    clearInterval(this.modalTimer);
    this.sel.set(o);
    this.refreshSel(o, true);
    // EN VIVO: contador de 1s; al llegar a 0 refresca y reinicia.
    this.modalCountdown.set(30);
    this.modalTimer = setInterval(() => {
      const c = this.modalCountdown() - 1;
      if (c <= 0) { const cur = this.sel(); if (cur) this.refreshSel(cur, false); this.modalCountdown.set(30); }
      else this.modalCountdown.set(c);
    }, 1000);
  }

  /** Refresca la ONU del modal (detalle + potencia + consumo), su histórico y sus alertas. */
  private refreshSel(o: OnuRow, showBusy: boolean) {
    this.loadHistory(o);
    this.api.zteOnuAlerts(o.rawIndex).subscribe((a) => this.onuAlerts.set(a));
    if (showBusy) this.busy.set(true);
    this.api.zteRefresh(this.oltId, o.onuId, `${o.shelf}/${o.slot}/${o.port}`).subscribe({
      next: (u) => {
        this.busy.set(false);
        // Solo actualizar si el modal sigue abierto en la MISMA ONU (evita reabrir tras cerrar/cambiar).
        if (this.sel()?.id === o.id) { this.sel.set(u); this.loadHistory(u); }
        this.loadOnus();
      },
      error: () => this.busy.set(false),
    });
  }

  closeModal() {
    clearInterval(this.modalTimer);
    this.sel.set(null);
  }

  ngOnDestroy(): void {
    clearInterval(this.modalTimer);
    clearInterval(this.tableTimer);
    clearInterval(this.enrichTimer);
    clearInterval(this.elapsedTimer);
    clearTimeout(this.noteTimer);
  }

  private loadHistory(o: OnuRow) {
    this.histLab.set([]); this.histDs.set([]); this.trafLab.set([]); this.trafDs.set([]);
    this.api.zteOnuHistory(o.id, 'onu_rx_optical_power_dbm').subscribe((p) => {
      this.histLab.set(p.map((x) => x.t));
      this.histDs.set([areaDs('RX (dBm)', '#16a34a', p.map((x) => +x.v! || 0))]);
    });
    this.api.zteOnuHistory(o.id, 'onu_out_rate_bps').subscribe((p) => {
      this.trafLab.set(p.map((x) => x.t));
      this.trafDs.set([areaDs('Descarga (Mbps)', '#7b0061', p.map((x) => (+x.v! || 0) * 8 / 1e6))]);
    });
  }

  causes(o: OnuRow): { time: string; cause: string }[] {
    if (!o.offlineHistory) return [];
    return o.offlineHistory.split(';').filter((s) => s).map((s) => {
      const [time, cause] = s.split('|');
      return { time, cause: cause || 'Desconocida' };
    });
  }

  causeLabel(c: string): string {
    if (c === 'DyingGasp') return 'Sin energía (cliente)';
    if (c === 'LOS') return 'LOS (fibra)';
    return c;
  }

  /** Bps (bytes/s) -> bits legibles. */
  fmtTs(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  rate(bps: number | null): string {
    if (bps == null) return '—';
    const bits = bps * 8;
    if (bits >= 1e6) return (bits / 1e6).toFixed(2) + ' Mbps';
    if (bits >= 1e3) return (bits / 1e3).toFixed(0) + ' Kbps';
    return bits + ' bps';
  }

  bytes(b: number | null): string {
    if (b == null) return '—';
    if (b >= 1e12) return (b / 1e12).toFixed(2) + ' TB';
    if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(0) + ' MB';
    return (b / 1e3).toFixed(0) + ' KB';
  }

  /** Extrae el número de contrato (prefijo numérico del Name). '' si no tiene. */
  contrato(name: string | null): string {
    if (!name) return '';
    const m = name.match(/^\s*(\d+)\s*[-_]/);
    return m ? m[1] : '';
  }

  /** Nombre del cliente sin el contrato (prefijo) ni la IP (sufijo). */
  clientOnly(name: string | null): string {
    if (!name) return '—';
    let n = name.trim();
    n = n.replace(/^\s*\d+\s*[-_]+\s*/, '');                       // quita contrato + separador inicial
    n = n.replace(/[-_]+\s*\d{1,3}(\.\d{1,3}){3}\s*$/, '');        // quita IP al final si viene
    n = n.replace(/[-_\s]+$/, '').trim();                          // limpia separadores/espacios finales
    return n || name;
  }

  stateBadge(s: string): string {
    const p = (s || '').toLowerCase();
    if (p === 'working') return '<span class="badge b-up">ONLINE</span>';
    if (p === 'los') return '<span class="badge b-down">LOS (fibra)</span>';
    return '<span class="badge b-maint">OFFLINE</span>';
  }

  rxColor(v: number): string {
    if (v <= -27) return 'var(--red)';
    if (v <= -25) return 'var(--amber)';
    return 'var(--green)';
  }
}
