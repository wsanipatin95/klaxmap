import { HttpParams } from '@angular/common/http';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';

export type Paged<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  mode?: 'PAGED' | 'ALL';
  total?: number;
};

export type CrudPatchRequest = {
  id: number;
  cambios: Record<string, unknown>;
};

export type ListQuery = {
  q?: string | null;
  page?: number;
  size?: number;
  all?: boolean;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

export type WorkflowResult<T = unknown> = { data: T; mensaje: string };
export type Envelope<T> = ApiEnvelope<T>;

export function buildListParams(query: ListQuery = {}): HttpParams {
  let params = new HttpParams();

  if (query.q != null && String(query.q).trim() !== '') {
    params = params.set('q', String(query.q).trim());
  }
  if (query.page != null) params = params.set('page', query.page);
  if (query.size != null) params = params.set('size', query.size);
  if (query.all != null) params = params.set('all', query.all);

  Object.entries(query.extra ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && `${value}` !== '') {
      params = params.set(key, value as string | number | boolean);
    }
  });

  return params;
}

export function toIsoDateInput(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value);
  return raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10);
}

export function toTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return `${trimmed} 00:00:00`;
}

export function emptyPaged<T>(): Paged<T> {
  return {
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  };
}
