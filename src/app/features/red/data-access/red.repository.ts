import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { unwrapOrThrow } from 'src/app/core/api/api-envelope';
import { RedApi } from './red.api';
import type { RedIndicador } from './red.models';

@Injectable({ providedIn: 'root' })
export class RedRepository {
  private api = inject(RedApi);

  indicadores() {
    return this.api.indicadores().pipe(map((r) => unwrapOrThrow<RedIndicador[]>(r)));
  }
}
