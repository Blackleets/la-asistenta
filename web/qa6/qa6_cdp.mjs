// QA6 · INTERFAZ v3 «espejo de la experiencia de referencia» a 412x915
// por CDP. Lista de cotejo contra la captura de referencia de Lee:
// orden de bloques del inicio (fila del salón con pin → buscador píldora
// con botón negro → rejilla 4x2 de pastillas gris cálido → «Recomendado»
// con la tarjeta grande del salón) · pantalla del salón con filas de
// servicio y botón Reservar por fila · nav de 4 (Inicio · Buscar ·
// Reservar · Mi cita) con Buscar enfocando el buscador · reserva real
// completa hasta la confirmación · la cita queda en «Mi cita» vía
// localStorage · limpieza: la cita de prueba queda CANCELADA.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const OUT = '/data/la-asistenta/web/qa6';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9340', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9340/json/version');
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

/* ---------- A · inicio espejo: orden, buscador, rejilla, tarjeta del salón ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(3500);
const ini = await evalJs(`(() => {
  const y = sel => { const e = document.querySelector(sel);
    return e ? e.getBoundingClientRect().top + window.scrollY : -1; };
  const pastillas = [...document.querySelectorAll('#pastillas .pastilla')];
  const xs = new Set(pastillas.slice(0, 4).map(p => Math.round(p.getBoundingClientRect().left)));
  const ys = new Set(pastillas.map(p => Math.round(p.getBoundingClientRect().top)));
  const salon = document.querySelector('#salon-card-caja .salon-card');
  return {
    orden: [y('.fila-salon'), y('.buscador'), y('#pastillas'), y('#salon-card-caja')],
    btnBuscarBg: getComputedStyle(document.querySelector('.buscador-btn')).backgroundColor,
    nPastillas: pastillas.length, cols: xs.size, filas: ys.size,
    pastillaBg: getComputedStyle(pastillas[1].querySelector('.p-ico')).backgroundColor,
    salonOk: !!salon,
    salonFoto: salon ? (salon.querySelector('img').complete && salon.querySelector('img').naturalWidth > 0) : false,
    chips: salon ? [...salon.querySelectorAll('.chip-dato')].map(c => c.textContent.trim()) : [],
    reco: document.querySelectorAll('#lista-recomendado .reco-card').length,
    navBtns: [...document.querySelectorAll('.barra-nav .nav-btn')].map(b => b.textContent.trim()),
  };
})()`);
ev('inicio: orden de bloques = fila del salón → buscador → rejilla → recomendado',
   ini.orden.every((v, i) => v >= 0 && (i === 0 || v > ini.orden[i - 1])),
   ini.orden.join(' < '));
ev('inicio: buscador píldora con botón negro «Buscar»',
   ini.btnBuscarBg === 'rgb(37, 37, 51)', ini.btnBuscarBg);
ev('inicio: rejilla de 8 pastillas en 4 columnas × 2 filas',
   ini.nPastillas === 8 && ini.cols === 4 && ini.filas === 2,
   `n=${ini.nPastillas} cols=${ini.cols} filas=${ini.filas}`);
ev('inicio: pastillas en gris cálido claro', ini.pastillaBg === 'rgb(241, 237, 227)', ini.pastillaBg);
ev('recomendado: tarjeta grande del salón con su foto cargada', ini.salonOk && ini.salonFoto);
ev('recomendado: chips con hechos (horario real y nº de servicios)',
   ini.chips.some(t => t.includes('L–V 10–20') && t.includes('S 10–14')) &&
   ini.chips.some(t => t === '4 servicios'), JSON.stringify(ini.chips));
ev('recomendado: 3 tarjetas fotográficas de servicios tras la del salón',
   ini.reco === 3, `n=${ini.reco}`);
ev('nav inferior de 4: Inicio · Buscar · Reservar · Mi cita',
   ini.navBtns.length === 4 && ini.navBtns[1].startsWith('Buscar') && ini.navBtns[3].startsWith('Mi cita'),
   ini.navBtns.join(' · '));
await shot('01-inicio');
await sinDesborde('inicio (arriba)');
await scrollA('#salon-card-caja');
await shot('02-recomendado-salon');
await sinDesborde('inicio (recomendado)');

/* ---------- B · buscador: la tarjeta del salón también se filtra ---------- */
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = 'henna'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);
const filtro = await evalJs(`(() => ({
  salonVisible: document.querySelector('#salon-card-caja .salon-card').style.display !== 'none',
  recoVisibles: [...document.querySelectorAll('#lista-recomendado .reco-card')]
    .filter(c => c.style.display !== 'none').length,
}))()`);
ev('buscador: «henna» oculta la tarjeta del salón y deja solo Ombré',
   !filtro.salonVisible && filtro.recoVisibles === 1, JSON.stringify(filtro));
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);

/* ---------- C · pantalla del salón: foto, filas con Reservar, WhatsApp ---------- */
await evalJs(`window.scrollTo(0, 0)`); await sleep(300);
await click('#btn-ir-salon'); await sleep(900);
const salon = await evalJs(`(() => {
  const filas = [...document.querySelectorAll('#salon-servicios .fila-servicio')];
  const wa = document.querySelector('#p-salon a.btn');
  return {
    activa: document.querySelector('#p-salon').classList.contains('activa'),
    heroOk: (() => { const i = document.querySelector('.salon-hero img');
      return i && i.complete && i.naturalWidth > 0; })(),
    nFilas: filas.length,
    filasOk: filas.every(f => f.querySelector('.fs-btn')?.textContent.trim() === 'Reservar' &&
                              /€|Consultar/.test(f.textContent) && /min/.test(f.textContent)),
    chipHorario: document.querySelector('#salon-chip-horario').textContent,
    wa: wa ? wa.getAttribute('href') : '',
    navInicioOn: document.querySelector('#nav-inicio').classList.contains('on'),
  };
})()`);
ev('salón: la fila con pin abre la pantalla del salón con la foto cargada',
   salon.activa && salon.heroOk);
ev('salón: 4 filas de servicio con duración, precio y botón «Reservar»',
   salon.nFilas === 4 && salon.filasOk, `n=${salon.nFilas}`);
ev('salón: chip de horario real', salon.chipHorario.includes('L–V 10–20'), salon.chipHorario);
ev('salón: contacto por el WhatsApp público', salon.wa === 'https://wa.me/584249134367', salon.wa);
await shot('03-salon');
await sinDesborde('salón');
await evalJs(`[...document.querySelectorAll('#salon-servicios .fila-servicio')]
  .find(f => f.textContent.includes('Brow Lamination')).click()`);
await sleep(1800);
const desdeSalon = await evalJs(`(() => ({
  paso2: document.querySelector('#paso-2').classList.contains('activo'),
  resumen: document.querySelector('#rm-txt').textContent.includes('Brow Lamination'),
  huecos: document.querySelectorAll('#huecos .hueco').length,
}))()`);
ev('salón: «Reservar» de una fila entra en el paso 2 con ese servicio y huecos reales',
   desdeSalon.paso2 && desdeSalon.resumen && desdeSalon.huecos > 0, JSON.stringify(desdeSalon));
await shot('04-reserva-paso2');
await sinDesborde('reserva paso 2');

/* ---------- D · nav Buscar enfoca el buscador ---------- */
await click('#nav-buscar'); await sleep(1300);
const foco = await evalJs(`document.activeElement ? document.activeElement.id : ''`);
ev('nav Buscar: sube al inicio y pone el foco en el buscador', foco === 'inp-buscar', foco);

/* ---------- E · Mi cita sin reserva en este dispositivo: pantalla honesta ---------- */
await click('#nav-micita'); await sleep(700);
const vacia = await evalJs(`(() => ({
  activa: document.querySelector('#p-micita').classList.contains('activa'),
  vaciaVisible: document.querySelector('#micita-vacia').style.display !== 'none',
  datosOcultos: document.querySelector('#micita-datos').style.display === 'none',
  navOn: document.querySelector('#nav-micita').classList.contains('on'),
  texto: document.querySelector('#micita-vacia').textContent.includes('WhatsApp'),
}))()`);
ev('mi cita (sin reserva): explicación honesta y pestaña activa',
   vacia.activa && vacia.vaciaVisible && vacia.datosOcultos && vacia.navOn && vacia.texto,
   JSON.stringify(vacia));
await shot('05-micita-vacia');
await sinDesborde('mi cita (vacía)');

/* ---------- F · reserva completa → confirmación → Mi cita con la cita ---------- */
await click('#nav-reservar'); await sleep(900);
await evalJs(`[...document.querySelectorAll('#res-servicios .servicio-card')]
  .find(c => c.dataset.servicio === 'Diseño de cejas').click()`);
await sleep(300);
await click('#btn-paso1-siguiente'); await sleep(600);
const fechaObj = new Date(Date.now() + 24 * 3600 * 1000);
if (fechaObj.getDay() === 0) fechaObj.setTime(fechaObj.getTime() + 24 * 3600 * 1000);
const fecha = fechaObj.toISOString().slice(0, 10);
await evalJs(`(()=>{const f=document.querySelector('#inp-fecha');f.value='${fecha}';` +
             `f.dispatchEvent(new Event('change'));})()`);
for (let i = 0; i < 10; i++) {
  await sleep(700);
  if (await evalJs(`document.querySelectorAll('#huecos .hueco').length > 0`)) break;
}
await evalJs(`document.querySelector('#huecos .hueco:not([data-extra])').click()`);
await sleep(300);
await click('#btn-paso2-siguiente'); await sleep(600);
await evalJs(`document.querySelector('#inp-nombre').value = 'PRUEBA QA6'`);
await evalJs(`document.querySelector('#inp-nombre').dispatchEvent(new Event('input'))`);
await evalJs(`document.querySelector('#inp-telefono').value = '600123456'`);
await evalJs(`document.querySelector('#check-confirma').click()`);
await sleep(300);
const listo = await evalJs(`!document.querySelector('#btn-confirmar').disabled`);
ev('reserva: paso 3 listo para confirmar con la cita completa', !!listo);
await click('#btn-confirmar');
let confirmada = false;
for (let i = 0; i < 20; i++) {
  await sleep(800);
  confirmada = await evalJs(`document.querySelector('#p-confirmada').classList.contains('activa')`);
  if (confirmada) break;
}
const conf = await evalJs(`(() => {
  let guardada = null;
  try { guardada = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || 'null'); } catch {}
  return {
    codigo: document.querySelector('#conf-codigo').textContent,
    enlace: document.querySelector('#conf-enlace').textContent,
    verCita: document.querySelector('#conf-ver-cita').getAttribute('href') || '',
    guardada,
  };
})()`);
ev('confirmación: código AS-XXXX y enlace mágico coherentes',
   confirmada && /^AS-/.test(conf.codigo) && conf.enlace.includes('/cita/') &&
   conf.verCita === conf.enlace, `codigo=${conf.codigo}`);
ev('confirmación: la cita queda guardada en el dispositivo (localStorage)',
   !!conf.guardada && conf.guardada.enlace === conf.enlace && conf.guardada.codigo === conf.codigo,
   conf.guardada ? conf.guardada.codigo : 'sin guardar');
await shot('06-confirmacion');
await sinDesborde('confirmación');
await click('#nav-micita'); await sleep(700);
const miCita = await evalJs(`(() => ({
  datosVisibles: document.querySelector('#micita-datos').style.display !== 'none',
  resumen: document.querySelector('#micita-resumen').textContent,
  abrir: document.querySelector('#micita-abrir').getAttribute('href') || '',
}))()`);
ev('mi cita (con reserva): muestra la cita guardada y su enlace',
   miCita.datosVisibles && miCita.resumen.includes(conf.codigo) &&
   miCita.abrir === conf.enlace, miCita.resumen.replace(/\s+/g, ' ').slice(0, 90));
await shot('07-micita');
await sinDesborde('mi cita (con reserva)');

/* ---------- G · service worker v4 ---------- */
const sw = await evalJs(`(async () => {
  const claves = await caches.keys();
  return { claves, controlando: !!navigator.serviceWorker.controller };
})()`);
ev('service worker v4 instalado y controlando',
   sw.claves.includes('la-asistenta-shell-v4') && sw.controlando, JSON.stringify(sw.claves));

/* ---------- limpieza: la cita de prueba queda CANCELADA ---------- */
const dia = await (await fetch(`${AGENDA}/citas?fecha=${fecha}`, {
  headers: { 'X-API-Token': 'la-asistenta-dev' },
})).json();
const mia = dia.citas.find(c => c.nombre === 'PRUEBA QA6' && c.estado === 'confirmada');
if (mia) {
  const r = await fetch(`${AGENDA}/citas/${mia.id}/cancelar`, {
    method: 'POST', headers: { 'X-API-Token': 'la-asistenta-dev' }, body: '{}',
  });
  const d = await r.json();
  ev('limpieza: cita de prueba cancelada en la agenda', d.cita?.estado === 'cancelada', `id=${mia.id}`);
} else {
  ev('limpieza: cita de prueba cancelada en la agenda', false, 'no localizada');
}

console.log('');
for (const l of evidencias) console.log(l);
const fallos = evidencias.filter(l => l.startsWith('FALLO')).length;
console.log(`RESUMEN QA6: ${evidencias.length - fallos}/${evidencias.length} en verde`);
chrome.kill();
process.exit(fallos ? 1 : 0);
