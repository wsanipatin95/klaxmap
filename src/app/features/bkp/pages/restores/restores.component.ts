import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BkpPageHeaderComponent, BkpStatusBadgeComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpAgentNode, BkpRestoreRequest, BkpRestoreRun, BkpRunResumen, BkpSecret } from '../../data-access/bkp.models';
import { fmtDate, jsonPretty } from '../../data-access/bkp.shared';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({selector:'app-bkp-restores',standalone:true,imports:[CommonModule,ReactiveFormsModule,ButtonModule,ConfirmDialogModule,BkpPageHeaderComponent,BkpStatusBadgeComponent],templateUrl:'./restores.component.html',styleUrl:'./restores.component.scss'})
export class BkpRestoresComponent implements OnInit,PendingChangesAware{
  private repo=inject(BkpRepository); private confirm=inject(BkpConfirmService); private notify=inject(NotifyService); private fb=inject(FormBuilder);
  loading=signal(false); saving=signal(false); dirty=signal(false); runs=signal<BkpRunResumen[]>([]); agents=signal<BkpAgentNode[]>([]); secrets=signal<BkpSecret[]>([]); restores=signal<BkpRestoreRun[]>([]); selected=signal<BkpRestoreRun|null>(null);
  form=this.fb.group({idBkpRun:[null as number|null,Validators.required],idBkpAgentNode:[null as number|null],restoreType:['TEST',Validators.required],targetHost:[''],targetPort:[null as number|null],targetDatabase:['',Validators.required],targetSchema:[''],targetUsuario:[''],idBkpSecretPassword:[null as number|null],cleanBeforeRestore:[false],extraRestoreArgs:['']});
  ngOnInit(){this.form.valueChanges.subscribe(()=>this.dirty.set(true));this.cargar();}
  canDeactivate(){return !this.dirty()||this.confirm.confirmDiscard();}
  cargar(){this.loading.set(true);forkJoin({runs:this.repo.listarRuns('',0,100,'SUCCESS'),agents:this.repo.listarAgents('',0,100,true),secrets:this.repo.listarSecrets('',0,200,true),restores:this.repo.listarRestores('',0,100,null)}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.runs.set(r.runs.items??[]);this.agents.set(r.agents.items??[]);this.secrets.set(r.secrets.items??[]);this.restores.set(r.restores.items??[]);},error:e=>this.notify.error('No se pudo cargar restauraciones',e?.message)});}
  nuevo(){this.selected.set(null);this.form.reset({idBkpRun:null,idBkpAgentNode:null,restoreType:'TEST',targetHost:'',targetPort:null,targetDatabase:'',targetSchema:'',targetUsuario:'',idBkpSecretPassword:null,cleanBeforeRestore:false,extraRestoreArgs:''});this.dirty.set(false);}
  seleccionar(x:BkpRestoreRun){this.selected.set(x);this.form.patchValue({idBkpRun:x.idBkpRunFk,idBkpAgentNode:x.idBkpAgentNodeFk??null,restoreType:x.restoreType??'TEST',targetHost:x.targetHost??'',targetPort:x.targetPort??null,targetDatabase:x.targetDatabase??'',targetSchema:x.targetSchema??''});this.dirty.set(false);}
  private build():BkpRestoreRequest|null{this.form.markAllAsTouched();if(this.form.invalid)return null;const v=this.form.getRawValue();return{idBkpRun:Number(v.idBkpRun),idBkpAgentNode:v.idBkpAgentNode??null,restoreType:v.restoreType??'TEST',targetHost:v.targetHost||null,targetPort:v.targetPort??null,targetDatabase:v.targetDatabase||null,targetSchema:v.targetSchema||null,targetUsuario:v.targetUsuario||null,idBkpSecretPassword:v.idBkpSecretPassword??null,cleanBeforeRestore:v.cleanBeforeRestore??false,extraRestoreArgs:v.extraRestoreArgs||null};}
  async ejecutar(){const req=this.build();if(!req)return;if(req.restoreType==='REAL'&&!(await this.confirm.confirmRestoreReal(req.targetDatabase||`run ${req.idBkpRun}`)))return;this.saving.set(true);this.repo.ejecutarRestore(req).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.notify.success('Restore ejecutado',r.mensaje);this.dirty.set(false);this.cargar();},error:e=>this.notify.error('No se pudo ejecutar restore',e?.message)});}
  registrar(){const req=this.build();if(!req)return;this.saving.set(true);this.repo.registrarRestore(req).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.notify.success('Restore registrado',r.mensaje);this.dirty.set(false);this.cargar();},error:e=>this.notify.error('No se pudo registrar restore',e?.message)});}
  async ejecutarRegistrado(x=this.selected()){if(!x)return;if(x.restoreType==='REAL'&&!(await this.confirm.confirmRestoreReal(x.targetDatabase||`restore #${x.idBkpRestoreRun}`)))return;this.saving.set(true);this.repo.ejecutarRestoreRegistrado(x.idBkpRestoreRun).pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.notify.success('Restore ejecutado',r.mensaje);this.cargar();},error:e=>this.notify.error('No se pudo ejecutar restore',e?.message)});}
  runLabel(id?:number|null){const r=this.runs().find(x=>x.idBkpRun===id);return r?`#${r.idBkpRun} · ${r.planNombre} · ${r.fileName||''}`:`#${id}`;} fmtDate=fmtDate; jsonPretty=jsonPretty;
}