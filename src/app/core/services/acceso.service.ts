import { Injectable, computed, inject } from '@angular/core';
// eslint-disable-next-line boundaries/element-types -- excepción ya existente en core:
// los interceptores de core también leen la sesión desde features/seg. El objetivo de
// este servicio es JUSTAMENTE concentrar aquí esa dependencia, para que las features
// (monitoreo, etc.) consulten permisos contra core y no contra otra feature.
import { SessionStore } from 'src/app/features/seg/store/session.store';

/**
 * Punto único para preguntar "¿este usuario puede hacer X?".
 *
 * Antes cada pantalla leía SessionStore por su cuenta, lo que obligaba a que una
 * feature importara de otra (prohibido por la regla de fronteras). Acá queda una
 * sola dependencia, documentada, y las features consumen esto.
 *
 * IMPORTANTE: esto sirve para OCULTAR opciones en la interfaz, no para proteger
 * datos. El control real tiene que estar en el servidor: cualquiera puede llamar
 * a la API directamente sin pasar por la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class AccesoService {
  private sesion = inject(SessionStore);

  /** Administrador de la organización: puede todo. */
  readonly esAdmin = computed(() => this.sesion.isOrgAdmin());

  /**
   * Nivel supervisor sobre el módulo de Monitoreo: alta, edición y baja de equipos.
   * Es admin de organización o tiene el privilegio de empresa NOC_EQUIPOS_ADMIN.
   */
  readonly esSupervisorEquipos = computed(
    () => this.sesion.isOrgAdmin() || this.sesion.hasCompanyPrivilege('NOC_EQUIPOS_ADMIN'),
  );

  /** Consulta genérica de un privilegio de empresa. */
  tienePrivilegio(codigo: string): boolean {
    return this.sesion.isOrgAdmin() || this.sesion.hasCompanyPrivilege(codigo);
  }
}
