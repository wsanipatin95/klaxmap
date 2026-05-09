import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { BkpPageHeaderComponent, BkpStatusBadgeComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpRetentionRun, BkpStorageDestination } from '../../data-access/bkp.models';
import { fmtBytes, fmtDate, jsonPretty } from '../../data-access/bkp.shared';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({selector:'app-bkp-retention',standalone:true,imports:[CommonModule,ButtonModule,ConfirmDialogModule,BkpPageHeaderComponent,BkpStatusBadgeComponent],templateUrl:'./retention.component.html',styleUrl:'./retention.component.scss'})
export class BkpRetentionComponent implements OnInit{
  private repo=inject(BkpRepository); private confirm=inject(BkpConfirmService); private notify=inject(NotifyService);
  loading=signal(false); running=signal(false); destinations=signal<BkpStorageDestination[]>([]); runs=signal<BkpRetentionRun[]>([]); selected=signal<BkpRetentionRun|null>(null);
  ngOnInit(){this.cargar();}
  cargar(){this.loading.set(true);forkJoin({destinations:this.repo.listarDestinations('',0,100,true),runs:this.repo.listarRetentionRuns('',0,100,null)}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.destinations.set(r.destinations.items??[]);this.runs.set(r.runs.items??[]);},error:e=>this.notify.error('No se pudo cargar retención',e?.message)});}
  async ejecutarDestino(d:BkpStorageDestination){if(!(await this.confirm.confirmRetention(d.nombre)))return;this.running.set(true);this.repo.ejecutarRetentionDestino(d.idBkpStorageDestination).pipe(finalize(()=>this.running.set(false))).subscribe({next:r=>{this.notify.success('Retención ejecutada',r.mensaje);this.cargar();},error:e=>this.notify.error('No se pudo ejecutar retención',e?.message)});}
  async ejecutarTodos(){if(!(await this.confirm.confirmRetention('todos los destinos')))return;this.running.set(true);this.repo.ejecutarRetentionTodos().pipe(finalize(()=>this.running.set(false))).subscribe({next:r=>{this.notify.success('Retención ejecutada',r.mensaje);this.cargar();},error:e=>this.notify.error('No se pudo ejecutar retención',e?.message)});}
  destinoLabel(id?:number|null){return this.destinations().find(x=>x.idBkpStorageDestination===id)?.nombre??(id?`Destino #${id}`:'Todos');} fmtBytes=fmtBytes; fmtDate=fmtDate; jsonPretty=jsonPretty;
}