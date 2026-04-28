import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, Input, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { VehiculosFormDrawerComponent } from '../../../../components/form-drawer/form-drawer.component';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { NotifyService } from 'src/app/core/services/notify.service';
import { VehOrdenTrabajo, VehTipoVehiculo } from '../../../../data-access/vehiculos.models';
import { VehiculosRepository } from '../../../../data-access/vehiculos.repository';

type VehReporteFormato = 'ingreso' | 'trabajo' | 'entrega';
type VehReporteModo = 'datos' | 'blank';

@Component({
  selector: 'app-orden-reportes-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    VehiculosFormDrawerComponent,
  ],
  templateUrl: './orden-reportes-panel.component.html',
  styleUrl: './orden-reportes-panel.component.scss',
})
export class OrdenReportesPanelComponent implements OnDestroy {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private notify = inject(NotifyService);
  private repo = inject(VehiculosRepository);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  @Input() orden: VehOrdenTrabajo | null = null;

  readonly drawerVisible = signal(false);
  readonly downloading = signal(false);
  readonly loadingTipos = signal(false);
  readonly tiposVehiculo = signal<VehTipoVehiculo[]>([]);

  readonly previewVisible = signal(false);
  readonly previewLoading = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly previewSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly previewFileName = signal<string>('documento.html');
  readonly previewTitle = signal<string>('Previsualizar documento');
  readonly previewSubtitle = signal<string>('Revisa el documento antes de imprimir o descargar.');

  readonly blankForm = this.fb.group({
    formato: this.fb.control<VehReporteFormato>('trabajo', { nonNullable: true, validators: [Validators.required] }),
    idVehTipoVehiculo: this.fb.control<number | null>(null),
  });

  get hasSelectedOrder(): boolean {
    return !!this.orden?.idVehOrdenTrabajo;
  }

  ngOnDestroy(): void {
    this.clearPreviewUrl();
  }

  openBlankDrawer(defaultFormat: VehReporteFormato = 'trabajo') {
    this.blankForm.reset({ formato: defaultFormat, idVehTipoVehiculo: null });
    this.drawerVisible.set(true);
    this.syncTipoRequirement(defaultFormat);
    if (defaultFormat === 'trabajo') this.ensureTiposVehiculoLoaded();
  }

  closeBlankDrawer() {
    this.drawerVisible.set(false);
  }

  onFormatoChange(formato: VehReporteFormato) {
    this.syncTipoRequirement(formato);
    if (formato === 'trabajo') this.ensureTiposVehiculoLoaded();
  }

  /**
   * Antes descargaba directo. Ahora genera y abre previsualización.
   * Desde el modal el usuario decide imprimir o descargar.
   */
  descargarConDatos(formato: VehReporteFormato) {
    if (!this.orden?.idVehOrdenTrabajo) {
      this.notify.warn('Selecciona una orden', 'Primero elige una OT para generar el documento con datos.');
      return;
    }

    this.generarDocumento(
      formato,
      'datos',
      { idVehOrdenTrabajo: this.orden.idVehOrdenTrabajo },
      false,
    );
  }

  /**
   * Antes descargaba directo. Ahora genera formato en blanco y abre previsualización.
   */
  descargarBlank() {
    const formato = this.blankForm.controls.formato.value;
    const idVehTipoVehiculo = this.blankForm.controls.idVehTipoVehiculo.value;

    if (formato === 'trabajo' && !idVehTipoVehiculo) {
      this.blankForm.controls.idVehTipoVehiculo.markAsTouched();
      this.notify.warn('Tipo requerido', 'Para la orden de trabajo en blanco debes elegir el tipo de vehículo.');
      return;
    }

    this.generarDocumento(
      formato,
      'blank',
      { idVehTipoVehiculo: formato === 'trabajo' ? idVehTipoVehiculo : undefined },
      true,
    );
  }

  imprimirPreview() {
    const url = this.previewUrl();
    if (!url) {
      this.notify.warn('Sin documento', 'Primero genera una previsualización.');
      return;
    }

    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      this.notify.warn('Ventana bloqueada', 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
      return;
    }

    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        this.notify.warn('No se pudo imprimir', 'La previsualización se abrió, pero no se pudo ejecutar la impresión automática.');
      }
    }, 500);
  }

  descargarPreview() {
    const url = this.previewUrl();
    if (!url) {
      this.notify.warn('Sin documento', 'Primero genera una previsualización.');
      return;
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = this.previewFileName() || 'documento.html';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();

    this.notify.success('Documento descargado', `Se descargó ${this.previewFileName()}.`);
  }

  cerrarPreview() {
    this.previewVisible.set(false);
  }

  etiquetaFormato(formato: VehReporteFormato): string {
    switch (formato) {
      case 'ingreso': return 'Orden de ingreso';
      case 'trabajo': return 'Orden de trabajo';
      case 'entrega': return 'Acta de entrega';
      default: return 'Documento';
    }
  }

  private syncTipoRequirement(formato: VehReporteFormato) {
    const control = this.blankForm.controls.idVehTipoVehiculo;

    if (formato === 'trabajo') {
      control.addValidators(Validators.required);
    } else {
      control.clearValidators();
      control.setValue(null);
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private ensureTiposVehiculoLoaded() {
    if (this.tiposVehiculo().length || this.loadingTipos()) return;

    this.loadingTipos.set(true);
    this.repo.listarTipos('', 0, 200, true).subscribe({
      next: (res) => {
        this.tiposVehiculo.set(
          (res.items ?? [])
            .slice()
            .sort((a, b) => String(a.tipoVehiculo || '').localeCompare(String(b.tipoVehiculo || ''))),
        );
        this.loadingTipos.set(false);
      },
      error: async (err) => {
        this.loadingTipos.set(false);
        this.notify.error('No se pudieron cargar los tipos', await this.resolveErrorMessage(err));
      },
    });
  }

  private generarDocumento(
    formato: VehReporteFormato,
    modo: VehReporteModo,
    extra: { idVehOrdenTrabajo?: number | null; idVehTipoVehiculo?: number | null | undefined },
    closeAfter = false,
  ) {
    const params = new URLSearchParams();
    params.set('modo', modo);

    if (extra.idVehOrdenTrabajo) params.set('idVehOrdenTrabajo', String(extra.idVehOrdenTrabajo));
    if (extra.idVehTipoVehiculo) params.set('idVehTipoVehiculo', String(extra.idVehTipoVehiculo));

    const url = `${this.env.apiBaseUrl}/api/erp/klax/veh/reportes/documentos/${formato}?${params.toString()}`;

    this.downloading.set(true);
    this.previewLoading.set(true);

    this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
      next: (response) => {
        this.downloading.set(false);
        this.previewLoading.set(false);
        this.openPreviewFromResponse(response, `${formato}-${modo}.html`, formato, modo);
        if (closeAfter) this.drawerVisible.set(false);
      },
      error: async (err) => {
        this.downloading.set(false);
        this.previewLoading.set(false);
        this.notify.error('No se pudo generar el documento', await this.resolveErrorMessage(err));
      },
    });
  }

  private openPreviewFromResponse(
    response: HttpResponse<Blob>,
    fallbackName: string,
    formato: VehReporteFormato,
    modo: VehReporteModo,
  ) {
    const blob = response.body;

    if (!blob) {
      this.notify.warn('Sin archivo', 'El backend no devolvió contenido para previsualizar.');
      return;
    }

    const fileName = this.extractFileName(response) || fallbackName;
    const htmlBlob = this.ensureHtmlBlob(blob);
    const objectUrl = window.URL.createObjectURL(htmlBlob);

    this.clearPreviewUrl();

    this.previewFileName.set(fileName);
    this.previewTitle.set(this.etiquetaFormato(formato));
    this.previewSubtitle.set(
      modo === 'blank'
        ? 'Formato en blanco listo para revisar, imprimir o descargar.'
        : `OT #${this.orden?.idVehOrdenTrabajo ?? '-'} · revisa antes de imprimir o descargar.`,
    );
    this.previewUrl.set(objectUrl);
    this.previewSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
    this.previewVisible.set(true);
  }

  private ensureHtmlBlob(blob: Blob): Blob {
    const type = blob.type || 'text/html;charset=utf-8';
    if (type.includes('text/html')) return blob;
    return new Blob([blob], { type: 'text/html;charset=utf-8' });
  }

  private clearPreviewUrl() {
    const current = this.previewUrl();
    if (current) {
      window.URL.revokeObjectURL(current);
    }

    this.previewUrl.set(null);
    this.previewSafeUrl.set(null);
  }

  private extractFileName(response: HttpResponse<Blob>): string | null {
    const raw = response.headers.get('content-disposition') || response.headers.get('Content-Disposition');
    if (!raw) return null;

    const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const basicMatch = raw.match(/filename="?([^";]+)"?/i);
    return basicMatch?.[1] || null;
  }

  private async resolveErrorMessage(error: unknown): Promise<string> {
    const fallback = 'Ocurrió un error inesperado al generar el documento.';
    if (!(error instanceof HttpErrorResponse)) return fallback;

    if (typeof error.error === 'string' && error.error.trim()) return error.error.trim();

    if (error.error instanceof Blob) {
      try {
        const text = (await error.error.text()).trim();
        if (text) return text;
      } catch {}
    }

    if (error.message?.trim()) return error.message.trim();
    return fallback;
  }
}
