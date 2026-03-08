// Request que envías al backend para login
export interface LoginRequest {
    usuario: string;
    clave: string;
}
// Lo que devuelve el backend al hacer login
export interface LoginResponse {
    environment: string;   // "dev"
    tipo: number;          // 0
    usu: number;           // 1
    contextPath: string;   // "/klaxerp"
    usuario: string;       // "administrador"
    catalogo: string;      // "public"
    token: string;
    organizacion: any;        // "eyJhbGciOiJIUzI1NiJ9..."
}

export interface AuthErrorResponse {
    error: string; // "Credenciales inválidas"
}

// =====================
// ENVELOPE GENERAL API
// (tu backend responde codigo/mensaje/data)
// =====================
export type ApiEnvelope<T> = {
    codigo: number;
    mensaje: string;
    data: T | null;
};

// =====================
// REGISTRO GLOBAL
// POST /api/aut/registro-global
// =====================
export type RegistroGlobalRequest = {
    usuario: string;        // email
    clave: string;          // password
    organizacion: string;   // ej: "KLAX"
    representante: string;  // "Nombres Apellidos"
    movil: string;          // ej: "09690025142"
};

export type RegistroGlobalData = {
    id: number;
};

export type RegistroGlobalResponse = ApiEnvelope<RegistroGlobalData>;

// ===== RESETEAR CLAVE =====
export type ResetearClaveData = {
    usuario: string; // el backend te devuelve el email en "id"
};

export type ResetearClaveResponse = ApiEnvelope<ResetearClaveData>;

export type ConfirmarCuentaData = {
    token: string; // backend devuelve email en id
};

export type ConfirmarCuentaResponse = ApiEnvelope<ConfirmarCuentaData>;

export type CheckTokenData = any; // el backend no siempre devuelve data útil aquí
export type CheckTokenResponse = ApiEnvelope<CheckTokenData>;

// ===== CONFIRMAR CLAVE =====
export type ConfirmarClaveRequest = {
    token: string;
    clave: string;
};

export type ConfirmarClaveData = {
    token: string
};
export type ConfirmarClaveResponse = ApiEnvelope<ConfirmarClaveData>;

// ===== CONFIRMAR INVITACIÓN =====
export type ConfirmarInvitacionRequest = {
    token: string;
    clave: string;
    representante: string;
    movil: string;
    organizacion: number; // idSegOrganizacionUsuario
    modo: number; // 0 nuevo, 1 existente
};

export type ConfirmarInvitacionData = {
    token: string; // backend devuelve email en "id"
};

export type ConfirmarInvitacionResponse = ApiEnvelope<ConfirmarInvitacionData>;
