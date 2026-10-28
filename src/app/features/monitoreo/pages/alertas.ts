import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NocApi, Alert } from '../services/noc-api';
import { TableSort } from '../shared/table-sort';

type Grupo = 'red' | 'clientes' | 'todo';

/**
 * Alertas del NOC.
 *
 * Antes: traia las ~50 mil filas de la tabla y ordenaba por la hora sola ('23:59'), asi que
 * lo de cualquier noche quedaba arriba y una caida de hace 5 min no se veia. Ahora el back
 * filtra (activas siempre + la ventana elegida), separa la RED de la señal de CLIENTES y
 * manda fecha completa y duracion real.
 */
@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="tools al-tools">
      @if (showBack()) { <button class="btn ghost sm" (click)="back()" title="Volver">← Atrás</button> }
      <span class="pg-title" style="font-size:15px"><i class="pi pi-exclamation-triangle"></i> Alertas</span>

      <div class="seg">
        <button [class.on]="grupo()==='red'" (click)="setGrupo('red')" title="Equipos caídos, enlaces, energía, caídas masivas de PON">Red</button>
        <button [class.on]="grupo()==='clientes'" (click)="setGrupo('clientes')" title="Señal y ONUs caídas de clientes sueltos">Clientes</button>
        <button [class.on]="grupo()==='todo'" (click)="setGrupo('todo')">Todo</button>
      </div>
      <div class="seg">
        <button [class.on]="soloActivas()" (click)="soloActivas.set(true)">Activas</button>
        <button [class.on]="!soloActivas() && horas()===24" (click)="verHistorial(24)">24 h</button>
        <button [class.on]="!soloActivas() && horas()===168" (click)="verHistorial(168)">7 días</button>
      </div>
      <input class="al-q" placeholder="Buscar equipo, cliente, contrato…" [value]="q()" (input)="q.set($any($event.target).value)" />

      <span class="al-n">
        <b class="c-crit">{{ cuenta().crit }}</b> críticas ·
        <b class="c-warn">{{ cuenta().warn }}</b> advertencias activas
        @if (!soloActivas()) { · {{ rows().length }} en la lista }
      </span>
      @if (cargando()) { <span class="al-n">cargando…</span> }
      @if (filtered()) {
        <span class="badge b-ack">{{ filterLabel() }}</span>
        <a class="btn ghost sm" routerLink="/app/monitoreo/alertas" style="text-decoration:none"><i class="pi pi-list"></i> Ver todas</a>
      }
    </div>

    <div class="panel">
      <table>
        <thead><tr>
          <th class="srt" (click)="sort.by('severidad')">Severidad{{ sort.arrow('severidad') }}</th>
          <th class="srt" (click)="sort.by('equipo')">Equipo{{ sort.arrow('equipo') }}</th>
          <th class="srt" (click)="sort.by('iface')">Interfaz{{ sort.arrow('iface') }}</th>
          <th class="srt" (click)="sort.by('descripcion')">Descripción{{ sort.arrow('descripcion') }}</th>
          <th class="srt" (click)="sort.by('inicio')">Inicio{{ sort.arrow('inicio') }}</th>
          <th>Fin</th>
          <th class="srt" (click)="sort.by('duracion')">Duración{{ sort.arrow('duracion') }}</th>
          <th class="srt" (click)="sort.by('estado')">Estado{{ sort.arrow('estado') }}</th>
        </tr></thead>
        <tbody>
          @for (a of rows(); track a.id) {
            <tr [class.al-open]="a.status==='open'" [class.al-down]="a.status==='open' && a.es_equipo">
              <td><span class="badge" [class.b-crit]="a.severity==='crit'" [class.b-warn]="a.severity!=='crit'">{{ a.severity==='crit' ? 'CRÍTICO' : 'WARNING' }}</span></td>
              <td><b>{{ a.device_name }}</b></td>
              <td>{{ a.iface === 'EQUIPO' ? 'Equipo caído' : a.iface }}</td>
              <td>{{ a.description }}</td>
              <td style="white-space:nowrap">{{ a.started }}</td>
              <td style="white-space:nowrap">{{ a.ended || '—' }}</td>
              <td style="white-space:nowrap">{{ a.duration }}</td>
              <td>
                @if (a.status==='open') { <span class="badge b-crit">ACTIVA</span> }
                @else { <span class="badge b-maint">resuelta</span> }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="8" style="text-align:center;color:var(--muted);padding:30px">
              {{ cargando() ? 'Cargando…' : (soloActivas() ? 'Nada caído ahora mismo.' : 'Sin alertas en este rango.') }}
            </td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .al-tools{flex-wrap:wrap;gap:8px;align-items:center}
    .seg{display:inline-flex;border:1px solid var(--border,#d6d9e0);border-radius:8px;overflow:hidden}
    .seg button{border:0;background:transparent;padding:4px 11px;font-size:12.5px;cursor:pointer;color:var(--muted,#64748b)}
    .seg button + button{border-left:1px solid var(--border,#d6d9e0)}
    .seg button.on{background:#7a0f4f;color:#fff}
    .al-q{height:28px;border:1px solid var(--border,#d6d9e0);border-radius:8px;padding:0 10px;font-size:12.5px;min-width:220px}
    .al-n{font-size:12.5px;color:var(--muted,#64748b)}
    .c-crit{color:#c0262d}.c-warn{color:#b45309}
    tr.al-open td{background:#fff8f0}
    tr.al-down td{background:#fdecec}
  `],
})
export class Alertas implements OnDestroy {
  private api = inject(NocApi);
  private route = inject(ActivatedRoute);
  list = signal<Alert[]>([]);
  sevFilter = signal('');       // 'crit' | 'warn' | ''
  showBack = signal(false);
  grupo = signal<Grupo>('red');
  soloActivas = signal(true);
  horas = signal(24);
  q = signal('');
  cargando = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;
  back() { history.back(); }

  sort = new TableSort<Alert>({
    severidad: (a) => (a.severity === 'crit' ? 0 : 1),
    equipo: (a) => a.device_name,
    iface: (a) => a.iface,
    descripcion: (a) => a.description,
    inicio: (a) => a.started_at ?? '',      // fecha completa, no 'HH:MI'
    duracion: (a) => a.segundos ?? 0,
    estado: (a) => (a.status === 'open' ? 0 : 1),
  }, 'inicio', -1);

  filtered = computed(() => !!this.sevFilter());
  filterLabel = computed(() => (this.sevFilter() === 'crit' ? 'solo críticas' : this.sevFilter() === 'warn' ? 'solo advertencias' : ''));

  cuenta = computed(() => {
    let crit = 0, warn = 0;
    for (const a of this.list()) if (a.status === 'open') a.severity === 'crit' ? crit++ : warn++;
    return { crit, warn };
  });

  rows = computed(() => {
    let l = this.list();
    const sev = this.sevFilter();
    if (this.soloActivas()) l = l.filter((a) => a.status === 'open');
    if (sev === 'crit') l = l.filter((a) => a.severity === 'crit');
    else if (sev === 'warn') l = l.filter((a) => a.severity !== 'crit');
    const q = this.q().trim().toLowerCase();
    if (q) l = l.filter((a) => `${a.device_name} ${a.iface} ${a.description}`.toLowerCase().includes(q));
    // Las activas siempre arriba; dentro, el orden que eligio el usuario.
    const ord = this.sort.apply(l);
    return [...ord.filter((a) => a.status === 'open'), ...ord.filter((a) => a.status !== 'open')];
  });

  constructor() {
    // ?sev=crit&status=open&back=1 (lo usan otras pantallas para entrar filtrado)
    this.route.queryParamMap.subscribe((q) => {
      this.sevFilter.set(q.get('sev') || '');
      if (q.get('status') === 'open') this.soloActivas.set(true);
      const g = q.get('grupo');
      if (g === 'red' || g === 'clientes' || g === 'todo') this.grupo.set(g);
      this.showBack.set(q.get('back') === '1');
      this.cargar();
    });
    this.timer = setInterval(() => this.cargar(), 30_000);   // se refresca sola
  }

  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  setGrupo(g: Grupo) { this.grupo.set(g); this.cargar(); }
  verHistorial(h: number) { this.soloActivas.set(false); this.horas.set(h); this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.api.alerts(this.horas(), this.grupo()).subscribe({
      next: (d) => { this.list.set(d ?? []); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }
}
