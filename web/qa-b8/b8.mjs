// QA-B8 · MUSA Bloque B8 — ningún error es un callejón (29/10/2026)
// Matriz estado-de-error → salida verificada en navegación REAL a
// 412x915 contra la máquina, en dos modos:
//   node b8.mjs antes    → producción pre-B8 (SW v25): cada fila sale
//                          ok si el CALLEJÓN diagnosticado se reproduce
//                          tal cual (error sin botón de salida, o con
//                          la salida solo insinuada en prosa).
//   node b8.mjs despues  → tras B8 (SW v26): cada fila sale ok si el
//                          error trae su acción de continuación REAL
//                          y la acción FUNCIONA (se pulsa y se
//                          comprueba el efecto).
// Los fallos de servidor (carta, disponibilidad, reservar, vistas del
// panel) se provocan interceptando la petición con el dominio Fetch
// de CDP: la interfaz real recibe un 502 o un corte de red de verdad,
// sin tocar el servidor. El 409 se provoca de verdad: se ocupa el
// hueco por la API entre cargar los huecos y confirmar.
// Datos de prueba: reservas «PRUEBA B8» (canceladas al final desde la
// propia página /cita) y una alta en lista de espera «PRUEBA B8»
// (marcada «descartada» al final por la API profesional).
// La clave profesional se lee del fichero del servidor; NUNCA se imprime.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const MODO = process.argv[2] === 'despues' ? 'despues' : 'antes';
const WEB = 'http://127.0.0.1:8090';
const RAIZ = '/data/la-asistenta/web';
const OUT = `${RAIZ}/qa-b8/${MODO}`;
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erroresConsola = [];

const CLAVE = readFileSync(`${RAIZ}/profesional.env`, 'utf8')
  .split('\n').find(l => l.startsWith('PROFESIONAL_CLAVE=')).split('=', 2)[1].trim();

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9378', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/b8-perfil-' + MODO, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9378/json/version');
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

/* ---------- inyección de fallos (dominio Fetch) ---------- */
const reglas = []; // {contiene, metodo, accion:'fallar'|'responder', status, cuerpo, activa}
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => {
    pendientes.set(id, res);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function alPausar(p, sessionId) {
  const url = p.request.url;
  const regla = reglas.find(r => r.activa && url.includes(r.contiene)
    && (!r.metodo || p.request.method === r.metodo));
  if (!regla) return send('Fetch.continueRequest', { requestId: p.requestId }, sessionId);
  if (regla.accion === 'fallar')
    return send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }, sessionId);
  return send('Fetch.fulfillRequest', {
    requestId: p.requestId, responseCode: regla.status || 502,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(regla.cuerpo || '{"error":"la agenda no responde ahora mismo"}').toString('base64'),
  }, sessionId);
}
function regla(contiene, accion, extra = {}) {
  const r = { contiene, accion, activa: true, ...extra };
  reglas.push(r);
  return r;
}

ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Fetch.requestPaused') alPausar(m.params, m.sessionId);
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error')
    erroresConsola.push(m.params.entry.text || 'error de log');
  if (m.method === 'Runtime.exceptionThrown')
    erroresConsola.push('excepción: ' + (m.params?.exceptionDetails?.text || ''));
});
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable');
await S('Runtime.enable');
await S('Log.enable');
await S('DOM.enable');
await S('Network.enable');
await S('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
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
const visible = sel => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return !!el && el.offsetParent !== null; })()`;
const texto = sel => evalJs(`document.querySelector(${JSON.stringify(sel)})?.textContent || ''`);
const irA = async url => { await S('Page.navigate', { url }); await sleep(400); };
const irAInicio = async () => {
  await irA(WEB + '/');
  await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3
                 || document.querySelector('#carrusel-reco .btn-recargar')`, 30000);
  await sleep(700);
};

const matriz = [];
function fila(clave, ok, nota) {
  matriz.push({ clave, ok: !!ok, nota });
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${clave} — ${nota}`);
}

writeFileSync('/tmp/b8-no-es-foto.txt', 'esto no es una foto, es una prueba de QA-B8\n');

/* ================= MODO ANTES: los callejones, reproducidos ================= */
if (MODO === 'antes') {

  /* A7 · la carta no carga (servidor caído al arrancar) */
  const rServicios = regla('/api/servicios', 'fallar');
  await irA(WEB + '/');
  await esperar(`document.querySelector('#carrusel-reco')?.textContent.includes('no cargaron')`, 20000);
  const a7 = await evalJs(`(() => ({
    texto: document.querySelector('#carrusel-reco')?.textContent || '',
    boton: !!document.querySelector('#carrusel-reco .btn-recargar, #carrusel-reco button'),
  }))()`);
  fila('A7-carta-no-carga', a7.texto.includes('prueba a recargar') && !a7.boton,
    'Antes: «prueba a recargar la página» en prosa, sin ningún botón');
  await shotFull('a7-carta');
  rServicios.activa = false;

  /* A1 · /cita/<token> inventado: el callejón principal */
  await irA(WEB + '/cita/token-inventado-b8-0000000000');
  await esperar(`document.querySelector('#error-general')?.classList.contains('visible')`, 20000);
  await sleep(500);
  const a1 = await evalJs(`(() => {
    const visibles = [...document.querySelectorAll('a, button')]
      .filter(el => el.offsetParent !== null);
    return {
      error: document.querySelector('#error-general')?.textContent || '',
      accionesVisibles: visibles.map(el => el.textContent.trim().slice(0, 30)),
    };
  })()`);
  fila('A1-cita-token-invalido',
    a1.error.includes('no corresponde a ninguna cita') && a1.accionesVisibles.length === 0,
    `Antes: caja de error sin NINGUNA acción visible (${a1.accionesVisibles.length})`);
  await shotFull('a1-cita-error');

  /* A2/A3 · Explorar: sin resultados y módulo sin carta */
  await irAInicio();
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await evalJs(`(() => { const i = document.querySelector('#inp-buscar-exp');
    i.value = 'zzzz'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await esperar(`document.querySelector('#sin-resultados-exp')?.offsetParent !== null`, 8000);
  const a2 = await evalJs(`(() => ({
    texto: document.querySelector('#sin-resultados-exp')?.textContent || '',
    boton: !!document.querySelector('#btn-ver-todos-exp'),
  }))()`);
  fila('A2-explorar-sin-resultados',
    a2.texto.includes('Ningún producto coincide') && !a2.boton,
    'Antes: «Ningún producto coincide…» en prosa, sin «Ver todos los servicios»');
  await shot('a2-sin-resultados');
  await evalJs(`(() => {
    MODULOS.push({ id: 'b8-falso', nombre: 'Categoría B8', estado: 'activo',
                   navegacion: { enExplorar: true, etiquetaExplorar: 'B8' } });
    catExplorar = 'b8-falso'; pintarExplorar();
  })()`);
  await esperar(`document.querySelector('#explorar-vacio')?.offsetParent !== null`, 8000);
  const a3 = await evalJs(`(() => ({
    titulo: document.querySelector('#vacio-titulo')?.textContent || '',
    boton: !!document.querySelector('#btn-vacio-todos'),
  }))()`);
  fila('A3-explorar-vacio', a3.titulo.includes('productos verificados') && !a3.boton,
    `Antes: «${a3.titulo}», sin acción de salida`);

  /* A5 · reserva: la agenda no responde al pedir los huecos */
  const rDisp = regla('/api/disponibilidad', 'fallar');
  await irAInicio();
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await clic('.prod-card [data-acc="reservar"]');
  await esperar(`document.querySelector('#huecos')?.textContent.includes('no respondió')`, 20000);
  const a5 = await evalJs(`(() => ({
    texto: document.querySelector('#huecos')?.textContent || '',
    boton: !!document.querySelector('#huecos button'),
  }))()`);
  fila('A5-huecos-no-cargan',
    a5.texto.includes('Vuelve a elegir el día') && !a5.boton,
    'Antes: reintento solo insinuado («vuelve a elegir el día»), sin botón');
  await shot('a5-huecos');
  rDisp.activa = false;

  /* A4 · reserva: error genérico al confirmar (502 inyectado) */
  await irAInicio();
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await clic('.prod-card [data-acc="reservar"]');
  await esperar(`document.querySelectorAll('.hora-fila').length > 0`, 25000);
  await clic('.hora-fila');
  await clic('#btn-paso2-siguiente');
  await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 8000);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    n.value = 'PRUEBA B8'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#check-confirma');
  const rRes = regla('/api/reservar', 'responder', { metodo: 'POST', status: 502 });
  await clic('#btn-confirmar');
  await esperar(`document.querySelector('#error-reserva')?.classList.contains('visible')`, 20000);
  const a4 = await evalJs(`(() => ({
    error: document.querySelector('#error-reserva')?.textContent || '',
    reintentar: !!document.querySelector('#btn-reintentar-reserva'),
  }))()`);
  fila('A4-reserva-error-generico',
    a4.error.includes('la agenda no responde') && !a4.reintentar,
    'Antes: el error genérico no trae acción propia (solo queda el botón Confirmar restaurado)');
  await shot('a4-reserva-generica');
  rRes.activa = false;

  /* A6 · profesional: Hoy no carga (502 inyectado) */
  const rHoy = regla('/api/profesional/hoy', 'responder', { status: 502 });
  await irA(WEB + '/profesional');
  await esperar(`!!document.querySelector('#clave')`, 15000);
  await evalJs(`(() => { document.querySelector('#clave').value = ${JSON.stringify(CLAVE)}; })()`);
  await clic('#btn-entrar');
  await esperar(`document.querySelector('#hoy-citas')?.textContent.includes('no responde')`, 20000);
  const a6 = await evalJs(`(() => ({
    texto: document.querySelector('#hoy-citas')?.textContent || '',
    boton: !!document.querySelector('#hoy-citas button'),
  }))()`);
  fila('A6-profesional-hoy', a6.texto.includes('Prueba a recargar') && !a6.boton,
    'Antes: «Prueba a recargar en un momento» en prosa, sin botón de reintento');
  await shot('a6-prof-hoy');
  rHoy.activa = false;
}

/* ================= MODO DESPUÉS: cada error con su salida, funcionando ================= */
const extras = {};
if (MODO === 'despues') {

  /* D11 · la carta no carga → botón Recargar que recarga de verdad */
  const rServicios = regla('/api/servicios', 'fallar');
  await irA(WEB + '/');
  await esperar(`!!document.querySelector('#carrusel-reco .btn-recargar')`, 20000);
  await shotFull('d11-carta');
  await clic('#carrusel-reco .btn-recargar');
  rServicios.activa = false;
  const d11 = await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  fila('D11-carta-no-carga', d11, 'Tras B8: botón «Recargar la página» y la carta vuelve al pulsarlo');

  /* D1 · /cita/<token> inventado → las dos salidas del diagnóstico */
  await irA(WEB + '/cita/token-inventado-b8-0000000000');
  await esperar(`document.querySelector('#error-general')?.classList.contains('visible')`, 20000);
  await esperar(`document.querySelector('#error-acciones')?.offsetParent !== null`, 8000);
  const d1 = await evalJs(`(() => ({
    error: document.querySelector('#error-general')?.textContent || '',
    irApp: document.querySelector('#error-acciones a[href="/"]')?.textContent.trim() || '',
    wa: document.querySelector('#error-acciones a[href^="https://wa.me/"]')?.getAttribute('href') || '',
  }))()`);
  await shotFull('d1-cita-error');
  await clic('#error-acciones a[href="/"]');
  const d1b = await esperar(`document.querySelectorAll('#carrusel-reco .reco-card').length >= 3`, 30000);
  fila('D1-cita-token-invalido',
    d1.error.includes('no corresponde a ninguna cita') && d1.irApp.includes('Ir a La Asistenta')
      && d1.wa === 'https://wa.me/584249134367' && d1b,
    'Tras B8: «Ir a La Asistenta» (funciona: vuelve a la portada) + «Escribir al salón por WhatsApp» (wa.me público)');

  /* D2/D3 · Explorar: sin resultados y módulo sin carta */
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await evalJs(`(() => { const i = document.querySelector('#inp-buscar-exp');
    i.value = 'zzzz'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await esperar(`document.querySelector('#sin-resultados-exp')?.offsetParent !== null`, 8000);
  const d2t = await texto('#sin-resultados-txt');
  await shot('d2-sin-resultados');
  await clic('#btn-ver-todos-exp');
  const d2 = await esperar(`[...document.querySelectorAll('#explorar-grid .prod-card')]
    .every(c => c.style.display !== 'none') && document.querySelectorAll('#explorar-grid .prod-card').length >= 4
    && document.querySelector('#sin-resultados-exp')?.offsetParent === null`, 8000);
  fila('D2-explorar-sin-resultados',
    d2t.includes('Ningún servicio coincide') && d2,
    'Tras B8: lenguaje de servicios + «Ver todos los servicios» restaura la carta');
  await evalJs(`(() => {
    MODULOS.push({ id: 'b8-falso', nombre: 'Categoría B8', estado: 'activo',
                   navegacion: { enExplorar: true, etiquetaExplorar: 'B8' } });
    catExplorar = 'b8-falso'; pintarExplorar();
  })()`);
  await esperar(`document.querySelector('#explorar-vacio')?.offsetParent !== null`, 8000);
  const d3 = await evalJs(`(() => ({
    titulo: document.querySelector('#vacio-titulo')?.textContent || '',
    cuerpo: document.querySelector('#explorar-vacio')?.textContent || '',
  }))()`);
  await shot('d3-explorar-vacio');
  await clic('#btn-vacio-todos');
  const d3b = await esperar(`document.querySelectorAll('#explorar-grid .prod-card').length >= 4
    && document.querySelector('#explorar-vacio')?.offsetParent === null`, 8000);
  fila('D3-explorar-vacio',
    d3.titulo.includes('aún sin servicios cargados') && !d3.cuerpo.includes('productos') && d3b,
    'Tras B8: vacío en lenguaje de servicios + «Ver todos los servicios» lleva a la carta real');

  /* D4 · foto no válida en el dispositivo (CONSERVAR: verifica la salida) */
  await clic('#nav-probador');
  await clic('#btn-prob-cejas');
  await esperar(`document.getElementById('p-consentimiento')?.classList.contains('activa')`, 8000);
  await clic('#check-consentimiento');
  await clic('#btn-ir-foto');
  await esperar(`document.getElementById('p-foto')?.classList.contains('activa')`, 8000);
  const { result: { root } } = await S('DOM.getDocument', { depth: 1 });
  const { result: { nodeId } } = await S('DOM.querySelector', { nodeId: root.nodeId, selector: '#input-foto' });
  await S('DOM.setFileInputFiles', { nodeId, files: ['/tmp/b8-no-es-foto.txt'] });
  const d4 = await esperar(`document.querySelector('#error-foto')?.classList.contains('visible')
    && document.querySelector('#error-foto')?.textContent.includes('no es JPG, PNG ni WebP')`, 8000);
  const d4b = await evalJs(visible('#btn-elegir-foto'));
  fila('D4-foto-invalida', d4 && d4b,
    'CONSERVAR verificado: mensaje claro y «Elegir mi foto» sigue ahí para reintentar');

  /* D5 · análisis fallido (500 inyectado) → «Intentar de nuevo» */
  const rAn = regla('/api/analizar', 'responder', {
    metodo: 'POST', status: 500, cuerpo: '{"error":"el análisis no está disponible ahora mismo"}',
  });
  await clic('#btn-foto-ejemplo');
  await esperar(`!document.getElementById('btn-analizar').disabled`, 15000);
  await clic('#btn-analizar');
  const d5 = await esperar(`document.querySelector('#error-foto')?.classList.contains('visible')
    && document.querySelector('#error-foto')?.textContent.includes('no está disponible')`, 30000);
  const d5b = await texto('#btn-analizar');
  fila('D5-analisis-fallido', d5 && d5b.includes('Intentar de nuevo'),
    'CONSERVAR verificado: el error del análisis deja el botón convertido en «Intentar de nuevo»');
  await shot('d5-analisis');
  rAn.activa = false;

  /* D6 · huecos no cargan → Reintentar explícito que funciona */
  const rDisp = regla('/api/disponibilidad', 'fallar');
  await irAInicio();
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await clic('.prod-card [data-acc="reservar"]');
  await esperar(`!!document.querySelector('#btn-reintentar-huecos')`, 20000);
  await shot('d6-huecos');
  rDisp.activa = false;
  await clic('#btn-reintentar-huecos');
  const d6 = await esperar(`document.querySelectorAll('.hora-fila').length > 0`, 25000);
  fila('D6-huecos-no-cargan', d6,
    'Tras B8: «Reintentar» en el propio paso 2 y los huecos cargan al pulsarlo');

  /* D7 · reserva: error genérico (502) → Reintentar → reserva real */
  const datosReserva = await evalJs(`(() => ({
    fecha: document.querySelector('#inp-fecha')?.value || '',
    servicio: estado.servicioReserva || '',
  }))()`);
  await clic('.hora-fila');
  datosReserva.hora = await evalJs(`document.querySelector('.hora-fila')?.dataset.hora || ''`);
  await clic('#btn-paso2-siguiente');
  await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 8000);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    n.value = 'PRUEBA B8'; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#check-confirma');
  const rRes = regla('/api/reservar', 'responder', { metodo: 'POST', status: 502 });
  await clic('#btn-confirmar');
  await esperar(`document.querySelector('#error-reserva')?.classList.contains('visible')
    && document.querySelector('#btn-reintentar-reserva')?.offsetParent !== null`, 20000);
  await shot('d7-reserva-generica');
  rRes.activa = false;
  await clic('#btn-reintentar-reserva');
  const d7 = await esperar(`document.getElementById('p-confirmada')?.classList.contains('activa')
    && (document.getElementById('conf-codigo')?.textContent || '').trim().length > 0`, 30000);
  const enlaceD7 = await evalJs(`document.getElementById('conf-ver-cita')?.href || ''`);
  extras.datosReserva = datosReserva;
  extras.enlaceD7 = enlaceD7 ? new URL(enlaceD7).pathname : '';
  fila('D7-reserva-error-generico', d7,
    'Tras B8: el error genérico trae «Reintentar la reserva» y al pulsarlo la reserva se hace de verdad');

  /* D8 · 409 REAL: el hueco se ocupa entre cargar huecos y confirmar */
  await irAInicio();
  await clic('#nav-explorar');
  await esperar(`document.querySelectorAll('.prod-card').length > 0`, 15000);
  await clic('.prod-card [data-acc="reservar"]');
  await esperar(`document.querySelectorAll('.hora-fila').length > 0`, 25000);
  const s2 = await evalJs(`(() => {
    const filas = [...document.querySelectorAll('.hora-fila')].filter(b => b.offsetParent !== null);
    const f = filas.find(b => b.dataset.hora !== ${JSON.stringify(datosReserva.hora)}) || filas[0];
    return f?.dataset.hora || '';
  })()`);
  const apiBook = await evalJs(`(async () => {
    const r = await fetch('/api/reservar', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'PRUEBA B8 API', telefono: '600123456',
        servicios: [${JSON.stringify(datosReserva.servicio)}],
        servicio: ${JSON.stringify(datosReserva.servicio)}, notas: '',
        fecha: ${JSON.stringify(datosReserva.fecha)}, hora: ${JSON.stringify(s2)} }) });
    const d = await r.json().catch(() => ({}));
    return { st: r.status, enlace: d.cita?.enlace || '' };
  })()`);
  extras.enlaceApi = apiBook.enlace ? new URL(apiBook.enlace).pathname : '';
  await clic(`.hora-fila[data-hora="${s2}"]`);
  await clic('#btn-paso2-siguiente');
  await esperar(`document.getElementById('paso-3')?.classList.contains('activo')`, 8000);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre');
    if (!n.value.trim()) { n.value = 'PRUEBA B8'; n.dispatchEvent(new Event('input', { bubbles: true })); } })()`);
  await clic('#check-confirma');
  await esperar(`!document.getElementById('btn-confirmar').disabled`, 8000);
  await clic('#btn-confirmar');
  const d8 = await esperar(`document.getElementById('paso-2')?.classList.contains('activo')
    && (document.querySelector('#error-reserva')?.textContent || '').includes('se ocupó')`, 25000);
  const d8alt = await texto('#error-reserva');
  fila('D8-reserva-409', apiBook.st === 201 && d8 && d8alt.includes('Huecos libres ahora'),
    'CONSERVAR verificado: 409 real — mensaje con alternativas y vuelta automática al paso 2');

  /* D9 · lista de espera: validación y alta (domingo, sin huecos) */
  await evalJs(`(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 0);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
    document.querySelector('#inp-fecha').value = iso; cargarHuecos();
  })()`);
  await esperar(`document.querySelector('#tarjeta-espera')?.offsetParent !== null`, 20000);
  await evalJs(`(() => { document.querySelector('#esp-telefono').value = '123'; })()`);
  await clic('#btn-espera');
  const d9a = await esperar(`document.querySelector('#error-espera')?.classList.contains('visible')
    && document.querySelector('#error-espera')?.textContent.includes('teléfono válido')`, 8000);
  await evalJs(`(() => { document.querySelector('#esp-telefono').value = '600123456'; })()`);
  await clic('#btn-espera');
  const d9b = await esperar(`document.querySelector('#espera-ok')?.offsetParent !== null`, 15000);
  fila('D9-lista-espera', d9a && d9b,
    'CONSERVAR verificado: error de validación en el formulario y alta real al corregirlo');

  /* D12/D13 · la página de la cita: huecos con Reintentar y prep */
  const rHue = regla('/huecos?fecha=', 'fallar');
  await irA(WEB + extras.enlaceD7);
  await esperar(`!!document.querySelector('#btn-reintentar-huecos')`, 20000);
  await shot('d12-cita-huecos');
  rHue.activa = false;
  await clic('#btn-reintentar-huecos');
  const d12 = await esperar(`document.querySelectorAll('#huecos .hueco').length > 0`, 20000);
  fila('D12-cita-huecos', d12,
    'Tras B8: si la agenda no responde en «Cambiar el día», «Reintentar» trae los huecos');
  await clic('#btn-prep');
  const d13 = await esperar(`document.querySelector('#prep-error')?.classList.contains('visible')
    && document.querySelector('#prep-error')?.textContent.includes('Elige si llevas')`, 8000);
  fila('D13-cita-prep', d13,
    'CONSERVAR verificado: la validación de la preparación se dice en el propio formulario');
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  extras.canceladaD7 = await esperar(`document.querySelector('#cancelada')?.offsetParent !== null`, 15000);
  if (extras.enlaceApi) {
    await irA(WEB + extras.enlaceApi);
    await esperar(`!!document.querySelector('#btn-cancelar')`, 15000);
    await clic('#btn-cancelar'); await sleep(500);
    await clic('#btn-cancelar-si');
    extras.canceladaApi = await esperar(`document.querySelector('#cancelada')?.offsetParent !== null`, 15000);
  }

  /* D10 · profesional: acceso y vistas que no cargan */
  await irA(WEB + '/profesional');
  await esperar(`!!document.querySelector('#clave')`, 15000);
  await evalJs(`(() => { document.querySelector('#clave').value = 'clave-mala-b8'; })()`);
  await clic('#btn-entrar');
  const d10a = await esperar(`document.querySelector('#acceso-error')?.textContent.includes('Clave no válida')`, 10000);
  const rHoy = regla('/api/profesional/hoy', 'responder', { status: 502 });
  const rAge = regla('/api/profesional/agenda', 'responder', { status: 502 });
  await evalJs(`(() => { document.querySelector('#clave').value = ${JSON.stringify(CLAVE)}; })()`);
  await clic('#btn-entrar');
  await esperar(`!!document.querySelector('#hoy-citas button')`, 20000);
  await shot('d10-prof-hoy');
  rHoy.activa = false;
  await clic('#hoy-citas button');
  const d10b = await esperar(`(document.querySelector('#hoy-resumen')?.innerHTML || '').length > 10
    && !document.querySelector('#hoy-citas button')`, 20000);
  await clic('.tab[data-tab="agenda"]');
  await esperar(`!!document.querySelector('#agenda-dias button')`, 10000);
  rAge.activa = false;
  await clic('#agenda-dias button');
  const d10c = await esperar(`document.querySelectorAll('#agenda-dias .dia').length >= 7`, 20000);
  fila('D10-profesional', d10a && d10b && d10c,
    'Tras B8: clave mala se dice en el acceso; Hoy y Agenda con «Reintentar» que recarga la vista');

  /* D14 · sin conexión: el banner avisa y se va solo (CONSERVAR) */
  await irAInicio();
  await S('Network.emulateNetworkConditions',
    { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const d14a = await esperar(`document.querySelector('#banner-offline')?.classList.contains('visible')`, 8000);
  await S('Network.emulateNetworkConditions',
    { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const d14b = await esperar(`!document.querySelector('#banner-offline')?.classList.contains('visible')`, 8000);
  fila('D14-sin-conexion', d14a && d14b,
    'CONSERVAR verificado: el banner de sin conexión aparece y desaparece solo');

  /* Limpieza: la alta de lista de espera de prueba queda descartada */
  try {
    const login = await fetch(WEB + '/api/profesional/acceso', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave: CLAVE }),
    }).then(r => r.json());
    if (login.sesion) {
      const cab = { 'X-Sesion-Pro': login.sesion, 'Content-Type': 'application/json' };
      const lista = await fetch(WEB + '/api/profesional/espera', { headers: cab }).then(r => r.json());
      const mias = (lista.lista_espera || []).filter(e =>
        e.nombre === 'PRUEBA B8' && !['descartada', 'atendida'].includes(e.estado));
      for (const e of mias)
        await fetch(WEB + `/api/profesional/espera/${e.id}/estado`, {
          method: 'POST', headers: cab, body: JSON.stringify({ estado: 'descartada' }) });
      extras.limpiezaEspera = `descartadas: ${mias.length}`;
    } else extras.limpiezaEspera = 'sin sesión para limpiar';
  } catch (e) { extras.limpiezaEspera = 'falló: ' + e.message; }
}

/* ---------- cierre ---------- */
const informe = { modo: MODO, matriz, erroresConsola, extras };
writeFileSync(`${OUT}/informe.json`, JSON.stringify(informe, null, 2));
const fallos = matriz.filter(f => !f.ok).length;
console.log(`\nQA-B8 ${MODO}: ${matriz.length - fallos}/${matriz.length} filas ok · errores de consola: ${erroresConsola.length}`);
try { ws.close(); } catch {}
chrome.kill();
process.exit(fallos ? 1 : 0);
