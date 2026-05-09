import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { BkpPageHeaderComponent, BkpEmptyStateComponent, BkpStatusBadgeComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { fmtBytes, fmtDate } from '../../data-access/bkp.shared';
@Component({selector:'app-bkp-runs',standalone:true,imports:[CommonModule,FormsModule,ButtonModule,InputTextModule,BkpPageHeaderComponent,BkpEmptyStateComponent,BkpStatusBadgeComponent],templateUrl:'./runs.component.html',styleUrl:'./runs.component.scss'})
export class BkpRunsComponent implements OnInit{private repo=inject(BkpRepository);q=signal('');status=signal('');loading=signal(false);runs=signal<any[]>([]);selected=signal<any|null>(null);filters=['','PENDING','RUNNING','SUCCESS','FAILED','PARTIAL_SUCCESS','CANCELLED'];ngOnInit(){this.cargar();}cargar(){this.loading.set(true);this.repo.listarRuns(this.q(),0,100,this.status()||null).pipe(finalize(()=>this.loading.set(false))).subscribe({next:(r:any)=>{this.runs.set(r.items??[]);if(!this.selected()&&this.runs().length)this.seleccionar(this.runs()[0]);}});}seleccionar(r:any){this.repo.obtenerRun(r.idBkpRun).subscribe({next:(x:any)=>this.selected.set(x),error:()=>this.selected.set(r)});}fmtBytes=fmtBytes;fmtDate=fmtDate;}
