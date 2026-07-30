import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

// Base relativa del back de Monitoreo (unificación KLAX). En dev la resuelve el
// proxy (/api/monitoreo -> NOC), en prod nginx. Coincide con env.apiBases.monitoreo.
// El interceptor de klaxmap adjunta el JWT del ERP a estas llamadas.
export const API = '/api/monitoreo';

/** Envelope estándar del backend (estándar KLAX). */
export interface ApiEnvelope<T> { codigo: number; mensaje: string; data: T; }

/** Desempaqueta el envelope: devuelve data o lanza si codigo !== 0. */
function unwrap<T>(r: ApiEnvelope<T>): T {
  if (r == null || r.codigo !== 0) throw new Error((r && r.mensaje) || 'Error del servidor');
  return r.data;
}

export interface Device {
  id: number;
  name: string;
  vendor: string;
  model: string;
  device_type: string;
  zone: string;
  ip_address: string;
  snmp_version: string;
  snmp_community: string;
  snmp_port: number;
  snmp_enabled: boolean;
  mon_temp: boolean;
  status: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  ping_ms: number | null;
  temp_celsius: number | null;
  wan_gbps: number | null;
  sys_name: string | null;
  uptime_seconds: number | null;
}

export interface Iface {
  id: number;
  device_name: string;
  real_name: string;
  noc_alias: string;
  usage_type: string;
  capacity_bps: number;
  status: string;
  util_percent: number;
  rx_bps: number;
  tx_bps: number;
  errors: number;
}

export interface Alert {
  id: number;
  severity: string;
  status: string;
  device_name: string;
  iface: string;
  description: string;
  started: string;
  duration: string;
}

export interface Point { t: string; v?: number; rx?: number; tx?: number; in_err?: number; out_err?: number; in_disc?: number; out_disc?: number; }

export interface ZteOltRow {
  id: number; name: string; host: string; telnetPort: number; telnetUser: string;
  snmpCommunity: string; vendor: string; model: string; softwareVersion: string;
  ponPorts: string; enabled: boolean;
  snmpPollEnabled: boolean; snmpPollSeconds: number; lastSnmpAt: string | null;
  tempMaxC: number | null; tempHotSlot: number | null; lastSystemAt: string | null;
  idOltPerfil: number | null;
  idRedOltMarca: number | null;
}

/** Perfil del catálogo multimarca (marca · modelo · firmware) para el combo "Tipo de OLT". */
export interface OltPerfil {
  id: number; nombre: string; vendor: string; modelo: string | null;
  firmware: string | null; estado: string; cli_estilo: string | null;
}

/** Marca de OLT del ERP (kxt_red_olt_marca). Llave del catálogo de comandos. */
export interface OltMarca { idRedOltMarca: number; marca: string; }

/** Comando del catálogo (copia local NOC) para una marca. */
export interface CatComando { metric_key: string; script: string | null; comando: string; parser_key: string | null; confirmado: boolean; }

export interface OnuRow {
  id: number; oltId: number; shelf: number; slot: number; port: number; onuId: number;
  rawIndex: string; serial: string | null; clientName: string | null; clientIp: string | null;
  description: string | null; distanceM: number | null; phaseState: string; adminState: string | null;
  onuRxDbm: number | null; onuTxDbm: number | null; oltRxDbm: number | null; oltTxDbm: number | null;
  onuInRateBps: number | null; onuOutRateBps: number | null; onuInTotalBytes: number | null; onuOutTotalBytes: number | null;
  lastCause: string | null; offlineHistory: string | null; lastSeenAt: string | null; updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class NocApi {
  private http = inject(HttpClient);

  devices(): Observable<Device[]> { return this.http.get<ApiEnvelope<Device[]>>(`${API}/devices`).pipe(map(unwrap)); }
  createDevice(body: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/devices`, body).pipe(map(unwrap)); }
  updateDevice(id: number, body: any): Observable<any> { return this.http.put<ApiEnvelope<any>>(`${API}/devices/${id}`, body).pipe(map(unwrap)); }
  deleteDevice(id: number): Observable<any> { return this.http.delete<ApiEnvelope<any>>(`${API}/devices/${id}`).pipe(map(unwrap)); }
  /** Sincroniza el catalogo de OLT/equipos del ERP hacia el NOC (llena erp_olt_id). */
  syncCheck(): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/devices/sync-check`).pipe(map(unwrap)); }
  /** Catálogo multimarca: perfiles de OLT (Tipo de OLT) para el combo del formulario. */
  oltPerfiles(): Observable<OltPerfil[]> { return this.http.get<ApiEnvelope<OltPerfil[]>>(`${API}/devices/olt-perfiles`).pipe(map(unwrap)); }
  // ---- Catálogo de comandos (escritura dual ERP + NOC) ----
  catalogoMarcas(): Observable<OltMarca[]> { return this.http.get<ApiEnvelope<OltMarca[]>>(`${API}/zte/catalogo/marcas`).pipe(map(unwrap)); }
  catalogoComandos(marca: number): Observable<CatComando[]> { return this.http.get<ApiEnvelope<CatComando[]>>(`${API}/zte/catalogo?marca=${marca}`).pipe(map(unwrap)); }
  guardarComando(body: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/zte/catalogo/comando`, body).pipe(map(unwrap)); }
  interfaces(): Observable<Iface[]> { return this.http.get<ApiEnvelope<Iface[]>>(`${API}/interfaces`).pipe(map(unwrap)); }
  alerts(): Observable<Alert[]> { return this.http.get<ApiEnvelope<Alert[]>>(`${API}/alerts`).pipe(map(unwrap)); }
  dashboardTraffic(points = 24): Observable<Point[]> { return this.http.get<ApiEnvelope<Point[]>>(`${API}/dashboard/traffic?points=${points}`).pipe(map(unwrap)); }
  deviceMetric(id: number, metric: string, rangeMin = 60, buckets = 60, pad = true): Observable<Point[]> {
    return this.http.get<ApiEnvelope<Point[]>>(`${API}/devices/${id}/metrics?metric=${metric}&rangeMin=${rangeMin}&buckets=${buckets}&pad=${pad}`).pipe(map(unwrap));
  }
  deviceTraffic(id: number, rangeMin = 60, buckets = 60, pad = true): Observable<Point[]> {
    return this.http.get<ApiEnvelope<Point[]>>(`${API}/devices/${id}/traffic?rangeMin=${rangeMin}&buckets=${buckets}&pad=${pad}`).pipe(map(unwrap));
  }
  cpuCores(id: number, rangeMin = 15, buckets = 60): Observable<{ labels: string[]; series: { name: string; data: (number | null)[] }[] }> {
    return this.http.get<ApiEnvelope<any>>(`${API}/devices/${id}/cpu-cores?rangeMin=${rangeMin}&buckets=${buckets}`).pipe(map(unwrap));
  }
  interfaceTraffic(id: number, rangeMin = 60, buckets = 60, pad = true): Observable<Point[]> {
    return this.http.get<ApiEnvelope<Point[]>>(`${API}/interfaces/${id}/traffic?rangeMin=${rangeMin}&buckets=${buckets}&pad=${pad}`).pipe(map(unwrap));
  }

  // ---- ZTE ONU (clientes) ----
  zteOlts(): Observable<ZteOltRow[]> { return this.http.get<ApiEnvelope<ZteOltRow[]>>(`${API}/zte/olts`).pipe(map(unwrap)); }
  zteCreateOlt(body: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/zte/olts`, body).pipe(map(unwrap)); }
  zteOnus(): Observable<OnuRow[]> { return this.http.get<ApiEnvelope<OnuRow[]>>(`${API}/zte/onus`).pipe(map(unwrap)); }
  zteOnusOfOlt(id: number): Observable<OnuRow[]> { return this.http.get<ApiEnvelope<OnuRow[]>>(`${API}/zte/olts/${id}/onus`).pipe(map(unwrap)); }
  zteCollect(id: number, port: string): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/zte/olts/${id}/collect?port=${port}`, {}).pipe(map(unwrap)); }
  zteDiscoverCards(id: number): Observable<ZteOltRow> { return this.http.post<ApiEnvelope<ZteOltRow>>(`${API}/zte/olts/${id}/discover-cards`, {}).pipe(map(unwrap)); }
  zteOltSystem(id: number): Observable<ZteOltRow> { return this.http.post<ApiEnvelope<ZteOltRow>>(`${API}/zte/olts/${id}/system`, {}).pipe(map(unwrap)); }
  zteVerificacion(id: number): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/zte/olts/${id}/verificacion`).pipe(map(unwrap)); }
  zteCollectFull(id: number, port: string): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/zte/olts/${id}/collect-full?port=${port}`, {}).pipe(map(unwrap)); }
  zteCollectSnmp(id: number): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/zte/olts/${id}/collect-snmp`, {}).pipe(map(unwrap)); }
  zteEnrich(id: number, force = false): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/zte/olts/${id}/enrich?force=${force}`, {}).pipe(map(unwrap)); }
  zteEnrichStatus(id: number): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/zte/olts/${id}/enrich-status`).pipe(map(unwrap)); }
  zteTopConsumo(id: number, limit = 50): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/zte/olts/${id}/top-consumo?limit=${limit}`).pipe(map(unwrap)); }
  zteOnuAlerts(iface: string): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/zte/onus/alerts?iface=${encodeURIComponent(iface)}`).pipe(map(unwrap)); }
  zteOltPorts(id: number): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/zte/olts/${id}/ports`).pipe(map(unwrap)); }

  testTelnet(body: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/diag/test-telnet`, body).pipe(map(unwrap)); }

  // ---- Configuración (módulo Tiempos) ----
  settings(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/settings`).pipe(map(unwrap)); }
  updateSetting(key: string, value: string): Observable<any> { return this.http.put<ApiEnvelope<any>>(`${API}/settings/${key}`, { value }).pipe(map(unwrap)); }
  notifyTest(channel?: string, type?: string, text?: string): Observable<any[]> {
    return this.http.post<ApiEnvelope<any[]>>(`${API}/notify/test`, { channel, type, text }).pipe(map(unwrap));
  }
  notifyHistory(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/notify/history`).pipe(map(unwrap)); }
  notifyDeviceAlerts(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/notify/device-alerts`).pipe(map(unwrap)); }
  notifyUpdateDeviceAlert(id: number, body: any): Observable<any> { return this.http.put<ApiEnvelope<any>>(`${API}/notify/device-alerts/${id}`, body).pipe(map(unwrap)); }
  zteRefresh(id: number, onuId: number, port: string): Observable<OnuRow> { return this.http.post<ApiEnvelope<OnuRow>>(`${API}/zte/olts/${id}/onus/${onuId}/refresh?port=${port}`, {}).pipe(map(unwrap)); }
  zteOnuHistory(id: number, metric = 'onu_rx_optical_power_dbm', hours = 168): Observable<Point[]> {
    return this.http.get<ApiEnvelope<Point[]>>(`${API}/zte/onus/${id}/history?metric=${metric}&hours=${hours}`).pipe(map(unwrap));
  }

  // ---- Alerta temprana (inicio) ----
  overview(): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/overview`).pipe(map(unwrap)); }
  transiciones(minutes = 60): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/overview/transiciones?minutes=${minutes}`).pipe(map(unwrap)); }

  // ---- Seguridad (reputación IP en listas negras / RBL) ----
  secRbl(): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/security/rbl`).pipe(map(unwrap)); }
  secCheck(ip: string): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/security/rbl/check?ip=${encodeURIComponent(ip)}`, {}).pipe(map(unwrap)); }
  secSweep(): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/security/rbl/sweep`, {}).pipe(map(unwrap)); }

  // ---- Tráfico por app (NetFlow) ----
  flowOverview(hours = 6, dir = 'd'): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/flow/overview?hours=${hours}&dir=${dir}`).pipe(map(unwrap)); }
  flowTopClients(hours = 6, limit = 50): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/flow/top-clients?hours=${hours}&limit=${limit}`).pipe(map(unwrap)); }
  flowApps(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/flow/apps`).pipe(map(unwrap)); }

  // ---- Configurar OLT ----
  oltcTemplates(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/olt-config/templates`).pipe(map(unwrap)); }
  oltcPreview(code: string, params: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/olt-config/preview`, { code, params }).pipe(map(unwrap)); }
  oltcExecute(code: string, oltId: number, params: any, user?: string): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/olt-config/execute`, { code, oltId, params, user }).pipe(map(unwrap)); }
  oltcUpdateBody(code: string, body: string): Observable<any> { return this.http.put<ApiEnvelope<any>>(`${API}/olt-config/templates/${code}`, { body }).pipe(map(unwrap)); }
  oltcLogs(oltId?: number): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/olt-config/logs${oltId ? '?oltId=' + oltId : ''}`).pipe(map(unwrap)); }

  // ---- Soporte ----
  supSearch(q: string): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/support/search?q=${encodeURIComponent(q)}`).pipe(map(unwrap)); }
  supCreateTicket(body: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/support/tickets`, body).pipe(map(unwrap)); }
  supTickets(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/support/tickets`).pipe(map(unwrap)); }
  supTicket(id: number): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/support/tickets/${id}`).pipe(map(unwrap)); }
  supAction(id: number, action: string, usuario?: string): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/support/tickets/${id}/action`, { action, usuario }).pipe(map(unwrap)); }
  supLog(id: number, accion: string, resultado: string, usuario?: string): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/support/tickets/${id}/log`, { accion, resultado, usuario }).pipe(map(unwrap)); }
  supUpdateTicket(id: number, body: any): Observable<any> { return this.http.put<ApiEnvelope<any>>(`${API}/support/tickets/${id}`, body).pipe(map(unwrap)); }
  supCreateOrder(id: number, body: any): Observable<any> { return this.http.post<ApiEnvelope<any>>(`${API}/support/tickets/${id}/order`, body).pipe(map(unwrap)); }
  supOrders(): Observable<any[]> { return this.http.get<ApiEnvelope<any[]>>(`${API}/support/orders`).pipe(map(unwrap)); }
  supOrder(id: number): Observable<any> { return this.http.get<ApiEnvelope<any>>(`${API}/support/orders/${id}`).pipe(map(unwrap)); }
}
