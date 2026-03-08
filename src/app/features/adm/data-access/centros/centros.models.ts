export type CentroDto = {
    idAdmCentro: number;
    centroCosto: string;
    idCiuParroquiaFk: number | null;

    direccion: string | null;
    establecimiento: number;
    zona: string | null;

    movilWa: string | null;
    waResponsable: string | null;
    ipPublica: string | null;

    serverMasivo: string | null;
    identificadorMasivo: string | null;
    tokenMasivo: string | null;

    idInvBodegaDespachoFk: number | null;
    idInvBodegaRecepcionFk: number | null;
};

export type CentroCrearRequest = {
    centroCosto: string;
    idCiuParroquiaFk: number | null;
    direccion: string | null;
    establecimiento: number;

    zona: string | null;

    movilWa: string | null;
    waResponsable: string | null;
    ipPublica: string | null;

    serverMasivo: string | null;
    identificadorMasivo: string | null;
    tokenMasivo: string | null;

    idInvBodegaDespachoFk: number | null;
    idInvBodegaRecepcionFk: number | null;
};

export type CentroEditarRequest = {
    idAdmCentro: number;
    cambios: Record<string, any>;
};

export type CentroCrearResponse = {
    idAdmCentro: number;
    cen: number;
    serieDocs: string;
};
