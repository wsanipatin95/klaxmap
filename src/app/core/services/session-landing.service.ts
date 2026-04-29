import { Injectable, inject } from '@angular/core';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { DynamicMenuItem, SessionStore } from 'src/app/features/seg/store/session.store';

@Injectable({ providedIn: 'root' })
export class SessionLandingService {
  private sessionStore = inject(SessionStore);
  private env = inject(ENVIRONMENT);

  private readonly dashboardRoute = '/app/dashboard';
  private readonly mapaRoute = '/app/mapa/home';
  private readonly dumaxOrdenesRoute = '/app/vehiculos/ordenes';

  /**
   * Ruta principal según empresa:
   * - inno  -> mapas
   * - dumax -> órdenes
   * - cualquier otra empresa diferente de inno/dumax -> dashboard
   */
  getLandingUrl(): string {
    return this.resolveCompanyLanding(this.currentCompanyFingerprint());
  }

  /**
   * Para cuando se entra desde Mis Empresas.
   * Evalúa primero el nombre de empresa de la fila seleccionada.
   */
  getLandingUrlForCompanyName(companyName?: string | null): string {
    const explicit = this.normalize(companyName);
    if (explicit) return this.resolveCompanyLanding(explicit);
    return this.getLandingUrl();
  }

  /**
   * Decide destino después de login.
   *
   * Se respeta un returnUrl interno específico, pero se ignoran rutas de arranque
   * o rutas viejas de mapa para que no manden siempre a mapas por error.
   */
  resolveLoginTarget(returnUrl?: string | null): string {
    const landing = this.getLandingUrl();
    const safeReturnUrl = this.normalizeReturnUrl(returnUrl);

    if (!safeReturnUrl) return landing;

    if (this.isAutoStartUrl(safeReturnUrl)) {
      return landing;
    }

    return safeReturnUrl;
  }

  private resolveCompanyLanding(fingerprint: string): string {
    if (this.isInno(fingerprint)) {
      return this.mapaRoute;
    }

    if (this.isDumax(fingerprint)) {
      return this.dumaxOrdenesRoute;
    }

    return this.dashboardRoute;
  }

  private currentCompanyFingerprint(): string {
    const session = this.sessionStore.session();

    const rawParts: string[] = [
      this.env.company,
      this.env.tenant,
      session?.user?.catalogo,
      session?.meta?.contextPath,
      session?.meta?.environment,
      ...this.menuText(session?.menusEmpresa ?? []),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return this.normalize(rawParts.join(' '));
  }

  private menuText(items: DynamicMenuItem[]): string[] {
    const out: string[] = [];

    const walk = (list: DynamicMenuItem[]) => {
      for (const item of list ?? []) {
        if (item.menu) out.push(item.menu);
        if (item.funcion) out.push(item.funcion);
        if (item.privilegio) out.push(item.privilegio);
        if (item.submenu?.length) walk(item.submenu);
      }
    };

    walk(items ?? []);
    return out;
  }

  private normalize(value?: string | null): string {
    if (!value) return '';

    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private isDumax(value: string): boolean {
    const normalized = ` ${value} `;
    return normalized.includes(' dumax ');
  }

  private isInno(value: string): boolean {
    const normalized = ` ${value} `;

    return (
      normalized.includes(' inno ') ||
      normalized.includes(' innova ') ||
      normalized.includes(' innovation ')
    );
  }

  private normalizeReturnUrl(returnUrl?: string | null): string | null {
    const raw = String(returnUrl || '').trim();

    if (!raw) return null;
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//')) return null;
    if (raw.includes('://')) return null;
    if (!raw.startsWith('/app')) return null;

    return raw;
  }

  /**
   * Rutas que no deben forzar destino porque son rutas base/automáticas.
   * El caso importante es /app/mapa/home, porque antes quedaba como returnUrl
   * y mandaba a mapas aunque la empresa fuera dumax u otra.
   */
  private isAutoStartUrl(url: string): boolean {
    const clean = url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

    return (
      clean === '/app' ||
      clean === '/app/dashboard' ||
      clean === '/app/mapa' ||
      clean.startsWith('/app/mapa/')
    );
  }
}
