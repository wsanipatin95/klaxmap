export type Paged<T> = {
    items: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
};

export type EmpresaUsuarioDto = {
    idSegOrganizacionEmpresaUsuario?: number;
    usu: number; // id_seg_usuario
    idSegOrganizacionEmpresaFk: string; // uuid
    usuario?: string; // correo
    empresa?: string;
    estado?: number; // 1 activo, 0 inactivo
    fecGen?: string;
    estadoEmpresa?: number;
};

export type EmpresaUsuarioRegistrarRequest = {
    usuario: string; // correo
    idEmpresa: string; // uuid
    usuGen: number;
};

export type EmpresaUsuarioQuitarRequest = {
    usu: number;      // id_seg_usuario
    idEmpresa: string; // uuid
    usuGen: number;
};
