// QA5 (v2) · INTERFAZ estilo app de reservas a 412x915 por CDP.
// Recorre el inicio NUEVO con clics y captura evidencia: saludo del salón →
// buscador píldora REAL (filtra la carta en vivo y avisa sin resultados) →
// pastillas de acceso (Análisis IA + servicios que preseleccionan y entran
// en el paso 2) → «Recomendado» con tarjetas fotográficas (fotos cargadas,
// precio/duración reales, CTA a reservar) → pestaña Contacto real
// (WhatsApp público + horario real). Comprueba también el SW v3 y que no
// hay desborde horizontal. Las capturas van a web/qa5/.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa5';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9339', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9339/json/version');
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
await S('Network.enable');
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
  if (!data) throw new Error('sin datos de captura');
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
  console.log('captura:', nombre);
}
const click = sel => evalJs(`document.querySelector('${sel}').click()`);
const sinDesborde = async nombre => {
  const ok = await evalJs(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  ev(`sin desborde horizontal en ${nombre}`, !!ok);
};
const scrollA = async (sel, extra = 0) => {
  await evalJs(`window.scrollTo(0, document.querySelector('${sel}').getBoundingClientRect().top + window.scrollY - 12 + ${extra})`);
  await sleep(500);
};

/* ---------- 1 · inicio nuevo: saludo, buscador, pastillas, recomendado ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(3500);
const base = await evalJs(`(() => {
  const visibles = sel => [...document.querySelectorAll(sel)]
    .filter(c => c.style.display !== 'none').length;
  return {
    saludo: document.querySelector('.salon-nombre')?.textContent.trim(),
    buscador: !!document.querySelector('#inp-buscar'),
    pastillas: document.querySelectorAll('#pastillas .pastilla').length,
    reco: document.querySelectorAll('#lista-recomendado .reco-card').length,
    fotosOk: [...document.querySelectorAll('#lista-recomendado .reco-card img')]
      .every(i => i.complete && i.naturalWidth > 0),
    recoDatos: [...document.querySelectorAll('#lista-recomendado .reco-card')]
      .every(c => /€/.test(c.textContent) && /min/.test(c.textContent)),
    carta: visibles('#carta-inicio .servicio-card'),
    navBtns: document.querySelectorAll('.barra-nav .nav-btn').length,
  };
})()`);
ev('inicio: saludo con el nombre del salón', base.saludo === 'Ari Vivas Beauty', base.saludo);
ev('inicio: buscador píldora presente', base.buscador);
ev('inicio: 5 pastillas de acceso (IA + 4 servicios)', base.pastillas === 5, `n=${base.pastillas}`);
ev('recomendado: 3 tarjetas fotográficas con la foto cargada',
   base.reco === 3 && base.fotosOk, `n=${base.reco} fotosOk=${base.fotosOk}`);
ev('recomendado: precio y duración reales en cada tarjeta', base.recoDatos);
ev('inicio: la carta completa sigue (4 servicios)', base.carta === 4, `n=${base.carta}`);
ev('navegación inferior con 4 pestañas reales', base.navBtns === 4, `n=${base.navBtns}`);
await shot('v2-01-inicio');
await sinDesborde('inicio (arriba)');
await scrollA('#lista-recomendado');
await shot('v2-02-recomendado');
await sinDesborde('inicio (recomendado)');
await scrollA('.tarjeta-analisis');
await shot('v2-03-analisis');
await sinDesborde('inicio (análisis)');

/* ---------- 2 · buscador real: filtra, avisa sin resultados y se limpia ---------- */
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = 'henna'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);
const filtro = await evalJs(`(() => {
  const vis = sel => [...document.querySelectorAll(sel)]
    .filter(c => c.style.display !== 'none')
    .map(c => c.dataset.busqueda || '');
  return { carta: vis('#carta-inicio .servicio-card'),
           reco: vis('#lista-recomendado .reco-card') };
})()`);
ev('buscador: «henna» deja solo Ombré en carta y recomendado',
   filtro.carta.length === 1 && filtro.carta[0].includes('henna') &&
   filtro.reco.length === 1 && filtro.reco[0].includes('henna'),
   JSON.stringify(filtro));
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = 'zzz'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);
const sinRes = await evalJs(`(() => { const a = document.querySelector('#sin-resultados');
  return a.style.display !== 'none' && a.textContent.includes('zzz'); })()`);
ev('buscador: sin coincidencias muestra el aviso honesto', !!sinRes);
await scrollA('#titulo-servicios');
await shot('v2-04-busqueda-sin-resultados');
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);
const limpio = await evalJs(`[...document.querySelectorAll('#carta-inicio .servicio-card')]
  .filter(c => c.style.display !== 'none').length`);
ev('buscador: al borrar, la carta vuelve completa', limpio === 4, `n=${limpio}`);

/* ---------- 3 · pastilla de servicio → paso 2 con ese servicio ---------- */
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await click('#pastillas .pastilla[data-servicio="Brow Lamination"]');
await sleep(1500);
const pastillaOk = await evalJs(`(() => ({
  pantalla: document.querySelector('#p-reserva').classList.contains('activa'),
  paso2: document.querySelector('#paso-2').classList.contains('activo'),
  resumen: document.querySelector('#rm-txt').textContent.includes('Brow Lamination'),
  huecos: document.querySelectorAll('#huecos .hueco').length,
}))()`);
ev('pastilla Laminación: entra en Reservar, paso 2, con el servicio puesto',
   pastillaOk.pantalla && pastillaOk.paso2 && pastillaOk.resumen, JSON.stringify(pastillaOk));
ev('pastilla Laminación: huecos reales cargados', pastillaOk.huecos > 0, `n=${pastillaOk.huecos}`);
await shot('v2-05-pastilla-reserva');
await sinDesborde('reserva desde pastilla');

/* ---------- 4 · recomendado → botón Reservar lleva al paso 2 ---------- */
await click('#nav-inicio'); await sleep(800);
await scrollA('#lista-recomendado');
await click('#lista-recomendado .reco-card');
await sleep(1500);
const recoOk = await evalJs(`(() => ({
  paso2: document.querySelector('#paso-2').classList.contains('activo'),
  resumen: document.querySelector('#rm-txt').textContent.includes('Diseño de cejas'),
}))()`);
ev('recomendado: tocar la tarjeta de Diseño reserva ese servicio en el paso 2',
   recoOk.paso2 && recoOk.resumen, JSON.stringify(recoOk));

/* ---------- 5 · pastilla Análisis IA → recorrido de análisis ---------- */
await click('#nav-inicio'); await sleep(800);
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await click('#pastilla-analisis'); await sleep(700);
const analisisOk = await evalJs(
  `document.querySelector('#p-consentimiento').classList.contains('activa')`);
ev('pastilla Análisis IA: abre el consentimiento del análisis', !!analisisOk);

/* ---------- 6 · contacto: WhatsApp público y horario real ---------- */
await click('#nav-contacto'); await sleep(700);
const contacto = await evalJs(`(() => {
  const a = document.querySelector('#p-contacto a.btn');
  return {
    pantalla: document.querySelector('#p-contacto').classList.contains('activa'),
    href: a ? a.getAttribute('href') : '',
    horario: document.querySelector('#contacto-horario').textContent,
    navOn: document.querySelector('#nav-contacto').classList.contains('on'),
  };
})()`);
ev('contacto: pantalla real con el WhatsApp público del salón',
   contacto.pantalla && contacto.href === 'https://wa.me/584249134367', contacto.href);
ev('contacto: horario real cargado desde la carta',
   /10:00/.test(contacto.horario) && contacto.navOn, contacto.horario);
await shot('v2-06-contacto');
await sinDesborde('contacto');

/* ---------- 7 · service worker v3 ---------- */
await click('#nav-inicio'); await sleep(600);
const sw = await evalJs(`(async () => {
  const claves = await caches.keys();
  const reg = await navigator.serviceWorker.getRegistration();
  return { claves, controlando: !!navigator.serviceWorker.controller,
           script: reg && reg.active ? reg.active.scriptURL : '' };
})()`);
ev('service worker v3 instalado y controlando',
   sw.claves.includes('la-asistenta-shell-v3') && sw.controlando,
   JSON.stringify(sw.claves));

console.log('');
for (const l of evidencias) console.log(l);
const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
console.log(`RESUMEN QA5-V2: ${evidencias.length - fallos}/${evidencias.length} en verde`);
chrome.kill();
process.exit(fallos ? 1 : 0);
