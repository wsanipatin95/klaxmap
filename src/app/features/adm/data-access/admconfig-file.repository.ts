import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { unwrapWithMsg } from 'src/app/core/api/api-envelope';
import { AdmConfigFileApi } from './admconfig-file.api';

@Injectable({ providedIn: 'root' })
export class AdmConfigFileRepository {
    private api = inject(AdmConfigFileApi);

    uploadUnico(payload: { modulo: string; parametro: string; file: File }) {
        return this.api.uploadUnico(payload).pipe(
            map((r) => unwrapWithMsg<any>(r)),
        );
    }

    downloadByParametro(parametro: string) {
        return this.api.downloadByParametro(parametro);
    }
}
