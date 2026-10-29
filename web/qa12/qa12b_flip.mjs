// QA12b · ACTIVACIÓN POR CONFIGURACIÓN (prueba 6 de Lee).
// Contra el entorno de prueba en 8099: la MISMA index.html de
// producción, pero el registro trae moda_probador en «activo».
// Sin tocar una línea de código de la interfaz, el módulo debe
// aparecer «Activo», su chip debe ser seleccionable y su destino
// debe ser Explorar (con el estado honesto de «sin productos
// verificados») en vez de la pantalla de próxima apertura.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8099';
const OUT = '/data/la-asistenta/web/qa12';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

mkdirSync(OUT, { recursive: true });
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
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
  console.log('captura:', nombre);
}

try {
  await S('Page.navigate', { url: WEB + '/' });
  await sleep(4000);

  const reg = await evalJs(`fetch('/api/modulos').then(r => r.json())`);
  const moda = reg.modulos.find(m => m.id === 'moda_probador');
  ev('el entorno de prueba sirve el registro con moda «activo»',
     moda?.estado === 'activo', 'estado=' + moda?.estado);

  const tarjeta = await evalJs(
    `document.querySelector('.mod-card[data-modulo="moda_probador"]')?.innerText.replace(/\\s+/g, ' ').trim() || ''`);
  ev('sin tocar código, la tarjeta ya dice «Activo» y no «Próximamente»',
     tarjeta.includes('Activo') && !tarjeta.includes('Próximamente'), tarjeta.slice(0, 70));

  await evalJs(`document.querySelector('.mod-card[data-modulo="moda_probador"]').click()`);
  await sleep(900);
  const destino = await evalJs(`({
    explorar: document.getElementById('p-explorar').classList.contains('activa'),
    proxima: document.getElementById('p-proxima').classList.contains('activa'),
    vacio: document.getElementById('explorar-vacio').style.display !== 'none',
    vacioTitulo: document.getElementById('vacio-titulo').textContent.trim(),
    chipOn: [...document.querySelectorAll('#chips-cat .chip-cat')]
      .find(c => c.classList.contains('on'))?.textContent.trim() || '',
    productos: document.querySelectorAll('#explorar-grid .prod-card').length,
  })`);
  ev('el módulo activado lleva a Explorar (no a próxima apertura)',
     destino.explorar && !destino.proxima);
  ev('su chip queda seleccionado en Explorar', destino.chipOn === 'Ropa', destino.chipOn);
  ev('estado honesto: activo pero sin productos verificados (nada inventado)',
     destino.vacio && destino.vacioTitulo.includes('aún sin productos verificados') &&
     destino.productos === 0, destino.vacioTitulo);
  await shot('qa12-06-flip-moda-activo');

  const belleza = await evalJs(
    `document.querySelector('.mod-card[data-modulo="belleza"]')?.innerText.replace(/\\s+/g, ' ').trim() || ''`);
  ev('belleza sigue «Activo» en el entorno de prueba', belleza.includes('Activo'));
} catch (e) {
  ev('QA sin excepción', false, String(e).slice(0, 200));
} finally {
  console.log('\n===== QA12b · ACTIVACIÓN POR CONFIGURACIÓN =====');
  for (const l of evidencias) console.log(l);
  const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
  console.log(`TOTAL: ${evidencias.length - fallos}/${evidencias.length}`);
  try { chrome.kill('SIGKILL'); } catch {}
  process.exit(fallos ? 1 : 0);
}
