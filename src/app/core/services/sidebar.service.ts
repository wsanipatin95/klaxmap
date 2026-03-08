import { Injectable, signal, computed } from '@angular/core';

export interface MenuItem {
  label: string;
  icon?: string;
  route?: string;
  items?: MenuItem[];
  expanded?: boolean;
  badge?: string;
  badgeClass?: string;
  isDivider?: boolean;

  // NUEVO: acciones (ej: "Salir de empresa")
  action?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // Estado de colapso del sidebar
  private _isCollapsed = signal(false);
  private _isMobileVisible = signal(false);

  // Propiedades computadas públicas
  isCollapsed = computed(() => this._isCollapsed());
  isMobileVisible = computed(() => this._isMobileVisible());

  // Detectar si es móvil
  isMobile = computed(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  constructor() {
    // Escuchar cambios de tamaño de ventana
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
          this._isMobileVisible.set(false);
        }
      });
    }
  }

  // Alternar colapso del sidebar
  toggleCollapse() {
    this._isCollapsed.update(value => !value);
  }

  // Establecer estado de colapso
  setCollapsed(collapsed: boolean) {
    this._isCollapsed.set(collapsed);
  }

  // Alternar visibilidad en móvil
  toggleMobileVisibility() {
    this._isMobileVisible.update(value => !value);
  }

  // Cerrar sidebar en móvil
  closeMobileSidebar() {
    this._isMobileVisible.set(false);
  }

  // Abrir sidebar en móvil
  openMobileSidebar() {
    this._isMobileVisible.set(true);
  }
}
