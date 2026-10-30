// QA20 · foto fija de la ESPERA del análisis con el panel de carga en
// cuadro (en el recorrido normal queda bajo el pliegue). Solo captura:
// la fase a los ~3,5 s y a los ~11 s, y verifica que llega el resultado.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa20/despues';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9375', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa20-fase', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9375/json/version');
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
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 200));
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
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await clic('#nav-probador'); await sleep(700);
await clic('#btn-prob-cejas'); await sleep(700);
await clic('#check-consentimiento'); await sleep(300);
await clic('#btn-ir-foto'); await sleep(700);
await clic('#btn-foto-ejemplo');
await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
await sleep(400);
const t0 = Date.now();
await clic('#btn-analizar');
await evalJs(`document.getElementById('cargando-analisis').scrollIntoView({ block: 'center' })`);
await sleep(3500 - (Date.now() - t0));
await shot('analisis-espera-fase1');
const f1 = await evalJs(`document.getElementById('fase-analisis')?.textContent`);
const resto = 11000 - (Date.now() - t0);
if (resto > 0) await sleep(resto);
await evalJs(`document.getElementById('cargando-analisis').scrollIntoView({ block: 'center' })`);
await shot('analisis-espera-fase2');
const f2 = await evalJs(`document.getElementById('fase-analisis')?.textContent`);
const listo = await esperar(`document.getElementById('p-resultado').classList.contains('activa')`, 300000);
console.log('FASE1:', f1, '| FASE2:', f2, '| resultado:', listo, '| latencia:', Math.round((Date.now() - t0) / 100) / 10, 's');
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
