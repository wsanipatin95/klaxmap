export type BodegaDto = {
    idInvBodega: number;
    nombre: string;
    centro: number;

    // backend: tipo_bodega f/m/r :contentReference[oaicite:9]{index=9}
    tipoBodega: string;

    // opcionales backend :contentReference[oaicite:10]{index=10}
    usuResponsable?: number | null;
    movil?: string | null;
    tipoControl?: string | null;
    idAdmVehiculoFk?: number | null;

    // vista kxv_inv_bodega (si viene por listar) :contentReference[oaicite:11]{index=11}
    txtTipoBodega?: string | null;
    usuarioResponsable?: string | null;

    // estado lógico
    eliminado?: string | null; // timestamp ISO (si viene)
};

export type BodegaOption = {
    label: string;
    value: number;
};

export type BodegaCrearRequest = {
    centro: number;           // requerido :contentReference[oaicite:12]{index=12}
    nombre: string;           // requerido :contentReference[oaicite:13]{index=13}
    tipoBodega: 'f' | 'm' | 'r'; // requerido, validado :contentReference[oaicite:14]{index=14}
    usuResponsable?: number | null;
    movil?: string | null;
    tipoControl?: string | null;
    idAdmVehiculoFk?: number | null;
};

export type BodegaEditarRequest = {
    idInvBodega: number;
    cambios: Record<string, any>; // PATCH :contentReference[oaicite:15]{index=15}
};
