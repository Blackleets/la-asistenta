// QA20 · PASE ESTRELLA DE PULIDO (29/10/2026)
// Recorrido con clics a 412×915 contra la app real, en dos modos:
//   node qa20.mjs antes    → capturas y tiempos de la versión actual
//   node qa20.mjs despues  → las mismas capturas y tiempos tras el pulido
// Mide la carga de Inicio (3 pasadas con caché y SW limpios: domInteractive,
// loadEvent y tiempo hasta que el carrusel «Recomendado» tiene tarjetas),
// captura el ESQUELETO de Inicio con la red estrangulada, la espera real
// del análisis (foto de ejemplo) en dos instantes, el resultado, la
// reserva completa y la confirmación (instante de entrada y estado final).
// La cita creada se llama «QA20 Pulido» y queda CANCELADA al terminar.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa20/' + MODO;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LOG = { fase: 'QA20-' + MODO, tiempos: [], pasos: [], consola: [], resumen: {} };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-${MODO}.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9373', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa20-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9373/json/version');
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
let pasoActual = 'arranque';
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const t = m.params.type;
    if (t === 'error' || t === 'warning') {
      LOG.consola.push({ paso: pasoActual, tipo: 'console.' + t,
        txt: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300) });
    }
  }
  if (m.method === 'Runtime.exceptionThrown') {
    LOG.consola.push({ paso: pasoActual, tipo: 'exception',
      txt: String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300) });
  }
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
    LOG.consola.push({ paso: pasoActual, tipo: 'log.' + (m.params.entry.source || ''),
      txt: String(m.params.entry.text || '').slice(0, 300) });
  }
});
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => { pendientes.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
}
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
async function evalJs(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
async function shot(nombre) {
  const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = r.result?.data || r.data;
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO-ESTA'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};
async function paso(n, nombre, fn, shotName) {
  pasoActual = nombre;
  const t0 = Date.now();
  const reg = { n, nombre, ok: true };
  try { reg.datos = await fn(); }
  catch (e) { reg.ok = false; reg.error = String(e.message || e).slice(0, 300); }
  reg.segundos = Math.round((Date.now() - t0) / 100) / 10;
  try { reg.scrollW = await evalJs(`document.documentElement.scrollWidth`); } catch (e) {}
  if (shotName) { try { await shot(shotName); reg.captura = shotName + '.png'; } catch (e) {} }
  LOG.pasos.push(reg);
  guardarLog();
  console.log('paso', n, nombre, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''), reg.segundos + 's');
  return reg;
}

/* ============ T · Tiempos de carga de Inicio (3 pasadas limpias) ============ */
pasoActual = 'tiempos-inicio';
for (let i = 1; i <= 3; i++) {
  try {
    await S('Network.clearBrowserCache');
    await S('Storage.clearDataForOrigin', { origin: WEB, storageTypes: 'all' });
  } catch (e) {}
  const t0 = Date.now();
  await S('Page.navigate', { url: WEB + '/' });
  const carrusel = await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  const tCarrusel = Date.now() - t0;
  const nav = await evalJs(`(() => { const n = performance.getEntriesByType('navigation')[0] || {};
    return { domInteractive: Math.round(n.domInteractive || 0),
             loadEvent: Math.round(n.loadEventEnd || 0),
             respuesta: Math.round(n.responseEnd || 0) }; })()`);
  LOG.tiempos.push({ pasada: i, carruselListo: carrusel, hastaCarruselMs: tCarrusel, ...nav });
  console.log('tiempo pasada', i, JSON.stringify(LOG.tiempos[LOG.tiempos.length - 1]));
  guardarLog();
}

/* ============ 1 · Inicio con red lenta: el esqueleto ============ */
await paso(1, 'inicio-esqueleto-y-carga', async () => {
  await S('Network.clearBrowserCache');
  await S('Storage.clearDataForOrigin', { origin: WEB, storageTypes: 'all' });
  await S('Network.emulateNetworkConditions',
    { offline: false, latency: 900, downloadThroughput: 460800, uploadThroughput: 460800 });
  await S('Page.navigate', { url: WEB + '/' });
  await sleep(1100);
  await shot('inicio-esqueleto');
  await S('Network.emulateNetworkConditions',
    { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const listo = await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  await sleep(900);
  if (!listo) throw new Error('el carrusel no cargó tras la red lenta');
  return { listo };
}, 'inicio');

/* ============ 2 · Explorar ============ */
await paso(2, 'explorar', async () => {
  await clic('#nav-explorar');
  const ok = await esperar(`document.querySelectorAll('#explorar-grid .prod-card').length >= 4`, 15000);
  await sleep(700);
  if (!ok) throw new Error('Explorar no pobló el catálogo');
  return { tarjetas: await evalJs(`document.querySelectorAll('#explorar-grid .prod-card').length`) };
}, 'explorar');

/* ============ 3 · Análisis: espera por fases y resultado ============ */
let servicioRecomendado = null;
await paso(3, 'analisis-espera-y-resultado', async () => {
  await clic('#nav-probador'); await sleep(800);
  await clic('#btn-prob-cejas'); await sleep(800);
  await clic('#check-consentimiento'); await sleep(300);
  await clic('#btn-ir-foto'); await sleep(800);
  await clic('#btn-foto-ejemplo');
  const previaOk = await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
  if (!previaOk) throw new Error('la foto de ejemplo no cargó');
  await sleep(400);
  const t0 = Date.now();
  await clic('#btn-analizar');
  await sleep(2200);
  await shot('analisis-espera-1');
  const texto1 = await evalJs(`document.getElementById('cargando-analisis')?.textContent.trim().replace(/\\s+/g,' ').slice(0,160)`);
  const resto = 9000 - (Date.now() - t0);
  if (resto > 0) await sleep(resto);
  const yaResultado = await evalJs(`document.getElementById('p-resultado').classList.contains('activa')`);
  if (!yaResultado) {
    await shot('analisis-espera-2');
  }
  const texto2 = await evalJs(`document.getElementById('cargando-analisis')?.textContent.trim().replace(/\\s+/g,' ').slice(0,160)`);
  const listo = await esperar(
    `document.getElementById('p-resultado').classList.contains('activa') || document.getElementById('error-foto').textContent.trim().length > 0`,
    300000);
  const latenciaS = Math.round((Date.now() - t0) / 100) / 10;
  await sleep(800);
  const resultado = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    recomendado: document.getElementById('reco-nombre')?.textContent.trim(),
    errorFoto: document.getElementById('error-foto')?.textContent.trim(),
  }))()`);
  if (!listo || resultado.activa !== 'p-resultado' || !resultado.recomendado)
    throw new Error('sin resultado de análisis: ' + JSON.stringify(resultado).slice(0, 200));
  servicioRecomendado = resultado.recomendado;
  LOG.resumen.latenciaAnalisisS = latenciaS;
  LOG.resumen.textoEspera1 = texto1;
  LOG.resumen.textoEspera2 = texto2;
  return { latenciaS, recomendado: servicioRecomendado, textoEspera1: texto1, textoEspera2: texto2 };
}, 'analisis-resultado');

/* ============ 4 · Reserva y confirmación ============ */
let codigo = null, token = null;
await paso(4, 'reserva-y-confirmacion', async () => {
  if (!servicioRecomendado) throw new Error('sin servicio recomendado del paso 3');
  await clic('#btn-reservar-reco');
  const enReserva = await esperar(`document.querySelector('.pantalla.activa')?.id === 'p-reserva' &&
    document.getElementById('paso-2')?.classList.contains('activo')`, 15000);
  if (!enReserva) throw new Error('no llevó al paso 2');
  const candidatas = [];
  const base = new Date();
  for (let i = 0; i <= 7 && candidatas.length < 6; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    if (d.getUTCDay() === 0) continue;
    candidatas.push(d.toISOString().slice(0, 10));
  }
  let fechaElegida = null;
  for (const f of candidatas) {
    let celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`);
    if (!celda) { await clic('#cal-sig'); await sleep(600); celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`); }
    if (!celda) continue;
    const habil = await evalJs(`(() => { const c = document.querySelector('.cal-dia[data-fecha="${f}"]'); return !!c && !c.disabled; })()`);
    if (!habil) continue;
    await evalJs(`document.querySelector('.cal-dia[data-fecha="${f}"]').click()`);
    await esperar(`!document.getElementById('huecos').textContent.includes('Consultando')`, 12000);
    const n = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].filter(b => b.style.display !== 'none').length`);
    if (n > 0) { fechaElegida = f; break; }
  }
  if (!fechaElegida) throw new Error('ningún día con huecos en 7 días');
  await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
  await sleep(400);
  const horaElegida = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
  if (!horaElegida) throw new Error('no se pudo elegir hora');
  await clic('#btn-paso2-siguiente'); await sleep(700);
  await evalJs(`(() => {
    const n = document.getElementById('inp-nombre'); n.value = 'QA20 Pulido';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('inp-notas'); t.value = 'Cita del pase de pulido QA20 (29/10). Se cancela al terminar.';
    document.getElementById('check-confirma').click();
  })()`);
  await sleep(300);
  await shot('reserva-paso3');
  await clic('#btn-confirmar');
  const t0 = Date.now();
  let confirmada = false;
  while (Date.now() - t0 < 30000) {
    confirmada = await evalJs(`document.getElementById('p-confirmada').classList.contains('activa')`);
    if (confirmada) break;
    await sleep(60);
  }
  if (!confirmada) throw new Error('la confirmación no llegó');
  await shot('confirmacion-instante');
  await sleep(1100);
  const datos = await evalJs(`(() => ({
    codigo: document.getElementById('conf-codigo')?.textContent.trim(),
    enlace: document.getElementById('conf-ver-cita')?.getAttribute('href'),
    detalle: document.getElementById('conf-detalle')?.textContent.trim().replace(/\\s+/g,' ').slice(0,160),
  }))()`);
  codigo = datos.codigo;
  token = (datos.enlace || '').split('/cita/')[1] || null;
  LOG.resumen.codigo = codigo;
  return { fechaElegida, horaElegida, ...datos, enlace: undefined };
}, 'confirmacion');

/* ============ 5 · Cancelar la cita de QA20 ============ */
await paso(5, 'cancelar-la-cita', async () => {
  if (!token) throw new Error('sin token de la reserva');
  await S('Page.navigate', { url: WEB + '/cita/' + token });
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await clic('#btn-cancelar'); await sleep(600);
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 15000);
  if (!cancelada) throw new Error('la cancelación no quedó confirmada');
  return { cancelada, codigo };
});

LOG.resumen.erroresConsola = LOG.consola.length;
guardarLog();
console.log(`QA20 ${MODO} COMPLETO · pasos OK: ${LOG.pasos.filter(p => p.ok).length}/${LOG.pasos.length} · errores de consola: ${LOG.consola.length}`);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
