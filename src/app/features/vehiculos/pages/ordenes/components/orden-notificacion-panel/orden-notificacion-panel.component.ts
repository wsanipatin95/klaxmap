import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { NotifyService } from 'src/app/core/services/notify.service';
import {
  AdmCentro,
  AdmNotificacionConfig,
  VehClienteNotificacion,
  VehClienteNotificacionEnviarRequest,
  VehOrdenTrabajo,
} from '../../../../data-access/vehiculos.models';
import { VehiculosRepository } from '../../../../data-access/vehiculos.repository';

type CanalNotificacion = 'WHATSAPP' | 'EMAIL';

@Component({
  selector: 'app-orden-notificacion-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule, TagModule],
  templateUrl: './orden-notificacion-panel.component.html',
  styleUrl: './orden-notificacion-panel.component.scss',
})
export class OrdenNotificacionPanelComponent implements OnChanges {
  private repo = inject(VehiculosRepository);
  private notify = inject(NotifyService);

  @Input() orden: VehOrdenTrabajo | null = null;
  @Input() clienteNombre = 'Cliente';

  readonly visible = signal(false);
  readonly historyVisible = signal(false);
  readonly sending = signal(false);
  readonly loading = signal(false);
  readonly loadingHistory = signal(false);
  readonly centros = signal<AdmCentro[]>([]);
  readonly config = signal<AdmNotificacionConfig | null>(null);
  readonly notificaciones = signal<VehClienteNotificacion[]>([]);

  canal: CanalNotificacion = 'WHATSAPP';
  tipoEvento = 'OT_ACTUALIZACION';
  idAdmCentroFk: number | null = null;
  destinatarioTelefono = '';
  destinatarioEmail = '';
  titulo = 'Actualización de orden de trabajo';
  asunto = 'Actualización de orden de trabajo';
  mensaje = '';
  requiereRespuesta = false;
  usarPlantilla = false;

  readonly tipoEventoOptions = [
    { value: 'OT_ACTUALIZACION', label: 'Actualización de OT' },
    { value: 'OT_RECIBIDA', label: 'OT recibida' },
    { value: 'OT_EN_PROCESO', label: 'OT en proceso' },
    { value: 'OT_LISTA_ENTREGA', label: 'Vehículo listo' },
    { value: 'REPUESTO_AUTORIZACION', label: 'Autorizar repuesto' },
    { value: 'HALLAZGO_AUTORIZACION', label: 'Autorizar hallazgo' },
    { value: 'FACTURA_EMITIDA', label: 'Factura / saldo' },
    { value: 'GARANTIA_CREADA', label: 'Garantía creada' },
    { value: 'RECLAMO_GARANTIA', label: 'Reclamo garantía' },
    { value: 'MENSAJE_LIBRE', label: 'Mensaje libre' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orden'] && this.orden) {
      this.idAdmCentroFk = this.orden.idAdmCentroFk ?? this.idAdmCentroFk ?? null;
      this.mensaje = this.buildMensajeDefault();
    }
  }

  open() {
    if (!this.orden?.idVehOrdenTrabajo) {
      this.notify.warn('Selecciona una orden', 'Primero elige una OT para notificar al cliente.');
      return;
    }
    this.visible.set(true);
    this.prepareDefaults();
    this.ensureConfigLoaded();
  }

  close() {
    this.visible.set(false);
  }

  toggleHistory() {
    const next = !this.historyVisible();
    this.historyVisible.set(next);
    if (next) this.loadHistory();
  }

  onCanalChange(value: CanalNotificacion | string) {
    this.canal = String(value || 'WHATSAPP').toUpperCase() === 'EMAIL' ? 'EMAIL' : 'WHATSAPP';
    if (this.canal === 'EMAIL' && !this.asunto.trim()) this.asunto = this.titulo || 'Notificación KLAX';
  }

  onTipoEventoChange(value: string) {
    this.tipoEvento = value || 'OT_ACTUALIZACION';
    this.titulo = this.tipoEventoLabel(this.tipoEvento);
    this.asunto = this.titulo;
    this.mensaje = this.buildMensajeDefault();
  }

  send() {
    if (!this.orden?.idVehOrdenTrabajo) return;
    const error = this.validate();
    if (error) {
      this.notify.warn('Revisa la notificación', error);
      return;
    }

    const payload: VehClienteNotificacionEnviarRequest = {
      canal: this.canal,
      tipoEvento: this.tipoEvento,
      idAdmCentroFk: this.idAdmCentroFk || this.orden.idAdmCentroFk || null,
      destinatarioNombre: this.clienteNombre || this.orden.nombre || null,
      destinatarioTelefono: this.canal === 'WHATSAPP' ? this.destinatarioTelefono : null,
      destinatarioEmail: this.canal === 'EMAIL' ? this.destinatarioEmail : null,
      titulo: this.titulo || this.tipoEventoLabel(this.tipoEvento),
      asunto: this.canal === 'EMAIL' ? (this.asunto || this.titulo) : null,
      mensaje: this.mensaje,
      html: this.canal === 'EMAIL' ? this.toHtml(this.mensaje) : null,
      visibleCliente: true,
      requiereRespuesta: this.requiereRespuesta,
      usarPlantilla: this.canal === 'WHATSAPP' ? this.usarPlantilla : false,
      payload: {
        origen: 'klaxmap',
        idVehOrdenTrabajo: this.orden.idVehOrdenTrabajo,
        estadoOrden: this.orden.estadoOrden,
        placa: this.orden.placa,
      },
    };

    this.sending.set(true);
    this.repo.enviarOrdenNotificacion(this.orden.idVehOrdenTrabajo, payload).subscribe({
      next: (res: any) => {
        this.sending.set(false);
        const data = res?.data ?? res;
        this.notify.success('Notificación procesada', `Estado: ${data?.estadoEnvio || 'procesada'}`);
        this.loadHistory();
      },
      error: (err) => {
        this.sending.set(false);
        this.notify.error('No se pudo enviar', this.errorMessage(err));
      },
    });
  }

  providerLabel(): string {
    const cfg = this.config();
    if (this.canal === 'EMAIL') return cfg?.correoConfigurado ? 'Correo configurado' : 'Correo sin validar';
    return String(cfg?.tokenMeta || '').toLowerCase() === 'meta' ? 'WhatsApp Business API' : 'WPPConnect por centro';
  }

  providerSeverity(): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (this.canal === 'EMAIL') return this.config()?.correoConfigurado ? 'success' : 'warn';
    return String(this.config()?.tokenMeta || '').toLowerCase() === 'meta' ? 'info' : 'success';
  }

  estadoSeverity(estado?: string | null): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const v = String(estado || '').toUpperCase();
    if (v === 'ENVIADO' || v === 'FALLBACK_ENVIADO' || v === 'ENTREGADO' || v === 'LEIDO') return 'success';
    if (v.includes('ENVIANDO') || v.includes('PENDIENTE')) return 'info';
    if (v.includes('FALLIDO')) return 'danger';
    if (v.includes('BORRADOR')) return 'warn';
    return 'secondary';
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(String(value).includes('T') ? String(value) : String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private prepareDefaults() {
    if (!this.orden) return;
    this.idAdmCentroFk = this.orden.idAdmCentroFk ?? this.idAdmCentroFk ?? null;
    if (!this.titulo.trim()) this.titulo = this.tipoEventoLabel(this.tipoEvento);
    if (!this.asunto.trim()) this.asunto = this.titulo;
    if (!this.mensaje.trim()) this.mensaje = this.buildMensajeDefault();
  }

  private ensureConfigLoaded() {
    if (this.loading()) return;
    if (this.config() && this.centros().length) return;
    this.loading.set(true);
    this.repo.obtenerAdmNotificacionConfig().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        const defaultCentro = Number(cfg?.admCentroDefault || 0);
        if (!this.idAdmCentroFk && defaultCentro > 0) this.idAdmCentroFk = defaultCentro;
        this.loadCentros();
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('No se pudo cargar configuración', this.errorMessage(err));
      },
    });
  }

  private loadCentros() {
    this.repo.listarCentrosAdm('', 0, 200, true).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        this.centros.set(items);
        if (!this.idAdmCentroFk) this.idAdmCentroFk = this.orden?.idAdmCentroFk || items[0]?.idAdmCentro || 1;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('No se pudieron cargar centros', this.errorMessage(err));
      },
    });
  }

  private loadHistory() {
    if (!this.orden?.idVehOrdenTrabajo) return;
    this.loadingHistory.set(true);
    this.repo.listarOrdenNotificaciones(this.orden.idVehOrdenTrabajo, 0, 50).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        this.notificaciones.set(items);
        this.loadingHistory.set(false);
      },
      error: (err) => {
        this.loadingHistory.set(false);
        this.notify.error('No se pudo cargar historial', this.errorMessage(err));
      },
    });
  }

  private validate(): string | null {
    if (!this.mensaje.trim()) return 'El mensaje no puede estar vacío.';
    if (this.canal === 'WHATSAPP' && !this.destinatarioTelefono.trim()) return 'Debes ingresar el número de WhatsApp.';
    if (this.canal === 'EMAIL' && !this.destinatarioEmail.trim()) return 'Debes ingresar el correo del cliente.';
    if (this.canal === 'EMAIL' && !this.asunto.trim()) return 'Debes ingresar asunto para el correo.';
    return null;
  }

  private buildMensajeDefault(): string {
    const orden = this.orden;
    if (!orden) return '';
    const cliente = this.clienteNombre || orden.nombre || 'cliente';
    const ot = orden.idVehOrdenTrabajo ? `#${orden.idVehOrdenTrabajo}` : '';
    const placa = orden.placa ? ` (${orden.placa})` : '';
    const estado = orden.estadoOrden || 'en revisión';
    switch (this.tipoEvento) {
      case 'OT_RECIBIDA': return `Hola ${cliente}, recibimos tu vehículo${placa}. Tu orden de trabajo ${ot} fue registrada y te mantendremos informado.`;
      case 'OT_EN_PROCESO': return `Hola ${cliente}, tu orden de trabajo ${ot}${placa} está en proceso. Te avisaremos cualquier novedad.`;
      case 'OT_LISTA_ENTREGA': return `Hola ${cliente}, tu vehículo${placa} correspondiente a la OT ${ot} está listo para entrega.`;
      case 'REPUESTO_AUTORIZACION': this.requiereRespuesta = true; return `Hola ${cliente}, tu OT ${ot}${placa} requiere autorización de repuesto. Por favor revisa y confirma si apruebas el cambio.`;
      case 'HALLAZGO_AUTORIZACION': this.requiereRespuesta = true; return `Hola ${cliente}, encontramos una novedad en tu OT ${ot}${placa}. Por favor revisa y confirma si autorizas continuar.`;
      case 'FACTURA_EMITIDA': return `Hola ${cliente}, se emitió información comercial de tu OT ${ot}${placa}. Te compartimos el detalle para tu revisión.`;
      case 'GARANTIA_CREADA': return `Hola ${cliente}, se registró la garantía relacionada a tu OT ${ot}${placa}.`;
      case 'RECLAMO_GARANTIA': return `Hola ${cliente}, tenemos una actualización sobre tu reclamo de garantía asociado a la OT ${ot}${placa}.`;
      default: return `Hola ${cliente}, te informamos que tu OT ${ot}${placa} se encuentra en estado: ${estado}.`;
    }
  }

  private tipoEventoLabel(value: string): string {
    return this.tipoEventoOptions.find((item) => item.value === value)?.label || 'Notificación cliente';
  }

  private toHtml(text: string): string {
    return `<p>${String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
  }

  private errorMessage(err: unknown): string {
    const anyErr = err as any;
    return anyErr?.error?.message || anyErr?.error?.mensaje || anyErr?.message || 'Ocurrió un error al procesar la notificación.';
  }
}
