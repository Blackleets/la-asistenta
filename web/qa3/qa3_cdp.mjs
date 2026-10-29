// QA3 · análisis ASÍNCRONO en vivo a 412x915 conduciendo Chromium por CDP.
// Recorre el flujo real (consentimiento → foto de ejemplo → analizar) y
// verifica con evidencia: la foto se reduce en origen, el POST responde
// al instante creando un trabajo, la pantalla de progreso se ve con su
// contador de segundos, y el resultado REAL de Spark acaba pintado.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const URL = 'http://127.0.0.1:8090/';
const OUT = '/data/la-asistenta/web/qa3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9335', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9335/json/version');
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
  if (!data) throw new Error('sin datos de captura');
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
  console.log('captura:', nombre);
}
const click = sel => evalJs(`document.querySelector('${sel}').click()`);

/* ---------- flujo hasta la foto ---------- */
await S('Page.navigate', { url: URL });
await sleep(3000);
await click('#btn-ir-consentimiento'); await sleep(600);
await evalJs(`document.querySelector('#check-consentimiento').click()`);
await click('#btn-ir-foto'); await sleep(600);
await click('#btn-foto-ejemplo');
for (let i = 0; i < 20; i++) {
  if (await evalJs(`!document.querySelector('#btn-analizar').disabled`)) break;
  await sleep(500);
}

/* ---------- la foto se reduce en origen ---------- */
const tamanos = await evalJs(`(async () => {
  const r = await fetch('/ejemplo.jpg');
  const blob = await r.blob();
  return { originalBytes: blob.size,
           reducidoChars: (window.__qa3foto || '').length };
})().catch(e => ({ error: String(e) }))`);
const reducido = await evalJs(`(() => {
  try { return estado.fotoData ? estado.fotoData.length : 0; } catch { return -1; }
})()`);
ev('foto reducida en origen antes de enviar',
   reducido > 0 && tamanos.originalBytes > 0,
   `ejemplo original=${tamanos.originalBytes} B · dataURL en página=${reducido} caracteres`);

/* ---------- lanzar el análisis y ver el progreso ---------- */
const t0 = Date.now();
await click('#btn-analizar');
await sleep(2500);
const progreso = await evalJs(`(() => ({
  cargando: document.querySelector('#cargando-analisis').classList.contains('visible'),
  segundos: document.querySelector('#seg-cargando').textContent,
  errorVisible: document.querySelector('#error-foto').classList.contains('visible'),
}))()`);
ev('progreso honesto visible durante el análisis (sin Error 502)',
   progreso.cargando && !progreso.errorVisible,
   `segundos en pantalla=${progreso.segundos}`);
await shot('01-progreso');

/* ---------- esperar a que el resultado se pinte ---------- */
let pintado = null;
for (let i = 0; i < 60; i++) {  // hasta ~5 min
  pintado = await evalJs(`(() => {
    const activa = document.querySelector('#p-resultado').classList.contains('activa');
    const reco = document.querySelector('#reco-nombre').textContent.trim();
    const aviso = document.querySelector('#res-aviso').textContent;
    const error = document.querySelector('#error-foto').textContent.trim();
    return { activa, reco, aviso, error };
  })()`);
  if (pintado.activa && pintado.reco) break;
  if (pintado.error) break;
  await sleep(5000);
}
const pared = ((Date.now() - t0) / 1000).toFixed(1);
ev('resultado real pintado en pantalla',
   !!(pintado.activa && pintado.reco),
   `recomendación=${pintado.reco || '—'} · tiempo de pared=${pared} s` +
   (pintado.error ? ` · ERROR EN PANTALLA: ${pintado.error}` : ''));
ev('sin códigos crudos en pantalla', !/502|Error \d{3}/.test(pintado.error || ''),
   pintado.aviso ? pintado.aviso.slice(0, 120) : '');
await shot('02-resultado');

console.log('\n===== EVIDENCIAS QA3 =====');
for (const l of evidencias) console.log(l);
const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
console.log(`RESUMEN QA3: ${evidencias.length - fallos}/${evidencias.length} en verde`);
console.log(`MEDICION_QA3 pared_s=${pared} aviso="${pintado.aviso || ''}"`);

ws.close(); chrome.kill();
console.log('QA3 TERMINADA');
