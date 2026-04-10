import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Component, Input, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
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
    VehiculosFormDrawerComponent,
  ],
  templateUrl: './orden-reportes-panel.component.html',
  styleUrl: './orden-reportes-panel.component.scss',
})
export class OrdenReportesPanelComponent {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private notify = inject(NotifyService);
  private repo = inject(VehiculosRepository);
  private fb = inject(FormBuilder);

  @Input() orden: VehOrdenTrabajo | null = null;

  readonly drawerVisible = signal(false);
  readonly downloading = signal(false);
  readonly loadingTipos = signal(false);
  readonly tiposVehiculo = signal<VehTipoVehiculo[]>([]);

  readonly blankForm = this.fb.group({
    formato: this.fb.control<VehReporteFormato>('trabajo', { nonNullable: true, validators: [Validators.required] }),
    idVehTipoVehiculo: this.fb.control<number | null>(null),
  });

  get hasSelectedOrder(): boolean {
    return !!this.orden?.idVehOrdenTrabajo;
  }

  openBlankDrawer(defaultFormat: VehReporteFormato = 'trabajo') {
    this.blankForm.reset({
      formato: defaultFormat,
      idVehTipoVehiculo: null,
    });

    this.drawerVisible.set(true);
    this.syncTipoRequirement(defaultFormat);

    if (defaultFormat === 'trabajo') {
      this.ensureTiposVehiculoLoaded();
    }
  }

  closeBlankDrawer() {
    this.drawerVisible.set(false);
  }

  onFormatoChange(formato: VehReporteFormato) {
    this.syncTipoRequirement(formato);
    if (formato === 'trabajo') {
      this.ensureTiposVehiculoLoaded();
    }
  }

  descargarConDatos(formato: VehReporteFormato) {
    if (!this.orden?.idVehOrdenTrabajo) {
      this.notify.warn('Selecciona una orden', 'Primero elige una OT para generar el documento con datos.');
      return;
    }

    this.descargarDocumento(formato, 'datos', { idVehOrdenTrabajo: this.orden.idVehOrdenTrabajo });
  }

  descargarBlank() {
    const formato = this.blankForm.controls.formato.value;
    const idVehTipoVehiculo = this.blankForm.controls.idVehTipoVehiculo.value;

    if (formato === 'trabajo' && !idVehTipoVehiculo) {
      this.blankForm.controls.idVehTipoVehiculo.markAsTouched();
      this.notify.warn('Tipo requerido', 'Para la orden de trabajo en blanco debes elegir el tipo de vehículo.');
      return;
    }

    this.descargarDocumento(formato, 'blank', {
      idVehTipoVehiculo: formato === 'trabajo' ? idVehTipoVehiculo : undefined,
    }, true);
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
        this.tiposVehiculo.set((res.items ?? []).slice().sort((a, b) =>
          String(a.tipoVehiculo || '').localeCompare(String(b.tipoVehiculo || '')),
        ));
        this.loadingTipos.set(false);
      },
      error: (err) => {
        this.loadingTipos.set(false);
        this.notify.error('No se pudieron cargar los tipos', err?.message);
      },
    });
  }

  private descargarDocumento(
    formato: VehReporteFormato,
    modo: VehReporteModo,
    extra: { idVehOrdenTrabajo?: number | null; idVehTipoVehiculo?: number | null | undefined },
    closeAfter = false,
  ) {
    const params = new URLSearchParams();
    params.set('modo', modo);

    if (extra.idVehOrdenTrabajo) {
      params.set('idVehOrdenTrabajo', String(extra.idVehOrdenTrabajo));
    }

    if (extra.idVehTipoVehiculo) {
      params.set('idVehTipoVehiculo', String(extra.idVehTipoVehiculo));
    }

    const url = `${this.env.apiBaseUrl}/api/erp/klax/veh/reportes/documentos/${formato}?${params.toString()}`;

    this.downloading.set(true);
    this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
      next: (response) => {
        this.downloading.set(false);
        this.handleDownload(response, `${formato}-${modo}.html`);
        if (closeAfter) {
          this.drawerVisible.set(false);
        }
      },
      error: (err) => {
        this.downloading.set(false);
        this.notify.error('No se pudo generar el documento', err?.error?.message || err?.message);
      },
    });
  }

  private handleDownload(response: HttpResponse<Blob>, fallbackName: string) {
    const blob = response.body;
    if (!blob) {
      this.notify.warn('Sin archivo', 'El backend no devolvió contenido para descargar.');
      return;
    }

    const fileName = this.extractFileName(response) || fallbackName;
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 3000);

    this.notify.success('Documento generado', `Se descargó ${fileName}.`);
  }

  private extractFileName(response: HttpResponse<Blob>): string | null {
    const raw = response.headers.get('content-disposition') || response.headers.get('Content-Disposition');
    if (!raw) return null;

    const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const basicMatch = raw.match(/filename="?([^";]+)"?/i);
    return basicMatch?.[1] || null;
  }
}
