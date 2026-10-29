// QA18-B · ANÁLISIS DE CEJAS E2E (29/10/2026) — consentimiento →
// foto de EJEMPLO del proyecto (stock autorizado, ninguna persona
// real) → sondeo → resultado real de Muse Spark → guardar look →
// Probador y Perfil. Incluye los caminos de error del análisis
// (sin foto, foto inválida vía API) y la latencia real medida.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa18';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LOG = { fase: 'B', paradas: [], consola: [] };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-b.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9363', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa18-perfil-b', 'about:blank',
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
let paradaActual = 'arranque';
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const t = m.params.type;
    if (t === 'error' || t === 'warning') {
      LOG.consola.push({ parada: paradaActual, tipo: 'console.' + t,
        txt: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300) });
    }
  }
  if (m.method === 'Runtime.exceptionThrown') {
    LOG.consola.push({ parada: paradaActual, tipo: 'exception',
      txt: String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300) });
  }
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
    LOG.consola.push({ parada: paradaActual, tipo: 'log.' + (m.params.entry.source || ''),
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
async function parada(nombre, fn, shotName) {
  paradaActual = nombre;
  const reg = { nombre, ok: true };
  try { reg.datos = await fn(); }
  catch (e) { reg.ok = false; reg.error = String(e.message || e).slice(0, 300); }
  try { reg.medidas = await evalJs(`(() => ({ scrollW: document.documentElement.scrollWidth, activa: (document.querySelector('.pantalla.activa') || {}).id || location.pathname }))()`); } catch (e) {}
  if (shotName) { try { await shot(shotName); reg.captura = shotName + '.png'; } catch (e) {} }
  LOG.paradas.push(reg);
  guardarLog();
  console.log('parada', nombre, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''));
  return reg;
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO-ESTA'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(600);
  }
  return false;
};

await S('Page.navigate', { url: WEB + '/' });
await sleep(4500);

/* ---------- 1 · Consentimiento (gate real) ---------- */
await parada('consentimiento-gate', async () => {
  await clic('#nav-probador'); await sleep(900);
  await clic('#btn-prob-cejas'); await sleep(900);
  const sinAceptar = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    btnIrFotoDisabled: document.getElementById('btn-ir-foto')?.disabled,
    checkMarcado: document.getElementById('check-consentimiento')?.checked,
  }))()`);
  await shot('c01-consentimiento');
  await clic('#check-consentimiento'); await sleep(400);
  const trasAceptar = await evalJs(`document.getElementById('btn-ir-foto')?.disabled`);
  await clic('#btn-ir-foto'); await sleep(900);
  const destino = await evalJs(`document.querySelector('.pantalla.activa')?.id`);
  return { sinAceptar, btnDisabledTrasAceptar: trasAceptar, destino };
}, 'c02-foto-vacia');

/* ---------- 2 · Foto: estado vacío y «sin foto» ---------- */
await parada('foto-estado-vacio', async () => {
  const estado = await evalJs(`(() => ({
    btnAnalizarDisabled: document.getElementById('btn-analizar')?.disabled,
    accionesVisibles: document.getElementById('acciones-foto')?.style.display,
    imgPreviaVisible: !!document.getElementById('img-previa')?.getAttribute('src'),
    errorTxt: document.getElementById('error-foto')?.textContent.trim(),
  }))()`);
  await clic('#btn-sin-foto'); await sleep(800);
  const trasSinFoto = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    errorTxt: document.getElementById('error-foto')?.textContent.trim(),
  }))()`);
  return { estado, trasSinFoto };
});

/* ---------- 3 · Foto de ejemplo + análisis real (latencia) ---------- */
let latenciaS = null;
await parada('analisis-e2e', async () => {
  if ((await evalJs(`document.querySelector('.pantalla.activa')?.id`)) !== 'p-foto')
    await evalJs(`ir('p-foto')`);
  await sleep(500);
  await clic('#btn-foto-ejemplo');
  const previaOk = await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
  await sleep(600);
  await shot('c03-foto-ejemplo');
  const prefs = await evalJs(`(() => {
    const sels = [...document.querySelectorAll('#p-foto select')].map(s => s.id + '=' + s.value);
    const chips = [...document.querySelectorAll('#p-foto .chip-pref.on, #p-foto [aria-pressed="true"]')].map(c => c.textContent.trim());
    return { selects: sels, chips };
  })()`);
  const t0 = Date.now();
  await clic('#btn-analizar');
  const enCurso = await esperar(`document.getElementById('cargando-analisis').style.display !== 'none' || document.getElementById('p-resultado').classList.contains('activa')`, 10000);
  await shot('c04-analizando');
  const listo = await esperar(
    `document.getElementById('p-resultado').classList.contains('activa') || document.getElementById('error-foto').textContent.trim().length > 0`,
    330000);
  latenciaS = Math.round((Date.now() - t0) / 100) / 10;
  await sleep(800);
  const resultado = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    resumen: document.getElementById('res-resumen')?.textContent.trim().slice(0, 220),
    chips: document.getElementById('res-chips')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160),
    recomendado: document.getElementById('reco-nombre')?.textContent.trim(),
    recoDatos: document.getElementById('reco-datos')?.textContent.trim(),
    alternativo: document.getElementById('alt-nombre')?.textContent.trim(),
    consejo: document.getElementById('res-consejo')?.textContent.trim().slice(0, 140),
    aviso: document.getElementById('res-aviso')?.textContent.trim().slice(0, 200),
    errorFoto: document.getElementById('error-foto')?.textContent.trim(),
  }))()`);
  return { previaOk, prefs, enCurso, listo, latenciaS, resultado };
}, 'c05-resultado');

/* ---------- 4 · Guardar look y reserva desde el resultado ---------- */
await parada('guardar-look', async () => {
  await clic('#btn-guardar-look'); await sleep(700);
  return { confirmacionVisible: await evalJs(`document.getElementById('look-guardado')?.style.display`) };
});
await parada('explorar-probar-directo', async () => {
  await evalJs(`ir('p-explorar')`); await sleep(900);
  await evalJs(`document.querySelector('#explorar-grid .prod-card [data-acc="probar"]')?.click()`);
  await sleep(900);
  return { activa: await evalJs(`document.querySelector('.pantalla.activa')?.id`) };
});

/* ---------- 5 · Probador: hub con resultado y módulo de moda ---------- */
await parada('probador-hub', async () => {
  await evalJs(`ir('p-probador')`); await sleep(1000);
  const tarjeta = await evalJs(`(() => ({
    nombre: document.getElementById('tc-nombre')?.textContent.trim(),
    fecha: document.getElementById('tc-fecha')?.textContent.trim(),
    total: document.getElementById('tc-total')?.textContent.trim(),
    lineas: document.getElementById('tc-lineas')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 140),
  }))()`);
  await shot('c06-probador-hub');
  await clic('#btn-prob-moda'); await sleep(900);
  const proxima = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    titulo: document.getElementById('proxima-titulo')?.textContent.trim(),
  }))()`);
  await clic('#btn-proxima-volver'); await sleep(700);
  proxima.alVolver = await evalJs(`document.querySelector('.pantalla.activa')?.id`);
  return { tarjeta, proxima };
});

/* ---------- 6 · Perfil: Mis looks con el look guardado ---------- */
await parada('perfil-looks', async () => {
  await clic('#nav-perfil'); await sleep(1000);
  await evalJs(`document.getElementById('looks-lista')?.scrollIntoView({ block: 'center' })`);
  await sleep(600);
  const antes = await evalJs(`document.getElementById('looks-lista')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200)`);
  await shot('c07-perfil-looks');
  await evalJs(`document.querySelector('#looks-lista .il-x')?.click()`);
  await sleep(600);
  const despues = await evalJs(`document.getElementById('looks-lista')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160)`);
  return { antes, despues };
});

/* ---------- 7 · Errores del análisis (API, desde la página) ---------- */
await parada('errores-analisis-api', async () => {
  const post = async cuerpo => await evalJs(`fetch('/api/analizar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(${JSON.stringify(cuerpo)}) })
    .then(async r => ({ st: r.status, cuerpo: await r.json().catch(() => ({})) }))`);
  const sinImagen = await post({ preferencias: {} });
  const imagenBasura = await post({ imagen: 'data:image/jpeg;base64,AAAA', preferencias: {} });
  const noDataUri = await post({ imagen: 'no-es-una-foto', preferencias: {} });
  const formatoNo = await post({ imagen: 'data:image/gif;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=', preferencias: {} });
  return { sinImagen, imagenBasura, noDataUri, formatoNo };
});

guardarLog();
console.log('FASE B COMPLETA · paradas:', LOG.paradas.length, '· errores consola:', LOG.consola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
