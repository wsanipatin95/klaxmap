import type * as Leaflet from 'leaflet';

export type BasemapKey =
  | 'osm'
  | 'cartoLight'
  | 'cartoDark'
  | 'esriWorldImagery'
  | 'googleSatellite'
  | 'openTopo';

export interface MapaBasemapOption {
  key: BasemapKey;
  label: string;
  url: string;
  options: Leaflet.TileLayerOptions;
}

export const MAPA_BASEMAP_OPTIONS: readonly MapaBasemapOption[] = [
  {
    key: 'osm',
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    key: 'cartoLight',
    label: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: {
      subdomains: 'abcd',
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  {
    key: 'cartoDark',
    label: 'Oscuro',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      subdomains: 'abcd',
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  {
    key: 'esriWorldImagery',
    label: 'Satélite Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: 'Tiles &copy; Esri',
    },
  },
  {
    key: 'googleSatellite',
    label: 'Satélite Google',
    url: 'https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&s=Ga',
    options: {
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: 'Google imagery · verificar licencias antes de uso productivo',
    },
  },
  {
    key: 'openTopo',
    label: 'Relieve',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 17,
      maxNativeZoom: 17,
      attribution:
        'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
    },
  },
] as const;

export function getMapaBasemapLabel(key: BasemapKey): string {
  return MAPA_BASEMAP_OPTIONS.find((item) => item.key === key)?.label ?? 'Mapa base';
}
