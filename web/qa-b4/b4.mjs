// QA-B4 · MUSA Bloque B4 — sistema visual único: tokens y escala (29/10/2026)
// Capturas comparativas a 412x915 en dos modos:
//   node b4.mjs antes    → producción actual (post-B3, SW v22)
//   node b4.mjs despues  → tras la consolidación B4 (SW v23)
// Pantallas: Inicio, Explorar, Salón, Reserva paso 2, Resultado (análisis
// REAL con la foto de ejemplo) y Profesional·Hoy.
// La clave profesional se lee del fichero del servidor; NUNCA se imprime.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const RAIZ = '/data/la-asistenta/web';
const OUT = `${RAIZ}/qa-b4/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const CLAVE = readFileSync(`${RAIZ}/profesional.env`, 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9364', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b4-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9364/json/version');
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
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
    erroresConsola.push(m.params.entry.text || 'error de log');
  if (m.method === 'Runtime.exceptionThrown')
    erroresConsola.push('excepción: ' + (m.params?.exceptionDetails?.text || ''));
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
await S('Log.enable');
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
async function shotFull(nombre) {
  const { result } = await S('Page.getLayoutMetrics');
  const size = result.cssContentSize || result.contentSize;
  const r = await S('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
  });
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

/* ---------- clienta: Inicio ---------- */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await sleep(900); // fundido de fotos (§51) asentado
await shot('inicio');

/* ---------- Explorar ---------- */
await clic('#nav-explorar');
await esperar(`document.getElementById('p-explorar')?.classList.contains('activa')`, 8000);
await sleep(700);
await shot('explorar');

/* ---------- Salón (desde la fila del salón) ---------- */
await clic('#nav-inicio'); await sleep(600);
await clic('.fila-salon-home');
await esperar(`document.getElementById('p-salon')?.classList.contains('activa')`, 8000);
await sleep(700);
await shot('salon');

/* ---------- Reserva paso 2 (calendario) ---------- */
await clic('#nav-inicio'); await sleep(600);
await clic('#pastilla-reservar');
await esperar(`document.getElementById('paso-1')?.classList.contains('activo')`, 8000);
await esperar(`!document.getElementById('btn-paso1-siguiente').disabled`, 8000);
await clic('#btn-paso1-siguiente');
await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
await esperar(`document.querySelectorAll('.hora-fila').length > 0 || /sin huecos|no hay huecos/i.test(document.getElementById('paso-2')?.textContent || '')`, 25000);
await evalJs(`window.scrollTo(0, 0)`); await sleep(400);
await shot('reserva-paso2');

/* ---------- Resultado: análisis REAL con foto de ejemplo (flujo de B2) ---------- */
await clic('#nav-probador'); await sleep(700);
await clic('#btn-prob-cejas'); await sleep(700);
await clic('#check-consentimiento'); await sleep(300);
await clic('#btn-ir-foto'); await sleep(700);
await clic('#btn-foto-ejemplo');
await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
await sleep(400);
const t0 = Date.now();
await clic('#btn-analizar');
const listo = await esperar(`document.getElementById('p-resultado').classList.contains('activa')`, 300000);
const latencia = Math.round((Date.now() - t0) / 100) / 10;
if (!listo) {
  writeFileSync(`${OUT}/resultado.json`, JSON.stringify({ modo: MODO, listo: false, latencia, erroresConsola }, null, 2));
  console.log('B4', MODO, '· SIN RESULTADO tras', latencia, 's · errores:', erroresConsola.length);
  try { ws.close(); } catch {}
  chrome.kill();
  process.exit(1);
}
await sleep(1000);
const recoNombre = await evalJs(`document.getElementById('reco-nombre')?.textContent || ''`);
await evalJs(`window.scrollTo(0, 0)`); await sleep(250);
await shotFull('resultado');

/* ---------- profesional: Hoy ---------- */
await S('Page.navigate', { url: WEB + '/profesional' });
await esperar(`!!document.querySelector('#clave')`);
await evalJs(`document.querySelector('#clave').value = ${JSON.stringify(CLAVE)};
              document.querySelector('#clave').dispatchEvent(new Event('input', {bubbles:true}))`);
await evalJs(`document.querySelector('#btn-entrar').click()`);
await esperar(`!document.querySelector('#vista-panel').classList.contains('oculto')
               && document.querySelectorAll('#hoy-citas .cita, #hoy-citas .vacio').length > 0`);
await sleep(600);
await shot('profesional-hoy');

console.log(JSON.stringify({ modo: MODO, listo, latencia, recoNombre, erroresConsola }, null, 1));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
