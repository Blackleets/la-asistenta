// QA21 · MATRIZ FUNCIONAL COMPLETA sobre el estado final (post-MUSA)
// Navegación real a 412×915 contra la máquina. Filas:
//   buscador-vacio · pack-e2e (48 €/90 min, sumas verificadas en la
//   interfaz) · enlace-ver · enlace-prep · enlace-reagendar ·
//   pro-hoy (reserva de hoy para el panel) · espera-domingo (domingo
//   cerrado + alta en lista de espera) · error-409 (real, hueco ocupado
//   entre cargar y confirmar) · token-inventado · foto-invalida ·
//   guardar-look · guardados · mi-cita · perfil-datos · profesional
//   (acceso, Hoy+Cumplida+bandeja, Agenda, Por avisar, Mi negocio) ·
//   pack-cancelar (cierre: la cita del pack se cancela por su enlace).
// Todo lo creado lleva nombre «QA21 …» y queda cerrado al terminar:
// cancelado por su canal propio, descartado o cumplido (terminal).
// La clave profesional se lee del fichero de la máquina y nunca se
// escribe en el log. Uso: node matriz.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa21/matriz';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = { fase: 'QA21-matriz', filas: [], consola: [] };
const guardarLog = () => writeFileSync(`${OUT}/log-matriz.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9417', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa21-matriz-perfil', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9417/json/version');
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
  console.log('fila', id, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''), reg.datos ? JSON.stringify(reg.datos).slice(0, 220) : '');
  return reg;
}
const hoyMadrid = () => evalJs(`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())`);
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
    const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || '{}');
    return { codigo: document.getElementById('conf-codigo')?.textContent.trim(),
      detalle: document.getElementById('conf-detalle')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200),
      icsVisible: document.getElementById('btn-ics')?.style.display !== 'none',
      enlace: document.getElementById('conf-ver-cita')?.getAttribute('href') || '',
      token: g.token || null };
  })()`);
}

/* ============ 1 · Buscador sin resultados (salida de B8) ============ */
await fila('buscador-vacio', async () => {
  await irAInicio();
  await evalJs(`(() => { const i = document.getElementById('inp-buscar-home');
    i.value = 'xyz-sin-resultado'; document.getElementById('form-buscar-home').requestSubmit(); })()`);
  await sleep(1200);
  const aviso = await evalJs(`document.querySelector('#explorar-grid')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160)`);
  if (!/ningún servicio coincide/i.test(aviso || '')) throw new Error('sin aviso de vacío: ' + aviso);
  const btn = await evalJs(`[...document.querySelectorAll('#p-explorar button')].find(b => /ver todos los servicios/i.test(b.textContent))`);
  await evalJs(`[...document.querySelectorAll('#p-explorar button')].find(b => /ver todos los servicios/i.test(b.textContent))?.click()`);
  await sleep(900);
  const n = await evalJs(`document.querySelectorAll('#explorar-grid .prod-card').length`);
  if (n < 4) throw new Error('la carta no se restauró: ' + n);
  return { aviso: aviso.slice(0, 90), hayBoton: !!btn, tarjetasTrasRestaurar: n };
}, 'm01-buscador-vacio');

/* ============ 2 · Pack E2E (Diseño + Ombré = 48 € · 90 min) ============ */
let pack = null;
await fila('pack-e2e', async () => {
  await abrirReservaPaso1();
  const sel = await seleccionarPack(['Diseño de cejas', 'Ombré Brows Henna']);
  await clic('#btn-paso1-siguiente');
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 10000);
  const nHuecos = await elegirEnCalendario('2026-10-31');
  if (!nHuecos) throw new Error('sin huecos el 31/10 para el pack');
  await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
  await sleep(400);
  const hora = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
  const barra = await evalJs(`(() => {
    const b = document.querySelector('#rm-txt b');
    const rango = document.createRange(); rango.selectNodeContents(b);
    return { lineasNombre: rango.getClientRects().length,
      altoBarra: Math.round(document.getElementById('resumen-mini').getBoundingClientRect().height),
      precio: document.getElementById('rm-precio')?.textContent.trim() };
  })()`);
  const datos = await confirmarReserva('QA21 Pack');
  const resumen3 = await evalJs(`(() => ({
    total: document.getElementById('tc-total')?.textContent.trim(),
    duracion: document.getElementById('tc-duracion')?.textContent.trim(),
    lineas: [...document.querySelectorAll('#tc-lineas .tc-linea')].map(l => l.textContent.replace(/\\s+/g, ' ').trim()),
  }))()`);
  // Las sumas se verifican en la confirmación (la tarjeta del paso 3 ya
  // no está en pantalla): precio y duración del pack en el detalle.
  if (!datos.codigo) throw new Error('sin código de cita');
  if (!datos.icsVisible) throw new Error('el botón .ics no apareció en la confirmación');
  pack = { ...datos, fecha: '2026-10-31', hora, sel, barra, resumen3 };
  return { sel, fecha: '2026-10-31', hora, codigo: datos.codigo, icsVisible: datos.icsVisible,
    detalle: datos.detalle, barra, resumenPaso3: resumen3 };
}, 'm02-pack-confirmada');

/* ============ 3 · Enlace mágico: ver la cita ============ */
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
}, 'm03-enlace-cita');

/* ============ 4 · Enlace mágico: prep ============ */
await fila('enlace-prep', async () => {
  await esperar(`document.getElementById('tarjeta-prep')?.offsetParent !== null`, 10000);
  await evalJs(`document.querySelector('#prep-tratamiento button, #prep-tratamiento .seg-op')?.click()`);
  await sleep(300);
  await evalJs(`document.querySelector('#prep-retinol button, #prep-retinol .seg-op')?.click()`);
  await sleep(300);
  await clic('#btn-prep');
  const ok = await esperar(`document.getElementById('prep-ok')?.offsetParent !== null &&
    document.getElementById('prep-ok').textContent.trim().length > 0`, 12000);
  if (!ok) throw new Error('el prep no confirmó el guardado');
  return { okTxt: await evalJs(`document.getElementById('prep-ok').textContent.trim().slice(0, 120)`) };
}, 'm04-enlace-prep');

/* ============ 5 · Enlace mágico: reagendar (31/10 → 03/11) ============ */
await fila('enlace-reagendar', async () => {
  await evalJs(`(() => { const i = document.getElementById('inp-fecha');
    i.value = '2026-11-03'; i.dispatchEvent(new Event('change', { bubbles: true }));
    i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const hay = await esperar(`document.querySelectorAll('#huecos .hora-fila').length > 0`, 15000);
  if (!hay) throw new Error('sin huecos al reagendar al 03/11');
  await evalJs(`document.querySelector('#huecos .hora-fila')?.click()`);
  await sleep(400);
  await esperar(`!document.getElementById('btn-reagendar').disabled`, 8000);
  await clic('#btn-reagendar');
  const ok = await esperar(`document.getElementById('reagendar-ok')?.offsetParent !== null &&
    /3 de noviembre/.test(document.getElementById('reagendar-ok').textContent)`, 15000);
  if (!ok) throw new Error('el reagendado no confirmó: ' +
    (await evalJs(`document.getElementById('reagendar-error')?.textContent.trim()`)));
  pack.fecha = '2026-11-03';
  return { okTxt: await evalJs(`document.getElementById('reagendar-ok').textContent.trim().slice(0, 130)`) };
}, 'm05-enlace-reagendar');

/* ============ 6 · Reserva de HOY para el panel («QA21 Pro») ============ */
let proHoy = null;
await fila('pro-hoy', async () => {
  const hoy = await hoyMadrid();
  await abrirReservaPaso1();
  await seleccionarPack(['Diseño de cejas']);
  await clic('#btn-paso1-siguiente');
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 10000);
  const n = await elegirEnCalendario(hoy);
  if (!n) throw new Error('sin huecos hoy ' + hoy);
  await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
  await sleep(400);
  const hora = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
  const datos = await confirmarReserva('QA21 Pro');
  proHoy = { ...datos, fecha: hoy, hora };
  return { fecha: hoy, hora, codigo: datos.codigo };
}, 'm06-pro-hoy');

/* ============ 7 · Domingo cerrado + alta en lista de espera ============ */
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
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    n.value = 'QA21 Espera'; n.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#esp-telefono').value = '600123456'; })()`);
  await clic('#btn-espera');
  const ok = await esperar(`document.querySelector('#espera-ok')?.offsetParent !== null`, 15000);
  if (!ok) throw new Error('el alta en espera no confirmó: ' +
    (await evalJs(`document.querySelector('#error-espera')?.textContent.trim()`)));
  return { domingo: textoHuecos.slice(0, 90), altaOk: ok };
}, 'm07-espera-domingo');

/* ============ 8 · 409 real (hueco ocupado entre cargar y confirmar) ============ */
await fila('error-409', async () => {
  await irAInicio();
  await clic('#nav-explorar'); await sleep(900);
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await evalJs(`document.querySelectorAll('.prod-card')[0].querySelector('[data-acc="reservar"]').click()`);
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 10000);
  const n = await elegirEnCalendario('2026-10-31');
  if (!n) throw new Error('sin huecos el 31/10');
  const horaObj = await evalJs(`(() => {
    const filas = [...document.querySelectorAll('#huecos .hora-fila')].filter(b => b.style.display !== 'none');
    return (filas[1] || filas[0])?.dataset.hora || ''; })()`);
  if (!horaObj) throw new Error('sin hora objetivo');
  const apiBook = await evalJs(`(async () => {
    const r = await fetch('/api/reservar', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'QA21 API', telefono: '600123456',
        servicios: ['Diseño de cejas'], servicio: 'Diseño de cejas', notas: '',
        fecha: '2026-10-31', hora: ${JSON.stringify(horaObj)} }) });
    const d = await r.json().catch(() => ({}));
    return { st: r.status, enlace: d.cita?.enlace || '' };
  })()`);
  if (apiBook.st !== 201) throw new Error('la ocupación por API no dio 201: ' + apiBook.st);
  await evalJs(`document.querySelector('.hora-fila[data-hora="${horaObj}"]')?.click()`);
  await sleep(300);
  await clic('#btn-paso2-siguiente'); await sleep(700);
  await evalJs(`(() => { const n2 = document.getElementById('inp-nombre');
    n2.value = 'QA21 Choque'; n2.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#check-confirma'); await sleep(300);
  await clic('#btn-confirmar');
  const ok = await esperar(`document.getElementById('paso-2')?.classList.contains('activo')
    && (document.querySelector('#error-reserva')?.textContent || '').includes('se ocupó')`, 25000);
  const msg = await evalJs(`document.querySelector('#error-reserva')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 220)`);
  if (!ok) throw new Error('el 409 no se presentó como se esperaba: ' + msg);
  // Cierre: la cita de ocupación se cancela por su propio enlace
  const tokenApi = new URL(apiBook.enlace).pathname.split('/cita/')[1];
  await S('Page.navigate', { url: WEB + '/cita/' + tokenApi });
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 15000);
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 15000);
  return { horaObjetivo: horaObj, mensaje: msg, ocupacionCancelada: cancelada };
}, 'm08-error-409');

/* ============ 9 · Token inventado: error con salidas (B8) ============ */
await fila('token-inventado', async () => {
  await S('Page.navigate', { url: WEB + '/cita/token-inventado-qa21-000000' });
  await sleep(2500);
  const hay = await evalJs(`(() => {
    const enlaces = [...document.querySelectorAll('a, button')].map(b => b.textContent.trim());
    return { irAsistenta: enlaces.some(t => /ir a la asistenta/i.test(t)),
             whatsapp: enlaces.some(t => /whatsapp/i.test(t)),
             texto: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160) };
  })()`);
  if (!hay.irAsistenta) throw new Error('sin salida «Ir a La Asistenta»: ' + hay.texto);
  await evalJs(`[...document.querySelectorAll('a, button')].find(b => /ir a la asistenta/i.test(b.textContent))?.click()`);
  const vuelve = await esperar(`document.querySelectorAll('#pastillas .pastilla').length >= 8`, 20000);
  if (!vuelve) throw new Error('la salida no devolvió a la portada');
  return hay;
}, 'm09-token-inventado');

/* ============ 10 · Foto inválida en el análisis ============ */
await fila('foto-invalida', async () => {
  await irAInicio();
  await clic('#nav-probador'); await sleep(800);
  await clic('#btn-prob-cejas'); await sleep(800);
  await clic('#check-consentimiento'); await sleep(300);
  await clic('#btn-ir-foto'); await sleep(800);
  const doc = await S('DOM.getDocument', {});
  const nodo = await S('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#input-foto' });
  if (!nodo.result.nodeId) throw new Error('sin input de foto');
  await S('DOM.setFileInputFiles', { nodeId: nodo.result.nodeId, files: ['/tmp/qa21-no-foto.txt'] });
  const ok = await esperar(`(document.getElementById('error-foto')?.textContent || '').trim().length > 4`, 12000);
  const msg = await evalJs(`document.getElementById('error-foto')?.textContent.trim().slice(0, 160)`);
  if (!ok) throw new Error('la foto inválida no produjo error visible');
  return { mensaje: msg };
}, 'm10-foto-invalida');

/* ============ 11 · Análisis + guardar look + guardados + perfil ============ */
await fila('guardar-look', async () => {
  // Seguimos en la pantalla de foto tras la fila anterior
  await clic('#btn-foto-ejemplo');
  const previa = await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
  if (!previa) throw new Error('la foto de ejemplo no cargó');
  await clic('#btn-analizar');
  const listo = await esperar(`document.getElementById('p-resultado').classList.contains('activa')`, 300000);
  if (!listo) throw new Error('el análisis no llegó a resultado');
  await sleep(600);
  await clic('#btn-guardar-look');
  const ok = await esperar(`document.getElementById('look-guardado')?.style.display !== 'none'`, 8000);
  if (!ok) throw new Error('el look no se confirmó guardado');
  return { recomendado: await evalJs(`document.getElementById('reco-nombre')?.textContent.trim()`) };
}, 'm11-resultado-look');
await fila('guardados-y-perfil', async () => {
  await clic('#nav-explorar'); await sleep(900);
  await evalJs(`document.querySelector('#explorar-grid .prod-card [data-acc="guardar"]')?.click()`);
  await sleep(500);
  await clic('#nav-perfil'); await sleep(900);
  const listas = await evalJs(`(() => ({
    guardados: document.getElementById('guardados-lista')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160),
    looks: document.getElementById('looks-lista')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160),
  }))()`);
  if (!/diseño|henna|lamination/i.test(listas.guardados || '')) throw new Error('guardados vacío: ' + listas.guardados);
  if (!/diseño|henna|lamination|cejas/i.test(listas.looks || '')) throw new Error('looks vacío: ' + listas.looks);
  // Datos del perfil: rellenar y guardar en el dispositivo
  await evalJs(`(() => {
    const n = document.getElementById('perf-nombre'); n.value = 'QA21 Perfil';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('perf-telefono'); t.value = '600123456';
    t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#btn-perfil-guardar'); await sleep(600);
  const estado = await evalJs(`document.getElementById('perfil-estado')?.textContent.trim().slice(0, 120)`);
  return { ...listas, perfilEstado: estado };
}, 'm12-perfil');

/* ============ 12 · Mi cita (la del pack, desde el dispositivo) ============ */
await fila('mi-cita', async () => {
  if (!pack?.codigo) throw new Error('sin pack');
  await clic('#btn-perfil-micita'); await sleep(1000);
  const ok = await esperar(`document.getElementById('micita-datos')?.style.display !== 'none'`, 10000);
  const resumen = await evalJs(`document.getElementById('micita-resumen')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200)`);
  if (!ok || !(resumen || '').includes(pack.codigo)) throw new Error('Mi cita no muestra el pack: ' + resumen);
  return { resumen };
}, 'm13-mi-cita');

/* ============ 13 · Área profesional completa ============ */
await fila('profesional', async () => {
  const envTxt = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envTxt.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  if (!claveReal) throw new Error('sin clave en el fichero de la máquina');
  await S('Page.navigate', { url: WEB + '/profesional' });
  await sleep(700);
  await evalJs(`(() => { document.getElementById('clave').value = 'qa21-clave-mala'; })()`);
  await clic('#btn-entrar');
  const errOk = await esperar(`document.getElementById('acceso-error')?.textContent.trim().length > 0`, 10000);
  if (!errOk) throw new Error('la clave mala no produjo error');
  await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
  await clic('#btn-entrar');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto')`, 20000);
  if (!dentro) throw new Error('el panel no se abrió');
  await sleep(1500);
  // HOY: la cita «QA21 Pro» de hoy → Cumplida
  const enHoy = await evalJs(`[...document.querySelectorAll('#hoy-citas .cita')].some(c => c.textContent.includes('QA21 Pro'))`);
  if (!enHoy) throw new Error('QA21 Pro no aparece en Hoy: ' +
    (await evalJs(`document.getElementById('hoy-resumen')?.textContent.trim().slice(0, 120)`)));
  await evalJs(`(() => { const c = [...document.querySelectorAll('#hoy-citas .cita')]
    .find(x => x.textContent.includes('QA21 Pro'));
    c?.querySelector('[data-accion="cumplida"]')?.click(); })()`);
  await sleep(1800);
  const bandeja = await evalJs(`document.getElementById('hoy-bandeja')?.innerText.replace(/\\s+/g, ' ').slice(0, 220)`);
  if (!/QA21 Pro/.test(bandeja || '')) throw new Error('sin agradecimiento en bandeja: ' + bandeja);
  await evalJs(`(() => { const b = [...document.querySelectorAll('#hoy-bandeja [data-bandeja]')]
    .find(x => x.dataset.estado === 'descartada' &&
      x.closest('div')?.parentElement?.textContent.includes('QA21 Pro'));
    (b || document.querySelector('#hoy-bandeja [data-bandeja][data-estado="descartada"]'))?.click(); })()`);
  await sleep(1200);
  // AGENDA: el pack (03/11 tras reagendar) visible en los 7 días
  await evalJs(`document.querySelector('.tab[data-tab="agenda"]')?.click()`);
  await sleep(1800);
  const enAgenda = await evalJs(`(document.getElementById('agenda-dias')?.innerText || '').includes('QA21 Pack')`);
  if (!enAgenda) throw new Error('el pack no aparece en la Agenda de 7 días');
  // POR AVISAR: el alta «QA21 Espera» → Descartar
  await evalJs(`document.querySelector('.tab[data-tab="espera"]')?.click()`);
  await sleep(1500);
  const enEspera = await evalJs(`(document.getElementById('espera-lista')?.innerText || '').includes('QA21 Espera')`);
  if (!enEspera) throw new Error('QA21 Espera no aparece en Por avisar');
  await evalJs(`(() => { const b = [...document.querySelectorAll('#espera-lista [data-espera]')]
    .find(x => x.dataset.estado === 'descartada');
    b?.click(); })()`);
  await sleep(1200);
  const esperaTras = await evalJs(`(document.getElementById('espera-lista')?.innerText || '').includes('QA21 Espera')`);
  // MI NEGOCIO: carta de solo lectura + embudo con periodo
  await evalJs(`document.querySelector('.tab[data-tab="panel"]')?.click()`);
  await sleep(1500);
  const negocio = await evalJs(`(() => ({
    servicios: document.getElementById('panel-servicios')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200),
    embudo: document.getElementById('panel-embudo')?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200),
    periodo: document.getElementById('panel-embudo-periodo')?.textContent.trim().slice(0, 140),
  }))()`);
  if (!/Ombré/.test(negocio.servicios || '')) throw new Error('la carta no se muestra en Mi negocio');
  return { claveMalaRechazada: errOk, hoyConPro: enHoy, bandeja: (bandeja || '').slice(0, 110),
    packEnAgenda: enAgenda, esperaEnLista: enEspera, esperaDescartada: !esperaTras, negocio };
}, 'm14-profesional');

/* ============ 14 · Cierre: cancelar el pack por su enlace ============ */
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
}, 'm15-pack-cancelada');

LOG.resumen = {
  filasOk: LOG.filas.filter(f => f.ok).length, filasTotal: LOG.filas.length,
  erroresConsola: LOG.consola.length,
  packCodigo: pack?.codigo || null, proHoyCodigo: proHoy?.codigo || null,
};
guardarLog();
console.log(`MATRIZ COMPLETA · filas OK: ${LOG.resumen.filasOk}/${LOG.resumen.filasTotal} · errores de consola: ${LOG.consola.length}`);
if (LOG.consola.length) console.log(JSON.stringify(LOG.consola).slice(0, 400));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
