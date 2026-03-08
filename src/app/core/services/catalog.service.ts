import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ENVIRONMENT } from 'src/app/core/config/environment.token';

export type CatalogOption = { label: string; value: string };

export type CatalogSpec = {
  key: string;
  mode?: 'select' | 'radio' | 'checkbox' | 'autocomplete';
  soloDetalle?: boolean;
  filters?: any;
  size?: number;
  page?: number;

  /**
   * 'auto'  -> decide según si hay filters o mode autocomplete
   * 'get'   -> GET /catalogos/{key}
   * 'post'  -> POST /catalogos/{key}/search
   */
  transport?: 'auto' | 'get' | 'post';

  /**
   * Base endpoint path (sin apiBaseUrl)
   * default: /api/erp/catalogos
   */
  basePath?: string;

  cache?: boolean;
};

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private env = inject(ENVIRONMENT);

  private cache = new Map<string, Observable<CatalogOption[]>>();

  /**
   * API soportadas:
   * 1) GET  {apiBaseUrl}/api/erp/catalogos/{key}?q=&page=&size=&soloDetalle=
   * 2) POST {apiBaseUrl}/api/erp/catalogos/{key}/search  body: {q,page,size,soloDetalle,filters}
   */
  search(key: string, q: string, spec: CatalogSpec): Observable<CatalogOption[]> {
    const basePath = (spec.basePath ?? '/api/erp/catalogos').replace(/\/$/, '');
    const safeKey = encodeURIComponent(key);

    const page = spec.page ?? 0;
    const size = spec.size ?? 10;
    const soloDetalle = !!spec.soloDetalle;
    const filters = spec.filters ?? null;

    const transport = this.pickTransport(spec, q);

    const cacheKey = this.makeCacheKey(
      this.env.apiBaseUrl,
      basePath,
      key,
      transport,
      q,
      page,
      size,
      soloDetalle,
      filters
    );
    const useCache = spec.cache !== false;

    if (useCache && this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    let obs$: Observable<any>;

    if (transport === 'post') {
      const url = `${this.env.apiBaseUrl}${basePath}/${safeKey}/search`;
      const body = { q: q ?? '', page, size, soloDetalle, filters };
      obs$ = this.http.post<any>(url, body);
    } else {
      const url = `${this.env.apiBaseUrl}${basePath}/${safeKey}`;
      const params = new HttpParams()
        .set('q', q ?? '')
        .set('page', String(page))
        .set('size', String(size))
        .set('soloDetalle', String(soloDetalle));
      obs$ = this.http.get<any>(url, { params });
    }

    const mapped$ = obs$.pipe(
      map((resp) => this.extractItems(resp)),
      map((rows) => this.normalizeOptions(rows)),
      shareReplay(1)
    );

    if (useCache) this.cache.set(cacheKey, mapped$);
    return mapped$;
  }

  clearCache() {
    this.cache.clear();
  }

  private pickTransport(spec: CatalogSpec, q: string): 'get' | 'post' {
    const forced = spec.transport ?? 'auto';
    if (forced === 'get') return 'get';
    if (forced === 'post') return 'post';

    // auto:
    const hasFilters = spec.filters != null && Object.keys(spec.filters || {}).length > 0;
    const isAuto = (spec.mode ?? '') === 'autocomplete';
    const hasQuery = (q ?? '').trim().length > 0;

    if (hasFilters || isAuto || hasQuery) return 'post';
    return 'get';
  }

  private makeCacheKey(
    base: string,
    basePath: string,
    key: string,
    transport: string,
    q: string,
    page: number,
    size: number,
    soloDetalle: boolean,
    filters: any
  ) {
    const f = filters ? JSON.stringify(filters) : '';
    return `${base}${basePath}::${key}::${transport}::${q}::${page}::${size}::${soloDetalle ? 1 : 0}::${f}`;
  }

  private extractItems(resp: any): any[] {
    // tu API: {codigo,mensaje,data:{items:[{label,value}]}}
    if (!resp) return [];
    if (Array.isArray(resp?.data?.items)) return resp.data.items;
    if (Array.isArray(resp?.items)) return resp.items;
    if (Array.isArray(resp?.data)) return resp.data;
    if (Array.isArray(resp)) return resp;
    return [];
  }

  private normalizeOptions(rows: any[]): CatalogOption[] {
    const arr = Array.isArray(rows) ? rows : [];
    return arr
      .map((x) => ({ label: String(x?.label ?? ''), value: String(x?.value ?? '') }))
      .filter((x) => x.label.trim().length > 0 && x.value.trim().length > 0);
  }
}
