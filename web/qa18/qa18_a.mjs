// QA18-A · BARRIDO COMPLETO (29/10/2026) — clienta (sin análisis) +
// profesional + prueba de estado en /cita/<token> (candidata D-02).
// Técnica QA17: Chromium headless EN la máquina, CDP crudo, 412×915
// DSF 2, verificación desde los bytes + medidas DOM objetivas por
// parada + errores de consola acumulados. La clave profesional se lee
// del fichero de la máquina y NUNCA se imprime ni se registra.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const WEB = 'http://127.0.0.1:8090';
const OUT = '/data/la-asistenta/web/qa18';
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOY = new Date().toISOString().slice(0, 10);       // 2026-10-29
const FUTURA = '2026-11-03';                              // martes
const REAG = '2026-11-04';                                // miércoles
const REAG2 = '2026-11-05';                               // jueves

const LOG = { fase: 'A', paradas: [], consola: [], tokens: {} };
const guardarLog = () =>
  writeFileSync(`${OUT}/log-a.json`, JSON.stringify(LOG, null, 1));

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9361', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa18-perfil-a', 'about:blank',
], { stdio: 'ignore' });
async function wsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9361/json/version');
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
let paradaActual = 'arranque';
ws.addEventListener('message', evm => {
  const m = JSON.parse(evm.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const t = m.params.type;
    if (t === 'error' || t === 'warning') {
      LOG.consola.push({ parada: paradaActual, tipo: 'console.' + t,
        txt: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300) });
    }
  }
  if (m.method === 'Runtime.exceptionThrown') {
    LOG.consola.push({ parada: paradaActual, tipo: 'exception',
      txt: String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 300) });
  }
  if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
    LOG.consola.push({ parada: paradaActual, tipo: 'log.' + (m.params.entry.source || ''),
      txt: String(m.params.entry.text || '').slice(0, 300) });
  }
});
function send(method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise(res => { pendientes.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); });
}
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await S('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__wa = [];
  window.open = (u) => { window.__wa.push(String(u)); return null; };
  window.__blobs = [];
  const _cou = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { try { window.__blobs.push(b); } catch(e) {} return _cou(b); };
`});
async function evalJs(expr) {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
}
async function shot(nombre) {
  const r = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = r.result?.data || r.data;
  writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(data, 'base64'));
}
const MEDIR = `(() => {
  const de = document.documentElement;
  const enContenedorScroll = el => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
      n = n.parentElement;
    }
    return false;
  };
  const fuera = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.right > 413 || r.left < -1) {
      if (el.closest('#modal-tt') && !document.getElementById('modal-tt').classList.contains('abierto')) return;
      if (enContenedorScroll(el)) return;
      fuera.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 42),
                   left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  const cortados = [];
  document.querySelectorAll('h1,h2,h3,p,button,.btn,span,a').forEach(el => {
    if (!el.children.length && el.textContent.trim()) {
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis') return;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'hidden')
        cortados.push({ tag: el.tagName, txt: el.textContent.trim().slice(0, 40), eje: 'x' });
      if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden')
        cortados.push({ tag: el.tagName, txt: el.textContent.trim().slice(0, 40), eje: 'y' });
    }
  });
  return { scrollW: de.scrollWidth, scrollH: de.scrollHeight,
           activa: (document.querySelector('.pantalla.activa') || {}).id || location.pathname,
           fuera: fuera.slice(0, 8), cortados: cortados.slice(0, 8) };
})()`;
async function parada(nombre, fn, shotName) {
  paradaActual = nombre;
  const reg = { nombre, ok: true };
  try { reg.datos = await fn(); }
  catch (e) { reg.ok = false; reg.error = String(e.message || e).slice(0, 300); }
  try { reg.medidas = await evalJs(MEDIR); } catch (e) { reg.medidas = { error: 'sin medidas' }; }
  if (shotName) { try { await shot(shotName); reg.captura = shotName + '.png'; } catch (e) {} }
  LOG.paradas.push(reg);
  guardarLog();
  console.log('parada', nombre, reg.ok ? 'OK' : 'FALLO ' + (reg.error || ''));
  return reg;
}
const clic = async sel => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'NO-ESTA'; el.click(); return 'ok'; })()`);
const esperar = async (expr, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evalJs(expr)) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
};
const NAVEGAR = async url => { await S('Page.navigate', { url }); await sleep(2500); };

await S('Page.navigate', { url: WEB + '/' });
await sleep(4500);

/* ---------- 1 · Perfil vacío (estados vacíos dignos) ---------- */
await parada('perfil-vacio', async () => {
  await clic('#nav-perfil'); await sleep(900);
  return await evalJs(`(() => ({
    micita: document.getElementById('micita-resumen')?.textContent.trim().slice(0, 160),
    guardados: document.getElementById('guardados-lista')?.textContent.trim().slice(0, 160),
    looks: document.getElementById('looks-lista')?.textContent.trim().slice(0, 160),
    instalarVisible: (() => { const b = document.getElementById('btn-instalar');
      return b ? (getComputedStyle(b).display !== 'none' && b.offsetParent !== null) : 'no-esta'; })(),
  }))()`);
}, 'a01-perfil-vacio');

/* ---------- 2 · Inicio ---------- */
await parada('inicio', async () => {
  await clic('#nav-inicio'); await sleep(900);
  return await evalJs(`(() => ({
    pastillas: [...document.querySelectorAll('#pastillas .pastilla, #pastillas button')].map(p => p.textContent.trim().replace(/\\s+/g, ' ')).slice(0, 10),
  }))()`);
}, 'a02-inicio');
await parada('inicio-abajo-footer', async () => {
  await evalJs(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(700);
  return await evalJs(`(() => ({
    footer: document.querySelector('footer')?.innerText.trim().replace(/\\n/g, ' | ').slice(0, 300),
    futuro: [...document.querySelectorAll('#estanteria-modulos .mod-card .m-nombre')].map(e => e.textContent.trim()),
  }))()`);
}, 'a03-inicio-abajo');
await evalJs(`window.scrollTo(0, 0)`);

/* ---------- 3 · Pastillas ---------- */
await parada('pastilla-whatsapp', async () => {
  await clic('#pastilla-whatsapp'); await sleep(500);
  return await evalJs(`({ urlsAbiertas: window.__wa })`);
});
await parada('pastilla-analisis-consentimiento', async () => {
  await clic('#pastilla-analisis'); await sleep(800);
  const r = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    btnIrFotoDisabled: document.getElementById('btn-ir-foto')?.disabled,
  }))()`);
  await evalJs(`ir('p-inicio')`); await sleep(500);
  return r;
}, 'a04-consentimiento');
await parada('pastilla-servicio-diseno', async () => {
  await evalJs(`document.querySelector('#pastillas [data-servicio="Diseño de cejas"]').click()`);
  await sleep(1800);
  const r = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    resumen: document.getElementById('rm-txt')?.textContent.trim(),
    precio: document.getElementById('rm-precio')?.textContent.trim(),
  }))()`);
  await evalJs(`ir('p-inicio')`); await sleep(500);
  return r;
}, 'a05-pastilla-servicio');

/* ---------- 4 · Buscador de la home ---------- */
await parada('buscar-con-resultados', async () => {
  await evalJs(`(() => { const i = document.getElementById('inp-buscar-home'); i.value = 'henna'; document.getElementById('form-buscar-home').requestSubmit(); })()`);
  await sleep(1400);
  return await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    visibles: [...document.querySelectorAll('#explorar-grid .prod-card')].filter(c => c.style.display !== 'none').map(c => c.querySelector('h3')?.textContent),
  }))()`);
}, 'a06-buscar-henna');
await parada('buscar-sin-resultados', async () => {
  await evalJs(`ir('p-inicio')`); await sleep(600);
  await evalJs(`(() => { const i = document.getElementById('inp-buscar-home'); i.value = 'xyz123'; document.getElementById('form-buscar-home').requestSubmit(); })()`);
  await sleep(1200);
  return await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    sinResVisible: document.getElementById('sin-resultados-exp')?.style.display,
    sinResTxt: document.getElementById('sin-resultados-exp')?.textContent.trim(),
    visibles: [...document.querySelectorAll('#explorar-grid .prod-card')].filter(c => c.style.display !== 'none').length,
  }))()`);
}, 'a07-buscar-sin-resultados');

/* ---------- 5 · Explorar ---------- */
await parada('explorar', async () => {
  await evalJs(`(() => { const i = document.getElementById('inp-buscar-exp'); i.value = ''; i.dispatchEvent(new Event('input')); })()`);
  await sleep(800);
  return await evalJs(`(() => ({
    tarjetas: [...document.querySelectorAll('#explorar-grid .prod-card')].map(c => c.querySelector('h3')?.textContent),
    chips: [...document.querySelectorAll('#chips-cat .chip-cat')].map(c => c.textContent.trim() + (c.classList.contains('on') ? ' [on]' : '')),
  }))()`);
}, 'a08-explorar');
await parada('explorar-guardar', async () => {
  const r = await evalJs(`(() => {
    const cards = [...document.querySelectorAll('#explorar-grid .prod-card')];
    const lam = cards.find(c => c.querySelector('h3')?.textContent === 'Brow Lamination');
    if (!lam) return 'NO-ESTA';
    lam.scrollIntoView({ block: 'center' });
    lam.querySelector('[data-acc="guardar"]').click();
    return lam.querySelector('[data-acc="guardar"]').getAttribute('aria-pressed');
  })()`);
  await sleep(400);
  return { ariaPressedTrasGuardar: r };
}, 'a09-explorar-guardar');
for (const [chipTxt, nombreParada, shotN] of [
  ['Ropa', 'proxima-moda-chip', 'a10-proxima-moda'],
  ['Gafas', 'proxima-gafas-chip', 'a11-proxima-gafas'],
  ['Zapatillas', 'proxima-calzado-chip', 'a12-proxima-calzado'],
]) {
  await parada(nombreParada, async () => {
    await evalJs(`(() => { const c = [...document.querySelectorAll('#chips-cat .chip-cat')].find(x => x.textContent.trim() === ${JSON.stringify(chipTxt)}); c && c.click(); })()`);
    await sleep(900);
    const r = await evalJs(`(() => ({
      activa: document.querySelector('.pantalla.activa')?.id,
      titulo: document.getElementById('proxima-titulo')?.textContent.trim(),
      que: document.getElementById('proxima-que')?.textContent.trim().slice(0, 120),
    }))()`);
    await shot(shotN);
    await clic('#btn-proxima-volver'); await sleep(700);
    r.alVolver = await evalJs(`document.querySelector('.pantalla.activa')?.id`);
    return r;
  });
}

/* ---------- 6 · Salón ---------- */
await parada('salon-hero', async () => {
  await evalJs(`ir('p-salon')`); await sleep(1400);
  return await evalJs(`(() => ({
    nFilas: document.querySelectorAll('#salon-servicios .fila-servicio').length,
    horario: document.getElementById('salon-horario')?.textContent.trim().slice(0, 120),
  }))()`);
}, 'a13-salon-hero');
await parada('salon-barra-seleccion', async () => {
  await evalJs(`(() => { const f = document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"]'); f && f.scrollIntoView({ block: 'center' }); })()`);
  await sleep(600);
  await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Diseño de cejas"] .fs-add')?.click()`);
  await sleep(500);
  const trasDiseno = await evalJs(`(() => ({
    barraVisible: document.getElementById('salon-barra').classList.contains('visible'),
    n: document.getElementById('sb-n')?.textContent.trim(),
    detalle: document.getElementById('sb-detalle')?.textContent.trim(),
  }))()`);
  await shot('a14-salon-barra');
  await evalJs(`document.querySelector('#salon-servicios .fila-servicio[data-servicio="Ombré Brows Henna"] .fs-add')?.click()`);
  await sleep(500);
  const trasHenna = await evalJs(`(() => ({
    n: document.getElementById('sb-n')?.textContent.trim(),
    detalle: document.getElementById('sb-detalle')?.textContent.trim(),
  }))()`);
  return { trasDiseno, trasHenna };
});
await parada('salon-videos-modal', async () => {
  await evalJs(`document.getElementById('salon-videos')?.scrollIntoView({ block: 'center' })`);
  await sleep(700);
  await shot('a15-salon-videos');
  await evalJs(`document.querySelector('#salon-videos .video-card')?.click()`);
  await sleep(2000);
  const abierto = await evalJs(`(() => ({
    modalAbierto: document.getElementById('modal-tt').classList.contains('abierto'),
    iframeSrc: document.querySelector('#modal-tt iframe')?.getAttribute('src'),
    titulo: document.getElementById('modal-tt-tit')?.textContent.trim(),
  }))()`);
  await shot('a16-modal-tiktok');
  await clic('#modal-tt-x'); await sleep(700);
  const cerrado = await evalJs(`(() => ({
    modalAbierto: document.getElementById('modal-tt').classList.contains('abierto'),
    iframeSrc: document.querySelector('#modal-tt iframe')?.getAttribute('src') ?? 'sin-iframe',
  }))()`);
  return { abierto, cerrado };
});
await parada('salon-resenas-y-abajo', async () => {
  await evalJs(`(() => { const r = [...document.querySelectorAll('#p-salon h2')].find(h => /reseña/i.test(h.textContent)); r && r.scrollIntoView({ block: 'start' }); })()`);
  await sleep(800);
  await shot('a17-salon-resenas');
  await evalJs(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(700);
  return {};
}, 'a18-salon-abajo');
await parada('salon-compartir', async () => {
  await evalJs(`window.scrollTo(0, 0)`); await sleep(400);
  const antes = await evalJs(`document.body.innerText.includes('copiado')`);
  await clic('#btn-salon-compartir'); await sleep(1200);
  return await evalJs(`(() => ({
    habiaCopiadoAntes: ${'false'},
    feedbackCopiado: document.body.innerText.includes('copiado'),
    avisoVisible: (() => { const a = document.getElementById('aviso-app') || document.querySelector('.toast');
      return a ? (a.textContent.trim().slice(0, 80) + '|disp=' + getComputedStyle(a).display) : 'sin-toast'; })(),
  }))()`);
});
await parada('salon-reservar-barra', async () => {
  await evalJs(`window.scrollTo(0, document.body.scrollHeight)`); await sleep(400);
  await clic('#btn-salon-reservar'); await sleep(1800);
  return await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    resumen: document.getElementById('rm-txt')?.textContent.trim(),
    precio: document.getElementById('rm-precio')?.textContent.trim(),
  }))()`);
});
/* ---------- 7 · Reserva completa (pack, fecha futura) ---------- */
let tokenFutura = null, codigoFutura = null;
await parada('reserva-paso1', async () => {
  await evalJs(`ir('p-inicio')`); await sleep(600);
  await clic('#pastilla-reservar'); await sleep(1200);
  return await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    seleccionadas: [...document.querySelectorAll('#res-servicios .servicio-card.sel')].map(c => c.dataset.servicio),
    resumen: document.getElementById('rm-txt')?.textContent.trim(),
    precio: document.getElementById('rm-precio')?.textContent.trim(),
  }))()`);
}, 'a19-reserva-paso1');
await parada('reserva-paso2-calendario-horas', async () => {
  await clic('#btn-paso1-siguiente'); await sleep(800);
  await clic('#cal-sig'); await sleep(600);
  const mesTxt = await evalJs(`document.getElementById('cal-mes')?.textContent.trim()`);
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${FUTURA}"])?.click()`);
  const hayHoras = await esperar(`document.querySelectorAll('#huecos .hora-fila').length > 0`, 15000);
  const antes = await evalJs(`(() => ({
    total: document.querySelectorAll('#huecos .hora-fila').length,
    visibles: [...document.querySelectorAll('#huecos .hora-fila')].filter(b => b.style.display !== 'none').length,
    hayMas: !!document.querySelector('#huecos #btn-mas-huecos'),
  }))()`);
  let trasMas = null;
  if (antes.hayMas) {
    await evalJs(`document.querySelector('#huecos #btn-mas-huecos').click()`);
    await sleep(400);
    trasMas = await evalJs(`[...document.querySelectorAll('#huecos .hora-fila')].filter(b => b.style.display !== 'none').length`);
  }
  await shot('a20-reserva-paso2');
  await evalJs(`document.querySelector('#huecos .hora-fila:not([style*="none"])')?.click()`);
  await sleep(500);
  const elegido = await evalJs(`(() => ({
    hora: document.querySelector('#huecos .hora-fila.sel')?.dataset.hora,
    resumen: document.getElementById('rm-txt')?.textContent.trim(),
  }))()`);
  return { mesTxt, hayHoras, antes, trasMas, elegido };
}, 'a21-reserva-horas');
await parada('reserva-paso3-confirmar', async () => {
  await clic('#btn-paso2-siguiente'); await sleep(700);
  const sinDatos = await evalJs(`document.getElementById('btn-confirmar').disabled`);
  await evalJs(`(() => {
    const n = document.getElementById('inp-nombre'); n.value = 'QA18 Barrido';
    n.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('inp-notas'); t.value = 'Cita de prueba del barrido QA18';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(400);
  const sinCheck = await evalJs(`document.getElementById('btn-confirmar').disabled`);
  await clic('#check-confirma'); await sleep(400);
  const conCheck = await evalJs(`document.getElementById('btn-confirmar').disabled`);
  await shot('a22-reserva-paso3');
  await clic('#btn-confirmar');
  const confirmada = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 25000);
  await sleep(800);
  const datos = await evalJs(`(() => {
    const guardada = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || '{}');
    return {
      codigo: document.getElementById('conf-codigo')?.textContent.trim(),
      detalle: document.getElementById('conf-detalle')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200),
      enlace: document.getElementById('conf-enlace')?.textContent.trim(),
      token: guardada.token || (guardada.enlace || '').split('/cita/')[1] || null,
    };
  })()`);
  tokenFutura = datos.token; codigoFutura = datos.codigo;
  LOG.tokens.futura = { codigo: datos.codigo, hayToken: !!datos.token };
  return { sinDatos, sinCheck, conCheck, confirmada, codigo: datos.codigo,
           detalle: datos.detalle, enlaceOk: !!datos.enlace };
}, 'a23-confirmada');
await parada('confirmada-ics-copiar-micita', async () => {
  await clic('#btn-ics'); await sleep(800);
  const ics = await evalJs(`(async () => {
    const b = window.__blobs[window.__blobs.length - 1];
    if (!b) return 'SIN-BLOB';
    const t = await b.text();
    return t.split('\\r\\n').filter(l => /^(DTSTART|DTEND|SUMMARY|DESCRIPTION)/.test(l)).join(' | ').slice(0, 260);
  })()`);
  await clic('#btn-copiar-enlace'); await sleep(700);
  const copiado = await evalJs(`document.getElementById('conf-copiado')?.style.display`);
  await clic('#conf-ver-cita'); await sleep(1200);
  const micita = await evalJs(`(() => ({
    activa: document.querySelector('.pantalla.activa')?.id,
    datos: document.getElementById('micita-datos')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200),
  }))()`);
  return { ics, copiadoDisplay: copiado, micita };
}, 'a24-micita');

/* ---------- 8 · Perfil con contenido ---------- */
await parada('perfil-con-contenido', async () => {
  await clic('#nav-perfil'); await sleep(1000);
  const antes = await evalJs(`(() => ({
    guardados: document.getElementById('guardados-lista')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160),
  }))()`);
  await evalJs(`(() => {
    const n = document.getElementById('perf-nombre'); n.value = 'QA18';
    const t = document.getElementById('perf-telefono'); t.value = '600000000';
  })()`);
  await clic('#btn-perfil-guardar'); await sleep(600);
  const estado = await evalJs(`document.getElementById('perfil-estado')?.textContent.trim()`);
  return { antes, estadoTrasGuardar: estado };
}, 'a25-perfil');

/* ---------- 9 · /cita/<token> de la futura: ver, prep, reagendar ---------- */
await parada('cita-ver', async () => {
  if (!tokenFutura) return { error: 'sin token de la reserva' };
  await NAVEGAR(WEB + '/cita/' + tokenFutura);
  const visible = await esperar(`document.getElementById('contenido').style.display !== 'none'`, 12000);
  return { visible, datos: await evalJs(`document.getElementById('cita-datos')?.innerHTML.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').trim().slice(0, 200)`),
           pastilla: await evalJs(`document.getElementById('cita-estado')?.textContent.trim()`),
           codigo: await evalJs(`document.getElementById('cita-codigo')?.textContent.trim()`) };
}, 'a26-cita-ver');
await parada('cita-prep', async () => {
  await evalJs(`document.querySelector('#prep-tratamiento .seg[data-valor="Sí"]').click()`);
  await sleep(300);
  await evalJs(`(() => { const i = document.getElementById('prep-cual'); i.value = 'henna hace 3 semanas'; })()`);
  await evalJs(`document.querySelector('#prep-retinol .seg[data-valor="No"]').click()`);
  await clic('#btn-prep');
  const ok = await esperar(`document.getElementById('prep-ok').classList.contains('visible')`, 12000);
  return { okVisible: ok, txt: await evalJs(`document.getElementById('prep-ok')?.textContent.trim()`) };
}, 'a27-cita-prep');
await parada('cita-reagendar', async () => {
  await evalJs(`(() => { const i = document.getElementById('inp-fecha'); i.value = '${REAG}'; i.dispatchEvent(new Event('change')); })()`);
  const hayHuecos = await esperar(`document.querySelectorAll('#huecos .hueco').length > 0`, 15000);
  await evalJs(`document.querySelector('#huecos .hueco')?.click()`);
  await sleep(400);
  const hab = await evalJs(`document.getElementById('btn-reagendar').disabled`);
  await clic('#btn-reagendar');
  const ok = await esperar(`document.getElementById('reagendar-ok').classList.contains('visible') || document.getElementById('reagendar-error').classList.contains('visible')`, 15000);
  return { hayHuecos, btnDeshabilitadoTrasElegir: hab, resultado: ok,
           okTxt: await evalJs(`document.getElementById('reagendar-ok')?.textContent.trim()`),
           datosAhora: await evalJs(`document.getElementById('cita-datos')?.innerHTML.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').trim().slice(0, 200)`) };
}, 'a28-cita-reagendada');

/* ---------- 10 · Dos citas de HOY desde la UI ---------- */
async function crearCitaHoy(nombre) {
  await NAVEGAR(WEB + '/');
  await evalJs(`ir('p-inicio')`); await sleep(500);
  await clic('#pastilla-reservar'); await sleep(1000);
  await evalJs(`(() => {
    const henna = document.querySelector('#res-servicios .servicio-card[data-servicio="Ombré Brows Henna"]');
    if (henna && henna.classList.contains('sel')) henna.click();
    const lam = document.querySelector('#res-servicios .servicio-card[data-servicio="Brow Lamination"]');
    if (lam && lam.classList.contains('sel')) lam.click();
    const dep = document.querySelector('#res-servicios .servicio-card[data-servicio="Depilación rápida"]');
    if (dep && dep.classList.contains('sel')) dep.click();
  })()`);
  await sleep(300);
  await clic('#btn-paso1-siguiente'); await sleep(700);
  // El mes en vista puede ser noviembre (de la reserva futura): volver a octubre.
  for (let i = 0; i < 3; i++) {
    const mes = await evalJs(`document.getElementById('cal-mes')?.textContent.trim()`);
    if (mes && mes.includes('octubre')) break;
    await clic('#cal-ant'); await sleep(400);
  }
  await evalJs(`document.querySelector('.cal-dia[data-fecha="${HOY}"])?.click()`);
  const hay = await esperar(`document.querySelectorAll('#huecos .hora-fila').length > 0`, 15000);
  if (!hay) return { error: 'sin horas hoy' };
  const hora = await evalJs(`(() => { const b = document.querySelector('#huecos .hora-fila:not([style*="none"])'); b && b.click(); return b?.dataset.hora; })()`);
  await sleep(400);
  await clic('#btn-paso2-siguiente'); await sleep(600);
  await evalJs(`(() => { const n = document.getElementById('inp-nombre'); n.value = ${JSON.stringify(nombre)}; n.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await clic('#check-confirma'); await sleep(300);
  await clic('#btn-confirmar');
  const conf = await esperar(`document.getElementById('p-confirmada').classList.contains('activa')`, 25000);
  await sleep(700);
  const datos = await evalJs(`(() => {
    const g = JSON.parse(localStorage.getItem('la-asistenta-cita-v1') || '{}');
    return { codigo: document.getElementById('conf-codigo')?.textContent.trim(),
             token: g.token || (g.enlace || '').split('/cita/')[1] || null };
  })()`);
  return { confirmada: conf, hora, ...datos };
}
let citaHoyA = null, citaHoyB = null;
await parada('cita-hoy-a', async () => {
  citaHoyA = await crearCitaHoy('QA18 Hoy A');
  LOG.tokens.hoyA = { codigo: citaHoyA.codigo, hayToken: !!citaHoyA.token };
  return { codigo: citaHoyA.codigo, hora: citaHoyA.hora, confirmada: citaHoyA.confirmada };
}, 'a29-confirmada-hoy-a');
await parada('cita-hoy-b', async () => {
  citaHoyB = await crearCitaHoy('QA18 Hoy B');
  LOG.tokens.hoyB = { codigo: citaHoyB.codigo, hayToken: !!citaHoyB.token };
  return { codigo: citaHoyB.codigo, hora: citaHoyB.hora, confirmada: citaHoyB.confirmada };
});

/* ---------- 11 · Profesional ---------- */
let sesionVieja = null;
await parada('pro-acceso-y-clave-mala', async () => {
  await NAVEGAR(WEB + '/profesional');
  await shot('a30-pro-acceso');
  const sinSesion = await evalJs(`fetch('/api/profesional/hoy').then(r => r.status)`);
  await evalJs(`(() => { document.getElementById('clave').value = 'clave-incorrecta-qa18'; })()`);
  await clic('#btn-entrar');
  const hayError = await esperar(`document.getElementById('acceso-error').textContent.trim().length > 0`, 10000);
  return { statusSinSesion: sinSesion, hayError,
           errorTxt: await evalJs(`document.getElementById('acceso-error')?.textContent.trim()`),
           panelVisible: await evalJs(`!document.getElementById('vista-panel').classList.contains('oculto')`) };
}, 'a31-pro-clave-mala');
await parada('pro-entrar-hoy', async () => {
  const envTxt = readFileSync('/data/la-asistenta/web/profesional.env', 'utf8');
  const claveReal = (envTxt.match(/PROFESIONAL_CLAVE=(.+)/) || [])[1]?.trim();
  if (!claveReal) return { error: 'sin clave en el fichero' };
  await evalJs(`(() => { document.getElementById('clave').value = ${JSON.stringify(claveReal)}; })()`);
  await clic('#btn-entrar');
  const dentro = await esperar(`!document.getElementById('vista-panel').classList.contains('oculto') && document.querySelectorAll('#hoy-citas .cita').length > 0`, 20000);
  sesionVieja = await evalJs(`sessionStorage.getItem('la-asistenta-pro-sesion')`);
  return { dentro, resumen: await evalJs(`document.getElementById('hoy-resumen')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160)`),
           citasHoy: await evalJs(`[...document.querySelectorAll('#hoy-citas .cita .quien b')].map(e => e.textContent.trim())`) };
}, 'a32-pro-hoy');
await parada('pro-marcar-cumplidas-y-bandeja', async () => {
  const marcar = async codigo => {
    await evalJs(`(() => {
      const card = [...document.querySelectorAll('#hoy-citas .cita')].find(c => c.textContent.includes(${JSON.stringify('CODIGO')}));
      const b = card && card.querySelector('[data-accion="cumplida"]');
      b && b.click();
    })()`.replace('CODIGO', codigo));
    await sleep(2500);
  };
  if (citaHoyA?.codigo) await marcar(citaHoyA.codigo);
  if (citaHoyB?.codigo) await marcar(citaHoyB.codigo);
  const estados = await evalJs(`[...document.querySelectorAll('#hoy-citas .cita')].filter(c => c.textContent.includes('QA18')).map(c => {
    const chip = c.querySelector('.chip[class*="estado"]'); return chip ? chip.textContent.trim() : '?'; })`);
  const nBandeja = await evalJs(`document.querySelectorAll('#hoy-bandeja .bandeja-item').length`);
  await shot('a33-pro-bandeja');
  // Descartar los mensajes de las citas de prueba: bandeja limpia al final.
  for (let i = 0; i < 3; i++) {
    const hay = await evalJs(`(() => { const b = document.querySelector('#hoy-bandeja .bandeja-item [data-estado="descartada"]'); if (b) { b.click(); return true; } return false; })()`);
    if (!hay) break;
    await sleep(2200);
  }
  const bandejaFinal = await evalJs(`document.getElementById('hoy-bandeja')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 120)`);
  return { estadosQA18: estados, nBandejaTrasCumplir: nBandeja, bandejaFinal };
});
await parada('pro-agenda', async () => {
  await evalJs(`document.querySelector('.tab[data-tab="agenda"]').click()`);
  await sleep(1500);
  const dias = await evalJs(`document.querySelectorAll('#agenda-dias .dia').length`);
  await shot('a34-pro-agenda');
  await evalJs(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(600);
  return { dias };
}, 'a35-pro-agenda-abajo');
await parada('pro-espera', async () => {
  await evalJs(`window.scrollTo(0, 0)`);
  await evalJs(`document.querySelector('.tab[data-tab="espera"]').click()`);
  await sleep(1500);
  return { texto: await evalJs(`document.getElementById('espera-lista')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160)`) };
}, 'a36-pro-espera');
await parada('pro-negocio', async () => {
  await evalJs(`document.querySelector('.tab[data-tab="panel"]').click()`);
  await sleep(1500);
  await shot('a37-pro-negocio');
  await evalJs(`document.getElementById('panel-servicios')?.scrollIntoView({ block: 'center' })`);
  await sleep(600);
  await clic('#btn-editar-carta'); await sleep(500);
  return { embudo: await evalJs(`document.getElementById('panel-embudo')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 160)`),
           servicios: await evalJs(`document.getElementById('panel-servicios')?.textContent.trim().replace(/\\s+/g, ' ').slice(0, 200)`),
           notaEdicion: await evalJs(`(() => { const n = document.getElementById('nota-edicion'); return n.classList.contains('oculto') ? 'oculta' : n.textContent.trim().slice(0, 100); })()`) };
}, 'a38-pro-negocio-servicios');
await parada('pro-salir', async () => {
  await clic('#btn-salir'); await sleep(800);
  const acceso = await evalJs(`!document.getElementById('vista-acceso').classList.contains('oculto')`);
  const conSesionMuerta = sesionVieja
    ? await evalJs(`fetch('/api/profesional/hoy', { headers: { 'X-Sesion-Pro': ${JSON.stringify(sesionVieja)} } }).then(r => r.status)`)
    : 'sin-sesion-guardada';
  return { vuelveAcceso: acceso, statusConSesionMuerta: conSesionMuerta };
});

/* ---------- 12 · D-02: la página de la cita con estado cumplida ---------- */
await parada('d02-cita-cumplida-reagendar', async () => {
  if (!citaHoyA?.token) return { error: 'sin token A' };
  await NAVEGAR(WEB + '/cita/' + citaHoyA.token);
  await esperar(`document.getElementById('contenido').style.display !== 'none' || document.getElementById('cancelada').style.display !== 'none'`, 12000);
  const antes = await evalJs(`(() => ({
    pastilla: document.getElementById('cita-estado')?.textContent.trim(),
    clasePastilla: document.getElementById('cita-estado')?.className,
    reagendarVisible: document.getElementById('tarjeta-reagendar') ? getComputedStyle(document.getElementById('tarjeta-reagendar')).display !== 'none' : 'no-esta',
    cancelarVisible: document.getElementById('tarjeta-cancelar') ? getComputedStyle(document.getElementById('tarjeta-cancelar')).display !== 'none' : 'no-esta',
    prepVisible: document.getElementById('tarjeta-prep') ? getComputedStyle(document.getElementById('tarjeta-prep')).display !== 'none' : 'no-esta',
  }))()`);
  await shot('a39-cita-cumplida-a');
  await evalJs(`(() => { const i = document.getElementById('inp-fecha'); i.value = '${REAG2}'; i.dispatchEvent(new Event('change')); })()`);
  const hayHuecos = await esperar(`document.querySelectorAll('#huecos .hueco').length > 0`, 15000);
  let intento = 'sin-huecos';
  if (hayHuecos) {
    await evalJs(`document.querySelector('#huecos .hueco')?.click()`);
    await sleep(400);
    await clic('#btn-reagendar');
    await esperar(`document.getElementById('reagendar-ok').classList.contains('visible') || document.getElementById('reagendar-error').classList.contains('visible')`, 15000);
    intento = await evalJs(`(() => ({
      ok: document.getElementById('reagendar-ok')?.textContent.trim(),
      error: document.getElementById('reagendar-error')?.textContent.trim(),
      datos: document.getElementById('cita-datos')?.innerHTML.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').trim().slice(0, 160),
    }))()`);
  }
  return { antes, hayHuecos, intento };
}, 'a40-cita-cumplida-reagendar');
await parada('d02-cita-cumplida-cancelar', async () => {
  if (!citaHoyB?.token) return { error: 'sin token B' };
  await NAVEGAR(WEB + '/cita/' + citaHoyB.token);
  await esperar(`document.getElementById('contenido').style.display !== 'none' || document.getElementById('cancelada').style.display !== 'none'`, 12000);
  const pastilla = await evalJs(`document.getElementById('cita-estado')?.textContent.trim()`);
  await shot('a41-cita-cumplida-b');
  await clic('#btn-cancelar'); await sleep(500);
  await clic('#btn-cancelar-si');
  await sleep(3000);
  return { pastilla, trasCancelar: await evalJs(`(() => ({
    vistaCancelada: document.getElementById('cancelada').style.display !== 'none',
    errorTxt: document.getElementById('cancelar-error')?.textContent.trim(),
    contenidoVisible: document.getElementById('contenido').style.display !== 'none',
  }))()`) };
}, 'a42-cita-cumplida-cancelar');

/* ---------- 13 · Cancelar la cita futura desde su enlace ---------- */
await parada('cita-futura-cancelar', async () => {
  if (!tokenFutura) return { error: 'sin token futura' };
  await NAVEGAR(WEB + '/cita/' + tokenFutura);
  await esperar(`document.getElementById('contenido').style.display !== 'none'`, 12000);
  await clic('#btn-cancelar'); await sleep(600);
  await shot('a43-cita-cancelar-confirmacion');
  await clic('#btn-cancelar-si');
  const cancelada = await esperar(`document.getElementById('cancelada').style.display !== 'none'`, 12000);
  await shot('a44-cita-cancelada');
  await S('Page.reload', {}); await sleep(2500);
  return { cancelada, trasRecarga: await evalJs(`(() => ({
    sigueCancelada: document.getElementById('cancelada').style.display !== 'none',
    datos: document.getElementById('cita-datos-2')?.innerHTML.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '').trim().slice(0, 160),
  }))()`) };
});

/* ---------- 14 · Sin conexión ---------- */
await parada('offline', async () => {
  await S('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await NAVEGAR(WEB + '/');
  await sleep(1500);
  const r = await evalJs(`(() => { const b = document.getElementById('banner-offline');
    return { existe: !!b, visible: b ? getComputedStyle(b).display !== 'none' : false,
             txt: b?.textContent.trim().slice(0, 100) }; })()`);
  await S('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  return r;
}, 'a45-offline');

guardarLog();
console.log('FASE A COMPLETA · paradas:', LOG.paradas.length, '· errores consola:', LOG.consola.length);
try { ws.close(); } catch {}
chrome.kill();
process.exit(0);
