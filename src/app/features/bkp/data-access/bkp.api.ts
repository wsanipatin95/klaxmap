import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { BkpAgentNode, BkpCatalogs, BkpEngineTool, BkpGeneralConfig, BkpIntegrationProvider, BkpNotificationContact, BkpNotificationRule, BkpPlan, BkpPlanDetalle, BkpPlanGuardarRequest, BkpRestoreRequest, BkpRestoreRun, BkpRetentionRun, BkpRun, BkpRunDetail, BkpRunResumen, BkpSchedule, BkpSecret, BkpSecretEditarRequest, BkpSecretGuardarRequest, BkpSourceDatabase, BkpStorageDestination } from './bkp.models';
import { ListQuery, Paged, buildListParams } from './bkp.shared';

@Injectable({ providedIn: 'root' })
export class BkpApi {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);
  private baseUrl = `${this.env.apiBaseUrl}/api/erp/klax/bkp`;

  catalogos(){ return this.http.get<ApiEnvelope<BkpCatalogs>>(`${this.baseUrl}/catalogs`); }
  private list<T>(path:string,q:ListQuery={}){ return this.http.get<ApiEnvelope<Paged<T>>>(`${this.baseUrl}/${path}`,{params:buildListParams(q)}); }
  private get<T>(path:string,id:number){ return this.http.get<ApiEnvelope<T>>(`${this.baseUrl}/${path}/${id}`); }
  private post<T>(path:string,payload:unknown){ return this.http.post<ApiEnvelope<T>>(`${this.baseUrl}/${path}`,payload); }
  private patch<T>(path:string,payload:unknown){ return this.http.patch<ApiEnvelope<T>>(`${this.baseUrl}/${path}`,payload); }
  private del<T>(path:string,id:number){ return this.http.delete<ApiEnvelope<T>>(`${this.baseUrl}/${path}/${id}`); }

  listarSecrets(q:ListQuery={}){ return this.list<BkpSecret>('secrets',q); } crearSecret(p:BkpSecretGuardarRequest){ return this.post<BkpSecret>('secrets',p); } editarSecret(p:BkpSecretEditarRequest){ return this.patch<BkpSecret>('secrets',p); } eliminarSecret(id:number){ return this.del<BkpSecret>('secrets',id); }
  listarAgents(q:ListQuery={}){ return this.list<BkpAgentNode>('agents',q); } crearAgent(p:Partial<BkpAgentNode>){ return this.post<BkpAgentNode>('agents',p); } editarAgent(id:number,c:Record<string,unknown>){ return this.patch<BkpAgentNode>('agents',{idBkpAgentNode:id,cambios:c}); } eliminarAgent(id:number){ return this.del<BkpAgentNode>('agents',id); } probarConexionAgent(id:number){ return this.post<Record<string,unknown>>('agents/'+id+'/test-connection',{}); }
  listarTools(q:ListQuery={}){ return this.list<BkpEngineTool>('engine-tools',q); } crearTool(p:Partial<BkpEngineTool>){ return this.post<BkpEngineTool>('engine-tools',p); } editarTool(id:number,c:Record<string,unknown>){ return this.patch<BkpEngineTool>('engine-tools',{idBkpEngineTool:id,cambios:c}); } eliminarTool(id:number){ return this.del<BkpEngineTool>('engine-tools',id); }
  listarSources(q:ListQuery={}){ return this.list<BkpSourceDatabase>('sources',q); } crearSource(p:Partial<BkpSourceDatabase>){ return this.post<BkpSourceDatabase>('sources',p); } editarSource(id:number,c:Record<string,unknown>){ return this.patch<BkpSourceDatabase>('sources',{idBkpSourceDatabase:id,cambios:c}); } eliminarSource(id:number){ return this.del<BkpSourceDatabase>('sources',id); }
  listarSchedules(q:ListQuery={}){ return this.list<BkpSchedule>('schedules',q); } crearSchedule(p:Partial<BkpSchedule>){ return this.post<BkpSchedule>('schedules',p); } editarSchedule(id:number,c:Record<string,unknown>){ return this.patch<BkpSchedule>('schedules',{idBkpSchedule:id,cambios:c}); } eliminarSchedule(id:number){ return this.del<BkpSchedule>('schedules',id); }

  listarIntegrations(q:ListQuery={}){ return this.list<BkpIntegrationProvider>('integration-providers',q); }
  crearIntegration(p:Partial<BkpIntegrationProvider>){ return this.post<BkpIntegrationProvider>('integration-providers',p); }
  editarIntegration(id:number,c:Record<string,unknown>){ return this.patch<BkpIntegrationProvider>('integration-providers',{idBkpIntegrationProvider:id,cambios:c}); }
  eliminarIntegration(id:number){ return this.del<BkpIntegrationProvider>('integration-providers',id); }

  listarDestinations(q:ListQuery={}){ return this.list<BkpStorageDestination>('storage-destinations',q); } crearDestination(p:Partial<BkpStorageDestination>){ return this.post<BkpStorageDestination>('storage-destinations',p); } editarDestination(id:number,c:Record<string,unknown>){ return this.patch<BkpStorageDestination>('storage-destinations',{idBkpStorageDestination:id,cambios:c}); } eliminarDestination(id:number){ return this.del<BkpStorageDestination>('storage-destinations',id); }
  listarPlans(q:ListQuery={}){ return this.list<BkpPlan>('plans',q); } obtenerPlan(id:number){ return this.get<BkpPlanDetalle>('plans',id); } crearPlan(p:BkpPlanGuardarRequest){ return this.post<BkpPlanDetalle>('plans',p); } editarPlan(id:number,c:Record<string,unknown>){ return this.patch<BkpPlanDetalle>('plans',{idBkpPlan:id,cambios:c}); } reemplazarPlanDestinations(id:number,destinos:number[]){ return this.http.put<ApiEnvelope<BkpPlanDetalle>>(`${this.baseUrl}/plans/${id}/destinations`,destinos); } eliminarPlan(id:number){ return this.del<BkpPlan>('plans',id); }
  listarRuns(q:ListQuery={}){ return this.list<BkpRunResumen>('runs',q); } obtenerRun(id:number){ return this.get<BkpRun>('runs',id); } obtenerRunDetail(id:number){ return this.http.get<ApiEnvelope<BkpRunDetail>>(`${this.baseUrl}/runs/${id}/detail`); } ejecutarPlan(id:number){ return this.http.post<ApiEnvelope<BkpRun>>(`${this.baseUrl}/plans/${id}/run`,{}); }

  listarRestores(q:ListQuery={}){ return this.list<BkpRestoreRun>('restores',q); } obtenerRestore(id:number){ return this.get<BkpRestoreRun>('restores',id); } ejecutarRestore(p:BkpRestoreRequest){ return this.post<BkpRestoreRun>('restores',p); } registrarRestore(p:BkpRestoreRequest){ return this.post<BkpRestoreRun>('restores/register',p); } ejecutarRestoreRegistrado(id:number){ return this.http.post<ApiEnvelope<BkpRestoreRun>>(`${this.baseUrl}/restores/${id}/execute`,{}); }
  listarRetentionRuns(q:ListQuery={}){ return this.list<BkpRetentionRun>('retention-runs',q); } obtenerRetentionRun(id:number){ return this.get<BkpRetentionRun>('retention-runs',id); } ejecutarRetentionTodos(){ return this.http.post<ApiEnvelope<BkpRetentionRun[]>>(`${this.baseUrl}/retention-runs/manual`,{}); } ejecutarRetentionDestino(id:number){ return this.http.post<ApiEnvelope<BkpRetentionRun>>(`${this.baseUrl}/storage-destinations/${id}/retention`,{}); }

  listarContacts(q:ListQuery={}){ return this.list<BkpNotificationContact>('notification-contacts',q); } crearContact(p:Partial<BkpNotificationContact>){ return this.post<BkpNotificationContact>('notification-contacts',p); } editarContact(id:number,c:Record<string,unknown>){ return this.patch<BkpNotificationContact>('notification-contacts',{idBkpNotificationContact:id,cambios:c}); } eliminarContact(id:number){ return this.del<BkpNotificationContact>('notification-contacts',id); }
  listarRules(q:ListQuery={}){ return this.list<BkpNotificationRule>('notification-rules',q); } crearRule(p:Partial<BkpNotificationRule>){ return this.post<BkpNotificationRule>('notification-rules',p); } editarRule(id:number,c:Record<string,unknown>){ return this.patch<BkpNotificationRule>('notification-rules',{idBkpNotificationRule:id,cambios:c}); } eliminarRule(id:number){ return this.del<BkpNotificationRule>('notification-rules',id); }
  listarGeneralConfig(q:ListQuery={}){ return this.list<BkpGeneralConfig>('general-config',q); } crearGeneralConfig(p:Partial<BkpGeneralConfig>){ return this.post<BkpGeneralConfig>('general-config',p); } editarGeneralConfig(id:number,c:Record<string,unknown>){ return this.patch<BkpGeneralConfig>('general-config',{idBkpGeneralConfig:id,cambios:c}); } eliminarGeneralConfig(id:number){ return this.del<BkpGeneralConfig>('general-config',id); }
}
