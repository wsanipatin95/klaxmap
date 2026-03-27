export type ReglaArancelaria = {
  idImpReglaArancelaria?: number;
  idImpCodigoArancelarioFk: number;
  idCiuPaisDestinoFk?: number | null;
  idCiuPaisOrigenFk?: number | null;
  idCiuPaisProcedenciaFk?: number | null;
  regimenAduanero?: string | null;
  acuerdoComercial?: string | null;
  requiereCertificadoOrigen?: boolean | null;
  adValoremPct?: number | null;
  ivaPct?: number | null;
  fodinfaPct?: number | null;
  icePct?: number | null;
  arancelEspecificoValor?: number | null;
  arancelEspecificoUnidad?: string | null;
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  prioridad?: number | null;
  estadoRegla?: string | null;
  baseLegal?: string | null;
  observacion?: string | null;
};

export type RequisitoArancelario = {
  idImpRequisitoArancelario?: number;
  idImpReglaArancelariaFk: number;
  tipoRequisito?: string | null;
  entidadControl?: string | null;
  nombreRequisito: string;
  descripcion?: string | null;
  obligatorio?: boolean | null;
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
  validezDias?: number | null;
  aplicaPor?: string | null;
  estadoRequisito?: string | null;
  observacion?: string | null;
};

export type ReglaArancelariaEditarRequest = { idImpReglaArancelaria: number; cambios: Partial<ReglaArancelaria> };
export type RequisitoArancelarioEditarRequest = { idImpRequisitoArancelario: number; cambios: Partial<RequisitoArancelario> };
