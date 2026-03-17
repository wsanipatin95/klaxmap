import type { MapaGeomTipo } from '../data-access/mapa.models';

export type LatLngTuple = [number, number];

export interface ParsedWktGeometry {
  geomTipo: MapaGeomTipo;
  renderType: 'point' | 'polyline' | 'polygon';
  point?: LatLngTuple;
  line?: LatLngTuple[];
  polygon?: LatLngTuple[][];
}

function normalizeWkt(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function stripOuterParens(value: string): string {
  let text = value.trim();

  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0;
    let valid = true;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;

      if (depth === 0 && i < text.length - 1) {
        valid = false;
        break;
      }
    }

    if (!valid) break;
    text = text.slice(1, -1).trim();
  }

  return text;
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of value) {
    if (ch === '(') {
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === ')') {
      depth -= 1;
      current += ch;
      continue;
    }

    if (ch === ',' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseCoordPair(value: string): LatLngTuple | null {
  const parts = value.trim().split(/\s+/).map(Number);

  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }

  const lng = parts[0];
  const lat = parts[1];

  return [lat, lng];
}

function parseCoordList(value: string): LatLngTuple[] {
  return splitTopLevel(value)
    .map(parseCoordPair)
    .filter((x): x is LatLngTuple => !!x);
}

function closeRingIfNeeded(coords: LatLngTuple[]): LatLngTuple[] {
  if (coords.length < 3) return coords;

  const first = coords[0];
  const last = coords[coords.length - 1];

  if (first[0] === last[0] && first[1] === last[1]) {
    return coords;
  }

  return [...coords, first];
}

export function parseWktGeometry(wkt: string): ParsedWktGeometry | null {
  const raw = normalizeWkt(wkt);
  const upper = raw.toUpperCase();

  if (upper.startsWith('POINT')) {
    const inner = stripOuterParens(raw.slice(raw.indexOf('(')));
    const point = parseCoordPair(inner);
    if (!point) return null;

    return {
      geomTipo: 'point',
      renderType: 'point',
      point,
    };
  }

  if (upper.startsWith('MULTIPOINT')) {
    const inner = stripOuterParens(raw.slice(raw.indexOf('(')));
    const firstPart = splitTopLevel(inner)[0];
    if (!firstPart) return null;

    const point = parseCoordPair(stripOuterParens(firstPart));
    if (!point) return null;

    return {
      geomTipo: 'point',
      renderType: 'point',
      point,
    };
  }

  if (upper.startsWith('LINESTRING')) {
    const inner = stripOuterParens(raw.slice(raw.indexOf('(')));
    const line = parseCoordList(inner);
    if (line.length < 2) return null;

    return {
      geomTipo: 'linestring',
      renderType: 'polyline',
      line,
    };
  }

  if (upper.startsWith('MULTILINESTRING')) {
    const inner = stripOuterParens(raw.slice(raw.indexOf('(')));
    const firstLine = splitTopLevel(inner)[0];
    if (!firstLine) return null;

    const line = parseCoordList(stripOuterParens(firstLine));
    if (line.length < 2) return null;

    return {
      geomTipo: 'linestring',
      renderType: 'polyline',
      line,
    };
  }

  if (upper.startsWith('POLYGON')) {
    const inner = stripOuterParens(raw.slice(raw.indexOf('(')));
    const rings = splitTopLevel(inner)
      .map((ringText) => closeRingIfNeeded(parseCoordList(stripOuterParens(ringText))))
      .filter((ring) => ring.length >= 4);

    if (!rings.length) return null;

    return {
      geomTipo: 'polygon',
      renderType: 'polygon',
      polygon: rings,
    };
  }

  if (upper.startsWith('MULTIPOLYGON')) {
    const inner = stripOuterParens(raw.slice(raw.indexOf('(')));
    const firstPolygon = splitTopLevel(inner)[0];
    if (!firstPolygon) return null;

    const polygonInner = stripOuterParens(firstPolygon);
    const rings = splitTopLevel(polygonInner)
      .map((ringText) => closeRingIfNeeded(parseCoordList(stripOuterParens(ringText))))
      .filter((ring) => ring.length >= 4);

    if (!rings.length) return null;

    return {
      geomTipo: 'polygon',
      renderType: 'polygon',
      polygon: rings,
    };
  }

  return null;
}