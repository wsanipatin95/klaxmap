from pathlib import Path
import sys
ROOT = Path.cwd()
MODELS = ROOT / "src/app/features/vehiculos/data-access/vehiculos.models.ts"
API = ROOT / "src/app/features/vehiculos/data-access/vehiculos.api.ts"
REPO = ROOT / "src/app/features/vehiculos/data-access/vehiculos.repository.ts"

def fail(m): print("[ERROR]", m, file=sys.stderr); sys.exit(1)

if not MODELS.exists(): fail(f"No existe {MODELS}")
text = MODELS.read_text(encoding="utf-8")
text = text.replace("  idCliVehiculoFk: number;\n  tipoServicio?: string | null;", "  idCliVehiculoFk: number;\n  idAdmCentroFk?: number | null;\n  tipoServicio?: string | null;")
if "export interface AdmCentro" not in text:
    text = text.replace("\n/* ======== REQUESTS ======== */", """
export interface AdmCentro {
  idAdmCentro: number;
  centroCosto?: string | null;
  direccion?: string | null;
  establecimiento?: number | null;
  movilWa?: string | null;
  waResponsable?: string | null;
  serverMasivo?: string | null;
  identificadorMasivo?: string | null;
  wppConfigurado?: BooleanLike;
}

export interface AdmNotificacionConfig {
  tokenMeta?: string | null;
  admCentroDefault?: number | null;
  metaApiVersion?: string | null;
  metaPhoneNumberId?: string | null;
  metaTokenConfigurado?: BooleanLike;
  metaPlantilla?: string | null;
  metaPlantillaIdioma?: string | null;
  correoConfigurado?: BooleanLike;
}

export interface VehClienteNotificacionEnviarRequest {
  canal: 'WHATSAPP' | 'EMAIL' | string;
  tipoEvento?: string | null;
  idAdmCentroFk?: number | null;
  destinatarioNombre?: string | null;
  destinatarioTelefono?: string | null;
  destinatarioEmail?: string | null;
  titulo?: string | null;
  asunto?: string | null;
  mensaje?: string | null;
  html?: string | null;
  visibleCliente?: BooleanLike;
  requiereRespuesta?: BooleanLike;
  usarPlantilla?: BooleanLike;
  templateCode?: string | null;
  templateLanguage?: string | null;
  adjuntoBase64?: string | null;
  adjuntoNombre?: string | null;
  adjuntoCaption?: string | null;
  payload?: JsonMap | null;
}

export interface VehClienteNotificacion {
  idVehClienteNotificacion?: number | null;
  idVehOrdenTrabajoFk?: number | null;
  idAdmCentroOrigenFk?: number | null;
  idAdmCentroEnvioFk?: number | null;
  canal?: string | null;
  provider?: string | null;
  tipoEvento?: string | null;
  estadoEnvio?: string | null;
  destinatarioNombre?: string | null;
  destinatarioTelefono?: string | null;
  destinatarioEmail?: string | null;
  titulo?: string | null;
  asunto?: string | null;
  mensaje?: string | null;
  errorEnvio?: string | null;
  fecGen?: string | null;
  fecEnvio?: string | null;
  responseJson?: JsonMap | null;
}

\n/* ======== REQUESTS ======== */""")
MODELS.write_text(text, encoding="utf-8")
print("[OK] models actualizado")

if API.exists():
    text = API.read_text(encoding="utf-8")
    if "private admBaseUrl" not in text:
        text = text.replace("private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/veh`;", "private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/veh`;\n  private admBaseUrl = `${this.env.apiBaseUrl}/api/erp/klax/adm`;")
    print("[INFO] Agrega imports AdmCentro, AdmNotificacionConfig, VehClienteNotificacion, VehClienteNotificacionEnviarRequest si TypeScript lo solicita.")
    print("[INFO] Agrega manualmente métodos API si todavía no están: listarCentrosAdm, obtenerAdmNotificacionConfig, listarOrdenNotificaciones, enviarOrdenNotificacion.")
    API.write_text(text, encoding="utf-8")

print("[OK] patch frontend parcial aplicado.")
