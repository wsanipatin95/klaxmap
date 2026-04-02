import { Component, DestroyRef, inject, signal } from '@angular/core';
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
  readonly isMapaFullscreen = signal(this.isMapaRoute(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.isMapaFullscreen.set(this.isMapaRoute(this.router.url));
      });
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobileSidebar();
  }

  private isMapaRoute(url: string): boolean {
    const cleanUrl = (url || '').split('?')[0].split('#')[0];
    return cleanUrl === '/app/mapa' || cleanUrl.startsWith('/app/mapa/');
  }
}
