import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarService } from '../../core/services/sidebar.service';

@Component({
  selector: 'app-layout',
  imports: [RouterModule, NavbarComponent, SidebarComponent],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sidebarService = inject(SidebarService);
  readonly isCollapsed = this.sidebarService.isCollapsed;
  readonly isMobileVisible = this.sidebarService.isMobileVisible;
  readonly isMapaRouteActive = signal(this.isMapaRoute(this.router.url));
  readonly mapaChromeHidden = signal(this.isMapaRoute(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const isMapa = this.isMapaRoute(this.router.url);
        this.isMapaRouteActive.set(isMapa);
        this.mapaChromeHidden.set(isMapa);
      });
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobileSidebar();
  }

  toggleMapaChrome() {
    if (!this.isMapaRouteActive()) {
      return;
    }

    this.mapaChromeHidden.update((hidden) => !hidden);
  }

  showMapaChrome() {
    if (!this.isMapaRouteActive()) {
      return;
    }

    this.mapaChromeHidden.set(false);
  }

  @HostListener('window:keydown.escape')
  onEscapeKey() {
    if (this.isMapaRouteActive() && this.mapaChromeHidden()) {
      this.showMapaChrome();
    }
  }

  private isMapaRoute(url: string): boolean {
    const cleanUrl = (url || '').split('?')[0].split('#')[0];
    return cleanUrl === '/app/mapa' || cleanUrl.startsWith('/app/mapa/');
  }
}
