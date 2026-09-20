import { Component, inject } from '@angular/core';
import { NocNotify } from '../services/noc-notify';

/**
 * Host del notificador global: modal centrado de OK / error. Se monta UNA vez en el
 * shell del NOC; escucha la senal del servicio NocNotify y muestra el resultado.
 */
@Component({
  selector: 'app-noc-notify',
  standalone: true,
  imports: [],
  template: `
    @if (svc.note(); as n) {
      <div class="noc-note-ov" (click)="svc.close()"></div>
      <div class="noc-note-wrap" (click)="svc.close()">
        <div class="noc-note" (click)="$event.stopPropagation()">
          <div style="padding:26px 22px">
            <div class="nn-ic" [class.ok]="n.kind === 'ok'" [class.err]="n.kind !== 'ok'">
              <i class="pi" [class.pi-check]="n.kind === 'ok'" [class.pi-exclamation-triangle]="n.kind !== 'ok'"></i>
            </div>
            <div class="noc-note-t" [style.color]="n.kind === 'ok' ? 'var(--green)' : 'var(--red)'">{{ n.title }}</div>
            <div class="noc-note-x">{{ n.text }}</div>
            <button class="btn" style="margin-top:16px;min-width:130px" (click)="svc.close()">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .nn-ic { width:48px; height:48px; border-radius:50%; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; }
    .nn-ic.ok { background:#e7f6ec; color:#00ac4a; }
    .nn-ic.err { background:#fdeaea; color:#ec1848; }
    .nn-ic i.pi { font-size:21px; }
  `],
})
export class NocNotifyHost {
  svc = inject(NocNotify);
}
