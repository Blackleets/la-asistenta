// QA-B8 · captura enfocada de la fila D11 (la carta no carga).
// La pasada «despues» verificó la fila por DOM (botón presente y
// recarga efectiva); la primera foto dejó el botón del carrusel
// fuera del encuadre porque el aviso iba en dos hijos sueltos de la
// fila flexible. Tras envolverlo en un bloque, esta captura lo
// fotografía en su sitio y de paso RE-verifica el clic de recarga.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa-b8/despues';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9380', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b8-perfil-carta', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9380/json/version');
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
let fallarServicios = true;
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => {
    pendientes.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Fetch.requestPaused') {
    const p = m.params;
    if (fallarServicios && p.request.url.includes('/api/servicios'))
      send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }, m.sessionId);
    else
      send('Fetch.continueRequest', { requestId: p.requestId }, m.sessionId);
  }
});
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
await S('Runtime.enable');
await S('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
await S('Emulation.setDeviceMetricsOverride',
        { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

async function evalJs(expr) {
  const r = await S('Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};

await S('Page.navigate', { url: WEB + '/' });
await esperar(`!!document.querySelector('#carrusel-reco .btn-recargar')`, 20000);
const geo = await evalJs(`(() => {
  const b = document.querySelector('#carrusel-reco .btn-recargar');
  const r = b?.getBoundingClientRect();
  return r ? { x: Math.round(r.x), ancho: Math.round(r.width), visible: r.x >= 0 && r.x + r.width <= 412 } : null;
})()`);
console.log('botón Recargar en el carrusel:', JSON.stringify(geo));
const { result } = await S('Page.getLayoutMetrics');
const size = result.cssContentSize || result.contentSize;
const shotRes = await S('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
});
writeFileSync(`${OUT}/d11b-carta.png`, Buffer.from(shotRes.result.data, 'base64'));
fallarServicios = false;
await evalJs(`document.querySelector('#carrusel-reco .btn-recargar')?.click()`);
const vuelve = await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
console.log('la carta vuelve al recargar:', vuelve ? 'OK' : 'FALLO');
try { ws.close(); } catch {}
chrome.kill();
process.exit(geo?.visible && vuelve ? 0 : 1);
