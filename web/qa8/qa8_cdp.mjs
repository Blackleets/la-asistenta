// QA8 · RECONSTRUCCIÓN v4 contra la ESPEC_REFERENCIA (§4 cobertura y §5
// lista de cotejo), a 412x915 por CDP. Cotejo rasgo a rasgo por pantalla
// con equivalente nuestro: P1 inicio (buscador radio 16 con botón dentro,
// pastillas ≈88 dp, carrusel «Recomendado» al ~80 % con asomo) · P4 salón
// (hero con flotantes, filas con botón circular +/✓, barra fija con
// contador y TOTAL) · paso 1 con selección múltiple · P7 día/hora
// (calendario de MES navegable + horas como LISTA con radios) · P8
// revisión (objeto cerrado: línea por servicio + TOTAL + aviso) · P9
// confirmación con «Añadir al calendario» (.ics real: se descarga y se
// verifica su CONTENIDO) y página del enlace mágico con su .ics.
// Recorrido real completo: PACK de 2 servicios (Diseño 18 €/25 min +
// Lamination 45 €/65 min = 63 €/90 min) → la cita existe en la agenda con
// los totales sumados y los componentes en notas → limpieza: CANCELADA.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const TOK = { 'X-API-Token': 'la-asistenta-dev' };
const OUT = '/data/la-asistenta/web/qa8';
const DL = '/tmp/qa8-dl';
const FECHA_PACK = '2026-11-06'; // viernes; las baterías lo dejan libre
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

mkdirSync(OUT, { recursive: true });
if (existsSync(DL)) rmSync(DL, { recursive: true });
mkdirSync(DL, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9348', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9348/json/version');
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
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
await S('Page.enable');
await S('Runtime.enable');
await S('Network.enable');
await S('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
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
async function esperarDescarga(n) {
  for (let i = 0; i < 24; i++) {
    const fs = readdirSync(DL).filter(f => f.endsWith('.ics'));
    if (fs.length >= n) return fs;
    await sleep(500);
  }
  return readdirSync(DL).filter(f => f.endsWith('.ics'));
}

let citaPack = null;
try {

/* ---------- A · P1 inicio: cotejo §5 ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(3500);
const ini = await evalJs(`(async () => {
  const y = sel => { const e = document.querySelector(sel);
    return e ? e.getBoundingClientRect().top + window.scrollY : -1; };
  const pastillas = [...document.querySelectorAll('#pastillas .pastilla')];
  const xs = new Set(pastillas.slice(0, 4).map(p => Math.round(p.getBoundingClientRect().left)));
  const ys = new Set(pastillas.map(p => Math.round(p.getBoundingClientRect().top)));
  const busc = document.querySelector('.buscador');
  const btnB = document.querySelector('.buscador-btn');
  const ico = pastillas[1].querySelector('.p-ico');
  const cards = [...document.querySelectorAll('#carrusel-reco > *')];
  const salon = document.querySelector('#carrusel-reco .salon-card');
  const r0 = cards[0] ? cards[0].getBoundingClientRect() : null;
  const r1 = cards[1] ? cards[1].getBoundingClientRect() : null;
  return {
    orden: [y('.fila-salon'), y('.buscador'), y('#pastillas'), y('#carrusel-reco')],
    buscadorH: busc.getBoundingClientRect().height,
    buscadorRadio: getComputedStyle(busc).borderRadius,
    btnDentro: (() => { const a = busc.getBoundingClientRect(), b = btnB.getBoundingClientRect();
      return b.left >= a.left && b.right <= a.right + 1 && b.top >= a.top && b.bottom <= a.bottom + 1; })(),
    btnBg: getComputedStyle(btnB).backgroundColor,
    btnH: btnB.getBoundingClientRect().height,
    nPastillas: pastillas.length, cols: xs.size, filas: ys.size,
    icoW: ico.getBoundingClientRect().width,
    icoRadio: getComputedStyle(ico).borderRadius,
    icoBg: getComputedStyle(ico).backgroundColor,
    txtSize: getComputedStyle(pastillas[1].querySelector('.p-txt')).fontSize,
    nCards: cards.length,
    cardPct: r0 ? Math.round(1000 * r0.width / window.innerWidth) / 10 : 0,
    asomo: r1 ? (r1.left < window.innerWidth && r1.left > 0) : false,
    salonFoto: salon ? (salon.querySelector('img').complete && salon.querySelector('img').naturalWidth > 0) : false,
    chips: salon ? [...salon.querySelectorAll('.chip-dato')].map(c => c.textContent.trim()) : [],
    reco: document.querySelectorAll('#carrusel-reco .reco-card').length,
    navBtns: [...document.querySelectorAll('.barra-nav .nav-btn')].map(b => b.textContent.trim()),
    swV6: await fetch('/sw.js').then(r => r.text()).then(t => t.includes('la-asistenta-shell-v6')),
  };
})()`);
ev('P1 orden: fila del salón → buscador → pastillas → carrusel «Recomendado»',
   ini.orden.every((v, i) => v >= 0 && (i === 0 || v > ini.orden[i - 1])), ini.orden.join(' < '));
ev('P1 buscador: contenedor radio 16 con el botón negro DENTRO y alto ≈72–88',
   ini.buscadorRadio === '16px' && ini.btnDentro && ini.btnBg === 'rgb(37, 37, 51)' &&
   ini.buscadorH >= 70 && ini.buscadorH <= 90 && ini.btnH >= 52,
   `radio=${ini.buscadorRadio} alto=${Math.round(ini.buscadorH)} btn=${ini.btnBg}/${Math.round(ini.btnH)}px`);
ev('P1 pastillas: 8 en rejilla 4×2, caja ≈88 dp, radio 16, etiqueta 13 px',
   ini.nPastillas === 8 && ini.cols === 4 && ini.filas === 2 &&
   ini.icoW >= 78 && ini.icoW <= 94 && ini.icoRadio === '16px' && ini.txtSize === '13px',
   `n=${ini.nPastillas} caja=${Math.round(ini.icoW)} radio=${ini.icoRadio} txt=${ini.txtSize} fondo=${ini.icoBg} (gris cálido de marca)`);
ev('P1 carrusel: tarjeta al ~80 % del ancho con asomo de la siguiente',
   ini.cardPct >= 76 && ini.cardPct <= 86 && ini.asomo,
   `ancho=${ini.cardPct}% tarjetas=${ini.nCards}`);
ev('P1 recomendado: salón primero con foto real y chips de hechos + 3 de servicios',
   ini.salonFoto && ini.reco === 3 &&
   ini.chips.some(t => t.includes('L–V 10–20')) && ini.chips.some(t => t === '4 servicios'),
   JSON.stringify(ini.chips));
ev('P1 nav inferior de 4 (Inicio · Buscar · Reservar · Mi cita)',
   ini.navBtns.length === 4 && ini.navBtns[1].startsWith('Buscar') && ini.navBtns[3].startsWith('Mi cita'),
   ini.navBtns.join(' · '));
ev('PWA: el cascarón nuevo es la shell v6', ini.swV6 === true);
await shot('qa8-01-inicio');
await sinDesborde('inicio');

/* buscador: el filtro actúa también sobre las tarjetas del carrusel */
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = 'henna'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);
const filtro = await evalJs(`(() => ({
  salonVisible: document.querySelector('#carrusel-reco .salon-card').style.display !== 'none',
  recoVisibles: [...document.querySelectorAll('#carrusel-reco .reco-card')]
    .filter(c => c.style.display !== 'none').length,
}))()`);
ev('P1 buscador real: «henna» deja solo la tarjeta de Ombré en el carrusel',
   !filtro.salonVisible && filtro.recoVisibles === 1, JSON.stringify(filtro));
await evalJs(`(() => { const i = document.querySelector('#inp-buscar');
  i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);

/* ---------- B · P4 salón: filas con +/✓ y barra con TOTAL ---------- */
await click('#btn-ir-salon'); await sleep(900);
const salon0 = await evalJs(`(() => ({
  flotantes: document.querySelectorAll('.salon-hero .hero-flot').length,
  flotRadio: getComputedStyle(document.querySelector('.salon-hero .hero-flot')).borderRadius,
  filas: document.querySelectorAll('#salon-servicios .fila-servicio').length,
  adds: [...document.querySelectorAll('#salon-servicios .fs-add')].map(a =>
    Math.round(a.getBoundingClientRect().width)),
  titulo: getComputedStyle(document.querySelector('.salon-titulo')).fontSize,
}))()`);
ev('P4 hero con 2 botones flotantes circulares (volver y compartir) sobre la foto',
   salon0.flotantes === 2, `n=${salon0.flotantes}`);
ev('P4 nombre del salón en 28 px (header.l de la espec)',
   salon0.titulo === '28px', salon0.titulo);
ev('P4 4 filas de servicio con botón circular de añadir de 44 px',
   salon0.filas === 4 && salon0.adds.every(w => w >= 42 && w <= 46),
   `filas=${salon0.filas} adds=${salon0.adds.join(',')}`);
await scrollA('#salon-servicios');
/* La carta deja «Diseño de cejas» preseleccionado: el primer toque sobre
   su fila lo QUITA (alternar de verdad) y la barra se esconde; luego se
   añaden los dos servicios del pack, de uno en uno. */
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"]').click()`);
await sleep(300);
const salonOff = await evalJs(`(() => ({
  sel: document.querySelectorAll('#salon-servicios .fila-servicio.sel').length,
  barra: document.querySelector('#salon-barra').classList.contains('visible'),
}))()`);
ev('P4 alternar: tocar un servicio elegido lo quita y la barra se esconde',
   salonOff.sel === 0 && !salonOff.barra, JSON.stringify(salonOff));
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"]').click()`);
await sleep(300);
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Brow Lamination"]').click()`);
await sleep(400);
const salon1 = await evalJs(`(() => ({
  sel: [...document.querySelectorAll('#salon-servicios .fila-servicio.sel')].map(f => f.dataset.servicio),
  barraVisible: document.querySelector('#salon-barra').classList.contains('visible'),
  sbN: document.querySelector('#sb-n').textContent,
  sbDetalle: document.querySelector('#sb-detalle').textContent,
  btnTxt: document.querySelector('#btn-salon-reservar').textContent,
  btnBg: getComputedStyle(document.querySelector('#btn-salon-reservar')).backgroundColor,
}))()`);
ev('P4 selección múltiple desde las filas: 2 servicios marcados',
   salon1.sel.length === 2 && salon1.sel.includes('Diseño de cejas') && salon1.sel.includes('Brow Lamination'),
   salon1.sel.join(' + '));
ev('P4 barra inferior fija visible con contador, TOTAL sumado y CTA negro «Reservar ahora»',
   salon1.barraVisible && salon1.sbN === '2 servicios' &&
   salon1.sbDetalle.includes('63 €') && salon1.sbDetalle.includes('90 min') &&
   salon1.btnTxt === 'Reservar ahora' && salon1.btnBg === 'rgb(37, 37, 51)',
   `${salon1.sbN} · ${salon1.sbDetalle}`);
await shot('qa8-02-salon-pack');
await sinDesborde('salón con pack');

/* ---------- C · P7 día y hora: mes navegable + lista con radios ---------- */
await click('#btn-salon-reservar'); await sleep(900);
const paso2a = await evalJs(`(() => ({
  pantalla: document.querySelector('#p-reserva').classList.contains('activa'),
  paso: document.querySelector('#paso-2').classList.contains('activo'),
  mes: document.querySelector('#cal-mes').textContent,
  nDias: document.querySelectorAll('#cal-rejilla .cal-dia:not(.vacio)').length,
  antOff: document.querySelector('#cal-ant').disabled,
}))()`);
ev('P4→reserva: el CTA de la barra entra en el paso 2 con el calendario del mes actual',
   paso2a.pantalla && paso2a.paso && /2026/.test(paso2a.mes) && paso2a.nDias >= 28 && paso2a.antOff,
   `mes=${paso2a.mes} dias=${paso2a.nDias} antOff=${paso2a.antOff}`);
await evalJs(`document.querySelector('#cal-sig').click()`);
await sleep(400);
const mesSig = await evalJs(`document.querySelector('#cal-mes').textContent`);
ev('P7 calendario navegable: «siguiente» pasa a noviembre de 2026',
   mesSig.toLowerCase().includes('noviembre'), mesSig);
const cal = await evalJs(`(() => {
  const cel = iso => document.querySelector('.cal-dia[data-fecha="' + iso + '"]');
  const dom = cel('2026-11-08'), pasado = cel('2026-11-02'), pack = cel('${FECHA_PACK}');
  const hoy = new Date(); const isoHoy = hoy.toISOString().slice(0, 10);
  return {
    domingoOff: dom ? dom.disabled : null,
    packExiste: !!pack, packOff: pack ? pack.disabled : null,
    selBg: pack ? getComputedStyle(pack).backgroundColor : '',
  };
})()`);
ev('P7 domingo deshabilitado (cerrado) y el viernes del pack elegible',
   cal.domingoOff === true && cal.packExiste && cal.packOff === false,
   `domingoOff=${cal.domingoOff} packOff=${cal.packOff}`);
await evalJs(`document.querySelector('.cal-dia[data-fecha="${FECHA_PACK}"]').click()`);
await sleep(1500);
const cal2 = await evalJs(`(() => {
  const pack = document.querySelector('.cal-dia[data-fecha="${FECHA_PACK}"]');
  return {
    fecha: document.querySelector('#inp-fecha').value,
    sel: pack.classList.contains('sel'),
    selBg: getComputedStyle(pack).backgroundColor,
  };
})()`);
ev('P7 día elegido: círculo relleno (lavanda de marca, adaptación del violeta de la espec)',
   cal2.fecha === FECHA_PACK && cal2.sel && cal2.selBg === 'rgb(197, 180, 242)',
   `fecha=${cal2.fecha} bg=${cal2.selBg}`);
await shot('qa8-03-calendario');
const horas = await evalJs(`(() => {
  const filas = [...document.querySelectorAll('#huecos .hora-fila')];
  return {
    n: filas.length,
    conRadio: filas.every(f => !!f.querySelector('.hf-radio')),
    alturaMin: filas.length ? Math.min(...filas.filter(f => f.style.display !== 'none')
      .map(f => f.getBoundingClientRect().height)) : 0,
    visibles: filas.filter(f => f.style.display !== 'none').length,
    masTxt: document.querySelector('#btn-mas-huecos')?.textContent || '',
    horas: filas.map(f => f.dataset.hora),
  };
})()`);
ev('P7 horas como LISTA con radios (no píldoras): filas ≥48 px, todas con radio',
   horas.n >= 20 && horas.conRadio && horas.alturaMin >= 48,
   `n=${horas.n} min=${Math.round(horas.alturaMin)}px`);
ev('P7 «ver más» con contador (no esconde huecos sin decir cuántos)',
   horas.visibles === 8 && /\(\d+ más\)/.test(horas.masTxt),
   `visibles=${horas.visibles} «${horas.masTxt.trim()}»`);
let horaElegida = horas.horas.includes('17:00') ? '17:00'
  : horas.horas.filter(h => h >= '16:00').pop() || horas.horas[horas.horas.length - 1];
await evalJs(`document.querySelector('#btn-mas-huecos')?.click()`);
await sleep(300);
await evalJs(`document.querySelector('.hora-fila[data-hora="${horaElegida}"]').scrollIntoView({block:'center'})`);
await sleep(300);
await evalJs(`document.querySelector('.hora-fila[data-hora="${horaElegida}"]').click()`);
await sleep(400);
const horaSel = await evalJs(`(() => ({
  sel: document.querySelector('.hora-fila[data-hora="${horaElegida}"]').classList.contains('sel'),
  radioBorde: getComputedStyle(document.querySelector('.hora-fila[data-hora="${horaElegida}"] .hf-radio')).borderColor,
  btnSig: !document.querySelector('#btn-paso2-siguiente').disabled,
  rm: document.querySelector('#rm-precio').textContent,
}))()`);
ev('P7 hora elegida: fila seleccionada con radio activo y resumen con el total del pack',
   horaSel.sel && horaSel.btnSig && horaSel.rm === '63 €',
   `hora=${horaElegida} rm=${horaSel.rm}`);
await shot('qa8-04-horas');
await sinDesborde('paso 2');

/* ---------- D · P8 revisión: objeto cerrado con TOTAL ---------- */
await click('#btn-paso2-siguiente'); await sleep(700);
const paso3 = await evalJs(`(() => ({
  lineas: [...document.querySelectorAll('#tc-lineas .tc-linea')].map(l => l.textContent.replace(/\\s+/g, ' ').trim()),
  total: document.querySelector('#tc-total').textContent,
  dur: document.querySelector('#tc-duracion').textContent,
  fecha: document.querySelector('#tc-fecha').textContent,
  hora: document.querySelector('#tc-hora').textContent,
  aviso: document.body.textContent.includes('sin coste'),
  notas: !!document.querySelector('#inp-notas'),
}))()`);
ev('P8 objeto cerrado en una tarjeta: línea por servicio con precio y duración',
   paso3.lineas.length === 2 &&
   paso3.lineas.some(l => l.includes('Diseño de cejas') && l.includes('18 €')) &&
   paso3.lineas.some(l => l.includes('Brow Lamination') && l.includes('45 €')),
   paso3.lineas.join(' | '));
ev('P8 TOTAL único y visible (63 €) y duración total (90 min) antes de confirmar',
   paso3.total === '63 €' && paso3.dur === '90 min' && paso3.hora === horaElegida,
   `total=${paso3.total} dur=${paso3.dur} ${paso3.fecha} ${paso3.hora}`);
ev('P8 aviso de cambio/cancelación visible y campo de notas opcional',
   paso3.aviso && paso3.notas);
await evalJs(`(() => { const n = document.querySelector('#inp-nombre');
  n.value = 'PRUEBA QA8 PACK'; n.dispatchEvent(new Event('input', { bubbles: true }));
  const c = document.querySelector('#check-confirma');
  c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(300);
await shot('qa8-05-paso3-pack');
const btnOk = await evalJs(`!document.querySelector('#btn-confirmar').disabled`);
ev('P8 un solo botón de confirmar, activo con nombre + confirmación', btnOk);

/* ---------- E · confirmación + .ics real ---------- */
await click('#btn-confirmar');
await sleep(2500);
const conf = await evalJs(`(() => ({
  pantalla: document.querySelector('#p-confirmada').classList.contains('activa'),
  codigo: document.querySelector('#conf-codigo').textContent,
  detalle: document.querySelector('#conf-detalle').textContent.replace(/\\s+/g, ' ').trim(),
  icsVisible: document.querySelector('#btn-ics').style.display === 'flex',
  guardada: (() => { try { return JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || 'null'); }
    catch { return null; } })(),
}))()`);
ev('P9 confirmación: pantalla de confirmada con código AS-XXXX tras verificar en servidor',
   conf.pantalla && /^AS-/.test(conf.codigo), `${conf.codigo} · ${conf.detalle}`);
ev('P9 la confirmación nombra el pack y su total (63 €)',
   conf.detalle.includes('Diseño de cejas + Brow Lamination') && conf.detalle.includes('63 €'),
   conf.detalle);
ev('P9 botón «Añadir al calendario» visible en la confirmación', conf.icsVisible);
await shot('qa8-06-confirmada');
citaPack = conf.guardada;
if (!citaPack?.enlace) throw new Error('sin enlace mágico guardado: no se puede seguir');

/* la cita, tal cual quedó en la AGENDA (la verdad) */
const rAgenda = await fetch(`${AGENDA}/citas?fecha=${FECHA_PACK}`, { headers: TOK });
const dAgenda = await rAgenda.json();
const enAgenda = (dAgenda.citas || []).find(c => c.codigo === conf.codigo);
ev('P9 la cita existe en la agenda con duración y precio SUMADOS (90 min · 63,0 €)',
   !!enAgenda && enAgenda.duracion_min === 90 && enAgenda.precio_eur === 63 &&
   enAgenda.servicio === 'Diseño de cejas + Brow Lamination' && enAgenda.estado === 'confirmada',
   enAgenda ? `id=${enAgenda.id} dur=${enAgenda.duracion_min} precio=${enAgenda.precio_eur}` : 'no encontrada');
ev('P9 los componentes del pack quedan en las notas de la cita',
   !!enAgenda && (enAgenda.notas || '').includes('Pack:') &&
   (enAgenda.notas || '').includes('Brow Lamination (45 € · 65 min)'),
   (enAgenda?.notas || '').slice(0, 90));

/* .ics de la confirmación: descarga real y contenido */
await click('#btn-ics');
const ics1 = await esperarDescarga(1);
let icsOk = false, icsTxt = '';
if (ics1.length) { icsTxt = readFileSync(`${DL}/${ics1[0]}`, 'utf8'); }
const [hh, mm] = horaElegida.split(':').map(Number);
const finMin = hh * 60 + mm + 90;
const dtFin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}${String(finMin % 60).padStart(2, '0')}00`;
const dtIni = `${horaElegida.replace(':', '')}00`;
icsOk = icsTxt.includes('BEGIN:VCALENDAR') &&
  icsTxt.includes(`DTSTART:20261106T${dtIni}`) &&
  icsTxt.includes(`DTEND:20261106T${dtFin}`) &&
  icsTxt.includes('Ari Vivas Beauty') &&
  icsTxt.includes('Diseño de cejas + Brow Lamination') &&
  icsTxt.includes(conf.codigo);
ev('P9 .ics descargado de la confirmación y su contenido es ESA cita (inicio, fin +90 min, salón, pack y código)',
   icsOk, ics1[0] || 'sin descarga');

/* ---------- F · P9 gestión: la página del enlace mágico y su .ics ---------- */
await S('Page.navigate', { url: citaPack.enlace });
await sleep(2500);
const pag = await evalJs(`(() => ({
  datos: document.querySelector('#cita-datos')?.textContent.replace(/\\s+/g, ' ').trim() || '',
  icsVisible: document.querySelector('#btn-ics-cita').style.display === 'flex',
  estado: document.querySelector('#cita-estado')?.textContent || '',
}))()`);
ev('P9 enlace mágico sin login: la cita del pack se ve entera (nombre, total, 90 min)',
   pag.datos.includes('Diseño de cejas + Brow Lamination') && pag.datos.includes('63 €') &&
   pag.datos.includes('90 min'), pag.datos);
ev('P9 la página del enlace también ofrece «Añadir al calendario»', pag.icsVisible);
await shot('qa8-07-cita-enlace');
/* Chromium sobrescribe el mismo nombre de fichero al descargar el
   segundo .ics (mismo código): la señal de la nueva descarga es el
   mtime, no un segundo fichero. */
const antesIcs = new Map(readdirSync(DL).filter(f => f.endsWith('.ics'))
  .map(f => [f, statSync(`${DL}/${f}`).mtimeMs]));
await click('#btn-ics-cita');
let ics2Ok = false, ics2Detalle = 'sin segunda descarga';
for (let i = 0; i < 24 && !ics2Ok; i++) {
  await sleep(500);
  for (const f of readdirSync(DL).filter(x => x.endsWith('.ics'))) {
    const nuevo = !antesIcs.has(f) || statSync(`${DL}/${f}`).mtimeMs > antesIcs.get(f);
    if (!nuevo) continue;
    const t2 = readFileSync(`${DL}/${f}`, 'utf8');
    ics2Ok = t2.includes(`DTSTART:20261106T${dtIni}`) && t2.includes(conf.codigo) &&
             t2.includes('Diseño de cejas + Brow Lamination');
    ics2Detalle = f + (ics2Ok ? ' (contenido verificado)' : ' (descargado, contenido distinto)');
  }
}
ev('P9 .ics del enlace mágico: mismo inicio y mismo código de cita', ics2Ok, ics2Detalle);

/* ---------- G · paso 1: superficie de selección múltiple ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(3000);
await evalJs(`document.querySelector('#nav-reservar').click()`);
await sleep(800);
const p1 = await evalJs(`(() => ({
  paso1: document.querySelector('#paso-1').classList.contains('activo'),
  selInicial: [...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio),
}))()`);
ev('paso 1: arranca con el primer servicio de la carta preseleccionado',
   p1.paso1 && p1.selInicial.length === 1 && p1.selInicial[0] === 'Diseño de cejas',
   p1.selInicial.join(','));
await evalJs(`document.querySelector('#res-servicios .servicio-card[data-servicio="Brow Lamination"]').click()`);
await sleep(300);
const p1b = await evalJs(`(() => ({
  sel: [...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio),
  rmPrecio: document.querySelector('#rm-precio').textContent,
  rmTxt: document.querySelector('#rm-txt').textContent.replace(/\\s+/g, ' ').trim(),
  sigOn: !document.querySelector('#btn-paso1-siguiente').disabled,
}))()`);
ev('paso 1: tocar añade a la selección y la barra «TU CITA» suma el total (63 €)',
   p1b.sel.length === 2 && p1b.rmPrecio === '63 €' && p1b.sigOn, `${p1b.rmTxt} → ${p1b.rmPrecio}`);
await shot('qa8-08-paso1-pack');
await evalJs(`document.querySelector('#res-servicios .servicio-card[data-servicio="Diseño de cejas"]').click()`);
await evalJs(`document.querySelector('#res-servicios .servicio-card[data-servicio="Brow Lamination"]').click()`);
await sleep(300);
const p1c = await evalJs(`(() => ({
  sel: document.querySelectorAll('#res-servicios .servicio-card.sel').length,
  sigOff: document.querySelector('#btn-paso1-siguiente').disabled,
}))()`);
ev('paso 1: sin ningún servicio elegido no se puede continuar',
   p1c.sel === 0 && p1c.sigOff);

/* ---------- limpieza: la cita del pack queda CANCELADA ---------- */
if (enAgenda?.id) {
  const rCan = await fetch(`${AGENDA}/citas/${enAgenda.id}/cancelar`,
    { method: 'POST', headers: { ...TOK, 'Content-Type': 'application/json' }, body: '{}' });
  const dCan = await rCan.json();
  ev('limpieza: la cita del pack queda CANCELADA en la agenda (no borrada)',
     rCan.status === 200 && dCan.cita?.estado === 'cancelada', `id=${enAgenda.id}`);
}

} catch (e) {
  ev('QA8 sin excepciones', false, String(e).slice(0, 240));
} finally {
  console.log('\n' + evidencias.join('\n'));
  const fallos = evidencias.filter(x => x.startsWith('FALLO'));
  console.log(`\nRESUMEN QA8: ${evidencias.length - fallos.length}/${evidencias.length} comprobaciones en verde`);
  try { chrome.kill(); } catch {}
  process.exit(fallos.length ? 1 : 0);
}
