import { inject, Injectable } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { AuthApi } from 'src/app/features/seg/data-access/auth.api';
import { SessionStore } from 'src/app/features/seg/store/session.store';

/**
 * Renovación del access token con single-flight: si llegan varios 401 a la vez,
 * solo se dispara UN /refresh y todos esperan el mismo resultado.
 */
@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private api = inject(AuthApi);
  private session = inject(SessionStore);

  private pending: Observable<string> | null = null;

  refresh(): Observable<string> {
    if (this.pending) {
      return this.pending;
    }
    const rt = this.session.session()?.refreshToken;
    if (!rt) {
      return throwError(() => new Error('Sin refresh token'));
    }

    this.pending = this.api.refresh(rt).pipe(
      map((r) => r.token),
      tap((token) => this.session.patchSession({ token })),
      finalize(() => { this.pending = null; }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.pending;
  }
}
