# KLAXMAP - Frontend mapa embed

Este paquete agrega rutas y componentes para embeber mapas desde el ERP antiguo.

## Rutas nuevas

```txt
/embed/mapa/admin?code=...
/embed/mapa/vendedor?code=...
/embed/mapa/tecnico?code=...
```

Opcional:

```txt
&origin=http://host-del-erp-antiguo
&lat=-2.170998
&lng=-79.922359
```

## Flujo

1. ERP antiguo pide code temporal a `klaxapi`.
2. ERP antiguo abre iframe apuntando a `/embed/mapa/<modo>?code=...`.
3. `klaxmap` llama `/api/aut/embed/exchange`.
4. Se guarda sesión normal en `SessionStore`.
5. `SessionStore.meta.company` y `SessionStore.meta.tenant` se usan en el interceptor `X-Tenant`.
6. Vendedor/técnico llaman `/api/erp/mapa/elemento/cercanos`.

## Comunicación con ERP antiguo

El iframe envía eventos:

```txt
KLAX_MAP_READY
KLAX_MAP_ERROR
KLAX_MAP_CANCEL
KLAX_MAP_ELEMENT_SELECTED
KLAX_MAP_ELEMENT_VIEWED
KLAX_MAP_BOX_SELECTED
KLAX_MAP_BOX_CREATED
KLAX_MAP_FIBER_CREATED
```

El ERP antiguo puede enviar ubicación nueva al iframe:

```js
iframe.contentWindow.postMessage({
  type: 'KLAX_MAP_INIT',
  mode: 'tecnico',
  lat: -2.170998,
  lng: -79.922359,
  radioM: 300,
  trabajoId: 12345
}, '*');
```

## Instalación

Desde la raíz del repo `klaxmap`:

```bash
python install_mapa_embed_frontend.py --dry-run
python install_mapa_embed_frontend.py
npm run build
```
