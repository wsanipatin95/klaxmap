// Utilidades de gráficos y formato

export function areaDs(label: string, color: string, data: (number | null)[]) {
  return { label, data, borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.6, spanGaps: true };
}

// Estilo Zabbix: RX verde (área), TX rojo (línea). spanGaps conecta la línea a través de buckets vacíos.
export function zabbixDs(rx: (number | null)[], tx: (number | null)[]) {
  return [
    { label: 'Bits recibidos', data: rx, borderColor: '#2a9d2a', backgroundColor: 'rgba(42,157,42,.28)', fill: 'origin', tension: 0.25, pointRadius: 0, borderWidth: 1.3, spanGaps: true, order: 2 },
    { label: 'Bits enviados', data: tx, borderColor: '#e8730c', backgroundColor: 'transparent', fill: false, tension: 0.25, pointRadius: 0, borderWidth: 1.4, spanGaps: true, order: 1 },
  ];
}

export function metColor(m: string): string {
  if (m.includes('cpu')) return '#dc2626';
  if (m.includes('mem')) return '#2563eb';
  if (m.includes('temp')) return '#d97706';
  if (m.includes('ping')) return '#16a34a';
  return '#2a9d2a';
}

export function cpuColor(c: number | null): string {
  if (c == null) return '#6b7280';
  return c >= 85 ? '#dc2626' : c >= 70 ? '#d97706' : '#16a34a';
}

export function fmtG(v: number): string {
  v = +v || 0;
  return v >= 1 ? v.toFixed(2) + ' Gbps' : (v * 1000).toFixed(1) + ' Mbps';
}

export function fmtBps(v: number | null): string {
  if (v == null) return '—';           // sin lectura
  v = +v || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(1) + ' Gbps';
  if (v >= 1e6) return (v / 1e6).toFixed(0) + ' Mbps';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + ' Kbps';
  return '0 bps';                        // se leyó, está idle
}

export function fmtCap(v: number): string {
  v = +v || 0;
  return v >= 1e9 ? v / 1e9 + ' Gbps' : v / 1e6 + ' Mbps';
}

export function fmtUptime(s: number | null): string {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
}

export interface Stat { last: number; min: number; max: number; avg: number; }
export function stats(arr: number[]): Stat {
  const a = (arr || []).map(Number).filter((x) => !isNaN(x));
  if (!a.length) return { last: 0, min: 0, max: 0, avg: 0 };
  return { last: a[a.length - 1], min: Math.min(...a), max: Math.max(...a), avg: a.reduce((s, x) => s + x, 0) / a.length };
}
