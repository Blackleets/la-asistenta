// QA-B8 · capturas enfocadas (complemento de b8.mjs, 29/10/2026)
// Las filas D7 (reserva genérica) y D12 (huecos de /cita) ya salieron
// verificadas por DOM en la pasada «despues»; aquí se repite SOLO la
// provocación para fotografiar el error con su salida dentro del
// encuadre (scrollIntoView antes del disparo). Sin reservas reales
// nuevas salvo la cita de la fila D12, que se cancela al final por
// el canal propio (/api/cita/<token>/cancelar).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa-b8/despues';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9379', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b8-perfil-captura', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9379/json/version');
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
const reglas = [];
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => {
    pendientes.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function alPausar(p, sessionId) {
  const regla = reglas.find(r => r.activa && p.request.url.includes(r.contiene)
    && (!r.metodo || p.request.method === r.metodo));
  if (!regla) return send('Fetch.continueRequest', { requestId: p.requestId }, sessionId);
  if (regla.accion === 'fallar')
    return send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }, sessionId);
  return send('Fetch.fulfillRequest', {
    requestId: p.requestId, responseCode: regla.status || 502,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(regla.cuerpo || '{"error":"la agenda no responde ahora mismo"}').toString('base64'),
  }, sessionId);
}
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Fetch.requestPaused') alPausar(m.params, m.sessionId);
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
async function shot(nombre) {
  const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};

/* ---- D7 enfocada: error genérico de reserva con su «Reintentar» ---- */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await clic('#nav-explorar');
await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
await clic('.prod-card [data-acc="reservar"]');
await esperar(`document.querySelectorAll('.hora-fila').length > 0`, 25000);
await clic('.hora-fila');
await clic('#btn-paso2-siguiente');
await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 8000);
await evalJs(`(() => { const n = document.getElementById('inp-nombre');
  n.value = 'PRUEBA B8'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await clic('#check-confirma');
const rRes = { contiene: '/api/reservar', metodo: 'POST', accion: 'responder', status: 502, activa: true };
reglas.push(rRes);
await clic('#btn-confirmar');
const okD7 = await esperar(`document.querySelector('#error-reserva')?.classList.contains('visible')
  && document.querySelector('#btn-reintentar-reserva')?.offsetParent !== null`, 20000);
await evalJs(`document.querySelector('#error-reserva')?.scrollIntoView({ block: 'center' })`);
await sleep(500);
await shot('d7b-reserva-generica');
console.log('D7 enfocada:', okD7 ? 'OK' : 'FALLO');
rRes.activa = false;

/* ---- D12 enfocada: huecos de /cita con su «Reintentar» ---- */
const manana = new Date(Date.now() + 24 * 3600 * 1000);
const fecha = manana.toISOString().slice(0, 10);
const creada = await fetch(WEB + '/api/reservar', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombre: 'PRUEBA B8 FOTO', telefono: '600123456',
    servicios: ['Diseño de cejas'], servicio: 'Diseño de cejas', notas: '',
    fecha, hora: '12:00' }),
}).then(async r => ({ st: r.status, d: await r.json().catch(() => ({})) }));
console.log('cita para la foto:', creada.st, creada.d?.cita?.codigo || '');
const enlace = creada.d?.cita?.enlace || '';
let okD12 = false;
if (enlace) {
  const ruta = new URL(enlace).pathname;
  const rHue = { contiene: '/huecos?fecha=', accion: 'fallar', activa: true };
  reglas.push(rHue);
  await S('Page.navigate', { url: WEB + ruta });
  okD12 = await esperar(`!!document.querySelector('#btn-reintentar-huecos')`, 20000);
  await evalJs(`document.querySelector('#btn-reintentar-huecos')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  await shot('d12b-cita-huecos');
  rHue.activa = false;
  const token = ruta.split('/').filter(Boolean)[1];
  const canc = await fetch(WEB + `/api/cita/${token}/cancelar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }).then(async r => ({ st: r.status, d: await r.json().catch(() => ({})) }));
  console.log('D12 enfocada:', okD12 ? 'OK' : 'FALLO',
    '· cita de la foto cancelada:', canc.d?.cita?.estado || canc.st);
}
try { ws.close(); } catch {}
chrome.kill();
process.exit(okD7 && okD12 ? 0 : 1);
