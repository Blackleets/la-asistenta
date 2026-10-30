// QA21 · PWA — ruta de actualización de caché v29 → v30.
// Uso en dos fases con el MISMO perfil de Chromium (persiste en disco):
//   1) Con sw.js v29 servido en la máquina:  node pwa.mjs fase1
//      → la instalación queda controlada por v29, caché v29 creada.
//   2) Se restaura el sw.js real (v30) en la máquina y: node pwa.mjs fase2
//      → registration.update() + recarga: debe controlar v30, la caché
//        v29 debe desaparecer y la app debe funcionar entera.
// Veredicto: actualización limpia sí/no, con evidencia en el log.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const FASE = process.argv[2];
if (!['fase1', 'fase2'].includes(FASE)) { console.error('uso: node pwa.mjs fase1|fase2'); process.exit(2); }
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa21/pwa';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = { fase: 'QA21-pwa-' + FASE, consola: [] };

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9419', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa21-pwa-perfil', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9419/json/version');
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
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
async function evalJs(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
const esperar = async (expr, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(500);
  }
  return false;
};
async function shot(nombre) {
  try {
    const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
  } catch (e) {}
}
const estadoSW = () => evalJs(`(async () => {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const cachesN = await caches.keys();
  return { hayReg: !!reg,
    activoEstado: reg?.active?.state || null,
    esperando: !!reg?.waiting, instalando: !!reg?.installing,
    controlador: !!navigator.serviceWorker.controller,
    caches: cachesN };
})()`);
async function appFunciona() {
  const reco = await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  const pastillas = await evalJs(`document.querySelectorAll('#pastillas .pastilla').length`);
  return { reco, pastillas };
}

let resultado;
if (FASE === 'fase1') {
  const servido = await evalJs(`fetch('/sw.js').then(r => r.text()).then(t => (t.match(/la-asistenta-shell-v\\d+/) || [''])[0]).catch(() => 'SIN-RED')`);
  // Ojo: evalJs antes de navegar corre en about:blank; repetir tras navegar.
  await S('Page.navigate', { url: WEB + '/' });
  const servido2 = await evalJs(`fetch('/sw.js').then(r => r.text()).then(t => (t.match(/la-asistenta-shell-v\\d+/) || [''])[0]).catch(() => 'SIN-RED')`);
  if (servido2 !== 'la-asistenta-shell-v29') throw new Error('el servidor no está sirviendo v29: ' + servido2);
  const activo = await esperar(`(async () => { const r = await navigator.serviceWorker.getRegistration('/'); return !!r?.active; })()`, 30000);
  await sleep(1500);
  const est = await estadoSW();
  const app = await appFunciona();
  resultado = { servido: servido2, swActivo: activo, ...est, app };
  if (!est.caches.includes('la-asistenta-shell-v29')) throw new Error('la caché v29 no se creó: ' + JSON.stringify(est.caches));
  if (!app.reco) throw new Error('la app no renderizó con v29');
  await shot('pwa-fase1-v29.png');
} else {
  await S('Page.navigate', { url: WEB + '/' });
  await sleep(1000);
  const antes = await estadoSW();
  const servido = await evalJs(`fetch('/sw.js').then(r => r.text()).then(t => (t.match(/la-asistenta-shell-v\\d+/) || [''])[0]).catch(() => 'SIN-RED')`);
  if (servido !== 'la-asistenta-shell-v30') throw new Error('el servidor no está sirviendo v30: ' + servido);
  await evalJs(`(async () => { const r = await navigator.serviceWorker.getRegistration('/'); await r.update(); return true; })()`);
  const migrada = await esperar(`(async () => {
    const ks = await caches.keys();
    return ks.length === 1 && ks[0] === 'la-asistenta-shell-v30';
  })()`, 30000);
  await sleep(1000);
  await S('Page.reload', {});
  await sleep(1500);
  const despues = await estadoSW();
  const app = await appFunciona();
  const raizEnCache = await evalJs(`(async () => { const c = await caches.open('la-asistenta-shell-v30'); return !!(await c.match('/')); })()`);
  resultado = { antes, servido, cacheMigradaLimpia: migrada, despues, raizEnCacheV30: raizEnCache, app };
  if (!migrada) throw new Error('la caché no migró limpia a v30: ' + JSON.stringify(despues.caches));
  if (!despues.controlador) throw new Error('la página no quedó controlada tras la actualización');
  if (!app.reco) throw new Error('la app no renderizó tras actualizar a v30');
  await shot('pwa-fase2-v30.png');
}
LOG.resultado = resultado;
LOG.erroresConsola = LOG.consola.length;
writeFileSync(`${OUT}/log-${FASE}.json`, JSON.stringify(LOG, null, 1));
console.log(FASE.toUpperCase(), 'OK', JSON.stringify(resultado).slice(0, 400), '· errores de consola:', LOG.consola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
