export const environment = {
  production: true,
  apiBaseUrl: '/klaxapi',
  // Prefijos relativos por back. En prod los enruta nginx (mismo dominio):
  //   location /api/erp/ -> klaxapi ; location /api/monitoreo/ -> noc-back
  apiBases: {
    erp: '/api/erp',
    monitoreo: '/api/monitoreo',
  },
  company: 'inno',
  tenant: 'public',
};
