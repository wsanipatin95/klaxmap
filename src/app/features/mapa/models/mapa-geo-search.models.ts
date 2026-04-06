export type MapaGeoSearchSource = 'coordinates' | 'geocoder';

export interface MapaGeoSearchBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapaGeoSearchResult {
  id: string;
  label: string;
  subtitle?: string | null;
  lat: number;
  lng: number;
  bounds?: MapaGeoSearchBounds | null;
  source: MapaGeoSearchSource;
}
