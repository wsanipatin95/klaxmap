export type ArchivoModo = 'UNICO' | 'MULTIPLE';

export type ArchivoListItemDto = {
    idArchivo: number;
    nombreRegistro?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    fecRegistro?: string | null;
    storageTipo?: string | null;
};

export type ArchivoListData = {
    items: ArchivoListItemDto[];
};

export type ArchivoUploadUnicoData = {
    idArchivo: number;
    storageTipo?: string | null;
};

export type ArchivoUploadMultipleData = {
    ids: number[];
};
