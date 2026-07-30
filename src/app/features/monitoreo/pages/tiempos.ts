import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi } from '../services/noc-api';

@Component({
  selector: 'app-tiempos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="panel">
      <div class="ph">⏱ Tiempos</div>
      <div class="pb">
        <table style="width:100%">
          <thead><tr><th>Parámetro</th><th>Cada</th><th></th></tr></thead>
          <tbody>
            @for (s of items(); track s.settingKey) {
              <tr>
                <td><b>{{ s.label }}</b></td>
                <td>
                  <input class="inp" type="number" min="1" style="width:110px" [(ngModel)]="s.settingValue">
                  <span style="color:var(--muted);margin-left:6px">{{ s.unit }}</span>
                </td>
                <td><button class="btn sm" (click)="save(s)">Guardar</button></td>
              </tr>
            } @empty {
              <tr><td colspan="3" style="color:var(--muted);padding:20px">Cargando…</td></tr>
            }
          </tbody>
        </table>
        @if (msg()) { <div style="color:var(--green);margin-top:10px;font-weight:600">{{ msg() }}</div> }
      </div>
    </div>
  `,
})
export class TiemposConfig {
  private api = inject(NocApi);
  items = signal<any[]>([]);
  msg = signal('');

  constructor() {
    // Solo INTERVALOS (claves *_seconds). Los umbrales de monitoreo/alertas y las
    // notificaciones viven en sus propias pestañas.
    this.api.settings().subscribe((s) => this.items.set(
      s.filter((x) => { const k = String(x.settingKey); return k.endsWith('_seconds') && !k.startsWith('notify_'); })));
  }

  save(s: any) {
    this.api.updateSetting(s.settingKey, String(s.settingValue)).subscribe({
      next: () => { this.msg.set(`✓ "${s.label}" actualizado a ${s.settingValue} ${s.unit}`); setTimeout(() => this.msg.set(''), 3500); },
      error: () => this.msg.set('No se pudo guardar.'),
    });
  }
}
