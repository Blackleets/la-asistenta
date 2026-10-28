#!/usr/bin/env python3
"""Servidor web de la clienta de LA ASISTENTA (solo stdlib).

Superficie principal aprobada en H0: experiencia mobile-first para explorar
el análisis de cejas con IA y reservar en la agenda REAL del salón.

Piezas:
  GET  /                     → index.html (la experiencia completa)
  GET  /ejemplo.jpg          → foto de ejemplo autorizada (stock, sin clientas)
  GET  /salud                → {ok, servicio}
  GET  /api/servicios        → carta real (proxy de la API de agenda, 8081)
  GET  /api/disponibilidad   → huecos REALES: ?servicio=..&fecha=YYYY-MM-DD
  POST /api/analizar         → foto + preferencias → análisis REAL con Muse
                               Spark Open vía Baseten (llamada directa).
                               La foto vive solo en memoria: no se guarda,
                               no se registra, no sale de esta petición.
  POST /api/reservar         → valida hueco (horario + anti-solape) contra la
                               agenda real, crea la cita y la VERIFICA
                               releyéndola antes de decir «confirmada».

La IA interpreta; la agenda decide. Este servidor no inventa horarios ni
confirmaciones: la disponibilidad sale de las citas confirmadas de agenda.db
y el precio/duración salen siempre de la carta, nunca del cliente.

Secretos: la clave de Baseten se lee en el servidor del fichero .env de
Hermes (BASETEN_ENV_FILE) y el token de la agenda de AGENDA_API_TOKEN.
Ningún secreto llega al navegador ni a los logs.
"""

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("WEB_PORT", "8090"))
AGENDA_API = os.environ.get("AGENDA_API", "http://127.0.0.1:8081").rstrip("/")
AGENDA_TOKEN = os.environ.get("AGENDA_API_TOKEN", "la-asistenta-dev")
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
_LIMITES = {"/api/analizar": (10, 3600), "/api/reservar": (30, 3600)}
_rl = {}


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

def agenda_req(metodo, ruta, cuerpo=None, timeout=15):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(AGENDA_API + ruta, data=datos, method=metodo)
    req.add_header("X-API-Token", AGENDA_TOKEN)
    if datos:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


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


def huecos_libres(servicio, fecha_iso):
    """Huecos reales de inicio para un servicio en una fecha.

    Devuelve (lista_de_horas, motivo_si_vacio). La verdad es agenda.db:
    intervalos ocupados = citas confirmadas [hora, hora+duración).
    """
    servicios = {s["nombre"]: s for s in carta()}
    if servicio not in servicios:
        return None, "servicio fuera de la carta real"
    dur = servicios[servicio]["duracion_min"]
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
    with urllib.request.urlopen(req, timeout=150) as r:
        datos = json.loads(r.read().decode("utf-8"))
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

    # -- rutas
    def do_GET(self):
        ruta = self.path.split("?")[0]
        if ruta == "/salud":
            return self._json(200, {"ok": True, "servicio": "la-asistenta-web"})
        if ruta == "/":
            return self._fichero(os.path.join(BASE_DIR, "index.html"),
                                 "text/html; charset=utf-8")
        if ruta == "/ejemplo.jpg":
            return self._fichero(os.path.join(BASE_DIR, "ejemplo.jpg"), "image/jpeg")
        if ruta.startswith("/fonts/"):
            nombre = os.path.basename(ruta)
            return self._fichero(os.path.join(BASE_DIR, "fonts", nombre),
                                 "font/woff2")
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
            fecha = (qs.get("fecha") or [""])[0]
            if not FECHA_RE.match(fecha):
                return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
            try:
                libres, motivo = huecos_libres(servicio, fecha)
            except Exception:
                return self._json(502, {"error": "la agenda no responde ahora mismo"})
            if libres is None:
                return self._json(400, {"error": motivo})
            return self._json(200, {"servicio": servicio, "fecha": fecha,
                                    "huecos": libres, "motivo": motivo})
        return self._json(404, {"error": "ruta no encontrada"})

    def do_POST(self):
        ip = self.client_address[0]
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
        t0 = time.time()
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
        # La foto queda SOLO en memoria durante esta petición: no se guarda.
        data_uri = f"data:{mime};base64,{b64}"
        del crudo, b64, imagen
        try:
            contenido, lat = analizar_con_spark(data_uri, prefs)
            analisis = validar_analisis(contenido)
            if analisis is None:  # un reintento, y solo uno
                contenido, lat = analizar_con_spark(data_uri, prefs)
                analisis = validar_analisis(contenido)
            if analisis is None:
                log("analisis_no_valido", latencia_s=lat)
                return self._json(502, {"error": "el análisis no salió bien; inténtalo de nuevo"})
        except urllib.error.URLError:
            log("analisis_sin_red", duracion_s=round(time.time() - t0, 2))
            return self._json(502, {"error": "el servicio de análisis no responde; inténtalo en un minuto"})
        except Exception as e:
            log("analisis_error", tipo=type(e).__name__)
            return self._json(502, {"error": "el análisis falló; inténtalo de nuevo"})
        log("analisis_ok", latencia_s=lat)
        por_nombre = {s["nombre"]: s for s in carta()}
        return self._json(200, {
            "analisis": analisis,
            "latencia_s": lat,
            "carta": {n: {"precio_etiqueta": s["precio_etiqueta"],
                          "duracion_min": s["duracion_min"]}
                      for n, s in por_nombre.items()},
            "aviso": ("Análisis real con Muse Spark. La propuesta visual "
                      "generada (ver tus cejas con el servicio aplicado) aún "
                      "no está disponible: no mostramos imágenes falsas."),
        })

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
        try:
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
        # Crear en la agenda real…
        try:
            _, creada = agenda_req("POST", "/citas", {
                "nombre": nombre, "servicio": servicio, "fecha": fecha,
                "hora": hora, "telefono": telefono,
                "notas": (notas or "") + " [reserva web]" if notas else "reserva web",
            })
            cita = creada["cita"]
            # …y verificar releyendo antes de anunciarla como confirmada.
            _, datos_dia = agenda_req("GET", f"/citas?fecha={fecha}")
            ok = any(c["id"] == cita["id"] and c["estado"] == "confirmada"
                     for c in datos_dia.get("citas", []))
        except urllib.error.HTTPError as e:
            try:
                detalle = json.loads(e.read().decode("utf-8")).get("error", "")
            except Exception:
                detalle = ""
            log("reserva_rechazada", detalle=detalle)
            return self._json(400, {"error": detalle or "la agenda rechazó la reserva"})
        except Exception:
            return self._json(502, {"error": "la agenda no responde ahora mismo"})
        if not ok:
            log("reserva_sin_verificar", cita_id=cita.get("id"))
            return self._json(502, {"error": "la reserva no pudo verificarse; no la des por hecha y avísanos"})
        log("reserva_ok", cita_id=cita["id"])
        return self._json(201, {"cita": cita, "verificada": True})


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    log("arranque", puerto=PORT, agenda=AGENDA_API)
    srv.serve_forever()


if __name__ == "__main__":
    main()
