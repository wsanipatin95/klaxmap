import type { ApiEnvelope } from 'src/app/core/api/api-envelope';

export type PerfilDto = {
  idSegPerfil: number;
  perfil: string;
  jerarquia?: number | null;
  idNomDepartamentoFk?: number | null;
  eliminado?: string | null;
  usu?: number | null;
};

export type PerfilCreateRequest = {
  perfil: string;
  jerarquia?: number | null;
  idNomDepartamentoFk?: number | null;
};

export type PerfilEditRequest = {
  idSegPerfil: number;
  cambios: Record<string, any>;
};

export type PerfilPrivTreeLeafDto = {
  id: number;              // id_seg_pagina
  text: string;            // detalle
  checked: boolean;
  control: 'check' | 'radio';
  radioGroup: number | null;
};

export type PerfilPrivTreeNodeDto = {
  text: string;
  children?: Array<PerfilPrivTreeNodeDto | PerfilPrivTreeLeafDto>;
};

export type PerfilPrivilegiosArbolResponse = {
  idSegPerfil: number;
  arbol: PerfilPrivTreeNodeDto[];
};

export type PerfilPrivilegiosGuardarRequest = {
  idSegPerfil: number;
  paginas: number[];
};
