// QA-B1 · MUSA Bloque B1 — contraste AA del texto de apoyo (29/10/2026)
// Capturas comparativas a 412x915 contra la app real, en dos modos:
//   node b1.mjs antes    → con la producción actual (gris #747a8d, etc.)
//   node b1.mjs despues  → tras aplicar los valores nuevos de B1
// Tres pantallas: Inicio (placeholder + textos --gris), Reserva paso 2
// (calendario: días pasados en gris >=3:1 y domingos con tratamiento
// rosa propio) y Profesional·Hoy (textos --gris y chip de estado).
// La clave profesional se lee del fichero del servidor; NUNCA se imprime.
// No crea ni cancela citas: solo navega y captura.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const RAIZ = '/data/la-asistenta/web';
const OUT = `${RAIZ}/qa-b1/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const CLAVE = readFileSync(`${RAIZ}/profesional.env`, 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9361', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b1-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9361/json/version');
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
  const data = r.result?.data || r.data;
  if (!data) throw new Error('sin datos de captura');
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
  copyFileSync(`${OUT}/${nombre}.png`, `${RAIZ}/icons/b1-${MODO}-${nombre}.png`);
  console.log('captura:', nombre);
}
async function esperar(fn, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evalJs(fn)) return true;
    await sleep(400);
  }
  return false;
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO-ESTA'; el.click(); return 'ok'; })()`);

/* 1 · Inicio: placeholder del buscador y textos de apoyo en --gris */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`!!document.querySelector('#inp-buscar-home')`);
await esperar(`document.querySelectorAll('#p-inicio .reco-card, #p-inicio .salon-card').length >= 1`);
await sleep(1800); // fotos y fundidos
await shot('inicio');

/* 2 · Reserva paso 2: el calendario del mes en curso */
await clic('#pastilla-reservar');
await sleep(800);
await esperar(`!document.getElementById('btn-paso1-siguiente').disabled`);
await clic('#btn-paso1-siguiente');
await esperar(`document.querySelectorAll('#cal-rejilla .cal-dia').length >= 28`);
await sleep(900);
await shot('calendario');

/* 3 · Profesional · Hoy */
await S('Page.navigate', { url: WEB + '/profesional' });
await esperar(`!!document.getElementById('clave')`);
await evalJs(`document.getElementById('clave').value = ${JSON.stringify(CLAVE)}`);
await clic('#btn-entrar');
await esperar(`(() => { const p = document.getElementById('vista-panel'); return p && !p.classList.contains('oculto'); })()`);
await sleep(1800); // las vistas del panel cargan por API
await shot('profesional');

console.log('errores de consola:', erroresConsola.length, JSON.stringify(erroresConsola.slice(0, 5)));
chrome.kill();
process.exit(0);
