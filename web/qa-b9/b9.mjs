// QA-B9 · MUSA Bloque B9 — foto: jerarquía correcta y preferencias
// declaradas opcionales (29/10/2026)
// Recorrido REAL contra la app en la máquina (127.0.0.1:8090), a 412×915:
//   Inicio → Probador → consentimiento → pantalla de foto:
//   captura del bloque de foto y de las preferencias + MEDICIÓN de los
//   dos botones (geometría y estilos computados: quién manda en el
//   bloque) → foto de ejemplo → análisis REAL → resultado completo
//   (verificación de que el camino no cambia).
// Dos modos con carpetas propias:  node b9.mjs antes | despues
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = `/data/la-asistenta/web/qa-b9/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9389', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa-b9-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9389/json/version');
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

// ---- recorrido: Inicio → Probador → consentimiento → foto ----
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await clic('#nav-probador'); await sleep(700);
await clic('#btn-prob-cejas'); await sleep(700);
await clic('#check-consentimiento'); await sleep(300);
await clic('#btn-ir-foto'); await sleep(800);
const enFoto = await esperar(`document.getElementById('p-foto').classList.contains('activa')`, 10000);

// ---- medición del bloque de foto: quién manda ----
const medicion = await evalJs(`(() => {
  const info = sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      texto: el.textContent.trim(),
      clases: el.className,
      ancho: Math.round(r.width), alto: Math.round(r.height),
      area: Math.round(r.width * r.height),
      fondo: cs.backgroundColor, colorTexto: cs.color,
      borde: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      fuente: cs.fontSize + ' / ' + cs.fontWeight,
    };
  };
  const rotulo = [...document.querySelectorAll('#p-foto p, #p-foto h3')]
    .map(e => e.textContent.replace(/\\s+/g, ' ').trim())
    .find(t => /ya viene ajustado/.test(t)) || null;
  const grupos = document.querySelectorAll('#p-foto .grupo-pref').length;
  const preMarcados = [...document.querySelectorAll('#p-foto .grupo-pref')].filter(g => g.querySelector('.seg.sel')).length;
  return {
    elegir: info('#btn-elegir-foto'),
    ejemplo: info('#btn-foto-ejemplo'),
    rotuloEstilo: rotulo,
    gruposPref: grupos, gruposPreMarcados: preMarcados,
  };
})()`);

// ---- capturas de la pantalla de foto ----
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await shot('foto-bloque');
await evalJs(`document.querySelector('#p-foto .grupo-pref').scrollIntoView({ block: 'center' })`); await sleep(400);
await shot('foto-preferencias');
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);

// ---- camino completo: ejemplo → análisis real → resultado ----
await clic('#btn-foto-ejemplo');
await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
await sleep(400);
const t0 = Date.now();
await clic('#btn-analizar');
const listo = await esperar(`document.getElementById('p-resultado').classList.contains('activa')`, 300000);
const latencia = Math.round((Date.now() - t0) / 100) / 10;
if (!listo) {
  writeFileSync(`${OUT}/datos.json`, JSON.stringify({ modo: MODO, enFoto, listo: false, latencia, medicion, erroresConsola }, null, 2));
  console.log('B9', MODO, '· SIN RESULTADO tras', latencia, 's · errores:', erroresConsola.length);
  try { ws.close(); } catch {}
  chrome.kill();
  process.exit(1);
}
await sleep(1000); // la cascada de entrada (QA20) termina en ~0,5 s
const reco = await evalJs(`(() => ({
  nombre: document.getElementById('reco-nombre')?.textContent || '',
  datos: document.getElementById('reco-datos')?.textContent || '',
  etiqueta: document.querySelector('.reco .etiqueta')?.textContent || '',
}))()`);
await evalJs(`window.scrollTo(0, 0)`); await sleep(250);
await shotFull('resultado-completo');

const salida = { modo: MODO, enFoto, listo, latencia, medicion, reco, erroresConsola };
writeFileSync(`${OUT}/datos.json`, JSON.stringify(salida, null, 2));
console.log('B9', MODO, '· enFoto:', enFoto, '· resultado OK en', latencia, 's · reco:', reco.nombre, '·', reco.datos,
  '\\n  elegir:', JSON.stringify(medicion.elegir),
  '\\n  ejemplo:', JSON.stringify(medicion.ejemplo),
  '\\n  rótulo:', medicion.rotuloEstilo, '· prefs pre-marcados:', medicion.gruposPreMarcados + '/' + medicion.gruposPref,
  '\\n  errores consola:', erroresConsola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
