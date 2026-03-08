import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

export type Paged<T> = {
  mode: 'PAGED';
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  items: T[];
};

export type EmpresaDto = {
  idSegOrganizacionEmpresa: string;
  idSegOrganizacionFk: number;

  empresa: string;
  nui: string;
  direccion: string;

  estado: number; // 1 activo, 0 inactivo

  organizacion?: string;
  usuarioGen?: string;

  fecGen?: string | null;
  usuGen?: number | null;
  usuFin?: number | null;
  finFec?: string | null;
  esquemaBase?: string | null;
  estadoEmpresa?: number | null;
};

export type EmpresaCreateRequest = {
  idOrganizacion: number;
  empresa: string;
  nui: string;
  direccion: string;
  usuGen: number;
};

export type EmpresaEditRequest = {
  idEmpresa: string;
  idOrganizacion: number;
  cambios: Partial<Pick<EmpresaDto, 'empresa' | 'nui' | 'direccion' | 'estado'>>;
};
