// QA5 · INTERFAZ tipo app de reservas a 412x915 conduciendo Chromium por
// CDP. Recorre TODAS las pantallas nuevas con clics y captura evidencia:
// inicio con tarjetas de servicio → análisis (foto de ejemplo, análisis
// real) → resultado con CTA → reserva por pasos (1 servicio → 2 día y
// hora con tira de días y píldoras → 3 datos con tarjeta «Tu cita») →
// confirmación con código grande y enlace mágico. Al final cancela la
// cita de prueba en la agenda (queda CANCELADA, no se borra).
// Las capturas van a web/qa4/ como exige la fase de interfaz.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const AGENDA = 'http://127.0.0.1:8081';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa4';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9337', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9337/json/version');
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
const sinDesborde = async nombre => {
  const ok = await evalJs(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  ev(`sin desborde horizontal en ${nombre}`, !!ok);
};

/* ---------- 1 · inicio: servicios como tarjetas ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(3000);
const tarjetas = await evalJs(`(() => {
  const cs = [...document.querySelectorAll('#carta-inicio .servicio-card')];
  return { n: cs.length,
           conPrecio: cs.every(c => /€|Consultar/.test(c.textContent)),
           conCta: cs.every(c => c.textContent.includes('Reservar')) };
})()`);
ev('inicio: 4 servicios como tarjetas ricas con precio y CTA',
   tarjetas.n === 4 && tarjetas.conPrecio && tarjetas.conCta, `n=${tarjetas.n}`);
await shot('ui-01-inicio');
await sinDesborde('inicio');

/* ---------- 2 · análisis: consentimiento → foto → análisis real ---------- */
await click('#btn-ir-consentimiento'); await sleep(600);
await evalJs(`document.querySelector('#check-consentimiento').click()`);
await click('#btn-ir-foto'); await sleep(600);
await click('#btn-foto-ejemplo');
for (let i = 0; i < 20; i++) {
  if (await evalJs(`!document.querySelector('#btn-analizar').disabled`)) break;
  await sleep(500);
}
await shot('ui-02-analisis');
await sinDesborde('análisis');
await click('#btn-analizar');
let resultadoOk = false, errorAnalisis = '';
for (let i = 0; i < 80; i++) {
  await sleep(3000);
  resultadoOk = await evalJs(
    `document.querySelector('#p-resultado').classList.contains('activa')`);
  if (resultadoOk) break;
  errorAnalisis = await evalJs(
    `document.querySelector('#error-foto').textContent || ''`);
  if (errorAnalisis) break;
}
ev('análisis real completado hasta el resultado', resultadoOk, errorAnalisis);
const reco = await evalJs(`document.querySelector('#reco-nombre').textContent`);
ev('resultado: tarjeta de recomendación con servicio de la carta',
   ['Diseño de cejas', 'Ombré Brows Henna', 'Brow Lamination', 'Depilación rápida'].includes(reco),
   reco);
await shot('ui-03-resultado');
await sinDesborde('resultado');

/* ---------- 3 · desde el CTA al paso 2, y vuelta al paso 1 ---------- */
await click('#btn-reservar-reco'); await sleep(800);
ev('CTA «Reservar este servicio» lleva al paso 2 con el servicio elegido',
   await evalJs(`document.querySelector('#paso-2').classList.contains('activo') &&
     document.querySelector('#rm-txt').textContent.includes('${reco}')`));
for (let i = 0; i < 20; i++) {
  if (await evalJs(`document.querySelectorAll('#huecos .hueco').length > 0`)) break;
  await sleep(500);
}
const tira = await evalJs(`(() => {
  const ds = [...document.querySelectorAll('#tira-dias .dia')];
  return { n: ds.length,
           sel: document.querySelectorAll('#tira-dias .dia.sel').length,
           cerrado: ds.some(d => d.classList.contains('cerrado')) };
})()`);
ev('paso 2: tira de días (14, con domingo cerrado) y día marcado',
   tira.n === 14 && tira.sel === 1 && tira.cerrado, JSON.stringify(tira));
await shot('ui-05-reserva-paso2');
await sinDesborde('reserva paso 2');
await click('#btn-paso2-volver'); await sleep(500);
ev('paso 1: tarjetas de servicio seleccionables con una marcada',
   await evalJs(`document.querySelectorAll('#res-servicios .servicio-card.sel').length === 1`));
await shot('ui-04-reserva-paso1');
await click('#btn-paso1-siguiente'); await sleep(800);

/* ---------- 4 · paso 3 con la tarjeta «Tu cita» y confirmación ---------- */
await evalJs(`document.querySelector('#huecos .hueco:not([data-extra])').click()`);
await sleep(300);
const horaElegida = await evalJs(
  `document.querySelector('#huecos .hueco.sel')?.dataset.hora || ''`);
ev('paso 2: hora elegida como píldora', !!horaElegida, horaElegida);
await click('#btn-paso2-siguiente'); await sleep(500);
await evalJs(`document.querySelector('#inp-nombre').value = 'PRUEBA QA UI'`);
await evalJs(`document.querySelector('#inp-nombre').dispatchEvent(new Event('input'))`);
await evalJs(`document.querySelector('#inp-telefono').value = '600123456'`);
await evalJs(`document.querySelector('#check-confirma').click()`);
await sleep(300);
const resumen = await evalJs(`(() => ({
  servicio: document.querySelector('#tc-servicio').textContent,
  hora: document.querySelector('#tc-hora').textContent,
  precio: document.querySelector('#tc-precio').textContent,
  confirmar: !document.querySelector('#btn-confirmar').disabled }))()`);
ev('paso 3: tarjeta «Tu cita» completa y confirmar activo',
   resumen.servicio === reco && resumen.hora === horaElegida &&
   /€|Consultar/.test(resumen.precio) && resumen.confirmar,
   JSON.stringify(resumen));
await shot('ui-06-reserva-paso3');
await sinDesborde('reserva paso 3');
await click('#btn-confirmar');
let confirmada = false;
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  confirmada = await evalJs(
    `document.querySelector('#p-confirmada').classList.contains('activa')`);
  if (confirmada) break;
}
const conf = await evalJs(`(() => ({
  codigo: document.querySelector('#conf-codigo').textContent,
  enlace: document.querySelector('#conf-enlace').textContent,
  verCita: document.querySelector('#conf-ver-cita').getAttribute('href') || '' }))()`);
ev('confirmación: pantalla de éxito con código grande y enlace mágico',
   confirmada && /^AS-/.test(conf.codigo) && conf.enlace.includes('/cita/') &&
   conf.verCita === conf.enlace,
   `codigo=${conf.codigo}`);
await shot('ui-07-confirmacion');
await sinDesborde('confirmación');

/* ---------- limpieza: la cita de prueba queda CANCELADA ---------- */
const fecha = await evalJs(`document.querySelector('#inp-fecha').value`);
const dia = await (await fetch(`${AGENDA}/citas?fecha=${fecha}`, {
  headers: { 'X-API-Token': 'la-asistenta-dev' },
})).json();
const mia = dia.citas.find(c => c.nombre === 'PRUEBA QA UI' && c.estado === 'confirmada');
if (mia) {
  const r = await fetch(`${AGENDA}/citas/${mia.id}/cancelar`, {
    method: 'POST', headers: { 'X-API-Token': 'la-asistenta-dev' },
    body: '{}',
  });
  const d = await r.json();
  ev('limpieza: cita de prueba cancelada en la agenda',
     d.cita?.estado === 'cancelada', `id=${mia.id}`);
} else {
  ev('limpieza: cita de prueba cancelada en la agenda', false, 'no localizada');
}

console.log('\n' + evidencias.join('\n'));
const fallos = evidencias.filter(e => e.startsWith('FALLO')).length;
console.log(`\nRESUMEN QA5: ${evidencias.length - fallos}/${evidencias.length} evidencias en verde`);
chrome.kill();
process.exit(0);
