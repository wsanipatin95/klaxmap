import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MapaChromeService {
  readonly isMapaRouteActive = signal(false);
  readonly hidden = signal(false);

  syncRoute(url: string) {
    const isMapa = this.isMapaRoute(url);
    this.isMapaRouteActive.set(isMapa);
    this.hidden.set(isMapa);
  }

  toggle() {
    if (!this.isMapaRouteActive()) {
      return;
    }

    this.hidden.update((value) => !value);
  }

  show() {
    if (!this.isMapaRouteActive()) {
      return;
    }

    this.hidden.set(false);
  }

  hide() {
    if (!this.isMapaRouteActive()) {
      return;
    }

    this.hidden.set(true);
  }

  private isMapaRoute(url: string): boolean {
    const cleanUrl = (url || '').split('?')[0].split('#')[0];
    return cleanUrl === '/app/mapa' || cleanUrl.startsWith('/app/mapa/');
  }
}
