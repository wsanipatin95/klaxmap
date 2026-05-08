import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
@Injectable({providedIn:'root'})
export class BkpConfirmService{
  private confirmation=inject(ConfirmationService);
  confirmDelete(label:string){return this.confirm('Confirmar eliminación',`¿Seguro que deseas eliminar ${label}?`,'Eliminar','p-button-danger','pi pi-trash');}
  confirmRun(label:string){return this.confirm('Ejecutar backup',`¿Seguro que deseas ejecutar ahora ${label}?`,'Ejecutar','p-button-success','pi pi-play');}
  confirmDiscard(){return this.confirm('Cambios pendientes','Tienes cambios sin guardar. ¿Deseas salir sin guardar?','Salir sin guardar','p-button-warning','pi pi-question-circle','Seguir editando');}
  private confirm(header:string,message:string,acceptLabel:string,acceptButtonStyleClass:string,icon:string,rejectLabel='Cancelar'):Promise<boolean>{return new Promise(resolve=>this.confirmation.confirm({header,message,icon,acceptLabel,rejectLabel,acceptButtonStyleClass,accept:()=>resolve(true),reject:()=>resolve(false)}));}
}
