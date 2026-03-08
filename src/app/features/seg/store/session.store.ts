import { Injectable, computed, signal } from '@angular/core';

export type OrgRole = 'administrador' | 'miembro';

export interface SessionOrg {
  idOrganizacion: number;
  rol: OrgRole;
}

export interface SessionUser {
  id: number;            // viene de "usu"
  username: string;      // viene de "usuario"
  catalogo: string;      // "public"
  tipo: number;
  organizacion: SessionOrg[];
}

export interface SessionMeta {
  environment: string;
  contextPath: string;
}

/**
 * Menú dinámico que viene del backend para MODO EMPRESA
 * - si submenu.length > 0 => padre
 * - si funcion tiene ruta => item navegable
 */
export interface DynamicMenuItem {
  id: string;
  menu: string;
  icono?: string;
  funcion?: string;          // ruta: "/app/isp/..." (recomendado)
  privilegio?: string;       // ej: "adc_isp"
  submenu?: DynamicMenuItem[];
}

export interface Session {
  token: string;
  user: SessionUser;
  meta: SessionMeta;

  // (1) Privilegios organización (panel organización)
  privilegiosOrg: string[];

  // (2) Privilegios por empresa (empresa activa)
  privilegiosEmpresa: string[];

  // (3) Menú dinámico por empresa (empresa activa)
  menusEmpresa: DynamicMenuItem[];

  // ===== Contexto de trabajo (UI/menú) =====
  // UUID empresa (id_seg_organizacion_empresa)
  activeCompanyId?: string | null;

  // Nombre para UI
  activeCompanyName?: string | null;

  // esquema_base (ej: "public")
  activeCompanySchemaBase?: string | null;

  tenantCompanyId?: string | null;
  tenantCompanyName?: string | null;
  tenantCompanySchemaBase?: string | null;
}

const SESSION_KEY = 'app_session';

function stripDashes(uuid: string) {
  return (uuid || '').replace(/-/g, '');
}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private _session = signal<Session | null>(null);

  readonly session = computed(() => this._session());
  readonly isAuthenticated = computed(() => !!this._session()?.token);

  readonly user = computed(() => this._session()?.user ?? null);
  readonly meta = computed(() => this._session()?.meta ?? null);

  // ===== Trabajo/UI =====
  readonly activeCompanyId = computed(() => this._session()?.activeCompanyId ?? null);
  readonly activeCompanyName = computed(() => this._session()?.activeCompanyName ?? null);
  readonly activeCompanySchemaBase = computed(() => this._session()?.activeCompanySchemaBase ?? null);

  // ===== Tenant/Requests =====
  readonly tenantCompanyId = computed(() => this._session()?.tenantCompanyId ?? null);
  readonly tenantCompanyName = computed(() => this._session()?.tenantCompanyName ?? null);
  readonly tenantCompanySchemaBase = computed(() => this._session()?.tenantCompanySchemaBase ?? null);

  readonly inCompanyMode = computed(() => !!this.activeCompanyId());

  readonly xTenant = computed(() => {
    const id = this.tenantCompanyId();
    const base = this.tenantCompanySchemaBase();
    if (!id || !base) return null;
    const clean = stripDashes(id);
    if (!clean) return null;
    return `${base}_${clean}`;
  });

  readonly orgRole = computed<OrgRole | null>(() => {
    const u = this._session()?.user;
    return u?.organizacion?.[0]?.rol ?? null;
  });
  readonly isOrgAdmin = computed(() => this.orgRole() === 'administrador');

  readonly privilegiosOrg = computed(() => this._session()?.privilegiosOrg ?? []);
  readonly privilegiosEmpresa = computed(() => this._session()?.privilegiosEmpresa ?? []);

  private readonly _orgSet = computed(() => new Set(this.privilegiosOrg()));
  private readonly _empSet = computed(() => new Set(this.privilegiosEmpresa()));

  constructor() {
    this.hydrateFromStorage();
  }

  setSession(session: Session) {
    this._session.set(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  patchSession(patch: Partial<Session>) {
    const s = this._session();
    if (!s) return;
    this.setSession({ ...s, ...patch });
  }

  clearSession() {
    this._session.set(null);
    localStorage.removeItem(SESSION_KEY);
  }

  /** Organización: Admin entra sin necesitar privilegios finos. Miembro depende de privilegiosOrg */
  hasOrgPrivilege(code: string) {
    if (this.isOrgAdmin()) return true;
    return this._orgSet().has(code);
  }

  /** Empresa: se basa en privilegiosEmpresa (empresa activa) */
  hasCompanyPrivilege(code: string) {
    return this._empSet().has(code);
  }

  /**
   * - afecta MENÚ (inCompanyMode)
   * - y también el TENANT para requests
   */
  setActiveCompany(params: { companyId: string; schemaBase: string; companyName?: string }) {
    this.patchSession({
      // trabajo/UI
      activeCompanyId: params.companyId,
      activeCompanySchemaBase: params.schemaBase,
      activeCompanyName: params.companyName ?? null,

      // tenant/requests
      tenantCompanyId: params.companyId,
      tenantCompanySchemaBase: params.schemaBase,
      tenantCompanyName: params.companyName ?? null,
    });
  }


  setTenantCompany(params: { companyId: string; schemaBase: string; companyName?: string }) {
    this.patchSession({
      tenantCompanyId: params.companyId,
      tenantCompanySchemaBase: params.schemaBase,
      tenantCompanyName: params.companyName ?? null,
    });
  }

  clearActiveCompany() {
    // volver a modo organización: limpia empresa activa + tenant + permisos/menú
    this.patchSession({
      activeCompanyId: null,
      activeCompanyName: null,
      activeCompanySchemaBase: null,

      tenantCompanyId: null,
      tenantCompanyName: null,
      tenantCompanySchemaBase: null,

      privilegiosEmpresa: [],
      menusEmpresa: [],
    });
  }

  clearTenantCompany() {
    this.patchSession({
      tenantCompanyId: null,
      tenantCompanyName: null,
      tenantCompanySchemaBase: null,
    });
  }

  private hydrateFromStorage() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as Session;
      this._session.set(session);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}
