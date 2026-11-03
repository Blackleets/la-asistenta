// QA22 · HUMO DE ACTIVACIÓN META DENTRO DE LA WEB (30/10/2026)
// Ejercita el flujo REAL de la clienta a 412×915 con la capacidad
// Meta ENCENDIDA (clave en web/meta.env de la máquina):
//   consentimiento (párrafo visual visible) → foto de ejemplo →
//   análisis (Spark + propuesta visual de Muse Image) → resultado →
//   guardar el look → Mis looks con la miniatura generada.
// Registra la espera (muestreo del cargando) y el ORDEN real de las
// tarjetas del resultado (criterio de Lee 30/10: la foto generada
// manda ARRIBA en «Esto ve La Asistenta», el texto debajo).
// Uso: node humo-meta.mjs <etiqueta>   (capturas y log llevan la etiqueta)
// Coste: UN análisis = una generación ≈ 0,01 $ contra el crédito Meta.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa22';
const TAG = process.argv[2] || 'run';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LOG = { fase: 'QA22-humo-meta', etiqueta: TAG, pasos: [], consola: [], espera: [] };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-humo-${TAG}.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9372', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', `--user-data-dir=/tmp/qa22-perfil-${TAG}`, 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9372/json/version');
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
    await sleep(600);
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
  if (shotName) { try { await shot(shotName); reg.captura = shotName + '.png'; } catch (e) {} }
  LOG.pasos.push(reg);
  guardarLog();
  console.log('paso', n, nombre, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''), reg.segundos + 's');
  return reg;
}

/* ============ 1 · Abrir la app (perfil nuevo: SW servido) ============ */
await paso(1, 'abrir-la-app', async () => {
  await S('Page.navigate', { url: WEB + '/' });
  const lista = await esperar(`document.querySelector('.pantalla.activa')?.id === 'p-inicio'`, 30000);
  await sleep(1500);
  const datos = await evalJs(`(async () => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    caches: (await caches.keys()),
    swControlando: !!navigator.serviceWorker?.controller,
  }))()`);
  if (!lista) throw new Error('la home no cargó');
  return datos;
}, `h1-${TAG}-inicio`);

/* ============ 2 · Consentimiento con el párrafo visual ============ */
await paso(2, 'consentimiento', async () => {
  await clic('#nav-probador'); await sleep(900);
  await clic('#btn-prob-cejas'); await sleep(900);
  const datos = await evalJs(`(() => {
    const p = document.getElementById('consentimiento-visual');
    const cs = p ? getComputedStyle(p) : null;
    return {
      activa: document.querySelector('.pantalla.activa')?.id,
      parrafoVisualVisible: !!p && cs.display !== 'none' && p.offsetParent !== null,
      parrafoVisualTexto: p?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 240),
      continuarDeshabilitadoSinAceptar: document.getElementById('btn-ir-foto')?.disabled,
    };
  })()`);
  if (datos.activa !== 'p-consentimiento') throw new Error('no se llegó al consentimiento: ' + JSON.stringify(datos));
  if (!datos.parrafoVisualVisible) throw new Error('el párrafo visual del consentimiento NO es visible con la capacidad encendida');
  await clic('#check-consentimiento'); await sleep(400);
  const trasAceptar = await evalJs(`document.getElementById('btn-ir-foto')?.disabled`);
  await clic('#btn-ir-foto'); await sleep(900);
  return { ...datos, continuarDeshabilitadoTrasAceptar: trasAceptar };
}, `h2-${TAG}-consentimiento`);

/* ============ 3 · Foto de ejemplo ============ */
await paso(3, 'foto-de-ejemplo', async () => {
  await clic('#btn-foto-ejemplo');
  const previaOk = await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
  if (!previaOk) throw new Error('la foto de ejemplo no cargó la vista previa');
  await sleep(500);
  const analizarHabilitado = await evalJs(`!document.getElementById('btn-analizar')?.disabled`);
  return { previaOk, analizarHabilitado };
}, `h3-${TAG}-foto`);

/* ============ 4 · Análisis real (Spark + visual Meta) ============ */
let latenciaTotalS = null;
await paso(4, 'analisis-con-visual', async () => {
  const t0 = Date.now();
  await clic('#btn-analizar');
  // Muestreo de la espera: la pantalla de carga debe vivir todo el rato
  // (sin pantalla muerta ni error falso) hasta que llegue el resultado.
  let listo = false;
  while (Date.now() - t0 < 420000) {
    const e = await evalJs(`(() => ({
      activa: document.querySelector('.pantalla.activa')?.id,
      cargandoVisible: (() => { const c = document.getElementById('cargando-analisis');
        return !!c && getComputedStyle(c).display !== 'none'; })(),
      fase: document.getElementById('fase-analisis')?.textContent.trim(),
      segs: document.getElementById('seg-cargando')?.textContent.trim(),
      errorFoto: document.getElementById('error-foto')?.textContent.trim(),
    }))()`).catch(() => null);
    if (e) {
      LOG.espera.push({ tS: Math.round((Date.now() - t0) / 100) / 10, ...e });
      guardarLog();
      if (e.activa === 'p-resultado') { listo = true; break; }
      if (e.errorFoto) break;
    }
    await sleep(4000);
  }
  latenciaTotalS = Math.round((Date.now() - t0) / 100) / 10;
  await sleep(1200);
  const r = await evalJs(`(() => {
    const Y = el => el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
    const img = document.getElementById('res-visual-img');
    const bloque = document.getElementById('res-visual');
    const tarjetas = [...document.querySelectorAll('#p-resultado > .tarjeta')].map(t => ({
      id: t.id || null, titulo: (t.querySelector('h2,h3,.etiqueta')?.textContent || '').trim().slice(0, 40),
      y: Y(t), visible: getComputedStyle(t).display !== 'none',
    }));
    return {
      activa: document.querySelector('.pantalla.activa')?.id,
      recomendado: document.getElementById('reco-nombre')?.textContent.trim(),
      visualBloqueVisible: !!bloque && getComputedStyle(bloque).display !== 'none',
      visualImgSrcTipo: img?.getAttribute('src')?.slice(0, 30) || null,
      visualImgNatural: img ? [img.naturalWidth, img.naturalHeight] : null,
      visualImgRender: img ? [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)] : null,
      visualNotaVisible: (() => { const n = document.getElementById('res-visual-nota');
        return !!n && getComputedStyle(n).display !== 'none'; })(),
      visualErrorTexto: document.getElementById('res-visual-error')?.textContent.trim() || null,
      tarjetasEnOrden: tarjetas,
      errorFoto: document.getElementById('error-foto')?.textContent.trim(),
    };
  })()`);
  if (!listo || r.activa !== 'p-resultado') throw new Error('sin pantalla de resultado: ' + JSON.stringify(r).slice(0, 250));
  if (!r.visualBloqueVisible || !r.visualImgNatural || r.visualImgNatural[0] === 0)
    throw new Error('la propuesta visual NO llegó en el resultado: ' + JSON.stringify(r).slice(0, 250));
  LOG.resumen = { latenciaAnalisisTotalS: latenciaTotalS };
  return { latenciaTotalS, ...r };
});
/* Capturas del resultado: arriba del todo y la tarjeta visual de cerca */
await evalJs(`window.scrollTo(0, 0); document.getElementById('p-resultado').scrollIntoView({ block: 'start' })`);
await sleep(800);
await shot(`h4-${TAG}-resultado-arriba`);
await evalJs(`document.getElementById('res-visual').scrollIntoView({ block: 'center' })`);
await sleep(800);
await shot(`h4-${TAG}-resultado-visual`);

/* ============ 5 · Guardar el look y verlo en Mis looks ============ */
await paso(5, 'guardar-en-mis-looks', async () => {
  await clic('#btn-guardar-look'); await sleep(700);
  const aviso = await evalJs(`document.getElementById('look-guardado')?.textContent.trim()`);
  // Como la clienta: por el botón Perfil de la navegación, NO con
  // ir() directo — el render de Mis looks cuelga de los handlers de
  // navegación (nav-perfil / btn-cab-perfil → mostrarLooks()).
  // (Lección QA22-cierre: el primer pase usó ir() y vio la lista sin
  // renderizar: defecto del guion, no de la app.)
  await clic('#nav-perfil'); await sleep(1200);
  const looks = await evalJs(`(() => {
    const h2 = [...document.querySelectorAll('h2')].find(e => e.textContent.trim() === 'Mis looks');
    const card = h2?.closest('.tarjeta') || h2?.parentElement;
    const imgs = card ? [...card.querySelectorAll('img.il-foto')] : [];
    return {
      activa: document.querySelector('.pantalla.activa')?.id,
      nMiniaturas: imgs.length,
      miniaturasOk: imgs.map(i => [i.naturalWidth, i.naturalHeight]),
      textos: card ? [...card.querySelectorAll('.item-local')].map(t => t.textContent.trim().replace(/\\s+/g, ' ').slice(0, 90)) : [],
    };
  })()`);
  if (!/propuesta visual/i.test(aviso || '')) throw new Error('el aviso de guardado no menciona la propuesta visual: ' + aviso);
  if (!looks.nMiniaturas || looks.miniaturasOk.some(([w]) => w === 0))
    throw new Error('Mis looks sin miniatura generada válida: ' + JSON.stringify(looks));
  await evalJs(`[...document.querySelectorAll('h2')].find(e => e.textContent.trim() === 'Mis looks')?.scrollIntoView({ block: 'center' })`);
  await sleep(700);
  return { avisoGuardado: aviso, ...looks };
}, `h5-${TAG}-mis-looks`);

console.log('HUMO', TAG, 'completo · latencia total:', latenciaTotalS, 's · errores de consola:', LOG.consola.length);
guardarLog();
process.exit(0);
