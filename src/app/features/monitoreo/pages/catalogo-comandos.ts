import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NocApi, OltMarca } from '../services/noc-api';

/**
 * Catálogo de comandos CLI por MARCA de OLT, con ESCRITURA DUAL: al guardar, el
 * comando se escribe en el ERP (kxt_adm_script, dueño) y en NOC (copia local del
 * motor) a la vez. La marca viene del ERP (kxt_red_olt_marca).
 */
@Component({
  selector: 'app-catalogo-comandos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="panel">
      <div class="pb" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <label class="k">Marca de OLT (del ERP)</label>
          <select class="inp" style="min-width:220px" [(ngModel)]="marca" (ngModelChange)="cargar()">
            <option [ngValue]="0">— Elegí una marca —</option>
            @for (m of marcas(); track m.idRedOltMarca) {
              <option [ngValue]="m.idRedOltMarca">{{ m.marca }}</option>
            }
          </select>
        </div>
        <div style="color:var(--muted);font-size:12px;max-width:560px;line-height:1.5">
          Lo que guardes acá se escribe en el <b>ERP</b> (plantillas por marca) y en el <b>NOC</b>
          (copia local que usa el motor) a la vez. El ERP es el dueño: si falla el ERP, no se toca NOC.
        </div>
      </div>
    </div>

    @if (marca() > 0) {
      <div class="panel" style="margin-top:14px">
        <div class="ph">Comandos de lectura · <b>{{ marcaNombre() }}</b></div>
        <div class="pb" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="text-align:left;color:var(--muted);border-bottom:1px solid var(--border)">
                <th style="padding:10px 12px;width:250px">Lectura</th>
                <th style="padding:10px 12px">Comando CLI</th>
                <th style="padding:10px 12px;width:110px"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of filas(); track row.metricKey) {
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 12px"><b>{{ row.label }}</b>
                    <div style="font-size:11px;color:var(--muted)">{{ row.metricKey }}</div></td>
                  <td style="padding:10px 12px">
                    <input class="inp" style="width:100%;font-family:'Consolas',monospace;font-size:12.5px"
                           [(ngModel)]="row.comando" [placeholder]="row.ph"></td>
                  <td style="padding:10px 12px">
                    <button class="btn sm" (click)="guardar(row)" [disabled]="!row.comando || saving()">Guardar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (msg()) { <div class="pb" style="color:#16a34a;font-size:13px">{{ msg() }}</div> }
        @if (err()) { <div class="pb" style="color:var(--red);font-size:13px">{{ err() }}</div> }
      </div>
    }
  `,
})
export class CatalogoComandos {
  private api = inject(NocApi);
  marcas = signal<OltMarca[]>([]);
  marca = signal<number>(0);
  saving = signal(false);
  msg = signal('');
  err = signal('');

  filas = signal<{ metricKey: string; label: string; ph: string; comando: string }[]>([]);

  private readonly BASE = [
    { metricKey: 'onu_optical_power', label: 'Potencia OLT (RX/TX)', ph: 'show pon power attenuation gpon-onu_{port}:{onuId}' },
    { metricKey: 'onu_traffic', label: 'Consumo (tráfico ONU)', ph: 'show interface gpon-onu_{port}:{onuId}' },
    { metricKey: 'onu_detail', label: 'Detalle ONU (nombre/serie/contrato)', ph: 'show gpon onu detail-info gpon-onu_{port}:{onuId}' },
    { metricKey: 'onu_oper_state', label: 'Estado ONU', ph: 'show gpon onu state gpon-onu_{port}:{onuId}' },
    { metricKey: 'olt_cards', label: 'Tarjetas de la OLT', ph: 'show card' },
    { metricKey: 'olt_temperature', label: 'Temperatura de la OLT', ph: 'show temperature' },
  ];

  constructor() {
    this.api.catalogoMarcas().subscribe({
      next: (m) => this.marcas.set(m || []),
      error: (e) => this.err.set('No se pudieron leer las marcas del ERP: ' + (e?.message || 'error')),
    });
    this.resetFilas();
  }

  marcaNombre(): string {
    return this.marcas().find((m) => m.idRedOltMarca === this.marca())?.marca || '';
  }

  private resetFilas() {
    this.filas.set(this.BASE.map((b) => ({ ...b, comando: '' })));
  }

  cargar() {
    this.msg.set(''); this.err.set('');
    this.resetFilas();
    if (this.marca() <= 0) return;
    this.api.catalogoComandos(this.marca()).subscribe({
      next: (rows) => {
        const map = new Map((rows || []).map((r) => [r.metric_key, r.comando]));
        this.filas.set(this.BASE.map((b) => ({ ...b, comando: map.get(b.metricKey) || '' })));
      },
      error: () => {},
    });
  }

  guardar(row: { metricKey: string; comando: string }) {
    this.msg.set(''); this.err.set(''); this.saving.set(true);
    this.api.guardarComando({ idMarca: this.marca(), metricKey: row.metricKey, comando: row.comando }).subscribe({
      next: () => { this.saving.set(false); this.msg.set('Guardado en ERP y NOC: ' + row.metricKey); },
      error: (e) => { this.saving.set(false); this.err.set(e?.message || 'No se pudo guardar.'); },
    });
  }
}
