export type CajaChicaDto = {
    idAdmCajaChica: number;
    cen: number;
    cajaChica: string;

    idNomNominaFk: number;
    idCntPlanFk: number;

    fecha?: string;
    usu?: number;

    centroCosto?: string;
    saldo?: number;
    nombre?: string; // nombre del responsable
};

export type CajaChicaCrearRequest = {
    cen: number;
    cajaChica: string;
    idNomNominaFk: number;
    idCntPlanFk: number;
    saldo?: number | null;
};

export type CajaChicaEditarRequest = {
    idAdmCajaChica: number;
    cambios: Record<string, any>;
};
