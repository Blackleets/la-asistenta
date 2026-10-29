#!/usr/bin/env python3
"""Servidor web de la clienta de LA ASISTENTA (solo stdlib).

Superficie principal aprobada en H0: experiencia mobile-first para explorar
el análisis de cejas con IA y reservar en la agenda REAL del salón.

Piezas:
  GET  /                     → index.html (la experiencia completa)
  GET  /manifest.webmanifest → manifiesto PWA (instalable)
  GET  /sw.js                → service worker (cascarón en caché; la API no)
  GET  /icon.svg, /icons/…   → iconos PWA y pantallas de arranque
  GET  /img/…                → fotos REALES del salón y sus servicios,
                               de su propia web (arivivasbeauty.com),
                               autoalojadas en web/img/; ver ESTADO
  GET  /ejemplo.jpg          → foto de ejemplo autorizada (stock, sin clientas)
  GET  /salud                → {ok, servicio}
  GET  /api/servicios        → carta real (proxy de la API de agenda, 8081)
  GET  /api/disponibilidad   → huecos REALES: ?servicio=..&fecha=YYYY-MM-DD
                               v4: ?servicios=A,B (pack) calcula los
                               huecos con la duración TOTAL de la selección.
  POST /api/analizar         → foto + preferencias → crea un TRABAJO de
                               análisis (202 {id}) que corre en un hilo:
                               análisis REAL con Muse Spark Open vía
                               Baseten (llamada directa). Spark tarda de
                               segundos a >150 s y el proxy público corta
                               las peticiones largas, por eso la clienta
                               SONDEA en vez de esperar con la petición
                               abierta (antes veía «Error 502»).
  GET  /api/analizar/<id>    → {estado: en_curso|listo|error, ...} del
                               trabajo (TTL 10 min, solo en memoria).
                               La foto vive solo en memoria: no se guarda,
                               no se registra, no sale de este proceso.
  POST /api/reservar         → valida hueco (horario + anti-solape) contra la
                               agenda real, crea la cita y la VERIFICA
                               releyéndola antes de decir «confirmada».
                               v4: acepta {servicios: [...]} (pack): una
                               sola cita con duración/precio sumados y los
                               componentes en las notas; {servicio} sigue
                               funcionando igual que siempre.
                               La respuesta trae el código humano (AS-XXXX)
                               y el enlace mágico de la cita.
  GET  /cita/<token>         → página del enlace mágico post-reserva
                               (cita.html): la clienta ve su cita, responde
                               el mini-formulario de preparación y puede
                               cancelar o reagendar a un hueco real.
  GET  /api/cita/<token>     → datos de ESA cita (vía hash del token;
                               el token en claro no sale de esta petición).
  GET  /api/cita/<token>/huecos → huecos reales para reagendar.
  POST /api/cita/<token>/cancelar | /reagendar | /prep
                             → acciones sobre ESA cita (la guarda vive en
                               la API de agenda; aquí solo se hace proxy).
  POST /api/lista-espera     → alta en la lista de espera activa (cuando el
                               día no tiene huecos). El aviso de hueco
                               liberado NO se envía automáticamente
                               (Twilio trial no lo permite): la entrada
                               queda «por_avisar» en el panel del salón.
  GET  /profesional          → área profesional de la dueña (profesional.html):
                               acceso con clave del negocio que vive SOLO en
                               el servidor (profesional.env / PROFESIONAL_CLAVE)
                               y sesión con caducidad de 8 h. Sin sesión, las
                               rutas /api/profesional/* devuelven 401 y no
                               revelan ni un dato.
  POST /api/profesional/acceso → {clave} → {sesion, ttl_s} (rate-limit).
  GET  /api/profesional/hoy | /agenda | /espera | /bandeja | /embudo |
       /api/profesional/servicios → proxies autenticados a la agenda real
                               (hoy con resumen y bandeja pendiente; agenda
                               con intervalos libres reales; espera con el
                               enlace wa.me para que la profesional avise
                               A MANO — la app no envía ese aviso sola).
  POST /api/profesional/citas/<id>/estado|cancelar, espera|bandeja/<id>/estado
                             → acciones reales sobre la API de agenda.
                               Servicios y horarios son SOLO LECTURA aquí.

La IA interpreta; la agenda decide. Este servidor no inventa horarios ni
confirmaciones: la disponibilidad sale de las citas confirmadas de agenda.db
y el precio/duración salen siempre de la carta, nunca del cliente.

Secretos: la clave de Baseten se lee en el servidor del fichero .env de
Hermes (BASETEN_ENV_FILE) y el token de la agenda de AGENDA_API_TOKEN.
Ningún secreto llega al navegador ni a los logs.
"""

import base64
import hashlib
import json
import os
import re
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("WEB_PORT", "8090"))
AGENDA_API = os.environ.get("AGENDA_API", "http://127.0.0.1:8081").rstrip("/")
# Token SOLO desde el entorno (sin literal en el código: hallazgo D7,
# Fase 2). En la máquina lo aporta agenda/agenda.env vía arrancar.sh.
AGENDA_TOKEN = (os.environ.get("AGENDA_API_TOKEN") or "").strip()
if not AGENDA_TOKEN:
    raise SystemExit(
        "AGENDA_API_TOKEN no está definido en el entorno: la web no "
        "arranca sin poder hablar con la agenda (en la máquina, "
        "agenda/agenda.env vía arrancar.sh)")
BASETEN_ENV_FILE = os.environ.get(
    "BASETEN_ENV_FILE", "/data/la-asistenta/hermes-home/.env"
)
BASETEN_URL = "https://inference.baseten.co/v1/chat/completions"
SPARK_MODEL = os.environ.get("SPARK_MODEL", "meta-models/muse-spark-open-1026")
MAX_BODY = 8 * 1024 * 1024  # 8 MB: foto razonable como data URI
MIN_TOKENS_SALIDA = 4096  # Spark razona: con menos, la respuesta visible sale vacía

# Carta real (respaldo si la API de agenda no responde; la fuente de verdad
# es /api/servicios de la agenda y se usa siempre que esté disponible).
CARTA_RESPALDO = [
    {"nombre": "Diseño de cejas", "precio_eur": 18.0, "precio_etiqueta": "18 €", "duracion_min": 25},
    {"nombre": "Ombré Brows Henna", "precio_eur": 30.0, "precio_etiqueta": "30 €", "duracion_min": 65},
    {"nombre": "Brow Lamination", "precio_eur": 45.0, "precio_etiqueta": "45 €", "duracion_min": 65},
    {"nombre": "Depilación rápida", "precio_eur": None, "precio_etiqueta": "Consultar", "duracion_min": 12},
]

# Horario real: L–V 10:00–20:00 · S 10:00–14:00 · D cerrado (minutos del día).
HORARIO = {0: (600, 1200), 1: (600, 1200), 2: (600, 1200), 3: (600, 1200),
           4: (600, 1200), 5: (600, 840), 6: None}
PASO_MIN = 15

FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MIMES_OK = {"image/jpeg", "image/png", "image/webp"}

# Rate limit sencillo en memoria: (ruta, ip) -> [timestamps]
_LIMITES = {"/api/analizar": (10, 3600), "/api/reservar": (30, 3600),
            "/api/cita": (120, 3600), "/api/lista-espera": (30, 3600),
            "/api/profesional/acceso": (8, 900)}
_rl = {}

TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16,80}$")


def log(evento, **kw):
    fila = {"ts": datetime.now().astimezone().isoformat(timespec="seconds"),
            "evento": evento, **kw}
    sys.stderr.write("[web] " + json.dumps(fila, ensure_ascii=False) + "\n")
    sys.stderr.flush()


def rate_ok(ruta, ip):
    if ruta not in _LIMITES:
        return True
    maximos, ventana = _LIMITES[ruta]
    ahora = time.time()
    lista = [t for t in _rl.get((ruta, ip), []) if ahora - t < ventana]
    if len(lista) >= maximos:
        _rl[(ruta, ip)] = lista
        return False
    lista.append(ahora)
    _rl[(ruta, ip)] = lista
    return True


# ---------------- agenda ----------------

def agenda_req(metodo, ruta, cuerpo=None, timeout=15, cabeceras=None):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(AGENDA_API + ruta, data=datos, method=metodo)
    req.add_header("X-API-Token", AGENDA_TOKEN)
    if datos:
        req.add_header("Content-Type", "application/json")
    for k, v in (cabeceras or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def agenda_req_estado(metodo, ruta, cuerpo=None, timeout=15, cabeceras=None):
    """Como agenda_req pero sin lanzar en errores HTTP: devuelve
    (status, json) también para 4xx (p. ej. el 409 de reagendar con sus
    alternativas, que la página del enlace debe mostrar tal cual)."""
    try:
        return agenda_req(metodo, ruta, cuerpo, timeout, cabeceras)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {}


def anotar_evento(tipo, origen="web", cita_id=None):
    """Embudo medido: anota un evento en la agenda sin bloquear la
    petición de la clienta (hilo aparte, errores ignorados a propósito:
    medir nunca debe romper reservar)."""
    def _enviar():
        try:
            agenda_req("POST", "/eventos",
                       {"tipo": tipo, "origen": origen, "cita_id": cita_id},
                       timeout=5)
        except Exception:
            pass
    threading.Thread(target=_enviar, daemon=True).start()


def hash_de_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


_carta_cache = {"ts": 0, "datos": None}


def carta():
    ahora = time.time()
    if _carta_cache["datos"] and ahora - _carta_cache["ts"] < 60:
        return _carta_cache["datos"]
    try:
        _, datos = agenda_req("GET", "/servicios")
        lista = datos["servicios"]
    except Exception:
        lista = CARTA_RESPALDO
    _carta_cache.update(ts=ahora, datos=lista)
    return lista


def a_min(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def a_hhmm(minutos):
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _huecos_con_duracion(dur, fecha_iso):
    """Núcleo de huecos_libres: inicios libres para una DURACIÓN dada.

    La verdad es agenda.db: intervalos ocupados = citas confirmadas
    [hora, hora+duración). Devuelve (lista, motivo_si_vacio)."""
    try:
        f = date.fromisoformat(fecha_iso)
    except ValueError:
        return None, "fecha no válida"
    horario = HORARIO[f.weekday()]
    if horario is None:
        return [], "domingo cerrado"
    apertura, cierre = horario
    _, datos = agenda_req("GET", f"/citas?fecha={fecha_iso}")
    ocupados = []
    for c in datos.get("citas", []):
        if c.get("estado") == "confirmada":
            ini = a_min(c["hora"])
            ocupados.append((ini, ini + int(c["duracion_min"])))
    libres = []
    t = apertura
    while t + dur <= cierre:
        if all(t + dur <= o_ini or t >= o_fin for o_ini, o_fin in ocupados):
            libres.append(a_hhmm(t))
        t += PASO_MIN
    return libres, None


def huecos_libres(servicio, fecha_iso):
    """Huecos reales de inicio para un servicio en una fecha.

    Devuelve (lista_de_horas, motivo_si_vacio)."""
    servicios = {s["nombre"]: s for s in carta()}
    if servicio not in servicios:
        return None, "servicio fuera de la carta real"
    return _huecos_con_duracion(int(servicios[servicio]["duracion_min"]),
                                fecha_iso)


def huecos_libres_pack(nombres, fecha_iso):
    """Huecos reales de inicio para una selección múltiple (pack, v4):
    la duración que bloquea es la SUMA de los servicios elegidos (la
    duración sale de la carta de la agenda, nunca del cliente)."""
    servicios = {s["nombre"]: s for s in carta()}
    if not nombres or any(n not in servicios for n in nombres):
        return None, "servicio fuera de la carta real"
    dur = sum(int(servicios[n]["duracion_min"]) for n in nombres)
    return _huecos_con_duracion(dur, fecha_iso)


# ---------------- Spark (Baseten) ----------------

_clave_cache = {}


def clave_baseten():
    if "k" not in _clave_cache:
        with open(BASETEN_ENV_FILE, encoding="utf-8") as f:
            for linea in f:
                if linea.startswith("BASETEN_API_KEY="):
                    _clave_cache["k"] = linea.split("=", 1)[1].strip().strip('"').strip("'")
                    break
        if "k" not in _clave_cache:
            raise RuntimeError("BASETEN_API_KEY no encontrada en el .env del servidor")
    return _clave_cache["k"]


PROMPT_SISTEMA = (
    "Eres La Asistenta de un salón de belleza. Analizas la foto de las cejas "
    "de una clienta y sus preferencias, y respondes SOLO con un JSON válido, "
    "sin texto fuera del JSON, con esta forma exacta: "
    '{"resumen": "2-3 frases cálidas en español sobre sus cejas", '
    '"forma": "…", "grosor": "…", "densidad": "…", "huecos": "…", '
    '"servicio_recomendado": "uno de la carta, nombre exacto", '
    '"motivo": "por qué ese servicio, 1-2 frases", '
    '"servicio_alternativo": "otro de la carta, nombre exacto", '
    '"motivo_alternativo": "cuándo preferirlo, 1 frase", '
    '"consejo": "un consejo breve de cuidado"}'
)


def analizar_con_spark(data_uri, preferencias):
    carta_txt = "; ".join(
        f'{s["nombre"]} ({s["precio_etiqueta"]} · {s["duracion_min"]} min)'
        for s in carta()
    )
    texto = (
        f"Carta real del salón: {carta_txt}. "
        f"Preferencias de la clienta: naturalidad {preferencias.get('naturalidad')}, "
        f"grosor deseado {preferencias.get('grosor')}, arco {preferencias.get('arco')}, "
        f"tono {preferencias.get('tono')}, intensidad {preferencias.get('intensidad')}. "
        "Analiza la foto y recomienda respetando sus preferencias y la carta."
    )
    cuerpo = {
        "model": SPARK_MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_SISTEMA},
            {"role": "user", "content": [
                {"type": "text", "text": texto},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ]},
        ],
        "max_tokens": MIN_TOKENS_SALIDA,
    }
    req = urllib.request.Request(
        BASETEN_URL, data=json.dumps(cuerpo).encode("utf-8"), method="POST"
    )
    req.add_header("Authorization", "Bearer " + clave_baseten())
    req.add_header("Content-Type", "application/json")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            datos = json.loads(r.read().decode("utf-8"))
    except (socket.timeout, TimeoutError):
        raise SparkTarda()
    except urllib.error.URLError as e:
        if isinstance(getattr(e, "reason", None), (socket.timeout, TimeoutError)):
            raise SparkTarda()
        raise
    lat = round(time.time() - t0, 2)
    contenido = (datos.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    return contenido, lat


def validar_analisis(contenido):
    """Devuelve el dict validado o None. Nada se muestra sin validar."""
    txt = contenido.strip()
    if txt.startswith("```"):
        txt = re.sub(r"^```(json)?|```$", "", txt, flags=re.M).strip()
    ini, fin = txt.find("{"), txt.rfind("}")
    if ini < 0 or fin <= ini:
        return None
    try:
        d = json.loads(txt[ini:fin + 1])
    except Exception:
        return None
    nombres = {s["nombre"] for s in carta()}
    if d.get("servicio_recomendado") not in nombres:
        return None
    if d.get("servicio_alternativo") not in nombres:
        d["servicio_alternativo"] = None
        d["motivo_alternativo"] = None
    for campo in ("resumen", "forma", "grosor", "densidad", "huecos", "motivo", "consejo"):
        if not isinstance(d.get(campo), str) or not d[campo].strip():
            return None
    return d


# ---------------- trabajos de análisis (asíncronos) ----------------

class SparkTarda(Exception):
    """La llamada a Spark agotó los 150 s: NO tiene sentido reintentar."""


# id -> {"creado", "estado", "resultado", "error"}; solo en memoria.
TRABAJOS = {}
TRABAJOS_LOCK = threading.Lock()
TRABAJO_TTL = 600  # 10 min: de sobra para sondear y leer el resultado


def _limpiar_trabajos():
    corte = time.time() - TRABAJO_TTL
    with TRABAJOS_LOCK:
        for tid in [t for t, tr in TRABAJOS.items() if tr["creado"] < corte]:
            del TRABAJOS[tid]


MSG_TARDA = ("El análisis tardó más de lo normal y se cortó. Tu foto no se "
             "guardó: inténtalo de nuevo en un momento.")
MSG_SIN_RED = ("El servicio de análisis no responde ahora mismo. "
               "Inténtalo de nuevo en un minuto.")
MSG_FALLO = "El análisis falló por un problema técnico. Inténtalo de nuevo."
MSG_NO_VALIDO = ("El análisis no salió bien esta vez. Prueba con otra foto "
                 "o inténtalo de nuevo.")


def ejecutar_analisis(data_uri, prefs):
    """Corre Spark y valida la salida. Devuelve (payload, None) o
    (None, mensaje_humano). Reintento SOLO si la respuesta llegó pero el
    JSON no validó; tras un timeout, jamás se reintenta."""
    try:
        contenido, lat = analizar_con_spark(data_uri, prefs)
    except SparkTarda:
        log("analisis_timeout")
        return None, MSG_TARDA
    except urllib.error.URLError:
        log("analisis_sin_red")
        return None, MSG_SIN_RED
    except Exception as e:
        log("analisis_error", tipo=type(e).__name__)
        return None, MSG_FALLO
    analisis = validar_analisis(contenido)
    if analisis is None:
        try:
            contenido, lat = analizar_con_spark(data_uri, prefs)
            analisis = validar_analisis(contenido)
        except SparkTarda:
            log("analisis_timeout_reintento")
            return None, MSG_TARDA
        except Exception as e:
            log("analisis_error", tipo=type(e).__name__)
            return None, MSG_FALLO
    if analisis is None:
        log("analisis_no_valido", latencia_s=lat)
        return None, MSG_NO_VALIDO
    log("analisis_ok", latencia_s=lat)
    por_nombre = {s["nombre"]: s for s in carta()}
    return {
        "analisis": analisis,
        "latencia_s": lat,
        "carta": {n: {"precio_etiqueta": s["precio_etiqueta"],
                      "duracion_min": s["duracion_min"]}
                  for n, s in por_nombre.items()},
        "aviso": ("Análisis real con Muse Spark. La propuesta visual "
                  "generada (ver tus cejas con el servicio aplicado) aún "
                  "no está disponible: no mostramos imágenes falsas."),
    }, None


def _trabajo_analisis(tid, data_uri, prefs):
    payload, mensaje = ejecutar_analisis(data_uri, prefs)
    with TRABAJOS_LOCK:
        tr = TRABAJOS.get(tid)
        if tr is None:  # caducó antes de terminar: se descarta
            return
        if payload is not None:
            tr.update(estado="listo", resultado=payload)
        else:
            tr.update(estado="error", error=mensaje)


# ---------------- área profesional (la dueña del negocio) ----------------
# Vista /profesional: Arianna administra su salón (hoy, agenda, lista
# de espera, bandeja y embudo) sin tocar el CLI ni el panel demo.
# Acceso con una CLAVE DEL NEGOCIO que vive SOLO en el servidor:
# variable de entorno PROFESIONAL_CLAVE o fichero profesional.env
# junto a este servidor (en la máquina: /data/la-asistenta/web/
# profesional.env, permisos 600). La clave no está en el repo, no
# sale en los logs y NO es el token demo de la agenda. Sin clave
# configurada, el acceso responde 503 (el área no se abre con
# ninguna contraseña «de demo»).
# Sesión simple en memoria: token aleatorio con caducidad (8 h, una
# jornada de salón); al reiniciar el servidor hay que entrar de nuevo.

PROFESIONAL_ENV_FILE = os.environ.get(
    "PROFESIONAL_ENV_FILE", os.path.join(BASE_DIR, "profesional.env"))
SESION_PRO_TTL = 8 * 3600
SESIONES_PRO = {}
SESIONES_PRO_LOCK = threading.Lock()
_pro_clave_cache = {}


def _zona_salon():
    """Zona horaria del salón para «hoy» (la máquina corre en UTC:
    sin esto, el «hoy» de la profesional saltaría a medianoche UTC)."""
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo("Europe/Madrid")
    except Exception:
        return datetime.now().astimezone().tzinfo


def hoy_salon():
    return datetime.now(_zona_salon()).date()


def clave_profesional():
    if "k" in _pro_clave_cache:
        return _pro_clave_cache["k"]
    valor = os.environ.get("PROFESIONAL_CLAVE", "").strip()
    if not valor:
        try:
            with open(PROFESIONAL_ENV_FILE, encoding="utf-8") as f:
                for linea in f:
                    if linea.startswith("PROFESIONAL_CLAVE="):
                        valor = linea.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except FileNotFoundError:
            valor = ""
    _pro_clave_cache["k"] = valor or None
    return _pro_clave_cache["k"]


def _sesion_pro_crear():
    token = secrets.token_urlsafe(32)
    with SESIONES_PRO_LOCK:
        SESIONES_PRO[token] = time.time() + SESION_PRO_TTL
    return token


def _sesion_pro_valida(token):
    if not token:
        return False
    ahora = time.time()
    with SESIONES_PRO_LOCK:
        caduca = SESIONES_PRO.get(token)
        if caduca is None:
            return False
        if caduca < ahora:
            del SESIONES_PRO[token]
            return False
    return True


def _sesion_pro_borrar(token):
    with SESIONES_PRO_LOCK:
        SESIONES_PRO.pop(token, None)


def rangos_libres(fecha_iso, citas):
    """Intervalos libres REALES de un día: [apertura, cierre) menos
    los intervalos de las citas confirmadas. No depende de ningún
    servicio: es el hueco de agenda en bruto, sin inventar ocupación.
    Devuelve None si el salón cierra ese día (domingo)."""
    f = date.fromisoformat(fecha_iso)
    horario = HORARIO[f.weekday()]
    if horario is None:
        return None
    apertura, cierre = horario
    ocupados = sorted(
        (a_min(c["hora"]), a_min(c["hora"]) + int(c["duracion_min"]))
        for c in citas if c.get("estado") == "confirmada")
    libres = []
    t = apertura
    for ini, fin in ocupados:
        if ini > t:
            libres.append({"desde": a_hhmm(t), "hasta": a_hhmm(ini)})
        t = max(t, fin)
    if t < cierre:
        libres.append({"desde": a_hhmm(t), "hasta": a_hhmm(cierre)})
    return libres


def wa_aviso_espera(entrada):
    """Enlace wa.me para que la PROFESIONAL avise a mano a una
    clienta de la lista de espera: la app no envía este aviso sola
    (Twilio trial no permite salientes libres); al tocarlo se abre
    el WhatsApp de Arianna con el texto listo y ella lo envía."""
    from urllib.parse import quote
    tel = re.sub(r"\D", "", entrada.get("telefono") or "")
    if not tel:
        return None
    nombre = (entrada.get("nombre") or "").split(" ")[0]
    servicio = entrada.get("servicio") or "tu servicio"
    texto = (f"¡Hola {nombre}! 💖 Soy Arianna, de Ari Vivas Beauty. "
             f"Se ha liberado un hueco para tu {servicio}: si te viene "
             f"bien, escríbeme y te confirmo la hora exacta.")
    return f"https://wa.me/{tel}?text={quote(texto)}"


# ---------------- HTTP ----------------

class Handler(BaseHTTPRequestHandler):
    server_version = "LaAsistentaWeb/1.0"

    def log_message(self, fmt, *args):  # logs propios, sin cuerpos
        pass

    # -- utilidades
    def _enviar(self, codigo, tipo, cuerpo):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _json(self, codigo, obj):
        self._enviar(codigo, "application/json; charset=utf-8",
                     json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def _leer_json(self):
        largo = int(self.headers.get("Content-Length") or 0)
        if largo > MAX_BODY:
            return "grande"
        if largo == 0:
            return {}
        try:
            return json.loads(self.rfile.read(largo).decode("utf-8"))
        except Exception:
            return None

    def _fichero(self, ruta, tipo):
        try:
            with open(ruta, "rb") as f:
                self._enviar(200, tipo, f.read())
        except FileNotFoundError:
            self._json(404, {"error": "no encontrado"})

    def _fichero_cache(self, ruta, tipo, cache_control):
        """Como _fichero pero con Cache-Control propio (activos PWA)."""
        try:
            with open(ruta, "rb") as f:
                cuerpo = f.read()
        except FileNotFoundError:
            return self._json(404, {"error": "no encontrado"})
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", cache_control)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(cuerpo)

    # -- rutas
    def do_GET(self):
        ruta = self.path.split("?")[0]
        if ruta == "/salud":
            return self._json(200, {"ok": True, "servicio": "la-asistenta-web"})
        if ruta == "/":
            return self._fichero(os.path.join(BASE_DIR, "index.html"),
                                 "text/html; charset=utf-8")
        if ruta == "/manifest.webmanifest":
            return self._fichero_cache(
                os.path.join(BASE_DIR, "manifest.webmanifest"),
                "application/manifest+json", "no-cache")
        if ruta == "/sw.js":
            return self._fichero_cache(
                os.path.join(BASE_DIR, "sw.js"),
                "text/javascript; charset=utf-8", "no-cache")
        if ruta == "/icon.svg":
            return self._fichero_cache(
                os.path.join(BASE_DIR, "icon.svg"),
                "image/svg+xml", "public, max-age=86400")
        if ruta.startswith("/icons/"):
            nombre = os.path.basename(ruta)
            return self._fichero_cache(
                os.path.join(BASE_DIR, "icons", nombre),
                "image/png", "public, max-age=604800")
        if ruta == "/ejemplo.jpg":
            return self._fichero(os.path.join(BASE_DIR, "ejemplo.jpg"), "image/jpeg")
        if ruta.startswith("/img/"):
            nombre = os.path.basename(ruta)
            return self._fichero_cache(
                os.path.join(BASE_DIR, "img", nombre),
                "image/jpeg", "public, max-age=604800")
        if ruta.startswith("/fonts/"):
            nombre = os.path.basename(ruta)
            return self._fichero(os.path.join(BASE_DIR, "fonts", nombre),
                                 "font/woff2")
        if ruta == "/api/modulos":
            # Registro central de módulos (plataforma modular): la
            # interfaz lo lee para pintar la estantería de la home, los
            # chips de Explorar y la pantalla de próxima apertura.
            # Activar un módulo = cambiar su estado en modulos.json.
            return self._fichero_cache(
                os.path.join(BASE_DIR, "modulos.json"),
                "application/json; charset=utf-8", "no-cache")
        if ruta == "/profesional":
            # Página del área profesional: _fichero manda no-store;
            # es personal y nunca se cachea (el SW tampoco la guarda).
            return self._fichero(os.path.join(BASE_DIR, "profesional.html"),
                                 "text/html; charset=utf-8")
        if ruta.startswith("/api/profesional/"):
            return self._pro_get(ruta)
        if ruta == "/api/servicios":
            try:
                _, datos = agenda_req("GET", "/servicios")
                return self._json(200, datos)
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if ruta == "/api/disponibilidad":
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            servicio = (qs.get("servicio") or [""])[0]
            servicios_qs = (qs.get("servicios") or [""])[0]
            fecha = (qs.get("fecha") or [""])[0]
            if not FECHA_RE.match(fecha):
                return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
            try:
                if servicios_qs:
                    # v4: pack — los huecos se calculan con la duración
                    # TOTAL de la selección (suma de la carta).
                    nombres = list(dict.fromkeys(
                        n.strip() for n in servicios_qs.split(",") if n.strip()))
                    libres, motivo = huecos_libres_pack(nombres, fecha)
                    servicio = " + ".join(nombres)
                else:
                    libres, motivo = huecos_libres(servicio, fecha)
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            if libres is None:
                return self._json(400, {"error": motivo})
            anotar_evento("hueco_propuesto", "web")
            return self._json(200, {"servicio": servicio, "fecha": fecha,
                                    "huecos": libres, "motivo": motivo})
        if ruta.startswith("/api/analizar/"):
            return self._estado_analisis(ruta[len("/api/analizar/"):])
        m = re.match(r"^/cita/([A-Za-z0-9_-]{16,80})$", ruta)
        if m:
            return self._fichero(os.path.join(BASE_DIR, "cita.html"),
                                 "text/html; charset=utf-8")
        m = re.match(r"^/api/cita/([A-Za-z0-9_-]{16,80})(/huecos)?$", ruta)
        if m:
            return self._cita_get(m.group(1), con_huecos=bool(m.group(2)))
        return self._json(404, {"error": "ruta no encontrada"})

    def _cita_get(self, token, con_huecos=False):
        """Datos de la cita del enlace mágico (proxy a la API de agenda
        por el HASH del token; el token en claro no sale de aquí)."""
        ip = self.client_address[0]
        if not rate_ok("/api/cita", ip):
            return self._json(429, {"error": "demasiadas peticiones; espera un poco"})
        h = hash_de_token(token)
        try:
            if con_huecos:
                from urllib.parse import urlparse, parse_qs
                qs = parse_qs(urlparse(self.path).query)
                fecha = (qs.get("fecha") or [""])[0]
                if not FECHA_RE.match(fecha):
                    return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
                st, datos = agenda_req_estado(
                    "GET", f"/enlace/{h}/huecos?fecha={fecha}")
                if st == 200:
                    anotar_evento("hueco_propuesto", "web")
            else:
                st, datos = agenda_req_estado("GET", f"/enlace/{h}")
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if st == 404:
            return self._json(404, {"error": "este enlace no corresponde a ninguna cita; "
                                            "pide al salón que te lo reenvíe"})
        return self._json(st, datos)

    def _estado_analisis(self, tid):
        _limpiar_trabajos()
        with TRABAJOS_LOCK:
            tr = TRABAJOS.get(tid)
            copia = dict(tr) if tr else None
        if copia is None:
            return self._json(404, {"error": "ese análisis ya no existe; lanza uno nuevo"})
        if copia["estado"] == "listo":
            return self._json(200, {"estado": "listo", **copia["resultado"]})
        if copia["estado"] == "error":
            return self._json(200, {"estado": "error", "error": copia["error"]})
        return self._json(200, {"estado": "en_curso",
                                "segundos": int(time.time() - copia["creado"])})

    def do_POST(self):
        ip = self.client_address[0]
        if self.path.split("?")[0].startswith("/api/profesional/"):
            return self._pro_post(ip)
        m = re.match(r"^/api/cita/([A-Za-z0-9_-]{16,80})/(cancelar|reagendar|prep)$",
                     self.path)
        if m:
            if not rate_ok("/api/cita", ip):
                return self._json(429, {"error": "demasiadas peticiones; espera un poco"})
            datos = self._leer_json()
            if datos is None:
                return self._json(400, {"error": "petición no válida"})
            return self._cita_post(m.group(1), m.group(2),
                                   datos if isinstance(datos, dict) else {})
        if self.path == "/api/lista-espera":
            if not rate_ok("/api/lista-espera", ip):
                return self._json(429, {"error": "demasiadas peticiones; espera un poco"})
            datos = self._leer_json()
            if not isinstance(datos, dict):
                return self._json(400, {"error": "petición no válida"})
            return self._lista_espera(datos)
        if self.path == "/api/analizar":
            if not rate_ok("/api/analizar", ip):
                return self._json(429, {"error": "demasiados análisis seguidos; espera un poco"})
            datos = self._leer_json()
            if datos == "grande":
                return self._json(413, {"error": "la foto es demasiado grande (máx. ~6 MB)"})
            if not isinstance(datos, dict):
                return self._json(400, {"error": "petición no válida"})
            return self._analizar(datos)
        if self.path == "/api/reservar":
            if not rate_ok("/api/reservar", ip):
                return self._json(429, {"error": "demasiadas reservas seguidas; espera un poco"})
            datos = self._leer_json()
            if not isinstance(datos, dict):
                return self._json(400, {"error": "petición no válida"})
            return self._reservar(datos)
        return self._json(404, {"error": "ruta no encontrada"})

    def _analizar(self, datos):
        imagen = datos.get("imagen") or ""
        prefs = datos.get("preferencias") or {}
        m = re.match(r"^data:(image/[a-z]+);base64,(.+)$", imagen, re.S)
        if not m:
            return self._json(400, {"error": "foto no válida: usa JPG, PNG o WebP"})
        mime, b64 = m.group(1), m.group(2)
        if mime not in MIMES_OK:
            return self._json(400, {"error": "formato no admitido: usa JPG, PNG o WebP"})
        try:
            crudo = base64.b64decode(b64, validate=True)
        except Exception:
            return self._json(400, {"error": "la foto llegó dañada; prueba otra vez"})
        if len(crudo) < 2000 or len(crudo) > 6 * 1024 * 1024:
            return self._json(400, {"error": "la foto debe pesar entre 2 KB y 6 MB"})
        # La foto queda SOLO en memoria, en el trabajo: no se guarda.
        data_uri = f"data:{mime};base64,{b64}"
        del crudo, b64, imagen
        # La llamada a Spark puede tardar >150 s y el proxy público corta
        # las peticiones largas: el análisis corre en un hilo y la clienta
        # sondea GET /api/analizar/<id> hasta que esté listo o falle.
        _limpiar_trabajos()
        tid = secrets.token_urlsafe(16)
        with TRABAJOS_LOCK:
            TRABAJOS[tid] = {"creado": time.time(), "estado": "en_curso",
                             "resultado": None, "error": None}
        threading.Thread(target=_trabajo_analisis,
                         args=(tid, data_uri, prefs), daemon=True).start()
        log("analisis_creado")
        return self._json(202, {"id": tid, "estado": "en_curso"})

    def _reservar(self, datos):
        nombre = (datos.get("nombre") or "").strip()
        servicio = (datos.get("servicio") or "").strip()
        fecha = (datos.get("fecha") or "").strip()
        hora = (datos.get("hora") or "").strip()
        telefono = (datos.get("telefono") or "").strip() or None
        notas = (datos.get("notas") or "").strip() or None
        if len(nombre) < 2 or len(nombre) > 60:
            return self._json(400, {"error": "escribe tu nombre (2–60 caracteres)"})
        if not FECHA_RE.match(fecha) or not HORA_RE.match(hora):
            return self._json(400, {"error": "fecha u hora no válidas"})
        hoy = datetime.now().astimezone().date()
        try:
            f = date.fromisoformat(fecha)
        except ValueError:
            return self._json(400, {"error": "fecha no válida"})
        if f < hoy or f > hoy + timedelta(days=60):
            return self._json(400, {"error": "elige una fecha entre hoy y los próximos 60 días"})
        # v4: selección múltiple (pack). Si viene «servicios» (lista),
        # manda; si no, el «servicio» de siempre. La disponibilidad se
        # calcula con la duración TOTAL de la selección.
        nombres = None
        crudos = datos.get("servicios")
        if isinstance(crudos, list) and crudos:
            nombres = []
            for crudo in crudos:
                crudo = crudo.strip() if isinstance(crudo, str) else ""
                if crudo and crudo not in nombres:
                    nombres.append(crudo)
            if not nombres:
                nombres = None
        try:
            if nombres:
                libres, motivo = huecos_libres_pack(nombres, fecha)
            else:
                libres, motivo = huecos_libres(servicio, fecha)
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if libres is None:
            return self._json(400, {"error": motivo})
        if hora not in libres:
            return self._json(409, {
                "error": "ese hueco ya no está libre",
                "alternativas": libres[:8],
                "motivo": motivo,
            })
        # Notas de la cita: en un pack, los componentes quedan escritos
        # (nombre, precio y duración de cada uno, de la carta) antes de
        # la nota de la clienta y de la marca de canal de siempre.
        if nombres and len(nombres) > 1:
            por_nombre = {s["nombre"]: s for s in carta()}
            detalle = " + ".join(
                f"{n} ({por_nombre[n]['precio_etiqueta']} · "
                f"{por_nombre[n]['duracion_min']} min)" for n in nombres)
            notas_txt = f"Pack: {detalle}"
            if notas:
                notas_txt += f" · Nota de la clienta: {notas}"
            notas_txt += " [reserva web]"
        else:
            notas_txt = (notas or "") + " [reserva web]" if notas else "reserva web"
        cuerpo_cita = {
            "nombre": nombre, "fecha": fecha, "hora": hora,
            "telefono": telefono, "origen": "web", "notas": notas_txt,
        }
        if nombres:
            cuerpo_cita["servicios"] = nombres
        else:
            cuerpo_cita["servicio"] = servicio
        # Crear en la agenda real… con clave de idempotencia propia de
        # ESTA petición (Fase 2): si el envío se reintentara, la agenda
        # devolvería la misma cita en vez de duplicarla.
        clave_idem = secrets.token_hex(16)
        try:
            _, creada = agenda_req("POST", "/citas", cuerpo_cita,
                                   cabeceras={"Idempotency-Key": clave_idem})
            cita = creada["cita"]
            # …y verificar releyendo antes de anunciarla como confirmada.
            _, datos_dia = agenda_req("GET", f"/citas?fecha={fecha}")
            ok = any(c["id"] == cita["id"] and c["estado"] == "confirmada"
                     for c in datos_dia.get("citas", []))
        except urllib.error.HTTPError as e:
            try:
                cuerpo_err = json.loads(e.read().decode("utf-8"))
            except Exception:
                cuerpo_err = {}
            detalle = cuerpo_err.get("error", "")
            log("reserva_rechazada", detalle=detalle)
            if e.code == 409:
                # La guarda de la agenda manda: se traslada su 409 con
                # las alternativas reales en vez de disfrazarlo de 400.
                return self._json(409, {
                    "error": detalle or "ese hueco ya no está libre",
                    "alternativas": cuerpo_err.get("alternativas", []),
                })
            return self._json(400, {"error": detalle or "la agenda rechazó la reserva"})
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if not ok:
            log("reserva_sin_verificar", cita_id=cita.get("id"))
            return self._json(502, {"error": "la reserva no pudo verificarse; no la des por hecha y avísanos"})
        log("reserva_ok", cita_id=cita["id"])
        return self._json(201, {"cita": cita, "verificada": True})

    def _cita_post(self, token, accion, datos):
        """Acciones del enlace mágico: proxy a la API de agenda por el
        hash del token. La guarda (anti-solape, horario, estados) vive
        en la agenda; aquí solo se traduce la respuesta."""
        h = hash_de_token(token)
        cuerpo = datos if accion in ("reagendar", "prep") else {}
        try:
            st, resp = agenda_req_estado("POST", f"/enlace/{h}/{accion}", cuerpo)
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if st == 404:
            return self._json(404, {"error": "este enlace no corresponde a ninguna cita; "
                                            "pide al salón que te lo reenvíe"})
        if st == 200:
            log("cita_" + accion, cita_id=(resp.get("cita") or {}).get("id"))
        return self._json(st, resp)

    # -- área profesional: acceso, sesión y proxies autenticados
    def _pro_autorizada(self):
        return _sesion_pro_valida(self.headers.get("X-Sesion-Pro", ""))

    def _pro_proxy_get(self, ruta_agenda):
        try:
            st, datos = agenda_req_estado("GET", ruta_agenda)
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if st != 200:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        return self._json(200, datos)

    def _pro_get(self, ruta):
        if not self._pro_autorizada():
            return self._json(401, {"error": "sesión no válida: entra con la clave del negocio"})
        if ruta == "/api/profesional/hoy":
            fecha = hoy_salon().isoformat()
            try:
                st, datos = agenda_req_estado("GET", f"/citas?fecha={fecha}")
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            if st != 200:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            citas = datos.get("citas", [])
            resumen = {"total": len(citas)}
            for estado in ("confirmada", "cumplida", "cancelada", "no_show"):
                resumen[estado] = sum(1 for c in citas if c.get("estado") == estado)
            try:
                _, bd = agenda_req("GET", "/bandeja?estado=pendiente")
                bandeja = bd.get("bandeja", [])
            except Exception:
                bandeja = []
            return self._json(200, {"fecha": fecha, "citas": citas,
                                    "resumen": resumen, "bandeja": bandeja})
        if ruta == "/api/profesional/agenda":
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            try:
                dias = int((qs.get("dias") or ["7"])[0])
            except ValueError:
                dias = 7
            dias = max(1, min(dias, 14))
            hoy = hoy_salon()
            salida = []
            try:
                for i in range(dias):
                    f = hoy + timedelta(days=i)
                    fecha = f.isoformat()
                    _, datos = agenda_req("GET", f"/citas?fecha={fecha}")
                    citas = datos.get("citas", [])
                    salida.append({
                        "fecha": fecha,
                        "cerrado": HORARIO[f.weekday()] is None,
                        "citas": citas,
                        "libres": rangos_libres(fecha, citas),
                    })
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            return self._json(200, {"desde": hoy.isoformat(), "dias": salida})
        if ruta == "/api/profesional/espera":
            try:
                st, datos = agenda_req_estado("GET", "/lista-espera")
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            if st != 200:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            entradas = []
            for e in datos.get("lista_espera", []):
                if e.get("estado") in ("por_avisar", "esperando"):
                    e = dict(e)
                    e["wa_link"] = wa_aviso_espera(e)
                    entradas.append(e)
            return self._json(200, {"lista_espera": entradas})
        if ruta == "/api/profesional/bandeja":
            return self._pro_proxy_get("/bandeja?estado=pendiente")
        if ruta == "/api/profesional/embudo":
            return self._pro_proxy_get("/embudo")
        if ruta == "/api/profesional/servicios":
            return self._pro_proxy_get("/servicios")
        return self._json(404, {"error": "ruta no encontrada"})

    def _pro_post(self, ip):
        ruta = self.path.split("?")[0]
        if ruta == "/api/profesional/acceso":
            if not rate_ok("/api/profesional/acceso", ip):
                return self._json(429, {"error": "demasiados intentos; espera unos minutos"})
            datos = self._leer_json()
            if not isinstance(datos, dict):
                return self._json(400, {"error": "petición no válida"})
            clave_real = clave_profesional()
            if clave_real is None:
                return self._json(503, {"error": "el área profesional aún no está activada en este servidor"})
            dada = str(datos.get("clave") or "")
            if not secrets.compare_digest(dada, clave_real):
                log("profesional_acceso_fallo")
                return self._json(401, {"error": "clave no válida"})
            log("profesional_acceso_ok")
            return self._json(200, {"sesion": _sesion_pro_crear(),
                                    "ttl_s": SESION_PRO_TTL})
        if not self._pro_autorizada():
            return self._json(401, {"error": "sesión no válida: entra con la clave del negocio"})
        if ruta == "/api/profesional/salir":
            _sesion_pro_borrar(self.headers.get("X-Sesion-Pro", ""))
            return self._json(200, {"ok": True})
        m = re.match(r"^/api/profesional/citas/(\d+)/(estado|cancelar)$", ruta)
        if m:
            cid, accion = int(m.group(1)), m.group(2)
            if accion == "cancelar":
                try:
                    st, resp = agenda_req_estado(
                        "POST", f"/citas/{cid}/cancelar", {})
                except Exception:
                    return self._json(502, {"error": "la agenda no responde ahora mismo"})
                if st == 200:
                    log("profesional_cita_cancelada", cita_id=cid)
                return self._json(st, resp)
            datos = self._leer_json()
            if not isinstance(datos, dict):
                return self._json(400, {"error": "petición no válida"})
            nuevo = (datos.get("estado") or "").strip()
            if nuevo not in ("cumplida", "no_show"):
                return self._json(400, {"error": "estado debe ser «cumplida» o «no_show»"})
            try:
                st, resp = agenda_req_estado(
                    "POST", f"/citas/{cid}/estado", {"estado": nuevo})
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            if st == 200:
                log("profesional_cita_estado", cita_id=cid, estado=nuevo)
            return self._json(st, resp)
        m = re.match(r"^/api/profesional/(espera|bandeja)/(\d+)/estado$", ruta)
        if m:
            datos = self._leer_json()
            if not isinstance(datos, dict):
                return self._json(400, {"error": "petición no válida"})
            nuevo = (datos.get("estado") or "").strip()
            if m.group(1) == "espera":
                if nuevo not in ("atendida", "descartada", "esperando"):
                    return self._json(400, {"error": "estado no válido para la lista de espera"})
                destino = f"/lista-espera/{m.group(2)}/estado"
            else:
                if nuevo not in ("enviada", "descartada", "pendiente"):
                    return self._json(400, {"error": "estado no válido para la bandeja"})
                destino = f"/bandeja/{m.group(2)}/estado"
            try:
                st, resp = agenda_req_estado("POST", destino, {"estado": nuevo})
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            return self._json(st, resp)
        return self._json(404, {"error": "ruta no encontrada"})

    def _lista_espera(self, datos):
        """Alta en la lista de espera activa (proxy a la agenda)."""
        cuerpo = {
            "nombre": (datos.get("nombre") or "").strip(),
            "telefono": (datos.get("telefono") or "").strip() or None,
            "servicio": (datos.get("servicio") or "").strip(),
            "fecha_pref": (datos.get("fecha_pref") or "").strip() or None,
            "hora_pref": (datos.get("hora_pref") or "").strip() or None,
            "origen": "web",
        }
        try:
            st, resp = agenda_req_estado("POST", "/lista-espera", cuerpo)
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if st == 201:
            log("lista_espera_alta", servicio=cuerpo["servicio"])
        return self._json(st, resp)


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    log("arranque", puerto=PORT, agenda=AGENDA_API)
    srv.serve_forever()


if __name__ == "__main__":
    main()
