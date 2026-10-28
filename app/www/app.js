/* La Asistenta · Ari Vivas Beauty — lógica de la app
   Lee/escribe la agenda REAL vía la API (agenda_api.py, misma agenda.db). */
'use strict';

/* Carta real (respaldo si la API no responde; los datos son los verificados) */
const CARTA_REAL = [
  { nombre: 'Diseño de cejas',   precio_eur: 18,   precio_etiqueta: '18 €',      duracion_min: 25 },
  { nombre: 'Ombré Brows Henna', precio_eur: 30,   precio_etiqueta: '30 €',      duracion_min: 65 },
  { nombre: 'Brow Lamination',   precio_eur: 45,   precio_etiqueta: '45 €',      duracion_min: 65 },
  { nombre: 'Depilación rápida', precio_eur: null, precio_etiqueta: 'Consultar', duracion_min: 12 },
];

const cfg = {
  get api()   { return (localStorage.getItem('apiBase') || 'http://127.0.0.1:8081').replace(/\/+$/, ''); },
  set api(v)  { localStorage.setItem('apiBase', v); },
  get token() { return localStorage.getItem('apiToken') || 'la-asistenta-dev'; },
  set token(v){ localStorage.setItem('apiToken', v); },
};

const $ = (s) => document.querySelector(s);
const hoyISO = () => { const d = new Date(); return d.toISOString().slice(0, 10); };

async function api(path, opts = {}) {
  const r = await fetch(cfg.api + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-API-Token': cfg.token, ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

function setConn(ok) {
  const d = $('#conn-dot');
  d.className = 'conn-dot ' + (ok ? 'ok' : 'ko');
  d.title = ok ? 'Agenda conectada' : 'Sin conexión con la agenda';
}

function fmtFechaLarga(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function tarjetaCita(c, conCancelar) {
  const el = document.createElement('article');
  el.className = 'cita' + (c.estado === 'cancelada' ? ' cancelada' : '');
  const origen = c.origen === 'whatsapp' ? 'WhatsApp' : (c.origen === 'app' ? 'App' : c.origen || '');
  el.innerHTML = `
    <div class="cita-hora"><b></b><span>${c.duracion_min} min</span></div>
    <div class="cita-info">
      <div class="cita-nombre"></div>
      <div class="cita-detalle"></div>
      <div class="cita-meta">
        <span class="precio"></span>
        <span class="chip chip-${c.estado}"></span>
        ${origen ? `<span class="chip chip-origen">${origen}</span>` : ''}
      </div>
    </div>`;
  el.querySelector('.cita-hora b').textContent = c.hora;
  el.querySelector('.cita-nombre').textContent = c.nombre;
  el.querySelector('.cita-detalle').textContent = c.servicio + (c.telefono ? ' · ' + c.telefono : '');
  el.querySelector('.precio').textContent = c.precio_etiqueta || (c.precio_eur ? c.precio_eur + ' €' : '');
  el.querySelector('.chip').textContent = c.estado;
  if (conCancelar && c.estado !== 'cancelada') {
    const b = document.createElement('button');
    b.className = 'btn-cancelar'; b.textContent = 'Cancelar';
    b.addEventListener('click', () => pedirCancelar(c));
    el.appendChild(b);
  }
  return el;
}

async function cargarCitas(fecha, listaSel, vacioSel, conCancelar) {
  const lista = $(listaSel), vacio = $(vacioSel);
  lista.innerHTML = '';
  try {
    const { citas } = await api('/citas?fecha=' + fecha);
    setConn(true);
    citas.forEach((c) => lista.appendChild(tarjetaCita(c, conCancelar)));
    vacio.hidden = citas.length > 0;
    return citas;
  } catch (e) {
    setConn(false);
    vacio.hidden = false;
    vacio.innerHTML = `
      <svg class="vacio-ic"><use href="#i-brow"/></svg>
      <p class="vacio-tit">Sin conexión con la agenda</p>
      <p class="vacio-txt">Ahora mismo no se pueden cargar las citas de este día. Cuando la agenda vuelva a estar conectada, aparecerán aquí.</p>
      <button type="button" class="btn-enlace" data-goto="estado">Revisar la conexión</button>`;
    return null;
  }
}

/* ---------- HOY ---------- */
async function cargarHoy() {
  $('#hoy-fecha').textContent = fmtFechaLarga(hoyISO());
  const citas = await cargarCitas(hoyISO(), '#hoy-lista', '#hoy-vacio', false);
  if (!citas) { $('#stat-citas').textContent = '–'; $('#stat-ingresos').textContent = '–'; return; }
  const activas = citas.filter((c) => c.estado !== 'cancelada');
  const ingresos = activas.reduce((s, c) => s + (c.precio_eur || 0), 0);
  $('#stat-citas').textContent = activas.length;
  $('#stat-ingresos').textContent = ingresos.toLocaleString('es-ES') + ' €';
}

/* ---------- AGENDA ---------- */
async function cargarAgenda() {
  const fecha = $('#agenda-fecha').value || hoyISO();
  await cargarCitas(fecha, '#agenda-lista', '#agenda-vacio', true);
}

/* cancelar con confirmación */
let citaACancelar = null;
function pedirCancelar(c) {
  citaACancelar = c;
  $('#modal-texto').textContent = `¿Cancelar la cita de ${c.nombre} (${c.servicio}, ${c.fecha} a las ${c.hora})? La cita quedará marcada como cancelada en la agenda real.`;
  $('#modal').hidden = false;
}
$('#modal-no').addEventListener('click', () => { $('#modal').hidden = true; citaACancelar = null; });
$('#modal-si').addEventListener('click', async () => {
  if (!citaACancelar) return;
  try {
    await api('/citas/' + citaACancelar.id + '/cancelar', { method: 'POST' });
    setConn(true);
  } catch (e) { setConn(false); mostrarToast('No se pudo cancelar la cita. Revisa la conexión e inténtalo de nuevo.'); }
  $('#modal').hidden = true; citaACancelar = null;
  cargarAgenda(); cargarHoy();
});

/* ---------- NUEVA CITA ---------- */
function rellenarServicios(servicios) {
  const sel = $('#nueva-servicio');
  sel.innerHTML = '';
  servicios.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.nombre;
    o.textContent = `${s.nombre} · ${s.precio_etiqueta} · ${s.duracion_min} min`;
    sel.appendChild(o);
  });
  const lista = $('#servicios-lista');
  lista.innerHTML = '';
  servicios.forEach((s) => {
    const el = document.createElement('article');
    el.className = 'serv-card';
    el.innerHTML = `<div class="serv-info"><div class="serv-nombre"></div><div class="serv-dur"><svg class="ic-xs"><use href="#i-clock"/></svg>${s.duracion_min} minutos</div></div><i class="leader"></i><div class="serv-precio">${s.precio_etiqueta}</div>`;
    el.querySelector('.serv-nombre').textContent = s.nombre;
    lista.appendChild(el);
  });
}

async function cargarServicios() {
  try {
    const { servicios } = await api('/servicios');
    setConn(true);
    rellenarServicios(servicios);
  } catch (e) {
    rellenarServicios(CARTA_REAL); // misma carta real como respaldo visual
  }
}

$('#form-nueva').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('#nueva-msg');
  msg.textContent = 'Guardando…'; msg.className = 'msg';
  const datos = {
    nombre: $('#nueva-nombre').value.trim(),
    servicio: $('#nueva-servicio').value,
    fecha: $('#nueva-fecha').value,
    hora: $('#nueva-hora').value,
    telefono: $('#nueva-telefono').value.trim() || undefined,
  };
  try {
    const { cita } = await api('/citas', { method: 'POST', body: JSON.stringify(datos) });
    setConn(true);
    msg.textContent = `Cita guardada: ${cita.nombre}, ${cita.servicio}, ${cita.fecha} a las ${cita.hora}.`;
    msg.className = 'msg ok';
    ev.target.reset();
    $('#nueva-fecha').value = hoyISO();
    if ($('#agenda-fecha').value === cita.fecha) cargarAgenda();
    cargarHoy();
  } catch (e) {
    setConn(false);
    msg.textContent = 'No se pudo guardar. Revisa la conexión con la agenda e inténtalo de nuevo.';
    msg.className = 'msg ko';
  }
});

/* ---------- ESTADO ---------- */
async function comprobarAPI() {
  const dot = $('#api-dot'), nota = $('#api-nota');
  try {
    await api('/salud');
    dot.className = 'dot dot-on';
    nota.textContent = 'Conectada — la app lee y escribe la agenda real (' + cfg.api + ')';
    setConn(true);
    return true;
  } catch (e) {
    dot.className = 'dot dot-wait';
    nota.textContent = 'Sin conexión con ' + cfg.api + ' — comprueba que la API está encendida y la URL es la correcta.';
    setConn(false);
    return false;
  }
}
$('#cfg-guardar').addEventListener('click', async () => {
  cfg.api = $('#cfg-api').value.trim() || cfg.api;
  cfg.token = $('#cfg-token').value.trim() || cfg.token;
  $('#cfg-api').value = cfg.api; $('#cfg-token').value = cfg.token;
  const ok = await comprobarAPI();
  const msg = $('#cfg-msg');
  msg.textContent = ok ? 'Conexión correcta. Recargando datos…' : 'Sin conexión. Revisa la URL y el token.';
  msg.className = 'msg ' + (ok ? 'ok' : 'ko');
  if (ok) { cargarHoy(); cargarAgenda(); cargarServicios(); }
});

/* ---------- avisos y atajos (solo presentación) ---------- */
let toastTimer = null;
function mostrarToast(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3400);
}
document.addEventListener('click', (ev) => {
  const ir = ev.target.closest('[data-goto]');
  if (ir) {
    const tab = document.querySelector('.tab[data-view="' + ir.dataset.goto + '"]');
    if (tab) tab.click();
    return;
  }
  const dia = ev.target.closest('[data-setday]');
  if (dia) {
    const d = new Date();
    d.setDate(d.getDate() + Number(dia.dataset.setday || 0));
    const inp = $('#agenda-fecha');
    inp.value = d.toISOString().slice(0, 10);
    inp.dispatchEvent(new Event('change'));
  }
});

/* ---------- navegación ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    const v = t.dataset.view;
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
    if (v === 'hoy') cargarHoy();
    if (v === 'agenda') cargarAgenda();
    if (v === 'estado') comprobarAPI();
  });
});

/* ---------- arranque ---------- */
(function init() {
  $('#cfg-api').value = cfg.api;
  $('#cfg-token').value = cfg.token;
  $('#agenda-fecha').value = hoyISO();
  $('#nueva-fecha').value = hoyISO();
  $('#agenda-fecha').addEventListener('change', cargarAgenda);
  cargarServicios();
  cargarHoy();
})();
