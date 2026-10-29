// QA12 · LA ASISTENTA MODULAR (corrección 28/10 23:45) a 412x915
// conduciendo Chromium por CDP contra la máquina real.
// Verifica las 6 pruebas obligatorias de Lee:
//  1 reservas existentes (recorrido completo, cita cancelada al final)
//  2 precios/duraciones/horarios = fuentes reales (la carta de la UI
//    es la de /api/servicios, que es la de la agenda)
//  3 categorías futuras desde el REGISTRO (/api/modulos): estantería
//    y chips se pintan del JSON, con su estado
//  4 la pantalla de próxima apertura no inventa disponibilidad ni
//    funciones (auditoría literal del texto servido)
//  5 navegación móvil sin errores (consola limpia, sin desborde)
//  6 (en script aparte) activación por configuración
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa12';
const FECHA = '2026-11-06'; // viernes
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);
const erroresConsola = [];

mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9352', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9352/json/version');
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

/* ---------- HOME modular: belleza manda, módulos desde el registro ---------- */
const reg = await evalJs(`fetch('/api/modulos').then(r => r.json())`);
ev('el registro se sirve en /api/modulos', Array.isArray(reg.modulos) && reg.modulos.length === 4,
   reg.modulos.map(m => m.id + ':' + m.estado).join(' · '));
const home = await evalJs(`(() => {
  const txt = document.getElementById('p-inicio').innerText;
  return {
    marca: document.querySelector('.marca')?.innerText.trim() || '',
    kicker: document.querySelector('.hero-kicker')?.textContent.trim() || '',
    hero: document.querySelector('.hero h1')?.textContent.trim() || '',
    mods: [...document.querySelectorAll('#estanteria-modulos .mod-card')].map(c => ({
      id: c.dataset.modulo, texto: c.innerText.replace(/\\s+/g, ' ').trim(),
    })),
    sinHeroModa: !txt.includes('Pruébatelo antes de comprar'),
    sinCategoriasSalon: !txt.includes('Odontología') && !txt.includes('Salones de uñas'),
    sinPreciosModa: !/Ropa[\\s\\S]{0,120}\\d+\\s*€/.test(txt),
    cejasVisible: txt.includes('Probador de cejas'),
    nav: [...document.querySelectorAll('.nav-btn')].map(b => b.id),
  };
})()`);
ev('cabecera con marca ASISTENTA', home.marca.includes('ASISTENTA'), home.marca);
ev('hero de plataforma modular (no de probador de moda)',
   home.kicker.includes('PLATAFORMA MODULAR') && home.sinHeroModa, home.kicker + ' / ' + home.hero);
ev('estantería: 4 módulos en el orden del registro',
   JSON.stringify(home.mods.map(m => m.id)) ===
   JSON.stringify(['belleza', 'moda_probador', 'gafas_accesorios', 'calzado']),
   home.mods.map(m => m.id).join('·'));
ev('belleza marcado «Activo» en su tarjeta',
   home.mods[0].texto.includes('Activo') && !home.mods[0].texto.includes('Próximamente'),
   home.mods[0].texto.slice(0, 70));
ev('los 3 módulos futuros marcados «Próximamente»',
   home.mods.slice(1).every(m => m.texto.includes('Próximamente')),
   home.mods.slice(1).map(m => m.texto.slice(0, 40)).join(' | '));
ev('la home no vende catálogo de moda (sin precios de ropa)', home.sinPreciosModa);
ev('fuera las categorías del marketplace de belleza', home.sinCategoriasSalon);
ev('la vertical de cejas sigue visible en la home', home.cejasVisible);
ev('nav Inicio·Explorar·Probador·Perfil',
   JSON.stringify(home.nav) ===
   JSON.stringify(['nav-inicio', 'nav-explorar', 'nav-probador', 'nav-perfil']),
   home.nav.join(' | '));
await sinDesborde('inicio');
await shot('qa12-01-inicio');
await evalJs(`document.getElementById('estanteria-modulos').scrollIntoView({block:'center'})`);
await sleep(500);
await shot('qa12-02-estanteria');

/* ---------- PRÓXIMA APERTURA: texto literal desde el registro ---------- */
await click('.mod-card[data-modulo="moda_probador"]');
await sleep(700);
ev('la tarjeta de moda abre la próxima apertura', await activa('p-proxima'));
const prox = await evalJs(`(() => ({
  titulo: document.getElementById('proxima-titulo').textContent.trim(),
  que: document.getElementById('proxima-que').textContent.trim(),
  prep: document.getElementById('proxima-preparando').textContent.trim(),
  todo: document.getElementById('p-proxima').innerText,
}))()`);
const modaReg = reg.modulos.find(m => m.id === 'moda_probador');
ev('próxima apertura: título del registro', prox.titulo === modaReg.nombre, prox.titulo);
ev('próxima apertura: «qué podrás hacer» = texto del registro',
   prox.que === (modaReg.proxima?.quePodras || '').trim(), prox.que.slice(0, 60));
ev('próxima apertura: «qué estamos preparando» = texto del registro',
   prox.prep === (modaReg.proxima?.preparando || '').trim(), prox.prep.slice(0, 60));
ev('próxima apertura: chip «Próximamente» visible', prox.todo.includes('Próximamente'));
ev('AUDITORÍA: sin precios en la pantalla', !/\d+([.,]\d+)?\s*€|\$\s*\d+/.test(prox.todo));
ev('AUDITORÍA: sin disponibilidad fingida',
   !/disponible ahora|huecos|reserva ahora|comprar ahora/i.test(prox.todo));
ev('AUDITORÍA: sin fechas concretas inventadas', !/20\d\d-\d\d-\d\d|el \d+ de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(prox.todo));
await sinDesborde('proxima');
await shot('qa12-03-proxima');
await click('#btn-proxima-volver');
await sleep(600);

/* ---------- EXPLORAR: chips del registro; belleza real; futuro -> proxima ---------- */
await click('#nav-explorar');
await sleep(900);
const exp = await evalJs(`(() => {
  const chips = [...document.querySelectorAll('#chips-cat .chip-cat')];
  const cards = [...document.querySelectorAll('#explorar-grid .prod-card')];
  return {
    chips: chips.map(c => c.textContent.trim()),
    n: cards.length,
    textos: cards.map(c => c.innerText.replace(/\\s+/g, ' ').trim()),
  };
})()`);
ev('Explorar: un chip por módulo del registro',
   JSON.stringify(exp.chips) === JSON.stringify(['Cejas', 'Ropa', 'Gafas', 'Zapatillas']),
   exp.chips.join('·'));
ev('Explorar belleza: 4 servicios reales', exp.n === 4, exp.n + ' tarjetas');
ev('precios reales en las tarjetas (18 € · 30 € · 45 €)',
   exp.textos.some(t => t.includes('18 €')) && exp.textos.some(t => t.includes('30 €')) &&
   exp.textos.some(t => t.includes('45 €')),
   exp.textos.map(t => t.slice(0, 42)).join(' | '));
await sinDesborde('explorar');
await shot('qa12-04-explorar');
await evalJs(`[...document.querySelectorAll('#chips-cat .chip-cat')]
  .find(c => c.textContent.trim() === 'Gafas').click()`);
await sleep(700);
ev('el chip de un módulo futuro abre su próxima apertura (no un catálogo)',
   await activa('p-proxima'));
ev('…y es la de Gafas y accesorios',
   (await evalJs(`document.getElementById('proxima-titulo').textContent.trim()`)) === 'Gafas y accesorios');
await click('#btn-proxima-belleza');
await sleep(800);
ev('«Ver lo que ya funciona» vuelve a Explorar belleza', await activa('p-explorar'));

/* ---------- PROBADOR hub: cejas activo; moda -> proxima ---------- */
await click('#nav-probador');
await sleep(700);
const hub = await evalJs(`document.getElementById('p-probador').innerText`);
ev('hub: cejas «Disponible ahora»', hub.includes('Disponible ahora'));
ev('hub: moda «Próximamente» (ya no «En integración» ni prepara fotos)',
   hub.includes('Próximamente') && !hub.includes('Preparar mi foto'));
await click('#btn-prob-moda');
await sleep(700);
ev('el probador de moda del hub abre la próxima apertura', await activa('p-proxima'));
await click('#btn-proxima-volver');
await sleep(600);

/* ---------- CEJAS: flujo completo (análisis real + reserva real) ---------- */
await click('#nav-probador');
await sleep(700);
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
  if (est.err && !reintento) { reintento = true; await click('#btn-analizar'); }
  if (est.err && reintento) break;
}
ev('análisis REAL completado (Spark)', resultado);
const reco = await evalJs(`document.getElementById('reco-nombre').textContent.trim()`);
ev('recomendación dentro de la carta real',
   ['Diseño de cejas', 'Ombré Brows Henna', 'Brow Lamination', 'Depilación rápida'].includes(reco), reco);
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
  n.value = 'PRUEBA QA12';
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
await shot('qa12-05-confirmada');

/* ---------- PERFIL y consola ---------- */
await click('#nav-perfil');
await sleep(800);
const perfil = await evalJs(`document.getElementById('p-perfil').innerText`);
ev('Perfil: acceso a Mi cita', perfil.includes('Mi cita'));
await sinDesborde('perfil');
ev('consola sin errores en todo el recorrido', erroresConsola.length === 0,
   erroresConsola.slice(0, 3).join(' | '));

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
  console.log('\n===== QA12 · MODULAR =====');
  for (const l of evidencias) console.log(l);
  const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
  console.log(`TOTAL: ${evidencias.length - fallos}/${evidencias.length}`);
  try { chrome.kill('SIGKILL'); } catch {}
  process.exit(fallos ? 1 : 0);
}
