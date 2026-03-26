export interface AuditoriaSupervisorItem {
  idSegAuditoria: number;
  fechaHora: string | null;
  usuarioId: number | null;
  usuarioLogin: string | null;

  tabla: string;
  tablaLabel: string;
  modulo: string;
  entidad: string;

  idRegistro: string;

  operacion: string;
  operacionLabel: string;

  campo: string | null;
  campoLabel: string;

  valorAnterior: string | null;
  valorNuevo: string | null;

  resumenHumano: string;
}

export interface AuditoriaCambio {
  idSegAuditoria: number;
  campo: string | null;
  campoLabel: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  resumenHumano: string;
}

export interface AuditoriaGrupo {
  grupoId: string;
  fechaHora: string | null;
  usuarioId: number | null;
  usuarioLogin: string | null;

  tabla: string;
  tablaLabel: string;
  modulo: string;
  entidad: string;

  idRegistro: string;

  operacion: string;
  operacionLabel: string;

  resumenGeneral: string;

  cambios: AuditoriaCambio[];
}

export interface AuditoriaRegistroResponse {
  tabla: string;
  tablaLabel: string;
  modulo: string;
  entidad: string;
  idRegistro: string;
  totalEventos: number;
  historial: AuditoriaGrupo[];
}

export interface AuditoriaSupervisorResponse {
  items: AuditoriaSupervisorItem[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
  total?: number;
  all: boolean;
}

export interface AuditoriaFormularioResponse {
  tabla: string;
  tablaLabel: string;
  modulo: string;
  entidad: string;
  items: AuditoriaGrupo[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
  total?: number;
  all: boolean;
}

export interface AuditoriaSupervisorFilters {
  q?: string;
  usuario?: number | null;
  tabla?: string | null;
  operacion?: string | null;
  idRegistro?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  page?: number;
  size?: number;
  all?: boolean;
}

export interface AuditoriaFormularioFilters {
  tabla: string;
  q?: string;
  operacion?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  page?: number;
  size?: number;
  all?: boolean;
}