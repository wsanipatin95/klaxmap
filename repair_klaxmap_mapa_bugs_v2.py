#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
repair_klaxmap_mapa_bugs_v2.py

Reparacion robusta para bugs de src/app/features/mapa en klaxmap.

Uso:
  python repair_klaxmap_mapa_bugs_v2.py --check
  python repair_klaxmap_mapa_bugs_v2.py --apply
  python repair_klaxmap_mapa_bugs_v2.py --diff
  python repair_klaxmap_mapa_bugs_v2.py --root C:\\ruta\\klaxmap --apply

Nota:
- Si ya estas dentro del repo klaxmap, NO uses --root ./klaxmap.
- El modo por defecto es --check.
- Crea respaldos en .repair-backups/mapa-bugs-v2/<timestamp>/
"""

from __future__ import annotations

import argparse
import difflib
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


REPO_MARKERS = (
    "angular.json",
    "package.json",
    "src/app/features/mapa/mapa.routes.ts",
)

FILES = {
    "create_dialog_ts": Path("src/app/features/mapa/components/mapa-create-element-dialog/mapa-create-element-dialog.component.ts"),
    "home_html": Path("src/app/features/mapa/pages/mapa-home/mapa-home.component.html"),
    "home_ts": Path("src/app/features/mapa/pages/mapa-home/mapa-home.component.ts"),
    "canvas_ts": Path("src/app/features/mapa/components/mapa-canvas/mapa-canvas.component.ts"),
    "canvas_scss": Path("src/app/features/mapa/components/mapa-canvas/mapa-canvas.component.scss"),
}


@dataclass
class FilePatch:
    path: Path
    before: str
    after: str
    notes: list[str]

    @property
    def changed(self) -> bool:
        return self.before != self.after


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="")


def looks_like_klaxmap(root: Path) -> bool:
    return root.is_dir() and all((root / marker).exists() for marker in REPO_MARKERS)


def resolve_root(raw_root: str | None) -> Path:
    if raw_root:
        root = Path(raw_root).expanduser().resolve()
        if not looks_like_klaxmap(root):
            raise SystemExit(
                f"ERROR: {root} no parece ser klaxmap.\n"
                f"Usa --root apuntando directamente a la carpeta que contiene angular.json."
            )
        return root

    cwd = Path.cwd().resolve()
    if looks_like_klaxmap(cwd):
        return cwd

    child = cwd / "klaxmap"
    if looks_like_klaxmap(child):
        return child.resolve()

    raise SystemExit(
        "ERROR: no encontre klaxmap. Ejecuta dentro del repo, desde la carpeta padre, "
        "o usa --root apuntando directamente al repo."
    )


def find_matching_brace(text: str, open_brace_index: int) -> int:
    depth = 0
    in_string: str | None = None
    escape = False
    in_line_comment = False
    in_block_comment = False

    i = open_brace_index
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_string:
                in_string = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        if ch in ("'", '"', "`"):
            in_string = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i

        i += 1

    raise ValueError("No se encontro llave de cierre.")


def replace_method(text: str, method_signature_regex: str, new_method: str) -> tuple[str, bool]:
    match = re.search(method_signature_regex, text)
    if not match:
        return text, False

    open_brace = text.find("{", match.start())
    if open_brace < 0:
        return text, False

    close_brace = find_matching_brace(text, open_brace)
    old_block = text[match.start():close_brace + 1]
    normalized_new = new_method.rstrip()
    return text[:match.start()] + normalized_new + text[close_brace + 1:], old_block != normalized_new


def add_object_options(text: str, block_start_token: str, options: list[str]) -> tuple[str, bool]:
    start = text.find(block_start_token)
    if start < 0:
        return text, False

    window_end = min(len(text), start + 1100)
    window = text[start:window_end]

    missing: list[str] = []
    for opt in options:
        key = opt.split(":", 1)[0].strip()
        if not re.search(rf"\b{re.escape(key)}\s*:", window):
            missing.append(opt)

    if not missing:
        return text, False

    renderer_match = re.search(r"(?m)^(\s*)renderer\s*:", window)
    if renderer_match:
        insert_at = start + renderer_match.start()
        indent = renderer_match.group(1)
        insert = "".join(f"{indent}{opt},\n" for opt in missing)
        return text[:insert_at] + insert + text[insert_at:], True

    close_match = re.search(r"(?m)^(\s*)\}\s*\)\s*;", window)
    if close_match:
        insert_at = start + close_match.start()
        indent = close_match.group(1) + "  "
        insert = "".join(f"{indent}{opt},\n" for opt in missing)
        return text[:insert_at] + insert + text[insert_at:], True

    return text, False


def patch_create_dialog_ts(root: Path) -> FilePatch:
    rel = FILES["create_dialog_ts"]
    path = root / rel
    before = read_text(path)
    text = before
    notes: list[str] = []

    if "private reopenCurrentDraft()" in text:
        notes.append("create dialog: ya tiene reopenCurrentDraft().")
        return FilePatch(rel, before, text, notes)

    new_on_visible = """  onVisibleChange(nextVisible: boolean) {
    if (nextVisible) {
      this.visible.set(true);
      return;
    }

    this.requestClose();
  }"""

    new_request_close = """  requestClose() {
    if (this.saving()) {
      return;
    }

    if (!this.hasPendingChanges()) {
      this.discardAndClose();
      return;
    }

    /*
     * PrimeNG emite visibleChange(false) cuando se pulsa la X o la mascara.
     * Sincronizamos visible=false y, si el usuario elige "Seguir editando",
     * forzamos false -> true para que el p-dialog vuelva a abrir.
     */
    this.visible.set(false);

    this.confirmDialog?.open(
      {
        title: 'Descartar nuevo elemento',
        message:
          'Hay un elemento nuevo sin guardar.\\n\\nSi continúas, la geometría y los datos capturados se perderán.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        severity: 'warning',
      },
      () => {
        this.discardAndClose();
      },
      () => {
        this.reopenCurrentDraft();
      }
    );
  }

  private reopenCurrentDraft() {
    if (!this.currentWkt() || this.saving()) {
      return;
    }

    this.visible.set(false);

    queueMicrotask(() => {
      if (this.currentWkt() && !this.saving()) {
        this.visible.set(true);
      }
    });
  }"""

    text, ok1 = replace_method(text, r"\n\s*onVisibleChange\s*\(\s*nextVisible:\s*boolean\s*\)\s*", "\n" + new_on_visible)
    text, ok2 = replace_method(text, r"\n\s*requestClose\s*\(\s*\)\s*", "\n" + new_request_close)

    if not ok1 or not ok2:
        raise RuntimeError(f"No pude reparar onVisibleChange/requestClose en {rel}")

    notes.append("create dialog: reparado flujo X -> Seguir editando.")
    return FilePatch(rel, before, text, notes)


def patch_home_html(root: Path) -> FilePatch:
    rel = FILES["home_html"]
    path = root / rel
    before = read_text(path)
    text = before
    notes: list[str] = []

    if '(cancelled)="onCreateElementCancelled()"' in text:
        notes.append("home html: listener cancelled ya existe.")
        return FilePatch(rel, before, text, notes)

    text2 = text.replace(
        '(submitted)="crearElemento($event)"></app-mapa-create-element-dialog>',
        '(submitted)="crearElemento($event)" (cancelled)="onCreateElementCancelled()"></app-mapa-create-element-dialog>',
        1,
    )

    if text2 == text:
        text2 = re.sub(
            r'(<app-mapa-create-element-dialog\b[^>]*\(submitted\)="crearElemento\(\$event\)"[^>]*)>',
            r'\1 (cancelled)="onCreateElementCancelled()">',
            text,
            count=1,
            flags=re.S,
        )

    if text2 == text:
        raise RuntimeError(f"No pude agregar listener cancelled en {rel}")

    notes.append("home html: agregado listener cancelled al dialogo de creacion.")
    return FilePatch(rel, before, text2, notes)


def patch_home_ts(root: Path) -> FilePatch:
    rel = FILES["home_ts"]
    path = root / rel
    before = read_text(path)
    text = before
    notes: list[str] = []

    if "onCreateElementCancelled()" in text:
        notes.append("home ts: onCreateElementCancelled() ya existe.")
        return FilePatch(rel, before, text, notes)

    method = """  onCreateElementCancelled() {
    this.ui.setSelectMode();
    this.defer(() => {
      this.mapCanvas?.refreshMapLayout(true);
    });
  }

"""

    anchors = [
        "  onEditSessionStateChanged(state: MapaEditSessionState) {",
        "  onGeometryCreated(event:",
        "  crearElemento(payload:",
    ]

    for anchor in anchors:
        if anchor in text:
            text = text.replace(anchor, method + anchor, 1)
            notes.append("home ts: agregado onCreateElementCancelled().")
            return FilePatch(rel, before, text, notes)

    raise RuntimeError(f"No pude insertar onCreateElementCancelled en {rel}")


def patch_canvas_ts(root: Path) -> FilePatch:
    rel = FILES["canvas_ts"]
    path = root / rel
    before = read_text(path)
    text = before
    notes: list[str] = []

    if "[MAPA][DRAW] No se pudo desactivar" not in text:
        new_stop = """  private stopActiveDraw() {
    const handler = this.activeDrawHandler;
    this.activeDrawHandler = null;

    try {
      handler?.disable?.();
    } catch (err) {
      console.warn('[MAPA][DRAW] No se pudo desactivar el handler de dibujo:', err);
    }

    if (this.map) {
      this.map.dragging.enable();

      if (this.toolMode !== 'measure') {
        this.map.doubleClickZoom.enable();
      }

      if (!this.editSession.active) {
        this.map.getContainer().style.cursor = '';
      }
    }
  }"""
        text2, ok = replace_method(text, r"\n\s*private\s+stopActiveDraw\s*\(\s*\)\s*", "\n" + new_stop)
        if not ok:
            raise RuntimeError(f"No pude reemplazar stopActiveDraw() en {rel}")
        text = text2
        notes.append("canvas: reforzado stopActiveDraw().")
    else:
        notes.append("canvas: stopActiveDraw() ya estaba reforzado.")

    if "queueMicrotask(() => {\n          if (\n            this.toolMode !== 'draw-point'" not in text:
        target = "        this.geometryCreated.emit({ wkt, geomTipo });"
        replacement = """        this.geometryCreated.emit({ wkt, geomTipo });

        queueMicrotask(() => {
          if (
            this.toolMode !== 'draw-point' &&
            this.toolMode !== 'draw-line' &&
            this.toolMode !== 'draw-polygon'
          ) {
            this.stopActiveDraw();
          }
        });"""
        if target not in text:
            raise RuntimeError(f"No pude encontrar geometryCreated.emit() en {rel}")
        text = text.replace(target, replacement, 1)
        notes.append("canvas: agregada limpieza extra tras draw:created.")
    else:
        notes.append("canvas: limpieza extra tras draw:created ya existe.")

    text2, changed_rect = add_object_options(
        text,
        "const rectangle = L.rectangle",
        ["interactive: false", "bubblingMouseEvents: false"],
    )
    text = text2
    notes.append("canvas: rectangle no interactivo." if changed_rect else "canvas: rectangle ya estaba no interactivo o no se encontro.")

    text2, changed_halo = add_object_options(
        text,
        "const halo = L.circleMarker",
        ["interactive: false", "bubblingMouseEvents: false"],
    )
    text = text2
    notes.append("canvas: halo no interactivo." if changed_halo else "canvas: halo ya estaba no interactivo o no se encontro.")

    text2, changed_marker = add_object_options(
        text,
        "const marker = L.marker",
        ["interactive: false", "bubblingMouseEvents: false"],
    )
    text = text2
    notes.append("canvas: marker no interactivo." if changed_marker else "canvas: marker ya estaba no interactivo o no se encontro.")

    return FilePatch(rel, before, text, notes)


def patch_canvas_scss(root: Path) -> FilePatch:
    rel = FILES["canvas_scss"]
    path = root / rel
    before = read_text(path)
    text = before
    notes: list[str] = []

    css = """
/* Reparacion: las marcas auxiliares de busqueda/ubicacion no deben bloquear clicks sobre elementos. */
.leaflet-marker-icon.mapa-search-marker-host,
.mapa-search-marker-host,
.mapa-search-marker,
.mapa-search-marker-core {
  pointer-events: none;
}
"""

    if ".leaflet-marker-icon.mapa-search-marker-host" in text:
        notes.append("canvas scss: failsafe pointer-events ya existe.")
        return FilePatch(rel, before, text, notes)

    text = text.rstrip() + "\n\n" + css.lstrip()
    notes.append("canvas scss: agregado pointer-events none para marca de busqueda.")
    return FilePatch(rel, before, text, notes)


def diff_text(path: Path, before: str, after: str) -> str:
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"{path} antes",
            tofile=f"{path} despues",
        )
    )


def backup_file(root: Path, rel: Path, backup_root: Path) -> None:
    src = root / rel
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def main() -> int:
    parser = argparse.ArgumentParser(description="Repara bugs de mapa en klaxmap.")
    parser.add_argument("--root", help="Ruta directa al repo klaxmap.")
    parser.add_argument("--apply", action="store_true", help="Aplica cambios.")
    parser.add_argument("--check", action="store_true", help="Solo verifica. Es el modo por defecto.")
    parser.add_argument("--diff", action="store_true", help="Muestra diff propuesto.")
    args = parser.parse_args()

    root = resolve_root(args.root)

    patchers = [
        patch_create_dialog_ts,
        patch_home_html,
        patch_home_ts,
        patch_canvas_ts,
        patch_canvas_scss,
    ]

    patches: list[FilePatch] = []
    errors: list[str] = []

    for patcher in patchers:
        try:
            patches.append(patcher(root))
        except Exception as exc:
            errors.append(str(exc))

    print(f"Repo: {root}")
    print(f"Modo: {'APPLY' if args.apply else 'CHECK'}")
    print()

    for patch in patches:
        status = "CHANGE" if patch.changed else "OK"
        print(f"[{status}] {patch.path}")
        for note in patch.notes:
            print(f"  - {note}")

        if args.diff and patch.changed:
            print()
            print(diff_text(patch.path, patch.before, patch.after))
        print()

    if errors:
        print("ERRORES:")
        for err in errors:
            print(f"  - {err}")
        print("\nNo se aplicaron cambios porque hubo errores.")
        return 2

    changed = [p for p in patches if p.changed]

    if not changed:
        print("No hay cambios pendientes. La reparacion ya parece aplicada.")
        return 0

    if not args.apply:
        print(f"Se detectaron {len(changed)} archivo(s) para reparar.")
        print("Ejecuta:")
        print("  python repair_klaxmap_mapa_bugs_v2.py --apply")
        return 0

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / ".repair-backups" / "mapa-bugs-v2" / timestamp

    for patch in changed:
        backup_file(root, patch.path, backup_root)
        write_text(root / patch.path, patch.after)

    print(f"Reparacion aplicada en {len(changed)} archivo(s).")
    print(f"Respaldos: {backup_root}")
    print()
    print("Ahora ejecuta:")
    print("  npm run build")
    print()
    print("Pruebas:")
    print("  1) Crear punto/linea -> X -> Seguir editando -> debe volver el modal.")
    print("  2) Guardar una linea -> seleccionar esa linea y otras sin refrescar.")
    print("  3) Si hay marca azul de busqueda/ubicacion encima, no debe bloquear clicks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
