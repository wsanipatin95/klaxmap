export type Paged<T> = {
    items: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
};

export type OrgUsuarioDto = {
    // View kxv_seg_organizacion_usuario (campos típicos)
    usu: number;
    idSegOrganizacionFk?: number;
    organizacion?: string;
    rol?: string;
    estado?: number; // 1 activo, 0 inactivo
    usuario?: string; // correo
    fecGen?: string;
};

export type OrgInvitacionRequest = {
    idSegOrganizacion: number;
    usuario: string;     // correo
    usuGen: number;
    // si tu backend requiere más campos, agrégalos aquí
};

export type OrgUsuarioToggleRequest = {
    organizacion: number;
    usu: number;
    usugen: number;
};

export type OrgUsuarioExisteResponse = {
    exists: boolean;
    usuario: string;
    idSegUsuario?: number;
    enOrganizacion?: boolean;
};
