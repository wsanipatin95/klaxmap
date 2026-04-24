from pathlib import Path
import sys

ROOT = Path.cwd()
TARGET = ROOT / "src/app/features/vehiculos/pages/ordenes/components/orden-detail-panel/orden-detail-panel.component.html"

BAD_BITACORA_BLOCK = '''
  <section class="panelCard panelCard--bitacora" *ngIf="activeTab()==='bitacora'">
    <app-orden-bitacora-panel [orden]="orden"></app-orden-bitacora-panel>
  </section>
'''

OLD_TAIL = '''
    <section class="panelCard" *ngIf="activeTab()==='comercial'">
      <app-orden-comercial-panel [orden]="orden" [clienteNombre]="clienteNombre" [vehiculoNombre]="vehiculoNombre"
        [repuestos]="repuestos" [facturasOt]="facturasOt" [selectedFacturaOt]="selectedFacturaOt"
        [facturaDetalle]="facturaDetalle" [cobrosFactura]="cobrosFactura" [articulosCatalogo]="articulosCatalogo"
        (selectFactura)="selectFactura.emit($event)" (createFactura)="createFactura.emit($event)"
        (openCobro)="openCobro.emit()" (openContabilizar)="openContabilizar.emit()" [readonlyMode]="readonlyMode">
      </app-orden-comercial-panel>
    </section>
  </section>

  <section class="panelCard" *ngIf="activeTab()==='garantias'">
    <app-orden-garantias-panel [orden]="orden" [garantias]="garantias" [selectedGarantia]="selectedGarantia"
      [garantiaDetalles]="garantiaDetalles" [garantiaMovimientos]="garantiaMovimientos"
      [trabajoLabelMap]="trabajoLabelMap" [articuloLabelMap]="articuloLabelMap" [readonlyMode]="readonlyMode"
      [trabajosOt]="trabajos" [repuestosOt]="repuestos" (selectGarantia)="selectGarantia.emit($event)">
    </app-orden-garantias-panel>
  </section>
</ng-container>
'''

NEW_TAIL = '''
    <section class="panelCard" *ngIf="activeTab()==='comercial'">
      <app-orden-comercial-panel [orden]="orden" [clienteNombre]="clienteNombre" [vehiculoNombre]="vehiculoNombre"
        [repuestos]="repuestos" [facturasOt]="facturasOt" [selectedFacturaOt]="selectedFacturaOt"
        [facturaDetalle]="facturaDetalle" [cobrosFactura]="cobrosFactura" [articulosCatalogo]="articulosCatalogo"
        (selectFactura)="selectFactura.emit($event)" (createFactura)="createFactura.emit($event)"
        (openCobro)="openCobro.emit()" (openContabilizar)="openContabilizar.emit()" [readonlyMode]="readonlyMode">
      </app-orden-comercial-panel>
    </section>

    <section class="panelCard" *ngIf="activeTab()==='garantias'">
      <app-orden-garantias-panel [orden]="orden" [garantias]="garantias" [selectedGarantia]="selectedGarantia"
        [garantiaDetalles]="garantiaDetalles" [garantiaMovimientos]="garantiaMovimientos"
        [trabajoLabelMap]="trabajoLabelMap" [articuloLabelMap]="articuloLabelMap" [readonlyMode]="readonlyMode"
        [trabajosOt]="trabajos" [repuestosOt]="repuestos" (selectGarantia)="selectGarantia.emit($event)">
      </app-orden-garantias-panel>
    </section>

    <section class="panelCard panelCard--bitacora" *ngIf="activeTab()==='bitacora'">
      <app-orden-bitacora-panel [orden]="orden"></app-orden-bitacora-panel>
    </section>
  </section>
</ng-container>
'''

def fail(message: str) -> None:
    print(f"[ERROR] {message}", file=sys.stderr)
    sys.exit(1)

def main() -> None:
    if not TARGET.exists():
        fail(f"No existe el archivo esperado: {TARGET}")

    original = TARGET.read_text(encoding="utf-8")
    content = original

    # 1) Quita el panel de Bitácora que quedó metido dentro del bloque de Ejecución.
    #    Importante: NO eliminamos el </ng-container> que cierra el bloque de detalle;
    #    solo retiramos el <section panelCard--bitacora> mal ubicado.
    if BAD_BITACORA_BLOCK in content:
        content = content.replace(BAD_BITACORA_BLOCK, "\n", 1)
        print("[OK] removido panel Bitácora mal ubicado dentro de Ejecución")
    else:
        print("[INFO] no se encontró el bloque Bitácora mal ubicado; continúo con la corrección del cierre")

    # 2) Mueve Garantías y Bitácora dentro del mismo detailWorkspace, al mismo nivel
    #    que Resumen, Checklist, Ejecución, Repuestos y Comercial.
    if OLD_TAIL in content:
        content = content.replace(OLD_TAIL, NEW_TAIL, 1)
        print("[OK] corregido cierre de detailWorkspace y agregado panel Bitácora al nivel correcto")
    elif NEW_TAIL in content:
        print("[INFO] el cierre final ya estaba corregido")
    else:
        fail(
            "No pude encontrar el bloque final esperado para reemplazar. "
            "Revisa si el HTML cambió manualmente. No se escribió nada."
        )

    # 3) Validaciones simples para evitar dejar el template roto.
    bitacora_count = content.count('activeTab()===\'bitacora\'')
    component_count = content.count("<app-orden-bitacora-panel")
    if bitacora_count < 2:
        fail(f"Validación fallida: se esperaban al menos 2 referencias a bitacora y hay {bitacora_count}.")
    if component_count != 1:
        fail(f"Validación fallida: se esperaba 1 app-orden-bitacora-panel y hay {component_count}.")

    if content == original:
        print("[INFO] no hubo cambios; el archivo parece estar ya corregido")
        return

    backup = TARGET.with_suffix(TARGET.suffix + ".bak-bitacora")
    backup.write_text(original, encoding="utf-8")
    TARGET.write_text(content, encoding="utf-8")

    print(f"[OK] respaldo creado: {backup}")
    print(f"[OK] archivo corregido: {TARGET}")
    print("[OK] ahora corre: npm run build")

if __name__ == "__main__":
    main()
