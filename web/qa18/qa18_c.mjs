// QA18-C · VERIFICACIÓN POST-ARREGLOS (29/10/2026) — cada defecto
// corregido se re-ejecuta: geometría de la barra (D-04), pie (D-01),
// volver al origen (D-03), pastilla de estado real en la cita
// (D-02), lista de espera desde la UI con lectura inmediata de la
// agenda, y la transición del service worker v15 → v16 reutilizando
// el perfil de la Fase A1 (que tiene la v15 instalada).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const AGENDA = 'http://127.0.0.1:8081';
const OUT = '/data/la-asistenta/web/qa18';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOY = new Date().toISOString().slice(0, 10);
const SABADO = '2026-10-31';
const LOG = { fase: 'C', paradas: [], consola: [] };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-c.json`, JSON.stringify(LOG, null, 1));
const envAgenda = readFileSync('/data/la-asistenta/agenda/agenda.env', 'utf8');
const AG_TOKEN = (envAgenda.match(/AGENDA_API_TOKEN=(.+)/) || [])[1]?.trim();
async function ag(metodo, ruta, cuerpo) {
  const r = await fetch(AGENDA + ruta, {
    method: metodo,
    headers: { 'X-API-Token': AG_TOKEN, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = {};
  try { datos = await r.json(); } catch (e) {}
  return { st: r.status, datos };
}

function lanzarChrome(puerto, perfil) {
  return spawn('/usr/bin/chromium', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + puerto, '--remote-debugging-address=127.0.0.1',
    '--window-size=412,915', '--user-data-dir=' + perfil, 'about:blank',
  ], { stdio: 'ignore' });
}
async function conectar(puerto) {
  let url = null;
  for (let i = 0; i < 30 && !url; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/json/version`);
      const j = await r.json();
      url = j.webSocketDebuggerUrl;
    } catch {}
    if (!url) await sleep(500);
  }
  const ws = new WebSocket(url);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pend = new Map();
  ws.addEventListener('message', evm => {
    const m = JSON.parse(evm.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  const send = (method, params = {}, sessionId) => {
    const id = ++seq;
    return new Promise(res => { pend.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  };
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  const evalJs = async expr => {
    const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 200));
    return r.result?.result?.value;
  };
  const shot = async nombre => {
    const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result?.data || r.data, 'base64'));
  };
  return { ws, S, evalJs, shot };
}
let ctx = null;
async function parada(nombre, fn, shotName) {
  const reg = { nombre, ok: true };
  try { reg.datos = await fn(); }
  catch (e) { reg.ok = false; reg.error = String(e.message || e).slice(0, 300); }
  if (shotName && ctx) { try { await ctx.shot(shotName); reg.captura = shotName + '.png'; } catch (e) {} }
  LOG.paradas.push(reg);
  guardarLog();
  console.log('parada', nombre, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''));
  return reg;
}
const clicEn = sel => ctx.evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO-ESTA'; el.click(); return 'ok'; })()`);
const esperarEn = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await ctx.evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};

/* ============ Sesión 1: perfil nuevo ============ */
const chrome1 = lanzarChrome(9365, '/tmp/qa18-perfil-c');
ctx = await conectar(9365);
await ctx.S('Page.navigate', { url: WEB + '/' });
await sleep(4500);

await parada('verif-barra-salon', async () => {
  await ctx.evalJs(`ir('p-salon')`); await sleep(1500);
  const medir = () => ctx.evalJs(`(() => { const b = document.getElementById('salon-barra');
    const r = b.getBoundingClientRect();
    return { visible: b.classList.contains('visible'),
             left: Math.round(r.left), right: Math.round(r.right),
             top: Math.round(r.top), bottom: Math.round(r.bottom),
             scrollW: document.documentElement.scrollWidth,
             btn: (() => { const x = document.getElementById('btn-salon-reservar').getBoundingClientRect();
               return { left: Math.round(x.left), right: Math.round(x.right) }; })() }; })()`);
  const sinTocar = await medir();
  await ctx.shot('e01-salon-barra-arreglada');
  await ctx.evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Brow Lamination"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(500);
  await ctx.evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Brow Lamination"] .fs-add')?.click()`);
  await sleep(900);
  const trasSeleccion = await medir();
  return { sinTocar, trasSeleccion };
});
await parada('verif-footer-y-chips', async () => {
  await ctx.evalJs(`ir('p-inicio')`); await sleep(900);
  await ctx.evalJs(`(() => { const h = [...document.querySelectorAll('#p-inicio h2')].find(x => x.textContent.includes('Más en camino')); h && h.scrollIntoView({ block: 'start' }); })()`);
  await sleep(700);
  await ctx.shot('e02-mas-en-camino');
  await ctx.evalJs(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(700);
  return { footer: await ctx.evalJs(`document.querySelector('footer')?.innerText.trim().replace(/\\n/g, ' | ').slice(0, 200)`) };
}, 'e03-footer-nuevo');
await parada('verif-volver-origen', async () => {
  const desdeExplorar = await (async () => {
    await ctx.evalJs(`ir('p-explorar')`); await sleep(800);
    await ctx.evalJs(`(() => { const c = [...document.querySelectorAll('#chips-cat .chip-cat')].find(x => x.textContent.trim() === 'Ropa'); c && c.click(); })()`);
    await sleep(800);
    await clicEn('#btn-proxima-volver'); await sleep(700);
    return await ctx.evalJs(`document.querySelector('.pantalla.activa')?.id`);
  })();
  const desdeProbador = await (async () => {
    await ctx.evalJs(`ir('p-probador')`); await sleep(800);
    await clicEn('#btn-prob-moda'); await sleep(800);
    await clicEn('#btn-proxima-volver'); await sleep(700);
    return await ctx.evalJs(`document.querySelector('.pantalla.activa')?.id`);
  })();
  const desdeInicio = await (async () => {
    await ctx.evalJs(`ir('p-inicio')`); await sleep(700);
    await ctx.evalJs(`(() => { const c = document.querySelector('#estanteria-modulos .mod-card'); c && c.click(); })()`);
    await sleep(800);
    await clicEn('#btn-proxima-volver'); await sleep(700);
    return await ctx.evalJs(`document.querySelector('.pantalla.activa')?.id`);
  })();
  return { desdeExplorar, desdeProbador, desdeInicio };
});

/* ---------- D-02: la cita cumplida ya se presenta como tal ---------- */
await parada('verif-cita-cumplida', async () => {
  const { datos: dc } = await ag('GET', `/citas?fecha=${HOY}`);
  const libre = '10:00';
  const creada = await ag('POST', '/citas', { nombre: 'QA18 Verif', servicio: 'Diseño de cejas',
                                              fecha: HOY, hora: libre, origen: 'qa18' });
  let cita = creada.datos?.cita;
  if (!cita) {
    // 10:00 pudo estar ocupada: probar con la primera hora libre vía web.
    const disp = await ctx.evalJs(`fetch('/api/disponibilidad?servicio=' + encodeURIComponent('Diseño de cejas') + '&fecha=${HOY}').then(r => r.json())`);
    const h = (disp.huecos || [])[0];
    if (!h) return { error: 'sin huecos hoy para la verificación' };
    const c2 = await ag('POST', '/citas', { nombre: 'QA18 Verif', servicio: 'Diseño de cejas',
                                            fecha: HOY, hora: h, origen: 'qa18' });
    cita = c2.datos?.cita;
  }
  if (!cita) return { error: 'no se pudo crear la cita de verificación' };
  const token = (cita.enlace || '').split('/cita/')[1] || null;
  // Sesión profesional por API para marcarla cumplida.
  const envPro = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envPro.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  const login = await fetch(WEB + '/api/profesional/acceso', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clave: claveReal }),
  }).then(r => r.json());
  const marcar = await fetch(WEB + `/api/profesional/citas/${cita.id}/estado`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sesion-Pro': login.sesion },
    body: JSON.stringify({ estado: 'cumplida' }),
  });
  const estadoAgenda = await ag('GET', `/citas?fecha=${HOY}`)
    .then(r => (r.datos.citas || []).find(c => c.id === cita.id)?.estado);
  if (!token) return { error: 'la cita creada no trae enlace', marcarSt: marcar.status, estadoAgenda };
  await ctx.S('Page.navigate', { url: WEB + '/cita/' + token });
  await sleep(3000);
  await esperarEn(`document.getElementById('contenido').style.display !== 'none'`, 12000);
  const vista = await ctx.evalJs(`(() => ({
    pastilla: document.getElementById('cita-estado')?.textContent.trim(),
    clase: document.getElementById('cita-estado')?.className,
    prepVisible: getComputedStyle(document.getElementById('tarjeta-prep')).display !== 'none',
    reagendarVisible: getComputedStyle(document.getElementById('tarjeta-reagendar')).display !== 'none',
    cancelarVisible: getComputedStyle(document.getElementById('tarjeta-cancelar')).display !== 'none',
    avisoVisible: document.getElementById('cita-cerrada')?.style.display !== 'none',
    avisoTxt: document.getElementById('cita-cerrada')?.textContent.trim().slice(0, 120),
  }))()`);
  // La bandeja habrá ganado un mensaje de esta cita: lo descarto para no dejar rastro.
  const { datos: db } = await ag('GET', '/bandeja?estado=pendiente');
  const item = (db.bandeja || []).find(b => b.cita_id === cita.id || (b.texto || '').includes('QA18'));
  let bandejaLimpia = 'sin-item';
  if (item) {
    const r = await ag('POST', `/bandeja/${item.id}/estado`, { estado: 'descartada' });
    bandejaLimpia = r.st;
  }
  return { marcarSt: marcar.status, estadoAgenda, token: !!token, vista, bandejaLimpia };
}, 'e04-cita-cumplida');

/* ---------- Lista de espera desde la UI (definitiva) ---------- */
await parada('verif-lista-espera-ui', async () => {
  const horas = ['10:00', '10:25', '10:50', '11:15', '11:40', '12:05', '12:30', '12:55', '13:20'];
  const bloqueos = [];
  for (const h of horas) {
    const r = await ag('POST', '/citas', { nombre: 'QA18 Bloqueo C', servicio: 'Diseño de cejas',
                                           fecha: SABADO, hora: h, origen: 'qa18' });
    bloqueos.push({ hora: h, st: r.st, id: r.datos?.cita?.id });
  }
  await ctx.S('Page.navigate', { url: WEB + '/' });
  await sleep(3500);
  await clicEn('#pastilla-reservar'); await sleep(1000);
  await ctx.evalJs(`(() => {
    document.querySelectorAll('#res-servicios .servicio-card').forEach(c => {
      const on = c.classList.contains('sel');
      if ((c.dataset.servicio === 'Diseño de cejas') !== on) c.click();
    });
  })()`);
  await sleep(300);
  await clicEn('#btn-paso1-siguiente'); await sleep(700);
  await ctx.evalJs(`document.querySelector('.cal-dia[data-fecha="${SABADO}"]').click()`);
  const sinHuecos = await esperarEn(`document.querySelectorAll('#huecos .hora-fila').length === 0 && document.getElementById('tarjeta-espera').style.display !== 'none'`, 15000);
  await ctx.evalJs(`(() => {
    document.getElementById('esp-nombre').value = 'QA18 Espera C';
    document.getElementById('esp-telefono').value = '600000000';
  })()`);
  await clicEn('#btn-espera');
  const okVisible = await esperarEn(`document.getElementById('espera-ok').style.display === 'block'`, 15000);
  await sleep(500);
  const leer = async () => {
    const { datos } = await ag('GET', '/lista-espera');
    return (datos.lista_espera || []).find(e => e.nombre === 'QA18 Espera C') || null;
  };
  const entrada = await leer();
  let trasLiberar = null;
  const primero = bloqueos.find(b => b.id);
  if (primero) {
    await ag('POST', `/citas/${primero.id}/cancelar`, {});
    await sleep(700);
    trasLiberar = await leer();
  }
  // Limpieza: resto de bloqueos fuera; la entrada se descarta en la siguiente parada si procede.
  let canceladas = 0;
  for (const b of bloqueos) {
    if (!b.id || b === primero) continue;
    const r = await ag('POST', `/citas/${b.id}/cancelar`, {});
    if (r.st === 200) canceladas++;
  }
  return { bloqueosSt: bloqueos.map(b => b.st), sinHuecos, okVisible,
           entrada: entrada && { id: entrada.id, estado: entrada.estado, fecha_pref: entrada.fecha_pref },
           trasLiberar: trasLiberar && { estado: trasLiberar.estado },
           bloqueosCanceladosEnLimpieza: canceladas };
}, 'e05-espera-ok');
await parada('verif-espera-en-profesional', async () => {
  await ctx.S('Page.navigate', { url: WEB + '/profesional' });
  await sleep(2500);
  const envPro = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envPro.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  const yaDentro = await ctx.evalJs(`!document.getElementById('vista-panel').classList.contains('oculto')`);
  if (!yaDentro) {
    await ctx.evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
    await clicEn('#btn-entrar');
    await esperarEn(`!document.getElementById('vista-panel').classList.contains('oculto')`, 20000);
  }
  await ctx.evalJs(`document.querySelector('.tab[data-tab="espera"]').click()`);
  await sleep(1800);
  const vista = await ctx.evalJs(`(() => {
    const item = [...document.querySelectorAll('#espera-lista .cita')].find(c => c.textContent.includes('QA18 Espera C'));
    return item ? { chip: item.querySelector('.chip')?.textContent.trim(),
                    tieneWa: !!item.querySelector('a[href*="wa.me"]') } : null;
  })()`);
  await ctx.shot('e06-pro-por-avisar');
  await ctx.evalJs(`(() => {
    const item = [...document.querySelectorAll('#espera-lista .cita')].find(c => c.textContent.includes('QA18 Espera C'));
    const b = item && item.querySelector('[data-estado="descartada"]');
    if (b) b.click();
  })()`);
  await sleep(2200);
  const { datos } = await ag('GET', '/lista-espera');
  const final = (datos.lista_espera || []).find(e => e.nombre === 'QA18 Espera C');
  return { vista, estadoFinal: final ? final.estado : 'no-está' };
});
try { ctx.ws.close(); } catch {}
chrome1.kill();

/* ============ Sesión 2: PWA — el perfil de A1 (v15) recibe la v16 ============ */
const chrome2 = lanzarChrome(9366, '/tmp/qa18-perfil-a');
ctx = await conectar(9366);
await parada('verif-pwa-v15-a-v16', async () => {
  const cachesDe = () => ctx.evalJs(`(async () => {
    const ks = await caches.keys();
    let footer = null;
    const reg = await navigator.serviceWorker?.getRegistration();
    return { caches: ks, controlador: !!navigator.serviceWorker?.controller,
             swState: reg?.active?.state || reg?.installing?.state || reg?.waiting?.state || 'sin-reg' };
  })()`);
  await ctx.S('Page.navigate', { url: WEB + '/' });
  await sleep(3500);
  const primera = await cachesDe();
  await ctx.S('Page.reload', {});
  await sleep(4000);
  const segunda = await cachesDe();
  const pie = await ctx.evalJs(`document.querySelector('footer')?.innerText.trim().slice(0, 60)`);
  return { primera, segunda, pie };
});
try { ctx.ws.close(); } catch {}
chrome2.kill();

guardarLog();
console.log('FASE C COMPLETA · paradas:', LOG.paradas.length);
process.exit(0);
