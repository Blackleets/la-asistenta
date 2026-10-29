// QA16 · HOME SEGÚN LA ESPEC, CON TEMÁTICA PROPIA (29/10) a 412x915
// conduciendo Chromium por CDP contra la máquina real.
// La portada vuelve a la anatomía de la ingeniería inversa
// (ESPEC_REFERENCIA §P1 + referencia/01-home.png como ley de layout)
// con contenido de UN salón real: fila del salón → buscador píldora →
// rejilla 4×2 de accesos reales → «Recomendado» en carrusel (~80 %
// con asomo, foto como tarjeta 4:3 con encuadre verificado) →
// tarjeta sobria del análisis → «Más en camino» del registro.
// Se retiran de la portada: la barra de marca pesada, el hero
// editorial con Fraunces y la tarjeta del salón a todo ancho.
// Tabla elemento→medido contra la espec, CADA pastilla probada con
// clic, reserva REAL confirmada (cancelada en la limpieza) y
// revisión de fotos por naturalWidth/aspecto (la visual, en las
// capturas qa16-01..03, la hace el agente).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa16';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);
const erroresConsola = [];

mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9356', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9356/json/version');
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
const aInicio = async () => { await click('#nav-inicio'); await sleep(500); };

let codigo = '';
try {
  /* ---------- home: carga y anatomía ---------- */
  await S('Page.navigate', { url: WEB + '/' });
  const lista = await esperar(
    `document.querySelectorAll('#pastillas .pastilla').length === 8 &&
     document.querySelector('#carrusel-reco .salon-card') &&
     document.querySelectorAll('#carrusel-reco .reco-card').length >= 3 &&
     document.querySelectorAll('#estanteria-modulos .mod-card').length === 3`);
  ev('home cargada: 8 pastillas, carrusel con salón+servicios y futuro del registro', lista);

  ev('retirado de la portada: sin barra de marca, sin hero editorial, sin tarjeta suelta',
     await evalJs(`getComputedStyle(document.querySelector('.cabecera')).display === 'none' &&
       !document.querySelector('#p-inicio .portada-valor') &&
       !document.getElementById('tarjeta-salon-home') &&
       !document.querySelector('#p-inicio .hero')`));

  const orden = await evalJs(`(() => {
    const a = document.getElementById('btn-home-salon');
    const b = document.getElementById('form-buscar-home');
    const c = document.getElementById('pastillas');
    const d = document.getElementById('carrusel-reco');
    const e = document.querySelector('#p-inicio .tarjeta-cejas');
    const f = document.getElementById('seccion-futuro');
    const sigue = (x, y) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    return sigue(a, b) && sigue(b, c) && sigue(c, d) && sigue(d, e) && sigue(e, f);
  })()`);
  ev('orden de la espec: fila del salón → buscador → rejilla 4×2 → Recomendado → análisis → futuro', orden);

  /* ---------- tabla elemento → medido (espec §P1) ---------- */
  const fila = await evalJs(`(() => {
    const b = document.getElementById('btn-home-salon');
    const cs = getComputedStyle(b);
    const pin = b.querySelector('.fh-pin path');
    return { peso: cs.fontWeight, tam: parseFloat(cs.fontSize),
             texto: b.innerText.trim(), pinFill: getComputedStyle(pin).fill };
  })()`);
  ev('fila: «Ari Vivas Beauty» en peso normal (400), 17 px',
     (fila.peso === '400' || fila.peso === 'normal') && fila.tam === 17,
     fila.peso + ' · ' + fila.tam + 'px · ' + fila.texto);
  ev('fila: pin violeta relleno (#6950f3)', fila.pinFill === 'rgb(105, 80, 243)', fila.pinFill);

  const busc = await evalJs(`(() => {
    const f = document.getElementById('form-buscar-home');
    const t = document.getElementById('inp-buscar-home');
    const btn = f.querySelector('.buscador-btn');
    const fr = f.getBoundingClientRect(), br = btn.getBoundingClientRect();
    return { radio: parseFloat(getComputedStyle(f).borderTopLeftRadius),
             alto: Math.round(fr.height), btnAncho: Math.round(br.width),
             btnBg: getComputedStyle(btn).backgroundColor,
             ph: t.getAttribute('placeholder'), filas: t.rows };
  })()`);
  ev('buscador píldora: radio 999 y alto sereno (56–66 px)',
     busc.radio >= 100 && busc.alto >= 56 && busc.alto <= 66,
     'radio ' + busc.radio + 'px · alto ' + busc.alto + 'px');
  ev('buscador: botón circular negro de 56 px dentro de la píldora (espec)',
     busc.btnAncho === 56 && busc.btnBg === 'rgb(13, 13, 13)',
     busc.btnAncho + 'px · ' + busc.btnBg);
  ev('buscador: placeholder completo «Buscar todos los servicios», campo de 2 filas',
     busc.ph === 'Buscar todos los servicios' && busc.filas === 2, busc.ph);

  const rejilla = await evalJs(`(() => {
    const ps = [...document.querySelectorAll('#pastillas .pastilla')];
    const r0 = ps[0].getBoundingClientRect(), r4 = ps[4].getBoundingClientRect();
    const ico = ps[0].querySelector('.p-ico'), txt = ps[0].querySelector('.p-txt');
    const ics = getComputedStyle(ico), tcs = getComputedStyle(txt);
    return { n: ps.length, fila1: Math.round(r0.top), fila2: Math.round(r4.top),
             radio: parseFloat(ics.borderTopLeftRadius), fondo: ics.backgroundColor,
             pesoTxt: tcs.fontWeight, tamTxt: parseFloat(tcs.fontSize),
             etiquetas: ps.map(p => p.querySelector('.p-txt').textContent.trim()) };
  })()`);
  ev('rejilla 4×2: 8 pastillas en dos filas',
     rejilla.n === 8 && rejilla.fila2 > rejilla.fila1,
     rejilla.etiquetas.join(' · '));
  ev('pastillas #f5f5f5 radio 16 (espec)',
     rejilla.radio === 16 && rejilla.fondo === 'rgb(245, 245, 245)',
     'radio ' + rejilla.radio + 'px · ' + rejilla.fondo);
  ev('etiquetas en peso NORMAL (400), 13 px',
     (rejilla.pesoTxt === '400' || rejilla.pesoTxt === 'normal') && rejilla.tamTxt === 13,
     rejilla.pesoTxt + ' · ' + rejilla.tamTxt + 'px');
  ev('las ocho entradas son las nuestras',
     ['Reservar', 'Análisis IA', 'Diseño de cejas', 'Ombré Henna', 'Brow Lamination',
      'Depilación', 'El salón', 'WhatsApp'].every(e => rejilla.etiquetas.includes(e)),
     rejilla.etiquetas.join(' · '));

  const reco = await evalJs(`(() => {
    const h2 = [...document.querySelectorAll('#p-inicio .seccion-titulo')]
      .find(h => h.textContent.trim() === 'Recomendado');
    const hs = getComputedStyle(h2);
    const car = document.getElementById('carrusel-reco');
    const primera = car.children[0];
    const segunda = car.children[1];
    const cr = car.getBoundingClientRect(), p1 = primera.getBoundingClientRect(),
          p2 = segunda.getBoundingClientRect();
    return { fuente: hs.fontFamily, peso: hs.fontWeight,
             anchoPct: Math.round(100 * p1.width / (cr.width - 32)),
             asomo: p2.left < cr.right - 4 && p2.left > cr.left,
             esSalon: primera.classList.contains('salon-card') };
  })()`);
  ev('«Recomendado» en Montserrat 800, SIN serif',
     /Montserrat/.test(reco.fuente) && !/Fraunces/.test(reco.fuente) &&
     (reco.peso === '800' || reco.peso === 'bold'),
     reco.fuente.split(',')[0] + ' · ' + reco.peso);
  ev('carrusel al ~80 % con asomo de la siguiente tarjeta',
     reco.anchoPct >= 77 && reco.anchoPct <= 83 && reco.asomo,
     reco.anchoPct + '% · asomo=' + reco.asomo);
  ev('la tarjeta del salón ABRE el carrusel', reco.esSalon);

  const fotos = await evalJs(`(() => [...document.querySelectorAll('#carrusel-reco .foto-wrap')]
    .map(w => { const img = w.querySelector('img'); const r = w.getBoundingClientRect();
      return { src: (img.getAttribute('src') || '').split('/').pop(),
               aspecto: +(r.width / r.height).toFixed(2),
               fit: getComputedStyle(img).objectFit,
               natural: img.naturalWidth, pos: img.style.objectPosition || '' }; }))()`);
  ev('fotos cargadas de verdad en todas las tarjetas con foto',
     fotos.length >= 4 && fotos.every(f => f.natural > 0), JSON.stringify(fotos.map(f => f.src)));
  ev('la foto ES la tarjeta: aspecto ~4:3 y object-fit cover (sin deformar)',
     fotos.every(f => f.aspecto >= 1.28 && f.aspecto <= 1.38 && f.fit === 'cover'),
     JSON.stringify(fotos.map(f => f.src + '@' + f.aspecto)));
  ev('encuadre elegido por foto (object-position propio)',
     fotos.every(f => /center \d+%/.test(f.pos)), JSON.stringify(fotos.map(f => f.pos)));
  ev('sin Fraunces en ningún título de la portada',
     await evalJs(`![...document.querySelectorAll('#p-inicio h2, #p-inicio h3')]
       .some(h => /Fraunces/.test(getComputedStyle(h).fontFamily))`));
  await sinDesborde('inicio');
  await evalJs(`window.scrollTo(0, 0)`);
  await sleep(400);
  await shot('qa16-01-inicio');

  /* ---------- clics: cada pastilla hace lo suyo ---------- */
  await click('#pastilla-reservar');
  ev('pastilla «Reservar» → reserva en el paso 1',
     await activa('p-reserva') &&
     await evalJs(`document.getElementById('paso-1').classList.contains('activo')`));
  await aInicio();

  await click('#pastillas [data-servicio="Diseño de cejas"]');
  const sembrada = await esperar(
    `document.getElementById('p-reserva').classList.contains('activa') &&
     document.getElementById('paso-2').classList.contains('activo') &&
     estado.seleccion.includes('Diseño de cejas')`, 6000);
  ev('pastilla «Diseño de cejas» → reserva sembrada con ese servicio (paso 2)', sembrada);
  await aInicio();

  for (const s of ['Ombré Brows Henna', 'Brow Lamination', 'Depilación rápida']) {
    await click(`#pastillas [data-servicio="${s}"]`);
    const okS = await esperar(
      `estado.seleccion.includes(${JSON.stringify(s)}) &&
       document.getElementById('paso-2').classList.contains('activo')`, 6000);
    ev(`pastilla del servicio «${s}» siembra la reserva`, okS);
    await aInicio();
  }

  await click('#pastilla-analisis');
  ev('pastilla «Análisis IA» → flujo de análisis (consentimiento)', await activa('p-consentimiento'));
  await aInicio();

  await click('#pastilla-salon');
  ev('pastilla «El salón» → pantalla del salón', await activa('p-salon'));
  await esperar(`document.querySelectorAll('#salon-servicios .fila-servicio').length >= 4`);
  await click('#btn-salon-atras');
  await sleep(300);
  ev('volver del salón deja la home activa', await activa('p-inicio'));

  await evalJs(`window.__wa = null; window.open = u => { window.__wa = u; };`);
  await click('#pastilla-whatsapp');
  ev('pastilla «WhatsApp» abre el wa.me público real del salón',
     (await evalJs(`window.__wa`)) === 'https://wa.me/584249134367',
     String(await evalJs(`window.__wa`)));
  await evalJs(`delete window.__wa;`);

  /* ---------- el buscador filtra la carta real ---------- */
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
  await aInicio();

  /* ---------- Recomendado de cerca + reserva REAL ---------- */
  await evalJs(`document.getElementById('carrusel-reco').scrollIntoView({ block: 'center' })`);
  await sleep(600);
  await shot('qa16-02-recomendado');
  await click('#carrusel-reco .reco-card');
  const paso2 = await esperar(
    `document.getElementById('p-reserva').classList.contains('activa') &&
     document.getElementById('paso-2').classList.contains('activo')`);
  ev('tocar una tarjeta de «Recomendado» lleva a la reserva (paso 2)', paso2);

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
    n.value = 'PRUEBA QA16';
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
  await aInicio();

  /* ---------- análisis sobrio + futuro intacto ---------- */
  const futuras = await evalJs(
    `[...document.querySelectorAll('#estanteria-modulos .mod-card')]
       .map(c => c.dataset.modulo)`);
  ev('«Más en camino» trae exactamente los 3 módulos futuros del registro',
     futuras.length === 3 &&
     ['moda_probador', 'gafas_accesorios', 'calzado'].every(id => futuras.includes(id)),
     futuras.join(', '));
  const chipsOk = await evalJs(
    `[...document.querySelectorAll('#estanteria-modulos .mod-card .chip-estado')]
       .every(c => c.textContent.trim() === 'Próximamente')`);
  ev('las 3 tarjetas llevan su chip «Próximamente» intacto', chipsOk);
  await evalJs(`document.querySelector('#p-inicio .tarjeta-cejas').scrollIntoView()`);
  await sleep(500);
  await shot('qa16-03-analisis-futuro');
  await sinDesborde('análisis y futuro');

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
console.log(`\nRESUMEN QA16: ${evidencias.length - fallos.length}/${evidencias.length} en verde`);
process.exit(fallos.length ? 1 : 0);
