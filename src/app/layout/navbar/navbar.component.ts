import { Component, signal, inject, ViewChild, HostListener, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { Menu } from 'primeng/menu';
import { Router } from '@angular/router';
import { SidebarService } from '../../core/services/sidebar.service';
import { NotificationSidebar } from '../notification-sidebar/notification-sidebar';
import { AuthRepository } from '../../features/seg/data-access/auth.repository';
import { SessionStore } from '../../features/seg/store/session.store';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, MenuModule, BadgeModule, NotificationSidebar],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  private sidebarService = inject(SidebarService);
  private authRepo = inject(AuthRepository);
  private sessionStore = inject(SessionStore);
  private router = inject(Router);

  @ViewChild('userMenu') userMenu!: Menu;
  @ViewChild('notificationMenu') notificationMenu!: Menu;
  @ViewChild('notificationSidebar') notificationSidebar!: NotificationSidebar;

  userName = computed(() => this.sessionStore.user()?.username ?? 'Usuario');
  hasDynamicMenu = this.sessionStore.hasDynamicCompanyMenu;

  notificationCount = signal(3);

  userMenuItems = signal<MenuItem[]>([]);

  private buildUserMenu() {
    const items: MenuItem[] = [
      {
        label: 'Mi Perfil',
        icon: 'pi pi-user',
        command: () => this.goToProfile(),
      },
      {
        label: 'Cambiar Contraseña',
        icon: 'pi pi-key',
        command: () => this.changePassword(),
      },
    ];

    items.push(
      { separator: true },
      {
        label: 'Cerrar Sesión',
        icon: 'pi pi-sign-out',
        command: () => this.logout(),
      }
    );

    this.userMenuItems.set(items);
  }

  constructor() {
    effect(() => {
      this.hasDynamicMenu();
      this.buildUserMenu();
    });
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (this.userMenu) this.userMenu.hide();
    if (this.notificationMenu) this.notificationMenu.hide();
  }

  toggleSidebar() {
    if (this.sidebarService.isMobile()) {
      this.sidebarService.toggleMobileVisibility();
    } else {
      this.sidebarService.toggleCollapse();
    }
  }

  goToProfile() {
    console.log('Go to profile');
  }

  changePassword() {
    console.log('Change password');
  }

  logout() {
    this.authRepo.logout();
    this.router.navigate(['/login']);
  }

  openNotifications() {
    this.notificationSidebar.openDrawer();
  }
}