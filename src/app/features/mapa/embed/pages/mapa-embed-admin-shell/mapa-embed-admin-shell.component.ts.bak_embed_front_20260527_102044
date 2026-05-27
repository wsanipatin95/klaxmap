import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SessionStore } from 'src/app/features/seg/store/session.store';
import { MapaHomeComponent } from '../../../pages/mapa-home/mapa-home.component';
import { MapaEmbedAuthService } from '../../services/mapa-embed-auth.service';
import { MapaEmbedContextStore } from '../../store/mapa-embed-context.store';
import { MapaEmbedMessagingService } from '../../services/mapa-embed-messaging.service';

@Component({
  selector: 'app-mapa-embed-admin-shell',
  standalone: true,
  imports: [CommonModule, MapaHomeComponent],
  templateUrl: './mapa-embed-admin-shell.component.html',
  styleUrl: './mapa-embed-admin-shell.component.scss',
})
export class MapaEmbedAdminShellComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(MapaEmbedAuthService);
  private readonly sessionStore = inject(SessionStore);
  private readonly embedStore = inject(MapaEmbedContextStore);
  private readonly messaging = inject(MapaEmbedMessagingService);

  readonly loading = signal(true);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit() {
    const origin = this.route.snapshot.queryParamMap.get('origin');
    this.embedStore.setPostMessageOrigin(origin);

    const code = this.route.snapshot.queryParamMap.get('code');

    if (!code && this.sessionStore.isAuthenticated()) {
      this.loading.set(false);
      this.ready.set(true);
      this.messaging.ready('admin', this.embedStore.context());
      return;
    }

    if (!code) {
      this.fail('Falta el parámetro code para abrir el mapa administrador embebido.');
      return;
    }

    this.auth.exchange(code, 'admin').subscribe({
      next: () => {
        this.loading.set(false);
        this.ready.set(true);
        this.messaging.ready('admin', this.embedStore.context());
      },
      error: (err) => {
        this.fail(err?.error?.mensaje || err?.message || 'No se pudo iniciar el mapa administrador.');
      },
    });
  }

  private fail(message: string) {
    this.loading.set(false);
    this.ready.set(false);
    this.error.set(message);
    this.messaging.error(message);
  }
}
