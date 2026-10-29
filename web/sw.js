/* Service worker de LA ASISTENTA (PWA).
 *
 * Estrategia honesta:
 *  - El cascarón de la app (portada, fuentes, iconos) se guarda en caché:
 *    sin conexión la app ABRE y muestra la portada con su aviso de
 *    «sin conexión». Nunca se sirven datos de agenda desde la caché.
 *  - /api/* va SIEMPRE a la red: análisis y reservas son reales o no son.
 *  - Las navegaciones intentan la red primero y caen al cascarón en caché.
 */
'use strict';

const CACHE = 'la-asistenta-shell-v11';
const NUCLEO = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const EXTRAS = [
  '/fonts/fraunces-normal.woff2',
  '/fonts/fraunces-italic.woff2',
  '/fonts/montserrat.woff2',
  '/ejemplo.jpg',
  '/img/diseno.jpg',
  '/img/henna.jpg',
  '/img/laminacion.jpg',
  '/img/salon.jpg',
  '/img/lounge.jpg',
];

/* El servidor manda «Cache-Control: no-store»; si la Cache API lo rechaza,
 * se guarda una copia equivalente sin esa cabecera. */
async function guardar(cache, peticion, respuesta) {
  try {
    await cache.put(peticion, respuesta.clone());
  } catch (e) {
    const cuerpo = await respuesta.clone().blob();
    const limpia = new Response(cuerpo, {
      status: respuesta.status,
      headers: { 'Content-Type': respuesta.headers.get('Content-Type') || '' },
    });
    await cache.put(peticion, limpia);
  }
}

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of NUCLEO.concat(EXTRAS)) {
      try {
        const r = await fetch(url);
        if (r.ok) await guardar(cache, url, r);
      } catch (e) { /* un extra que falle no impide instalar */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (ev.request.mode === 'navigate') {
    ev.respondWith((async () => {
      try {
        const red = await fetch(ev.request);
        /* Solo la portada alimenta el cascarón: la página del enlace
         * mágico (/cita/<token>) es personal y NUNCA se cachea. */
        if (url.pathname === '/') {
          const cache = await caches.open(CACHE);
          guardar(cache, '/', red.clone()).catch(() => {});
        }
        return red;
      } catch (e) {
        if (url.pathname !== '/') throw e;
        const cache = await caches.open(CACHE);
        const guardada = await cache.match('/');
        if (guardada) return guardada;
        throw e;
      }
    })());
    return;
  }

  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(ev.request);
    if (guardada) return guardada;
    const red = await fetch(ev.request);
    if (red.ok) guardar(cache, ev.request, red.clone()).catch(() => {});
    return red;
  })());
});
