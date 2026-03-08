import type { PerfilPrivTreeNodeDto } from './perfil.models';

export type UsuarioAplicarPerfilRequest = {
    usu: number;
    idSegPerfil: number;
};

export type UsuarioPrivilegiosGuardarRequest = {
    usu: number;
    paginas: number[];
};

export type UsuarioPrivilegiosArbolResponse = {
    usu: number;
    arbol: PerfilPrivTreeNodeDto[];
};
// ==== Menú dinámico por empresa (para sidebar) ====
export type DynamicMenuItemDto = {
    id: string;
    menu: string;
    icono?: string;
    funcion?: string;        // ruta "/app/..."
    privilegio?: string;     // acc_...
    submenu?: DynamicMenuItemDto[];
};

// ==== Respuesta de /api/erp/usuario/menus ====
export type UsuarioMenusEmpresaResponse = {
    usu: number;
    privilegiosEmpresa: string[];
    menusEmpresa: DynamicMenuItemDto[];
};
