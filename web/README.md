# Web de la clienta — LA ASISTENTA

Experiencia mobile-first (superficie principal aprobada en H0):
consentimiento informado → foto (propia o de ejemplo) → preferencias →
análisis real con Muse Spark → reserva verificada en la agenda real.

## Archivos

- `web_server.py` — servidor stdlib (puerto 8090 por defecto). Lee la clave
  de Baseten solo en el servidor desde el `.env` de Hermes
  (`BASETEN_ENV_FILE`) y habla con la API de agenda (`AGENDA_API`,
  token en `AGENDA_API_TOKEN`). La foto se procesa en memoria y se descarta.
- `index.html` — la experiencia completa (HTML/CSS/JS en un fichero).
- `pruebas_web.py` — batería E2E contra el servicio en marcha (11 pruebas;
  la cita de prueba se cancela al final).
- `qa/qa_cdp.mjs` — QA visual a 412×915 conduciendo Chromium por CDP;
  capturas en `qa/*.png`.
- `qa2/qa2_cdp.mjs` — QA de la capa PWA/app: manifiesto, iconos, service
  worker, caché offline, navegación inferior y objetivos táctiles;
  capturas en `qa2/*.png`.

## Capa PWA (la web como app)

- `manifest.webmanifest` — «La Asistenta», standalone, colores de marca;
  el splash de Android sale del manifiesto (fondo #252533 + icono).
- `sw.js` — service worker: caché SOLO del cascarón (portada, fuentes,
  iconos). `/api/*` va siempre a la red; sin conexión se abre la portada
  con un aviso honesto, nunca datos de agenda guardados.
- `icon.svg` + `icons/` — motivo propio (arco de ceja lavanda sobre carbón
  índigo con destello verde): iconos 192/512, maskable, apple-touch-icon
  y pantallas de arranque de iOS. Se regeneran con `generar_iconos.py`
  (PIL, sin dependencias de red).
- La interfaz lleva barra de navegación inferior fija (Inicio · Análisis ·
  Reservar, las vistas reales del flujo), objetivos táctiles ≥44 px,
  inputs a 16 px (sin zoom en iOS), safe-area insets y respeto a
  `prefers-reduced-motion`.

## Activos solo de despliegue (no van en el repo público)

- `fonts/*.woff2` (Fraunces y Montserrat): sin ellos la página usa las
  fuentes del sistema, sin romperse.
- `ejemplo.jpg`: la foto de ejemplo autorizada (imagen de stock usada en
  las pruebas de H2). Se excluye del repo público por la regla de no
  publicar fotografías de personas; en la máquina desplegada sí está.

## Despliegue actual

Máquina InstaBox, `/data/la-asistenta/web/`, puerto 8090 publicado:
https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech
Arranque conjunto con el resto de la pila: `arrancar.sh` de la máquina.
