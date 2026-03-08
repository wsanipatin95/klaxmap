import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';
import { unwrapOrThrow, unwrapWithMsg, type ApiEnvelope } from 'src/app/core/api/api-envelope';
import type {
    TaxDocumentoCrearRequest,
    TaxDocumentoDto,
    TaxDocumentoEditarRequest,
} from './tax-documento.models';

type ListarTaxDocumentoData = { items: TaxDocumentoDto[] };

@Injectable({ providedIn: 'root' })
export class TaxDocumentoRepository {
    private http = inject(HttpClient);
    private env = inject(ENVIRONMENT);

    listar(cen: number) {
        const params = new HttpParams().set('cen', String(cen));

        return this.http
            .get<ApiEnvelope<ListarTaxDocumentoData>>(
                `${this.env.apiBaseUrl}/api/erp/tax-documento/listar`,
                { params }
            )
            .pipe(map((r) => unwrapOrThrow<ListarTaxDocumentoData>(r).items ?? []));
    }

    crear(req: TaxDocumentoCrearRequest) {
        return this.http
            .post<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/tax-documento/crear`, req)
            .pipe(map((r) => unwrapWithMsg<any>(r)));
    }

    editar(req: TaxDocumentoEditarRequest) {
        return this.http
            .patch<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/tax-documento/editar`, req)
            .pipe(map((r) => unwrapWithMsg<any>(r)));
    }

    eliminar(id: number) {
        const params = new HttpParams().set('id', String(id));

        return this.http
            .delete<ApiEnvelope<any>>(`${this.env.apiBaseUrl}/api/erp/tax-documento/eliminar`, { params })
            .pipe(map((r) => unwrapWithMsg<any>(r)));
    }
}
