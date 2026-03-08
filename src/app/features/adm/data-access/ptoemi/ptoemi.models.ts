export type PtoEmiView = {
  idAdmPtoEmi: number;
  cen: number;

  ptoemi: string;           // nombre: "CAJA UNO"
  ptoemiNum: number;        // 1..999
  puntoEmision?: string;    // "001-008" (si la vista lo trae)
  ptoemiUsuario?: string;   // usuario (texto)
  ipPublica?: string;

  cajaVirtual?: boolean;
  cajaPrepago?: boolean;

  idCntPlanFk?: number | null;
};

export type PtoEmiCrearRequest = {
  cen: number;
  ptoemi: string;
  ptoemiNum: number;
  idCntPlanFk?: number | null;
  ptoemiUsu?: number | null;
  cajaVirtual?: boolean | null;
  cajaPrepago?: boolean | null;
};

export type PtoEmiEditarRequest = {
  idAdmPtoEmi: number;
  cambios: Record<string, any>;
};
