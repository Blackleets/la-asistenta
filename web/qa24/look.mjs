// QA24 · Vista del LOOK GUARDADO («Mis looks») con texto largo — defecto
// reportado por Lee (31/10/2026, captura de su móvil): en el ítem del
// look, el resumen del análisis (hasta 140 caracteres, como lo guarda
// la app) se exprime en una columna palabra-por-línea entre la
// miniatura de la propuesta y los controles de ancho fijo (Reservar +
// ×) de la fila flex .item-local; el texto queda ilegible y la tarjeta
// altísima. Caso PERMANENTE de la matriz (junto a qa21/cabecera.mjs):
// contenido largo real en la vista de look, a 412×915.
// Recorrido: siembra en localStorage el equivalente fiel del look de
// Lee («Ombré Brows Henna · 31 de octubre», con propuesta visual) y un
// segundo look SIN propuesta (estado hermano), más un guardado; abre
// Perfil → «Mis looks» y mide el elemento que contiene el resumen.
// En modo «despues» ejercita además Reservar desde el look y la × del
// segundo look. Uso: node look.mjs antes|despues
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const OUT = `/data/la-asistenta/web/qa24/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG = { fase: 'QA24-look-' + MODO, consola: [], medidas: {}, pasos: [] };

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9433', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa24-look-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9433/json/version');
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
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
    LOG.consola.push('log: ' + (m.params.entry.text || ''));
  if (m.method === 'Runtime.exceptionThrown')
    LOG.consola.push('excepción: ' + (m.params?.exceptionDetails?.text || ''));
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error')
    LOG.consola.push('console.error');
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
async function shot(nombre, clip) {
  const params = { format: 'png', captureBeyondViewport: !!clip };
  if (clip) params.clip = clip;
  const r = await S('Page.captureScreenshot', params);
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

// Siembra fiel: el look se construye con el MISMO recorte de 140
// caracteres que aplica btn-guardar-look, y la propuesta visual es la
// foto de ejemplo convertida a data URI (como la imagen generada que
// guarda la app; nunca la foto original de una clienta).
const SEMBRAR = `(async () => {
  const blob = await (await fetch('ejemplo.jpg')).blob();
  const dataUrl = await new Promise(res => { const fr = new FileReader();
    fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  const looks = [
    { recomendado: 'Diseño de cejas', alternativo: 'Brow Lamination',
      resumen: ('Tus cejas se ven pobladas y con buena forma natural; con un diseño suave se define el arco y se limpia el entrecejo sin cambiar tu expresión.').slice(0, 140),
      fechaTxt: '28 de octubre' },
    { recomendado: 'Ombré Brows Henna', alternativo: null,
      resumen: ('¡Qué bonitas cejas se te intuyen en la foto! Se ven con una base natural muy favorecedora y con potencial para realzar ese arco que te favorece.').slice(0, 140),
      fechaTxt: '31 de octubre',
      visual: { imagen: dataUrl, proveedor: 'meta-model-api', modelo: 'muse-image-1.0' } },
  ];
  localStorage.setItem('la-asistenta-looks-v1', JSON.stringify(looks));
  localStorage.setItem('la-asistenta-guardados-v1', JSON.stringify(['Ombré Brows Henna']));
  return { looks: looks.length, bytesVisual: dataUrl.length };
})()`;

// Medición del elemento que contiene el resumen dentro de cada ítem:
// ancho de su columna, líneas reales (Range.getClientRects) y si los
// controles (Reservar / ×) invaden horizontalmente su caja.
const MEDIR = (contenedor) => `(() => {
  const R = el => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), ancho: Math.round(r.width),
             alto: Math.round(r.height), bottom: Math.round(r.bottom) }; };
  const items = [...document.querySelectorAll('${contenedor} .item-local')].map(item => {
    let portador = null, lineas = null;
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (/bonitas cejas|cejas se ven pobladas/.test(n.textContent)) {
        portador = n.parentElement;
        const rango = document.createRange();
        rango.selectNodeContents(portador);
        lineas = rango.getClientRects().length;
        break;
      }
    }
    const btn = item.querySelector('.il-btn');
    const equis = item.querySelector('.il-x');
    const foto = item.querySelector('img');
    const pr = R(portador), br = R(btn);
    return {
      item: R(item),
      portadorResumen: pr, lineasPortador: lineas,
      foto: R(foto), btnReservar: br, equis: R(equis),
      solapeBtnConTexto: (pr && br) ? Math.max(0, Math.min(pr.bottom, br.bottom) - Math.max(pr.y ?? pr.top ?? 0, br.y ?? 0)) > 0 && br.x < (pr.x + pr.ancho) && (br.x + br.ancho) > pr.x : null,
      textoVisible: item.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80),
    };
  });
  return { scrollW: document.documentElement.scrollWidth, items };
})()`;

try {
  await S('Page.navigate', { url: WEB + '/' });
  await esperar(`document.readyState === 'complete'`, 20000);
  await sleep(1800);
  LOG.pasos.push({ semilla: await evalJs(SEMBRAR) });
  await evalJs(`document.getElementById('nav-perfil').click()`);
  await esperar(`!!document.querySelector('#looks-lista .item-local')`, 10000);
  await sleep(600);
  await evalJs(`document.querySelector('#looks-lista .item-local').scrollIntoView({ block: 'center' })`);
  await sleep(500);
  LOG.medidas.looks = await evalJs(MEDIR('#looks-lista'));
  LOG.medidas.guardados = await evalJs(MEDIR('#guardados-lista'));
  await shot('l1-looks-vista');
  const clip = await evalJs(`(() => { const el = document.querySelector('#looks-lista .item-local');
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y + window.scrollY - 8),
             width: Math.min(412, r.width + 16), height: r.height + 16, scale: 1 }; })()`);
  await shot('l2-look-detalle', clip);

  if (MODO === 'despues') {
    // Reservar desde el look con propuesta (el primero de la lista)
    await evalJs(`document.querySelector('#looks-lista .item-local [data-acc="reservar"]').click()`);
    await sleep(1500);
    LOG.pasos.push({ reservarDesdeLook: await evalJs(`(() => ({
      pantalla: document.querySelector('.pantalla.activa')?.id || document.querySelector('.pantalla:not([style*="none"])')?.id,
      paso2Visible: !!document.querySelector('#paso-2') && document.querySelector('#paso-2').offsetParent !== null }))()`) });
    await shot('l3-reserva-desde-look');
    // Volver a Perfil y borrar el look SIN propuesta con su ×
    await evalJs(`document.getElementById('nav-perfil').click()`);
    await esperar(`document.querySelectorAll('#looks-lista .item-local').length === 2`, 8000);
    await evalJs(`(() => { const items = [...document.querySelectorAll('#looks-lista .item-local')];
      const sinFoto = items.find(i => !i.querySelector('img'));
      sinFoto.querySelector('[data-acc="quitar"]').click(); })()`);
    await sleep(600);
    LOG.pasos.push({ looksTrasBorrar: await evalJs(`document.querySelectorAll('#looks-lista .item-local').length`) });
    await evalJs(`document.querySelector('#looks-lista .item-local').scrollIntoView({ block: 'center' })`);
    await sleep(400);
    LOG.medidas.looksTrasBorrar = await evalJs(MEDIR('#looks-lista'));
    await shot('l4-look-borrado');
  }
  LOG.ok = true;
} catch (e) {
  LOG.ok = false;
  LOG.error = String(e).slice(0, 400);
}
writeFileSync(`${OUT}/log-look-${MODO}.json`, JSON.stringify(LOG, null, 1));
console.log(JSON.stringify({ ok: LOG.ok, medidas: LOG.medidas, pasos: LOG.pasos,
  consola: LOG.consola, error: LOG.error || null }, null, 1));
try { await S('Browser.close'); } catch {}
process.exit(0);
