// QA20 · PRUEBA DE ROTURA (skill break-ui) a 412×915, por la frontera
// real de la interfaz (formulario, API interceptada), sin tocar datos:
//  A nombre plausible larguísimo → paso 3, confirmación y Mi cita.
//  B pack de los 4 servicios a la vez → resumen fijo inferior.
//  C día sin huecos (respuesta real interceptada en la frontera fetch).
//  D estados de pulsado reales (ratón mantenido: transform aplicado)
//    y el punto del radio de hora creciendo al seleccionar.
// Todo lo que se crea (una cita) queda cancelado al terminar.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa20/rotura';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { pasos: [], consola: [] };
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9377', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa20-rotura', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9377/json/version');
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
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    R.consola.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200));
  }
  if (m.method === 'Fetch.requestPaused') {
    const url = m.params.request.url;
    if (url.includes('/api/disponibilidad')) {
      const cuerpo = Buffer.from(JSON.stringify({ huecos: [], motivo: 'agenda completa' })).toString('base64');
      S('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: cuerpo });
    } else {
      S('Fetch.continueRequest', { requestId: m.params.requestId });
    }
  }
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
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 250));
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
const DESBORDES = `(() => {
  const mal = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('.carrusel,.videos-fila')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > 412.5 || r.left < -0.5)) {
      mal.push({ tag: el.tagName, cls: String(el.className).slice(0, 44),
        dcha: Math.round(r.right), izq: Math.round(r.left),
        txt: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 34) });
    }
  });
  return { scrollW: document.documentElement.scrollWidth, mal: mal.slice(0, 10) };
})()`;
async function elegirDiaConHuecos() {
  const candidatas = [];
  const base = new Date();
  for (let i = 0; i <= 7 && candidatas.length < 6; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    if (d.getUTCDay() === 0) continue;
    candidatas.push(d.toISOString().slice(0, 10));
  }
  for (const f of candidatas) {
    let celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`);
    if (!celda) { await clic('#cal-sig'); await sleep(600); celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`); }
    if (!celda) continue;
    const habil = await evalJs(`(() => { const c = document.querySelector('.cal-dia[data-fecha="${f}"]'); return !!c && !c.disabled; })()`);
    if (!habil) continue;
    await evalJs(`document.querySelector('.cal-dia[data-fecha="${f}"]').click()`);
    await esperar(`!document.getElementById('huecos').textContent.includes('Consultando')`, 12000);
    const n = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].filter(b => b.style.display !== 'none').length`);
    if (n > 0) return f;
  }
  return null;
}

const entrarReserva = async () => {
  await evalJs(`[...document.querySelectorAll('.pastilla')].find(p => p.textContent.includes('Reservar'))?.click()`);
  await esperar(`document.querySelector('.pantalla.activa')?.id === 'p-reserva'`, 10000);
  await sleep(600);
};

/* ================= A · Nombre larguísimo ================= */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await entrarReserva();
const selA = await evalJs(`estado.seleccion.length`);
await clic('#btn-paso1-siguiente'); await sleep(700);
const fechaA = await elegirDiaConHuecos();
await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
await sleep(300);
await clic('#btn-paso2-siguiente'); await sleep(700);
await evalJs(`(() => {
  const n = document.getElementById('inp-nombre');
  n.value = 'María José de los Ángeles Fernández-Gutiérrez de la Torre';
  n.dispatchEvent(new Event('input', { bubbles: true }));
  const t = document.getElementById('inp-telefono'); t.value = '612345678';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('check-confirma').click();
})()`);
await sleep(400);
const rotA1 = await evalJs(DESBORDES);
await shot('rotura-nombre-paso3');
await clic('#btn-confirmar');
const confA = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 30000);
await sleep(1200);
const rotA2 = await evalJs(DESBORDES);
await shot('rotura-nombre-confirmacion');
const datosA = await evalJs(`(() => ({
  codigo: document.getElementById('conf-codigo')?.textContent.trim(),
  enlace: document.getElementById('conf-ver-cita')?.getAttribute('href'),
}))()`);
R.pasos.push({ nombre: 'A-nombre-largo', seleccionados: selA, fecha: fechaA, confirmada: confA, paso3: rotA1, confirmacion: rotA2, codigo: datosA.codigo });
writeFileSync(`${OUT}/log-rotura.json`, JSON.stringify(R, null, 1));
console.log('A listo', JSON.stringify(R.pasos[R.pasos.length - 1]).slice(0, 300));

/* Cancelar la cita de A por su enlace (limpieza: cancelada, no borrada) */
const token = (datosA.enlace || '').split('/cita/')[1];
if (token) {
  await S('Page.navigate', { url: WEB + '/cita/' + token });
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 15000);
  R.pasos.push({ nombre: 'A-cancelacion', cancelada });
}

/* ================= B · Pack de 4 servicios ================= */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await entrarReserva();
const nSel = await evalJs(`(() => { const cs = [...document.querySelectorAll('.servicio-card')];
  cs.slice(1).forEach(c => c.click()); return estado.seleccion.length; })()`);
await sleep(400);
await clic('#btn-paso1-siguiente'); await sleep(700);
const rotB = await evalJs(DESBORDES);
const miniB = await evalJs(`(() => { const m = document.querySelector('.resumen-mini'); const t = document.getElementById('rm-txt'); const p = document.getElementById('rm-precio');
  const r = m.getBoundingClientRect();
  return { mini: { izq: Math.round(r.left), dcha: Math.round(r.right), alto: Math.round(r.height) },
           txtAncho: t.scrollWidth, txtCliente: t.clientWidth,
           precioVisible: p.getBoundingClientRect().right <= 412 }; })()`);
await shot('rotura-pack4');
R.pasos.push({ nombre: 'B-pack-4', serviciosPulsados: nSel, ...miniB, desbordes: rotB });
writeFileSync(`${OUT}/log-rotura.json`, JSON.stringify(R, null, 1));
console.log('B listo', JSON.stringify(R.pasos[R.pasos.length - 1]).slice(0, 300));

/* ================= C · Día sin huecos (frontera fetch) ================= */
await S('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
await elegirDiaConHuecos().catch(() => null);
await esperar(`document.getElementById('huecos').textContent.includes('No quedan huecos')`, 12000);
await sleep(500);
const rotC = await evalJs(DESBORDES);
const txtC = await evalJs(`document.getElementById('huecos').textContent.trim().replace(/\\s+/g,' ').slice(0,120)`);
await shot('rotura-sin-huecos');
await S('Fetch.disable');
R.pasos.push({ nombre: 'C-sin-huecos', texto: txtC, desbordes: rotC });
writeFileSync(`${OUT}/log-rotura.json`, JSON.stringify(R, null, 1));
console.log('C listo', JSON.stringify(R.pasos[R.pasos.length - 1]).slice(0, 300));

/* ================= D · Pulsado real y radio de hora ================= */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
async function pulsado(sel, extra) {
  const pos = await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await S('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(220);
  const t = await evalJs(extra || `getComputedStyle(document.querySelector(${JSON.stringify(sel)})).transform`);
  await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(200);
  return t;
}
const tBuscador = await pulsado('.buscador-btn');
const tPastilla = await pulsado('.pastilla .p-ico');
const tNav = await pulsado('#nav-explorar');
await evalJs(`ir('p-inicio')`); await sleep(500);
await entrarReserva();
await clic('#btn-paso1-siguiente'); await sleep(700);
const fechaD = await elegirDiaConHuecos();
const diagD = await evalJs(`(() => ({ fecha: ${JSON.stringify(fechaD)},
  filas: document.querySelectorAll('#huecos .hora-fila').length,
  huecosTxt: document.getElementById('huecos').textContent.trim().replace(/\s+/g,' ').slice(0,110),
  pasoActivo: document.querySelector('.paso-panel.activo')?.id }))()`);
const radioAntes = await evalJs(`(() => { const f = document.querySelector('#huecos .hora-fila:not([style*="none"]) .hf-radio'); return f ? getComputedStyle(f, '::after').transform : 'SIN-FILA'; })()`);
await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
await sleep(300);
const radioDespues = await evalJs(`(() => { const f = document.querySelector('#huecos .hora-fila.sel .hf-radio'); return f ? getComputedStyle(f, '::after').transform : 'SIN-SEL'; })()`);
/* :active forzado por CDP (determinista): la pastilla, un día del
   calendario y un segmento deben encoger con su valor exacto. */
await S('DOM.enable'); await S('CSS.enable');
const { result: { root } } = await S('DOM.getDocument', { depth: 1 });
async function forzado(selPadre, selLectura) {
  const { result: { nodeId } } = await S('DOM.querySelector', { nodeId: root.nodeId, selector: selPadre });
  if (!nodeId) return 'SIN-NODO';
  await S('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
  await sleep(320);
  const v = await evalJs(`getComputedStyle(document.querySelector(${JSON.stringify(selLectura)})).transform`);
  await S('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  return v;
}
await evalJs(`ir('p-inicio')`); await sleep(500);
const fPastilla = await forzado('.pastilla', '.pastilla .p-ico');
await evalJs(`ir('p-foto')`); await sleep(600);
const fSeg = await forzado('.segmentos .seg', '.segmentos .seg');
R.pasos.push({ nombre: 'D-pulsados', transformBuscador: tBuscador, transformPastilla: tPastilla,
               transformNav: tNav, forzadoPastilla: fPastilla, forzadoSeg: fSeg,
               diagD, radioAntes, radioDespues });

writeFileSync(`${OUT}/log-rotura.json`, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
