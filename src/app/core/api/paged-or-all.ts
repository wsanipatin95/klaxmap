// src/app/core/api/paged-or-all.ts

export type PagedResult<T> = {
    mode: 'PAGED';
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    items: T[];
};

export type AllResult<T> = {
    mode: 'ALL';
    total: number;
    items: T[];
};

export type PagedOrAll<T> = PagedResult<T> | AllResult<T>;

export function totalOf<T>(r: PagedOrAll<T>): number {
    return r.mode === 'ALL' ? Number(r.total ?? 0) : Number(r.totalElements ?? 0);
}

export function itemsOf<T>(r: PagedOrAll<T>): T[] {
    return Array.isArray(r.items) ? r.items : [];
}
