import { HttpParams } from '@angular/common/http';
import { ApiEnvelope } from 'src/app/core/api/api-envelope';

export type Paged<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number; hasNext: boolean; hasPrevious: boolean; mode?: 'PAGED'|'ALL'; total?: number; };
export type ListQuery = { q?: string|null; page?: number; size?: number; all?: boolean; activo?: boolean|null; status?: string|null; extra?: Record<string,string|number|boolean|null|undefined>; };
export type CrudResult<T> = { data: T; mensaje: string; };

export function buildListParams(q: ListQuery = {}) {
  let p = new HttpParams();
  if (q.q != null && String(q.q).trim()) p = p.set('q', String(q.q).trim());
  if (q.page != null) p = p.set('page', q.page);
  if (q.size != null) p = p.set('size', q.size);
  if (q.all != null) p = p.set('all', q.all);
  if (q.activo != null) p = p.set('activo', q.activo);
  if (q.status != null && String(q.status).trim()) p = p.set('status', String(q.status).trim());
  Object.entries(q.extra ?? {}).forEach(([k,v]) => { if (v !== null && v !== undefined && `${v}` !== '') p = p.set(k, v); });
  return p;
}

export function unwrapOrThrow<T>(res: ApiEnvelope<T>): T {
  if (!res || (res as ApiEnvelope<T>).codigo !== 0) throw new Error((res as ApiEnvelope<T>)?.mensaje || 'Error de operación');
  return (res as ApiEnvelope<T>).data;
}

export function unwrapWithMsg<T>(res: ApiEnvelope<T>): CrudResult<T> {
  if (!res || (res as ApiEnvelope<T>).codigo !== 0) throw new Error((res as ApiEnvelope<T>)?.mensaje || 'Error de operación');
  return { data: (res as ApiEnvelope<T>).data, mensaje: (res as ApiEnvelope<T>).mensaje || 'Operación realizada' };
}

export function emptyPaged<T>(): Paged<T> { return { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false }; }

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

export function parseJsonObjectStrict(value: unknown, label = 'JSON'): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} debe ser un objeto`);
    return parsed as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'JSON inválido';
    throw new Error(`${label} inválido: ${msg}`);
  }
}

export function parseJsonArrayStrict(value: unknown, label = 'JSON'): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) throw new Error(`${label} debe ser un arreglo`);
    return parsed as unknown[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'JSON inválido';
    throw new Error(`${label} inválido: ${msg}`);
  }
}

export function jsonPretty(value: unknown) { try { return JSON.stringify(value ?? {}, null, 2); } catch { return '{}'; } }
export function fmtBytes(value?: number|null) { const n = Number(value ?? 0); if (!n) return '0 B'; const u=['B','KB','MB','GB','TB']; let i=0,s=n; while(s>=1024&&i<u.length-1){s/=1024;i++;} return `${s.toFixed(s>=10||i===0?0:1)} ${u[i]}`; }
export function fmtDate(value?: string|null) { if (!value) return '-'; try { return new Date(value).toLocaleString(); } catch { return String(value); } }
