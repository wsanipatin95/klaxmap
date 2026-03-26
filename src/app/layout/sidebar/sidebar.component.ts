import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SidebarService, MenuItem } from '../../core/services/sidebar.service';
import { SessionStore, DynamicMenuItem } from '../../features/seg/store/session.store';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  sidebarService = inject(SidebarService);
  private router = inject(Router);
  private sessionStore = inject(SessionStore);

  isCollapsed = this.sidebarService.isCollapsed;
  isMobileVisible = this.sidebarService.isMobileVisible;
  isMobile = this.sidebarService.isMobile;
  menuItems = signal<MenuItem[]>([]);

  constructor() {
    // reconstruye menú cuando cambia:
    // - rol
    // - activeCompanyId
    // - privilegios/menus de sesión
    effect(() => {
      const inCompany = this.sessionStore.inCompanyMode();
      const role = this.sessionStore.orgRole();
      const session = this.sessionStore.session();

      if (!session) {
        this.menuItems.set([]);
        return;
      }

      if (inCompany) {
        // MODO EMPRESA: menú viene del backend
        const built = this.buildCompanyMenu(session.menusEmpresa ?? []);
        this.menuItems.set(built);
      } else {
        // MODO ORGANIZACIÓN: menú fijo pero controlado por rol/privilegiosOrg
        const built = this.buildOrgMenu();
        this.menuItems.set(built);
      }
    });
  }

  /** ============ BUILDERS ============ */

  private buildOrgMenu(): MenuItem[] {
    const isAdmin = this.sessionStore.isOrgAdmin();
    const canOrgModule = this.sessionStore.hasOrgPrivilege('acc_mod_organizacion');
    const canSubscription = this.sessionStore.hasOrgPrivilege('acc_mod_suscripcion');

    const items: MenuItem[] = [
      { label: 'Principal', isDivider: true },
     /* {
        label: 'Dashboard',
        icon: 'pi pi-home',
        route: '/app/dashboard',
      },*/

      {
        label: 'MAPAS',
        icon: 'pi pi-building',
        route: '/app/mapa/home',
      },
    ];
    items.push({
      label: 'Auditoría',
      icon: 'pi pi-history',
      route: '/app/adm/auditoria',
    });
    // ADMIN: siempre ve organización/suscripción.
    // MIEMBRO: solo si tiene privilegio (acc_mod_organizacion / acc_mod_suscripcion)
    if (isAdmin || canOrgModule) {
      items.push({
        label: 'Organización',
        icon: 'pi pi-sitemap',
        route: '/app/org', // aquí cae el dashboard con tabs de organización
      });
    }

    if (isAdmin || canSubscription) {
      items.push({
        label: 'Suscripción',
        icon: 'pi pi-credit-card',
        route: '/app/fac', // si luego haces ruta dedicada, cámbiala aquí
      });
    }

    return items;
  }

  private buildCompanyMenu(raw: DynamicMenuItem[]): MenuItem[] {
    // Filtramos por privilegios de empresa
    const filtered = this.filterDynamicMenu(raw);

    const items: MenuItem[] = [
      { label: 'Empresa', isDivider: true },
    ];

    for (const it of filtered) {
      const mapped = this.mapDynamicToSidebarItem(it);
      if (mapped) items.push(mapped);
    }

    items.push(
      { label: '—', isDivider: true },
      {
        label: 'Salir de empresa',
        icon: 'pi pi-sign-out',
        action: () => {
          this.sessionStore.clearActiveCompany();
          this.router.navigate(['/app/mis-empresas']);
          if (this.isMobile()) this.sidebarService.closeMobileSidebar();
        },
      }
    );

    return items;
  }

  /** Filtra menú por privilegiosEmpresa:
   * - un item se muestra si:
   *   - no tiene privilegio (libre) OR
   *   - tiene privilegio y el usuario lo posee OR
   *   - alguno de sus hijos queda visible
   */
  private filterDynamicMenu(items: DynamicMenuItem[]): DynamicMenuItem[] {
    const has = (p?: string) => !p || this.sessionStore.hasCompanyPrivilege(p);

    return (items ?? [])
      .map((item) => {
        const children = this.filterDynamicMenu(item.submenu ?? []);
        const allowedSelf = has(item.privilegio);
        const allowed = allowedSelf || children.length > 0;

        if (!allowed) return null;

        return { ...item, submenu: children };
      })
      .filter(Boolean) as DynamicMenuItem[];
  }

  private mapDynamicToSidebarItem(item: DynamicMenuItem): MenuItem | null {
    const icon = this.mapIcon(item.icono);

    // Si tiene hijos => parent
    if ((item.submenu?.length ?? 0) > 0) {
      return {
        label: item.menu,
        icon,
        expanded: false,
        items: item.submenu!.map((ch) => ({
          label: ch.menu,
          icon: this.mapIcon(ch.icono),
          route: this.normalizeRoute(ch.funcion),
        })),
      };
    }

    // Item final
    return {
      label: item.menu,
      icon,
      route: this.normalizeRoute(item.funcion),
    };
  }

  private normalizeRoute(funcion?: string) {
    if (!funcion) return '/app/dashboard';
    // recomendamos que backend mande rutas absolutas
    if (funcion.startsWith('/')) return funcion;
    return '/' + funcion;
  }

  private mapIcon(icono?: string) {
    // Si backend ya manda clases pi (ej: "pi pi-phone"), se usa.
    if (icono && icono.includes('pi ')) return icono;
    // Si manda iconos propios "ino-isp", puedes mapearlo aquí a una clase css o a pi icon.
    // Por ahora fallback:
    return 'pi pi-folder';
  }

  /** ============ INTERACCIONES ============ */

  private collapseEffect = effect(() => {
    if (this.isCollapsed()) {
      this.collapseAllSubmenus();
    }
  });

  toggleSubmenu(item: MenuItem) {
    if (this.isCollapsed()) return;

    item.expanded = !item.expanded;

    this.menuItems().forEach(menuItem => {
      if (menuItem !== item && menuItem.items) {
        menuItem.expanded = false;
      }
    });
  }

  onMenuClick(item: MenuItem, ev?: Event) {
    if (item.action) {
      ev?.preventDefault();
      ev?.stopPropagation();
      item.action();
      return;
    }
    this.navigateToRoute(item.route);
  }

  navigateToRoute(route?: string) {
    if (!route) return;

    this.router.navigate([route]);

    if (this.isMobile()) {
      this.sidebarService.closeMobileSidebar();
      return;
    }

    // Auto-contraer solo al entrar al módulo de mapas
    if (route.startsWith('/app/mapa')) {
      this.sidebarService.setCollapsed(true);
    }
  }

  collapseAllSubmenus() {
    this.menuItems().forEach(item => {
      if (item.items) item.expanded = false;
    });
  }

  closeMobileSidebar() {
    this.sidebarService.closeMobileSidebar();
  }
}
