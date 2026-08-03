import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Shell del módulo Monitoreo. Envuelve todas las páginas en `.mon-scope` y trae
 * los estilos globales que el front de NOC usaba (variables + clases .panel/.btn/
 * .inp/.tools/.badge/…), pero acotados a este subárbol para NO afectar al resto
 * de klaxmap. Se usa ViewEncapsulation.None + prefijo `.mon-scope` en cada regla.
 */
@Component({
  selector: 'app-monitoreo-shell',
  standalone: true,
  imports: [RouterOutlet],
  encapsulation: ViewEncapsulation.None,
  template: `<div class="mon-scope"><router-outlet></router-outlet></div>`,
  styles: [`
    .mon-scope {
      /* Identidad KLAX / Inno Fiber — heredada de los tokens core-ui (_tokens.scss)
         con fallback por si el módulo se monta aislado. */
      --morado-w:var(--kx-primary,#7b0061); --morado-w-hover:var(--kx-primary-hover,#4b023b); --morado-w-claro:#742462c0;
      --morado-w-table-hover:#ff7ee3a4; --morado-shadow:#7c00613f;
      --page-header-bgColor:#445356; --page-header-bgColor-hover:var(--kx-accent,#a50081);
      --tab-bar-color:var(--kx-accent,#a50081); --violeta:var(--kx-violeta,#9942f5); --flotante-color:#e91e63;
      --cliente:#22B14C; --contrato:#00A2E8; --atcliente:#76eaf5;
      --success:#00ac4a; --danger:#fc424a; --warning:#ffc107; --info:#783ee3; --blue:var(--kx-blue,#00b9eb);
      --bg:var(--kx-bg,#f0f1f6); --panel:var(--kx-panel,#ffffff); --border:var(--kx-border,#e3e6ee); --text:var(--kx-text,#092931); --muted:var(--kx-muted,#6b7280);
      --primary:var(--morado-w); --primary-soft:var(--kx-primary-soft,#f8e9f3);
      --green:var(--kx-green,#00ac4a); --red:var(--kx-red,#ec1848); --amber:var(--kx-amber,#d99000);
      --orange:var(--kx-orange,#ea580c); --orange-soft:var(--kx-orange-soft,#fff1e9);
      --shadow:0 0 10px -2px rgba(0,0,0,.075);
      display:block; padding:12px 20px 22px;
      font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
      color:var(--text); font-size:14px;
    }
    .mon-scope * { box-sizing:border-box; }
    .mon-scope a { color:inherit; text-decoration:none; }

    /* panels */
    .mon-scope .panel { background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);margin-bottom:14px }
    .mon-scope .ph { font-size:14px;font-weight:600;padding:9px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px }
    .mon-scope .ph .mini { font-size:11.5px;color:var(--muted);font-weight:500 }
    .mon-scope .pb { padding:12px 14px }
    .mon-scope .big { height:280px }
    .mon-scope .chart-sm { height:150px }

    /* kpi / meta */
    .mon-scope .kpis { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:10px }
    .mon-scope .kpi { background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:11px 14px;box-shadow:var(--shadow) }
    .mon-scope .kpi .k { font-size:12px;color:var(--muted);margin-bottom:4px }
    .mon-scope .kpi .v { font-size:24px;font-weight:700 }
    .mon-scope .meta { display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:12px }
    .mon-scope .meta .m { background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:9px 12px;box-shadow:var(--shadow) }
    .mon-scope .meta .m .k { font-size:11px;color:var(--muted);margin-bottom:3px }
    .mon-scope .meta .m .v { font-weight:600;font-size:14px }
    .mon-scope .gauge { font-size:30px;font-weight:700;text-align:center }
    .mon-scope .row3 { display:grid;grid-template-columns:repeat(3,1fr);gap:14px }
    .mon-scope .row4 { display:grid;grid-template-columns:repeat(4,1fr);gap:14px }
    .mon-scope .grid2 { display:grid;grid-template-columns:1fr;gap:14px }

    /* tablas */
    .mon-scope table { width:100%;border-collapse:collapse }
    .mon-scope th { text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:5px 14px;border-bottom:1px solid var(--border);font-weight:600;background:#fafbfc }
    .mon-scope th.srt { cursor:pointer;user-select:none;white-space:nowrap }
    .mon-scope th.srt:hover { color:var(--primary) }
    .mon-scope td { padding:3px 14px;border-bottom:1px solid var(--border);font-size:13px;line-height:1.3 }
    .mon-scope tr:last-child td { border-bottom:none }
    .mon-scope tbody tr.clk { cursor:pointer }
    .mon-scope tbody tr.clk:hover { background:var(--primary-soft) }
    .mon-scope .mono { font-family:'Consolas',monospace;font-size:12.5px }

    /* controles */
    .mon-scope .tools { display:flex;gap:10px;margin-bottom:10px;align-items:center;flex-wrap:wrap }
    .mon-scope .inp { padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--panel) }
    .mon-scope .chip { padding:4px 10px;border:1px solid var(--border);border-radius:7px;background:var(--panel);cursor:pointer;font-size:11.5px;color:var(--muted) }
    .mon-scope .chip.on { background:var(--primary);color:#fff;border-color:var(--primary) }
    .mon-scope .btn { padding:5px 11px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-weight:600;cursor:pointer;font-size:11.5px;line-height:1.5 }
    .mon-scope .btn.ghost { background:var(--panel);color:var(--text);border:1px solid var(--border) }
    .mon-scope .btn.sm { padding:3px 8px;font-size:10.5px }
    .mon-scope .seg { display:flex;border:1px solid var(--border);border-radius:9px;overflow:hidden }
    .mon-scope .seg button { border:none;background:var(--panel);padding:7px 13px;cursor:pointer;font-size:12.5px;color:var(--muted);font-weight:600;border-left:1px solid var(--border) }
    .mon-scope .seg button:first-child { border-left:none }
    .mon-scope .seg button.on { background:var(--primary);color:#fff }
    .mon-scope .segT { display:inline-flex;border:1px solid var(--orange);border-radius:7px;overflow:hidden }
    .mon-scope .segT button { border:none;background:var(--panel);padding:3px 8px;cursor:pointer;font-size:10.5px;line-height:1.5;color:var(--orange);font-weight:600;border-left:1px solid var(--orange) }
    .mon-scope .segT button:first-child { border-left:none }
    .mon-scope .segT button.on { background:var(--orange);color:#fff }

    /* estados / badges */
    .mon-scope .dot { width:8px;height:8px;border-radius:50%;background:var(--green) }
    .mon-scope .dot.off { background:var(--red) }
    .mon-scope .badge { display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600 }
    .mon-scope .b-up { background:#e7f6ec;color:var(--green) }
    .mon-scope .b-down { background:#fdeaea;color:var(--red) }
    .mon-scope .b-warn { background:#fef3e2;color:var(--amber) }
    .mon-scope .b-crit { background:#fdeaea;color:var(--red) }
    .mon-scope .b-ack { background:var(--primary-soft);color:var(--primary) }
    .mon-scope .b-maint { background:#f3f4f6;color:var(--muted) }
    .mon-scope .ubar { height:7px;border-radius:4px;background:#eef1f6;overflow:hidden;width:90px;display:inline-block;vertical-align:middle;margin-right:8px }
    .mon-scope .ubar i { display:block;height:100%;border-radius:4px }

    /* misc */
    .mon-scope .back { color:var(--primary);cursor:pointer;font-size:13px;margin-bottom:14px;display:inline-flex;gap:6px;align-items:center }
    .mon-scope .empty { text-align:center;padding:60px 20px;color:var(--muted) }
    .mon-scope .empty .ic { font-size:40px;display:block;margin-bottom:10px }
    .mon-scope .live { display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted) }

    /* ===== Modales ===== */
    /* Suben por encima del navbar/sidebar de klaxmap. El z-index inline del NOC
       (60/70/90) se queda corto ante el navbar, por eso van con !important. */
    .mon-scope .overlay { position:fixed;inset:0;background:rgba(15,23,42,.45);opacity:0;visibility:hidden;transition:.2s;z-index:100000 !important }
    .mon-scope .overlay.on { opacity:1;visibility:visible }
    .mon-scope [style*="position:fixed"],
    .mon-scope [style*="position: fixed"] { z-index:100001 !important }
    /* El .panel del modal se ajusta a la pantalla */
    .mon-scope [style*="position:fixed"] > .panel,
    .mon-scope [style*="position: fixed"] > .panel {
      max-width: 94vw;
      max-height: 90vh;
      overflow: auto;
      margin: 0;
    }

    @media (max-width:1200px) {
      .mon-scope .kpis, .mon-scope .meta, .mon-scope .row3, .mon-scope .row4 { grid-template-columns:repeat(2,1fr) }
    }

    /* ===== Pantalla completa (body.noc-full): oculta el chrome de klaxmap ===== */
    body.noc-full .navbar,
    body.noc-full .layout-topbar,
    body.noc-full .layout-sidebar { display: none !important; }
    body.noc-full .layout-main-container,
    body.noc-full .main-content { margin: 0 !important; padding: 0 !important; height: 100vh !important; }
    body.noc-full .mon-scope { padding: 8px 12px !important; }
  `],
})
export class MonitoreoShellComponent {}
