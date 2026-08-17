import { Component, effect, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SidebarService, MenuItem } from '../../core/services/sidebar.service';
import { SessionStore, DynamicMenuItem } from '../../features/seg/store/session.store';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
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
  private env = inject(ENVIRONMENT);
  auditoriaRed = computed(() =>
    this.sessionStore.hasCompanyPrivilege('ram_red_red')
  );

  isCollapsed = this.sidebarService.isCollapsed;
  isMobileVisible = this.sidebarService.isMobileVisible;
  isMobile = this.sidebarService.isMobile;
  menuItems = signal<MenuItem[]>([]);

  constructor() {
    /**
     * Nuevo flujo:
     * - si backend ya mandó menusEmpresa al login => usamos ese menú
     * - si no hay menú dinámico => usamos menú org como fallback
     */
    effect(() => {
      const session = this.sessionStore.session();

      if (!session) {
        this.menuItems.set([]);
        return;
      }


      const built = this.buildOrgMenu();
      this.menuItems.set(built);
      this.sidebarService.setCollapsed(true);
    });
  }

  /** ============ BUILDERS ============ */

  private buildOrgMenu(): MenuItem[] {
    const items: MenuItem[] = [
      { label: 'Principal', isDivider: true }
    ];
    items.push({
      label: 'Inicio',
      icon: 'pi pi-home',
      route: '/app/dashboard',
    });

    if (this.env.company === 'inno') {
      items.push({
        label: 'MAPAS',
        icon: 'pi pi-map',
        route: '/app/mapa/home',
      });
      items.push({
        label: 'Red operativa (beta)',
        icon: 'pi pi-sitemap',
        route: '/app/mapa-red-beta',
      });
      items.push({
        label: 'Monitoreo',
        icon: 'pi pi-server',
        expanded: false,
        items: [
          { label: 'Alerta temprana', icon: 'pi pi-bell', route: '/app/monitoreo/inicio' },
          { label: 'Mi dashboard', icon: 'pi pi-th-large', route: '/app/monitoreo/mi-dashboard' },
          { label: 'Equipos', icon: 'pi pi-server', route: '/app/monitoreo/equipos' },
          { label: 'Topología de Red', icon: 'pi pi-sitemap', route: '/app/monitoreo/topologia' },
          { label: 'Clientes (ONU)', icon: 'pi pi-users', route: '/app/monitoreo/clientes' },
          { label: 'Salud GPON', icon: 'pi pi-chart-bar', route: '/app/monitoreo/salud-gpon' },
          { label: 'Alertas', icon: 'pi pi-exclamation-triangle', route: '/app/monitoreo/alertas' },
          { label: 'Tráfico por app', icon: 'pi pi-chart-line', route: '/app/monitoreo/trafico-apps' },
          { label: 'Seguridad IP', icon: 'pi pi-shield', route: '/app/monitoreo/seguridad' },
          { label: 'Soporte', icon: 'pi pi-wrench', route: '/app/monitoreo/soporte' },
          { label: 'Configurar OLT', icon: 'pi pi-cog', route: '/app/monitoreo/configurar-olt' },
          { label: 'Configurar ACS', icon: 'pi pi-wifi', route: '/app/monitoreo/configurar-acs' },
          { label: 'Configuración', icon: 'pi pi-sliders-h', route: '/app/monitoreo/configuracion' },
          { label: 'Lab SNMP', icon: 'pi pi-search', route: '/app/monitoreo/lab-snmp' },
          { label: 'Respaldos de equipos', icon: 'pi pi-save', route: '/app/monitoreo/backup' },
        ],
      });
      if (this.auditoriaRed()) {
        items.push({
          label: 'Historial',
          icon: 'pi pi-history',
          route: '/app/adm/auditoria',
        });
      }
    } if (this.env.company === 'klax') {
      items.push({
        label: 'Backups',
        icon: 'pi pi-database',
        route: '/app/backups/',
      });
    } else if (this.env.company === 'dumax') {
      items.push({
        label: 'Importación',
        icon: 'pi pi-history',
        route: '/app/importacion/',
      });

      items.push({
        label: 'Vehículos',
        icon: 'pi pi-car',
        route: '/app/vehiculos/',
      });

    }else{

    }
    return items;
  }

  private buildCompanyMenu(raw: DynamicMenuItem[]): MenuItem[] {
    const filtered = this.filterDynamicMenu(raw);

    const items: MenuItem[] = [
      { label: 'Principal', isDivider: true },
    ];

    for (const it of filtered) {
      const mapped = this.mapDynamicToSidebarItem(it);
      if (mapped) items.push(mapped);
    }

    return items;
  }

  /**
   * Filtra menú por privilegiosEmpresa:
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

    return {
      label: item.menu,
      icon,
      route: this.normalizeRoute(item.funcion),
    };
  }

  private normalizeRoute(funcion?: string) {
    if (!funcion) return '/app/dashboard';
    if (funcion.startsWith('/')) return funcion;
    return '/' + funcion;
  }

  private mapIcon(icono?: string) {
    if (icono && icono.includes('pi ')) return icono;
    return 'pi pi-folder';
  }

  /** ============ INTERACCIONES ============ */

  private collapseEffect = effect(() => {
    if (this.isCollapsed()) {
      this.collapseAllSubmenus();
    }
  });

  toggleSubmenu(item: MenuItem) {
    // Si el sidebar está colapsado (solo iconos), primero lo expandimos para
    // que el submenú sea visible, y abrimos este.
    if (this.isCollapsed()) {
      this.sidebarService.setCollapsed(false);
      item.expanded = true;
      this.menuItems().forEach(menuItem => {
        if (menuItem !== item && menuItem.items) {
          menuItem.expanded = false;
        }
      });
      return;
    }

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

    // Escritorio: al seleccionar un ítem (o submenú) colapsamos el menú.
    this.sidebarService.setCollapsed(true);
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