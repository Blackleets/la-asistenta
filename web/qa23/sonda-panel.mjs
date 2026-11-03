import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa23';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LOG = { fase: 'QA23-sonda-panel', pasos: [], consola: [], resumen: {} };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-secuencia.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9421', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa23-sonda-perfil', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9421/json/version');
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

/* ===== QA23 · Sonda del panel en modo Agenda (sin gasto Meta) =====
   Crea una cita por la API pública de reserva (la misma que usa la
   web) para el lunes 02/11, entra en /profesional, abre la pestaña
   Agenda y comprueba que la cita se ve por NOMBRE (las tarjetas de
   Agenda no pintan el código AS-XXXX: eso lo pinta «Hoy»).
   Después cancela la cita por su enlace. Cronometra el tramo del
   panel (navegar -> cita visible en Agenda). */
const tRun0 = Date.now();
try {
let token = null, citaId = null, codigo = null;
// 1 · hueco libre del lunes y reserva por API
const disp = await (await fetch(WEB + '/api/disponibilidad?servicio=' + encodeURIComponent('Diseño de cejas') + '&fecha=2026-11-02')).json();
const hora = (disp.huecos || [])[0];
if (!hora) throw new Error('sin huecos el 02/11: ' + JSON.stringify(disp).slice(0, 200));
const rres = await fetch(WEB + '/api/reservar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ nombre: 'QA23 Panel', servicio: 'Diseño de cejas', fecha: '2026-11-02', hora, telefono: '', notas: 'Sonda QA23 del panel (31/10). Se cancela al terminar.' }) });
const dres = await rres.json();
citaId = dres.cita?.id; codigo = dres.cita?.codigo || dres.codigo || null;
token = dres.token || dres.cita?.token || (dres.enlace || '').split('/cita/')[1] || null;
LOG.resumen.reserva = { st: rres.status, citaId, codigo, hora, hayToken: !!token, clavesRespuesta: Object.keys(dres) };
if (rres.status !== 201 || !citaId) throw new Error('la reserva de la sonda no se creó: ' + JSON.stringify(dres).slice(0, 200));
guardarLog();
// 2 · panel: login + pestaña Agenda (cronometrado)
const t0 = Date.now();
await NAVEGAR(WEB + '/profesional');
const envTxt = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
const claveReal = (envTxt.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
const hayClave = await esperar(`!!document.getElementById('clave')`, 15000);
if (!hayClave) throw new Error('el formulario de acceso no apareció');
await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
await clic('#btn-entrar');
const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto')`, 20000);
if (!dentro) throw new Error('el panel no se abrió con la clave');
await evalJs(`document.querySelector('.tab[data-tab="agenda"]')?.click()`);
const encontrada = await esperar(`(document.getElementById('agenda-dias')?.innerText || '').includes('QA23 Panel')`, 25000);
const segsPanel = Math.round((Date.now() - t0) / 100) / 10;
LOG.resumen.panel = { dentro, encontrada, segsPanel };
guardarLog();
let textoDia = null;
try { textoDia = await evalJs(`(() => { const t = document.getElementById('agenda-dias')?.innerText || ''; const i = t.indexOf('QA23 Panel'); return i >= 0 ? t.slice(Math.max(0, i - 60), i + 80).replace(/\\n/g, ' | ') : null; })()`); } catch (e) {}
LOG.resumen.panel.textoDia = textoDia;
await shot('sonda-panel-agenda');
if (!encontrada) throw new Error('la cita de la sonda no aparece en Agenda por nombre');
// 3 · cancelar por la API de agenda (la respuesta de /api/reservar
// no trae token; el token de la agenda se lee en memoria y no se
// registra — mismo canal que usan las baterías)
const envAgenda = readFileSync('/data/la-asistenta/agenda/agenda.env', 'utf8');
const tokAgenda = (envAgenda.match(/AGENDA_API_TOKEN=(.+)/) || [])[1]?.trim();
const rcanc = await fetch('http://127.0.0.1:8081/citas/' + citaId + '/cancelar', { method: 'POST',
  headers: { 'X-API-Token': tokAgenda, 'Content-Type': 'application/json' }, body: '{}' });
const cancelada = rcanc.status === 200;
LOG.resumen.cancelacion = { cancelada, via: 'api-agenda', http: rcanc.status };
LOG.resumen.erroresConsola = LOG.consola.length;
LOG.resumen.duracionTotalS = Math.round((Date.now() - tRun0) / 100) / 10;
guardarLog();
console.log('SONDA PANEL QA23 · panel:', JSON.stringify(LOG.resumen.panel), '· cancelada:', cancelada, '· errores consola:', LOG.consola.length);
} catch (e) {
  LOG.resumen.errorFatal = String(e.message || e).slice(0, 300);
  try { guardarLog(); } catch {}
  console.log('SONDA PANEL QA23 · ERROR FATAL:', LOG.resumen.errorFatal, '· resumen parcial:', JSON.stringify(LOG.resumen));
}
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
