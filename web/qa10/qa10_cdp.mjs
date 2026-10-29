// QA10 · ANATOMÍA EXACTA DE LA REFERENCIA (v6) a 412x915 conduciendo
// Chromium por CDP. Lee comparó la captura real de la app de Fresha de
// su móvil (referencia/01-home.png) con nuestra home y NO era la misma
// app: esta QA cierra, elemento a elemento y con MEDIDAS, las 6
// diferencias del encargo — (1) sin barra de marca y fila ligera con
// pin violeta relleno en peso normal, (2) buscador PÍLDORA radio 999
// con placeholder en DOS líneas que no se corta, (3) pastillas =
// categorías de marketplace uniformes #f5f5f5 con etiquetas en peso
// normal y comportamiento honesto, (4) «Recomendado» sin subtítulo y
// tarjetas FOTO A SANGRE COMPLETA con pastilla de cristal de HECHOS,
// (5) nav Inicio·Buscar·Historial·Perfil con Perfil real y funcional,
// (6) aire y pesos. Recorrido completo con reserva real de PACK que
// queda CANCELADA en la limpieza.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const TOK = { 'X-API-Token': 'la-asistenta-dev' };
const OUT = '/data/la-asistenta/web/qa10';
const FECHA_PACK = '2026-11-06'; // viernes; las baterías lo dejan libre
const VIOLETA = 'rgb(105, 80, 243)';       // #6950f3
const PASTILLA = 'rgb(245, 245, 245)';     // #f5f5f5
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidencias = [];
const ev = (nombre, ok, detalle = '') =>
  evidencias.push(`${ok ? 'OK  ' : 'FALLO'} | ${nombre}${detalle ? ' | ' + detalle : ''}`);

mkdirSync(OUT, { recursive: true });

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9350', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9350/json/version');
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

let codigo = null, citaId = null;
try {

/* ---------- arranque limpio: sin cita ni perfil en el dispositivo ---------- */
await S('Page.navigate', { url: WEB + '/' });
await sleep(2500);
await evalJs(`localStorage.clear()`);
await S('Page.reload');
await sleep(3200);

/* ---------- 1 · sin barra de marca; fila ligera del salón ---------- */
const p1 = await evalJs(`(() => {
  const fila = document.querySelector('.fila-salon');
  const pin = document.querySelector('.fs-pin path');
  return {
    topbar: !!document.querySelector('.topbar'),
    filaTop: fila.getBoundingClientRect().top,
    nombrePeso: getComputedStyle(document.querySelector('.fs-nombre')).fontWeight,
    nombreTxt: document.querySelector('.fs-nombre').textContent.trim(),
    pinFill: pin ? getComputedStyle(pin).fill : null,
    chev: !!document.querySelector('.fs-chev'),
  };
})()`);
ev('1 · NO hay barra de marca (.topbar eliminada del DOM)', !p1.topbar);
ev('1 · la home ARRANCA con la fila del salón (es lo primero, arriba del todo)',
   p1.filaTop >= 0 && p1.filaTop < 60, `top=${Math.round(p1.filaTop)}px`);
ev('1 · fila ligera: pin VIOLETA RELLENO + «Ari Vivas Beauty» en peso NORMAL + chevron',
   p1.pinFill === VIOLETA && p1.nombrePeso === '400' && p1.chev && p1.nombreTxt === 'Ari Vivas Beauty',
   `pin=${p1.pinFill} peso=${p1.nombrePeso}`);

/* ---------- 2 · buscador píldora de verdad ---------- */
const p2 = await evalJs(`(() => {
  const b = document.querySelector('.buscador');
  const t = document.querySelector('#inp-buscar');
  const btn = document.querySelector('.buscador-btn');
  const lh = parseFloat(getComputedStyle(t).lineHeight);
  return {
    radio: getComputedStyle(b).borderBottomLeftRadius,
    tag: t.tagName,
    ph: t.placeholder,
    alto: t.offsetHeight,
    lineas: lh ? (t.offsetHeight - 12) / lh : 0,
    solape: t.getBoundingClientRect().right - btn.getBoundingClientRect().left,
    btnRadio: getComputedStyle(btn).borderBottomLeftRadius,
  };
})()`);
ev('2 · buscador PÍLDORA: radio 999 en el contenedor y en el botón negro',
   p2.radio === '999px' && p2.btnRadio === '999px', `radio=${p2.radio}/${p2.btnRadio}`);
ev('2 · el campo es TEXTAREA: el placeholder «Buscar todos los servicios» se envuelve en DOS líneas',
   p2.tag === 'TEXTAREA' && p2.ph === 'Buscar todos los servicios' && p2.lineas >= 1.9,
   `tag=${p2.tag} alto=${p2.alto}px líneas≈${p2.lineas.toFixed(2)}`);
ev('2 · el texto ya NO queda tapado por el botón (solape ≤ 0)',
   p2.solape <= 0, `solape=${Math.round(p2.solape)}px`);
await evalJs(`(() => { const t = document.querySelector('#inp-buscar');
  t.value = 'henna'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(400);
const filtro = await evalJs(`(() => {
  const vis = sel => [...document.querySelectorAll(sel)]
    .filter(c => c.style.display !== 'none').map(c => c.dataset.busqueda || '');
  return {
    carta: vis('#carta-inicio .servicio-card'),
    carrusel: vis('#carrusel-reco .reco-card, #carrusel-reco .salon-card'),
  };
})()`);
ev('2 · el filtrado real sigue vivo: «henna» deja solo Ombré en carta y carrusel',
   filtro.carta.length === 1 && filtro.carta[0].includes('henna') &&
   filtro.carrusel.length === 1 && filtro.carrusel[0].includes('henna'),
   `carta=${filtro.carta.length} carrusel=${filtro.carrusel.length}`);
await evalJs(`(() => { const t = document.querySelector('#inp-buscar');
  t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(300);
await shot('qa10-01-inicio');
await sinDesborde('inicio v6');

/* ---------- 3 · pastillas = categorías de marketplace ---------- */
const p3 = await evalJs(`(() => {
  const ps = [...document.querySelectorAll('#pastillas .pastilla')];
  return {
    n: ps.length,
    etiquetas: ps.map(p => p.querySelector('.p-txt').textContent.trim()),
    fondos: [...new Set(ps.map(p => getComputedStyle(p.querySelector('.p-ico')).backgroundColor))],
    pesos: [...new Set(ps.map(p => getComputedStyle(p.querySelector('.p-txt')).fontWeight))],
    conSvg: ps.every(p => !!p.querySelector('.p-ico svg')),
  };
})()`);
const ESPERADAS = ['Todo', 'Cabello y peinado', 'Salones de uñas', 'Cejas y pestañas',
  'Maquillaje', 'Tatuajes y piercings', 'Terapia médica', 'Odontología'];
ev('3 · 8 pastillas con las etiquetas EXACTAS de las categorías de la referencia',
   p3.n === 8 && JSON.stringify(p3.etiquetas) === JSON.stringify(ESPERADAS),
   p3.etiquetas.join(' · '));
ev('3 · uniformes #f5f5f5 (fuera el tinte violeta de la primera) e iconos de línea en todas',
   p3.fondos.length === 1 && p3.fondos[0] === PASTILLA && p3.conSvg,
   `fondos=${p3.fondos.join(',')}`);
ev('3 · etiquetas en peso NORMAL (400), como las suyas', p3.pesos.length === 1 && p3.pesos[0] === '400',
   `pesos=${p3.pesos.join(',')}`);
await click('.pastilla[data-nombre="Maquillaje"]'); await sleep(800);
const pronto = await evalJs(`(() => {
  const botones = [...document.querySelectorAll('#p-pronto button')].map(b => b.textContent.trim());
  return {
    activa: document.querySelector('#p-pronto').classList.contains('activa'),
    titulo: document.querySelector('#pronto-titulo').textContent.trim(),
    muyPronto: document.querySelector('#p-pronto').textContent.includes('Muy pronto'),
    estadoReal: document.querySelector('#p-pronto').textContent.includes('estado real'),
    hayAvisame: botones.some(t => /av[ií]same/i.test(t)),
    botones,
  };
})()`);
ev('3 · categoría sin salones → pantalla honesta «Muy pronto» etiquetada como estado real',
   pronto.activa && pronto.titulo === 'Maquillaje' && pronto.muyPronto && pronto.estadoReal,
   `título=${pronto.titulo}`);
ev('3 · PROHIBIDO cumplido: no existe ningún «Avísame» no funcional; solo acciones reales',
   !pronto.hayAvisame, pronto.botones.join(' | '));
await shot('qa10-03-pronto');
await click('#btn-pronto-volver'); await sleep(700);
ev('3 · «Volver al inicio» devuelve a la home',
   await evalJs(`document.querySelector('#p-inicio').classList.contains('activa')`));
await click('.pastilla[data-cat="todo"]'); await sleep(900);
const trasTodo = await evalJs(`document.querySelector('#titulo-recomendado').getBoundingClientRect().top`);
ev('3 · «Todo» baja hasta el Recomendado', trasTodo >= -4 && trasTodo < 320, `top=${Math.round(trasTodo)}px`);
await click('.pastilla[data-cat="cejas"]'); await sleep(900);
const salonTop = await evalJs(`(() => {
  const img = document.querySelector('.salon-hero img');
  const r = img.getBoundingClientRect();
  return {
    activa: document.querySelector('#p-salon').classList.contains('activa'),
    heroIzq: r.left, heroAncho: r.width,
    analisis: !!document.querySelector('#btn-salon-analisis'),
  };
})()`);
ev('3 · «Cejas y pestañas» abre el salón real (su especialidad)',
   salonTop.activa);
ev('7 · cabecera del salón A SANGRE: la foto toca los dos bordes (0 → 412)',
   salonTop.heroIzq === 0 && salonTop.heroAncho === 412,
   `izq=${salonTop.heroIzq} ancho=${salonTop.heroAncho}`);
ev('3 · «Análisis IA» NO desaparece: tarjeta destacada también en el salón',
   salonTop.analisis);
await shot('qa10-04-salon');
await click('#btn-salon-analisis'); await sleep(800);
ev('3 · el análisis desde el salón lleva al consentimiento (recorrido intacto)',
   await evalJs(`document.querySelector('#p-consentimiento').classList.contains('activa')`));
await click('#nav-inicio'); await sleep(700);

/* ---------- 4 · Recomendado sin subtítulo, foto a sangre ---------- */
await scrollA('#titulo-recomendado');
const p4 = await evalJs(`(() => {
  const tit = document.querySelector('#titulo-recomendado');
  const card = document.querySelector('#carrusel-reco .salon-card');
  const reco = document.querySelector('#carrusel-reco .reco-card');
  const wrap = card.querySelector('.foto-wrap');
  const img = wrap.querySelector('img');
  const pill = card.querySelector('.foto-pill');
  const rw = wrap.getBoundingClientRect(), ri = img.getBoundingClientRect();
  const rr = reco.getBoundingClientRect(), rc = card.getBoundingClientRect();
  return {
    siguiente: tit.nextElementSibling?.id,
    titSize: getComputedStyle(tit).fontSize,
    titPeso: getComputedStyle(tit).fontWeight,
    radioCard: getComputedStyle(card).borderTopLeftRadius,
    fotoLlena: Math.abs(rw.width - ri.width) < 1 && Math.abs(rw.height - ri.height) < 1,
    pillTxt: pill?.textContent.trim(),
    pillBlur: getComputedStyle(pill).backdropFilter || getComputedStyle(pill).webkitBackdropFilter,
    nombre: card.querySelector('h3').textContent.trim(),
    lineaGris: card.querySelector('.rc-desc').textContent.trim(),
    chipHorario: card.querySelector('[data-chip="horario"]').textContent,
    anchoPct: rc.width / window.innerWidth,
    asomo: rr.left < window.innerWidth && rr.left > rc.left,
    recoPill: reco.querySelector('.foto-pill')?.textContent.trim(),
    recoLinea: reco.querySelector('.rc-desc').textContent.trim(),
  };
})()`);
ev('4 · «Recomendado» SIN subtítulo: lo siguiente al título es el carrusel',
   p4.siguiente === 'carrusel-reco', `siguiente=${p4.siguiente}`);
ev('4 · título grande en extrabold sans (29px/800)', p4.titSize === '29px' && p4.titPeso === '800',
   `${p4.titSize}/${p4.titPeso}`);
ev('4 · tarjeta FOTO A SANGRE COMPLETA: la foto llena la tarjeta, radio 24',
   p4.fotoLlena && p4.radioCard === '24px', `radio=${p4.radioCard}`);
ev('4 · pastilla de cristal con un HECHO: «Reservas abiertas» (sin estrella ni valoración simulada)',
   p4.pillTxt === 'Reservas abiertas' && /blur/.test(p4.pillBlur || ''),
   `pill=${p4.pillTxt} blur=${p4.pillBlur}`);
ev('4 · bajo la foto: nombre + línea gris «Salón de cejas · análisis con IA» + chips de hechos',
   p4.nombre === 'Ari Vivas Beauty' && p4.lineaGris === 'Salón de cejas · análisis con IA' &&
   p4.chipHorario.includes('L–V'), `horario=${p4.chipHorario}`);
ev('4 · carrusel con asomo ~80 %: la siguiente tarjeta asoma por la derecha',
   p4.anchoPct >= 0.77 && p4.anchoPct <= 0.84 && p4.asomo,
   `ancho=${(p4.anchoPct * 100).toFixed(1)}%`);
ev('4 · tarjeta de servicio foto-completa: pastilla con la duración y nombre/precio abajo',
   /min/.test(p4.recoPill || '') && p4.recoLinea.includes('€'),
   `pill=${p4.recoPill} línea=${p4.recoLinea}`);
await shot('qa10-02-recomendado');
await sinDesborde('recomendado');

/* ---------- 5 · nav exacta + Historial + Perfil real ---------- */
const nav = await evalJs(`(() => {
  const bs = [...document.querySelectorAll('.barra-nav .nav-btn')];
  return {
    etiquetas: bs.map(b => b.textContent.trim()),
    pesos: [...new Set(bs.map(b => getComputedStyle(b).fontWeight))],
  };
})()`);
ev('5 · navegación inferior con etiquetas EXACTAS: Inicio · Buscar · Historial · Perfil',
   JSON.stringify(nav.etiquetas) === JSON.stringify(['Inicio', 'Buscar', 'Historial', 'Perfil']),
   nav.etiquetas.join(' · '));
ev('6 · etiquetas de la nav en peso NORMAL (400), nada de negritas',
   nav.pesos.length === 1 && nav.pesos[0] === '400', `pesos=${nav.pesos.join(',')}`);
await click('#nav-historial'); await sleep(800);
const histVacio = await evalJs(`(() => ({
  activa: document.querySelector('#p-micita').classList.contains('activa'),
  vaciaVisible: document.querySelector('#micita-vacia').style.display !== 'none',
  titulo: document.querySelector('#micita-vacia h2').textContent.trim(),
}))()`);
ev('5 · Historial sin cita: explicación honesta del estado vacío',
   histVacio.activa && histVacio.vaciaVisible && histVacio.titulo === 'Tu historial',
   `título=${histVacio.titulo}`);
await click('#nav-perfil'); await sleep(800);
const perf0 = await evalJs(`(() => ({
  activa: document.querySelector('#p-perfil').classList.contains('activa'),
  horario: document.querySelector('#perfil-horario').textContent,
  privacidad: document.querySelector('#p-perfil').textContent.includes('no se guarda'),
  whatsapp: document.querySelector('#p-perfil a[href^="https://wa.me/"]')?.getAttribute('href'),
}))()`);
ev('5 · Perfil: pantalla nueva con horario real, WhatsApp público y nota de privacidad de fotos',
   perf0.activa && perf0.horario.includes('Lunes a viernes') && perf0.privacidad &&
   perf0.whatsapp === 'https://wa.me/584249134367',
   `horario=${perf0.horario.slice(0, 30)}…`);
await evalJs(`(() => {
  document.querySelector('#perf-nombre').value = 'PRUEBA QA10';
  document.querySelector('#perf-telefono').value = '600123456';
})()`);
await click('#btn-perfil-guardar'); await sleep(400);
const perf1 = await evalJs(`(() => {
  const p = JSON.parse(localStorage.getItem('la-asistenta-perfil-v1') || 'null');
  return { p, estado: document.querySelector('#perfil-estado').textContent };
})()`);
ev('5 · Perfil GUARDA de verdad: nombre y teléfono quedan en el dispositivo (localStorage)',
   perf1.p?.nombre === 'PRUEBA QA10' && perf1.p?.telefono === '600123456' &&
   perf1.estado.includes('Guardado'), JSON.stringify(perf1.p));
await shot('qa10-05-perfil');
await sinDesborde('perfil');

/* ---------- recorrido completo: pack desde el salón ---------- */
await click('#nav-inicio'); await sleep(700);
await click('#btn-ir-salon'); await sleep(900);
await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Brow Lamination"]').click()`);
await sleep(400);
const barra = await evalJs(`(() => ({
  visible: document.querySelector('#salon-barra').classList.contains('visible'),
  n: document.querySelector('#sb-n').textContent,
  detalle: document.querySelector('#sb-detalle').textContent,
}))()`);
ev('recorrido · pack de 2 servicios (Diseño ya venía elegido + Laminación): total 63 € · 90 min',
   barra.visible && barra.detalle.includes('63 €') && barra.detalle.includes('90 min'),
   `${barra.n} / ${barra.detalle}`);
await click('#btn-salon-reservar'); await sleep(900);
await evalJs(`document.querySelector('#cal-sig').click()`);
await sleep(400);
await evalJs(`document.querySelector('.cal-dia[data-fecha="${FECHA_PACK}"]').click()`);
await sleep(1500);
const horas = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].map(f => f.dataset.hora)`);
const horaElegida = horas.includes('17:00') ? '17:00'
  : horas.filter(h => h >= '16:00').pop() || horas[horas.length - 1];
await evalJs(`document.querySelector('#btn-mas-huecos')?.click()`);
await sleep(300);
await evalJs(`document.querySelector('.hora-fila[data-hora="${horaElegida}"]').scrollIntoView({block:'center'})`);
await sleep(300);
await evalJs(`document.querySelector('.hora-fila[data-hora="${horaElegida}"]').click()`);
await sleep(400);
await click('#btn-paso2-siguiente'); await sleep(700);
const paso3 = await evalJs(`(() => ({
  nombre: document.querySelector('#inp-nombre').value,
  telefono: document.querySelector('#inp-telefono').value,
  total: document.querySelector('#tc-total').textContent,
  duracion: document.querySelector('#tc-duracion').textContent,
}))()`);
ev('5 · el paso 3 se RELLENA SOLO con los datos del Perfil (nombre y teléfono)',
   paso3.nombre === 'PRUEBA QA10' && paso3.telefono === '600123456',
   `nombre=${paso3.nombre} tel=${paso3.telefono}`);
ev('recorrido · resumen «Tu cita» del pack: total 63 € y duración sumada 90 min',
   paso3.total.includes('63') && paso3.duracion === '90 min',
   `total=${paso3.total} duración=${paso3.duracion}`);
await shot('qa10-06-paso3-pack');
await evalJs(`(() => { const c = document.querySelector('#check-confirma');
  c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(300);
await click('#btn-confirmar');
await sleep(2500);
const conf = await evalJs(`(() => {
  const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || 'null');
  const p = JSON.parse(localStorage.getItem('la-asistenta-perfil-v1') || 'null');
  return {
    pantalla: document.querySelector('#p-confirmada').classList.contains('activa'),
    codigo: document.querySelector('#conf-codigo').textContent,
    servicio: g?.servicio || '', perfilNombre: p?.nombre || '',
    navOn: document.querySelector('.nav-btn.on')?.textContent.trim(),
  };
})()`);
codigo = conf.codigo;
ev('recorrido · reserva real del PACK confirmada con código AS-XXXX',
   conf.pantalla && /^AS-/.test(codigo), codigo || '');
ev('recorrido · la cita guardada es el pack completo (Diseño + Laminación)',
   conf.servicio.includes('Diseño de cejas') && conf.servicio.includes('Brow Lamination'), conf.servicio);
ev('recorrido · al confirmar, «Historial» queda encendida en la nav (la cita vive ahí)',
   conf.navOn === 'Historial', `activa=${conf.navOn}`);
await shot('qa10-07-confirmada');
await click('#nav-historial'); await sleep(800);
const hist = await evalJs(`(() => ({
  datosVisible: document.querySelector('#micita-datos').style.display !== 'none',
  resumen: document.querySelector('#micita-resumen').textContent,
}))()`);
ev('5 · Historial muestra la cita del pack recién confirmada',
   hist.datosVisible && hist.resumen.includes('Brow Lamination') && hist.resumen.includes(codigo),
   hist.resumen.replace(/\s+/g, ' ').slice(0, 90));
await shot('qa10-08-historial');
await click('#nav-perfil'); await sleep(700);
await click('#btn-perfil-borrar'); await sleep(400);
const borrado = await evalJs(`(() => ({
  perfil: localStorage.getItem('la-asistenta-perfil-v1'),
  cita: localStorage.getItem('la-asistenta-cita-v1'),
  nombre: document.querySelector('#perf-nombre').value,
  estado: document.querySelector('#perfil-estado').textContent,
}))()`);
ev('5 · «Borrar mis datos» FUNCIONA: perfil y cita fuera del dispositivo',
   borrado.perfil === null && borrado.cita === null && borrado.nombre === '' &&
   borrado.estado.includes('borrados'), borrado.estado);
const swTxt = await evalJs(`fetch('/sw.js').then(r => r.text())`);
ev('PWA: el cascarón nuevo es la shell v8', swTxt.includes('la-asistenta-shell-v8'));

/* ---------- limpieza: la cita de prueba queda CANCELADA ---------- */
const rAgenda = await fetch(`${AGENDA}/citas?fecha=${FECHA_PACK}`, { headers: TOK });
const dAgenda = await rAgenda.json();
const enAgenda = (dAgenda.citas || []).find(c => c.codigo === codigo);
citaId = enAgenda?.id || null;
if (citaId) {
  const rCan = await fetch(`${AGENDA}/citas/${citaId}/cancelar`,
    { method: 'POST', headers: { ...TOK, 'Content-Type': 'application/json' }, body: '{}' });
  const dCan = await rCan.json();
  ev('limpieza: la cita de la QA10 queda CANCELADA en la agenda (no borrada)',
     rCan.status === 200 && dCan.cita?.estado === 'cancelada', `id=${citaId}`);
} else {
  ev('limpieza: cita localizada en la agenda', false, `código=${codigo}`);
}

} catch (e) {
  ev('QA10 sin excepciones', false, String(e).slice(0, 240));
} finally {
  console.log('\n' + evidencias.join('\n'));
  const fallos = evidencias.filter(x => x.startsWith('FALLO'));
  console.log(`\nRESUMEN QA10: ${evidencias.length - fallos.length}/${evidencias.length} comprobaciones en verde`);
  try { chrome.kill(); } catch {}
  process.exit(fallos.length ? 1 : 0);
}
