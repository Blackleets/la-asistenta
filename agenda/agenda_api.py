#!/usr/bin/env python3
"""API mínima de la agenda de La Asistenta (solo stdlib).

Sirve la MISMA agenda real (agenda.db, tabla «citas») que usa el servidor MCP
de Hermes. La app Android de Arianna lee/escribe aquí; no hay otra agenda.

Arranque:
  python3 agenda_api.py [--port 8081] [--host 0.0.0.0]
  AGENDA_API_TOKEN=<token> python3 agenda_api.py   # token por cabecera

Autenticación: cabecera  X-API-Token: <token>
  (o Authorization: Bearer <token>). Token por defecto: «la-asistenta-dev»,
  pensado para la demo del hackathon en red local/túnel; cambiar con la
  variable de entorno AGENDA_API_TOKEN.

Endpoints:
  GET  /salud                      → {ok, servicio, bd}
  GET  /servicios                  → carta real del salón
  GET  /citas?fecha=YYYY-MM-DD     → citas de ese día (sin fecha: todas)
  POST /citas                      → alta {nombre, servicio, fecha, hora,
                                       telefono?, notas?} (precio y duración
                                       salen de la carta, no del cliente).
                                       Con guarda en el propio endpoint:
                                       horario del salón y anti-solape →
                                       409 con «alternativas» si el hueco
                                       no es reservable (mismo patrón que
                                       el servidor web de la clienta).
  POST /citas/<id>/cancelar        → estado = «cancelada»
"""

import argparse
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("AGENDA_DB", os.path.join(BASE_DIR, "agenda.db"))
TOKEN = os.environ.get("AGENDA_API_TOKEN", "la-asistenta-dev")

# Carta REAL del salón (verificada; no inventar otros servicios ni precios).
SERVICIOS = [
    {"nombre": "Diseño de cejas",    "precio_eur": 18.0, "precio_etiqueta": "18 €",      "duracion_min": 25},
    {"nombre": "Ombré Brows Henna",  "precio_eur": 30.0, "precio_etiqueta": "30 €",      "duracion_min": 65},
    {"nombre": "Brow Lamination",    "precio_eur": 45.0, "precio_etiqueta": "45 €",      "duracion_min": 65},
    {"nombre": "Depilación rápida",  "precio_eur": None, "precio_etiqueta": "Consultar", "duracion_min": 12},
]
POR_NOMBRE = {s["nombre"]: s for s in SERVICIOS}

HORARIO = {"lunes_viernes": "10:00–20:00", "sabado": "10:00–14:00", "domingo": "Cerrado"}

# Ventana de apertura en minutos del día por día de semana
# (date.weekday(): lunes=0 … domingo=6; None = cerrado). Misma semántica
# que web/web_server.py (HORARIO): la cita es válida si empieza a la
# apertura o después y TERMINA a la hora de cierre o antes, es decir,
# el intervalo [hora, hora+duración) queda dentro de la ventana.
VENTANA = {0: (600, 1200), 1: (600, 1200), 2: (600, 1200), 3: (600, 1200),
           4: (600, 1200), 5: (600, 840), 6: None}
PASO_MIN = 15  # rejilla de las horas alternativas (la misma que la web)

FECHA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

ESQUEMA = """
CREATE TABLE IF NOT EXISTS citas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en     TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    servicio      TEXT NOT NULL,
    fecha         TEXT NOT NULL,
    hora          TEXT NOT NULL,
    precio_eur    REAL NOT NULL,
    duracion_min  INTEGER NOT NULL,
    estado        TEXT NOT NULL DEFAULT 'confirmada',
    origen        TEXT NOT NULL DEFAULT 'whatsapp',
    telefono      TEXT,
    notas         TEXT
)
"""


def conectar():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(ESQUEMA)
    return conn


def _a_minutos(hora):
    h, m = hora.split(":")
    return int(h) * 60 + int(m)


def _a_hora(minutos):
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _confirmadas(conn, fecha):
    """Intervalos (id, ini, fin) ocupados por las citas confirmadas del día.

    Semántica del MCP (registrar_cita): solo bloquean las 'confirmada';
    las canceladas no ocupan el hueco.
    """
    filas = conn.execute(
        "SELECT id, hora, duracion_min FROM citas "
        "WHERE fecha = ? AND estado = 'confirmada' ORDER BY hora",
        (fecha,),
    ).fetchall()
    return [
        (f["id"], _a_minutos(f["hora"]), _a_minutos(f["hora"]) + int(f["duracion_min"]))
        for f in filas
    ]


def _alternativas(ocupados, apertura, cierre, duracion):
    """Inicios libres en rejilla de 15 min (hasta 8), como ofrece la web."""
    libres = []
    t = apertura
    while t + duracion <= cierre and len(libres) < 8:
        if all(t + duracion <= o_ini or t >= o_fin for _, o_ini, o_fin in ocupados):
            libres.append(_a_hora(t))
        t += PASO_MIN
    return libres


def fila_a_cita(row):
    cita = dict(row)
    carta = POR_NOMBRE.get(cita["servicio"])
    # «Consultar» se guarda como 0.0 (la columna es NOT NULL): la etiqueta
    # visible la pone la carta, no el número.
    cita["precio_etiqueta"] = carta["precio_etiqueta"] if carta else None
    return cita


class Handler(BaseHTTPRequestHandler):
    server_version = "AgendaAPI/1.0"

    # ---------- utilidades ----------
    def _json(self, codigo, obj):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Token, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _autorizado(self):
        dado = self.headers.get("X-API-Token")
        if not dado:
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                dado = auth[7:]
        return dado == TOKEN

    def _leer_json(self):
        largo = int(self.headers.get("Content-Length") or 0)
        if largo == 0:
            return {}
        try:
            return json.loads(self.rfile.read(largo).decode("utf-8"))
        except Exception:
            return None

    def log_message(self, fmt, *args):
        sys.stderr.write("[agenda-api] %s\n" % (fmt % args))

    # ---------- rutas ----------
    def do_OPTIONS(self):
        self._json(200, {"ok": True})

    def do_GET(self):
        ruta = urlparse(self.path)
        if ruta.path == "/salud":
            return self._json(200, {"ok": True, "servicio": "agenda", "bd": os.path.basename(DB_PATH)})
        if not self._autorizado():
            return self._json(401, {"error": "token no válido"})
        if ruta.path == "/servicios":
            return self._json(200, {"servicios": SERVICIOS, "horario": HORARIO})
        if ruta.path == "/citas":
            qs = parse_qs(ruta.query)
            fecha = (qs.get("fecha") or [None])[0]
            conn = conectar()
            if fecha:
                if not FECHA_RE.match(fecha):
                    conn.close()
                    return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
                filas = conn.execute(
                    "SELECT * FROM citas WHERE fecha = ? ORDER BY hora", (fecha,)
                ).fetchall()
            else:
                filas = conn.execute(
                    "SELECT * FROM citas ORDER BY fecha, hora"
                ).fetchall()
            conn.close()
            return self._json(200, {"citas": [fila_a_cita(f) for f in filas]})
        return self._json(404, {"error": "ruta no encontrada"})

    def do_POST(self):
        if not self._autorizado():
            return self._json(401, {"error": "token no válido"})
        ruta = urlparse(self.path)
        m = re.match(r"^/citas/(\d+)/cancelar$", ruta.path)
        if m:
            cid = int(m.group(1))
            conn = conectar()
            fila = conn.execute("SELECT * FROM citas WHERE id = ?", (cid,)).fetchone()
            if not fila:
                conn.close()
                return self._json(404, {"error": "cita no encontrada"})
            conn.execute("UPDATE citas SET estado = 'cancelada' WHERE id = ?", (cid,))
            conn.commit()
            fila = conn.execute("SELECT * FROM citas WHERE id = ?", (cid,)).fetchone()
            conn.close()
            return self._json(200, {"cita": fila_a_cita(fila)})
        if ruta.path == "/citas":
            datos = self._leer_json()
            if datos is None:
                return self._json(400, {"error": "JSON no válido"})
            nombre = (datos.get("nombre") or "").strip()
            servicio = (datos.get("servicio") or "").strip()
            fecha = (datos.get("fecha") or "").strip()
            hora = (datos.get("hora") or "").strip()
            if not nombre:
                return self._json(400, {"error": "falta el nombre de la clienta"})
            if servicio not in POR_NOMBRE:
                return self._json(400, {"error": "servicio fuera de la carta real"})
            if not FECHA_RE.match(fecha):
                return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
            if not HORA_RE.match(hora):
                return self._json(400, {"error": "hora debe ser HH:MM (24 h)"})
            carta = POR_NOMBRE[servicio]
            duracion = int(carta["duracion_min"])
            # --- Guarda de la agenda (la misma para todos los canales) ---
            # Fecha real (no basta el patrón: hacen falta el día de semana).
            try:
                dia = datetime.strptime(fecha, "%Y-%m-%d").date()
            except ValueError:
                return self._json(400, {"error": "fecha no válida"})
            ventana = VENTANA[dia.weekday()]
            if ventana is None:
                return self._json(409, {
                    "error": "el salón cierra los domingos",
                    "alternativas": [],
                })
            apertura, cierre = ventana
            inicio = _a_minutos(hora)
            fin = inicio + duracion
            conn = conectar()
            ocupados = _confirmadas(conn, fecha)
            if inicio < apertura or fin > cierre:
                alternativas = _alternativas(ocupados, apertura, cierre, duracion)
                conn.close()
                return self._json(409, {
                    "error": "esa hora queda fuera del horario del salón "
                             "(L–V 10:00–20:00 · S 10:00–14:00)",
                    "alternativas": alternativas,
                })
            # Solape: misma condición que el MCP de Hermes — el intervalo
            # [inicio, fin) se cruza con el de una cita confirmada si
            # inicio < su_fin y su_inicio < fin. Los bordes exactos no chocan.
            conflictos = [o for o in ocupados if inicio < o[2] and o[1] < fin]
            if conflictos:
                alternativas = _alternativas(ocupados, apertura, cierre, duracion)
                libre_desde = _a_hora(max(o[2] for o in conflictos))
                conn.close()
                return self._json(409, {
                    "error": "Conflicto de agenda: ese hueco se solapa con "
                             "otra cita confirmada; la agenda queda libre a "
                             f"partir de las {libre_desde}",
                    "alternativas": alternativas,
                })
            cur = conn.execute(
                """INSERT INTO citas
                   (creado_en, nombre, servicio, fecha, hora, precio_eur,
                    duracion_min, estado, origen, telefono, notas)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', 'app', ?, ?)""",
                (
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    nombre,
                    servicio,
                    fecha,
                    hora,
                    carta["precio_eur"] if carta["precio_eur"] is not None else 0.0,
                    carta["duracion_min"],
                    (datos.get("telefono") or None),
                    (datos.get("notas") or None),
                ),
            )
            conn.commit()
            fila = conn.execute("SELECT * FROM citas WHERE id = ?", (cur.lastrowid,)).fetchone()
            conn.close()
            return self._json(201, {"cita": fila_a_cita(fila)})
        return self._json(404, {"error": "ruta no encontrada"})


def main():
    ap = argparse.ArgumentParser(description="API de la agenda de La Asistenta")
    ap.add_argument("--port", type=int, default=int(os.environ.get("AGENDA_API_PORT", "8081")))
    ap.add_argument("--host", default=os.environ.get("AGENDA_API_HOST", "0.0.0.0"))
    args = ap.parse_args()
    conectar().close()  # crea la BD si no existiera
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Agenda API en http://{args.host}:{args.port}  (BD: {DB_PATH})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
