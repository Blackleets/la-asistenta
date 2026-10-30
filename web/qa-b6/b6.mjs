// QA-B6 · MUSA Bloque B6 — wayfinding honesto (29/10/2026)
// Matriz pantalla → pestaña activa verificada en navegación REAL a
// 412x915 contra la máquina, en dos modos:
//   node b6.mjs antes    → producción pre-B6 (SW v24): la «esperada»
//                          de cada fila es el valor MENTIROSO que el
//                          código viejo produce (reserva siempre
//                          Probador, próxima apertura siempre
//                          Inicio, confirmación siempre Perfil):
//                          la fila sale ok si la mentira es
//                          exactamente la diagnosticada.
//   node b6.mjs despues  → tras B6 (SW v25): la «esperada» es la
//                          pestaña del contexto real (la reserva y
//                          la confirmación heredan la del contexto
//                          que lanzó el flujo; la próxima apertura,
//                          la de su origen).
// Incluye UN análisis real (solo en «despues», para el Resultado y
// su reserva) y UNA reserva completa por modo con nombre
// «PRUEBA B6», cancelada al final desde la propia página /cita
// (canal propio; queda cancelada, no borrada).
// El área profesional se verifica igual: pestaña activa, panel
// visible y título por vista deben coincidir en las 4 vistas.
// La clave profesional se lee del fichero del servidor; NUNCA se imprime.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const RAIZ = '/data/la-asistenta/web';
const OUT = `${RAIZ}/qa-b6/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const CLAVE = readFileSync(`${RAIZ}/profesional.env`, 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9366', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b6-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9366/json/version');
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
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
}
async function shotFull(nombre) {
  const { result } = await S('Page.getLayoutMetrics');
  const size = result.cssContentSize || result.contentSize;
  const r = await S('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 },
  });
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};
const activa = id => `document.getElementById('${id}')?.classList.contains('activa')`;

/* ---------- matriz de navegación de la clienta ---------- */
const ESP = MODO === 'antes' ? {
  reservaSalon: 'nav-probador', reservaInicio: 'nav-probador',
  reservaExplorar: 'nav-probador', reservaMicita: 'nav-probador',
  confirmada: 'nav-perfil',
  proximaExplorar: 'nav-inicio', proximaProbador: 'nav-inicio',
} : {
  reservaSalon: 'nav-explorar', reservaInicio: 'nav-inicio',
  reservaExplorar: 'nav-explorar', reservaMicita: 'nav-perfil',
  confirmada: 'nav-probador',
  proximaExplorar: 'nav-explorar', proximaProbador: 'nav-probador',
};
const matriz = [];
async function comprobar(clave, esperada, nota) {
  await sleep(350);
  const n = await evalJs(`(() => {
    const pantalla = document.querySelector('.pantalla.activa')?.id || null;
    const on = [...document.querySelectorAll('.nav-btn.on')].map(b => b.id);
    return { pantalla, on };
  })()`);
  const ok = n.on.length === 1 && n.on[0] === esperada;
  matriz.push({ clave, pantalla: n.pantalla, esperada,
                real: n.on.join('+') || 'ninguna', ok, nota });
  return ok;
}
async function completarReserva() {
  if (await evalJs(`document.getElementById('paso-1')?.classList.contains('activo')`)) {
    await esperar(`!document.getElementById('btn-paso1-siguiente').disabled`, 8000);
    await clic('#btn-paso1-siguiente');
    await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
  }
  await esperar(`document.querySelectorAll('.hora-fila').length > 0`, 25000);
  await clic('.hora-fila');
  await esperar(`!document.getElementById('btn-paso2-siguiente').disabled`, 8000);
  await clic('#btn-paso2-siguiente');
  await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 8000);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    n.value = 'PRUEBA B6'; n.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await clic('#check-confirma');
  await esperar(`!document.getElementById('btn-confirmar').disabled`, 8000);
  await clic('#btn-confirmar');
  return esperar(`document.getElementById('p-confirmada').classList.contains('activa')
    && document.getElementById('conf-codigo')?.textContent.trim().length > 0`, 30000);
}
async function cancelarCitaDePrueba(informe) {
  const hrefCita = await evalJs(`document.getElementById('conf-ver-cita')?.href || ''`);
  informe.hrefCita = hrefCita ? hrefCita.replace(/\/cita\/[A-Za-z0-9_-]+/, '/cita/<token>') : '';
  if (hrefCita && hrefCita.includes('/cita/')) {
    await S('Page.navigate', { url: hrefCita });
    await esperar(`document.querySelector('.tarjeta h2') || document.querySelector('.error-caja')`, 15000);
    await sleep(600);
    await shot('cita');
    await clic('#btn-cancelar'); await sleep(500);
    await clic('#btn-cancelar-si');
    informe.citaPruebaCancelada = !!(await esperar(`/cancelada/i.test(document.body.textContent)`, 15000));
    await S('Page.navigate', { url: WEB + '/' });
    await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
    await sleep(700);
  } else {
    informe.citaPruebaCancelada = false;
    informe.avisoCita = 'sin enlace en la confirmación';
  }
}

const informe = { modo: MODO, erroresConsola, matriz };

/* ---------- clienta: recorrido de contextos ---------- */
await S('Page.navigate', { url: WEB + '/' });
await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
await sleep(900);
await comprobar('inicio', 'nav-inicio', 'Inicio');
await shot('inicio');

await clic('#nav-explorar');
await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
await comprobar('explorar', 'nav-explorar', 'Explorar');

await esperar(`!!document.querySelector('.chip-cat[data-modulo="gafas_accesorios"]')`, 15000);
await clic('.chip-cat[data-modulo="gafas_accesorios"]');
await esperar(activa('p-proxima'), 8000);
await comprobar('proxima-desde-explorar', ESP.proximaExplorar,
  'Próxima apertura (Gafas) abierta desde Explorar');
await shot('proxima-desde-explorar');
await clic('#btn-proxima-volver');
await esperar(activa('p-explorar'), 8000);
await comprobar('explorar-tras-proxima', 'nav-explorar', 'Volver de la próxima apertura regresa a Explorar');

await clic('#nav-inicio'); await sleep(600);
await clic('.fila-salon-home');
await esperar(activa('p-salon'), 8000);
await comprobar('salon', 'nav-explorar', 'El salón (su contexto declarado es Explorar)');
await shot('salon');

await clic('#btn-salon-reservar');
await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
await comprobar('reserva-desde-salon', ESP.reservaSalon, 'Reserva lanzada desde el Salón');
await shot('reserva-desde-salon');

await clic('#nav-inicio'); await sleep(600);
await clic('#pastilla-reservar');
await esperar(`document.getElementById('paso-1')?.classList.contains('activo')`, 8000);
await comprobar('reserva-desde-inicio', ESP.reservaInicio, 'Reserva lanzada desde Inicio');
await shot('reserva-desde-inicio');

await clic('#nav-explorar');
await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
await sleep(400);
await clic('.prod-card [data-acc="reservar"]');
await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
await comprobar('reserva-desde-explorar', ESP.reservaExplorar, 'Reserva lanzada desde Explorar');
await shot('reserva-desde-explorar');
await clic('#nav-probador'); await sleep(600);

await comprobar('probador', 'nav-probador', 'Hub del Probador');
await clic('#btn-prob-moda');
await esperar(activa('p-proxima'), 8000);
await comprobar('proxima-desde-probador', ESP.proximaProbador,
  'Próxima apertura (Moda) abierta desde el Probador');
await shot('proxima-desde-probador');
await clic('#btn-proxima-volver');
await esperar(activa('p-probador'), 8000);

await clic('#btn-prob-cejas'); await sleep(600);
await comprobar('consentimiento', 'nav-probador', 'Consentimiento: recorrido del Probador');
await clic('#btn-sin-foto');
await esperar(activa('p-reserva'), 8000);
await comprobar('reserva-desde-probador', 'nav-probador',
  'Reserva sin foto lanzada desde el consentimiento (recorrido del Probador: aquí «Probador» es verdad)');
await shot('reserva-desde-probador');
await clic('#nav-perfil'); await sleep(600);

await comprobar('perfil', 'nav-perfil', 'Perfil');
await clic('#btn-perfil-micita');
await esperar(activa('p-micita'), 8000);
await comprobar('micita', 'nav-perfil', 'Mi cita vive en Perfil');
await clic('#btn-micita-reservar');
await esperar(activa('p-reserva'), 8000);
await comprobar('reserva-desde-micita', ESP.reservaMicita, 'Reserva lanzada desde Mi cita');
await shot('reserva-desde-micita');

await clic('#nav-inicio'); await sleep(600);
await esperar(`!!document.querySelector('#estanteria-modulos .mod-card[data-modulo="moda_probador"]')`, 20000);
await clic('#estanteria-modulos .mod-card[data-modulo="moda_probador"]');
await esperar(activa('p-proxima'), 8000);
await comprobar('proxima-desde-inicio', 'nav-inicio',
  'Próxima apertura (Moda) abierta desde Inicio: Inicio es aquí el origen real');
await shot('proxima-desde-inicio');
await clic('#btn-proxima-volver');
await esperar(activa('p-inicio'), 8000);

if (MODO === 'despues') {
  /* ---------- recorrido del análisis: análisis REAL ---------- */
  await clic('#nav-probador'); await sleep(600);
  await clic('#btn-prob-cejas'); await sleep(600);
  await clic('#check-consentimiento'); await sleep(300);
  await clic('#btn-ir-foto'); await sleep(600);
  await comprobar('foto', 'nav-probador', 'Foto: recorrido del Probador');
  await clic('#btn-foto-ejemplo');
  await esperar(`!!document.getElementById('img-previa')?.getAttribute('src')`, 12000);
  await sleep(400);
  const t0 = Date.now();
  await clic('#btn-analizar');
  const listo = await esperar(activa('p-resultado'), 300000);
  informe.latencia = Math.round((Date.now() - t0) / 100) / 10;
  informe.resultadoListo = !!listo;
  if (!listo) {
    writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 2));
    console.log('B6 despues · SIN RESULTADO tras', informe.latencia, 's');
    try { ws.close(); } catch {}
    chrome.kill();
    process.exit(1);
  }
  await sleep(1000);
  await comprobar('resultado', 'nav-probador', 'Resultado: recorrido del Probador');
  await evalJs(`window.scrollTo(0, 0)`); await sleep(250);
  await shotFull('resultado');
  await clic('#btn-reservar-reco');
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
  await comprobar('reserva-desde-resultado', 'nav-probador',
    'Reserva lanzada desde el Resultado: Probador es el contexto real');
  await shot('reserva-desde-resultado');
  informe.confirmada = !!(await completarReserva());
  await comprobar('confirmada', ESP.confirmada,
    'La confirmación hereda la pestaña del flujo de reserva (Resultado → Probador)');
  await sleep(900);
  await evalJs(`window.scrollTo(0, 0)`); await sleep(200);
  await shot('confirmada');
  informe.codigo = await evalJs(`document.getElementById('conf-codigo')?.textContent.trim() || ''`);
  await cancelarCitaDePrueba(informe);
} else {
  /* ---------- «antes»: la confirmación miente a Perfil ---------- */
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await sleep(400);
  await clic('.prod-card [data-acc="reservar"]');
  await esperar(`document.getElementById('paso-2')?.classList.contains('activo')`, 8000);
  informe.confirmada = !!(await completarReserva());
  await comprobar('confirmada', ESP.confirmada,
    'Confirmación de una reserva lanzada desde Explorar');
  await sleep(900);
  await evalJs(`window.scrollTo(0, 0)`); await sleep(200);
  await shot('confirmada');
  informe.codigo = await evalJs(`document.getElementById('conf-codigo')?.textContent.trim() || ''`);
  await cancelarCitaDePrueba(informe);
}

/* ---------- profesional: la pestaña activa coincide con la vista ---------- */
const TITULOS_ESP = {
  hoy: 'Hoy en tu salón', agenda: 'Tu agenda de 7 días',
  espera: 'Por avisar a tus clientas', panel: 'Mi negocio · carta y cifras',
};
const profMatriz = [];
await S('Page.navigate', { url: WEB + '/profesional' });
await esperar(`!!document.querySelector('#clave')`);
await evalJs(`document.querySelector('#clave').value = ${JSON.stringify(CLAVE)};
              document.querySelector('#clave').dispatchEvent(new Event('input', {bubbles:true}))`);
await evalJs(`document.querySelector('#btn-entrar').click()`);
await esperar(`!document.querySelector('#vista-panel').classList.contains('oculto')
               && document.querySelectorAll('#hoy-citas .cita, #hoy-citas .vacio').length > 0`, 20000);
await sleep(600);
for (const tab of ['hoy', 'agenda', 'espera', 'panel']) {
  await clic(`.tab[data-tab="${tab}"]`);
  await sleep(900);
  const st = await evalJs(`(() => {
    const activaEl = document.querySelector('.tab.activa');
    return {
      activa: activaEl?.dataset.tab || null,
      nActivas: document.querySelectorAll('.tab.activa').length,
      visible: ['hoy','agenda','espera','panel']
        .filter(t => !document.getElementById('tab-' + t).classList.contains('oculto')),
      titulo: document.getElementById('panel-titulo')?.textContent || '',
    };
  })()`);
  const ok = st.activa === tab && st.nActivas === 1
    && st.visible.length === 1 && st.visible[0] === tab
    && st.titulo === TITULOS_ESP[tab];
  profMatriz.push({ tab, ...st, esperadaTitulo: TITULOS_ESP[tab], ok });
  if (tab === 'hoy') await shot('profesional-hoy');
  if (tab === 'agenda') await shot('profesional-agenda');
}
informe.profMatriz = profMatriz;
informe.veredicto = matriz.every(f => f.ok) && profMatriz.every(f => f.ok)
  && erroresConsola.length === 0;

writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 2));
console.log(JSON.stringify({
  modo: MODO, veredicto: informe.veredicto,
  matrizOk: matriz.filter(f => f.ok).length + '/' + matriz.length,
  profOk: profMatriz.filter(f => f.ok).length + '/' + profMatriz.length,
  erroresConsola: erroresConsola.length,
  latencia: informe.latencia, codigo: informe.codigo,
  citaPruebaCancelada: informe.citaPruebaCancelada,
}, null, 1));
try { ws.close(); } catch {}
chrome.kill();
process.exit(informe.veredicto ? 0 : 1);
