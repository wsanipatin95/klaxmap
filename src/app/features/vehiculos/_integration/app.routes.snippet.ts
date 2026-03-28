/**
 * Agregar en src/app/app.routes.ts dentro de children de /app
 */
{
  path: 'vehiculos',
  loadChildren: () =>
    import('src/app/features/vehiculos/vehiculos.routes').then((m) => m.VEHICULOS_ROUTES),
},
