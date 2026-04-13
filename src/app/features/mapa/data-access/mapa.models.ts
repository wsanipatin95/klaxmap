export type MapaGeomTipo = 'point' | 'linestring' | 'polygon';

export type MapaMetadataPrimitive = string | number | boolean | null;
export type MapaMetadataValue =
  | MapaMetadataPrimitive
  | MapaMetadataValue[]
  | { [key: string]: MapaMetadataValue };
export type MapaMetadata = Record<string, MapaMetadataValue>;

export interface MapaGeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface MapaGeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface MapaGeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface MapaGeoJsonMultiLineString {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}

export interface MapaGeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}

export type MapaGeoJsonGeometry =
  | MapaGeoJsonPoint
  | MapaGeoJsonLineString
  | MapaGeoJsonPolygon
  | MapaGeoJsonMultiLineString
  | MapaGeoJsonMultiPolygon;

export type MapaGeometryPayload =
  | MapaGeoJsonGeometry
  | string
  | ({ wkt: string } & Record<string, MapaMetadataValue | undefined>);

export interface MapaNodo {
  idRedNodo: number;
  idRedNodoPadreFk?: number | null;
  codigo?: string | null;
  nodo: string;
  descripcion?: string | null;
  tipoNodo: 'carpeta' | 'zona' | 'sitio' | 'nodo_fisico';
  orden: number;
  visible: boolean;
  pathCache?: string | null;
  nivel: number;
  atributos?: MapaMetadata | null;
}

export interface MapaTipoElemento {
  idGeoTipoElemento: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  icono?: string | null;
  iconoFuente?: string | null;
  iconoClase?: string | null;
  shapeBase?: string | null;
  colorFill?: string | null;
  colorStroke?: string | null;
  colorTexto?: string | null;
  strokeWidth: number;
  zIndex: number;
  tamanoIcono?: number | null;
  geometriaPermitida: 'point' | 'linestring' | 'polygon' | 'mixed';
  snapping: boolean;
  conectable: boolean;
  maxPuertosDefault: number;
  permiteImportAuto: boolean;
  requiereRevision: boolean;
  prioridadClasificacion: number;
  activo: boolean;
  atributos?: MapaMetadata | null;
}

export interface MapaElemento {
  idGeoElemento: number;
  idRedNodoFk: number;
  idGeoTipoElementoFk: number;
  idGeoImportLoteFk?: number | null;

  codigo?: string | null;
  nombre: string;
  descripcion?: string | null;
  etiqueta?: string | null;
  observacion?: string | null;

  estado: string;
  visible: boolean;

  origen: string;
  origenRef?: string | null;
  styleUrl?: string | null;

  kmlExtendedData?: MapaMetadata | null;
  atributos?: MapaMetadata | null;

  geomTipo: MapaGeomTipo;
  geometria?: MapaGeometryPayload | null;
  wkt?: string | null;
  latLon?: string | null;
  bbox?: string | null;
  longitudM?: number;
  areaM2?: number;
  ordenDibujo?: number;

  // enriquecidos desde el backend
  tipoCodigo?: string | null;
  tipoNombre?: string | null;
  tipoActivo?: boolean | null;
  geometriaPermitida?: 'point' | 'linestring' | 'polygon' | 'mixed' | null;

  iconoFuente?: string | null;
  icono?: string | null;
  iconoClase?: string | null;
  shapeBase?: string | null;
  colorFill?: string | null;
  colorStroke?: string | null;
  colorTexto?: string | null;
  strokeWidth?: number | null;
  zIndex?: number | null;
  tamanoIcono?: number | null;
}

export interface MapaImportLoteResumen {
  idGeoImportLote: number;
  nombreArchivo: string;
  extension: string;
  tamanoBytes?: number | null;
  hashArchivo?: string | null;
  estado: string;
  totalNodos: number;
  totalElementos: number;
  totalOk: number;
  totalError: number;
  detalle?: string | null;
  fechaImportacion?: string | null;
  erroresReales?: number;
  advertenciasReales?: number;
}

export interface MapaImportResult {
  idGeoImportLote: number;
  estado: string;
  totalNodos: number;
  totalElementos: number;
  totalOk: number;
  totalError: number;
}

export interface MapaNodoSaveRequest {
  idRedNodoPadreFk?: number | null;
  codigo?: string | null;
  nodo: string;
  descripcion?: string | null;
  tipoNodo: 'carpeta' | 'zona' | 'sitio' | 'nodo_fisico';
  orden?: number;
  visible?: boolean;
  atributos?: MapaMetadata | null;
}

export interface MapaTipoElementoSaveRequest {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  icono?: string | null;
  iconoFuente?: string | null;
  iconoClase?: string | null;
  shapeBase?: string | null;
  colorFill?: string | null;
  colorStroke?: string | null;
  colorTexto?: string | null;
  strokeWidth?: number;
  zIndex?: number;
  tamanoIcono?: number | null;
  geometriaPermitida: 'point' | 'linestring' | 'polygon' | 'mixed';
  snapping?: boolean;
  conectable?: boolean;
  maxPuertosDefault?: number;
  permiteImportAuto?: boolean;
  requiereRevision?: boolean;
  prioridadClasificacion?: number;
  activo?: boolean;
  atributos?: MapaMetadata | null;
}

export interface MapaElementoSaveRequest {
  idRedNodoFk: number;
  idGeoTipoElementoFk: number;
  codigo?: string | null;
  nombre: string;
  descripcion?: string | null;
  etiqueta?: string | null;
  observacion?: string | null;
  estado?: string;
  visible?: boolean;
  origen?: string;
  origenRef?: string | null;
  styleUrl?: string | null;
  kmlExtendedData?: MapaMetadata | null;
  atributos?: MapaMetadata | null;
  wkt: string;
  latLon?: string | null;
  ordenDibujo?: number;
}

export interface MapaPatchRequest {
  id: number;
  cambios: Record<string, unknown>;
}

export interface MapaExportRequest {
  q?: string | null;
  idRedNodoFk?: number | null;
  idGeoTipoElementoFk?: number | null;
  visible?: boolean | null;
  nombreDocumento?: string | null;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  number: number;
  size: number;
}

export interface ListOrPageOptions {
  q?: string;
  page?: number;
  size?: number;
  all?: boolean;
}

export interface MapaElementoGeometriaRequest {
  id: number;
  wkt: string;
}

export interface MapaGeometryEditedEvent {
  idGeoElemento: number;
  wkt: string;
  geomTipo: MapaGeomTipo;
}

export interface MapaLegendItem {
  idGeoTipoElemento: number;
  nombre: string;
  colorStroke?: string | null;
  colorFill?: string | null;
  iconoFuente?: string | null;
  geometriaPermitida: 'point' | 'linestring' | 'polygon' | 'mixed';
  visible: boolean;
}
