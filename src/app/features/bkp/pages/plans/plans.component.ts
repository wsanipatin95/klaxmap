import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, finalize, switchMap, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BkpPageHeaderComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { jsonPretty, parseJsonObjectStrict } from '../../data-access/bkp.shared';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({selector:'app-bkp-plans',standalone:true,imports:[CommonModule,FormsModule,ButtonModule,ConfirmDialogModule,InputTextModule,TextareaModule,BkpPageHeaderComponent],templateUrl:'./plans.component.html',styleUrl:'./plans.component.scss'})
export class BkpPlansComponent implements OnInit,PendingChangesAware{
  private repo=inject(BkpRepository);private confirm=inject(BkpConfirmService);private notify=inject(NotifyService);
  q=signal('');loading=signal(false);saving=signal(false);running=signal(false);dirty=signal(false);plans=signal<any[]>([]);sources=signal<any[]>([]);agents=signal<any[]>([]);schedules=signal<any[]>([]);destinations=signal<any[]>([]);secrets=signal<any[]>([]);selected=signal<any|null>(null);jsonText=signal('{}');initial='{}';
  ngOnInit(){this.cargar();}
  canDeactivate(){return !this.dirty()||this.confirm.confirmDiscard();}
  cargar(){this.loading.set(true);forkJoin({plans:this.repo.listarPlans(this.q(),0,100,null),sources:this.repo.listarSources('',0,100,true),agents:this.repo.listarAgents('',0,100,true),schedules:this.repo.listarSchedules('',0,100,true),destinations:this.repo.listarDestinations('',0,100,true),secrets:this.repo.listarSecrets('',0,200,true)}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:(r:any)=>{this.plans.set(r.plans.items??[]);this.sources.set(r.sources.items??[]);this.agents.set(r.agents.items??[]);this.schedules.set(r.schedules.items??[]);this.destinations.set(r.destinations.items??[]);this.secrets.set(r.secrets.items??[]);},error:(e:any)=>this.notify.error('No se pudo cargar planes',e?.message)});}
  nuevo(){this.selected.set(null);this.jsonText.set(jsonPretty({nombre:'Backup diario ERP',idBkpSourceDatabaseFk:null,idBkpScheduleFk:null,idBkpAgentNodeFk:null,tipoBackup:'LOGICAL_FULL',formatoSalida:'CUSTOM',compressionEnabled:true,compressionType:'GZIP',encryptionEnabled:false,idBkpSecretEncryptionFk:null,verifyAfterBackup:true,calculateChecksum:true,localRetentionDays:7,maxRuntimeMinutes:120,activo:true,scope:{scopeType:'FULL',includeOwner:false,includePrivileges:false,configJson:{},tableFilters:[]},destinationIds:[]}));this.refresh();}
  seleccionar(p:any){this.selected.set(p);this.repo.obtenerPlan(p.idBkpPlan).subscribe({next:(d:any)=>{this.jsonText.set(jsonPretty({...(d.plan??p),scope:(d.scopes??[])[0]??{scopeType:'FULL'},destinationIds:(d.destinations??[]).filter((x:any)=>x.activo!==false).map((x:any)=>x.idBkpStorageDestinationFk)}));this.refresh();},error:()=>{this.jsonText.set(jsonPretty(p));this.refresh();}});}
  guardar(){
    let payload:any; try{payload=parseJsonObjectStrict(this.jsonText(),'Plan');}catch(e){this.notify.error('JSON inválido',e instanceof Error?e.message:'JSON inválido');return;}
    const id=Number(this.selected()?.idBkpPlan??payload.idBkpPlan??0);
    if(!payload.nombre||!payload.idBkpSourceDatabaseFk||!payload.idBkpAgentNodeFk){this.notify.warn('Datos requeridos','Nombre, origen y agente son obligatorios.');return;}
    if(payload.encryptionEnabled===true&&!payload.idBkpSecretEncryptionFk){this.notify.warn('Secreto de cifrado requerido','Si encryptionEnabled=true debes seleccionar idBkpSecretEncryptionFk.');return;}
    const destinationIds=Array.isArray(payload.destinationIds)?payload.destinationIds.map((x:any)=>Number(x)).filter((x:number)=>Number.isFinite(x)):[];
    delete payload.idBkpPlan; const scope=payload.scope; delete payload.scope; delete payload.destinationIds;
    const createPayload={...payload,scope,destinationIds};
    this.saving.set(true);
    const req:any=id?this.repo.editarPlan(id,payload).pipe(switchMap(()=>this.repo.reemplazarPlanDestinations(id,destinationIds))):this.repo.crearPlan(createPayload).pipe(switchMap((r:any)=>{const newId=Number(r.data?.plan?.idBkpPlan??0);return newId?this.repo.reemplazarPlanDestinations(newId,destinationIds):of(r);}));
    req.pipe(finalize(()=>this.saving.set(false))).subscribe({next:(r:any)=>{this.notify.success('Plan guardado',r.mensaje);this.dirty.set(false);this.cargar();},error:(e:any)=>this.notify.error('No se pudo guardar',e?.message)});
  }
  async ejecutar(){const id=Number(this.selected()?.idBkpPlan??0); if(!id)return; if(this.dirty()){this.notify.warn('Cambios pendientes','Guarda o descarta antes de ejecutar.');return;} const ok=await this.confirm.confirmRun(this.selected()?.nombre||`plan #${id}`); if(!ok)return; this.running.set(true);this.repo.ejecutarPlan(id).pipe(finalize(()=>this.running.set(false))).subscribe({next:(r:any)=>this.notify.success('Backup ejecutado',r.mensaje),error:(e:any)=>this.notify.error('No se pudo ejecutar',e?.message)});}
  onChange(v:string){this.jsonText.set(v);this.dirty.set(v!==this.initial);}
  refresh(){this.initial=this.jsonText();this.dirty.set(false);}
  sourceLabel(id:number){const s=this.sources().find(x=>x.idBkpSourceDatabase===id);return s?`${s.nombre} · ${s.motor}`:'-';}
}
