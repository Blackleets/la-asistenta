// QA-B2 · MUSA Bloque B2 — el resultado habla como orientación (29/10/2026)
// Recorrido REAL contra la app en la máquina (127.0.0.1:8090), a 412×915:
//   análisis con la foto de ejemplo → pantalla de resultado COMPLETA
//   (captura de página entera + detalle de la tarjeta de recomendación)
//   → clic en «Reservar este servicio» → paso 2 de la reserva.
// Dos modos con carpetas propias:  node b2.mjs antes | despues
// Extrae además los datos verificables del resultado (textos, colores
// computados, orden de acciones) a resultado.json. NO confirma ninguna
// reserva: el recorrido se detiene en el paso 2.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = `/data/la-asistenta/web/qa-b2/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9382', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa-b2-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9382/json/version');
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
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });

async function evalJs(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
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

// ---- recorrido: Inicio → Probador → consentimiento → foto de ejemplo ----
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await clic('#nav-probador'); await sleep(700);
await clic('#btn-prob-cejas'); await sleep(700);
await clic('#check-consentimiento'); await sleep(300);
await clic('#btn-ir-foto'); await sleep(700);
await clic('#btn-foto-ejemplo');
await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
await sleep(400);

// ---- análisis real ----
const t0 = Date.now();
await clic('#btn-analizar');
const listo = await esperar(`document.getElementById('p-resultado').classList.contains('activa')`, 300000);
const latencia = Math.round((Date.now() - t0) / 100) / 10;
if (!listo) {
  writeFileSync(`${OUT}/resultado.json`, JSON.stringify({ modo: MODO, listo: false, latencia, erroresConsola }, null, 2));
  console.log('B2', MODO, '· SIN RESULTADO tras', latencia, 's · errores:', erroresConsola.length);
  try { ws.close(); } catch {}
  chrome.kill();
  process.exit(1);
}
await sleep(1000); // la cascada de entrada (QA20) termina en ~0,5 s

// ---- datos verificables del resultado ----
const datos = await evalJs(`(() => {
  const q = s => document.querySelector(s);
  const color = s => { const el = q(s); return el ? getComputedStyle(el).color : null; };
  const visibles = [...document.querySelectorAll('#p-resultado .btn, #p-resultado .enlace')]
    .filter(e => e.offsetParent !== null).map(e => e.id);
  return {
    resumen: q('#res-resumen')?.textContent || '',
    rasgos: [...document.querySelectorAll('#res-chips .rasgo')].map(r => r.textContent.replace(/\\s+/g, ' ').trim()),
    chipsFrase: document.querySelectorAll('#res-chips .chip').length,
    consejo: q('#res-consejo')?.textContent || '',
    etiqueta: q('.reco .etiqueta')?.textContent || '',
    colorEtiqueta: color('.reco .etiqueta'),
    recoNombre: q('#reco-nombre')?.textContent || '',
    recoDatos: q('#reco-datos')?.textContent || '',
    colorDatos: color('.reco .datos'),
    recoMotivo: q('#reco-motivo')?.textContent || '',
    orientacionEnTarjeta: q('#reco-orientacion')?.textContent || null,
    aviso: q('#res-aviso')?.textContent || '',
    avisoTrasAcciones: (() => { const a = q('#res-aviso'), b = q('#btn-reiniciar');
      return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING)); })(),
    ordenAccionesVisibles: visibles,
  };
})()`);

// ---- capturas del resultado completo ----
await evalJs(`window.scrollTo(0, 0)`); await sleep(250);
await shotFull('resultado-completo');
await evalJs(`document.querySelector('.tarjeta.reco').scrollIntoView({ block: 'start' })`); await sleep(350);
await shot('resultado-reco');

// ---- recorrido resultado → reserva (paso 2 con el servicio fijado) ----
await clic('#btn-reservar-reco');
const paso2 = await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 20000);
await esperar(`document.querySelectorAll('.hora-fila').length > 0 || /sin huecos|no hay huecos/i.test(document.getElementById('paso-2')?.textContent || '')`, 25000);
await sleep(500);
const resumenReserva = await evalJs(`document.getElementById('rm-txt')?.textContent || ''`);
await evalJs(`window.scrollTo(0, 0)`); await sleep(250);
await shot('reserva-paso2');

const salida = { modo: MODO, listo, latencia, datos, paso2, resumenReserva, erroresConsola };
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(salida, null, 2));
console.log('B2', MODO, '· resultado OK en', latencia, 's · reco:', datos.recoNombre, '·', datos.recoDatos,
  '· etiqueta:', datos.etiqueta, datos.colorEtiqueta, '· datos color:', datos.colorDatos,
  '· rasgos:', datos.rasgos.length, '· chips-frase:', datos.chipsFrase,
  '· paso2:', paso2, '· resumen:', resumenReserva, '· errores consola:', erroresConsola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
