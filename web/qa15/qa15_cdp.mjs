// QA15 · PASE DE ELEVACIÓN VISUAL (29/10) a 412x915 conduciendo
// Chromium por CDP contra la máquina real.
// Verifica el sistema nuevo, no el gusto: fuera el panel de gradiente
// (sin .hero, sin eyebrow, sin chips flotantes), la foto real del
// salón protagonista (≥300 px), la línea de valor en Fraunces sobre
// blanco, UNA acción principal negra («Reservar») y la secundaria
// como texto sobrio; los datos como texto (chip-dato sin fondo);
// tarjetas sin sombra; y que TODO el recorrido funcional sigue vivo:
// buscador real, salón, reserva REAL confirmada (cancelada en la
// limpieza), análisis alcanzable y próximas aperturas del registro.
// La comparativa lado a lado vive en qa15/00-home-actual.png (la
// home anterior, guardada antes del pase) frente a qa15-01.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa15';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);
const erroresConsola = [];

mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9355', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9355/json/version');
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
async function esperar(fn, ms = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evalJs(fn)) return true;
    await sleep(400);
  }
  return false;
}
const activa = id => evalJs(`document.getElementById('${id}').classList.contains('activa')`);
async function click(sel) {
  const ok = await evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  })()`);
  await sleep(400);
  return ok;
}
const sinDesborde = async nombre => {
  const ok = await evalJs(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
  ev(`sin desborde horizontal en ${nombre}`, !!ok);
};

let codigo = '';
try {
  /* ---------- home: carga y orden nuevo ---------- */
  await S('Page.navigate', { url: WEB + '/' });
  const lista = await esperar(
    `!!document.querySelector('#tarjeta-salon-home .salon-card') &&
     document.querySelectorAll('#estanteria-modulos .mod-card').length === 3 &&
     document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`);
  ev('home cargada: foto del salón, servicios y estantería de futuro', lista);

  const orden = await evalJs(`(() => {
    const a = document.getElementById('form-buscar-home');
    const b = document.getElementById('tarjeta-salon-home');
    const c = document.querySelector('#p-inicio .portada-valor');
    const d = document.getElementById('carrusel-reco');
    const e = document.getElementById('seccion-futuro');
    const sigue = (x, y) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    return sigue(a, b) && sigue(b, c) && sigue(c, d) && sigue(d, e);
  })()`);
  ev('orden: buscador → foto del salón → línea de valor → servicios → futuro', orden);

  /* ---------- el sistema visual nuevo, medido ---------- */
  ev('fuera el panel: no queda ningún .hero/.hero-kicker/.hero-chips/.hero-regla en la home',
     await evalJs(`!document.querySelector('#p-inicio .hero, #p-inicio .hero-kicker, #p-inicio .hero-chips, #p-inicio .hero-regla, #p-inicio .hero-estrella')`));

  const valor = await evalJs(`(() => {
    const v = document.querySelector('#p-inicio .portada-valor');
    const h = v.querySelector('h1');
    const cs = getComputedStyle(v), hs = getComputedStyle(h);
    return { fondo: cs.backgroundImage, fuente: hs.fontFamily, tam: parseFloat(hs.fontSize),
             texto: h.textContent.trim() };
  })()`);
  ev('la línea de valor va sobre blanco, sin gradiente', valor.fondo === 'none', valor.fondo);
  ev('titular editorial en Fraunces', /Fraunces/.test(valor.fuente), valor.fuente.split(',')[0]);
  ev('titular sereno (≤32 px, no gritado)', valor.tam <= 32, valor.tam + 'px');
  ev('la línea de valor es la de siempre (hecho, no eslogan nuevo)',
     valor.texto === 'Analiza tus cejas con IA y reserva en minutos', valor.texto);

  const foto = await evalJs(`(() => {
    const img = document.querySelector('#tarjeta-salon-home .salon-card.principal .foto-wrap img');
    const r = img.getBoundingClientRect();
    return { alto: Math.round(r.height), natural: img.naturalWidth, src: img.getAttribute('src') };
  })()`);
  ev('la foto real del salón protagoniza (≥300 px de alto)', foto.alto >= 300 && foto.natural > 0,
     foto.alto + 'px · ' + foto.src);

  const acciones = await evalJs(`(() => {
    const p = document.getElementById('btn-hero-reservar');
    const s = document.getElementById('btn-hero-analizar');
    const pcs = getComputedStyle(p), scs = getComputedStyle(s);
    return { pBg: pcs.backgroundColor, pTxt: p.textContent.trim(),
             sBg: scs.backgroundColor, sClase: s.className };
  })()`);
  ev('UNA acción principal: botón negro «Reservar»',
     acciones.pBg === 'rgb(13, 13, 13)' && acciones.pTxt === 'Reservar',
     acciones.pBg + ' · ' + acciones.pTxt);
  ev('la secundaria es texto sobrio, sin relleno',
     acciones.sBg === 'rgba(0, 0, 0, 0)' && acciones.sClase.includes('btn-texto'),
     acciones.sBg + ' · ' + acciones.sClase);
  ev('ningún botón de la home va relleno de violeta',
     await evalJs(`![...document.querySelectorAll('#p-inicio button')].some(b =>
       getComputedStyle(b).backgroundColor === 'rgb(105, 80, 243)')`));

  const datos = await evalJs(`(() => {
    const chip = document.querySelector('#tarjeta-salon-home [data-chip="horario"]');
    const card = document.querySelector('#tarjeta-salon-home .salon-card');
    const tc = document.querySelector('#p-inicio .tarjeta-cejas');
    return { chipBg: getComputedStyle(chip).backgroundColor,
             sombraCard: getComputedStyle(card).boxShadow,
             sombraTarjeta: getComputedStyle(tc).boxShadow,
             texto: document.querySelector('#tarjeta-salon-home').innerText };
  })()`);
  ev('los datos son texto: chip de horario sin fondo-pegatina',
     datos.chipBg === 'rgba(0, 0, 0, 0)', datos.chipBg);
  ev('los hechos siguen ahí (horario y servicios, como texto)',
     /L–V|L-V/.test(datos.texto) && /servicios/.test(datos.texto));
  ev('tarjetas sin sombra (hairline manda)',
     datos.sombraCard === 'none' && datos.sombraTarjeta === 'none',
     datos.sombraCard + ' / ' + datos.sombraTarjeta);
  ev('títulos de sección en Fraunces',
     await evalJs(`/Fraunces/.test(getComputedStyle(document.querySelector('#p-inicio .seccion-titulo')).fontFamily)`));

  const homeTxt = (await evalJs(`document.getElementById('p-inicio').innerText`)).toLowerCase();
  for (const prohibido of ['módulos de la asistenta', 'plataforma', 'registro central', 'módulo']) {
    ev(`la home sigue sin decir «${prohibido}»`, !homeTxt.includes(prohibido));
  }
  await sinDesborde('inicio');
  await shot('qa15-01-nueva-home');

  /* ---------- la fila del salón abre el salón (y su captura) ---------- */
  await click('#btn-home-salon');
  ev('la fila del salón abre la pantalla del salón', await activa('p-salon'));
  await esperar(`document.querySelectorAll('#salon-servicios .fila-servicio').length >= 4`);
  ev('el nombre del salón va en Fraunces',
     await evalJs(`/Fraunces/.test(getComputedStyle(document.querySelector('.salon-titulo')).fontFamily)`));
  await evalJs(`window.scrollTo(0, 0)`);
  await sleep(400);
  await shot('qa15-03-salon');
  await sinDesborde('salón');
  await click('#btn-salon-atras');
  await sleep(300);
  ev('volver del salón deja la home activa', await activa('p-inicio'));

  /* ---------- el buscador de la home filtra de verdad ---------- */
  await evalJs(`(() => {
    const t = document.getElementById('inp-buscar-home');
    t.value = 'henna';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click('#form-buscar-home .buscador-btn');
  const filtrado = await esperar(
    `document.getElementById('p-explorar').classList.contains('activa') &&
     [...document.querySelectorAll('#explorar-grid .prod-card')]
       .filter(c => c.style.display !== 'none').length === 1`);
  ev('buscar «henna» en la home lleva a Explorar con 1 resultado real', filtrado);
  await click('#nav-inicio');
  await sleep(400);

  /* ---------- reserva REAL desde una tarjeta de servicio ---------- */
  await click('#carrusel-reco .reco-card');
  const paso2 = await esperar(
    `document.getElementById('p-reserva').classList.contains('activa') &&
     document.getElementById('paso-2').classList.contains('activo')`);
  ev('tocar un servicio lleva a la reserva (paso 2)', paso2);

  let hayHoras = 0;
  for (let intento = 0; intento < 14 && !hayHoras; intento++) {
    const fechas = await evalJs(
      `[...document.querySelectorAll('#cal-rejilla .cal-dia')]
         .filter(d => !d.disabled && d.dataset.fecha)
         .map(d => d.dataset.fecha)`).catch(() => []);
    for (const f of fechas) {
      const okDia = await evalJs(`(() => {
        const d = document.querySelector('.cal-dia[data-fecha="${f}"]');
        if (!d || d.disabled) return false;
        d.click();
        return true;
      })()`).catch(() => false);
      if (!okDia) continue;
      await sleep(1400);
      hayHoras = await evalJs(
        `document.querySelectorAll('#huecos .hora-fila').length`).catch(() => 0);
      if (hayHoras) break;
    }
    if (!hayHoras) { await click('#cal-sig'); await sleep(500); }
  }
  ev('huecos reales en el día elegido', hayHoras > 0, hayHoras + ' inicios');
  await evalJs(`document.querySelector('#huecos .hora-fila').click()`);
  await sleep(300);
  await click('#btn-paso2-siguiente');
  await sleep(600);
  await evalJs(`(() => {
    const n = document.getElementById('inp-nombre');
    n.value = 'PRUEBA QA15';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('check-confirma').click();
  })()`);
  await sleep(300);
  ev('confirmar se activa con nombre y confirmación',
     await evalJs(`!document.getElementById('btn-confirmar').disabled`));
  await click('#btn-confirmar');
  let confirmada = false;
  for (let i = 0; i < 20 && !confirmada; i++) {
    await sleep(1500);
    confirmada = await activa('p-confirmada');
  }
  ev('reserva REAL confirmada en la agenda', confirmada);
  codigo = await evalJs(`document.getElementById('conf-codigo').textContent.trim()`);
  ev('código de cita AS-XXXX', /^AS-[A-Z0-9]+$/.test(codigo), codigo);
  await shot('qa15-05-confirmada');
  await click('#nav-inicio');
  await sleep(500);

  /* ---------- la secundaria lleva al análisis (consentimiento) ---------- */
  await click('#btn-hero-analizar');
  ev('«Analizar mis cejas con IA» (texto) abre el consentimiento del análisis',
     await activa('p-consentimiento'));
  await click('#nav-inicio');
  await sleep(400);

  /* ---------- estantería de futuro intacta ---------- */
  const futuras = await evalJs(
    `[...document.querySelectorAll('#estanteria-modulos .mod-card')]
       .map(c => c.dataset.modulo)`);
  ev('la estantería final trae exactamente los 3 módulos futuros',
     futuras.length === 3 &&
     ['moda_probador', 'gafas_accesorios', 'calzado'].every(id => futuras.includes(id)),
     futuras.join(', '));
  const chipsOk = await evalJs(
    `[...document.querySelectorAll('#estanteria-modulos .mod-card .chip-estado')]
       .every(c => c.textContent.trim() === 'Próximamente')`);
  ev('las 3 tarjetas llevan su chip «Próximamente» intacto', chipsOk);
  await evalJs(`document.getElementById('seccion-futuro').scrollIntoView()`);
  await sleep(500);
  await shot('qa15-02-nueva-futuro');
  for (const f of futuras) {
    await click(`#estanteria-modulos .mod-card[data-modulo="${f}"]`);
    const abierta = await esperar(
      `document.getElementById('p-proxima').classList.contains('activa') &&
       document.getElementById('proxima-titulo').textContent.trim().length > 3 &&
       document.getElementById('proxima-que').textContent.trim().length > 20`);
    ev(`«${f}» abre su próxima apertura con contenido del registro`, abierta);
    await click('#btn-proxima-volver');
    await sleep(300);
  }

  ev('consola sin errores en todo el recorrido', erroresConsola.length === 0,
     erroresConsola.slice(0, 3).join(' | '));
} catch (e) {
  ev('QA sin excepción', false, String(e).slice(0, 220));
} finally {
  if (codigo) {
    const enlace = await evalJs(
      `(JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || 'null') || {}).enlace || ''`).catch(() => '');
    const token = (String(enlace).split('/cita/')[1] || '').split(/[?#]/)[0];
    if (token) {
      const rc = await fetch(`${WEB}/api/cita/${token}/cancelar`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const dc = await rc.json().catch(() => ({}));
      ev('limpieza: cita de prueba cancelada', rc.status === 200 &&
         (dc.cita?.estado === 'cancelada' || dc.estado === 'cancelada'), 'st=' + rc.status);
    } else {
      ev('limpieza: enlace de la cita localizado', false, 'código ' + codigo);
    }
  }
  try { ws.close(); } catch {}
  chrome.kill();
}

console.log('\n' + evidencias.join('\n'));
const fallos = evidencias.filter(e => e.startsWith('FALLO'));
console.log(`\nRESUMEN QA15: ${evidencias.length - fallos.length}/${evidencias.length} en verde`);
process.exit(fallos.length ? 1 : 0);
