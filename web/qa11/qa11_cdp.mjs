// QA11 · PIVOTE FASE 1 (probador virtual) a 412x915 conduciendo
// Chromium por CDP contra la máquina real. Recorrido: home nueva
// (cabecera ✦ ASISTENTA, hero «Pruébatelo antes de comprar», 4 tarjetas
// de moda, tarjeta «Tu probador IA», vertical de cejas) → Explorar
// (estado honesto de moda + productos reales de cejas + guardar) →
// Probador (hub; moda: foto con consentimiento y estado honesto SIN
// enviar nada; perfil visual en el dispositivo) → vertical de cejas
// COMPLETA (consentimiento → foto de ejemplo → análisis real → guardar
// look → reserva real) → Perfil (guardados + looks + mi cita). La cita
// de prueba queda CANCELADA en la limpieza, como siempre.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const TOK = { 'X-API-Token': 'la-asistenta-dev' };
const OUT = '/data/la-asistenta/web/qa11';
const FECHA = '2026-11-06'; // viernes
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9351', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9351/json/version');
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
await S('DOM.enable');
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
const activa = id => evalJs(`document.getElementById('${id}').classList.contains('activa')`);
const sinDesborde = async nombre => {
  const ok = await evalJs(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  ev(`sin desborde horizontal en ${nombre}`, !!ok);
};

let codigo = null;
try {

/* ---------- arranque limpio ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(2500);
await evalJs(`localStorage.clear()`);
await S('Page.reload');
await sleep(3500);

/* ---------- 1 · HOME del probador ---------- */
const home = await evalJs(`(() => {
  const txt = document.getElementById('p-inicio').innerText;
  return {
    marca: document.querySelector('.marca')?.innerText.trim() || '',
    hero: document.querySelector('.hero h1')?.textContent.trim() || '',
    cta: document.getElementById('btn-hero-probar')?.innerText.replace(/\\s+/g,' ').trim() || '',
    cats: [...document.querySelectorAll('.cat-card .c-txt')].map(e => e.textContent.trim()),
    checks: [...document.querySelectorAll('.tarjeta-probador .checks li')].length,
    cejas: txt.includes('Probador de cejas'),
    salonFuera: !txt.includes('Odontología') && !txt.includes('Salones de uñas'),
    carruselSalon: !!document.querySelector('#carrusel-reco .salon-card'),
    nav: [...document.querySelectorAll('.nav-btn')].map(b => b.id + ':' + b.innerText.trim()),
  };
})()`);
ev('cabecera con marca ASISTENTA', home.marca.includes('ASISTENTA'), home.marca);
ev('hero «Pruébatelo antes de comprar»', home.hero === 'Pruébatelo antes de comprar', home.hero);
ev('CTA «Probar en mí»', home.cta.includes('Probar en mí'), home.cta);
ev('4 tarjetas: Ropa·Gafas·Zapatillas·Accesorios',
   JSON.stringify(home.cats) === JSON.stringify(['Ropa','Gafas','Zapatillas','Accesorios']),
   home.cats.join('·'));
ev('tarjeta «Tu probador IA» con 3 checks', home.checks === 3);
ev('vertical de cejas visible en la home', home.cejas);
ev('fuera las categorías del marketplace de belleza', home.salonFuera);
ev('carrusel con la tarjeta real del salón', home.carruselSalon);
ev('nav Inicio·Explorar·Probador·Perfil',
   JSON.stringify(home.nav.map(x => x.split(':')[0])) ===
   JSON.stringify(['nav-inicio','nav-explorar','nav-probador','nav-perfil']),
   home.nav.join(' | '));
await sinDesborde('inicio');
await shot('qa11-01-inicio');

/* ---------- 2 · EXPLORAR: estado honesto de moda ---------- */
await click('.cat-card[data-moda="Gafas"]');
await sleep(700);
ev('la tarjeta Gafas abre Explorar', await activa('p-explorar'));
const vacio = await evalJs(`(() => {
  const v = document.getElementById('explorar-vacio');
  return { visible: v.style.display !== 'none', texto: v.innerText };
})()`);
ev('Gafas: estado honesto visible', vacio.visible && vacio.texto.toLowerCase().includes('catálogo en preparación'));
ev('Gafas: «sin productos inventados»', vacio.texto.includes('Sin productos inventados'));
await shot('qa11-02-explorar-vacio');

/* ---------- 3 · EXPLORAR: productos reales de cejas + guardar ---------- */
await click('#btn-exp-cejas');
await sleep(700);
const exp = await evalJs(`(() => {
  const cards = [...document.querySelectorAll('#explorar-grid .prod-card')];
  return {
    n: cards.length,
    primero: cards[0]?.innerText.replace(/\\s+/g,' ').trim() || '',
    conFoto: cards.filter(c => c.querySelector('.pc-foto')).length,
    sinFoto: cards.filter(c => c.querySelector('.pc-sinfoto')).length,
  };
})()`);
ev('Cejas: 4 productos reales de la carta', exp.n === 4, exp.n + ' tarjetas');
ev('primer producto con precio real (18 €)', exp.primero.includes('Diseño de cejas') && exp.primero.includes('18'), exp.primero.slice(0, 80));
ev('3 con foto real y 1 sin foto (Depilación, honesto)', exp.conFoto === 3 && exp.sinFoto === 1,
   `foto=${exp.conFoto} sinfoto=${exp.sinFoto}`);
await evalJs(`document.querySelector('#explorar-grid .prod-card [data-acc="guardar"]').click()`);
await sleep(300);
const guardado = await evalJs(`(JSON.parse(localStorage.getItem('la-asistenta-guardados-v1') || '[]'))`);
ev('guardar deja el producto en el dispositivo', guardado.includes('Diseño de cejas'), guardado.join(','));
await sinDesborde('explorar');
await shot('qa11-03-explorar-cejas');

/* ---------- 4 · PROBADOR hub ---------- */
await click('#nav-probador');
await sleep(700);
const hub = await evalJs(`document.getElementById('p-probador').innerText`);
ev('hub: cejas «Disponible ahora»', hub.includes('Disponible ahora'));
ev('hub: moda «En integración»', hub.includes('En integración'));
ev('hub: perfil visual explicado', hub.includes('solo en este dispositivo'));
await shot('qa11-04-probador');

/* ---------- 5 · MODA: foto + consentimiento + estado honesto ---------- */
await click('#btn-prob-moda');
await sleep(700);
ev('«Preparar mi foto» abre la pantalla de moda', await activa('p-moda'));
const { result: { root } } = await S('DOM.getDocument', { depth: 0 });
const { result: { nodeId } } = await S('DOM.querySelector',
  { nodeId: root.nodeId, selector: '#input-foto-moda' });
await S('DOM.setFileInputFiles',
  { files: ['/data/la-asistenta/web/ejemplo.jpg'], nodeId });
await sleep(1500);
await click('#check-moda');
await sleep(300);
const modaLista = await evalJs(`!document.getElementById('btn-generar-moda').disabled`);
ev('con foto y consentimiento, «Generar» se activa', modaLista);
await click('#btn-generar-moda');
await sleep(600);
const estadoModa = await evalJs(`(() => {
  const c = document.getElementById('moda-estado');
  return { visible: c.style.display !== 'none', texto: c.innerText };
})()`);
ev('generar muestra el estado honesto de integración', estadoModa.visible &&
   estadoModa.texto.includes('El motor de prueba de moda está en integración'));
ev('el estado dice que la foto no se envía', estadoModa.texto.includes('no se envía a ningún sitio'));
await click('#btn-moda-guardar-perfil');
await sleep(300);
const fotoPerfil = await evalJs(`(localStorage.getItem('la-asistenta-foto-perfil-v1') || '').length`);
ev('la foto queda como perfil visual SOLO en el dispositivo', fotoPerfil > 10000, fotoPerfil + ' chars');
await shot('qa11-05-moda-estado');
await click('#btn-moda-volver');
await sleep(700);
const pv = await evalJs(`document.getElementById('pv-datos').style.display !== 'none'`);
ev('el hub muestra el perfil visual creado', pv);

/* ---------- 6 · CEJAS: flujo completo con análisis real ---------- */
await click('#btn-prob-cejas');
await sleep(700);
ev('el hub lleva al consentimiento de cejas', await activa('p-consentimiento'));
await click('#check-consentimiento');
await click('#btn-ir-foto');
await sleep(600);
await click('#btn-foto-ejemplo');
await sleep(1200);
ev('foto de ejemplo lista para analizar',
   await evalJs(`!document.getElementById('btn-analizar').disabled`));
await click('#btn-analizar');
let resultado = false, reintento = false;
for (let i = 0; i < 90; i++) {
  await sleep(3000);
  const est = await evalJs(`({
    res: document.getElementById('p-resultado').classList.contains('activa'),
    err: document.getElementById('error-foto').classList.contains('visible'),
  })`);
  if (est.res) { resultado = true; break; }
  if (est.err && !reintento) {
    reintento = true;
    await click('#btn-analizar'); // un reintento si Baseten tuvo una mala racha
  }
  if (est.err && reintento) break;
}
ev('análisis REAL completado (Spark)', resultado);
const reco = await evalJs(`document.getElementById('reco-nombre').textContent.trim()`);
ev('recomendación dentro de la carta real',
   ['Diseño de cejas','Ombré Brows Henna','Brow Lamination','Depilación rápida'].includes(reco), reco);
await shot('qa11-06-resultado');
await click('#btn-guardar-look');
await sleep(300);
const looks = await evalJs(`(JSON.parse(localStorage.getItem('la-asistenta-looks-v1') || '[]')).length`);
ev('el look queda guardado en el dispositivo', looks === 1, looks + ' look(s)');

/* ---------- 7 · RESERVA real desde la recomendación ---------- */
await click('#btn-reservar-reco');
await sleep(900);
ev('la recomendación lleva a la reserva (paso 2)',
   await evalJs(`document.getElementById('paso-2').classList.contains('activo')`));
await click('#cal-sig');
await sleep(500);
await evalJs(`document.querySelector('.cal-dia[data-fecha="${FECHA}"]').click()`);
await sleep(1800);
const hayHoras = await evalJs(`document.querySelectorAll('#huecos .hora-fila').length`);
ev('huecos reales para el 06/11', hayHoras > 0, hayHoras + ' inicios');
await evalJs(`document.querySelector('#huecos .hora-fila').click()`);
await sleep(300);
await click('#btn-paso2-siguiente');
await sleep(600);
await evalJs(`(() => {
  const n = document.getElementById('inp-nombre');
  n.value = 'PRUEBA QA11';
  n.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('check-confirma').click();
})()`);
await sleep(300);
ev('confirmar se activa con nombre y confirmación',
   await evalJs(`!document.getElementById('btn-confirmar').disabled`));
await click('#btn-confirmar');
let confirmada = false;
for (let i = 0; i < 20; i++) {
  await sleep(2000);
  if (await activa('p-confirmada')) { confirmada = true; break; }
}
ev('reserva REAL confirmada en la agenda', confirmada);
codigo = await evalJs(`document.getElementById('conf-codigo').textContent.trim()`);
ev('código de cita AS-XXXX', /^AS-[A-Z0-9]+$/.test(codigo), codigo);
await shot('qa11-07-confirmada');

/* ---------- 8 · PERFIL: guardados, looks y mi cita ---------- */
await click('#nav-perfil');
await sleep(800);
const perfil = await evalJs(`document.getElementById('p-perfil').innerText`);
ev('Perfil: Mis guardados con el producto', perfil.includes('Mis guardados') && perfil.includes('Diseño de cejas'));
ev('Perfil: Mis looks con la recomendación', perfil.includes('Mis looks') && perfil.includes(reco));
ev('Perfil: acceso a Mi cita', perfil.includes('Mi cita'));
await sinDesborde('perfil');
await shot('qa11-08-perfil');

/* ---------- limpieza: cancelar la cita de prueba por su enlace ---------- */
if (codigo) {
  const enlace = await evalJs(`(JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || 'null') || {}).enlace || ''`);
  const token = (enlace.split('/cita/')[1] || '').split(/[?#]/)[0];
  if (token) {
    const rc = await fetch(`${WEB}/api/cita/${token}/cancelar`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const dc = await rc.json().catch(() => ({}));
    ev('limpieza: cita de prueba cancelada', rc.status === 200 &&
       (dc.cita?.estado === 'cancelada' || dc.estado === 'cancelada'),
       'st=' + rc.status);
  } else {
    ev('limpieza: enlace de la cita localizado', false, 'código ' + codigo);
  }
}

} catch (e) {
  ev('QA sin excepción', false, String(e).slice(0, 200));
} finally {
  console.log('\n===== QA11 · PIVOTE FASE 1 =====');
  for (const l of evidencias) console.log(l);
  const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
  console.log(`TOTAL: ${evidencias.length - fallos}/${evidencias.length}`);
  try { chrome.kill('SIGKILL'); } catch {}
  process.exit(fallos ? 1 : 0);
}
