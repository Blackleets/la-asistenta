// QA-B3 · MUSA Bloque B3 — Hoy profesional que se puede abrir (29/10/2026)
// Capturas comparativas a 412x915 del área profesional, en dos modos:
//   node b3.mjs antes    → con la producción actual (titular que cuenta
//                          canceladas, canceladas a pleno peso)
//   node b3.mjs despues  → tras el arreglo B3 (por atender, canceladas
//                          relegadas, títulos por vista)
// Dos pantallas: Hoy (día real cargado de QA) y Agenda (con el 30/10
// escenificado: vivas y decenas de canceladas a las 10:00).
// La clave profesional se lee del fichero del servidor; NUNCA se imprime.
// Además de navegar, este guion comprueba por DOM el titular visible de
// cada vista al cambiar de pestaña (los títulos por vista de B3).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const RAIZ = '/data/la-asistenta/web';
const OUT = `${RAIZ}/qa-b3/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const CLAVE = readFileSync(`${RAIZ}/profesional.env`, 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9363', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b3-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9363/json/version');
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
async function shot(nombre, completa = false) {
  let params = { format: 'png', captureBeyondViewport: completa };
  if (completa) {
    const { result: { contentSize } } = await S('Page.getLayoutMetrics');
    params.clip = { x: 0, y: 0, width: contentSize.width,
                    height: Math.ceil(contentSize.height), scale: 1 };
  }
  const r = await S('Page.captureScreenshot', params);
  const data = r.result?.data || r.data;
  if (!data) throw new Error('sin datos de captura');
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
}
async function esperar(expr, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evalJs(expr)) return true;
    await sleep(300);
  }
  throw new Error('timeout esperando: ' + expr);
}

/* ---------- acceso al panel ---------- */
await S('Page.navigate', { url: WEB + '/profesional' });
await esperar(`!!document.querySelector('#clave')`);
await evalJs(`document.querySelector('#clave').value = ${JSON.stringify(CLAVE)};
              document.querySelector('#clave').dispatchEvent(new Event('input', {bubbles:true}))`);
await evalJs(`document.querySelector('#btn-entrar').click()`);
await esperar(`!document.querySelector('#vista-panel').classList.contains('oculto')
               && document.querySelectorAll('#hoy-citas .cita, #hoy-citas .vacio').length > 0`);
await sleep(600);

const resumenAntes = await evalJs(`document.querySelector('#hoy-resumen')?.innerText || ''`);
const titularHoy = await evalJs(`document.querySelector('#panel-titulo')?.innerText || ''`);
await shot('hoy');
await shot('hoy-completa', true);

/* ---------- agenda ---------- */
await evalJs(`document.querySelector('[data-tab="agenda"]').click()`);
await esperar(`document.querySelectorAll('#agenda-dias .dia').length >= 7`);
await sleep(500);
const titularAgenda = await evalJs(`document.querySelector('#panel-titulo')?.innerText || ''`);
await shot('agenda');
await shot('agenda-completa', true);

/* ---------- títulos por vista (comprobación B3) ---------- */
const titulos = { hoy: titularHoy, agenda: titularAgenda };
for (const tab of ['espera', 'panel', 'hoy']) {
  await evalJs(`document.querySelector('[data-tab="${tab}"]').click()`);
  await sleep(400);
  titulos[tab] = await evalJs(`document.querySelector('#panel-titulo')?.innerText || ''`);
}

console.log(JSON.stringify({ modo: MODO, resumen: resumenAntes.replace(/\n/g, ' · '),
  titulos, erroresConsola }, null, 1));
chrome.kill();
process.exit(0);
