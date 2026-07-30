import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NocApi, Alert } from '../services/noc-api';
import { TableSort } from '../shared/table-sort';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="tools">
      @if (showBack()) { <button class="btn ghost sm" (click)="back()" title="Volver">← Atrás</button> }
      <span style="font-weight:600;font-size:15px">⚠ Alertas</span>
      <span style="color:var(--muted);font-size:12.5px">— {{ rows().length }} {{ filtered() ? 'que coinciden' : 'registradas' }}</span>
      @if (filtered()) {
        <span class="badge b-ack">{{ filterLabel() }}</span>
        <a class="btn ghost sm" routerLink="/app/monitoreo/alertas" style="text-decoration:none">✕ Ver todas</a>
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
          <th class="srt" (click)="sort.by('duracion')">Duración{{ sort.arrow('duracion') }}</th>
          <th class="srt" (click)="sort.by('estado')">Estado{{ sort.arrow('estado') }}</th>
        </tr></thead>
        <tbody>
          @for (a of rows(); track a.id) {
            <tr>
              <td><span class="badge" [class.b-crit]="a.severity==='crit'" [class.b-warn]="a.severity!=='crit'">{{ a.severity==='crit' ? 'CRÍTICO' : 'WARNING' }}</span></td>
              <td><b>{{ a.device_name }}</b></td>
              <td>{{ a.iface }}</td>
              <td>{{ a.description }}</td>
              <td>{{ a.started }}</td>
              <td>{{ a.duration }}</td>
              <td><span class="badge b-maint">{{ a.status }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Sin alertas para este filtro.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class Alertas {
  private api = inject(NocApi);
  private route = inject(ActivatedRoute);
  list = signal<Alert[]>([]);
  sevFilter = signal('');       // 'crit' | 'warn' | ''
  statusFilter = signal('');    // 'open' | ''
  showBack = signal(false);
  back() { history.back(); }

  sort = new TableSort<Alert>({
    severidad: (a) => (a.severity === 'crit' ? 0 : 1),
    equipo: (a) => a.device_name,
    iface: (a) => a.iface,
    descripcion: (a) => a.description,
    inicio: (a) => a.started,
    duracion: (a) => a.duration,
    estado: (a) => a.status,
  }, 'inicio', -1);

  filtered = computed(() => !!this.sevFilter() || !!this.statusFilter());
  filterLabel = computed(() => {
    const parts: string[] = [];
    if (this.sevFilter() === 'crit') parts.push('solo críticas');
    else if (this.sevFilter() === 'warn') parts.push('solo advertencias');
    if (this.statusFilter() === 'open') parts.push('activas');
    return parts.join(' · ');
  });

  rows = computed(() => {
    let l = this.list();
    const sev = this.sevFilter(), st = this.statusFilter();
    if (sev === 'crit') l = l.filter((a) => a.severity === 'crit');
    else if (sev === 'warn') l = l.filter((a) => a.severity !== 'crit');
    if (st === 'open') l = l.filter((a) => a.status === 'open');
    return this.sort.apply(l);
  });

  constructor() {
    // Se recalcula ante cambios de query (?sev=crit&status=open&back=1) sin recrear el componente.
    this.route.queryParamMap.subscribe((q) => {
      this.sevFilter.set(q.get('sev') || '');
      this.statusFilter.set(q.get('status') || '');
      this.showBack.set(q.get('back') === '1');
    });
    this.api.alerts().subscribe((d) => this.list.set(d));
  }
}
