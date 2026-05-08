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
@Component({selector:'app-bkp-secrets',standalone:true,imports:[CommonModule,FormsModule,ButtonModule,ConfirmDialogModule,InputTextModule,TextareaModule,BkpPageHeaderComponent,BkpEmptyStateComponent],templateUrl:'./secrets.component.html',styleUrl:'./secrets.component.scss'})
export class BkpSecretsComponent implements OnInit,PendingChangesAware{private repo=inject(BkpRepository);private confirm=inject(BkpConfirmService);private notify=inject(NotifyService);q=signal('');loading=signal(false);saving=signal(false);dirty=signal(false);items=signal<any[]>([]);selected=signal<any|null>(null);jsonText=signal('{}');valorPlano=signal('');confirmarValor=signal('');initial='{}';ngOnInit(){this.cargar();}canDeactivate(){return !this.dirty()||this.confirm.confirmDiscard();}cargar(){this.loading.set(true);this.repo.listarSecrets(this.q(),0,100,null).pipe(finalize(()=>this.loading.set(false))).subscribe({next:r=>this.items.set(r.items??[]),error:e=>this.notify.error('No se pudo cargar secretos',e?.message)});}nuevo(){this.selected.set(null);this.valorPlano.set('');this.confirmarValor.set('');this.jsonText.set(jsonPretty({nombre:'Password PostgreSQL',tipoSecret:'DB_PASSWORD',algoritmo:'AES_GCM',descripcion:'',activo:true}));this.refresh();}seleccionar(i:any){this.selected.set(i);this.valorPlano.set('');this.confirmarValor.set('');this.jsonText.set(jsonPretty(i));this.refresh();}guardar(){if(this.valorPlano()!==this.confirmarValor()){this.notify.warn('Confirmación inválida','Los valores no coinciden');return;}const cambios=parseJsonObject(this.jsonText());delete (cambios as any).idBkpSecret;const id=Number(this.selected()?.idBkpSecret??0);this.saving.set(true);const req=id?this.repo.editarSecret({idBkpSecret:id,valorPlano:this.valorPlano()||null,cambios}):this.repo.crearSecret({...cambios as any,valorPlano:this.valorPlano()});req.pipe(finalize(()=>this.saving.set(false))).subscribe({next:r=>{this.notify.success('Secreto guardado',r.mensaje);this.dirty.set(false);this.valorPlano.set('');this.confirmarValor.set('');this.cargar();},error:e=>this.notify.error('No se pudo guardar',e?.message)});}onChange(v:string){this.jsonText.set(v);this.dirty.set(v!==this.initial||!!this.valorPlano()||!!this.confirmarValor());}refresh(){this.initial=this.jsonText();this.dirty.set(false);}}
