import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-bkp-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bkpPageHeader">
      <div class="bkpPageHeader__copy">
        <div class="bkpPageHeader__eyebrow" *ngIf="eyebrow">{{ eyebrow }}</div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>

      <div class="bkpPageHeader__actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .bkpPageHeader{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:.75rem;
      min-width:0;
      margin-bottom:.58rem;
    }

    .bkpPageHeader__copy{
      display:grid;
      gap:.12rem;
      min-width:0;
    }

    .bkpPageHeader__eyebrow{
      color:#7b0061;
      font-size:.62rem;
      font-weight:900;
      letter-spacing:.08em;
      text-transform:uppercase;
      line-height:1.05;
    }

    h1{
      margin:0;
      color:#0f172a;
      font-size:clamp(1.05rem,1.42vw,1.34rem);
      font-weight:800;
      line-height:1.08;
      letter-spacing:-.025em;
    }

    p{
      margin:0;
      color:#64748b;
      font-size:.75rem;
      line-height:1.28;
      max-width:54rem;
    }

    .bkpPageHeader__actions{
      display:flex;
      justify-content:flex-end;
      align-items:center;
      flex-wrap:wrap;
      gap:.38rem;
      min-width:max-content;
    }

    @media(max-width:760px){
      .bkpPageHeader{display:grid}
      .bkpPageHeader__actions{justify-content:flex-start;min-width:0}
    }
  `]
})
export class BkpPageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() eyebrow = '';
}

@Component({
  selector: 'app-bkp-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bkpEmptyState">
      <div>
        <i [class]="icon"></i>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
        <div class="bkpEmptyState__actions" *ngIf="hasActions">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bkpEmptyState{
      min-height:10rem;
      display:grid;
      place-items:center;
      text-align:center;
      border:1px dashed #cbd5e1;
      border-radius:.78rem;
      padding:1.25rem;
      background:#fff;
      color:#64748b;
    }

    i{
      display:inline-grid;
      place-items:center;
      width:2rem;
      height:2rem;
      border-radius:.72rem;
      background:#fff0fa;
      color:#7b0061;
      font-size:1rem;
      margin-bottom:.52rem;
    }

    h3{
      margin:0;
      font-size:.88rem;
      color:#0f172a;
      line-height:1.2;
    }

    p{
      margin:.22rem auto 0;
      font-size:.74rem;
      line-height:1.32;
      max-width:24rem;
    }

    .bkpEmptyState__actions{
      margin-top:.7rem;
      display:flex;
      justify-content:center;
      gap:.4rem;
      flex-wrap:wrap;
    }
  `]
})
export class BkpEmptyStateComponent {
  @Input() icon = 'pi pi-inbox';
  @Input() title = 'Sin resultados';
  @Input() subtitle = 'No hay datos para mostrar.';
  @Input() hasActions = true;
}

@Component({
  selector: 'app-bkp-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="bkpStatusBadge" [ngClass]="tone()">{{ label() }}</span>`,
  styles: [`
    .bkpStatusBadge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:1.28rem;
      padding:0 .42rem;
      border-radius:999px;
      border:1px solid transparent;
      font-size:.6rem;
      font-weight:900;
      line-height:1;
      white-space:nowrap;
    }

    .success{background:#ecfdf3;color:#027a48;border-color:#abefc6}
    .danger{background:#fff1f2;color:#b42318;border-color:#fecdd3}
    .warning{background:#fff7ed;color:#b45309;border-color:#fed7aa}
    .process{background:#eff6ff;color:#175cd3;border-color:#bfdbfe}
    .neutral{background:#f8fafc;color:#475569;border-color:#e2e8f0}
  `]
})
export class BkpStatusBadgeComponent {
  @Input() status: string | null | undefined = null;

  private norm() {
    return String(this.status || 'PENDING').trim().toUpperCase();
  }

  label() {
    return this.norm()
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, t => t.toUpperCase());
  }

  tone() {
    const value = this.norm();
    if (['SUCCESS', 'OK', 'ACTIVE', 'ACTIVO', 'READY', 'SENT'].includes(value)) return 'success';
    if (['FAILED', 'ERROR', 'CANCELLED', 'INACTIVE', 'INACTIVO'].includes(value)) return 'danger';
    if (['PARTIAL_SUCCESS', 'WARNING', 'WARN', 'PENDING_CONFIG'].includes(value)) return 'warning';
    if (['RUNNING', 'UPLOADING', 'PENDING', 'PROCESSING'].includes(value)) return 'process';
    return 'neutral';
  }
}

@Component({
  selector: 'app-bkp-notice-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="bkpNoticeStrip" *ngIf="loading || saving || error || success || dirty || warnings.length">
      <span class="bkpNoticePill is-info" *ngIf="loading">
        <i class="pi pi-spin pi-spinner"></i> Cargando
      </span>

      <span class="bkpNoticePill is-info" *ngIf="saving">
        <i class="pi pi-spin pi-spinner"></i> Guardando
      </span>

      <span class="bkpNoticePill is-warning" *ngIf="dirty">
        <i class="pi pi-exclamation-triangle"></i> Cambios pendientes
      </span>

      <span class="bkpNoticePill is-success" *ngIf="success">
        <i class="pi pi-check"></i> {{ success }}
      </span>

      <span class="bkpNoticePill is-danger" *ngIf="error">
        <i class="pi pi-times-circle"></i> {{ error }}
      </span>

      <span class="bkpNoticePill is-warning" *ngFor="let warning of warnings">
        <i class="pi pi-exclamation-triangle"></i> {{ warning }}
      </span>
    </section>
  `,
  styles: [`
    .bkpNoticeStrip{
      display:flex;
      align-items:center;
      flex-wrap:wrap;
      gap:.34rem;
      margin-bottom:.55rem;
      min-height:1.62rem;
    }

    .bkpNoticePill{
      display:inline-flex;
      align-items:center;
      gap:.32rem;
      min-height:1.5rem;
      padding:0 .5rem;
      border-radius:999px;
      font-size:.67rem;
      font-weight:800;
      border:1px solid transparent;
      line-height:1;
      max-width:100%;
    }

    .bkpNoticePill i{font-size:.66rem}
    .is-info{background:#eff6ff;color:#175cd3;border-color:#bfdbfe}
    .is-success{background:#ecfdf3;color:#027a48;border-color:#abefc6}
    .is-warning{background:#fff7ed;color:#b45309;border-color:#fed7aa}
    .is-danger{background:#fff1f2;color:#b42318;border-color:#fecdd3}
  `]
})
export class BkpNoticeStripComponent {
  @Input() loading = false;
  @Input() saving = false;
  @Input() dirty = false;
  @Input() error: string | null = null;
  @Input() success: string | null = null;
  @Input() warnings: string[] = [];
}
