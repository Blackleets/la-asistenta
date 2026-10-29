// QA4 · página del ENLACE MÁGICO a 412x915 conduciendo Chromium por CDP.
// Crea una cita de prueba por la API de agenda, abre su enlace personal
// y recorre con clics: ver la cita (código AS-XXXX) → mini-formulario de
// preparación → reagendar a otro hueco real → cancelar. La cita termina
// CANCELADA (semántica del sistema: no se borra).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const AGENDA = 'http://127.0.0.1:8081';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa4';
const FECHA = '2026-11-13'; // viernes
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

/* ---------- cita de prueba vía API (trae enlace + código) ---------- */
const creada = await (await fetch(AGENDA + '/citas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Token': 'la-asistenta-dev' },
  body: JSON.stringify({
    nombre: 'PRUEBA QA ENLACE', servicio: 'Diseño de cejas',
    fecha: FECHA, hora: '10:00', telefono: '+34600123456', origen: 'web',
  }),
})).json();
const cita = creada.cita;
const token = cita.enlace.split('/').pop();
ev('cita de prueba creada con enlace', !!token && cita.codigo?.startsWith('AS-'),
   `id=${cita.id} codigo=${cita.codigo}`);

/* ---------- Chromium por CDP ---------- */
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9336', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9336/json/version');
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
const visible = sel => evalJs(`(() => { const e = document.querySelector('${sel}');
  return !!e && e.offsetParent !== null; })()`);

/* ---------- 1 · ver la cita ---------- */
await S('Page.navigate', { url: `${WEB}/cita/${token}` });
await sleep(2500);
ev('la cita se ve con su código', await evalJs(
  `document.querySelector('#cita-codigo').textContent === '${cita.codigo}'`),
  await evalJs(`document.querySelector('#cita-datos').textContent`));
await shot('01-cita');

/* ---------- 2 · mini-formulario de preparación ---------- */
await click('#prep-tratamiento .seg[data-valor="Sí"]');
await sleep(300);
await evalJs(`document.querySelector('#prep-cual').value = 'Henna hace 2 semanas'`);
await click('#prep-retinol .seg[data-valor="No"]');
await click('#btn-prep');
await sleep(1500);
ev('prep guardado con confirmación visible', await evalJs(
  `document.querySelector('#prep-ok').classList.contains('visible')`),
  await evalJs(`document.querySelector('#prep-ok').textContent`));
await shot('02-prep');

/* ---------- 3 · reagendar a otro hueco real ---------- */
const hayHueco = await evalJs(
  `!!document.querySelector('#huecos .hueco[data-hora="12:00"]')`);
ev('rejilla de reagendar con huecos reales', hayHueco);
if (hayHueco) {
  await click('#huecos .hueco[data-hora="12:00"]');
  await sleep(300);
  await click('#btn-reagendar');
  await sleep(1500);
  ev('reagendada a las 12:00 con aviso', await evalJs(
    `document.querySelector('#reagendar-ok').classList.contains('visible')`),
    await evalJs(`document.querySelector('#reagendar-ok').textContent`));
  ev('la tarjeta muestra la nueva hora', await evalJs(
    `document.querySelector('#cita-datos').textContent.includes('12:00')`));
}
await shot('03-reagendada');

/* ---------- 4 · cancelar (queda CANCELADA) ---------- */
await evalJs(`document.querySelector('#tarjeta-cancelar').scrollIntoView()`);
await sleep(400);
await click('#btn-cancelar');
await sleep(400);
await click('#btn-cancelar-si');
await sleep(1500);
ev('la página muestra la cita CANCELADA', await visible('#cancelada'));
await shot('04-cancelada');

/* ---------- verificación en la agenda real ---------- */
const dia = await (await fetch(`${AGENDA}/citas?fecha=${FECHA}`, {
  headers: { 'X-API-Token': 'la-asistenta-dev' },
})).json();
const final = dia.citas.find(c => c.id === cita.id);
ev('en la agenda: la cita quedó cancelada, con prep y hora 12:00',
   final?.estado === 'cancelada' && final?.hora === '12:00' && !!final?.prep,
   `estado=${final?.estado} hora=${final?.hora} prep=${JSON.stringify(final?.prep)}`);

console.log('\n' + evidencias.join('\n'));
const fallos = evidencias.filter(e => e.startsWith('FALLO')).length;
console.log(`\nRESUMEN QA4: ${evidencias.length - fallos}/${evidencias.length} evidencias en verde`);
chrome.kill();
process.exit(0);
