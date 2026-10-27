import { Component, DestroyRef, HostListener, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MapaChromeService } from '../../core/services/mapa-chrome.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { AuthRepository } from '../../features/seg/data-access/auth.repository';
import { SessionStore } from '../../features/seg/store/session.store';

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
  readonly mapaMenuOpen = this.mapaChromeService.menuOpen;

  private readonly authRepo = inject(AuthRepository);
  private readonly sessionStore = inject(SessionStore);
  readonly userName = computed(() => this.sessionStore.user()?.username ?? 'Usuario');

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

  closeMapaMenu() {
    this.mapaChromeService.closeMenu();
  }

  /** Al elegir una pantalla se cierra el menu (aunque sea el mismo mapa). */
  onMapaMenuNavClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement | null;
    if (t?.closest('a')) this.closeMapaMenu();
  }

  logout() {
    this.mapaChromeService.closeMenu();
    this.authRepo.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Escape en el mapa SOLO cierra el menu. Antes sacaba la barra superior entera: se
   * cerraba un dialogo con Esc y aparecia el navbar sin forma de volver a esconderlo.
   */
  @HostListener('window:keydown.escape')
  onEscapeKey() {
    if (this.isMapaRouteActive() && this.mapaMenuOpen()) {
      this.closeMapaMenu();
    }
  }

  /**
   * En escritorio: si el sidebar está expandido y se hace click FUERA del menú
   * (y fuera del botón hamburguesa), se colapsa solo. No bloquea el click: el
   * contenido igual recibe su evento. En móvil ya lo maneja el overlay.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    // En el mapa no hay sidebar fija: su menu es el de la hamburguesa y se maneja aparte.
    if (this.isMapaRouteActive() && this.mapaChromeHidden()) return;
    if (this.sidebarService.isMobile() || this.isCollapsed()) return;
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    // Solo colapsa si el click cae DENTRO del contenido principal. Así nunca
    // interfiere con el menú, sus submenús, la barra superior ni el hamburguesa.
    if (target.closest('.layout-main-container')) {
      this.sidebarService.setCollapsed(true);
    }
  }
}
