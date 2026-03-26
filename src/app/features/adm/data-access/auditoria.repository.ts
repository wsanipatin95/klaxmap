import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import { AuditoriaApi } from './auditoria.api';
import type {
  AuditoriaFormularioFilters,
  AuditoriaFormularioResponse,
  AuditoriaRegistroResponse,
  AuditoriaSupervisorFilters,
  AuditoriaSupervisorResponse,
} from './auditoria.models';

@Injectable({ providedIn: 'root' })
export class AuditoriaRepository {
  private api = inject(AuditoriaApi);

  listarSupervisor(filters: AuditoriaSupervisorFilters = {}) {
    return this.api.listarSupervisor(filters).pipe(
      map((r) => unwrapOrThrow<AuditoriaSupervisorResponse>(r))
    );
  }

  historialRegistro(tabla: string, idRegistro: string | number) {
    return this.api.historialRegistro(tabla, idRegistro).pipe(
      map((r) => unwrapOrThrow<AuditoriaRegistroResponse>(r))
    );
  }

  historialFormulario(filters: AuditoriaFormularioFilters) {
    return this.api.historialFormulario(filters).pipe(
      map((r) => unwrapOrThrow<AuditoriaFormularioResponse>(r))
    );
  }
}