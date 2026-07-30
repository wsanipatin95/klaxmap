export const environment = {
  production: false,
  // apiBaseUrl: base histórica del ERP. Se mantiene por compatibilidad con los
  // servicios existentes. Los nuevos módulos usan apiBases (prefijos relativos).
  apiBaseUrl: '/klaxapi',
  // Prefijos relativos por back (unificación KLAX). En dev los resuelve el proxy
  // (proxy.conf.json); en prod, nginx (location /api/erp, /api/monitoreo).
  apiBases: {
    erp: '/api/erp',
    monitoreo: '/api/monitoreo',
  },
  company: 'inno',
  tenant: 'public',
};
