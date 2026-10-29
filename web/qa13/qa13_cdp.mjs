// QA13 · ÁREA PROFESIONAL (29/10) a 412x915 conduciendo Chromium por
// CDP contra la máquina real.
// Verifica: acceso denegado sin la clave (ni un dato), acceso con la
// clave del negocio (leída del fichero del servidor; NUNCA se imprime),
// «Hoy» con una cita real de prueba (con su mini-formulario de
// preparación), marcar cumplida -> bandeja de salida -> descartar,
// agenda de 7 días, lista de espera «por avisar» con su enlace wa.me
// y panel (embudo + carta de solo lectura con su nota honesta).
// La cita de prueba queda CANCELADA al final, como siempre.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const TOK = { 'X-API-Token': 'la-asistenta-dev', 'Content-Type': 'application/json' };
const OUT = '/data/la-asistenta/web/qa13';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);
const erroresConsola = [];

mkdirSync(OUT, { recursive: true });

// Clave del negocio: solo se lee del fichero del servidor (0600).
const CLAVE = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })
  .format(new Date()); // YYYY-MM-DD en hora del salón

async function apiAgenda(metodo, ruta, cuerpo) {
  const r = await fetch(AGENDA + ruta, {
    method: metodo, headers: TOK,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  return { st: r.status, datos: await r.json().catch(() => ({})) };
}

/* ---------- preparación: cita de hoy con prep + espera por_avisar ---------- */
let citaId = null, esperaId = null;
{
  const disp = await (await fetch(
    WEB + '/api/disponibilidad?servicio=' +
    encodeURIComponent('Diseño de cejas') + '&fecha=' + hoy)).json();
  const hora = (disp.huecos || [])[0];
  ev('preparación: hay un hueco real hoy para la cita de prueba', !!hora, hora || 'sin huecos');
  const { st, datos } = await apiAgenda('POST', '/citas', {
    nombre: 'PRUEBA QA13', servicio: 'Diseño de cejas', fecha: hoy,
    hora, telefono: '+34600123456', origen: 'web',
  });
  citaId = datos?.cita?.id;
  ev('preparación: cita de prueba creada', st === 201 && !!citaId, `id=${citaId}`);
  const token = (datos?.cita?.enlace || '').split('/cita/')[1];
  const hash = createHash('sha256').update(token).digest('hex');
  const prep = await apiAgenda('POST', `/enlace/${hash}/prep`, {
    tratamiento_reciente: 'Henna hace dos semanas (prueba QA13)',
    retinol: 'No uso retinol (prueba QA13)',
  });
  ev('preparación: mini-formulario ligado a la cita',
     prep.st === 200 && !!prep.datos?.cita?.prep);
  const alta = await apiAgenda('POST', '/lista-espera', {
    nombre: 'PRUEBA QA13 Espera', telefono: '+34600123456',
    servicio: 'Diseño de cejas', origen: 'web',
  });
  esperaId = alta.datos?.entrada?.id;
  const marca = await apiAgenda('POST', `/lista-espera/${esperaId}/estado`,
                                { estado: 'por_avisar' });
  ev('preparación: entrada de espera en «por_avisar»',
     !!esperaId && marca.st === 200);
}

/* ---------- navegador ---------- */
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9353', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9353/json/version');
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
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
    erroresConsola.push(m.params.entry.text || 'error de log');
  if (m.method === 'Runtime.exceptionThrown')
    erroresConsola.push('excepción: ' + (m.params?.exceptionDetails?.text || ''));
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
await S('Log.enable');
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
async function esperar(fn, ms = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evalJs(fn)) return true;
    await sleep(400);
  }
  return false;
}
const sinDesborde = async nombre => {
  const ok = await evalJs(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  ev(`sin desborde horizontal en ${nombre}`, !!ok);
};

try {
  /* ---------- acceso denegado ---------- */
  await S('Page.navigate', { url: WEB + '/profesional' });
  await sleep(1800);
  ev('la página de acceso se sirve', await evalJs(
    `!document.getElementById('vista-acceso').classList.contains('oculto')`));
  ev('sin sesión no se ve ni un dato del negocio', await evalJs(
    `document.getElementById('vista-panel').classList.contains('oculto') &&
     !document.body.innerText.includes('PRUEBA QA13')`));
  await shot('qa13-01-acceso');
  await evalJs(`document.getElementById('clave').value = 'clave-falsa-qa13'`);
  await evalJs(`document.getElementById('btn-entrar').click()`);
  const denegado = await esperar(
    `document.getElementById('acceso-error').textContent.includes('no válida')`);
  ev('clave falsa: acceso denegado con mensaje claro', denegado);
  ev('tras el intento falso el panel sigue oculto', await evalJs(
    `document.getElementById('vista-panel').classList.contains('oculto')`));
  await shot('qa13-02-denegado');

  /* ---------- acceso real ---------- */
  await evalJs(`document.getElementById('clave').value = ${JSON.stringify(CLAVE)}`);
  await evalJs(`document.getElementById('btn-entrar').click()`);
  const dentro = await esperar(
    `!document.getElementById('vista-panel').classList.contains('oculto') &&
     document.getElementById('hoy-citas').innerText.includes('PRUEBA QA13')`);
  ev('con la clave del negocio se entra y «Hoy» trae la cita real', dentro);
  const hoyTxt = await evalJs(`document.getElementById('hoy-citas').innerText`);
  ev('la cita muestra su código AS-XXXX', /AS-[A-Z0-9]{4}/.test(hoyTxt));
  ev('la cita muestra su preparación (prep)', hoyTxt.includes('Henna hace dos semanas'));
  await sinDesborde('hoy');
  await shot('qa13-03-hoy');

  /* ---------- cumplida -> bandeja -> descartar ---------- */
  await evalJs(`document.querySelector('button[data-accion="cumplida"][data-id="${citaId}"]').click()`);
  const enBandeja = await esperar(
    `document.getElementById('hoy-bandeja').innerText.includes('PRUEBA QA13')`);
  ev('al marcar cumplida, el agradecimiento aparece en la bandeja', enBandeja);
  await evalJs(`document.querySelector('#hoy-bandeja').scrollIntoView()`);
  await sleep(400);
  await shot('qa13-04-bandeja');
  // Se descarta LA entrada de esta prueba (la bandeja puede tener
  // entradas pendientes de baterías anteriores: no son de esta QA).
  await evalJs(`[...document.querySelectorAll('#hoy-bandeja .bandeja-item')]
    .find(a => a.innerText.includes('PRUEBA QA13'))
    .querySelector('button[data-bandeja][data-estado="descartada"]').click()`);
  const bandejaLimpia = await esperar(
    `!document.getElementById('hoy-bandeja').innerText.includes('PRUEBA QA13')`);
  ev('la entrada de la prueba se descarta y sale de la bandeja', bandejaLimpia);

  /* ---------- agenda ---------- */
  await evalJs(`document.querySelector('.tab[data-tab="agenda"]').click()`);
  await esperar(`document.querySelectorAll('#agenda-dias .dia').length >= 7`);
  const nDias = await evalJs(`document.querySelectorAll('#agenda-dias .dia').length`);
  ev('agenda: 7 días pintados', nDias === 7, `días=${nDias}`);
  const agendaTxt = await evalJs(`document.getElementById('agenda-dias').innerText`);
  ev('agenda: muestra huecos libres reales', agendaTxt.includes('Huecos libres'));
  await sinDesborde('agenda');
  await shot('qa13-05-agenda');

  /* ---------- por avisar ---------- */
  await evalJs(`document.querySelector('.tab[data-tab="espera"]').click()`);
  const enEspera = await esperar(
    `document.getElementById('espera-lista').innerText.includes('PRUEBA QA13 Espera')`);
  ev('lista de espera: la entrada «por_avisar» se ve', enEspera);
  const waOk = await evalJs(
    `[...document.querySelectorAll('#espera-lista a')].some(a => a.href.startsWith('https://wa.me/34600123456'))`);
  ev('la entrada trae su enlace wa.me para avisar a mano', waOk);
  const avisoHonesto = await evalJs(
    `document.getElementById('tab-espera').innerText.includes('no puede enviarle el aviso sola')`);
  ev('la UI explica que el aviso lo envía la profesional', avisoHonesto);
  await shot('qa13-06-espera');
  await evalJs(`document.querySelector('button[data-espera="${esperaId}"][data-estado="atendida"]').click()`);
  const atendida = await esperar(
    `!document.getElementById('espera-lista').innerText.includes('PRUEBA QA13 Espera')`);
  ev('marcar «atendida» funciona y la entrada sale de la lista', atendida);

  /* ---------- mi negocio ---------- */
  await evalJs(`document.querySelector('.tab[data-tab="panel"]').click()`);
  await esperar(`document.querySelectorAll('#panel-embudo .celda').length >= 7`);
  const nCeldas = await evalJs(`document.querySelectorAll('#panel-embudo .celda').length`);
  ev('embudo: 7 tarjetas con cifras reales', nCeldas === 7, `celdas=${nCeldas}`);
  const nServ = await evalJs(`document.querySelectorAll('#panel-servicios .serv-fila').length`);
  ev('carta de solo lectura: los 4 servicios reales', nServ === 4, `servicios=${nServ}`);
  await evalJs(`document.getElementById('btn-editar-carta').click()`);
  const nota = await evalJs(
    `!document.getElementById('nota-edicion').classList.contains('oculto') &&
     document.getElementById('nota-edicion').innerText.includes('los cambios los hace La Asistenta por ti')`);
  ev('«Editar» muestra la nota honesta (sin formularios que no guardan)', nota);
  await sinDesborde('mi negocio');
  await shot('qa13-07-negocio');

  // El 401 del intento con clave falsa ES la función trabajando (el
  // navegador lo anota como recurso fallido): se filtra ese y solo ese.
  const erroresReales = erroresConsola.filter(e => !e.includes('401'));
  ev('consola sin errores (fuera del 401 deliberado del acceso denegado)',
     erroresReales.length === 0, erroresReales.slice(0, 3).join(' | '));
} finally {
  /* limpieza: la cita de prueba queda cancelada, nunca borrada */
  if (citaId) {
    const { st, datos } = await apiAgenda('POST', `/citas/${citaId}/cancelar`, {});
    ev('limpieza: cita de prueba cancelada',
       st === 200 && datos?.cita?.estado === 'cancelada');
  }
  try { ws.close(); } catch {}
  chrome.kill();
}

console.log('\n' + evidencias.join('\n'));
const fallos = evidencias.filter(e => e.startsWith('FALLO'));
console.log(`\nRESUMEN QA13: ${evidencias.length - fallos.length}/${evidencias.length} en verde`);
process.exit(fallos.length ? 1 : 0);
