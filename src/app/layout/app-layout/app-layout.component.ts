import { Component, DestroyRef, HostListener, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MapaChromeService } from '../../core/services/mapa-chrome.service';
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
  readonly mapaChromeService = inject(MapaChromeService);

  readonly isCollapsed = this.sidebarService.isCollapsed;
  readonly isMobileVisible = this.sidebarService.isMobileVisible;
  readonly isMapaRouteActive = this.mapaChromeService.isMapaRouteActive;
  readonly mapaChromeHidden = this.mapaChromeService.hidden;

  constructor() {
    this.mapaChromeService.syncRoute(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.mapaChromeService.syncRoute(this.router.url);
      });
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobileSidebar();
  }

  toggleMapaChrome() {
    this.mapaChromeService.toggle();
  }

  showMapaChrome() {
    this.mapaChromeService.show();
  }

  @HostListener('window:keydown.escape')
  onEscapeKey() {
    if (this.isMapaRouteActive() && this.mapaChromeHidden()) {
      this.showMapaChrome();
    }
  }
}
