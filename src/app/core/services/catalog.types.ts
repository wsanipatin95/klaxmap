export type CatalogOption = { label: string; value: string };

export type CatalogSearchRequest = {
    q?: string;
    page?: number;
    size?: number;
    filters?: any;
    soloDetalle?: boolean;
    valueField?: string;
    labelField?: string;
    labelBuilder?: (row: any) => string;
    cache?: boolean;
    endpoint?: string;
};
