import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { BkpPageHeaderComponent, BkpEmptyStateComponent } from '../../components/bkp-ui.component';
import { BkpRepository } from '../../data-access/bkp.repository';
import { BkpConfirmService } from '../../services/bkp-confirm.service';
import { PendingChangesAware } from '../../guards/pending-changes.guard';
import { jsonPretty, parseJsonObject } from '../../data-access/bkp.shared';
import { NotifyService } from 'src/app/core/services/notify.service';

@Component({selector:'app-bkp-sources',standalone:true,imports:[CommonModule,FormsModule,ButtonModule,ConfirmDialogModule,InputTextModule,TextareaModule,BkpPageHeaderComponent,BkpEmptyStateComponent],templateUrl:'./sources.component.html',styleUrl:'./sources.component.scss'})
export class BkpSourcesComponent implements OnInit, PendingChangesAware{
  private repo=inject(BkpRepository); private confirm=inject(BkpConfirmService); private notify=inject(NotifyService);
  q=signal(''); loading=signal(false); saving=signal(false); dirty=signal(false); success=signal<string|null>(null); error=signal<string|null>(null); mode=signal<'crear'|'editar'>('crear'); items=signal<any[]>([]); selected=signal<any|null>(null); jsonText=signal('{}'); initial='{}';
  title='Bases origen'; subtitle='Conexiones PostgreSQL/MySQL a respaldar.'; idField='idBkpSourceDatabase';
  ngOnInit(){this.cargar();}
  canDeactivate(){return !this.dirty() || this.confirm.confirmDiscard();}
  cargar(){this.loading.set(true);this.error.set(null);this.this.repo.listarSources(this.q(),0,100,null).pipe(finalize(()=>this.loading.set(false))).subscribe({next:(r:any)=>{this.items.set(r.items??[]); if(!this.selected()&&this.items().length)this.seleccionar(this.items()[0]);},error:e=>this.error.set(e?.message||'No se pudo cargar')});}
  nuevo(){this.mode.set('crear');this.selected.set(null);this.jsonText.set(jsonPretty({"nombre": "ERP Producción", "motor": "POSTGRESQL", "host": "127.0.0.1", "puerto": 5432, "nombreBase": "erp", "nombreSchema": "public", "usuario": "backup_user", "idBkpSecretPasswordFk": null, "sslEnabled": false, "connectionParams": {}, "observacion": "", "activo": true}));this.refresh();}
  seleccionar(item:any){if(this.dirty()){this.confirm.confirmDiscard().then(ok=>ok&&this.hydrate(item));return;}this.hydrate(item);}
  hydrate(item:any){this.mode.set('editar');this.selected.set(item);this.jsonText.set(jsonPretty(item));this.refresh();}
  guardar(){let payload=parseJsonObject(this.jsonText()); const id=Number(this.selected()?.[this.idField]??0); delete (payload as any)[this.idField]; this.saving.set(true); const req=this.mode()==='crear'?this.this.repo.crearSource(payload):this.this.repo.editarSource(id,payload); req.pipe(finalize(()=>this.saving.set(false))).subscribe({next:(res:any)=>{this.notify.success(this.title+' guardado',res.mensaje);this.success.set(res.mensaje);this.dirty.set(false);this.cargar();},error:e=>{this.error.set(e?.message||'No se pudo guardar');this.notify.error('No se pudo guardar',e?.message);}});}
  async eliminar(item=this.selected()){if(!item)return; const ok=await this.confirm.confirmDelete(item.nombre||`${this.title} #${item[this.idField]}`); if(!ok)return; this.saving.set(true); this.this.repo.eliminarSource(Number(item[this.idField])).pipe(finalize(()=>this.saving.set(false))).subscribe({next:(res:any)=>{this.notify.success(this.title+' eliminado',res.mensaje);this.selected.set(null);this.dirty.set(false);this.cargar();},error:e=>this.notify.error('No se pudo eliminar',e?.message)});}
  label(item:any){return item.nombre||item.name||item[this.idField]||'Registro';}
  detail(item:any){return `${item.motor||''} · ${item.host||''}:${item.puerto||''} · ${item.nombreBase||''}`;}
  onJsonChange(v:string){this.jsonText.set(v);this.dirty.set(v!==this.initial);}
  refresh(){this.initial=this.jsonText();this.dirty.set(false);}
}
