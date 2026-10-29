// QA18-A2 · MATRIZ FUNCIONAL (29/10/2026) — segunda pasada del
// barrido: reserva E2E con verificación EN LA AGENDA, lista de
// espera, acciones profesionales, D-02, caminos de error (409,
// domingo, token inventado) y geometría de la barra del salón.
// Selectores corregidos tras A1 (calendario con comilla de cierre;
// modal con clase «visible»; tarjetas en #videos-fila).
// Los secretos (token de agenda, clave profesional) se leen de los
// ficheros de la máquina y NUNCA se imprimen ni se registran.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const OUT = '/data/la-asistenta/web/qa18';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOY = new Date().toISOString().slice(0, 10);       // 2026-10-29
const FUTURA = '2026-11-03';
const REAG = '2026-11-04';
const DIA409 = '2026-11-05';
const REAG_D02 = '2026-11-06';
const DOMINGO = '2026-11-01';
const SABADO = '2026-10-31';

const LOG = { fase: 'A2', paradas: [], consola: [], agendaChecks: [] };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-a2.json`, JSON.stringify(LOG, null, 1));

/* ---------- agenda directa (verificación en el servidor) ---------- */
const envAgenda = readFileSync('/data/la-asistenta/agenda/agenda.env', 'utf8');
const AG_TOKEN = (envAgenda.match(/AGENDA_API_TOKEN=(.+)/) || [])[1]?.trim();
async function ag(metodo, ruta, cuerpo) {
  const r = await fetch(AGENDA + ruta, {
    method: metodo,
    headers: { 'X-API-Token': AG_TOKEN, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = {};
  try { datos = await r.json(); } catch (e) {}
  return { st: r.status, datos };
}
async function citaPorCodigo(fecha, codigo) {
  const { datos } = await ag('GET', `/citas?fecha=${fecha}`);
  return (datos.citas || []).find(c => c.codigo === codigo) || null;
}

/* ---------- CDP ---------- */
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9362', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa18-perfil-a2', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9362/json/version');
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
let sessionIdGlobal = null;
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
  if (m.method === 'Page.javascriptDialogOpening') {
    // Los confirm() de la profesional (No vino / Cancelar): se aceptan.
    send('Page.handleJavaScriptDialog', { accept: true }, sessionIdGlobal);
    LOG.consola.push({ parada: paradaActual, tipo: 'dialogo-confirm-aceptado', txt: String(m.params.message || '').slice(0, 120) });
    return;
  }
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
sessionIdGlobal = sessionId;
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await S('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__wa = [];
  window.open = (u) => { window.__wa.push(String(u)); return null; };
  window.__blobs = [];
  const _cou = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { try { window.__blobs.push(b); } catch(e) {} return _cou(b); };
`});
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
const MEDIR = `(() => {
  const de = document.documentElement;
  return { scrollW: de.scrollWidth,
           activa: (document.querySelector('.pantalla.activa') || {}).id || location.pathname };
})()`;
async function parada(nombre, fn, shotName) {
  paradaActual = nombre;
  const reg = { nombre, ok: true };
  try { reg.datos = await fn(); }
  catch (e) { reg.ok = false; reg.error = String(e.message || e).slice(0, 300); }
  try { reg.medidas = await evalJs(MEDIR); } catch (e) { reg.medidas = { error: 'sin medidas' }; }
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
    await sleep(400);
  }
  return false;
};
const NAVEGAR = async url => { await S('Page.navigate', { url }); await sleep(2500); };
const irAlMes = async textoMes => {
  for (let i = 0; i < 4; i++) {
    const mes = await evalJs(`document.getElementById('cal-mes')?.textContent.trim()`);
    if (mes && mes.includes(textoMes)) return mes;
    await clic('#cal-sig'); await sleep(450);
  }
  return await evalJs(`document.getElementById('cal-mes')?.textContent.trim()`);
};

await S('Page.navigate', { url: WEB + '/' });
await sleep(4500);

/* ---------- 1 · Geometría de la barra del salón ---------- */
await parada('salon-barra-geometria', async () => {
  await evalJs(`ir('p-salon')`); await sleep(1200);
  const sinTocar = await evalJs(`(() => { const b = document.getElementById('salon-barra');
    const r = b.getBoundingClientRect();
    return { visible: b.classList.contains('visible'), display: getComputedStyle(b).display,
             left: Math.round(r.left), right: Math.round(r.right),
             top: Math.round(r.top), bottom: Math.round(r.bottom),
             transform: getComputedStyle(b).transform }; })()`);
  await shot('b01-salon-barra-inicial');
  // Vaciar la selección y volver a poner un servicio: la barra reaparece.
  await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"] .fs-add')?.click()`);
  await sleep(400);
  await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Ombré Brows Henna"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Ombré Brows Henna"] .fs-add')?.click()`);
  await sleep(900);
  const trasSeleccion = await evalJs(`(() => { const b = document.getElementById('salon-barra');
    const r = b.getBoundingClientRect();
    return { visible: b.classList.contains('visible'),
             left: Math.round(r.left), right: Math.round(r.right),
             top: Math.round(r.top), bottom: Math.round(r.bottom),
             n: document.getElementById('sb-n')?.textContent.trim(),
             detalle: document.getElementById('sb-detalle')?.textContent.trim() }; })()`);
  await shot('b02-salon-barra-seleccion');
  const btnReservar = await evalJs(`(() => { const b = document.getElementById('btn-salon-reservar');
    const r = b.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; })()`);
  return { sinTocar, trasSeleccion, btnReservar };
});

/* ---------- 2 · Modal de TikTok y reseñas ---------- */
await parada('salon-modal-tiktok', async () => {
  await evalJs(`document.getElementById('videos-fila')?.scrollIntoView({ block: 'center' })`);
  await sleep(700);
  await shot('b03-salon-videos');
  await evalJs(`document.querySelector('#videos-fila .video-card')?.click()`);
  await sleep(2200);
  const abierto = await evalJs(`(() => ({
    visible: document.getElementById('modal-tt').classList.contains('visible'),
    iframeSrc: document.querySelector('#modal-tt-marco iframe')?.getAttribute('src'),
    titulo: document.getElementById('modal-tt-tit')?.textContent.trim(),
    linkHref: document.getElementById('modal-tt-link')?.getAttribute('href'),
  }))()`);
  await shot('b04-modal-tiktok');
  await clic('#modal-tt-x'); await sleep(700);
  const cerrado = await evalJs(`(() => ({
    visible: document.getElementById('modal-tt').classList.contains('visible'),
    marcoHtml: document.getElementById('modal-tt-marco').innerHTML.length,
  }))()`);
  return { abierto, cerrado };
});
await parada('salon-resenas', async () => {
  await evalJs(`(() => { const h = [...document.querySelectorAll('#p-salon .seccion-titulo')].find(x => x.textContent.includes('dicen')); h && h.scrollIntoView({ block: 'start' }); })()`);
  await sleep(800);
  return {};
}, 'b05-salon-resenas');

/* ---------- 3 · Reserva E2E (pack) con verificación en agenda ---------- */
let tokenFutura = null, codigoFutura = null;
await parada('reserva-pack-e2e', async () => {
  await evalJs(`ir('p-inicio')`); await sleep(600);
  await clic('#pastilla-reservar'); await sleep(1100);
  // Selección exacta del pack: Diseño + Henna (la barra dejó Henna puesto).
  await evalJs(`(() => {
    const want = ['Diseño de cejas', 'Ombré Brows Henna'];
    document.querySelectorAll('#res-servicios .servicio-card').forEach(c => {
      const on = c.classList.contains('sel');
      if (want.includes(c.dataset.servicio) !== on) c.click();
    });
  })()`);
  await sleep(400);
  const paso1 = await evalJs(`(() => ({
    seleccionadas: [...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio),
    resumen: document.getElementById('rm-txt')?.textContent.trim(),
    precio: document.getElementById('rm-precio')?.textContent.trim(),
  }))()`);
  await shot('b06-reserva-paso1-pack');
  await clic('#btn-paso1-siguiente'); await sleep(700);
  const mes = await irAlMes('noviembre');
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${FUTURA}"]').click()`);
  const hayHoras = await esperar(`document.querySelectorAll('#huecos .hora-fila').length > 0`);
  await shot('b07-reserva-paso2');
  await evalJs(`document.querySelector('#huecos .hora-fila').click()`);
  await sleep(400);
  const hora = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
  await clic('#btn-paso2-siguiente'); await sleep(600);
  await evalJs(`(() => {
    const n = document.getElementById('inp-nombre'); n.value = 'QA18 Barrido';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('inp-notas'); t.value = 'Cita de prueba del barrido QA18';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await clic('#check-confirma'); await sleep(400);
  const habilitado = await evalJs(`!document.getElementById('btn-confirmar').disabled`);
  await shot('b08-reserva-paso3');
  await clic('#btn-confirmar');
  const confirmada = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 25000);
  await sleep(700);
  const datos = await evalJs(`(() => {
    const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || '{}');
    return { codigo: document.getElementById('conf-codigo')?.textContent.trim(),
             detalle: document.getElementById('conf-detalle')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200),
             enlace: document.getElementById('conf-enlace')?.textContent.trim(),
             token: g.token || (g.enlace || '').split('/cita/')[1] || null };
  })()`);
  tokenFutura = datos.token; codigoFutura = datos.codigo;
  let enAgenda = null;
  if (codigoFutura) {
    const c = await citaPorCodigo(FUTURA, codigoFutura);
    enAgenda = c && { estado: c.estado, servicio: c.servicio, duracion: c.duracion_min,
                      fecha: c.fecha, hora: c.hora };
  }
  return { paso1, mes, hayHoras, horaElegida: hora, habilitado, confirmada,
           codigo: datos.codigo, detalle: datos.detalle, hayEnlace: !!datos.enlace, enAgenda };
}, 'b09-confirmada');
await parada('confirmada-ics-y-micita', async () => {
  await clic('#btn-ics'); await sleep(800);
  const ics = await evalJs(`(async () => {
    const b = window.__blobs[window.__blobs.length - 1];
    if (!b) return 'SIN-BLOB';
    const t = await b.text();
    return t.split('\\r\\n').filter(l => /^(DTSTART|DTEND|SUMMARY|DESCRIPTION)/.test(l)).join(' | ').slice(0, 280);
  })()`);
  await clic('#conf-ver-cita'); await sleep(1200);
  return { ics, micita: await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    resumen: document.getElementById('micita-resumen')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 180),
  }))()`) };
}, 'b10-micita');

/* ---------- 4 · /cita/ futura: ver, prep, reagendar (+ agenda) ---------- */
await parada('cita-futura-ver-prep-reagendar', async () => {
  if (!tokenFutura) return { error: 'sin token' };
  await NAVEGAR(WEB + '/cita/' + tokenFutura);
  const visible = await esperar(`document.getElementById('contenido').style.display !== 'none'`, 12000);
  const antes = await evalJs(`(() => ({
    pastilla: document.getElementById('cita-estado')?.textContent.trim(),
    datos: document.getElementById('cita-datos')?.innerHTML.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').trim().slice(0, 180),
  }))()`);
  await shot('b11-cita-ver');
  await evalJs(`document.querySelector('#prep-tratamiento .seg[data-valor="Sí"]').click()`);
  await sleep(300);
  await evalJs(`(() => { document.getElementById('prep-cual').value = 'henna hace 3 semanas'; })()`);
  await evalJs(`document.querySelector('#prep-retinol .seg[data-valor="No"]').click()`);
  await clic('#btn-prep');
  const prepOk = await esperar(`document.getElementById('prep-ok').classList.contains('visible')`, 12000);
  await evalJs(`(() => { const i = document.getElementById('inp-fecha'); i.value = '${REAG}'; i.dispatchEvent(new Event('change')); })()`);
  const hayHuecos = await esperar(`document.querySelectorAll('#huecos .hueco').length > 0`, 15000);
  await evalJs(`document.querySelector('#huecos .hueco')?.click()`);
  await sleep(400);
  await clic('#btn-reagendar');
  const reagOk = await esperar(`document.getElementById('reagendar-ok').classList.contains('visible') || document.getElementById('reagendar-error').classList.contains('visible')`, 15000);
  const despues = await evalJs(`(() => ({
    okTxt: document.getElementById('reagendar-ok')?.textContent.trim(),
    errTxt: document.getElementById('reagendar-error')?.textContent.trim(),
    datos: document.getElementById('cita-datos')?.innerHTML.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').trim().slice(0, 180),
  }))()`);
  let enAgenda = null;
  if (codigoFutura) {
    const c = await citaPorCodigo(REAG, codigoFutura);
    enAgenda = c && { estado: c.estado, fecha: c.fecha, hora: c.hora,
                      prep: c.prep ? { trat: c.prep.tratamiento_reciente, retinol: c.prep.retinol } : null };
  }
  return { visible, antes, prepOk, hayHuecos, reagOk, despues, enAgenda };
}, 'b12-cita-reagendada');

/* ---------- 5 · Error: 409 real (hueco ocupado tras elegirlo) ---------- */
await parada('error-409', async () => {
  await NAVEGAR(WEB + '/');
  await evalJs(`ir('p-inicio')`); await sleep(500);
  await clic('#pastilla-reservar'); await sleep(1000);
  await evalJs(`(() => {
    document.querySelectorAll('#res-servicios .servicio-card').forEach(c => {
      const on = c.classList.contains('sel');
      if ((c.dataset.servicio === 'Diseño de cejas') !== on) c.click();
    });
  })()`);
  await sleep(300);
  await clic('#btn-paso1-siguiente'); await sleep(700);
  await irAlMes('noviembre');
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${DIA409}"]').click()`);
  await esperar(`document.querySelectorAll('#huecos .hora-fila').length > 0`);
  const hora = await evalJs(`(() => { const b = document.querySelector('#huecos .hora-fila'); b && b.click(); return b?.dataset.hora; })()`);
  await sleep(300);
  await clic('#btn-paso2-siguiente'); await sleep(600);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre'); n.value = 'QA18 Conflicto'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#check-confirma'); await sleep(300);
  // Bloqueo real del hueco elegido, justo antes de confirmar.
  const bloqueo = await ag('POST', '/citas', {
    nombre: 'QA18 Bloqueo', servicio: 'Diseño de cejas',
    fecha: DIA409, hora, origen: 'qa18',
  });
  await clic('#btn-confirmar');
  const hayError = await esperar(`document.getElementById('error-reserva').textContent.trim().length > 0`, 20000);
  const errTxt = await evalJs(`document.getElementById('error-reserva')?.textContent.trim().slice(0, 260)`);
  // Limpieza del bloqueo (la cita QA18 Conflicto no debió crearse).
  let limpieza = null;
  if (bloqueo.datos?.cita?.id) {
    const canc = await ag('POST', `/citas/${bloqueo.datos.cita.id}/cancelar`, {});
    limpieza = canc.st;
  }
  const conflicto = await citaPorCodigo(DIA409, '').catch(() => null);
  const { datos } = await ag('GET', `/citas?fecha=${DIA409}`);
  const creadas = (datos.citas || []).filter(c => c.nombre.startsWith('QA18'))
    .map(c => ({ nombre: c.nombre, estado: c.estado, hora: c.hora }));
  return { hora, bloqueoSt: bloqueo.st, hayError, errTxt, limpiezaSt: limpieza, citasQA18EseDia: creadas };
}, 'b13-error-409');

/* ---------- 6 · Errores: domingo y token inventado ---------- */
await parada('error-domingo', async () => {
  const api = await evalJs(`fetch('/api/disponibilidad?servicio=' + encodeURIComponent('Diseño de cejas') + '&fecha=${DOMINGO}').then(r => r.json())`);
  const enUi = await evalJs(`(() => {
    const b = document.querySelector('.cal-dia[data-fecha="${DOMINGO}"]');
    return b ? { disabled: b.disabled, title: b.title } : 'no-en-este-mes';
  })()`);
  return { api: { huecos: (api.huecos || []).length, motivo: api.motivo }, enUi };
});
await parada('error-token-inventado', async () => {
  await NAVEGAR(WEB + '/cita/tokeninventadoqa18falso12345678');
  const hayError = await esperar(`document.getElementById('error-general').classList.contains('visible')`, 12000);
  return { hayError, txt: await evalJs(`document.getElementById('error-general')?.textContent.trim()`),
           cargandoVisible: await evalJs(`document.getElementById('cargando').style.display !== 'none'`) };
}, 'b14-token-inventado');
/* ---------- 7 · Cuatro citas de HOY desde la UI ---------- */
async function irAlMesBi(textoMes) {
  for (let i = 0; i < 6; i++) {
    const mes = await evalJs(`document.getElementById('cal-mes')?.textContent.trim()`);
    if (mes && mes.includes(textoMes)) return mes;
    if (mes && mes.includes('noviembre')) await clic('#cal-ant');
    else await clic('#cal-sig');
    await sleep(450);
  }
  return await evalJs(`document.getElementById('cal-mes')?.textContent.trim()`);
}
async function crearCitaHoy(nombre, telefono) {
  await NAVEGAR(WEB + '/');
  await evalJs(`ir('p-inicio')`); await sleep(500);
  await clic('#pastilla-reservar'); await sleep(1000);
  await evalJs(`(() => {
    document.querySelectorAll('#res-servicios .servicio-card').forEach(c => {
      const on = c.classList.contains('sel');
      if ((c.dataset.servicio === 'Diseño de cejas') !== on) c.click();
    });
  })()`);
  await sleep(300);
  await clic('#btn-paso1-siguiente'); await sleep(700);
  await irAlMesBi('octubre');
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${HOY}"]').click()`);
  const hay = await esperar(`document.querySelectorAll('#huecos .hora-fila').length > 0`, 15000);
  if (!hay) return { error: 'sin horas hoy' };
  const hora = await evalJs(`(() => { const b = document.querySelector('#huecos .hora-fila'); b && b.click(); return b?.dataset.hora; })()`);
  await sleep(300);
  await clic('#btn-paso2-siguiente'); await sleep(600);
  await evalJs(`(() => {
    const n = document.getElementById('inp-nombre'); n.value = ${JSON.stringify('NOMBRE')};
    n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('inp-telefono'); t.value = ${JSON.stringify('TELEFONO')};
    t.dispatchEvent(new Event('input', { bubbles: true }));
  })()`.replace('NOMBRE', nombre).replace('TELEFONO', telefono || ''));
  await clic('#check-confirma'); await sleep(300);
  await clic('#btn-confirmar');
  const conf = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 25000);
  await sleep(700);
  const datos = await evalJs(`(() => {
    const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || '{}');
    return { codigo: document.getElementById('conf-codigo')?.textContent.trim(),
             token: g.token || (g.enlace || '').split('/cita/')[1] || null };
  })()`);
  return { confirmada: conf, hora, ...datos };
}
const hoyCitas = {};
await parada('citas-hoy-crear', async () => {
  hoyCitas.A = await crearCitaHoy('QA18 Hoy A', '600000000');
  hoyCitas.B = await crearCitaHoy('QA18 Hoy B', '');
  hoyCitas.C = await crearCitaHoy('QA18 Hoy C', '');
  hoyCitas.D = await crearCitaHoy('QA18 Hoy D', '');
  return Object.fromEntries(Object.entries(hoyCitas)
    .map(([k, v]) => [k, { codigo: v.codigo, hora: v.hora, confirmada: v.confirmada, error: v.error }]));
}, 'b15-confirmada-hoy');

/* ---------- 8 · Profesional: Cumplida, No vino, Cancelar, bandeja ---------- */
await parada('pro-acciones-sobre-citas', async () => {
  await NAVEGAR(WEB + '/profesional');
  const envPro = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envPro.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  if (!claveReal) return { error: 'sin clave' };
  await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
  await clic('#btn-entrar');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto') && document.querySelectorAll('#hoy-citas .cita').length > 0`, 20000);
  if (!dentro) return { error: 'no entró al panel' };
  const actuar = async (codigo, accion) => {
    await evalJs(`(() => {
      const card = [...document.querySelectorAll('#hoy-citas .cita')].find(c => c.textContent.includes(${JSON.stringify('COD')}));
      const b = card && card.querySelector('[data-accion="${'ACC'}"]');
      if (b) b.click();
    })()`.replace('COD', codigo).replace('ACC', accion));
    await sleep(2800);
  };
  if (hoyCitas.A?.codigo) await actuar(hoyCitas.A.codigo, 'cumplida');
  if (hoyCitas.C?.codigo) await actuar(hoyCitas.C.codigo, 'cumplida');
  if (hoyCitas.D?.codigo) await actuar(hoyCitas.D.codigo, 'no_show');
  if (hoyCitas.B?.codigo) await actuar(hoyCitas.B.codigo, 'cancelar');
  const chips = await evalJs(`(() => {
    const out = {};
    for (const c of document.querySelectorAll('#hoy-citas .cita')) {
      const nom = c.querySelector('.quien b')?.textContent.trim();
      if (nom && nom.startsWith('QA18')) {
        const chip = c.querySelector('.chip[class*="estado"]');
        out[nom] = chip ? chip.textContent.trim() : '?';
      }
    }
    return out;
  })()`);
  await shot('b16-pro-hoy-acciones');
  // Bandeja: el mensaje de A debe traer su wa.me al teléfono de prueba.
  const bandeja = await evalJs(`(() => {
    const items = [...document.querySelectorAll('#hoy-bandeja .bandeja-item')];
    const deA = items.find(i => i.textContent.includes(${JSON.stringify(hoyCitas.A?.codigo || 'SIN-CODIGO')}));
    const deC = items.find(i => i.textContent.includes(${JSON.stringify(hoyCitas.C?.codigo || 'SIN-CODIGO')}));
    const info = x => x ? { wa: x.querySelector('a[href*="wa.me"]')?.getAttribute('href')?.slice(0, 80) || null,
                            sinTel: x.textContent.includes('Sin teléfono') } : null;
    return { total: items.length, deA: info(deA), deC: info(deC) };
  })()`);
  await shot('b17-pro-bandeja');
  // Descartar SOLO los mensajes de las citas QA18 de esta pasada.
  for (const cod of [hoyCitas.A?.codigo, hoyCitas.C?.codigo]) {
    if (!cod) continue;
    await evalJs(`(() => {
      const item = [...document.querySelectorAll('#hoy-bandeja .bandeja-item')].find(i => i.textContent.includes(${JSON.stringify(cod)}));
      const b = item && item.querySelector('[data-estado="descartada"]');
      if (b) b.click();
    })()`);
    await sleep(2400);
  }
  const bandejaTras = await evalJs(`document.querySelectorAll('#hoy-bandeja .bandeja-item').length`);
  // Verificación de estados en la agenda.
  const estados = {};
  for (const [k, v] of Object.entries(hoyCitas)) {
    if (!v?.codigo) continue;
    const c = await citaPorCodigo(HOY, v.codigo);
    estados[k] = c ? c.estado : 'NO-ENCONTRADA';
  }
  return { dentro, chips, bandeja, bandejaTrasDescartar: bandejaTras, estadosEnAgenda: estados };
});

/* ---------- 9 · D-02: /cita/ con estado cumplida ---------- */
await parada('d02-reagendar-sobre-cumplida', async () => {
  if (!hoyCitas.A?.token) return { error: 'sin token A' };
  await NAVEGAR(WEB + '/cita/' + hoyCitas.A.token);
  await esperar(`document.getElementById('contenido').style.display !== 'none' || document.getElementById('cancelada').style.display !== 'none'`, 12000);
  const antes = await evalJs(`(() => ({
    pastilla: document.getElementById('cita-estado')?.textContent.trim(),
    clasePastilla: document.getElementById('cita-estado')?.className,
    reagendarVisible: getComputedStyle(document.getElementById('tarjeta-reagendar')).display !== 'none',
    cancelarVisible: getComputedStyle(document.getElementById('tarjeta-cancelar')).display !== 'none',
    prepVisible: getComputedStyle(document.getElementById('tarjeta-prep')).display !== 'none',
  }))()`);
  await shot('b18-cita-cumplida-a');
  await evalJs(`(() => { const i = document.getElementById('inp-fecha'); i.value = '${REAG_D02}'; i.dispatchEvent(new Event('change')); })()`);
  const hayHuecos = await esperar(`document.querySelectorAll('#huecos .hueco').length > 0`, 15000);
  let intento = 'sin-huecos';
  if (hayHuecos) {
    await evalJs(`document.querySelector('#huecos .hueco')?.click()`);
    await sleep(400);
    await clic('#btn-reagendar');
    await esperar(`document.getElementById('reagendar-ok').classList.contains('visible') || document.getElementById('reagendar-error').classList.contains('visible')`, 15000);
    intento = await evalJs(`(() => ({
      ok: document.getElementById('reagendar-ok')?.textContent.trim(),
      error: document.getElementById('reagendar-error')?.textContent.trim(),
    }))()`);
  }
  const c = await citaPorCodigo(HOY, hoyCitas.A.codigo).catch(() => null);
  const enSuFecha = c ? { estado: c.estado, fecha: c.fecha } : null;
  let movida = null;
  if (!c) {
    const c2 = await citaPorCodigo(REAG_D02, hoyCitas.A.codigo).catch(() => null);
    movida = c2 ? { estado: c2.estado, fecha: c2.fecha, hora: c2.hora } : null;
  }
  return { antes, hayHuecos, intento, enSuFecha, movida };
}, 'b19-cita-cumplida-reagendar');
await parada('d02-cancelar-sobre-cumplida', async () => {
  if (!hoyCitas.C?.token) return { error: 'sin token C' };
  await NAVEGAR(WEB + '/cita/' + hoyCitas.C.token);
  await esperar(`document.getElementById('contenido').style.display !== 'none' || document.getElementById('cancelada').style.display !== 'none'`, 12000);
  const pastilla = await evalJs(`document.getElementById('cita-estado')?.textContent.trim()`);
  await shot('b20-cita-cumplida-c');
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  await sleep(3000);
  const tras = await evalJs(`(() => ({
    vistaCancelada: document.getElementById('cancelada').style.display !== 'none',
    errorTxt: document.getElementById('cancelar-error')?.textContent.trim(),
    contenidoVisible: document.getElementById('contenido').style.display !== 'none',
  }))()`);
  const c = await citaPorCodigo(HOY, hoyCitas.C.codigo).catch(() => null);
  return { pastilla, tras, estadoEnAgenda: c ? c.estado : 'NO-ENCONTRADA' };
}, 'b21-cita-cumplida-cancelar');

/* ---------- 10 · Cancelar la futura desde su enlace (+ agenda) ---------- */
await parada('cita-futura-cancelar', async () => {
  if (!tokenFutura) return { error: 'sin token futura' };
  await NAVEGAR(WEB + '/cita/' + tokenFutura);
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 12000);
  await clic('#btn-cancelar'); await sleep(600);
  await shot('b22-cita-cancelar-confirmacion');
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 12000);
  const c = await citaPorCodigo(REAG, codigoFutura).catch(() => null);
  return { cancelada, enAgenda: c ? { estado: c.estado, fecha: c.fecha, existe: true } : { existe: false } };
}, 'b23-cita-cancelada');

/* ---------- 11 · Lista de espera: sábado lleno → por_avisar ---------- */
await parada('lista-espera-sabado', async () => {
  const horas = ['10:00', '10:25', '10:50', '11:15', '11:40', '12:05', '12:30', '12:55', '13:20'];
  const bloqueos = [];
  for (const h of horas) {
    const r = await ag('POST', '/citas', { nombre: 'QA18 Bloqueo', servicio: 'Diseño de cejas',
                                           fecha: SABADO, hora: h, origen: 'qa18' });
    bloqueos.push({ hora: h, st: r.st, id: r.datos?.cita?.id, codigo: r.datos?.cita?.codigo });
  }
  const disp = await evalJs(`fetch('/api/disponibilidad?servicio=' + encodeURIComponent('Diseño de cejas') + '&fecha=${SABADO}').then(r => r.json())`);
  // Alta desde la UI de la clienta.
  await NAVEGAR(WEB + '/');
  await evalJs(`ir('p-inicio')`); await sleep(500);
  await clic('#pastilla-reservar'); await sleep(1000);
  await evalJs(`(() => {
    document.querySelectorAll('#res-servicios .servicio-card').forEach(c => {
      const on = c.classList.contains('sel');
      if ((c.dataset.servicio === 'Diseño de cejas') !== on) c.click();
    });
  })()`);
  await sleep(300);
  await clic('#btn-paso1-siguiente'); await sleep(700);
  await irAlMesBi('octubre');
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${SABADO}"]').click()`);
  const sinHuecos = await esperar(`document.querySelectorAll('#huecos .hora-fila').length === 0 && document.getElementById('tarjeta-espera').style.display !== 'none'`, 15000);
  await shot('b24-espera-form');
  await evalJs(`(() => { const n = document.getElementById('esp-nombre'); n.value = 'QA18 Espera'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#btn-espera');
  const okVisible = await esperar(`document.getElementById('espera-ok').style.display !== 'none' || document.getElementById('error-espera').textContent.trim().length > 0`, 15000);
  const formTxt = await evalJs(`(() => ({
    ok: document.getElementById('espera-ok')?.textContent.trim(),
    error: document.getElementById('error-espera')?.textContent.trim(),
  }))()`);
  // Estado en la agenda y paso a por_avisar al liberar un hueco.
  const leerEspera = async () => {
    const { datos } = await ag('GET', '/lista-espera');
    return (datos.lista_espera || []).find(e => e.nombre === 'QA18 Espera') || null;
  };
  const entradaAntes = await leerEspera();
  let entradaDespues = null;
  const primerBloqueo = bloqueos.find(b => b.id);
  if (primerBloqueo) {
    await ag('POST', `/citas/${primerBloqueo.id}/cancelar`, {});
    await sleep(600);
    entradaDespues = await leerEspera();
  }
  return { bloqueosSt: bloqueos.map(b => b.st), huecosSabado: (disp.huecos || []).length,
           sinHuecosEnUi: sinHuecos, okVisible, formTxt,
           entradaAntes: entradaAntes && { estado: entradaAntes.estado, servicio: entradaAntes.servicio, fecha_pref: entradaAntes.fecha_pref },
           entradaTrasLiberar: entradaDespues && { estado: entradaDespues.estado } };
});
await parada('lista-espera-en-profesional', async () => {
  await NAVEGAR(WEB + '/profesional');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto')`, 15000);
  await evalJs(`document.querySelector('.tab[data-tab="espera"]').click()`);
  await sleep(1800);
  const vista = await evalJs(`(() => {
    const item = [...document.querySelectorAll('#espera-lista .cita')].find(c => c.textContent.includes('QA18 Espera'));
    return item ? { texto: item.textContent.trim().replace(/\\s+/g, ' ').slice(0, 220),
                    chip: item.querySelector('.chip')?.textContent.trim() } : null;
  })()`);
  await shot('b25-pro-espera-qa18');
  // Limpieza de la entrada: descartarla desde el propio panel.
  await evalJs(`(() => {
    const item = [...document.querySelectorAll('#espera-lista .cita')].find(c => c.textContent.includes('QA18 Espera'));
    const b = item && item.querySelector('[data-estado="descartada"]');
    if (b) b.click();
  })()`);
  await sleep(2200);
  return { dentro, vista };
});
await parada('lista-espera-limpieza-sabado', async () => {
  const { datos } = await ag('GET', `/citas?fecha=${SABADO}`);
  let canceladas = 0;
  for (const c of (datos.citas || []).filter(x => x.nombre === 'QA18 Bloqueo' && x.estado === 'confirmada')) {
    const r = await ag('POST', `/citas/${c.id}/cancelar`, {});
    if (r.st === 200) canceladas++;
  }
  const { datos: d2 } = await ag('GET', `/citas?fecha=${SABADO}`);
  const restantes = (d2.citas || []).filter(x => x.nombre === 'QA18 Bloqueo')
    .map(x => x.estado);
  const { datos: le } = await ag('GET', '/lista-espera');
  const entrada = (le.lista_espera || []).find(e => e.nombre === 'QA18 Espera');
  return { canceladasEnLimpieza: canceladas, estadosBloqueos: restantes,
           entradaFinal: entrada ? entrada.estado : 'no-está' };
});

/* ---------- 12 · Instalar (estilo real) y compartir en el salón ---------- */
await parada('instalar-y-compartir', async () => {
  await NAVEGAR(WEB + '/');
  await sleep(1500);
  const instalar = await evalJs(`(() => { const b = document.getElementById('btn-instalar');
    const cs = getComputedStyle(b);
    return { visible: b.classList.contains('visible'), display: cs.display,
             fondo: cs.backgroundColor, color: cs.color }; })()`);
  await evalJs(`ir('p-salon')`); await sleep(1000);
  await clic('#btn-salon-compartir'); await sleep(1200);
  const compartir = await evalJs(`(() => ({
    hayCopiadoEnTexto: document.body.innerText.includes('copiado'),
    waAbiertas: window.__wa,
  }))()`);
  return { instalar, compartir };
});

guardarLog();
console.log('FASE A2 COMPLETA · paradas:', LOG.paradas.length, '· errores consola:', LOG.consola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
