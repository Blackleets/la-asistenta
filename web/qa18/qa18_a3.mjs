// QA18-A3 · LISTA DE ESPERA, RE-EJECUCIÓN COMPLETA (29/10/2026).
// En A2 el alta falló por no rellenar el teléfono (la validación de
// la app funcionó). Aquí: sábado 31/10 bloqueado de nuevo, alta con
// teléfono, verificación en la agenda, liberación de un hueco y
// comprobación del paso a «por_avisar» y de su visibilidad en el
// área profesional. Limpieza total al final.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const OUT = '/data/la-asistenta/web/qa18';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SABADO = '2026-10-31';
const LOG = { fase: 'A3', paradas: [], consola: [] };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-a3.json`, JSON.stringify(LOG, null, 1));
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
const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9364', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa18-perfil-a3', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9364/json/version');
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
  if (m.method === 'Runtime.exceptionThrown') {
    LOG.consola.push({ parada: paradaActual, tipo: 'exception',
      txt: String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200) });
  }
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
    LOG.consola.push({ parada: paradaActual, tipo: 'log',
      txt: String(m.params.entry.text || '').slice(0, 200) });
  }
});
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => { pendientes.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
}
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
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

await parada('bloqueo-y-alta', async () => {
  const horas = ['10:00', '10:25', '10:50', '11:15', '11:40', '12:05', '12:30', '12:55', '13:20'];
  const bloqueos = [];
  for (const h of horas) {
    const r = await ag('POST', '/citas', { nombre: 'QA18 Bloqueo', servicio: 'Diseño de cejas',
                                           fecha: SABADO, hora: h, origen: 'qa18' });
    bloqueos.push({ hora: h, st: r.st, id: r.datos?.cita?.id });
  }
  LOG.bloqueos = bloqueos;
  await S('Page.navigate', { url: WEB + '/' });
  await sleep(4000);
  await clic('#pastilla-reservar'); await sleep(1000);
  await evalJs(`(() => {
    document.querySelectorAll('#res-servicios .servicio-card').forEach(c => {
      const on = c.classList.contains('sel');
      if ((c.dataset.servicio === 'Diseño de cejas') !== on) c.click();
    });
  })()`);
  await sleep(300);
  await clic('#btn-paso1-siguiente'); await sleep(700);
  // El mes en vista será octubre (fecha por defecto: mañana 30/10).
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${SABADO}"]').click()`);
  const sinHuecos = await esperar(`document.querySelectorAll('#huecos .hora-fila').length === 0 && document.getElementById('tarjeta-espera').style.display !== 'none'`, 15000);
  await evalJs(`(() => {
    const n = document.getElementById('esp-nombre'); n.value = 'QA18 Espera';
    const t = document.getElementById('esp-telefono'); t.value = '600000000';
  })()`);
  await shot('d01-espera-form-relleno');
  await clic('#btn-espera');
  const okVisible = await esperar(`document.getElementById('espera-ok').style.display !== 'none'`, 15000);
  const errTxt = await evalJs(`document.getElementById('error-espera')?.textContent.trim()`);
  const leer = async () => {
    const { datos } = await ag('GET', '/lista-espera');
    return (datos.lista_espera || []).find(e => e.nombre === 'QA18 Espera') || null;
  };
  const entrada = await leer();
  LOG.entradaId = entrada?.id;
  return { bloqueosSt: bloqueos.map(b => b.st), sinHuecos, okVisible, errTxt,
           entrada: entrada && { id: entrada.id, estado: entrada.estado,
                                 servicio: entrada.servicio, fecha_pref: entrada.fecha_pref } };
}, 'd02-espera-ok');

await parada('liberar-y-por-avisar', async () => {
  const primero = (LOG.bloqueos || []).find(b => b.id);
  let cancelSt = null;
  if (primero) {
    const r = await ag('POST', `/citas/${primero.id}/cancelar`, {});
    cancelSt = r.st;
  }
  await sleep(800);
  const { datos } = await ag('GET', '/lista-espera');
  const entrada = (datos.lista_espera || []).find(e => e.nombre === 'QA18 Espera') || null;
  return { cancelSt, entradaTrasLiberar: entrada && { estado: entrada.estado } };
});

await parada('por-avisar-en-profesional', async () => {
  await S('Page.navigate', { url: WEB + '/profesional' });
  await sleep(2500);
  const envPro = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envPro.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
  await clic('#btn-entrar');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto')`, 20000);
  await evalJs(`document.querySelector('.tab[data-tab="espera"]').click()`);
  await sleep(1800);
  const vista = await evalJs(`(() => {
    const item = [...document.querySelectorAll('#espera-lista .cita')].find(c => c.textContent.includes('QA18 Espera'));
    return item ? { chip: item.querySelector('.chip')?.textContent.trim(),
                    tieneWa: !!item.querySelector('a[href*="wa.me"]'),
                    texto: item.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200) } : null;
  })()`);
  await shot('d03-pro-por-avisar');
  // Descartar la entrada desde el panel (limpieza hecha por la propia UI).
  await evalJs(`(() => {
    const item = [...document.querySelectorAll('#espera-lista .cita')].find(c => c.textContent.includes('QA18 Espera'));
    const b = item && item.querySelector('[data-estado="descartada"]');
    if (b) b.click();
  })()`);
  await sleep(2200);
  const sigue = await evalJs(`[...document.querySelectorAll('#espera-lista .cita')].some(c => c.textContent.includes('QA18 Espera'))`);
  return { dentro, vista, sigueTrasDescartar: sigue };
});

await parada('limpieza-final', async () => {
  const { datos } = await ag('GET', `/citas?fecha=${SABADO}`);
  let canceladas = 0;
  for (const c of (datos.citas || []).filter(x => x.nombre === 'QA18 Bloqueo' && x.estado === 'confirmada')) {
    const r = await ag('POST', `/citas/${c.id}/cancelar`, {});
    if (r.st === 200) canceladas++;
  }
  const { datos: le } = await ag('GET', '/lista-espera');
  const entrada = (le.lista_espera || []).find(e => e.nombre === 'QA18 Espera');
  return { canceladas, entradaFinal: entrada ? entrada.estado : 'no-está' };
});

guardarLog();
console.log('FASE A3 COMPLETA · paradas:', LOG.paradas.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
