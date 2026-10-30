// QA-B5 · MUSA Bloque B5 — una sola voz de titular (29/10/2026)
// Capturas comparativas a 412x915 en dos modos:
//   node b5.mjs antes    → producción actual (post-B4, SW v23)
//   node b5.mjs despues  → tras unificar titulares en Montserrat (SW v24)
// Pantallas con titulares serif hoy: Salón, Reserva (pasos 1 y 2),
// Resultado (análisis REAL con la foto de ejemplo), Confirmada
// (reserva completa desde el resultado), Cita (enlace mágico real de
// esa reserva) y Profesional·Hoy. Al final de cada pasada la cita de
// prueba «PRUEBA B5» se cancela desde la propia página /cita (canal
// propio; queda cancelada, no borrada) y así consta en el JSON.
// La clave profesional se lee del fichero del servidor; NUNCA se imprime.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const RAIZ = '/data/la-asistenta/web';
const OUT = `${RAIZ}/qa-b5/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const CLAVE = readFileSync(`${RAIZ}/profesional.env`, 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9365', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b5-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9365/json/version');
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
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
}
async function shotFull(nombre) {
  const { result } = await S('Page.getLayoutMetrics');
  const size = result.cssContentSize || result.contentSize;
  const r = await S('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
  });
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};
const informe = { modo: MODO, erroresConsola };

/* ---------- clienta: Inicio (contexto) ---------- */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await sleep(900);
await shot('inicio');

/* ---------- Salón ---------- */
await clic('.fila-salon-home');
await esperar(`document.getElementById('p-salon')?.classList.contains('activa')`, 8000);
await sleep(700);
await shot('salon');

/* ---------- Reserva paso 1 y paso 2 ---------- */
await clic('#nav-inicio'); await sleep(600);
await clic('#pastilla-reservar');
await esperar(`document.getElementById('paso-1')?.classList.contains('activo')`, 8000);
await sleep(500);
await evalJs(`window.scrollTo(0, 0)`); await sleep(200);
await shot('reserva-paso1');
await esperar(`!document.getElementById('btn-paso1-siguiente').disabled`, 8000);
await clic('#btn-paso1-siguiente');
await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
await esperar(`document.querySelectorAll('.hora-fila').length > 0 || /sin huecos|no hay huecos/i.test(document.getElementById('paso-2')?.textContent || '')`, 25000);
await evalJs(`window.scrollTo(0, 0)`); await sleep(400);
await shot('reserva-paso2');

/* ---------- Resultado: análisis REAL con foto de ejemplo (flujo de B2/B4) ---------- */
await clic('#nav-probador'); await sleep(700);
await clic('#btn-prob-cejas'); await sleep(700);
await clic('#check-consentimiento'); await sleep(300);
await clic('#btn-ir-foto'); await sleep(700);
await clic('#btn-foto-ejemplo');
await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
await sleep(400);
const t0 = Date.now();
await clic('#btn-analizar');
const listo = await esperar(`document.getElementById('p-resultado').classList.contains('activa')`, 300000);
const latencia = Math.round((Date.now() - t0) / 100) / 10;
informe.latencia = latencia;
informe.resultadoListo = !!listo;
if (!listo) {
  writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 2));
  console.log('B5', MODO, '· SIN RESULTADO tras', latencia, 's · errores:', erroresConsola.length);
  try { ws.close(); } catch {}
  chrome.kill();
  process.exit(1);
}
await sleep(1000);
informe.recoNombre = await evalJs(`document.getElementById('reco-nombre')?.textContent || ''`);
await evalJs(`window.scrollTo(0, 0)`); await sleep(250);
await shotFull('resultado');

/* ---------- Confirmada: reserva completa desde el resultado ---------- */
await clic('#btn-reservar-reco');
await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
await esperar(`document.querySelectorAll('.hora-fila').length > 0`, 25000);
await clic('.hora-fila');
await esperar(`!document.getElementById('btn-paso2-siguiente').disabled`, 8000);
await clic('#btn-paso2-siguiente');
await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 8000);
await evalJs(`(() => { const n = document.getElementById('inp-nombre');
  n.value = 'PRUEBA B5'; n.dispatchEvent(new Event('input', {bubbles:true})); })()`);
await clic('#check-confirma');
await esperar(`!document.getElementById('btn-confirmar').disabled`, 8000);
await clic('#btn-confirmar');
const confirmada = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')
  && document.getElementById('conf-codigo')?.textContent.trim().length > 0`, 30000);
informe.confirmada = !!confirmada;
informe.codigo = await evalJs(`document.getElementById('conf-codigo')?.textContent.trim() || ''`);
await sleep(900); // secuencia de confirmación (§51) asentada
await evalJs(`window.scrollTo(0, 0)`); await sleep(200);
await shot('confirmada');

/* ---------- Cita: el enlace mágico real de esa reserva ---------- */
const hrefCita = await evalJs(`document.getElementById('conf-ver-cita')?.href || ''`);
informe.hrefCita = hrefCita ? hrefCita.replace(/\/cita\/[A-Za-z0-9_-]+/, '/cita/<token>') : '';
if (hrefCita && hrefCita.includes('/cita/')) {
  await S('Page.navigate', { url: hrefCita });
  await esperar(`document.querySelector('.tarjeta h2') || document.querySelector('.error-caja')`, 15000);
  await sleep(700);
  await evalJs(`window.scrollTo(0, 0)`); await sleep(200);
  await shot('cita');
  /* limpieza: cancelar la cita de prueba por el canal propio de la página */
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`/cancelada/i.test(document.body.textContent)`, 15000);
  informe.citaPruebaCancelada = !!cancelada;
} else {
  informe.citaPruebaCancelada = false;
  informe.avisoCita = 'sin enlace en la confirmación';
}

/* ---------- profesional: Hoy ---------- */
await S('Page.navigate', { url: WEB + '/profesional' });
await esperar(`!!document.querySelector('#clave')`);
await evalJs(`document.querySelector('#clave').value = ${JSON.stringify(CLAVE)};
              document.querySelector('#clave').dispatchEvent(new Event('input', {bubbles:true}))`);
await evalJs(`document.querySelector('#btn-entrar').click()`);
await esperar(`!document.querySelector('#vista-panel').classList.contains('oculto')
               && document.querySelectorAll('#hoy-citas .cita, #hoy-citas .vacio').length > 0`);
await sleep(600);
await shot('profesional-hoy');

writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 2));
console.log(JSON.stringify(informe, null, 1));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
