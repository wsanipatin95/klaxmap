export type TaxTipo = 'l' | 'g' | 'n' | 'r';

export type TaxDocumentoDto = {
    idTaxDocumento: number;
    cen: number;
    idTaxCompAutUsoFk: TaxTipo;
    serie: string;           // "004-001"
    inicio: number;          // default 1
    autorizacion: string;    // default "9999999999"
    fecCaducidad: string;    // backend manda Date -> usualmente "YYYY-MM-DD"
};

export type TaxDocumentoCrearRequest = {
    cen: number;                 // requerido
    idTaxCompAutUsoFk: TaxTipo;  // requerido: l,g,n,r
    serie: string;               // requerido: "004-001"
    inicio?: number | null;      // default 1
    autorizacion?: string | null;// default "9999999999"
    fecCaducidad?: string | null;// default 2100-12-31
};

export type TaxDocumentoEditarRequest = {
    idTaxDocumento: number;
    cambios: Record<string, any>;
};

export const TAX_TIPOS: { value: TaxTipo; label: string }[] = [
    { value: 'l', label: 'Liquidación' },
    { value: 'g', label: 'Guías de remisión' },
    { value: 'n', label: 'Notas de crédito' },
    { value: 'r', label: 'Retención compra' },
];

export function tipoLabel(tipo: TaxTipo | string | null | undefined) {
    const t = (tipo ?? '').toString().toLowerCase();
    return TAX_TIPOS.find(x => x.value === t)?.label ?? t;
}
