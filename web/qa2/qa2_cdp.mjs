// QA visual + PWA de la web de la clienta a 412x915 conduciendo Chromium
// por CDP. Comprueba con evidencia: manifiesto válido e iconos 200,
// service worker registrado y controlando, caché del cascarón, recorrido
// con la barra de navegación inferior, objetivos táctiles >= 44 px,
// inputs a 16 px, modo standalone emulado y portada offline con aviso.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const URL = 'http://127.0.0.1:8090/';
const OUT = '/data/la-asistenta/web/qa2';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9334', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9334/json/version');
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP no arrancó');
}

const ws = new WebSocket(await wsUrl());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let idSeq = 0;
const pendientes = new Map();
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
});
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => {
    pendientes.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
await S('Runtime.enable');
await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride',
        { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

async function evalJs(expr) {
  const r = await S('Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
async function shot(nombre) {
  const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = r.result?.data || r.data;
  if (!data) throw new Error('sin datos de captura: ' + JSON.stringify(r).slice(0, 300));
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
  console.log('captura:', nombre);
}
const click = sel => evalJs(`document.querySelector('${sel}').click()`);

/* ---------- carga y PWA ---------- */
await S('Page.navigate', { url: URL });
await sleep(3500);

const manifiesto = await evalJs(`(async () => {
  const r = await fetch('/manifest.webmanifest');
  const t = await r.text();
  try { return { estado: r.status, datos: JSON.parse(t) }; }
  catch { return { estado: r.status, datos: null }; }
})()`);
ev('manifiesto 200 y JSON válido', manifiesto.estado === 200 && !!manifiesto.datos,
   `name=${manifiesto.datos?.name} display=${manifiesto.datos?.display} theme=${manifiesto.datos?.theme_color}`);

const iconos = await evalJs(`(async () => {
  const urls = ['/icons/icon-192.png', '/icons/icon-512.png',
    '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/icon.svg'];
  const out = [];
  for (const u of urls) {
    const r = await fetch(u);
    out.push(u + '=' + r.status);
  }
  return out;
})()`);
ev('iconos PWA responden 200', iconos.every(t => t.endsWith('=200')), iconos.join(' '));

/* esperar a que el SW esté activo y controle (recarga: clients.claim) */
await S('Page.reload');
await sleep(3000);
let sw = null;
for (let i = 0; i < 12; i++) {
  sw = await evalJs(`(async () => {
    if (!('serviceWorker' in navigator)) return { ok: false, por: 'sin API' };
    const reg = await navigator.serviceWorker.getRegistration('/');
    return {
      ok: !!reg, activo: !!(reg && reg.active),
      controlando: !!navigator.serviceWorker.controller,
      estado: reg && reg.active ? reg.active.state : 'sin registro',
    };
  })()`);
  if (sw.activo && sw.controlando) break;
  await sleep(1500);
}
ev('service worker registrado, activo y controlando', !!(sw && sw.activo && sw.controlando),
   `estado=${sw?.estado}`);

const cacheUrls = await evalJs(`(async () => {
  const nombres = await caches.keys();
  const out = { nombres, urls: [] };
  for (const n of nombres) {
    const c = await caches.open(n);
    out.urls.push(...(await c.keys()).map(r => new URL(r.url).pathname));
  }
  return out;
})()`);
ev('caché del cascarón creada con la portada',
   cacheUrls.nombres.length > 0 && cacheUrls.urls.includes('/'),
   `${cacheUrls.nombres.join(',')} · ${cacheUrls.urls.length} recursos`);

await shot('01-inicio');

/* ---------- objetivos táctiles y tipografía ---------- */
const tactil = await evalJs(`(() => {
  const min = sel => Math.min(...[...document.querySelectorAll(sel)]
    .map(e => e.getBoundingClientRect().height));
  return {
    nav: min('.nav-btn'), boton: min('#p-inicio .btn'), seg: 0,
    fuenteInput: getComputedStyle(document.querySelector('#inp-nombre')).fontSize,
  };
})()`);
ev('objetivos táctiles ≥44 px (nav y botones)',
   tactil.nav >= 44 && tactil.boton >= 44, `nav=${tactil.nav}px btn=${tactil.boton}px`);
ev('inputs a 16 px (sin zoom en iOS)', tactil.fuenteInput === '16px', tactil.fuenteInput);

/* ---------- navegación inferior: Reservar (flujo por pasos) ---------- */
await click('#nav-reservar'); await sleep(900);
/* Rediseño 28/10: la reserva va por pasos (1 Servicio → 2 Día y hora →
   3 Tus datos). El sentido de la evidencia no cambia — huecos reales
   ≥44 px en la vista de reserva —; solo se recorre el paso 1 antes. */
await click('#res-servicios .servicio-card'); await sleep(300);
await click('#btn-paso1-siguiente'); await sleep(700);
const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
await evalJs(`(()=>{const f=document.querySelector('#inp-fecha');f.value='${manana}';` +
             `f.dispatchEvent(new Event('change'));})()`);
await sleep(2200);
const huecos = await evalJs(`(() => {
  const hs = [...document.querySelectorAll('.hueco')];
  /* Desde la mecánica «Ver más horarios» los huecos 9+ nacen ocultos
     (display:none → alto 0): la medida táctil es sobre los VISIBLES. */
  const visibles = hs.filter(e => e.offsetParent !== null);
  return { n: hs.length, visibles: visibles.length,
           minAlto: visibles.length ? Math.min(...visibles.map(e => e.getBoundingClientRect().height)) : 0,
           navOn: document.querySelector('#nav-reservar').classList.contains('on'),
           activa: document.querySelector('#p-reserva').classList.contains('activa') };
})()`);
ev('nav Reservar abre la reserva con huecos reales', huecos.activa && huecos.n > 0,
   `${huecos.n} huecos (${huecos.visibles} visibles antes de «Ver más»)`);
ev('huecos visibles ≥44 px de alto', huecos.minAlto >= 44, `${huecos.minAlto}px`);
ev('la barra marca la vista activa', huecos.navOn);
await shot('02-nav-reserva');

/* ---------- análisis (flujo intacto): en v3 se entra por la pastilla
   «Análisis IA» del inicio — ya no es pestaña de la barra. El sentido de
   la evidencia no cambia: el recorrido consentimiento → foto de ejemplo
   sigue completo y el botón de analizar se activa. ---------- */
await click('#nav-inicio'); await sleep(700);
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await click('#pastilla-analisis'); await sleep(800);
await evalJs(`document.querySelector('#check-consentimiento').click()`);
await click('#btn-ir-foto'); await sleep(700);
await click('#btn-foto-ejemplo'); await sleep(2500);
const fotoOk = await evalJs(`!document.querySelector('#btn-analizar').disabled &&
  document.querySelector('#p-foto').classList.contains('activa')`);
ev('pastilla Análisis IA recorre consentimiento → foto de ejemplo', !!fotoOk);
await shot('03-nav-analisis');

/* ---------- standalone emulado ---------- */
await S('Emulation.setEmulatedMedia',
        { media: '', features: [{ name: 'display-mode', value: 'standalone' }] });
const esStandalone = await evalJs(`window.matchMedia('(display-mode: standalone)').matches`);
ev('media (display-mode: standalone) emulable en headless', !!esStandalone);
await click('#nav-inicio'); await sleep(700);
await shot('04-standalone');
await S('Emulation.setEmulatedMedia', { media: '', features: [] });

/* ---------- offline: portada desde la caché con aviso honesto ---------- */
await S('Network.emulateNetworkConditions',
        { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await S('Page.reload');
await sleep(3000);
const offline = await evalJs(`(() => ({
  banner: document.querySelector('#banner-offline').classList.contains('visible'),
  portada: !!document.querySelector('#p-inicio .tarjeta h2'),
  titulo: document.title,
}))()`);
ev('offline: la portada abre desde la caché', !!offline.portada, offline.titulo);
ev('offline: aviso honesto visible', !!offline.banner);
await shot('05-offline');
await S('Network.emulateNetworkConditions',
        { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

console.log('\n===== EVIDENCIAS QA2 =====');
for (const l of evidencias) console.log(l);
const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
console.log(`RESUMEN QA2: ${evidencias.length - fallos}/${evidencias.length} en verde`);

ws.close(); chrome.kill();
console.log('QA2 TERMINADA');
