from pathlib import Path
import re
import sys

ROOT = Path.cwd()

def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        raise FileNotFoundError(f"No existe: {p}")
    return p.read_text(encoding='utf-8')

def write(path: str, content: str) -> None:
    p = ROOT / path
    p.write_text(content, encoding='utf-8')
    print(f"[OK] actualizado {path}")

def insert_before(content: str, needle: str, block: str) -> str:
    if block.strip() in content:
        return content
    if needle not in content:
        raise RuntimeError(f"No encontre marcador: {needle[:80]}")
    return content.replace(needle, block.rstrip() + "\n\n" + needle, 1)

def replace_once(content: str, old: str, new: str) -> str:
    if new.strip() in content:
        return content
    if old not in content:
        raise RuntimeError(f"No encontre bloque: {old[:120]}")
    return content.replace(old, new, 1)

def patch_models():
    path = 'src/app/features/vehiculos/data-access/vehiculos.models.ts'
    content = read(path)
    block = r'''
export interface VehOrdenTrabajoBitacoraItem {
  idVehOrdenTrabajoBitacora?: number | null;
  idVehOrdenTrabajoFk: number;
  fechaHora?: string | null;
  fecGen?: string | null;
  usuario?: number | null;
  usuarioLogin?: string | null;
  usuarioNombre?: string | null;
  tipoEvento?: string | null;
  categoria?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  entidadOrigen?: string | null;
  idEntidadOrigen?: string | null;
  tabla?: string | null;
  idRegistro?: string | null;
  operacion?: string | null;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  visibleCliente?: BooleanLike;
  notificableCliente?: BooleanLike;
  notificacionEnviada?: BooleanLike;
  metadata?: JsonMap | null;
}

export interface VehOrdenTrabajoBitacoraGuardarRequest {
  tipoEvento: string;
  categoria?: string | null;
  titulo: string;
  descripcion?: string | null;
  entidadOrigen?: string | null;
  idEntidadOrigen?: string | number | null;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  visibleCliente?: BooleanLike;
  notificableCliente?: BooleanLike;
  metadata?: JsonMap | null;
}
'''
    marker = '/* ======== REQUESTS ======== */'
    if marker in content:
        content = insert_before(content, marker, block)
    else:
        content = insert_before(content, 'export interface VehArticuloCatalogo', block)
    write(path, content)

def patch_api():
    path = 'src/app/features/vehiculos/data-access/vehiculos.api.ts'
    content = read(path)

    if 'VehOrdenTrabajoBitacoraItem' not in content:
        content = content.replace(
            'VehOrdenTrabajoGuardarRequest,',
            'VehOrdenTrabajoGuardarRequest,\n  VehOrdenTrabajoBitacoraItem,\n  VehOrdenTrabajoBitacoraGuardarRequest,',
            1,
        )

    block = r'''
  listarOrdenBitacora(idOrden: number, query: ListQuery = {}) {
    return this.http.get<ApiEnvelope<Paged<VehOrdenTrabajoBitacoraItem> | { items: VehOrdenTrabajoBitacoraItem[]; total?: number }>>(
      `${this.baseUrl}/ordenes-trabajo/${idOrden}/bitacora`,
      { params: buildListParams(query) }
    );
  }
  crearOrdenBitacora(idOrden: number, payload: VehOrdenTrabajoBitacoraGuardarRequest) {
    return this.http.post<ApiEnvelope<VehOrdenTrabajoBitacoraItem | { idVehOrdenTrabajoBitacora: number }>>(
      `${this.baseUrl}/ordenes-trabajo/${idOrden}/bitacora`,
      payload
    );
  }
'''
    content = insert_before(content, '  listarOrdenChecklists(query: ListQuery = {}) {', block)
    write(path, content)

def patch_repository():
    path = 'src/app/features/vehiculos/data-access/vehiculos.repository.ts'
    content = read(path)

    if 'VehOrdenTrabajoBitacoraGuardarRequest' not in content:
        content = content.replace(
            'VehOrdenTrabajoGuardarRequest,',
            'VehOrdenTrabajoGuardarRequest,\n  VehOrdenTrabajoBitacoraGuardarRequest,',
            1,
        )

    block = r'''
  listarOrdenBitacora(idOrden: number, q = '', page = 0, size = 200, all = true, extra: Record<string, unknown> = {}) {
    return this.api.listarOrdenBitacora(idOrden, {
      q,
      page,
      size,
      all,
      extra: extra as Record<string, string | number | boolean | null | undefined>,
    }).pipe(map((r) => unwrapOrThrow(r)));
  }
  crearOrdenBitacora(idOrden: number, payload: VehOrdenTrabajoBitacoraGuardarRequest) {
    return this.api.crearOrdenBitacora(idOrden, payload).pipe(map((r) => unwrapWithMsg(r)));
  }
'''
    content = insert_before(content, '  listarOrdenChecklists(extra: Record<string, unknown> = {}) {', block)
    write(path, content)

def patch_detail_ts():
    path = 'src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.ts'
    content = read(path)

    if "../orden-bitacora-panel/orden-bitacora-panel.component" not in content:
        content = content.replace(
            "import { OrdenGarantiasPanelComponent } from '../orden-garantias-panel/orden-garantias-panel.component';",
            "import { OrdenGarantiasPanelComponent } from '../orden-garantias-panel/orden-garantias-panel.component';\nimport { OrdenBitacoraPanelComponent } from '../orden-bitacora-panel/orden-bitacora-panel.component';",
            1,
        )

    if "| 'bitacora'" not in content:
        content = content.replace(
            "  | 'garantias'\n  | 'comercial';",
            "  | 'garantias'\n  | 'bitacora'\n  | 'comercial';",
            1,
        )

    if 'OrdenBitacoraPanelComponent' not in re.search(r'imports:\s*\[[\s\S]*?\]', content).group(0):
        content = content.replace(
            '    OrdenGarantiasPanelComponent,',
            '    OrdenGarantiasPanelComponent,\n    OrdenBitacoraPanelComponent,',
            1,
        )

    write(path, content)

def patch_detail_html():
    path = 'src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.html'
    content = read(path)

    if "activeTab()==='bitacora'" not in content:
        content = content.replace(
            '<button class="tabButton" [class.active]="activeTab()===\'garantias\'"\n          (click)="setTab(\'garantias\')">Garantías</button>',
            '<button class="tabButton" [class.active]="activeTab()===\'garantias\'"\n          (click)="setTab(\'garantias\')">Garantías</button>\n        <button class="tabButton" [class.active]="activeTab()===\'bitacora\'"\n          (click)="setTab(\'bitacora\')">Bitácora</button>',
            1,
        )

    if '<app-orden-bitacora-panel' not in content:
        block = r'''
  <section class="panelCard panelCard--bitacora" *ngIf="activeTab()==='bitacora'">
    <app-orden-bitacora-panel [orden]="orden"></app-orden-bitacora-panel>
  </section>
'''
        content = content.replace('</ng-container>', block.rstrip() + '\n</ng-container>', 1)

    write(path, content)

def main():
    patch_models()
    patch_api()
    patch_repository()
    patch_detail_ts()
    patch_detail_html()
    print('\n[OK] Bitacora aplicada. Copia tambien la carpeta del componente orden-bitacora-panel si aun no la copiaste.')

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
