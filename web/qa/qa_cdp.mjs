// QA visual de la web de la clienta a 412x915 conduciendo Chromium por CDP.
// Recorre el flujo real: inicio -> consentimiento -> foto (ejemplo) ->
// análisis real -> resultado -> reserva con huecos reales. Captura cada pantalla.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const URL = 'http://127.0.0.1:8090/';
const OUT = '/data/la-asistenta/web/qa';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9333', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json/version');
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
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
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

await S('Page.navigate', { url: URL });
await sleep(3000);
await shot('01-inicio');

await click('#btn-ir-consentimiento'); await sleep(700);
await shot('02-consentimiento');

await evalJs(`document.querySelector('#check-consentimiento').click()`);
await click('#btn-ir-foto'); await sleep(700);
await click('#btn-foto-ejemplo'); await sleep(2500);
await shot('03-foto');

await click('#btn-analizar');
let listo = false;
for (let i = 0; i < 60 && !listo; i++) {
  await sleep(2500);
  listo = await evalJs(`document.querySelector('#p-resultado').classList.contains('activa')`);
}
console.log('resultado activo:', listo);
await sleep(600);
await shot('04-resultado');

await click('#btn-reservar-reco'); await sleep(900);
const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
await evalJs(`(()=>{const f=document.querySelector('#inp-fecha');f.value='${manana}';` +
             `f.dispatchEvent(new Event('change'));})()`);
await sleep(2200);
const nHuecos = await evalJs(`document.querySelectorAll('.hueco').length`);
console.log('huecos pintados:', nHuecos);
await shot('05-reserva');

ws.close(); chrome.kill();
console.log('QA TERMINADA');
