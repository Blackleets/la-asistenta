// QA-B10 · MUSA Bloque B10 — Explorar: una tarjeta, una acción (29/10/2026)
// Recorrido REAL contra la app en la máquina (127.0.0.1:8090), a 412×915:
//   Inicio → Explorar: MEDICIÓN de la anatomía de cada tarjeta
//   (alto total, foto, bloque sin foto, chip del salón, descriptor,
//   clases y estilos computados de las acciones, tarjetas que
//   intersectan el viewport sin scroll) + capturas + ejercicio de
//   las acciones (Reservar → paso 2 con el servicio; Probar →
//   consentimiento/foto; Guardar → alterna) sin confirmar nada.
// Dos modos con carpetas propias:  node b10.mjs antes | despues
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = `/data/la-asistenta/web/qa-b10/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9390', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa-b10-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9389/json/version').catch(() => null);
      const r2 = await fetch('http://127.0.0.1:9390/json/version');
      const j = await r2.json();
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
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};

// ---- recorrido: Inicio → Explorar ----
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await evalJs(`document.querySelector('#nav-explorar').click()`);
const hayTarjetas = await esperar(`document.querySelectorAll('#explorar-grid .prod-card').length >= 4`, 15000);
await sleep(900); // imágenes y cascada de entrada
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);

// ---- medición de la anatomía de cada tarjeta ----
const medicion = await evalJs(`(() => {
  const VH = window.innerHeight;
  const tarjetas = [...document.querySelectorAll('#explorar-grid .prod-card')].map(card => {
    const r = card.getBoundingClientRect();
    const foto = card.querySelector('.pc-foto');
    const sinfoto = card.querySelector('.pc-sinfoto');
    const chipSalon = [...card.querySelectorAll('.chip-dato')].map(c => c.textContent.trim());
    const desc = card.querySelector('.pc-desc');
    const btnInfo = sel => {
      const b = card.querySelector(sel);
      if (!b) return null;
      const br = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return {
        texto: b.textContent.trim(), clases: b.className,
        ancho: Math.round(br.width), alto: Math.round(br.height),
        fondo: cs.backgroundColor, colorTexto: cs.color,
        borde: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        fuente: cs.fontSize + ' / ' + cs.fontWeight,
      };
    };
    return {
      nombre: card.querySelector('h3')?.textContent.trim() || '',
      top: Math.round(r.top), alto: Math.round(r.height), bottom: Math.round(r.bottom),
      intersectaViewport: r.bottom > 0 && r.top < VH,
      completaEnViewport: r.top >= 0 && r.bottom <= VH,
      fotoAlto: foto ? Math.round(foto.getBoundingClientRect().height) : null,
      sinfotoAlto: sinfoto ? Math.round(sinfoto.getBoundingClientRect().height) : null,
      descriptor: desc ? desc.textContent.trim() : null,
      chipSalon,
      meta: card.querySelector('.pc-meta')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      reservar: btnInfo('[data-acc="reservar"]'),
      probar: btnInfo('[data-acc="probar"]'),
      guardar: !!card.querySelector('[data-acc="guardar"]'),
    };
  });
  return {
    vh: VH,
    nTarjetas: tarjetas.length,
    intersectan: tarjetas.filter(t => t.intersectaViewport).length,
    completas: tarjetas.filter(t => t.completaEnViewport).length,
    tarjetas,
  };
})()`);

await shot('explorar-top');
await shotFull('explorar-completa');
// detalle: la tarjeta sin foto (Depilación) encuadrada
await evalJs(`(() => { const cs = [...document.querySelectorAll('#explorar-grid .prod-card')]; const d = cs.find(c => c.querySelector('.pc-sinfoto')); if (d) d.scrollIntoView({ block: 'center' }); })()`);
await sleep(500);
await shot('explorar-depilacion');

// ---- ejercicio de acciones (sin confirmar ninguna reserva) ----
// Guardar: alterna en la primera tarjeta y vuelve a su estado
const guardar = await evalJs(`(() => {
  const b = document.querySelector('#explorar-grid .prod-card [data-acc="guardar"]');
  if (!b) return null;
  const antes = b.classList.contains('on');
  b.click();
  const tras = b.classList.contains('on');
  b.click();
  return { antes, tras, restaurado: b.classList.contains('on') === antes };
})()`);
// Probar con mi foto (primera tarjeta con esa acción): consentimiento o foto o resultado
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await evalJs(`document.querySelector('#explorar-grid .prod-card [data-acc="probar"]').click()`);
await sleep(900);
const trasProbar = await evalJs(`[...document.querySelectorAll('.pantalla.activa')].map(p => p.id).join(',')`);
// volver a Explorar
await evalJs(`document.querySelector('#nav-explorar').click()`); await sleep(700);
// Reservar (segunda tarjeta): paso 2 con el servicio elegido
const nombreSegunda = await evalJs(`document.querySelectorAll('#explorar-grid .prod-card h3')[1]?.textContent.trim() || ''`);
await evalJs(`document.querySelectorAll('#explorar-grid .prod-card')[1].querySelector('[data-acc="reservar"]').click()`);
await sleep(1200);
const trasReservar = await evalJs(`(() => ({
  activa: [...document.querySelectorAll('.pantalla.activa')].map(p => p.id).join(','),
  paso: document.querySelector('#p-reserva .paso.activo, #p-reserva [data-paso].activo')?.dataset?.paso || null,
  resumen: (document.querySelector('#barra-resumen, .barra-resumen, #resumen-txt')?.textContent || '').replace(/\\s+/g, ' ').trim(),
  cuerpo: (document.querySelector('#p-reserva')?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 220),
}))()`);

const salida = { modo: MODO, hayTarjetas, medicion, guardar, trasProbar, nombreSegunda, trasReservar, erroresConsola };
writeFileSync(`${OUT}/datos.json`, JSON.stringify(salida, null, 2));
console.log('B10', MODO, '· tarjetas:', medicion.nTarjetas,
  '· intersectan viewport:', medicion.intersectan, '· completas:', medicion.completas,
  '\n', JSON.stringify(medicion.tarjetas, null, 1).slice(0, 2400),
  '\n  guardar:', JSON.stringify(guardar), '· trasProbar:', trasProbar,
  '· trasReservar:', JSON.stringify(trasReservar).slice(0, 300),
  '\n  errores consola:', erroresConsola.length, JSON.stringify(erroresConsola).slice(0, 300));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
