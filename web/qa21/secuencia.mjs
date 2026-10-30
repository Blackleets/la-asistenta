// QA21 · PRE-ENSAYO TÉCNICO DE LA SECUENCIA DE DEMO (29/10/2026)
// Ejecuta EN ORDEN, contra la app real a 412×915, los pasos web que
// mostrará el vídeo de la demo (sin gastar mensajes de Twilio: el
// ensayo con WhatsApp real es el 02/11):
//   1 abrir la app → 2 buscar un servicio → 3 ver el Recomendado →
//   4 análisis de cejas con la foto de ejemplo (latencia registrada)
//   → 5 reservar el servicio recomendado → 6 confirmación con código
//   y enlace mágico → 7 vista de la profesional en su panel →
//   8 cancelar la cita de la demo.
// La cita creada lleva el nombre «QA21 Demo» y queda CANCELADA
// al terminar (nunca borrada). La clave profesional se lee del
// fichero de la máquina y NUNCA se escribe en el log ni en consola.
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa21/secuencia';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LOG = { fase: 'QA21-preensayo', pasos: [], consola: [], resumen: {} };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-secuencia.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9415', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa21-sec-perfil', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9415/json/version');
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
const NAVEGAR = async url => { await S('Page.navigate', { url }); await sleep(2500); };

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

/* ================= 1 · Abrir la app ================= */
await paso(1, 'abrir-la-app', async () => {
  const t0 = Date.now();
  await S('Page.navigate', { url: WEB + '/' });
  const lista = await esperar(`document.querySelector('.pantalla.activa')?.id === 'p-inicio' &&
    document.querySelectorAll('#pastillas .pastilla').length >= 8`, 30000);
  const cargaMs = Date.now() - t0;
  await sleep(1200);
  const datos = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    pastillas: [...document.querySelectorAll('#pastillas .pastilla .p-txt')].map(p => p.textContent.trim()),
    buscador: !!document.getElementById('inp-buscar-home'),
    swControlando: !!navigator.serviceWorker?.controller,
  }))()`);
  if (!lista) throw new Error('la home no terminó de cargar');
  return { cargaMs, ...datos };
}, 'p01-inicio');

/* ================= 2 · Buscar un servicio ================= */
await paso(2, 'buscar-un-servicio', async () => {
  await evalJs(`(() => { const i = document.getElementById('inp-buscar-home'); i.value = 'henna'; document.getElementById('form-buscar-home').requestSubmit(); })()`);
  await sleep(1500);
  const r = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    visibles: [...document.querySelectorAll('#explorar-grid .prod-card')].filter(c => c.style.display !== 'none').map(c => c.querySelector('h3')?.textContent),
  }))()`);
  if (r.activa !== 'p-explorar' || !r.visibles.some(t => /henna/i.test(t || '')))
    throw new Error('la búsqueda no aterrizó en Explorar con Henna visible: ' + JSON.stringify(r));
  return r;
}, 'p02-buscar-henna');

/* ================= 3 · Ver el Recomendado ================= */
await paso(3, 'ver-el-recomendado', async () => {
  await evalJs(`ir('p-inicio')`); await sleep(900);
  const hayCarrusel = await esperar(`document.querySelectorAll('#carrusel-reco > *').length >= 2`, 15000);
  await evalJs(`document.getElementById('carrusel-reco').scrollIntoView({ block: 'center' })`);
  await sleep(600);
  const antes = await evalJs(`(() => ({
    tarjetas: [...document.querySelectorAll('#carrusel-reco > *')].map(c => c.textContent.trim().replace(/\\s+/g, ' ').slice(0, 90)),
  }))()`);
  await evalJs(`document.getElementById('carrusel-reco').scrollTo({ left: 330, behavior: 'smooth' })`);
  await sleep(900);
  const scrollLeft = await evalJs(`document.getElementById('carrusel-reco').scrollLeft`);
  if (!hayCarrusel || antes.tarjetas.length < 2) throw new Error('carrusel sin tarjetas');
  return { nTarjetas: antes.tarjetas.length, tarjetas: antes.tarjetas, scrollLeftTrasDeslizar: scrollLeft };
}, 'p03-recomendado');

/* ============ 4 · Análisis de cejas (foto de ejemplo) ============ */
let servicioRecomendado = null;
await paso(4, 'analisis-de-cejas', async () => {
  await clic('#nav-probador'); await sleep(900);
  await clic('#btn-prob-cejas'); await sleep(900);
  const gate = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    btnDisabledSinAceptar: document.getElementById('btn-ir-foto')?.disabled,
  }))()`);
  await clic('#check-consentimiento'); await sleep(400);
  await clic('#btn-ir-foto'); await sleep(900);
  await clic('#btn-foto-ejemplo');
  const previaOk = await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
  if (!previaOk) throw new Error('la foto de ejemplo no cargó la vista previa');
  await sleep(500);
  const t0 = Date.now();
  await clic('#btn-analizar');
  const listo = await esperar(
    `document.getElementById('p-resultado').classList.contains('activa') || document.getElementById('error-foto').textContent.trim().length > 0`,
    300000);
  const latenciaS = Math.round((Date.now() - t0) / 100) / 10;
  await sleep(700);
  const resultado = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    resumen: document.getElementById('res-resumen')?.textContent.trim().slice(0, 220),
    etiquetasResultado: [...document.querySelectorAll('#p-resultado .etiqueta')].map(e => e.textContent.trim()),
    lineaOrientacion: [...document.querySelectorAll('#p-resultado .reco p, #p-resultado .tarjeta p')]
      .map(p => p.textContent.trim()).find(t => /orientación/i.test(t))?.slice(0, 200) || null,
    recomendado: document.getElementById('reco-nombre')?.textContent.trim(),
    recoDatos: document.getElementById('reco-datos')?.textContent.trim(),
    precioColor: (() => { const el = document.getElementById('reco-datos');
      return el ? getComputedStyle(el).color : null; })(),
    alternativo: document.getElementById('alt-nombre')?.textContent.trim(),
    aviso: document.getElementById('res-aviso')?.textContent.trim().slice(0, 200),
    errorFoto: document.getElementById('error-foto')?.textContent.trim(),
  }))()`);
  if (!listo || resultado.activa !== 'p-resultado' || !resultado.recomendado)
    throw new Error('sin resultado de análisis: ' + JSON.stringify(resultado).slice(0, 250));
  servicioRecomendado = resultado.recomendado;
  LOG.resumen.latenciaAnalisisS = latenciaS;
  LOG.resumen.servicioRecomendado = servicioRecomendado;
  return { gate, previaOk, latenciaS, resultado };
}, 'p04-resultado-analisis');

/* ===== 5 · Reservar el servicio recomendado ===== */
let codigo = null, token = null, fechaElegida = null, horaElegida = null;
await paso(5, 'reservar-el-recomendado', async () => {
  if (!servicioRecomendado) throw new Error('sin servicio recomendado del paso 4');
  await clic('#btn-reservar-reco');
  const enReserva = await esperar(`document.querySelector('.pantalla.activa')?.id === 'p-reserva' &&
    document.getElementById('paso-2')?.classList.contains('activo')`, 15000);
  if (!enReserva) throw new Error('«Reservar este servicio» no llevó al paso 2 de la reserva');
  const resumen = await evalJs(`document.getElementById('rm-txt')?.textContent.trim()`);
  // Candidatas: de hoy (Europe/Madrid — el Chromium vive en UTC) a +7
  // días, sin domingos (día cerrado).
  const candidatas = [];
  const hoyMadrid = await evalJs(`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())`);
  const [ay, am, ad] = hoyMadrid.split('-').map(Number);
  for (let i = 0; i <= 7 && candidatas.length < 6; i++) {
    const d = new Date(Date.UTC(ay, am - 1, ad + i));
    if (d.getUTCDay() === 0) continue;
    candidatas.push(d.toISOString().slice(0, 10));
  }
  const intentos = [];
  let huecos = 0;
  for (const f of candidatas) {
    let celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`);
    if (!celda) { await clic('#cal-sig'); await sleep(700); celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`); }
    if (!celda) { intentos.push({ fecha: f, motivo: 'sin celda en el calendario' }); continue; }
    const habil = await evalJs(`(() => { const c = document.querySelector('.cal-dia[data-fecha="${f}"]'); return !!c && !c.disabled; })()`);
    if (!habil) { intentos.push({ fecha: f, motivo: 'día deshabilitado' }); continue; }
    await evalJs(`document.querySelector('.cal-dia[data-fecha="${f}"]').click()`);
    await esperar(`!document.getElementById('huecos').textContent.includes('Consultando')`, 12000);
    huecos = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].filter(b => b.style.display !== 'none').length`);
    intentos.push({ fecha: f, huecosVisibles: huecos });
    if (huecos > 0) { fechaElegida = f; break; }
  }
  if (!fechaElegida) throw new Error('ninguna candidata con huecos: ' + JSON.stringify(intentos));
  await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
  await sleep(500);
  horaElegida = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
  if (!horaElegida) throw new Error('no se pudo elegir hora');
  await clic('#btn-paso2-siguiente'); await sleep(800);
  await evalJs(`(() => {
    const n = document.getElementById('inp-nombre'); n.value = 'QA21 Demo';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('inp-notas'); t.value = 'Cita de la secuencia de demo QA21 (30/10). Se cancela al terminar.';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(400);
  await clic('#check-confirma'); await sleep(400);
  const btnOk = await evalJs(`!document.getElementById('btn-confirmar').disabled`);
  if (!btnOk) throw new Error('el botón de confirmar no se habilitó');
  await clic('#btn-confirmar');
  const confirmada = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 30000);
  if (!confirmada) throw new Error('la confirmación no llegó');
  await sleep(700);
  const datos = await evalJs(`(() => {
    const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || '{}');
    return {
      codigo: document.getElementById('conf-codigo')?.textContent.trim(),
      detalle: document.getElementById('conf-detalle')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 220),
      token: g.token || (g.enlace || '').split('/cita/')[1] || null,
    };
  })()`);
  codigo = datos.codigo; token = datos.token;
  LOG.resumen.codigo = codigo; LOG.resumen.fecha = fechaElegida; LOG.resumen.hora = horaElegida;
  return { resumenAlEntrar: resumen, intentos, fechaElegida, horaElegida,
           codigo, detalle: datos.detalle, hayToken: !!token };
}, 'p05-confirmacion');

/* ===== 6 · Enlace mágico: abrir y verificar la cita ===== */
await paso(6, 'enlace-magico', async () => {
  if (!token) throw new Error('sin token de la reserva');
  await NAVEGAR(WEB + '/cita/' + token);
  const visible = await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await sleep(600);
  const texto = await evalJs(`document.getElementById('contenido').innerText.replace(/\\s+/g, ' ').slice(0, 400)`);
  const coincide = visible && texto.includes('QA21 Demo') && (!codigo || texto.includes(codigo));
  if (!coincide) throw new Error('el enlace no muestra la cita esperada: ' + texto.slice(0, 200));
  return { visible, coincide, texto };
}, 'p06-cita-enlace');

/* ===== 7 · Vista de la profesional en su panel ===== */
await paso(7, 'panel-profesional', async () => {
  await NAVEGAR(WEB + '/profesional');
  await sleep(600);
  const envTxt = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envTxt.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  if (!claveReal) throw new Error('sin clave en el fichero de la máquina');
  await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
  await clic('#btn-entrar');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto')`, 20000);
  if (!dentro) throw new Error('el panel no se abrió con la clave');
  await sleep(1200);
  const hoyStr = await evalJs(`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())`);
  let vista = null, encontrada = false, detalle = null;
  if (fechaElegida === hoyStr) {
    vista = 'hoy';
    encontrada = await evalJs(`[...document.querySelectorAll('#hoy-citas .cita')].some(c => c.textContent.includes(${JSON.stringify(codigo || 'Pre-ensayo')}))`);
    detalle = await evalJs(`document.getElementById('hoy-resumen')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160)`);
  } else {
    vista = 'agenda';
    await evalJs(`document.querySelector('.tab[data-tab="agenda"]')?.click()`);
    await sleep(1800);
    encontrada = await evalJs(`(() => { const t = document.getElementById('agenda-dias')?.innerText || ''; return t.includes(${JSON.stringify(codigo || 'Pre-ensayo')}) || t.includes('Pre-ensayo'); })()`);
    detalle = `la cita es del ${fechaElegida}; buscada por código/nombre en la agenda de 7 días`;
  }
  if (!encontrada) throw new Error(`la cita ${codigo} no aparece en el panel (vista ${vista})`);
  return { vista, encontrada, detalle, hoyEnElPanel: hoyStr, fechaCita: fechaElegida };
}, 'p07-profesional');

/* ===== 8 · Cancelar la cita de la demo ===== */
await paso(8, 'cancelar-la-cita', async () => {
  if (!token) throw new Error('sin token de la reserva');
  await NAVEGAR(WEB + '/cita/' + token);
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await clic('#btn-cancelar'); await sleep(600);
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 15000);
  await S('Page.reload', {}); await sleep(2500);
  const trasRecarga = await evalJs(`document.getElementById('cancelada').style.display !== 'none'`);
  if (!cancelada || !trasRecarga) throw new Error('la cancelación no quedó confirmada');
  return { cancelada, sigueCanceladaTrasRecarga: trasRecarga, codigo };
}, 'p08-cancelada');

LOG.resumen.erroresConsola = LOG.consola.length;
guardarLog();
const okTotal = LOG.pasos.filter(p => p.ok).length;
console.log(`PRE-ENSAYO COMPLETO · pasos OK: ${okTotal}/${LOG.pasos.length} · errores de consola: ${LOG.consola.length}`);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
