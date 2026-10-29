#!/usr/bin/env python3
"""API mínima de la agenda de La Asistenta (solo stdlib).

Sirve la MISMA agenda real (agenda.db, tabla «citas») que usa el servidor MCP
de Hermes. La app Android de Arianna lee/escribe aquí; no hay otra agenda.

Arranque:
  python3 agenda_api.py [--port 8081] [--host 0.0.0.0]
  AGENDA_API_TOKEN=<token> python3 agenda_api.py   # token por cabecera

Autenticación: cabecera  X-API-Token: <token>
  (o Authorization: Bearer <token>). El token se lee SOLO de la variable
  de entorno AGENDA_API_TOKEN (Fase 2, hallazgo D7: sin literal en el
  código; en la máquina lo aporta agenda/agenda.env, 0600 y fuera del
  repo, vía arrancar.sh). Sin la variable, la API NO arranca.

Alcance por negocio (Fase 2, hallazgo D2): toda fila lleva «negocio_id»
  y toda consulta filtra por él. El negocio de la petición sale de la
  cabecera X-Negocio-Id o, en su defecto, del negocio por defecto del
  servidor. Los negocios válidos se configuran con AGENDA_NEGOCIOS
  (lista separada por comas); hoy el único negocio real configurado es
  el piloto «ari-vivas-beauty». Un negocio no configurado → 404.

Idempotencia (Fase 2): POST /citas acepta la cabecera Idempotency-Key.
  Un reintento con la misma clave y el mismo cuerpo devuelve la cita
  original (200 con «idempotente»: true) sin duplicarla; la misma clave
  con un cuerpo distinto → 422. La comprobación anti-solape y la
  inserción van dentro de UNA transacción con bloqueo de escritura
  (BEGIN IMMEDIATE): dos peticiones simultáneas al mismo hueco se
  serializan y solo una crea la cita. Ojo: el «enlace» mágico solo
  viaja en la respuesta ORIGINAL (en la BD queda su hash); una
  respuesta idempotente devuelve la cita sin enlace.

Endpoints:
  GET  /salud                      → {ok, servicio, bd}
  GET  /servicios                  → carta real del salón
  GET  /citas?fecha=YYYY-MM-DD     → citas de ese día (sin fecha: todas)
  POST /citas                      → alta {nombre, servicio, fecha, hora,
                                       telefono?, notas?, origen?} (precio y
                                       duración salen de la carta, no del
                                       cliente). v4: admite además
                                       {servicios: [nombres]} — selección
                                       múltiple (pack): UNA cita con el
                                       nombre legible «A + B», con precio y
                                       duración SUMADOS de la carta, y la
                                       guarda usa la duración total. El
                                       contrato de un servicio no cambia.
                                       Con guarda en el propio
                                       endpoint: horario del salón y
                                       anti-solape → 409 con «alternativas»
                                       si el hueco no es reservable (mismo
                                       patrón que el servidor web).
                                       La respuesta incluye el código humano
                                       (AS-XXXX) y el «enlace» mágico
                                       post-reserva (el token en claro SOLO
                                       viaja en esta respuesta; en la BD
                                       queda únicamente su hash).
  POST /citas/<id>/cancelar        → estado = «cancelada» (+ evento del
                                       embudo y lista de espera: las
                                       entradas compatibles pasan a
                                       «por_avisar»). Guarda D-02b: una
                                       cita «cumplida» o «no_show» NO
                                       puede cancelarse (409); una ya
                                       «cancelada» responde 200 sin
                                       cambios (idempotente).
  POST /citas/<id>/estado          → {estado: «cumplida»|«no_show»} desde
                                       «confirmada». Al cumplirse se crea
                                       el agradecimiento en la bandeja de
                                       salida (mecánica post-cita).
  GET  /enlace/<hash>              → cita pública (campos seguros) por el
                                       hash del token del enlace mágico.
  POST /enlace/<hash>/cancelar     → cancela esa cita (misma semántica).
  POST /enlace/<hash>/reagendar    → {fecha, hora}: mueve la cita (mismo
                                       id, guarda anti-solape excluyéndose
                                       a sí misma) → 409 con alternativas.
  GET  /enlace/<hash>/huecos       → ?fecha=YYYY-MM-DD: huecos reales para
                                       reagendar (sin contarse a sí misma).
  POST /enlace/<hash>/prep         → mini-formulario de preparación ligado
                                       a la cita {tratamiento_reciente,
                                       retinol}.
  GET  /lista-espera               → ?estado=…: entradas (panel de Arianna)
  POST /lista-espera               → alta {nombre, telefono?, servicio,
                                       fecha_pref?, hora_pref?}
  POST /lista-espera/<id>/estado   → {estado} (atendida, descartada…)
  POST /eventos                    → anota un evento del embudo
                                       {tipo, cita_id?, origen?}
  GET  /embudo                     → ?desde&hasta: conteos del embudo
  GET  /bandeja                    → ?estado=…: bandeja de salida con el
                                       enlace wa.me de un toque por mensaje
  POST /bandeja/<id>/estado        → {estado} (enviada, descartada…)
"""

import argparse
import json
import os
import re
import secrets
import sqlite3
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agenda_comun as comun

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("AGENDA_DB", os.path.join(BASE_DIR, "agenda.db"))
# Token SOLO desde el entorno (sin literal: hallazgo D7). main() se
# niega a arrancar si falta. La ROTACIÓN del valor vigente queda como
# acción pendiente documentada en ESTADO_PROYECTO.md (es una credencial
# de producción: requiere autorización expresa del fundador).
TOKEN = (os.environ.get("AGENDA_API_TOKEN") or "").strip()

# Negocios configurados en ESTE servidor (Fase 2, D2). Hoy solo hay un
# negocio real: el piloto. AGENDA_NEGOCIOS permite declarar más en un
# despliegue concreto (p. ej. la instancia de pruebas de aislamiento).
NEGOCIOS = {n.strip() for n in
            os.environ.get("AGENDA_NEGOCIOS", comun.NEGOCIO_DEFECTO).split(",")
            if n.strip()} or {comun.NEGOCIO_DEFECTO}
NEGOCIO_POR_DEFECTO = (comun.NEGOCIO_DEFECTO if comun.NEGOCIO_DEFECTO in NEGOCIOS
                       else sorted(NEGOCIOS)[0])

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
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    # Con varios hilos/procesos escribiendo, un «database is locked»
    # transitorio debe esperar, no fallar: la guarda transaccional
    # (BEGIN IMMEDIATE) serializa las creaciones y esto absorbe la espera.
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute(ESQUEMA)
    comun.migrar(conn)  # migración aditiva: token_hash, prep, negocio_id, índices
    return conn


def _a_minutos(hora):
    h, m = hora.split(":")
    return int(h) * 60 + int(m)


def _a_hora(minutos):
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _confirmadas(conn, fecha, negocio_id=comun.NEGOCIO_DEFECTO):
    """Intervalos (id, ini, fin) ocupados por las citas confirmadas del día
    DE UN NEGOCIO. Semántica del MCP (registrar_cita): solo bloquean las
    'confirmada'; las canceladas no ocupan el hueco."""
    filas = conn.execute(
        "SELECT id, hora, duracion_min FROM citas "
        "WHERE fecha = ? AND estado = 'confirmada' AND negocio_id = ? "
        "ORDER BY hora",
        (fecha, negocio_id),
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


def etiqueta_de(servicio, precio_eur):
    """Etiqueta de precio visible de una cita.

    Para UN servicio, la de la carta («Consultar» se guarda como 0.0 en la
    BD porque la columna es NOT NULL: la etiqueta la pone la carta, no el
    número). Para un PACK («A + B», v4), la etiqueta se compone del TOTAL
    guardado — que ya es la suma real de la carta — y, si algún componente
    es «a consultar», se dice: nunca se presenta un importe parcial como
    si fuera el total.
    """
    carta = POR_NOMBRE.get(servicio)
    if carta:
        return carta["precio_etiqueta"]
    if servicio and " + " in servicio:
        partes = servicio.split(" + ")
        if all(p in POR_NOMBRE for p in partes):
            total = float(precio_eur or 0.0)
            etq = f"{int(total)} €" if total.is_integer() else f"{total:.2f} €"
            if any(POR_NOMBRE[p]["precio_eur"] is None for p in partes):
                etq += " + a consultar"
            return etq
    return None


def fila_a_cita(row):
    cita = dict(row)
    cita["precio_etiqueta"] = etiqueta_de(cita["servicio"], cita["precio_eur"])
    # El hash del token del enlace mágico NUNCA sale de la API.
    cita.pop("token_hash", None)
    cita["codigo"] = comun.codigo_cita(cita["id"])
    cita["prep"] = comun.prep_de(cita)
    return cita


def cita_publica(row):
    """Campos seguros de una cita para la página del enlace mágico:
    solo lo de ESA cita, sin teléfono ni notas internas."""
    cita = fila_a_cita(row)
    return {k: cita.get(k) for k in (
        "id", "codigo", "nombre", "servicio", "fecha", "hora",
        "precio_eur", "precio_etiqueta", "duracion_min", "estado", "prep")}


def huecos_de(conn, servicio, fecha, excluir_id=None, duracion=None,
              negocio_id=comun.NEGOCIO_DEFECTO):
    """Huecos reales de inicio (rejilla de 15 min) para un servicio y día.

    Devuelve (lista, None) o (None, motivo). excluir_id ignora la propia
    cita al reagendar (su hueco actual no debe bloquearla a sí misma).
    duracion (v4): duración en minutos a usar en vez de la del servicio —
    la reagendación de un PACK usa la duración total ya guardada en la
    cita (su «servicio» es «A + B» y no está en la carta). Sin duracion,
    el comportamiento es el de siempre.
    """
    if duracion is None:
        if servicio not in POR_NOMBRE:
            return None, "servicio fuera de la carta real"
        duracion = int(POR_NOMBRE[servicio]["duracion_min"])
    else:
        duracion = int(duracion)
    try:
        dia = datetime.strptime(fecha, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None, "fecha no válida"
    ventana = VENTANA[dia.weekday()]
    if ventana is None:
        return [], "domingo cerrado"
    apertura, cierre = ventana
    ocupados = [(i, ini, fin) for (i, ini, fin) in _confirmadas(conn, fecha, negocio_id)
                if i != excluir_id]
    return _alternativas_todas(ocupados, apertura, cierre, duracion), None


def _alternativas_todas(ocupados, apertura, cierre, duracion):
    """Como _alternativas pero sin tope de 8 (la lista completa)."""
    libres = []
    t = apertura
    while t + duracion <= cierre:
        if all(t + duracion <= o_ini or t >= o_fin for _, o_ini, o_fin in ocupados):
            libres.append(_a_hora(t))
        t += PASO_MIN
    return libres


def _fila_por_hash(conn, token_hash, negocio_id=comun.NEGOCIO_DEFECTO):
    return conn.execute(
        "SELECT * FROM citas WHERE token_hash = ? AND negocio_id = ?",
        (token_hash, negocio_id),
    ).fetchone()


def _bloqueo_cancelacion(estado):
    """D-02b (QA18): solo una cita viva puede cancelarse. Una cumplida
    ya se realizó y una no_show ya se cerró: cancelarlas reescribiría
    el historial del negocio. Devuelve (código_http, mensaje) si la
    cancelación está bloqueada, o None si puede seguir (una confirmada
    cancela; una ya cancelada es idempotente)."""
    if estado == "cumplida":
        return 409, "Esta cita ya se realizó"
    if estado == "no_show":
        return 409, "Esta cita ya pasó y quedó marcada como no realizada"
    return None


def _cancelar_en_bd(conn, fila, origen_evento):
    """Semántica única de cancelación: marca 'cancelada' (no borra),
    anota el evento y libera el hueco para la lista de espera DEL MISMO
    negocio."""
    negocio = fila["negocio_id"] or comun.NEGOCIO_DEFECTO
    conn.execute("UPDATE citas SET estado = 'cancelada' WHERE id = ?", (fila["id"],))
    comun.registrar_evento(conn, "cancelada", fila["id"], origen_evento, negocio)
    comun.marcar_por_avisar(conn, fila["servicio"], fila["fecha"], negocio)
    # Pack (v4): el hueco liberado también avisa a quien espera por cada
    # componente del pack (la lista de espera es por servicio suelto).
    if " + " in (fila["servicio"] or ""):
        for parte in fila["servicio"].split(" + "):
            if parte in POR_NOMBRE:
                comun.marcar_por_avisar(conn, parte, fila["fecha"], negocio)
    conn.commit()


class Handler(BaseHTTPRequestHandler):
    server_version = "AgendaAPI/1.0"

    # ---------- utilidades ----------
    def _json(self, codigo, obj):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Token, Authorization, X-Negocio-Id, Idempotency-Key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _autorizado(self):
        dado = self.headers.get("X-API-Token")
        if not dado:
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                dado = auth[7:]
        return bool(TOKEN) and dado is not None and secrets.compare_digest(dado, TOKEN)

    def _negocio(self):
        """Negocio de la petición (Fase 2): cabecera X-Negocio-Id o el
        por defecto del servidor. Si el negocio pedido no está
        configurado, responde 404 y devuelve None (no se revela qué
        negocios existen más allá del suyo)."""
        neg = (self.headers.get("X-Negocio-Id") or "").strip() or NEGOCIO_POR_DEFECTO
        if neg not in NEGOCIOS:
            self._json(404, {"error": "negocio no encontrado"})
            return None
        return neg

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
            negocio = self._negocio()
            if negocio is None:
                return
            qs = parse_qs(ruta.query)
            fecha = (qs.get("fecha") or [None])[0]
            conn = conectar()
            if fecha:
                if not FECHA_RE.match(fecha):
                    conn.close()
                    return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
                filas = conn.execute(
                    "SELECT * FROM citas WHERE fecha = ? AND negocio_id = ? "
                    "ORDER BY hora", (fecha, negocio)
                ).fetchall()
            else:
                filas = conn.execute(
                    "SELECT * FROM citas WHERE negocio_id = ? ORDER BY fecha, hora",
                    (negocio,)
                ).fetchall()
            conn.close()
            return self._json(200, {"citas": [fila_a_cita(f) for f in filas]})
        if ruta.path == "/embudo":
            negocio = self._negocio()
            if negocio is None:
                return
            qs = parse_qs(ruta.query)
            desde = (qs.get("desde") or [None])[0]
            hasta = (qs.get("hasta") or [None])[0]
            if desde and not FECHA_RE.match(desde):
                return self._json(400, {"error": "desde debe ser YYYY-MM-DD"})
            if hasta and not FECHA_RE.match(hasta):
                return self._json(400, {"error": "hasta debe ser YYYY-MM-DD"})
            conn = conectar()
            cond, params = ["negocio_id = ?"], [negocio]
            if desde:
                cond.append("substr(ts, 1, 10) >= ?")
                params.append(desde)
            if hasta:
                cond.append("substr(ts, 1, 10) <= ?")
                params.append(hasta)
            donde = " WHERE " + " AND ".join(cond)
            por_tipo = dict(conn.execute(
                f"SELECT tipo, COUNT(*) FROM eventos{donde} GROUP BY tipo",
                params).fetchall())
            por_origen = dict(conn.execute(
                f"SELECT origen, COUNT(*) FROM eventos{donde} GROUP BY origen",
                params).fetchall())
            conn.close()
            return self._json(200, {
                "desde": desde, "hasta": hasta,
                "total": sum(por_tipo.values()),
                "por_tipo": por_tipo, "por_origen": por_origen,
            })
        if ruta.path == "/lista-espera":
            negocio = self._negocio()
            if negocio is None:
                return
            qs = parse_qs(ruta.query)
            estado = (qs.get("estado") or [None])[0]
            conn = conectar()
            if estado:
                filas = conn.execute(
                    "SELECT * FROM lista_espera WHERE estado = ? AND negocio_id = ? "
                    "ORDER BY creado_en",
                    (estado, negocio)).fetchall()
            else:
                filas = conn.execute(
                    "SELECT * FROM lista_espera WHERE negocio_id = ? ORDER BY creado_en",
                    (negocio,)).fetchall()
            conn.close()
            return self._json(200, {"lista_espera": [dict(f) for f in filas]})
        if ruta.path == "/bandeja":
            negocio = self._negocio()
            if negocio is None:
                return
            qs = parse_qs(ruta.query)
            estado = (qs.get("estado") or [None])[0]
            conn = conectar()
            if estado:
                filas = conn.execute(
                    """SELECT b.*, c.nombre, c.servicio, c.fecha, c.hora,
                              c.telefono FROM bandeja_salida b
                       JOIN citas c ON c.id = b.cita_id
                       WHERE b.estado = ? AND b.negocio_id = ? ORDER BY b.creado_en""",
                    (estado, negocio)).fetchall()
            else:
                filas = conn.execute(
                    """SELECT b.*, c.nombre, c.servicio, c.fecha, c.hora,
                              c.telefono FROM bandeja_salida b
                       JOIN citas c ON c.id = b.cita_id
                       WHERE b.negocio_id = ?
                       ORDER BY b.creado_en""", (negocio,)).fetchall()
            conn.close()
            salida = []
            for f in filas:
                d = dict(f)
                d["codigo"] = comun.codigo_cita(d["cita_id"])
                tel = re.sub(r"\D", "", d.get("telefono") or "")
                # Enlace de UN toque: wa.me abre WhatsApp con el texto
                # precargado; enviarlo sí es posible (lo pulsa Arianna
                # desde su propio WhatsApp, no la API de Twilio).
                d["wa_link"] = (
                    f"https://wa.me/{tel}?text={quote(d['texto'])}" if tel else None)
                salida.append(d)
            return self._json(200, {"bandeja": salida})
        m = re.match(r"^/enlace/([0-9a-f]{64})$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            conn = conectar()
            fila = _fila_por_hash(conn, m.group(1), negocio)
            conn.close()
            if not fila:
                return self._json(404, {"error": "enlace no válido o caducado"})
            return self._json(200, {"cita": cita_publica(fila)})
        m = re.match(r"^/enlace/([0-9a-f]{64})/huecos$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            qs = parse_qs(ruta.query)
            fecha = (qs.get("fecha") or [""])[0]
            if not FECHA_RE.match(fecha):
                return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
            conn = conectar()
            fila = _fila_por_hash(conn, m.group(1), negocio)
            if not fila:
                conn.close()
                return self._json(404, {"error": "enlace no válido o caducado"})
            # La duración guardada en la cita manda: para un servicio es
            # la de la carta (idéntico a antes); para un pack, la total.
            libres, motivo = huecos_de(conn, fila["servicio"], fecha,
                                       excluir_id=fila["id"],
                                       duracion=int(fila["duracion_min"]),
                                       negocio_id=negocio)
            conn.close()
            if libres is None:
                return self._json(400, {"error": motivo})
            return self._json(200, {"servicio": fila["servicio"], "fecha": fecha,
                                    "huecos": libres, "motivo": motivo})
        return self._json(404, {"error": "ruta no encontrada"})

    def do_POST(self):
        if not self._autorizado():
            return self._json(401, {"error": "token no válido"})
        ruta = urlparse(self.path)
        m = re.match(r"^/citas/(\d+)/cancelar$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            cid = int(m.group(1))
            conn = conectar()
            fila = conn.execute(
                "SELECT * FROM citas WHERE id = ? AND negocio_id = ?",
                (cid, negocio)).fetchone()
            if not fila:
                conn.close()
                return self._json(404, {"error": "cita no encontrada"})
            bloqueo = _bloqueo_cancelacion(fila["estado"])
            if bloqueo:
                conn.close()
                return self._json(bloqueo[0], {"error": bloqueo[1]})
            if fila["estado"] != "cancelada":
                _cancelar_en_bd(conn, fila, "web")
            fila = conn.execute("SELECT * FROM citas WHERE id = ?", (cid,)).fetchone()
            conn.close()
            return self._json(200, {"cita": fila_a_cita(fila)})
        m = re.match(r"^/citas/(\d+)/estado$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            return self._cambiar_estado(int(m.group(1)), negocio)
        if ruta.path == "/eventos":
            negocio = self._negocio()
            if negocio is None:
                return
            datos = self._leer_json()
            if datos is None:
                return self._json(400, {"error": "JSON no válido"})
            tipo = (datos.get("tipo") or "").strip()
            if tipo not in comun.TIPOS_EVENTO:
                return self._json(400, {"error": "tipo de evento no válido"})
            conn = conectar()
            comun.registrar_evento(conn, tipo, datos.get("cita_id"),
                                   datos.get("origen") or "web", negocio)
            conn.commit()
            conn.close()
            return self._json(201, {"ok": True})
        if ruta.path == "/lista-espera":
            negocio = self._negocio()
            if negocio is None:
                return
            return self._alta_lista_espera(negocio)
        m = re.match(r"^/lista-espera/(\d+)/estado$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            return self._estado_simple("lista_espera", int(m.group(1)),
                                       ("esperando", "por_avisar", "atendida", "descartada"),
                                       negocio)
        m = re.match(r"^/bandeja/(\d+)/estado$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            return self._estado_simple("bandeja_salida", int(m.group(1)),
                                       ("pendiente", "enviada", "descartada"),
                                       negocio)
        m = re.match(r"^/enlace/([0-9a-f]{64})/(cancelar|reagendar|prep)$", ruta.path)
        if m:
            negocio = self._negocio()
            if negocio is None:
                return
            return self._enlace_post(m.group(1), m.group(2), negocio)
        if ruta.path == "/citas":
            negocio = self._negocio()
            if negocio is None:
                return
            datos = self._leer_json()
            if datos is None:
                return self._json(400, {"error": "JSON no válido"})
            nombre = (datos.get("nombre") or "").strip()
            servicio = (datos.get("servicio") or "").strip()
            fecha = (datos.get("fecha") or "").strip()
            hora = (datos.get("hora") or "").strip()
            if not nombre:
                return self._json(400, {"error": "falta el nombre de la clienta"})
            # v4 — selección múltiple (pack), contrato compatible:
            # «servicios» (lista de nombres de la carta) manda si viene;
            # «servicio» (uno solo) sigue funcionando exactamente igual.
            # La cita es UNA: nombre legible «A + B», precio y duración
            # SUMADOS desde la carta (nunca del cliente), y la guarda de
            # abajo trabaja con la duración total.
            nombres = None
            crudos = datos.get("servicios")
            if isinstance(crudos, list) and crudos:
                nombres = []
                for crudo in crudos:
                    crudo = crudo.strip() if isinstance(crudo, str) else ""
                    if crudo not in POR_NOMBRE:
                        return self._json(400, {
                            "error": "servicio fuera de la carta real"})
                    if crudo not in nombres:
                        nombres.append(crudo)
            elif servicio in POR_NOMBRE:
                nombres = [servicio]
            if not nombres:
                return self._json(400, {"error": "servicio fuera de la carta real"})
            if not FECHA_RE.match(fecha):
                return self._json(400, {"error": "fecha debe ser YYYY-MM-DD"})
            if not HORA_RE.match(hora):
                return self._json(400, {"error": "hora debe ser HH:MM (24 h)"})
            servicio = " + ".join(nombres)
            duracion = sum(int(POR_NOMBRE[n]["duracion_min"]) for n in nombres)
            precio_total = sum(
                POR_NOMBRE[n]["precio_eur"] or 0.0 for n in nombres)
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
            origen = (datos.get("origen") or "app").strip()
            if origen not in ("app", "web", "whatsapp"):
                origen = "app"
            # Idempotencia (Fase 2): la clave viaja en cabecera; la
            # huella cubre los campos que definen la petición.
            clave_idem = (self.headers.get("Idempotency-Key") or "").strip()
            if len(clave_idem) > 200:
                return self._json(400, {
                    "error": "la cabecera Idempotency-Key es demasiado larga"})
            huella = None
            if clave_idem:
                huella = comun.huella_idempotencia({
                    "nombre": nombre, "servicios": nombres, "fecha": fecha,
                    "hora": hora, "telefono": datos.get("telefono") or None,
                    "notas": datos.get("notas") or None, "origen": origen,
                })
            # Guarda + inserción en UNA transacción con bloqueo de
            # escritura (BEGIN IMMEDIATE): entre «comprobar» e «insertar»
            # no puede colarse otra creación; dos peticiones simultáneas
            # al mismo hueco se serializan y solo una gana.
            conn = conectar()
            try:
                conn.execute("BEGIN IMMEDIATE")
                if clave_idem:
                    previa = comun.buscar_idempotencia(conn, negocio, clave_idem)
                    if previa is not None:
                        if previa["huella"] != huella:
                            conn.rollback()
                            conn.close()
                            return self._json(422, {
                                "error": "esta Idempotency-Key ya se usó con "
                                         "otros datos de reserva"})
                        fila = conn.execute(
                            "SELECT * FROM citas WHERE id = ?",
                            (previa["cita_id"],)).fetchone()
                        conn.rollback()
                        conn.close()
                        # La cita original, sin duplicar. El «enlace»
                        # mágico NO se puede repetir: solo viajó en la
                        # respuesta original (en la BD queda su hash).
                        return self._json(200, {"cita": fila_a_cita(fila),
                                                "idempotente": True})
                ocupados = _confirmadas(conn, fecha, negocio)
                if inicio < apertura or fin > cierre:
                    alternativas = _alternativas(ocupados, apertura, cierre, duracion)
                    conn.rollback()
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
                    conn.rollback()
                    conn.close()
                    return self._json(409, {
                        "error": "Conflicto de agenda: ese hueco se solapa con "
                                 "otra cita confirmada; la agenda queda libre a "
                                 f"partir de las {libre_desde}",
                        "alternativas": alternativas,
                    })
                # Enlace mágico: se genera el token y en la BD solo queda su hash.
                token, token_hash = comun.nuevo_token()
                cur = conn.execute(
                    """INSERT INTO citas
                       (creado_en, nombre, servicio, fecha, hora, precio_eur,
                        duracion_min, estado, origen, telefono, notas, token_hash,
                        negocio_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, ?, ?, ?, ?)""",
                    (
                        datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        nombre,
                        servicio,
                        fecha,
                        hora,
                        precio_total,
                        duracion,
                        origen,
                        (datos.get("telefono") or None),
                        (datos.get("notas") or None),
                        token_hash,
                        negocio,
                    ),
                )
                cita_id = cur.lastrowid
                comun.registrar_evento(conn, "reserva_confirmada", cita_id,
                                       "whatsapp" if origen == "whatsapp" else "web",
                                       negocio)
                if clave_idem:
                    comun.guardar_idempotencia(conn, negocio, clave_idem,
                                               huella, cita_id)
                conn.commit()
            except sqlite3.Error:
                try:
                    conn.rollback()
                except sqlite3.Error:
                    pass
                conn.close()
                return self._json(503, {
                    "error": "la agenda está ocupada ahora mismo; "
                             "inténtalo de nuevo en unos segundos"})
            fila = conn.execute("SELECT * FROM citas WHERE id = ?", (cita_id,)).fetchone()
            conn.close()
            cita = fila_a_cita(fila)
            # El token en claro SOLO existe en esta respuesta (y en el
            # enlace que la clienta guarda); no se puede recuperar después.
            cita["enlace"] = comun.enlace_cita(token)
            return self._json(201, {"cita": cita})
        return self._json(404, {"error": "ruta no encontrada"})

    # ---------- mecánicas: estados, lista de espera, bandeja, enlace ----------
    def _cambiar_estado(self, cid, negocio):
        datos = self._leer_json()
        if datos is None:
            return self._json(400, {"error": "JSON no válido"})
        nuevo = (datos.get("estado") or "").strip()
        if nuevo not in ("cumplida", "no_show"):
            return self._json(400, {"error": "estado debe ser «cumplida» o «no_show»"})
        conn = conectar()
        fila = conn.execute(
            "SELECT * FROM citas WHERE id = ? AND negocio_id = ?",
            (cid, negocio)).fetchone()
        if not fila:
            conn.close()
            return self._json(404, {"error": "cita no encontrada"})
        if fila["estado"] == nuevo:
            conn.close()
            return self._json(200, {"cita": fila_a_cita(fila), "sin_cambio": True})
        if fila["estado"] != "confirmada":
            conn.close()
            return self._json(409, {
                "error": f"una cita «{fila['estado']}» no puede pasar a «{nuevo}»"})
        conn.execute("UPDATE citas SET estado = ? WHERE id = ?", (nuevo, cid))
        comun.registrar_evento(
            conn, "cita_cumplida" if nuevo == "cumplida" else "no_show", cid, "web",
            negocio)
        if nuevo == "cumplida":
            # Post-cita: agradecimiento a la bandeja de salida (pendiente
            # de que Arianna lo envíe con un toque vía wa.me).
            comun.crear_gracias(conn, dict(fila))
        conn.commit()
        fila = conn.execute("SELECT * FROM citas WHERE id = ?", (cid,)).fetchone()
        conn.close()
        return self._json(200, {"cita": fila_a_cita(fila)})

    def _alta_lista_espera(self, negocio):
        datos = self._leer_json()
        if datos is None:
            return self._json(400, {"error": "JSON no válido"})
        nombre = (datos.get("nombre") or "").strip()
        servicio = (datos.get("servicio") or "").strip()
        fecha_pref = (datos.get("fecha_pref") or "").strip() or None
        hora_pref = (datos.get("hora_pref") or "").strip() or None
        if len(nombre) < 2 or len(nombre) > 60:
            return self._json(400, {"error": "escribe tu nombre (2–60 caracteres)"})
        if servicio not in POR_NOMBRE:
            return self._json(400, {"error": "servicio fuera de la carta real"})
        if fecha_pref is not None:
            if not FECHA_RE.match(fecha_pref):
                return self._json(400, {"error": "fecha_pref debe ser YYYY-MM-DD"})
            try:
                datetime.strptime(fecha_pref, "%Y-%m-%d")
            except ValueError:
                return self._json(400, {"error": "fecha_pref no válida"})
        if hora_pref is not None and not HORA_RE.match(hora_pref):
            return self._json(400, {"error": "hora_pref debe ser HH:MM (24 h)"})
        conn = conectar()
        cur = conn.execute(
            """INSERT INTO lista_espera
               (creado_en, nombre, telefono, servicio, fecha_pref, hora_pref,
                estado, notas, negocio_id)
               VALUES (?, ?, ?, ?, ?, ?, 'esperando', ?, ?)""",
            (
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
                nombre,
                (datos.get("telefono") or "").strip() or None,
                servicio, fecha_pref, hora_pref,
                (datos.get("notas") or "").strip() or None,
                negocio,
            ),
        )
        entrada_id = cur.lastrowid
        comun.registrar_evento(conn, "lista_espera_alta", None,
                               datos.get("origen") or "web", negocio)
        conn.commit()
        fila = conn.execute(
            "SELECT * FROM lista_espera WHERE id = ?", (entrada_id,)).fetchone()
        conn.close()
        return self._json(201, {"entrada": dict(fila)})

    def _estado_simple(self, tabla, fila_id, validos, negocio):
        datos = self._leer_json()
        if datos is None:
            return self._json(400, {"error": "JSON no válido"})
        nuevo = (datos.get("estado") or "").strip()
        if nuevo not in validos:
            return self._json(400, {
                "error": "estado debe ser uno de: " + ", ".join(validos)})
        conn = conectar()
        fila = conn.execute(
            f"SELECT * FROM {tabla} WHERE id = ? AND negocio_id = ?",
            (fila_id, negocio)).fetchone()
        if not fila:
            conn.close()
            return self._json(404, {"error": "registro no encontrado"})
        conn.execute(f"UPDATE {tabla} SET estado = ? WHERE id = ?", (nuevo, fila_id))
        conn.commit()
        fila = conn.execute(
            f"SELECT * FROM {tabla} WHERE id = ?", (fila_id,)).fetchone()
        conn.close()
        return self._json(200, {"registro": dict(fila)})

    def _enlace_post(self, token_hash, accion, negocio):
        conn = conectar()
        fila = _fila_por_hash(conn, token_hash, negocio)
        if not fila:
            conn.close()
            return self._json(404, {"error": "enlace no válido o caducado"})
        if accion == "cancelar":
            bloqueo = _bloqueo_cancelacion(fila["estado"])
            if bloqueo:
                conn.close()
                return self._json(bloqueo[0], {"error": bloqueo[1]})
            if fila["estado"] != "cancelada":
                _cancelar_en_bd(conn, fila, "web")
            fila = conn.execute(
                "SELECT * FROM citas WHERE id = ?", (fila["id"],)).fetchone()
            conn.close()
            return self._json(200, {"cita": cita_publica(fila)})
        if accion == "prep":
            datos = self._leer_json()
            if datos is None:
                conn.close()
                return self._json(400, {"error": "JSON no válido"})
            tratamiento = (datos.get("tratamiento_reciente") or "").strip()
            retinol = (datos.get("retinol") or "").strip()
            if not tratamiento or len(tratamiento) > 300:
                conn.close()
                return self._json(400, {
                    "error": "cuéntanos si llevas algún tratamiento reciente en las cejas"})
            if not retinol or len(retinol) > 120:
                conn.close()
                return self._json(400, {
                    "error": "cuéntanos si usas productos con retinol en la zona"})
            prep = {
                "tratamiento_reciente": tratamiento,
                "retinol": retinol,
                "respondido_en": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            conn.execute("UPDATE citas SET prep = ? WHERE id = ?",
                         (json.dumps(prep, ensure_ascii=False), fila["id"]))
            conn.commit()
            fila = conn.execute(
                "SELECT * FROM citas WHERE id = ?", (fila["id"],)).fetchone()
            conn.close()
            return self._json(200, {"cita": cita_publica(fila)})
        # accion == "reagendar"
        datos = self._leer_json()
        if datos is None:
            conn.close()
            return self._json(400, {"error": "JSON no válido"})
        fecha = (datos.get("fecha") or "").strip()
        hora = (datos.get("hora") or "").strip()
        if not FECHA_RE.match(fecha) or not HORA_RE.match(hora):
            conn.close()
            return self._json(400, {"error": "fecha u hora no válidas"})
        if fila["estado"] != "confirmada":
            conn.close()
            return self._json(409, {
                "error": "solo se puede reagendar una cita confirmada"})
        if fecha == fila["fecha"] and hora == fila["hora"]:
            conn.close()
            return self._json(200, {"cita": cita_publica(fila), "sin_cambio": True})
        try:
            dia = datetime.strptime(fecha, "%Y-%m-%d").date()
        except ValueError:
            conn.close()
            return self._json(400, {"error": "fecha no válida"})
        ventana = VENTANA[dia.weekday()]
        if ventana is None:
            conn.close()
            return self._json(409, {"error": "el salón cierra los domingos",
                                    "alternativas": []})
        apertura, cierre = ventana
        inicio, fin = _a_minutos(hora), _a_minutos(hora) + int(fila["duracion_min"])
        # Comprobación + movimiento en UNA transacción con bloqueo de
        # escritura (misma disciplina que la creación): el hueco destino
        # no puede ocuparse entre la comprobación y el UPDATE.
        conn.execute("BEGIN IMMEDIATE")
        fila = conn.execute(
            "SELECT * FROM citas WHERE id = ?", (fila["id"],)).fetchone()
        if fila["estado"] != "confirmada":
            conn.rollback()
            conn.close()
            return self._json(409, {
                "error": "solo se puede reagendar una cita confirmada"})
        ocupados = [(i, ini, fin_) for (i, ini, fin_) in _confirmadas(conn, fecha, negocio)
                    if i != fila["id"]]
        if inicio < apertura or fin > cierre or any(
                inicio < o_fin and o_ini < fin for _, o_ini, o_fin in ocupados):
            alternativas = _alternativas(ocupados, apertura, cierre,
                                         int(fila["duracion_min"]))
            conn.rollback()
            conn.close()
            return self._json(409, {
                "error": "ese hueco no está libre; prueba con otra hora",
                "alternativas": alternativas})
        vieja_fecha, viejo_servicio = fila["fecha"], fila["servicio"]
        conn.execute("UPDATE citas SET fecha = ?, hora = ? WHERE id = ?",
                     (fecha, hora, fila["id"]))
        comun.registrar_evento(conn, "reagendada", fila["id"], "web", negocio)
        # El hueco viejo queda libre: puede avisar a la lista de espera.
        comun.marcar_por_avisar(conn, viejo_servicio, vieja_fecha, negocio)
        if " + " in (viejo_servicio or ""):  # pack: también por componente
            for parte in viejo_servicio.split(" + "):
                if parte in POR_NOMBRE:
                    comun.marcar_por_avisar(conn, parte, vieja_fecha, negocio)
        conn.commit()
        fila = conn.execute(
            "SELECT * FROM citas WHERE id = ?", (fila["id"],)).fetchone()
        conn.close()
        return self._json(200, {"cita": cita_publica(fila)})


def main():
    ap = argparse.ArgumentParser(description="API de la agenda de La Asistenta")
    ap.add_argument("--port", type=int, default=int(os.environ.get("AGENDA_API_PORT", "8081")))
    ap.add_argument("--host", default=os.environ.get("AGENDA_API_HOST", "0.0.0.0"))
    args = ap.parse_args()
    if not TOKEN:
        sys.stderr.write(
            "AGENDA_API_TOKEN no está definido: la API de agenda no arranca "
            "sin token en el entorno (en la máquina lo aporta "
            "agenda/agenda.env vía arrancar.sh).\n")
        sys.exit(2)
    conectar().close()  # crea la BD si no existiera
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Agenda API en http://{args.host}:{args.port}  (BD: {DB_PATH})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
