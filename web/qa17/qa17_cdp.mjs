// QA17 · arreglo de orientación de imágenes (29/10/2026).
// Recorre las superficies donde viven las fotos reales y captura cada
// una a 412×915 para revisión visual desde los bytes: home (tarjeta
// del salón + carrusel Recomendado tarjeta a tarjeta), Explorar (las
// 4 tarjetas de producto), pantalla del Salón (cabecera + Lounge) y
// Probador (tarjeta de análisis con tc-foto). Además vuelca por stdout
// las medidas DOM de cada <img> (naturalWidth/Height y object-position
// computado) como evidencia objetiva.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa17';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9359', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9359/json/version');
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
  return new Promise(res => { pendientes.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
}
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
async function evalJs(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
async function shot(nombre) {
  const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = r.result?.data || r.data;
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
  console.log('captura:', nombre);
}
await S('Page.navigate', { url: WEB + '/' });
await sleep(4000);

// Medidas objetivas de cada foto servida en el DOM.
const medidas = await evalJs(`(() => {
  const out = [];
  document.querySelectorAll('img').forEach(im => {
    const cs = getComputedStyle(im);
    out.push({ src: im.getAttribute('src'), nat: im.naturalWidth + 'x' + im.naturalHeight,
               pos: cs.objectPosition, fit: cs.objectFit,
               caja: Math.round(im.getBoundingClientRect().width) + 'x' + Math.round(im.getBoundingClientRect().height) });
  });
  return out;
})()`);
console.log('MEDIDAS_HOME', JSON.stringify(medidas));

await shot('qa17-01-inicio');
// Carrusel Recomendado, tarjeta a tarjeta (0=salón, 1=diseño, 2=henna, 3=laminación).
const recoNombres = ['qa17-02-reco-salon', 'qa17-03-reco-diseno', 'qa17-04-reco-henna', 'qa17-05-reco-laminacion'];
for (let i = 0; i <= 3; i++) {
  const src = await evalJs(`(() => {
    const car = document.getElementById('carrusel-reco');
    const card = car.children[${i}];
    if (!card) return null;
    card.scrollIntoView({ block: 'center' });
    car.scrollTo({ left: card.offsetLeft - 16, behavior: 'instant' });
    return card.querySelector('img')?.getAttribute('src');
  })()`);
  await sleep(900);
  console.log('reco', i, src);
  await shot(recoNombres[i]);
}
// Explorar: las 4 tarjetas de producto, una a una.
await evalJs(`ir('p-explorar')`);
await sleep(1500);
const prodNombres = ['qa17-06-explorar-diseno', 'qa17-07-explorar-henna', 'qa17-08-explorar-laminacion', 'qa17-09-explorar-depilacion'];
for (let i = 0; i <= 3; i++) {
  const nombre = await evalJs(`(() => {
    const cards = document.querySelectorAll('#explorar-grid .prod-card');
    const card = cards[${i}];
    if (!card) return null;
    card.scrollIntoView({ block: 'center' });
    return card.querySelector('h3')?.textContent;
  })()`);
  await sleep(900);
  console.log('explorar', i, nombre);
  await shot(prodNombres[i]);
}
// Salón: cabecera y bloque Lounge.
await evalJs(`ir('p-salon')`);
await sleep(1500);
await shot('qa17-10-salon');
await evalJs(`document.querySelector('.lounge-card')?.scrollIntoView({ block: 'center' })`);
await sleep(900);
await shot('qa17-11-salon-lounge');
// Probador: tarjeta de análisis (tc-foto con diseno).
await evalJs(`ir('p-probador')`);
await sleep(1200);
await evalJs(`document.querySelector('.tarjeta-cejas')?.scrollIntoView({ block: 'center' })`);
await sleep(900);
await shot('qa17-12-probador-tarjeta');
// Errores de consola acumulados (el runtime los vuelca en stderr del proceso si los hay).
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
