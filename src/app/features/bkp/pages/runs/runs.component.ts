import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { BkpPageHeaderComponent, BkpStatusBadgeComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpRunDetail, BkpRunResumen } from '../../data-access/bkp.models';
import { fmtBytes, fmtDate, jsonPretty } from '../../data-access/bkp.shared';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({selector:'app-bkp-runs',standalone:true,imports:[CommonModule,FormsModule,ButtonModule,BkpPageHeaderComponent,BkpStatusBadgeComponent],templateUrl:'./runs.component.html',styleUrl:'./runs.component.scss'})
export class BkpRunsComponent implements OnInit{
  private repo=inject(BkpRepository); private notify=inject(NotifyService);
  q=signal(''); status=signal(''); loading=signal(false); runs=signal<BkpRunResumen[]>([]); selected=signal<BkpRunDetail|null>(null);
  filters=['','PENDING','RUNNING','SUCCESS','FAILED','PARTIAL_SUCCESS','CANCELLED'];
  ngOnInit(){this.cargar();}
  cargar(){this.loading.set(true);this.repo.listarRuns(this.q(),0,100,this.status()||null).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>{this.runs.set(r.items??[]); if(!this.selected()&&this.runs().length)this.seleccionar(this.runs()[0]);},error:e=>this.notify.error('No se pudo cargar ejecuciones',e?.message)});}
  seleccionar(r:BkpRunResumen){this.repo.obtenerRunDetail(r.idBkpRun).subscribe({next:x=>this.selected.set(x),error:e=>{this.notify.warn('No se pudo cargar detalle',e?.message);this.selected.set({run:r as any,uploads:[],notifications:[]});}});}
  fmtBytes=fmtBytes; fmtDate=fmtDate; jsonPretty=jsonPretty;
}
