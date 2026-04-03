export function normalizeMapaColor(
  value: string | null | undefined,
  fallback: string | null = null
): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  if (/^transparent$/i.test(raw)) {
    return 'transparent';
  }

  if (/^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw)) {
    return raw;
  }

  const hex = raw.startsWith('#') ? raw.slice(1) : raw;

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const expanded = hex
      .split('')
      .map((char) => char + char)
      .join('')
      .toLowerCase();
    return `#${expanded}`;
  }

  if (/^[0-9a-f]{4}$/i.test(hex)) {
    const [r, g, b, a] = hex.toLowerCase().split('').map((char) => char + char);
    return alphaHexToCss(`#${r}${g}${b}`, a);
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }

  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return normalizeEightDigitHex(hex.toLowerCase());
  }

  return fallback ?? raw;
}

export function normalizeMapaColorOrDefault(
  value: string | null | undefined,
  defaultColor: string
): string {
  return normalizeMapaColor(value, defaultColor) ?? defaultColor;
}

function normalizeEightDigitHex(hex: string): string {
  // Compatibilidad con colores provenientes de KML (AABBGGRR).
  // Ejemplo problemático: #ff000000 debe verse negro sólido y no rojo transparente.
  const aa = hex.slice(0, 2);
  const bb = hex.slice(2, 4);
  const gg = hex.slice(4, 6);
  const rr = hex.slice(6, 8);

  const red = parseInt(rr, 16);
  const green = parseInt(gg, 16);
  const blue = parseInt(bb, 16);
  const alpha = parseInt(aa, 16) / 255;

  if (!Number.isFinite(alpha) || alpha >= 0.999) {
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${roundAlpha(alpha)})`;
}

function alphaHexToCss(rgbHex: string, alphaHex: string): string {
  const alpha = parseInt(alphaHex, 16) / 255;
  if (!Number.isFinite(alpha) || alpha >= 0.999) {
    return rgbHex.toLowerCase();
  }

  const clean = rgbHex.replace('#', '');
  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${roundAlpha(alpha)})`;
}

function toHex(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(255, Math.round(value))) : 0;
  return safe.toString(16).padStart(2, '0');
}

function roundAlpha(value: number): number {
  return Math.round(value * 1000) / 1000;
}
