// QA9 · PALETA DE LA REFERENCIA (v5) a 412x915 conduciendo Chromium por
// CDP. La v4 dejó tres desviaciones de color documentadas (pastillas en
// gris cálido, día elegido en lavanda, activa de nav en carbón) y Lee
// ordenó adoptar ÍNTEGRA la paleta MEDIDA de fresha.com (ESPEC_REFERENCIA
// §1.1). Esta QA no opina: MUESTREA colores reales con getComputedStyle
// y afirma los hex exactos de la espec — primario #6950f3, conversión
// #0d0d0d, pastillas #f5f5f5, bordes #dee3e7, tintes derivados
// documentados. Recorrido: inicio → salón con pack → calendario y horas
// → confirmación real → página del enlace mágico; la cita de prueba
// queda CANCELADA en la limpieza.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const TOK = { 'X-API-Token': 'la-asistenta-dev' };
const OUT = '/data/la-asistenta/web/qa9';
const FECHA_PACK = '2026-11-06'; // viernes; las baterías lo dejan libre
const VIOLETA = 'rgb(105, 80, 243)';       // #6950f3
const NEGRO = 'rgb(13, 13, 13)';           // #0d0d0d
const PASTILLA = 'rgb(245, 245, 245)';     // #f5f5f5
const BORDE = 'rgb(222, 227, 231)';        // #dee3e7
const TINTE = 'rgb(240, 237, 254)';        // #F0EDFE (violeta al 10 %)
const TINTE4 = 'rgb(249, 248, 254)';       // #F9F8FE (violeta al 4 %)
const VOSC = 'rgb(64, 53, 145)';           // #403591 primario oscuro
const VCLARO = 'rgb(188, 176, 249)';       // #BCB0F9 (sobre negro)
const POSITIVO = 'rgb(31, 137, 0)';        // #1f8900
const TINTE_OK = 'rgb(237, 246, 235)';     // #EDF6EB (tinte del positivo)
const GRIS = 'rgb(116, 122, 141)';         // #747a8d texto secundario
const BLANCO = 'rgb(255, 255, 255)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9349', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9349/json/version');
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

let codigo = null, enlace = null, citaId = null;
try {

/* ---------- A · inicio: muestreo de la paleta ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(3200);
const ini = await evalJs(`(() => {
  const cs = (sel, prop, pseudo) => {
    const e = document.querySelector(sel);
    return e ? getComputedStyle(e, pseudo || null)[prop] : null;
  };
  return {
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    buscBorde: cs('.buscador', 'borderColor'),
    buscBtnBg: cs('.buscador-btn', 'backgroundColor'),
    buscBtnRadio: cs('.buscador-btn', 'borderRadius'),
    pastBg: cs('#pastillas .pastilla:not(.destacada) .p-ico', 'backgroundColor'),
    destBg: cs('.pastilla.destacada .p-ico', 'backgroundColor'),
    destStroke: cs('.pastilla.destacada svg', 'stroke'),
    chipBg: cs('.chip-dato', 'backgroundColor'),
    chipColor: cs('.chip-dato', 'color'),
    salonBorde: cs('#carrusel-reco .salon-card', 'borderColor'),
    navOnColor: cs('#nav-inicio', 'color'),
    navOnFill: cs('#nav-inicio svg', 'fill'),
    navOnStroke: cs('#nav-inicio svg', 'stroke'),
    navPunto: cs('#nav-inicio .punto', 'display'),
    navOffColor: cs('#nav-reservar', 'color'),
  };
})()`);
ev('PWA: theme-color blanco (#ffffff), la barra ya no se tiñe de carbón',
   ini.themeColor === '#ffffff', ini.themeColor);
ev('fondo de pantalla blanco', ini.bodyBg === BLANCO, ini.bodyBg);
ev('buscador: borde #dee3e7 y botón de conversión NEGRO #0d0d0d en píldora',
   ini.buscBorde === BORDE && ini.buscBtnBg === NEGRO,
   `borde=${ini.buscBorde} btn=${ini.buscBtnBg} radio=${ini.buscBtnRadio}`);
ev('pastillas de categoría en #f5f5f5 (fuera el gris cálido #F1EDE3)',
   ini.pastBg === PASTILLA, ini.pastBg);
ev('pastilla destacada (Análisis IA): tinte del violeta con icono violeta',
   ini.destBg === TINTE && ini.destStroke === VIOLETA,
   `fondo=${ini.destBg} icono=${ini.destStroke}`);
ev('chips de datos: tinte del violeta con texto en primario oscuro #403591',
   ini.chipBg === TINTE && ini.chipColor === VOSC,
   `fondo=${ini.chipBg} texto=${ini.chipColor}`);
ev('tarjeta del salón: borde #dee3e7', ini.salonBorde === BORDE, ini.salonBorde);
ev('nav: pestaña activa en violeta #6950f3 con icono RELLENO (como la captura de Lee)',
   ini.navOnColor === VIOLETA && ini.navOnFill === VIOLETA && ini.navOnStroke === VIOLETA,
   `color=${ini.navOnColor} fill=${ini.navOnFill} stroke=${ini.navOnStroke}`);
ev('nav: fuera el punto lavanda bajo la pestaña activa; inactivas en gris #747a8d',
   ini.navPunto === 'none' && ini.navOffColor === GRIS,
   `punto=${ini.navPunto} inactiva=${ini.navOffColor}`);
const swTxt = await evalJs(`fetch('/sw.js').then(r => r.text())`);
ev('PWA: el cascarón nuevo es la shell v7', swTxt.includes('la-asistenta-shell-v7'));
await shot('qa9-01-inicio');
await sinDesborde('inicio');

/* ---------- B · salón: pack con estados en violeta ---------- */
await click('#btn-ir-salon'); await sleep(900);
await scrollA('#salon-servicios');
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"]').click()`);
await sleep(300);
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"]').click()`);
await sleep(300);
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Brow Lamination"]').click()`);
await sleep(400);
const sel = await evalJs(`(() => {
  const cs = (e, prop) => e ? getComputedStyle(e)[prop] : null;
  const fila = document.querySelector('#salon-servicios .fila-servicio.sel');
  const add = fila?.querySelector('.fs-add');
  return {
    nSel: document.querySelectorAll('#salon-servicios .fila-servicio.sel').length,
    filaBorde: cs(fila, 'borderColor'),
    filaBg: cs(fila, 'backgroundColor'),
    addBg: cs(add, 'backgroundColor'),
    addStroke: add ? getComputedStyle(add.querySelector('svg')).stroke : null,
    btnBg: cs(document.querySelector('#btn-salon-reservar'), 'backgroundColor'),
  };
})()`);
ev('servicio elegido: borde violeta #6950f3 sobre tinte al 4 %',
   sel.nSel === 2 && sel.filaBorde === VIOLETA && sel.filaBg === TINTE4,
   `borde=${sel.filaBorde} fondo=${sel.filaBg}`);
ev('botón +/✓ del servicio elegido: fondo violeta con marca blanca',
   sel.addBg === VIOLETA && sel.addStroke === BLANCO,
   `fondo=${sel.addBg} marca=${sel.addStroke}`);
ev('CTA de la barra del pack: negro #0d0d0d (antes carbón #252533)',
   sel.btnBg === NEGRO, sel.btnBg);
await shot('qa9-02-salon-pack');
await sinDesborde('salón con pack');

/* ---------- C · paso 2: día y radio en violeta ---------- */
await click('#btn-salon-reservar'); await sleep(900);
await evalJs(`document.querySelector('#cal-sig').click()`);
await sleep(400);
await evalJs(`document.querySelector('.cal-dia[data-fecha="${FECHA_PACK}"]').click()`);
await sleep(1500);
const horas = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].map(f => f.dataset.hora)`);
let horaElegida = horas.includes('17:00') ? '17:00'
  : horas.filter(h => h >= '16:00').pop() || horas[horas.length - 1];
await evalJs(`document.querySelector('#btn-mas-huecos')?.click()`);
await sleep(300);
await evalJs(`document.querySelector('.hora-fila[data-hora="${horaElegida}"]').scrollIntoView({block:'center'})`);
await sleep(300);
await evalJs(`document.querySelector('.hora-fila[data-hora="${horaElegida}"]').click()`);
await sleep(400);
const paso2 = await evalJs(`(() => {
  const dia = document.querySelector('.cal-dia.sel');
  const radio = document.querySelector('.hora-fila.sel .hf-radio');
  return {
    diaBg: dia ? getComputedStyle(dia).backgroundColor : null,
    diaColor: dia ? getComputedStyle(dia).color : null,
    radioBorde: radio ? getComputedStyle(radio).borderColor : null,
    radioPunto: radio ? getComputedStyle(radio, '::after').backgroundColor : null,
    btnBg: getComputedStyle(document.querySelector('#btn-paso2-siguiente')).backgroundColor,
  };
})()`);
ev('día elegido: círculo VIOLETA #6950f3 con número blanco (fuera la lavanda)',
   paso2.diaBg === VIOLETA && paso2.diaColor === BLANCO,
   `fondo=${paso2.diaBg} número=${paso2.diaColor}`);
ev('radio de hora elegida: anillo y punto en violeta #6950f3',
   paso2.radioBorde === VIOLETA && paso2.radioPunto === VIOLETA,
   `anillo=${paso2.radioBorde} punto=${paso2.radioPunto}`);
ev('botón «Siguiente» del paso 2: negro #0d0d0d', paso2.btnBg === NEGRO, paso2.btnBg);
await shot('qa9-03-reserva');
await sinDesborde('paso 2');

/* ---------- D · paso 3 y confirmación ---------- */
await click('#btn-paso2-siguiente'); await sleep(700);
const btnConfBg = await evalJs(`getComputedStyle(document.querySelector('#btn-confirmar')).backgroundColor`);
await evalJs(`(() => { const n = document.querySelector('#inp-nombre');
  n.value = 'PRUEBA QA9 PALETA'; n.dispatchEvent(new Event('input', { bubbles: true }));
  const c = document.querySelector('#check-confirma');
  c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(300);
ev('botón «Confirmar reserva»: negro #0d0d0d', btnConfBg === NEGRO, btnConfBg);
await click('#btn-confirmar');
await sleep(2500);
const conf = await evalJs(`(() => {
  const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || 'null');
  return {
    pantalla: document.querySelector('#p-confirmada').classList.contains('activa'),
    codigo: document.querySelector('#conf-codigo').textContent,
    codBg: getComputedStyle(document.querySelector('.codigo-grande')).backgroundColor,
    tickBg: getComputedStyle(document.querySelector('.confirmada .tick')).backgroundColor,
    enlace: g?.enlace || null,
  };
})()`);
codigo = conf.codigo; enlace = conf.enlace;
ev('confirmación real con código AS-XXXX', conf.pantalla && /^AS-/.test(codigo), codigo || '');
ev('código grande sobre negro #0d0d0d; tick de confirmada en positivo #1f8900',
   conf.codBg === NEGRO && conf.tickBg === POSITIVO,
   `código=${conf.codBg} tick=${conf.tickBg}`);
await shot('qa9-04-confirmada');

/* ---------- E · cita.html: la página del enlace mágico ---------- */
if (!enlace) throw new Error('sin enlace mágico guardado');
await S('Page.navigate', { url: enlace });
await sleep(2500);
const pag = await evalJs(`(() => {
  const cs = (sel, prop) => { const e = document.querySelector(sel);
    return e ? getComputedStyle(e)[prop] : null; };
  return {
    headerBg: cs('header', 'backgroundColor'),
    marca: cs('.marca', 'color'),
    estBg: cs('#cita-estado', 'backgroundColor'),
    estColor: cs('#cita-estado', 'color'),
    btnBg: cs('#btn-prep', 'backgroundColor'),
    btnColor: cs('#btn-prep', 'color'),
  };
})()`);
ev('cita: cabecera negra #0d0d0d con la marca en violeta aclarado (sobre negro)',
   pag.headerBg === NEGRO && pag.marca === VCLARO,
   `cabecera=${pag.headerBg} marca=${pag.marca}`);
ev('cita: pastilla de estado CONFIRMADA en tinte del positivo con texto #1f8900',
   pag.estBg === TINTE_OK && pag.estColor === POSITIVO,
   `fondo=${pag.estBg} texto=${pag.estColor}`);
ev('cita: botón de acción en violeta #6950f3 con texto blanco',
   pag.btnBg === VIOLETA && pag.btnColor === BLANCO,
   `fondo=${pag.btnBg} texto=${pag.btnColor}`);
await shot('qa9-05-cita');
await sinDesborde('página de la cita');

/* ---------- limpieza: la cita de prueba queda CANCELADA ---------- */
const rAgenda = await fetch(`${AGENDA}/citas?fecha=${FECHA_PACK}`, { headers: TOK });
const dAgenda = await rAgenda.json();
const enAgenda = (dAgenda.citas || []).find(c => c.codigo === codigo);
citaId = enAgenda?.id || null;
if (citaId) {
  const rCan = await fetch(`${AGENDA}/citas/${citaId}/cancelar`,
    { method: 'POST', headers: { ...TOK, 'Content-Type': 'application/json' }, body: '{}' });
  const dCan = await rCan.json();
  ev('limpieza: la cita de la QA9 queda CANCELADA en la agenda (no borrada)',
     rCan.status === 200 && dCan.cita?.estado === 'cancelada', `id=${citaId}`);
} else {
  ev('limpieza: cita localizada en la agenda', false, `código=${codigo}`);
}

} catch (e) {
  ev('QA9 sin excepciones', false, String(e).slice(0, 240));
} finally {
  console.log('\n' + evidencias.join('\n'));
  const fallos = evidencias.filter(x => x.startsWith('FALLO'));
  console.log(`\nRESUMEN QA9: ${evidencias.length - fallos.length}/${evidencias.length} comprobaciones en verde`);
  try { chrome.kill(); } catch {}
  process.exit(fallos.length ? 1 : 0);
}
