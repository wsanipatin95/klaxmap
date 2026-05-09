import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { BkpPageHeaderComponent, BkpEmptyStateComponent, BkpStatusBadgeComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpPlan, BkpRunResumen, BkpSourceDatabase, BkpStorageDestination } from '../../data-access/bkp.models';
import { fmtBytes, fmtDate } from '../../data-access/bkp.shared';

@Component({selector:'app-bkp-dashboard',standalone:true,imports:[CommonModule,ButtonModule,BkpPageHeaderComponent,BkpEmptyStateComponent,BkpStatusBadgeComponent],templateUrl:'./dashboard.component.html',styleUrl:'./dashboard.component.scss'})
export class BkpDashboardComponent implements OnInit{
  private repo=inject(BkpRepository); private router=inject(Router);
  loading=signal(false); error=signal<string|null>(null); plans=signal<BkpPlan[]>([]); sources=signal<BkpSourceDatabase[]>([]); destinations=signal<BkpStorageDestination[]>([]); runs=signal<BkpRunResumen[]>([]);
  activePlans=computed(()=>this.plans().filter(x=>x.activo!==false).length); failedRuns=computed(()=>this.runs().filter(x=>x.status==='FAILED').length); runningRuns=computed(()=>this.runs().filter(x=>x.status==='RUNNING').length);
  ngOnInit(){this.cargar();}
  cargar(){this.loading.set(true);this.error.set(null);forkJoin({plans:this.repo.listarPlans('',0,100,true),sources:this.repo.listarSources('',0,100,true),destinations:this.repo.listarDestinations('',0,100,true),runs:this.repo.listarRuns('',0,20,null)}).pipe(finalize(()=>this.loading.set(false))).subscribe({next:(r:any)=>{this.plans.set(r.plans.items??[]);this.sources.set(r.sources.items??[]);this.destinations.set(r.destinations.items??[]);this.runs.set(r.runs.items??[]);},error:(e:any)=>this.error.set(e?.message||'No se pudo cargar dashboard')});}
  go(r:string){this.router.navigate([r]);} fmtBytes=fmtBytes; fmtDate=fmtDate;
}
