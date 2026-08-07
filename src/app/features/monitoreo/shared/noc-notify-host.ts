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
            <div style="font-size:34px;line-height:1;margin-bottom:10px">{{ n.kind === 'ok' ? '✅' : '⚠️' }}</div>
            <div class="noc-note-t" [style.color]="n.kind === 'ok' ? 'var(--green)' : 'var(--red)'">{{ n.title }}</div>
            <div class="noc-note-x">{{ n.text }}</div>
            <button class="btn" style="margin-top:16px;min-width:130px" (click)="svc.close()">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class NocNotifyHost {
  svc = inject(NocNotify);
}
