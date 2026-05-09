import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { BkpPageHeaderComponent, BkpStatusBadgeComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { fmtBytes, fmtDate } from '../../data-access/bkp.shared';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({selector:'app-bkp-dashboard',standalone:true,imports:[CommonModule,ButtonModule,BkpPageHeaderComponent,BkpStatusBadgeComponent],templateUrl:'./dashboard.component.html',styleUrl:'./dashboard.component.scss'})
export class BkpDashboardComponent implements OnInit{
  private repo=inject(BkpRepository); private notify=inject(NotifyService);
  loading=signal(false); plans=signal<any[]>([]); sources=signal<any[]>([]); destinations=signal<any[]>([]); runs=signal<any[]>([]); warnings=signal<string[]>([]);
  ngOnInit(){this.cargar();}
  cargar(){this.loading.set(true);this.warnings.set([]);forkJoin({plans:this.repo.listarPlans('',0,20,null).pipe(catchError(e=>this.fail('planes',e))),sources:this.repo.listarSources('',0,20,null).pipe(catchError(e=>this.fail('orígenes',e))),destinations:this.repo.listarDestinations('',0,20,null).pipe(catchError(e=>this.fail('destinos',e))),runs:this.repo.listarRuns('',0,10,null).pipe(catchError(e=>this.fail('ejecuciones',e)))}).pipe(finalize(()=>this.loading.set(false))).subscribe(r=>{this.plans.set((r.plans as any).items??[]);this.sources.set((r.sources as any).items??[]);this.destinations.set((r.destinations as any).items??[]);this.runs.set((r.runs as any).items??[]);});}
  private fail(label:string,e:any){const msg=e?.message||'Error desconocido';this.warnings.update(x=>[...x,`No se pudo cargar ${label}: ${msg}`]);this.notify.warn(`No se pudo cargar ${label}`,msg);return of({items:[]});}
  activeCount(items:any[]){return items.filter(x=>x?.activo!==false).length;} fmtBytes=fmtBytes; fmtDate=fmtDate;
}