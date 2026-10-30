// QA21 · Delta §56 en el Salón: el h2 «¿No sabes qué servicio elegir?»
// ocupa dos líneas en Montserrat (la voz de B5) y la tarjeta crece
// ~30 px; al reposo, la barra inferior cubre la última línea del
// párrafo siguiente (el mismo patrón con el que ya cubría «Servicios»).
// Medición en reposo (scrollY=0) a 412×915 + capturas, antes/después
// de un posible arreglo. No toca reservas ni datos.
// Uso: node salon.mjs antes|despues
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODO = ['despues', 'candidato'].includes(process.argv[2]) ? process.argv[2] : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = `/data/la-asistenta/web/qa21/salon/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9413', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa21-salon-' + MODO, 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9413/json/version');
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
    erroresConsola.push(m.params.entry.text || 'error');
  if (m.method === 'Runtime.exceptionThrown')
    erroresConsola.push('excepción');
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
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
}
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};

await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
// Entrar al Salón por su pastilla de la home («El salón»)
await evalJs(`document.getElementById('pastilla-salon').click()`);
const entro = await esperar(`document.getElementById('p-salon')?.classList.contains('activa')
  && document.querySelector('.salon-titulo')?.getBoundingClientRect().height > 0`, 10000);
if (!entro) throw new Error('no se entró en el Salón (pantalla no activa/visible)');
await esperar(`document.querySelectorAll('#salon-servicios .fila-servicio, #salon-servicios .servicio-card').length >= 3`, 15000);
await sleep(1200);
if (MODO === 'candidato') {
  // Arreglo candidato SIN desplegar: el h2 de ESTA tarjeta al peldaño 19
  // de la escala B4 (destacado), inyectado solo en esta sesión de QA.
  await evalJs(`(() => { const st = document.createElement('style');
    st.textContent = '.tarjeta-analisis h2{font-size:19px}';
    document.head.appendChild(st); })()`);
  await sleep(500);
}
await evalJs(`window.scrollTo(0, 0)`); await sleep(400);

const med = await evalJs(`(() => {
  const R = el => el ? (() => { const r = el.getBoundingClientRect();
    return { y: Math.round(r.y), bottom: Math.round(r.bottom), alto: Math.round(r.height), ancho: Math.round(r.width) }; })() : null;
  const lineasDe = el => {
    if (!el || !el.firstChild) return null;
    const rango = document.createRange(); rango.selectNodeContents(el);
    return [...rango.getClientRects()].map(r => ({ y: Math.round(r.y), bottom: Math.round(r.bottom), ancho: Math.round(r.width) }));
  };
  const h2 = document.querySelector('.tarjeta-analisis h2');
  const card = document.querySelector('.tarjeta-analisis');
  const pCard = card?.querySelector('p');
  const titServicios = [...document.querySelectorAll('#p-salon .seccion-titulo')]
    .find(t => t.textContent.trim() === 'Servicios');
  const subServicios = titServicios?.nextElementSibling;
  const nav = document.querySelector('.barra-nav');
  const navR = R(nav);
  const ultimaLinea = el => { const ls = lineasDe(el); return ls ? ls[ls.length - 1] : null; };
  const cubiertaPorNav = linea => (linea && navR) ? Math.max(0, linea.bottom - navR.y) : null;
  return {
    scrollY: Math.round(window.scrollY),
    vh: window.innerHeight,
    h2: { ...R(h2), fuente: getComputedStyle(h2).fontSize, lineas: lineasDe(h2)?.length,
          anchos: lineasDe(h2)?.map(l => l.ancho) },
    tarjeta: R(card),
    pTarjetaUltimaLinea: ultimaLinea(pCard),
    pTarjetaCubiertaPx: cubiertaPorNav(ultimaLinea(pCard)),
    barraSalon: R(document.querySelector('.salon-barra')),
    miniTarjeta: R(card?.querySelector('.mini')),
    miniUltimaLinea: ultimaLinea(card?.querySelector('.mini')),
    btnAnalisis: R(document.getElementById('btn-salon-analisis')),
    btnAnalisisSobreBarra: (() => { const b = R(document.getElementById('btn-salon-analisis'));
      const s = R(document.querySelector('.salon-barra'));
      return (b && s) ? Math.max(0, Math.min(b.bottom, s.bottom) - Math.max(b.y, s.y)) : null; })(),
    titServicios: R(titServicios),
    subServiciosUltimaLinea: ultimaLinea(subServicios),
    subServiciosCubiertaPx: cubiertaPorNav(ultimaLinea(subServicios)),
    nav: navR,
    scrollW: document.documentElement.scrollWidth,
  };
})()`);
await shot('salon-reposo');
// La tarjeta de análisis encuadrada (para comparar el titular)
await evalJs(`document.querySelector('.tarjeta-analisis').scrollIntoView({ block: 'center' })`);
await sleep(600);
await shot('salon-tarjeta');

writeFileSync(`${OUT}/datos.json`, JSON.stringify({ modo: MODO, med, erroresConsola }, null, 2));
console.log(MODO, JSON.stringify(med, null, 1));
console.log('errores de consola:', erroresConsola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
