// QA21 · Cabecera «TU CITA» (.resumen-mini) con packs largos — defecto
// reportado por Lee (30/10/2026, captura de su móvil): con el pack
// Diseño + Ombré Henna + Depilación rápida, el nombre se exprime en una
// columna palabra-por-línea porque el precio («48 € + a consultar»)
// comparte la fila y se queda el ancho; la tarjeta oscura, altísima,
// parece solapar la fila «Hora» de la tarjeta blanca del paso 3.
// Recorrido REAL a 412×915 contra la máquina. NO confirma ninguna
// reserva: se detiene en el paso 3 con el nombre relleno.
// Escenarios:
//   pack3 — el caso exacto de Lee (3 servicios, sábado si hay huecos)
//   pack4 — el pack más largo posible de la carta real (4 servicios)
//   solo  — un servicio suelto (regresión de la cabecera)
// Uso: node cabecera.mjs antes|despues
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = `/data/la-asistenta/web/qa21/cabecera/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9411', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa21-cab-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9411/json/version');
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error')
    erroresConsola.push('console.error');
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
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};

// Medición completa de la cabecera oscura + tarjeta blanca del paso 3
const MEDIR = `(() => {
  const bar = document.getElementById('resumen-mini');
  const etq = bar?.querySelector('.rm-etq');
  const txt = document.getElementById('rm-txt');
  const precio = document.getElementById('rm-precio');
  const b = txt?.querySelector('b');
  let lineasNombre = null, anchosLinea = [];
  if (b && b.firstChild) {
    const rango = document.createRange();
    rango.selectNodeContents(b);
    const rects = [...rango.getClientRects()];
    lineasNombre = rects.length;
    anchosLinea = rects.map(r => Math.round(r.width));
  }
  const R = el => el ? (() => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), ancho: Math.round(r.width),
             alto: Math.round(r.height), bottom: Math.round(r.bottom) }; })() : null;
  const horaFila = [...document.querySelectorAll('.tu-cita .tc-fila')]
    .find(f => f.querySelector('span')?.textContent.trim() === 'Hora');
  const barR = R(bar), horaR = R(horaFila);
  const solapeHora = (barR && horaR)
    ? Math.max(0, Math.min(barR.bottom, horaR.bottom) - Math.max(barR.y, horaR.y)) : null;
  return {
    scrollW: document.documentElement.scrollWidth,
    scrollY: Math.round(window.scrollY),
    barra: barR,
    etq: R(etq), txt: R(txt), precio: R(precio),
    precioTexto: precio?.textContent.trim() || '',
    nombreTexto: b?.textContent.trim() || '',
    lineasNombre, anchosLinea,
    tarjetaBlanca: R(document.querySelector('#paso-3 .tu-cita')),
    horaFila: horaR,
    solapeBarraConHoraPx: solapeHora,
    lineasTc: [...document.querySelectorAll('#tc-lineas .tc-linea')].map(l => l.textContent.replace(/\\s+/g, ' ').trim()),
    total: document.getElementById('tc-total')?.textContent.trim(),
    duracion: document.getElementById('tc-duracion')?.textContent.trim(),
  };
})()`;

async function seleccionarPack(objetivo) {
  // Deja la selección EXACTAMENTE en `objetivo` (nombres de la carta)
  for (let intento = 0; intento < 3; intento++) {
    const estadoSel = await evalJs(`[...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio)`);
    const faltan = objetivo.filter(n => !estadoSel.includes(n));
    const sobran = estadoSel.filter(n => !objetivo.includes(n));
    if (!faltan.length && !sobran.length) return estadoSel;
    for (const n of [...faltan, ...sobran]) {
      await evalJs(`document.querySelector('#res-servicios .servicio-card[data-servicio="${n}"]')?.click()`);
      await sleep(250);
    }
  }
  return evalJs(`[...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio)`);
}

async function elegirDiaHora(preferidas) {
  // preferidas: lista de fechas ISO por orden; si no, próximos 14 días sin domingos
  const candidatas = [...preferidas];
  if (!candidatas.length) {
    // Base = HOY en la zona del salón (Europe/Madrid), no la del navegador:
    // el Chromium de la máquina vive en UTC y generaría el día de ayer.
    const hoyMadrid = await evalJs(`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())`);
    const [ay, am, ad] = hoyMadrid.split('-').map(Number);
    for (let i = 0; i <= 14; i++) {
      const d = new Date(Date.UTC(ay, am - 1, ad + i));
      if (d.getUTCDay() === 0) continue;
      candidatas.push(d.toISOString().slice(0, 10));
    }
  }
  for (const f of candidatas) {
    let celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`);
    if (!celda) { await evalJs(`document.getElementById('cal-sig')?.click()`); await sleep(700);
      celda = await evalJs(`!!document.querySelector('.cal-dia[data-fecha="${f}"]')`); }
    if (!celda) continue;
    const habil = await evalJs(`(() => { const c = document.querySelector('.cal-dia[data-fecha="${f}"]'); return !!c && !c.disabled; })()`);
    if (!habil) continue;
    await evalJs(`document.querySelector('.cal-dia[data-fecha="${f}"]').click()`);
    await esperar(`!document.getElementById('huecos').textContent.includes('Consultando')`, 12000);
    const n = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].filter(h => h.style.display !== 'none').length`);
    if (n > 0) {
      await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
      await sleep(400);
      const hora = await evalJs(`document.querySelector('#huecos .hora-fila.sel')?.dataset.hora`);
      return { fecha: f, hora, huecos: n };
    }
  }
  return null;
}

async function escenario(nombre, servicios, preferidas) {
  await S('Page.navigate', { url: WEB + '/' });
  await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  await evalJs(`document.getElementById('pastilla-reservar').click()`);
  await esperar(`document.querySelectorAll('#res-servicios .servicio-card').length >= 4`, 15000);
  await sleep(600);
  const sel = await seleccionarPack(servicios);
  await sleep(400);
  await shot(`${nombre}-paso1`);
  const medPaso1 = await evalJs(MEDIR);
  await evalJs(`document.getElementById('btn-paso1-siguiente').click()`);
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 10000);
  await sleep(600);
  const dh = await elegirDiaHora(preferidas);
  if (!dh) throw new Error(nombre + ': sin día/hora con huecos');
  await sleep(400);
  await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
  await shot(`${nombre}-paso2`);
  await evalJs(`document.getElementById('btn-paso2-siguiente').click()`);
  await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 10000);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    n.value = 'QA21 Cabecera'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(500);
  await evalJs(`window.scrollTo(0, 0)`); await sleep(400);
  const medReposo = await evalJs(MEDIR);
  await shot(`${nombre}-paso3-reposo`);
  // La tarjeta blanca a la vista: scroll hasta ella y re-medir el solape
  await evalJs(`document.querySelector('#paso-3 .tu-cita').scrollIntoView({ block: 'start' })`);
  await sleep(600);
  const medTarjeta = await evalJs(MEDIR);
  await shot(`${nombre}-paso3-tarjeta`);
  // La vista de Lee: scroll intermedio — la barra pegajosa queda sobre la
  // tarjeta blanca y puede cubrir sus filas (medir intersección con «Hora»)
  await evalJs(`window.scrollTo(0, 560)`);
  await sleep(600);
  const medScroll = await evalJs(MEDIR);
  await shot(`${nombre}-paso3-scroll`);
  return { escenario: nombre, seleccion: sel, diaHora: dh, medPaso1, medReposo, medTarjeta, medScroll };
}

const resultados = [];
// Sábado 31/10/2026: el día exacto del caso de Lee
resultados.push(await escenario('pack3',
  ['Diseño de cejas', 'Ombré Brows Henna', 'Depilación rápida'], ['2026-10-31']));
resultados.push(await escenario('pack4',
  ['Diseño de cejas', 'Ombré Brows Henna', 'Brow Lamination', 'Depilación rápida'], []));
resultados.push(await escenario('solo', ['Diseño de cejas'], []));

writeFileSync(`${OUT}/datos.json`, JSON.stringify({ modo: MODO, resultados, erroresConsola }, null, 2));
for (const r of resultados) {
  const m = r.medReposo;
  console.log(`${r.escenario}: sel=${JSON.stringify(r.seleccion)} ${r.diaHora.fecha} ${r.diaHora.hora}` +
    ` · barra alto=${m.barra?.alto} txt ancho=${m.txt?.ancho} líneas nombre=${m.lineasNombre}` +
    ` anchos=${JSON.stringify(m.anchosLinea)} · precio="${m.precioTexto}"` +
    ` · solape reposo=${m.solapeBarraConHoraPx} tarjeta=${r.medTarjeta.solapeBarraConHoraPx} scroll560=${r.medScroll.solapeBarraConHoraPx} (barra y=${r.medScroll.barra?.y}..${r.medScroll.barra?.bottom}, hora y=${r.medScroll.horaFila?.y}..${r.medScroll.horaFila?.bottom}) · scrollW=${m.scrollW}`);
}
console.log('errores de consola:', erroresConsola.length, JSON.stringify(erroresConsola).slice(0, 200));
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
