#!/usr/bin/env python3
"""Piezas comunes de la agenda de La Asistenta (solo stdlib).

Lo comparten la API HTTP (agenda_api.py) y el servidor MCP de Hermes
(mcp_agenda.py) para que las mecánicas de producto nuevas vivan en UN
solo sitio y se comporten igual por todos los canales:

  - Migración ADITIVA de la BD: columnas nuevas de «citas» con guarda
    (token_hash, prep) y tablas nuevas con IF NOT EXISTS (lista_espera,
    eventos, bandeja_salida). Nunca se borra ni se renombra nada.
  - Código humano de cita (AS-XXXX) derivado del id, sin caracteres
    ambiguos (nada de 0/O/1/I/L).
  - Enlace mágico post-reserva: token aleatorio largo del que en la BD
    solo se guarda su hash SHA-256; el token en claro solo viaja en el
    enlace que recibe la clienta.
  - Embudo medido: registro de eventos (hueco_propuesto,
    reserva_confirmada, cancelada, reagendada, lista_espera_alta,
    cita_cumplida, no_show).
  - Lista de espera activa: al liberarse un hueco (cancelación o
    reagendación), las entradas compatibles en espera pasan a
    «por_avisar». LÍMITE HONESTO: con la cuenta Twilio trial NO se puede
    enviar WhatsApp saliente libre (error 21654 verificado el 28/10), así
    que nadie finge el aviso enviado: la entrada queda en «por_avisar»,
    visible para Arianna, y si la clienta escribe, Hermes puede
    consultarlo con su herramienta de lista de espera.
  - Post-cita: texto de agradecimiento para la bandeja de salida
    (Arianna lo envía con un toque vía wa.me). La línea de reseña solo
    aparece si RESENA_URL tiene una URL real configurada.
"""

import hashlib
import json
import os
import secrets
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Negocio piloto y ÚNICO negocio real configurado hoy (Fase 2 de la
# Orden Maestra, hallazgo D2 de la auditoría): toda fila de la agenda
# lleva su «negocio_id» y toda consulta filtra por él. El valor por
# defecto de la migración aditiva es este negocio, así que los datos
# existentes quedan adscritos a él sin tocarlos.
NEGOCIO_DEFECTO = "ari-vivas-beauty"

# URL pública de la web de la clienta (puerto 8090 en la máquina). Es una
# URL pública, no un secreto; se puede sobrescribir por entorno.
WEB_BASE_URL = os.environ.get(
    "LA_ASISTENTA_WEB_URL",
    "https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech",
).rstrip("/")

# URL real de reseñas del salón. Vacía por defecto A PROPÓSITO: no se
# inventa ninguna. Cuando Arianna dé la suya, se configura por entorno
# (RESENA_URL) y la línea de reseña aparecerá en los agradecimientos.
RESENA_URL = os.environ.get("RESENA_URL", "")

# Alfabeto sin ambigüedad para el código humano: sin 0, O, 1, I ni L.
_ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # 31 símbolos


def _ahora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------
# Hora del salón y guarda «ya pasó» (hallazgo QA19, §46 de ESTADO)
# ------------------------------------------------------------------
# La agenda vive en hora del salón (Europe/Madrid), no en la del
# servidor (UTC en la máquina). Ninguna superficie puede ofrecer ni
# crear una cita cuyo inicio ya pasó: la disponibilidad filtra los
# inicios pasados del día en curso y la creación los rechaza en TODAS
# las vías (API y MCP comparten estas dos piezas).

ZONA_SALON = ZoneInfo("Europe/Madrid")


def ahora_salon():
    """Ahora mismo en la zona horaria del salón (Europe/Madrid)."""
    return datetime.now(ZONA_SALON)


def inicio_en_pasado(fecha, hora):
    """True si el inicio (fecha «YYYY-MM-DD» + hora «HH:MM», en hora
    del salón) ya pasó. Un formato no válido devuelve False: el formato
    lo valida quien llama, con su propio error."""
    try:
        ini = datetime.strptime(f"{fecha} {hora}", "%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return False
    return ini.replace(tzinfo=ZONA_SALON) <= ahora_salon()


def corte_hoy(fecha):
    """Si «fecha» (str «YYYY-MM-DD» o date) es HOY en hora del salón,
    devuelve el minuto actual del día: un inicio es pasado si su
    minuto es <= corte. Para cualquier otro día devuelve None."""
    ahora = ahora_salon()
    if isinstance(fecha, str):
        try:
            fecha = datetime.strptime(fecha, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None
    if fecha != ahora.date():
        return None
    return ahora.hour * 60 + ahora.minute


# ------------------------------------------------------------------
# Migración aditiva (idempotente; se llama en cada conexión)
# ------------------------------------------------------------------

TABLAS_NUEVAS = """
CREATE TABLE IF NOT EXISTS lista_espera (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en   TEXT NOT NULL,
    nombre      TEXT NOT NULL,
    telefono    TEXT,
    servicio    TEXT NOT NULL,
    fecha_pref  TEXT,
    hora_pref   TEXT,
    estado      TEXT NOT NULL DEFAULT 'esperando',
    notas       TEXT,
    negocio_id  TEXT NOT NULL DEFAULT 'ari-vivas-beauty'
);
CREATE TABLE IF NOT EXISTS eventos (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    ts       TEXT NOT NULL,
    tipo     TEXT NOT NULL,
    cita_id  INTEGER,
    origen   TEXT NOT NULL DEFAULT 'web',
    negocio_id TEXT NOT NULL DEFAULT 'ari-vivas-beauty'
);
CREATE TABLE IF NOT EXISTS bandeja_salida (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en  TEXT NOT NULL,
    cita_id    INTEGER NOT NULL,
    tipo       TEXT NOT NULL DEFAULT 'gracias',
    texto      TEXT NOT NULL,
    estado     TEXT NOT NULL DEFAULT 'pendiente',
    negocio_id TEXT NOT NULL DEFAULT 'ari-vivas-beauty'
);
CREATE TABLE IF NOT EXISTS claves_idempotencia (
    negocio_id TEXT NOT NULL,
    clave      TEXT NOT NULL,
    huella     TEXT NOT NULL,
    cita_id    INTEGER NOT NULL,
    creado_en  TEXT NOT NULL,
    PRIMARY KEY (negocio_id, clave)
);
"""

# Columnas nuevas de «citas»: se añaden SOLO si no existen (guarda).
COLUMNAS_CITAS = {
    # Hash SHA-256 (hex) del token del enlace mágico; el token en claro
    # nunca se guarda.
    "token_hash": "TEXT",
    # Respuestas del mini-formulario de preparación (JSON) ligadas a la cita.
    "prep": "TEXT",
    # Negocio dueño de la cita (Fase 2, D2). El DEFAULT constante rellena
    # las filas existentes con el negocio piloto al añadir la columna.
    "negocio_id": "TEXT NOT NULL DEFAULT 'ari-vivas-beauty'",
}

# «negocio_id» también en las tablas hermanas: en BDs nuevas lo trae el
# CREATE de arriba; en las existentes se añade con la misma guarda.
COLUMNAS_NEGOCIO = ("lista_espera", "eventos", "bandeja_salida")

# Índices de las consultas calientes reales (medidos con EXPLAIN QUERY
# PLAN en MEDICIONES.md): confirmadas del día por negocio, embudo por
# negocio, búsqueda de cita por el hash del enlace mágico y colas de la
# profesional (espera y bandeja por negocio y estado).
INDICES = """
CREATE INDEX IF NOT EXISTS idx_citas_negocio_fecha_estado
    ON citas(negocio_id, fecha, estado);
CREATE INDEX IF NOT EXISTS idx_citas_token_hash
    ON citas(token_hash);
CREATE INDEX IF NOT EXISTS idx_eventos_negocio_tipo
    ON eventos(negocio_id, tipo, ts);
CREATE INDEX IF NOT EXISTS idx_lista_espera_negocio
    ON lista_espera(negocio_id, estado, servicio);
CREATE INDEX IF NOT EXISTS idx_bandeja_negocio
    ON bandeja_salida(negocio_id, estado);
"""


def migrar(conn):
    """Aplica la migración aditiva. Segura de repetir en cada conexión."""
    columnas = {fila[1] for fila in conn.execute("PRAGMA table_info(citas)")}
    for nombre, tipo in COLUMNAS_CITAS.items():
        if nombre not in columnas:
            conn.execute(f"ALTER TABLE citas ADD COLUMN {nombre} {tipo}")
    conn.executescript(TABLAS_NUEVAS)
    for tabla in COLUMNAS_NEGOCIO:
        cols = {fila[1] for fila in conn.execute(f"PRAGMA table_info({tabla})")}
        if "negocio_id" not in cols:
            conn.execute(
                f"ALTER TABLE {tabla} ADD COLUMN negocio_id "
                "TEXT NOT NULL DEFAULT 'ari-vivas-beauty'")
    conn.executescript(INDICES)
    conn.commit()


# ------------------------------------------------------------------
# Código humano de cita: AS-XXXX derivado del id
# ------------------------------------------------------------------

def codigo_cita(cita_id):
    """Código corto y sin ambigüedad derivado del id (base 31, 4 símbolos).

    OJO: el código nace con el id, es decir, AL registrar la cita. El
    resumen previo a confirmar cita el objeto completo (servicio, fecha,
    hora, precio, nombre) y el «sí» se refiere a ese objeto exacto; el
    código se entrega en la confirmación y sirve de identificador único
    en adelante (página del enlace, agenda, cancelaciones).
    """
    n = int(cita_id)
    simbolos = []
    while n > 0:
        simbolos.append(_ALFABETO_CODIGO[n % len(_ALFABETO_CODIGO)])
        n //= len(_ALFABETO_CODIGO)
    cuerpo = "".join(reversed(simbolos)).rjust(4, _ALFABETO_CODIGO[0])
    return "AS-" + cuerpo


def id_desde_codigo(codigo):
    """Inversa de codigo_cita: 'AS-XXXX' (o 'XXXX') -> id, o None."""
    if not codigo:
        return None
    txt = str(codigo).strip().upper()
    if txt.startswith("AS-"):
        txt = txt[3:]
    if not txt or any(c not in _ALFABETO_CODIGO for c in txt):
        return None
    n = 0
    for c in txt:
        n = n * len(_ALFABETO_CODIGO) + _ALFABETO_CODIGO.index(c)
    return n


# ------------------------------------------------------------------
# Enlace mágico post-reserva
# ------------------------------------------------------------------

def nuevo_token():
    """Devuelve (token_en_claro, hash). Solo el hash se guarda en la BD."""
    token = secrets.token_urlsafe(24)
    return token, hash_token(token)


def hash_token(token):
    return hashlib.sha256(str(token).encode("utf-8")).hexdigest()


def enlace_cita(token):
    return f"{WEB_BASE_URL}/cita/{token}"


# ------------------------------------------------------------------
# Embudo medido
# ------------------------------------------------------------------

TIPOS_EVENTO = (
    "hueco_propuesto", "reserva_confirmada", "cancelada", "reagendada",
    "lista_espera_alta", "cita_cumplida", "no_show",
)


def registrar_evento(conn, tipo, cita_id=None, origen="web",
                     negocio_id=NEGOCIO_DEFECTO):
    """Anota un evento del embudo. origen: 'whatsapp' | 'web'."""
    if tipo not in TIPOS_EVENTO:
        raise ValueError(f"tipo de evento desconocido: {tipo}")
    conn.execute(
        "INSERT INTO eventos (ts, tipo, cita_id, origen, negocio_id) "
        "VALUES (?, ?, ?, ?, ?)",
        (_ahora(), tipo, cita_id,
         "whatsapp" if origen == "whatsapp" else "web", negocio_id),
    )


# ------------------------------------------------------------------
# Idempotencia de la creación de citas (Fase 2)
# ------------------------------------------------------------------

def huella_idempotencia(campos):
    """Huella estable (SHA-256 hex) de los campos que definen una
    petición de creación: dos peticiones con la misma clave de
    idempotencia solo son «la misma» si su huella coincide."""
    canonico = json.dumps(campos, ensure_ascii=False, sort_keys=True,
                          separators=(",", ":"))
    return hashlib.sha256(canonico.encode("utf-8")).hexdigest()


def buscar_idempotencia(conn, negocio_id, clave):
    """Dict {huella, cita_id} de claves_idempotencia o None. Se devuelve
    un dict SIEMPRE (la API usa Row y el MCP tuplas: así vale para los
    dos sin depender del row_factory de cada conexión)."""
    fila = conn.execute(
        "SELECT huella, cita_id FROM claves_idempotencia "
        "WHERE negocio_id = ? AND clave = ?",
        (negocio_id, clave),
    ).fetchone()
    if fila is None:
        return None
    return {"huella": fila[0], "cita_id": fila[1]}


def guardar_idempotencia(conn, negocio_id, clave, huella, cita_id):
    conn.execute(
        "INSERT INTO claves_idempotencia (negocio_id, clave, huella, cita_id, creado_en) "
        "VALUES (?, ?, ?, ?, ?)",
        (negocio_id, clave, huella, cita_id, _ahora()),
    )


# ------------------------------------------------------------------
# Lista de espera activa
# ------------------------------------------------------------------

def marcar_por_avisar(conn, servicio, fecha, negocio_id=NEGOCIO_DEFECTO):
    """Marca «por_avisar» las entradas en espera compatibles con un hueco
    que se acaba de liberar (cancelación o reagendación).

    Compatible = mismo negocio, mismo servicio y (sin fecha preferida o
    la fecha del hueco liberado). Devuelve cuántas entradas se marcaron.
    NO envía ningún mensaje: el aviso saliente no es posible con Twilio
    trial (error 21654); queda en cola visible para Arianna.
    """
    cur = conn.execute(
        """UPDATE lista_espera SET estado = 'por_avisar'
           WHERE estado = 'esperando' AND servicio = ? AND negocio_id = ?
             AND (fecha_pref IS NULL OR fecha_pref = '')""",
        (servicio, negocio_id),
    )
    total = cur.rowcount
    if fecha:
        cur = conn.execute(
            """UPDATE lista_espera SET estado = 'por_avisar'
               WHERE estado = 'esperando' AND servicio = ? AND fecha_pref = ?
                 AND negocio_id = ?""",
            (servicio, fecha, negocio_id),
        )
        total += cur.rowcount
    return total


# ------------------------------------------------------------------
# Post-cita: agradecimiento en la bandeja de salida
# ------------------------------------------------------------------

def texto_gracias(cita, resena_url=None):
    """Texto de agradecimiento post-cita. La línea de reseña solo aparece
    si hay una URL real configurada (RESENA_URL); nunca se inventa."""
    url = RESENA_URL if resena_url is None else resena_url
    nombre = (cita.get("nombre") or "").split(" ")[0]
    servicio = cita.get("servicio") or "tu servicio"
    lineas = [
        f"¡Hola {nombre}! 💖 Soy Arianna, de Ari Vivas Beauty. "
        f"Gracias por venir hoy por tu {servicio}: ha sido un placer atenderte.",
        "Si necesitas cualquier retoque o tu próxima cita, escríbeme por aquí "
        "y te la dejo reservada.",
    ]
    if url:
        lineas.append(f"Si te gustó el resultado, tu reseña nos ayuda muchísimo: {url}")
    return "\n".join(lineas)


def crear_gracias(conn, cita, negocio_id=None):
    """Crea el mensaje de agradecimiento en la bandeja de salida
    (estado 'pendiente': Arianna lo envía con un toque vía wa.me)."""
    negocio = negocio_id or cita.get("negocio_id") or NEGOCIO_DEFECTO
    cur = conn.execute(
        """INSERT INTO bandeja_salida (creado_en, cita_id, tipo, texto, estado, negocio_id)
           VALUES (?, ?, 'gracias', ?, 'pendiente', ?)""",
        (_ahora(), cita["id"], texto_gracias(cita), negocio),
    )
    return cur.lastrowid


def prep_de(cita):
    """Respuestas del mini-formulario de preparación (dict o None)."""
    crudo = cita.get("prep") if isinstance(cita, dict) else None
    if not crudo:
        return None
    try:
        datos = json.loads(crudo)
        return datos if isinstance(datos, dict) else None
    except Exception:
        return None
