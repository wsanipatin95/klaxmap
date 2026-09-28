/**
 * Marcas de equipo que el NOC reconoce.
 *
 * Esto NO se escribe a mano en ninguna pantalla: el vendor siempre se elige de
 * esta lista. Un vendor mal escrito (por ejemplo "CISCO" en un CCR1036, que es
 * MikroTik) hacia que el monitor consultara OIDs propietarios equivocados y el
 * equipo se quedaba sin CPU, memoria ni temperatura.
 *
 * OTRA = marca no listada. El monitor usa los OIDs estandar (HOST-RESOURCES /
 * UCD-SNMP), que funcionan en casi cualquier equipo.
 */
export const MARCAS_EQUIPO: string[] = [
  'MIKROTIK',
  'CISCO',
  'HUAWEI',
  'ZTE',
  'JUNIPER',
  'UBIQUITI',
  'TP-LINK',
  'FIBERHOME',
  'VSOL',
  'DATACOM',
  'EXTREME',
  'ARUBA',
  'OTRA',
];

/**
 * Une la lista oficial con lo que ya esta registrado en los equipos, para que
 * un vendor historico no desaparezca del selector. Todo en mayusculas y sin
 * repetidos.
 */
export function opcionesMarca(registrados: (string | null | undefined)[] = []): string[] {
  const set = new Set<string>(MARCAS_EQUIPO);
  for (const v of registrados) {
    const s = (v || '').trim().toUpperCase();
    if (s) set.add(s);
  }
  const otra = set.delete('OTRA');
  const lista = Array.from(set).sort();
  if (otra) lista.push('OTRA');
  return lista;
}
