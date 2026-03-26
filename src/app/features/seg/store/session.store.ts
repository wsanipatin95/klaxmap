import { Injectable, computed, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type OrgRole = 'administrador' | 'miembro';

export interface SessionOrg {
  idOrganizacion: number;
  rol: OrgRole;
}

export interface SessionUser {
  id: number;            // viene de "usu"
  username: string;      // viene de "usuario"
  catalogo: string;      // se conserva por compatibilidad, aunque ya no gobierna el contexto
  tipo: number;
  organizacion: SessionOrg[];
}

export interface SessionMeta {
  environment: string;
  contextPath: string;
}

/**
 * Menú dinámico que viene del backend.
 * - si submenu.length > 0 => padre
 * - si funcion tiene ruta => item navegable
 */
export interface DynamicMenuItem {
  id: string;
  menu: string;
  icono?: string;
  funcion?: string;      // ruta: "/app/..."
  privilegio?: string;   // ej: "adc_isp"
  submenu?: DynamicMenuItem[];
}

export interface Session {
  token: string;
  user: SessionUser;
  meta: SessionMeta;

  // Privilegios organización (fallback / panel org)
  privilegiosOrg: string[];

  // Privilegios resueltos por backend al login
  privilegiosEmpresa: string[];

  // Menú resuelto por backend al login
  menusEmpresa: DynamicMenuItem[];
}

const SESSION_KEY = 'app_session';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private _session = signal<Session | null>(null);

  readonly session = computed(() => this._session());
  readonly isAuthenticated = computed(() => !!this._session()?.token);

  readonly user = computed(() => this._session()?.user ?? null);
  readonly meta = computed(() => this._session()?.meta ?? null);

  readonly orgRole = computed<OrgRole | null>(() => {
    const u = this._session()?.user;
    return u?.organizacion?.[0]?.rol ?? null;
  });

  readonly isOrgAdmin = computed(() => this.orgRole() === 'administrador');

  readonly privilegiosOrg = computed(() => this._session()?.privilegiosOrg ?? []);
  readonly privilegiosEmpresa = computed(() => this._session()?.privilegiosEmpresa ?? []);
  readonly menusEmpresa = computed(() => this._session()?.menusEmpresa ?? []);

  /**
   * Nuevo criterio:
   * Si backend ya envió menú de empresa en login, la app trabaja directo con eso.
   */
  readonly hasDynamicCompanyMenu = computed(() => this.menusEmpresa().length > 0);

  private readonly _orgSet = computed(() => new Set(this.privilegiosOrg()));
  private readonly _empSet = computed(() => new Set(this.privilegiosEmpresa()));

  constructor() {
    this.hydrateFromStorage();
  }

  setSession(session: Session) {
    this._session.set(session);
    if (!this.isBrowser) return;

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Si storage está bloqueado o lleno, no reventar la app
    }
  }

  patchSession(patch: Partial<Session>) {
    const s = this._session();
    if (!s) return;
    this.setSession({ ...s, ...patch });
  }

  clearSession() {
    this._session.set(null);
    if (!this.isBrowser) return;

    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  /** Organización: Admin entra sin necesitar privilegios finos. Miembro depende de privilegiosOrg */
  hasOrgPrivilege(code: string) {
    if (this.isOrgAdmin()) return true;
    return this._orgSet().has(code);
  }

  /** Privilegios resueltos por backend al login */
  hasCompanyPrivilege(code: string) {
    return this._empSet().has(code);
  }

  /**
   * Limpia solo menú/privilegios dinámicos.
   * Ya no existe “salir de empresa”, pero dejamos este helper por si en algún flujo
   * necesitas reiniciar el contexto dinámico sin cerrar sesión.
   */
  clearDynamicAccess() {
    this.patchSession({
      privilegiosEmpresa: [],
      menusEmpresa: [],
    });
  }

  private hydrateFromStorage() {
    if (!this.isBrowser) return;

    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as Session;
      this._session.set(session);
    } catch {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }
}