// QA21 · MATRIZ-B — compleción de la matriz funcional (2ª pasada).
// La 1ª corrida (matriz.mjs) dio 7/15; los 8 fallos se diagnosticaron
// como bugs del propio script, verificados contra la BD y el código:
//   · buscador-vacio leía #explorar-grid (incluye tarjetas ocultas);
//     el aviso real vive en #sin-resultados-exp / #sin-resultados-txt.
//   · enlace-* y pack-cancelar derivaban el token de localStorage
//     (ya no trae g.token); el token sale del href de #conf-ver-cita.
//   · la espera tiene nombre propio #esp-nombre (no #inp-nombre).
//   · mi-cita muestra la reserva MÁS RECIENTE del dispositivo: se
//     aserta contra el pack creado en esta misma corrida.
//   · profesional leía solo 220 caracteres de la bandeja; el descarte
//     del id 54 se hace por su selector exacto [data-bandeja="54"].
//   · el reagendar de cita.html usa botones .hueco, no .hora-fila.
// Además esta pasada cierra los restos de la 1ª corrida por sus
// canales propios: la cita 515 (viva) se cancela llamando desde la
// sesión del panel al mismo endpoint que usa la interfaz (la vista
// Agenda es de solo lectura y Hoy solo muestra hoy), y el alta de
// espera creada aquí se descarta en «Por avisar» en su tarjeta.
// Uso: node matriz-b.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa21/matriz-b';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = { fase: 'QA21-matriz-b', filas: [], consola: [] };
const guardarLog = () => writeFileSync(`${OUT}/log-matriz-b.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9418', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa21-matrizb-perfil', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9418/json/version');
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
let sesionActual = null;
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
  if (m.method === 'Page.javascriptDialogOpening') {
    // confirm() nativo del panel (p. ej. al cancelar): se acepta.
    send('Page.handleJavaScriptDialog', { accept: true }, m.sessionId || sesionActual);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error')
    LOG.consola.push({ tipo: 'console.error', txt: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200) });
  if (m.method === 'Runtime.exceptionThrown')
    LOG.consola.push({ tipo: 'exception', txt: String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200) });
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
    LOG.consola.push({ tipo: 'log', txt: String(m.params.entry.text || '').slice(0, 200) });
});
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => { pendientes.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
}
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
sesionActual = sessionId;
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('DOM.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
async function evalJs(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
async function shot(nombre) {
  try {
    const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
  } catch (e) {}
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO-ESTA'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(500);
  }
  return false;
};
async function fila(id, fn, shotName) {
  const reg = { id, ok: false };
  try { reg.datos = await fn(); reg.ok = true; }
  catch (e) { reg.error = String(e.message || e).slice(0, 320); }
  if (shotName) await shot(shotName);
  LOG.filas.push(reg); guardarLog();
  console.log('fila', id, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''), reg.datos ? JSON.stringify(reg.datos).slice(0, 240) : '');
  return reg;
}
async function irAInicio() {
  await S('Page.navigate', { url: WEB + '/' });
  await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  await sleep(600);
}
async function seleccionarPack(objetivo) {
  for (let intento = 0; intento < 3; intento++) {
    const sel = await evalJs(`[...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio)`);
    const faltan = objetivo.filter(n => !sel.includes(n));
    const sobran = sel.filter(n => !objetivo.includes(n));
    if (!faltan.length && !sobran.length) return sel;
    for (const n of [...faltan, ...sobran]) {
      await evalJs(`document.querySelector('#res-servicios .servicio-card[data-servicio="${n}"]')?.click()`);
      await sleep(250);
    }
  }
  return evalJs(`[...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio)`);
}
async function abrirReservaPaso1() {
  await irAInicio();
  await clic('#pastilla-reservar');
  await esperar(`document.querySelectorAll('#res-servicios .servicio-card').length >= 4`, 15000);
  await sleep(500);
}
async function elegirEnCalendario(fecha) {
  let celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${fecha}"]')`);
  if (!celda) { await clic('#cal-sig'); await sleep(700); celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${fecha}"]')`); }
  if (!celda) return 0;
  const habil = await evalJs(`(() => { const c = document.querySelector('.cal-dia[data-fecha="${fecha}"]'); return !!c && !c.disabled; })()`);
  if (!habil) return 0;
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${fecha}"]').click()`);
  await esperar(`!document.getElementById('huecos').textContent.includes('Consultando')`, 12000);
  return evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].filter(h => h.style.display !== 'none').length`);
}
async function confirmarReserva(nombre) {
  await clic('#btn-paso2-siguiente'); await sleep(700);
  if (!await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 10000))
    throw new Error('no se llegó al paso 3');
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    n.value = ${JSON.stringify(nombre)}; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(300);
  await clic('#check-confirma'); await sleep(300);
  if (!await evalJs(`!document.getElementById('btn-confirmar').disabled`))
    throw new Error('confirmar no se habilitó');
  await clic('#btn-confirmar');
  if (!await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 30000))
    throw new Error('la confirmación no llegó');
  await sleep(700);
  return evalJs(`(() => {
    const enlace = document.getElementById('conf-ver-cita')?.getAttribute('href') || '';
    return { codigo: document.getElementById('conf-codigo')?.textContent.trim(),
      detalle: document.getElementById('conf-detalle')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200),
      icsVisible: document.getElementById('btn-ics')?.style.display !== 'none',
      enlace, token: enlace.includes('/cita/') ? enlace.split('/cita/')[1].split(/[?#]/)[0] : null };
  })()`);
}
async function entrarPanel() {
  const envTxt = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envTxt.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  if (!claveReal) throw new Error('sin clave en el fichero de la máquina');
  await S('Page.navigate', { url: WEB + '/profesional' });
  await sleep(700);
  await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
  await clic('#btn-entrar');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto')`, 20000);
  if (!dentro) throw new Error('el panel no se abrió');
  await sleep(1500);
}

/* ===== A · Panel: cerrar restos de la 1ª corrida (515 y bandeja 54) ===== */
await fila('panel-cierre-restos', async () => {
  await entrarPanel();
  // Bandeja: descartar EXACTAMENTE el mensaje id 54 (agradecimiento de QA21 Pro)
  const habia54 = await evalJs(`!!document.querySelector('[data-bandeja="54"]')`);
  if (!habia54) throw new Error('el mensaje 54 no estaba en la bandeja');
  await clic('[data-bandeja="54"][data-estado="descartada"]');
  await sleep(1500);
  const queda54 = await evalJs(`!!document.querySelector('[data-bandeja="54"]')`);
  if (queda54) throw new Error('el mensaje 54 sigue en la bandeja tras descartarlo');
  // Cita 515 (pack de la 1ª corrida, viva): cancelar por el endpoint del
  // panel, el mismo que invoca el botón «Cancelar esta cita» de la vista Hoy.
  const st = await evalJs(`(async () => { const r = await api('POST', '/api/profesional/citas/515/cancelar', {}); return r.st; })()`);
  if (st !== 200) throw new Error('cancelar la 515 por el panel devolvió ' + st);
  return { bandeja54Descartada: true, cita515CanceladaSt: st };
}, 'b01-panel-cierre');

/* ===== B1 · Buscador sin resultados (selectores correctos) ===== */
await fila('buscador-vacio', async () => {
  await irAInicio();
  await evalJs(`(() => { const i = document.getElementById('inp-buscar-home');
    i.value = 'xyz-sin-resultado'; document.getElementById('form-buscar-home').requestSubmit(); })()`);
  await sleep(1200);
  const estado = await evalJs(`(() => {
    const av = document.getElementById('sin-resultados-exp');
    const visibles = [...document.querySelectorAll('#explorar-grid .prod-card')].filter(c => c.offsetParent !== null).length;
    return { avisoVisible: !!av && av.style.display !== 'none',
             avisoTxt: document.getElementById('sin-resultados-txt')?.textContent.trim().slice(0, 120),
             visibles };
  })()`);
  if (!estado.avisoVisible) throw new Error('el aviso de vacío no es visible: ' + JSON.stringify(estado));
  if (!/ningún servicio coincide/i.test(estado.avisoTxt || '')) throw new Error('texto de aviso inesperado: ' + estado.avisoTxt);
  if (estado.visibles !== 0) throw new Error('quedan tarjetas visibles con la búsqueda vacía: ' + estado.visibles);
  await clic('#btn-ver-todos-exp');
  await sleep(900);
  const n = await evalJs(`[...document.querySelectorAll('#explorar-grid .prod-card')].filter(c => c.offsetParent !== null).length`);
  if (n < 4) throw new Error('la carta no se restauró: ' + n);
  return { aviso: estado.avisoTxt, tarjetasTrasRestaurar: n };
}, 'b02-buscador-vacio');

/* ===== B2 · Pack nuevo E2E (Diseño + Ombré, 31/10) ===== */
let pack = null;
await fila('pack-nuevo-e2e', async () => {
  await abrirReservaPaso1();
  const sel = await seleccionarPack(['Diseño de cejas', 'Ombré Brows Henna']);
  await clic('#btn-paso1-siguiente');
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 10000);
  const nHuecos = await elegirEnCalendario('2026-10-31');
  if (!nHuecos) throw new Error('sin huecos el 31/10 para el pack');
  await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
  await sleep(400);
  const hora = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
  const datos = await confirmarReserva('QA21 Pack B');
  if (!datos.codigo) throw new Error('sin código de cita');
  if (!datos.token) throw new Error('sin token derivable del enlace de confirmación: ' + datos.enlace);
  if (!/48\s*€/.test(datos.detalle || '') || !/90 min/.test(datos.detalle || ''))
    throw new Error('las sumas del pack no cuadran en la confirmación: ' + datos.detalle);
  pack = { ...datos, fecha: '2026-10-31', hora, sel };
  return { sel, fecha: '2026-10-31', hora, codigo: datos.codigo, detalle: datos.detalle };
}, 'b03-pack-nuevo');

/* ===== B3 · Enlace mágico: ver ===== */
await fila('enlace-ver', async () => {
  if (!pack?.token) throw new Error('sin token del pack');
  await S('Page.navigate', { url: WEB + '/cita/' + pack.token });
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await sleep(600);
  const texto = await evalJs(`document.getElementById('contenido').innerText.replace(/\\s+/g, ' ')`);
  const ok = texto.includes('CONFIRMADA') && texto.includes(pack.codigo) &&
    /Ombré Brows Henna/.test(texto) && /31 de octubre/.test(texto);
  if (!ok) throw new Error('la cita no se muestra como se esperaba: ' + texto.slice(0, 200));
  return { muestra: texto.slice(0, 150) };
}, 'b04-enlace-cita');

/* ===== B4 · Enlace mágico: prep (segmentos por data-valor) ===== */
await fila('enlace-prep', async () => {
  await esperar(`document.getElementById('tarjeta-prep')?.offsetParent !== null`, 10000);
  await clic('#prep-tratamiento button.seg[data-valor="No, ninguno"]');
  await sleep(300);
  await clic('#prep-retinol button.seg[data-valor="No"]');
  await sleep(300);
  await clic('#btn-prep');
  const ok = await esperar(`(document.getElementById('prep-ok')?.textContent || '').includes('Guardado')`, 12000);
  if (!ok) throw new Error('el prep no confirmó el guardado: ' +
    (await evalJs(`document.getElementById('prep-error')?.textContent.trim().slice(0, 140)`)));
  return { okTxt: await evalJs(`document.getElementById('prep-ok').textContent.trim().slice(0, 120)`) };
}, 'b05-enlace-prep');

/* ===== B5 · Enlace mágico: reagendar 31/10 → 03/11 (botones .hueco) ===== */
await fila('enlace-reagendar', async () => {
  await evalJs(`(() => { const i = document.getElementById('inp-fecha');
    i.value = '2026-11-03'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const hay = await esperar(`[...document.querySelectorAll('#huecos .hueco')].some(b => b.style.display !== 'none')`, 15000);
  if (!hay) throw new Error('sin huecos al reagendar al 03/11');
  await evalJs(`[...document.querySelectorAll('#huecos .hueco')].find(b => b.style.display !== 'none')?.click()`);
  await sleep(400);
  await esperar(`!document.getElementById('btn-reagendar').disabled`, 8000);
  await clic('#btn-reagendar');
  const ok = await esperar(`(document.getElementById('reagendar-ok')?.textContent || '').includes('3 de noviembre')`, 15000);
  if (!ok) throw new Error('el reagendado no confirmó: ' +
    (await evalJs(`document.getElementById('reagendar-ok')?.textContent.trim().slice(0, 160)`)) + ' | error: ' +
    (await evalJs(`document.getElementById('reagendar-error')?.textContent.trim().slice(0, 140)`)));
  pack.fecha = '2026-11-03';
  return { okTxt: await evalJs(`document.getElementById('reagendar-ok').textContent.trim().slice(0, 130)`) };
}, 'b06-enlace-reagendar');

/* ===== B6 · Mi cita = la reserva más reciente (este pack) ===== */
await fila('mi-cita', async () => {
  if (!pack?.codigo) throw new Error('sin pack');
  await irAInicio();
  await clic('#nav-perfil'); await sleep(900);
  await clic('#btn-perfil-micita'); await sleep(1000);
  const ok = await esperar(`document.getElementById('micita-datos')?.style.display !== 'none'`, 10000);
  const resumen = await evalJs(`document.getElementById('micita-resumen')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200)`);
  if (!ok || !(resumen || '').includes(pack.codigo)) throw new Error('Mi cita no muestra el pack nuevo: ' + resumen);
  return { resumen };
}, 'b07-mi-cita');

/* ===== B7 · Cierre: cancelar el pack nuevo por su enlace ===== */
await fila('pack-cancelar', async () => {
  if (!pack?.token) throw new Error('sin token del pack');
  await S('Page.navigate', { url: WEB + '/cita/' + pack.token });
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 15000);
  await S('Page.reload', {}); await sleep(2500);
  const sigue = await evalJs(`document.getElementById('cancelada').style.display !== 'none'`);
  if (!cancelada || !sigue) throw new Error('la cancelación del pack no persistió');
  return { codigo: pack.codigo, cancelada, persisteTrasRecarga: sigue };
}, 'b08-pack-cancelada');

/* ===== C1 · Domingo cerrado + alta en espera (con #esp-nombre) ===== */
await fila('espera-domingo', async () => {
  await abrirReservaPaso1();
  await seleccionarPack(['Diseño de cejas']);
  await clic('#btn-paso1-siguiente');
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 10000);
  await evalJs(`(() => {
    document.querySelector('#inp-fecha').value = '2026-11-01';
    if (typeof cargarHuecos === 'function') cargarHuecos();
  })()`);
  const tarjeta = await esperar(`document.querySelector('#tarjeta-espera')?.offsetParent !== null`, 20000);
  if (!tarjeta) throw new Error('la tarjeta de espera no apareció en domingo');
  const textoHuecos = await evalJs(`document.getElementById('huecos')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160)`);
  if (!/domingo/i.test(textoHuecos || '')) throw new Error('sin mensaje de domingo: ' + textoHuecos);
  await evalJs(`(() => {
    const n = document.getElementById('esp-nombre');
    n.value = 'QA21 Espera'; n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('esp-telefono');
    t.value = '600123456'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#btn-espera');
  const ok = await esperar(`document.querySelector('#espera-ok')?.offsetParent !== null &&
    document.querySelector('#espera-ok').style.display !== 'none'`, 15000);
  if (!ok) throw new Error('el alta en espera no confirmó: ' +
    (await evalJs(`document.querySelector('#error-espera')?.textContent.trim()`)));
  return { domingo: textoHuecos.slice(0, 90), altaOk: ok };
}, 'b09-espera-domingo');

/* ===== D1 · Panel: descartar el alta «QA21 Espera» en su tarjeta ===== */
await fila('panel-espera-descartar', async () => {
  await entrarPanel();
  await evalJs(`document.querySelector('.tab[data-tab="espera"]')?.click()`);
  await sleep(1800);
  const descarte = await evalJs(`(() => {
    const card = [...document.querySelectorAll('#espera-lista article.cita')]
      .find(a => a.textContent.includes('QA21 Espera'));
    if (!card) return 'NO-ESTA';
    const b = card.querySelector('[data-espera][data-estado="descartada"]');
    if (!b) return 'SIN-BOTON';
    b.click(); return 'ok';
  })()`);
  if (descarte !== 'ok') throw new Error('no se pudo descartar el alta: ' + descarte);
  await sleep(1500);
  const sigue = await evalJs(`(document.getElementById('espera-lista')?.innerText || '').includes('QA21 Espera')`);
  if (sigue) throw new Error('QA21 Espera sigue en Por avisar tras descartarla');
  return { descartada: true };
}, 'b10-panel-espera');

LOG.resumen = {
  filasOk: LOG.filas.filter(f => f.ok).length, filasTotal: LOG.filas.length,
  erroresConsola: LOG.consola.length, packCodigo: pack?.codigo || null,
};
guardarLog();
console.log(`MATRIZ-B COMPLETA · filas OK: ${LOG.resumen.filasOk}/${LOG.resumen.filasTotal} · errores de consola: ${LOG.consola.length}`);
if (LOG.consola.length) console.log(JSON.stringify(LOG.consola).slice(0, 400));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
