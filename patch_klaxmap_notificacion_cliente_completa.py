from pathlib import Path
import sys
ROOT=Path.cwd()
API=ROOT/'src/app/features/vehiculos/data-access/vehiculos.api.ts'
REPO=ROOT/'src/app/features/vehiculos/data-access/vehiculos.repository.ts'
TS=ROOT/'src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.ts'
HTML=ROOT/'src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.html'
def die(m): print('[ERROR]',m,file=sys.stderr); sys.exit(1)
def bak(p):
    b=p.with_suffix(p.suffix+'.bak-notif-cliente')
    if not b.exists(): b.write_text(p.read_text(encoding='utf-8'),encoding='utf-8')
def patch_api():
    if not API.exists(): die(f'No existe {API}')
    bak(API); s=API.read_text(encoding='utf-8'); o=s
    if 'AdmCentro' not in s.split("} from './vehiculos.models';",1)[0]:
        s=s.replace("  VehGarantiaMovimientoEditarRequest\n} from './vehiculos.models';","  VehGarantiaMovimientoEditarRequest,\n  AdmCentro,\n  AdmNotificacionConfig,\n  VehClienteNotificacion,\n  VehClienteNotificacionEnviarRequest\n} from './vehiculos.models';")
    if 'private admBaseUrl' not in s:
        s=s.replace("  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/veh`;","  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/veh`;\n  private admBaseUrl = `${this.env.apiBaseUrl}/api/erp/klax/adm`;")
    if 'listarCentrosAdm(' not in s:
        s=s.replace('  /* ===== Tipos ===== */',"  /* ===== ADM / Centros / Configuración notificaciones ===== */\n  listarCentrosAdm(query: ListQuery = {}) {\n    return this.http.get<ApiEnvelope<Paged<AdmCentro>>>(`${this.admBaseUrl}/centros`, { params: buildListParams(query) });\n  }\n  obtenerAdmNotificacionConfig() {\n    return this.http.get<ApiEnvelope<AdmNotificacionConfig>>(`${this.admBaseUrl}/notificaciones/config`);\n  }\n\n  /* ===== Tipos ===== */",1)
    if 'enviarOrdenNotificacion(' not in s:
        s=s.replace('  listarOrdenChecklists(query: ListQuery = {}) {',"  listarOrdenNotificaciones(idOrden: number, query: ListQuery = {}) {\n    return this.http.get<ApiEnvelope<Paged<VehClienteNotificacion>>>(`${this.baseUrl}/ordenes-trabajo/${idOrden}/notificaciones`, { params: buildListParams(query) });\n  }\n  enviarOrdenNotificacion(idOrden: number, payload: VehClienteNotificacionEnviarRequest) {\n    return this.http.post<ApiEnvelope<VehClienteNotificacion>>(`${this.baseUrl}/ordenes-trabajo/${idOrden}/notificaciones/enviar`, payload);\n  }\n\n  listarOrdenChecklists(query: ListQuery = {}) {",1)
    if s!=o: API.write_text(s,encoding='utf-8'); print('[OK] vehiculos.api.ts')
def patch_repo():
    if not REPO.exists(): die(f'No existe {REPO}')
    bak(REPO); s=REPO.read_text(encoding='utf-8'); o=s
    if 'VehClienteNotificacionEnviarRequest' not in s.split("} from './vehiculos.models';",1)[0]:
        s=s.replace("  VehGarantiaMovimientoGuardarRequest\n} from './vehiculos.models';","  VehGarantiaMovimientoGuardarRequest,\n  VehClienteNotificacionEnviarRequest\n} from './vehiculos.models';")
    if 'listarCentrosAdm(' not in s:
        s=s.replace("  listarTipos(q = '', page = 0, size = 20, all = false) {","  listarCentrosAdm(q = '', page = 0, size = 100, all = true) {\n    return this.api.listarCentrosAdm({ q, page, size, all }).pipe(map((r) => unwrapOrThrow(r)));\n  }\n  obtenerAdmNotificacionConfig() {\n    return this.api.obtenerAdmNotificacionConfig().pipe(map((r) => unwrapOrThrow(r)));\n  }\n\n  listarTipos(q = '', page = 0, size = 20, all = false) {",1)
    if 'enviarOrdenNotificacion(' not in s:
        s=s.replace("  listarOrdenChecklists(extra: Record<string, unknown> = {}) {","  listarOrdenNotificaciones(idOrden: number, page = 0, size = 50) {\n    return this.api.listarOrdenNotificaciones(idOrden, { page, size }).pipe(map((r) => unwrapOrThrow(r)));\n  }\n  enviarOrdenNotificacion(idOrden: number, payload: VehClienteNotificacionEnviarRequest) {\n    return this.api.enviarOrdenNotificacion(idOrden, payload).pipe(map((r) => unwrapWithMsg(r)));\n  }\n\n  listarOrdenChecklists(extra: Record<string, unknown> = {}) {",1)
    if s!=o: REPO.write_text(s,encoding='utf-8'); print('[OK] vehiculos.repository.ts')
def patch_detail():
    for p in (TS,HTML):
        if not p.exists(): die(f'No existe {p}')
        bak(p)
    s=TS.read_text(encoding='utf-8'); o=s
    if 'OrdenNotificacionPanelComponent' not in s:
        s=s.replace("import { OrdenBitacoraPanelComponent } from '../orden-bitacora-panel/orden-bitacora-panel.component';","import { OrdenBitacoraPanelComponent } from '../orden-bitacora-panel/orden-bitacora-panel.component';\nimport { OrdenNotificacionPanelComponent } from '../orden-notificacion-panel/orden-notificacion-panel.component';")
    if 'OrdenNotificacionPanelComponent,' not in s:
        s=s.replace('    OrdenBitacoraPanelComponent,\n  ],','    OrdenBitacoraPanelComponent,\n    OrdenNotificacionPanelComponent,\n  ],')
    if s!=o: TS.write_text(s,encoding='utf-8'); print('[OK] orden-detail-panel.component.ts')
    h=HTML.read_text(encoding='utf-8'); oh=h
    if '<app-orden-notificacion-panel' not in h:
        marker='      <article class="contextPill">\n        <span>Técnico</span>\n        <strong>{{ responsableTecnicoNombre }}</strong>\n      </article>\n'
        if marker not in h: die('No encontré bloque Técnico')
        h=h.replace(marker, marker+'      <app-orden-notificacion-panel\n        [orden]="orden"\n        [clienteNombre]="clienteNombre">\n      </app-orden-notificacion-panel>\n',1)
    if h!=oh: HTML.write_text(h,encoding='utf-8'); print('[OK] orden-detail-panel.component.html')
patch_api(); patch_repo(); patch_detail(); print('[OK] klaxmap listo: npm run build')
