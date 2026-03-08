export type AdmConfModuloDto = {
    id_adm_conf_modulo: number;
    modulo: string;
    icono?: string | null;
};

export type AdmConfItemDto = {
    id_adm_conf?: number;
    id_adm_conf_modulo?: number;

    modulo?: string | null;      // a veces viene
    parametro: string;
    etiqueta?: string | null;
    placeholder?: string | null;
    tipo_input?: string | null;  // text, select, radio, checkbox, file...
    opciones?: string | null;    // JSON string o null

    valor?: string | null;       // string o "arch:123" para file
    ayuda?: string | null;
    accept?: string | null;
    max_size_mb?: string | null;
};

export type AdmConfSaveItem = { parametro: string; valor: string };

export type AdmConfSaveRequest = {
    modulo?: string; // solo para agrupar (backend hoy no lo usa)
    items: AdmConfSaveItem[];
};
