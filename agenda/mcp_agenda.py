#!/usr/bin/env python3
"""Servidor MCP (stdio) de la agenda de La Asistenta — Ari Vivas Beauty.

Expone las herramientas de agenda que Hermes ofrece al modelo:
  - registrar_cita(...)   -> escribe la reserva en SQLite
  - consultar_citas(fecha) -> lista las citas de un día (para no duplicar)

Sin dependencias externas: solo la stdlib de Python (json, sqlite3).
El transporte MCP por stdio es JSON-RPC 2.0 delimitado por saltos de línea.

La base de datos vive junto a este fichero (agenda.db) y se puede mover con
la variable de entorno AGENDA_DB.

Mecánicas compartidas con la API (agenda_comun.py): código humano de la
cita (AS-XXXX), enlace mágico post-reserva (en la BD solo el hash del
token), eventos del embudo y lista de espera activa (al cancelar, las
entradas compatibles pasan a «por_avisar»; el aviso saliente NO se envía:
Twilio trial no lo permite, error 21654).
"""
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("AGENDA_DB", os.path.join(BASE_DIR, "agenda.db"))

sys.path.insert(0, BASE_DIR)
import agenda_comun as comun

# Carta REAL del salón (la misma que la API y el SOUL; no inventar otra).
CARTA = {
    "Diseño de cejas": (18.0, 25),
    "Ombré Brows Henna": (30.0, 65),
    "Brow Lamination": (45.0, 65),
    "Depilación rápida": (None, 12),
}
# Ventana de apertura por día de semana (lunes=0 … domingo=6; None=cerrado).
VENTANA = {0: (600, 1200), 1: (600, 1200), 2: (600, 1200), 3: (600, 1200),
           4: (600, 1200), 5: (600, 840), 6: None}
PASO_MIN = 15

SCHEMA = """
CREATE TABLE IF NOT EXISTS citas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    creado_en     TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    servicio      TEXT NOT NULL,
    fecha         TEXT NOT NULL,          -- YYYY-MM-DD
    hora          TEXT NOT NULL,          -- HH:MM (24 h)
    precio_eur    REAL NOT NULL,
    duracion_min  INTEGER NOT NULL,
    estado        TEXT NOT NULL DEFAULT 'confirmada',
    origen        TEXT NOT NULL DEFAULT 'whatsapp',  -- whatsapp | cli
    telefono      TEXT,
    notas         TEXT
);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha, hora);
"""


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    comun.migrar(conn)  # migración aditiva compartida con la API
    return conn


def _a_minutos(hora):
    h, m = hora.split(":")
    return int(h) * 60 + int(m)


def _a_hora(minutos):
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def registrar_cita(args):
    obligatorios = ["nombre", "servicio", "fecha", "hora", "precio_eur", "duracion_min"]
    faltan = [k for k in obligatorios if args.get(k) in (None, "")]
    if faltan:
        raise ValueError(f"Faltan datos obligatorios: {', '.join(faltan)}")
    # Validaciones mínimas de formato: la fecha y la hora deben ser reales.
    datetime.strptime(args["fecha"], "%Y-%m-%d")
    datetime.strptime(args["hora"], "%H:%M")
    fecha = args["fecha"]
    hora = args["hora"]
    duracion = int(args["duracion_min"])
    inicio = _a_minutos(hora)
    fin = inicio + duracion
    conn = db()
    try:
        # Comprobación de solape ANTES de escribir: si el intervalo
        # [hora, hora+duracion) se cruza con el de cualquier cita
        # 'confirmada' de esa fecha, no se registra nada. Las canceladas
        # no bloquean el hueco.
        existentes = conn.execute(
            """SELECT id, nombre, servicio, hora, duracion_min FROM citas
               WHERE fecha = ? AND estado = 'confirmada' ORDER BY hora""",
            (fecha,),
        ).fetchall()
        conflictos = []
        for r in existentes:
            e_ini = _a_minutos(r[3])
            e_fin = e_ini + int(r[4])
            if inicio < e_fin and e_ini < fin:
                conflictos.append((r, e_ini, e_fin))
        if conflictos:
            detalle = "; ".join(
                f"cita #{r[0]} ({r[2]} de {r[1]}, {_a_hora(e_ini)}–{_a_hora(e_fin)})"
                for r, e_ini, e_fin in conflictos
            )
            libre_desde = _a_hora(max(e_fin for _, _, e_fin in conflictos))
            raise ValueError(
                f"Conflicto de agenda: NO se registró la cita. El hueco del "
                f"{fecha} a las {hora} está ocupado por: {detalle}. La agenda "
                f"queda libre a partir de las {libre_desde}. Explica el "
                "conflicto a la clienta y ofrécele la alternativa libre más "
                f"cercana (a partir de las {libre_desde}, o anterior si cabe); "
                "no registres nada hasta que ella elija la nueva hora y la "
                "confirme con el flujo habitual (resumen → su sí → registro)."
            )
        # Enlace mágico: token nuevo; en la BD solo se guarda su hash.
        token, token_hash = comun.nuevo_token()
        cur = conn.execute(
            """INSERT INTO citas
               (creado_en, nombre, servicio, fecha, hora, precio_eur,
                duracion_min, estado, origen, telefono, notas, token_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, ?, ?, ?)""",
            (
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
                str(args["nombre"]).strip(),
                str(args["servicio"]).strip(),
                args["fecha"],
                args["hora"],
                float(args["precio_eur"]),
                int(args["duracion_min"]),
                str(args.get("origen") or "whatsapp"),
                (str(args["telefono"]).strip() if args.get("telefono") else None),
                (str(args["notas"]).strip() if args.get("notas") else None),
                token_hash,
            ),
        )
        cita_id = cur.lastrowid
        comun.registrar_evento(conn, "reserva_confirmada", cita_id, "whatsapp")
        conn.commit()
    finally:
        conn.close()
    codigo = comun.codigo_cita(cita_id)
    enlace = comun.enlace_cita(token)
    return {
        "ok": True,
        "id": cita_id,
        "codigo": codigo,
        "enlace": enlace,
        "resumen": (
            f"Cita {codigo} registrada: {args['servicio']} para {args['nombre']}, "
            f"{args['fecha']} a las {args['hora']} "
            f"({args['precio_eur']} €, {args['duracion_min']} min, estado: confirmada). "
            f"Enlace de la clienta (inclúyelo LITERAL en tu mensaje de "
            f"confirmación; desde ahí puede ver, cancelar o reagendar su "
            f"cita y responder dos preguntas de preparación): {enlace}"
        ),
    }


def consultar_citas(args):
    fecha = args.get("fecha")
    if not fecha:
        raise ValueError("Falta la fecha (YYYY-MM-DD)")
    datetime.strptime(fecha, "%Y-%m-%d")
    conn = db()
    try:
        rows = conn.execute(
            """SELECT id, nombre, servicio, hora, precio_eur, duracion_min, estado, origen
               FROM citas WHERE fecha = ? ORDER BY hora""",
            (fecha,),
        ).fetchall()
    finally:
        conn.close()
    citas = [
        {
            "id": r[0], "codigo": comun.codigo_cita(r[0]), "nombre": r[1],
            "servicio": r[2], "hora": r[3], "precio_eur": r[4],
            "duracion_min": r[5], "estado": r[6], "origen": r[7],
        }
        for r in rows
    ]
    return {"ok": True, "fecha": fecha, "total": len(citas), "citas": citas}


def consultar_disponibilidad(args):
    """Huecos REALES de inicio para un servicio y un día, paginados.

    Pensada para proponer 3–5 horas concretas y ofrecer «ver más
    horarios» con el desplazamiento siguiente. Anota el evento del
    embudo «hueco_propuesto».
    """
    servicio = (str(args["servicio"]).strip() if args.get("servicio") else None)
    if servicio not in CARTA:
        raise ValueError(
            "Servicio fuera de la carta real. La carta es: "
            + ", ".join(CARTA.keys()))
    fecha = args.get("fecha")
    if not fecha:
        raise ValueError("Falta la fecha (YYYY-MM-DD)")
    dia = datetime.strptime(fecha, "%Y-%m-%d").date()
    limite = max(1, min(int(args.get("limite") or 5), 12))
    desplazamiento = max(0, int(args.get("desplazamiento") or 0))
    conn = db()
    try:
        ventana = VENTANA[dia.weekday()]
        if ventana is None:
            comun.registrar_evento(conn, "hueco_propuesto", None, "whatsapp")
            conn.commit()
            return {"ok": True, "servicio": servicio, "fecha": fecha,
                    "huecos": [], "total_libres": 0, "hay_mas": False,
                    "motivo": "domingo cerrado"}
        apertura, cierre = ventana
        duracion = int(CARTA[servicio][1])
        existentes = conn.execute(
            """SELECT hora, duracion_min FROM citas
               WHERE fecha = ? AND estado = 'confirmada' ORDER BY hora""",
            (fecha,),
        ).fetchall()
        ocupados = [(_a_minutos(r[0]), _a_minutos(r[0]) + int(r[1]))
                    for r in existentes]
        libres = []
        t = apertura
        while t + duracion <= cierre:
            if all(t + duracion <= o_ini or t >= o_fin for o_ini, o_fin in ocupados):
                libres.append(_a_hora(t))
            t += PASO_MIN
        comun.registrar_evento(conn, "hueco_propuesto", None, "whatsapp")
        conn.commit()
    finally:
        conn.close()
    pagina = libres[desplazamiento:desplazamiento + limite]
    hay_mas = desplazamiento + limite < len(libres)
    return {
        "ok": True, "servicio": servicio, "fecha": fecha,
        "huecos": pagina, "total_libres": len(libres), "hay_mas": hay_mas,
        "siguiente_desplazamiento": (desplazamiento + limite) if hay_mas else None,
    }


def apuntar_lista_espera(args):
    """Apunta a una clienta en la lista de espera activa.

    Si luego se libera un hueco compatible (una cancelación de su
    servicio en su fecha preferida), su entrada pasa a «por_avisar».
    El aviso saliente NO se envía automáticamente (Twilio trial lo
    impide); no prometas a la clienta que le escribiremos: dile que
    queda apuntada y que puede escribirnos para consultar su hueco.
    """
    nombre = (str(args["nombre"]).strip() if args.get("nombre") else None)
    servicio = (str(args["servicio"]).strip() if args.get("servicio") else None)
    if not nombre:
        raise ValueError("Falta el nombre de la clienta")
    if servicio not in CARTA:
        raise ValueError(
            "Servicio fuera de la carta real. La carta es: "
            + ", ".join(CARTA.keys()))
    fecha_pref = (str(args["fecha_pref"]).strip() if args.get("fecha_pref") else None)
    if fecha_pref:
        datetime.strptime(fecha_pref, "%Y-%m-%d")
    hora_pref = (str(args["hora_pref"]).strip() if args.get("hora_pref") else None)
    if hora_pref:
        datetime.strptime(hora_pref, "%H:%M")
    conn = db()
    try:
        cur = conn.execute(
            """INSERT INTO lista_espera
               (creado_en, nombre, telefono, servicio, fecha_pref, hora_pref,
                estado, notas)
               VALUES (?, ?, ?, ?, ?, ?, 'esperando', ?)""",
            (
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
                nombre,
                (str(args["telefono"]).strip() if args.get("telefono") else None),
                servicio, fecha_pref, hora_pref,
                (str(args["notas"]).strip() if args.get("notas") else None),
            ),
        )
        entrada_id = cur.lastrowid
        comun.registrar_evento(conn, "lista_espera_alta", None, "whatsapp")
        conn.commit()
    finally:
        conn.close()
    return {
        "ok": True, "id": entrada_id,
        "resumen": (
            f"{nombre} quedó apuntada en la lista de espera para {servicio}"
            + (f" el {fecha_pref}" if fecha_pref else "")
            + (f" sobre las {hora_pref}" if hora_pref else "")
            + ". Si se libera un hueco compatible, su entrada pasará a "
              "«por_avisar» en el panel del salón."
        ),
    }


def consultar_lista_espera(args):
    """Consulta la lista de espera de UNA clienta por su teléfono.

    Úsala al abrir una conversación: si la clienta tiene una entrada en
    «por_avisar», es que se liberó un hueco compatible con lo que
    esperaba y puedes ofrecérselo en ese momento.
    """
    telefono = (str(args["telefono"]).strip() if args.get("telefono") else "")
    digitos = "".join(c for c in telefono if c.isdigit())
    if len(digitos) < 9:
        raise ValueError("Hace falta el teléfono de la clienta (al menos 9 dígitos)")
    sufijo = digitos[-9:]
    conn = db()
    try:
        rows = conn.execute(
            """SELECT id, nombre, servicio, fecha_pref, hora_pref, estado
               FROM lista_espera
               WHERE telefono IS NOT NULL
                 AND replace(replace(replace(telefono, ' ', ''), '+', ''), '-', '')
                     LIKE '%' || ?
               ORDER BY creado_en""",
            (sufijo,),
        ).fetchall()
    finally:
        conn.close()
    entradas = [
        {"id": r[0], "nombre": r[1], "servicio": r[2], "fecha_pref": r[3],
         "hora_pref": r[4], "estado": r[5]}
        for r in rows
    ]
    por_avisar = [e for e in entradas if e["estado"] == "por_avisar"]
    return {
        "ok": True, "entradas": entradas,
        "hay_hueco_liberado": bool(por_avisar),
        "resumen": (
            "Se liberó un hueco compatible con lo que esta clienta esperaba "
            f"({por_avisar[0]['servicio']}"
            + (f", {por_avisar[0]['fecha_pref']}" if por_avisar and por_avisar[0]['fecha_pref'] else "")
            + "): ofréceselo en esta conversación."
            if por_avisar else
            "Esta clienta no tiene ningún hueco liberado pendiente de aviso."
        ),
    }


def cancelar_cita(args):
    """Marca una cita como 'cancelada' (nunca la borra).

    Se localiza por id, o por nombre+fecha (debe haber exactamente una cita
    confirmada con ese nombre ese día; si hay varias, se devuelve error con
    el detalle para que se pida el id o la hora).
    """
    cita_id = args.get("id")
    if not cita_id and args.get("codigo"):
        # La clienta puede localizar su cita por su código humano AS-XXXX.
        cita_id = comun.id_desde_codigo(args["codigo"])
        if not cita_id:
            raise ValueError(f"Código de cita no válido: {args['codigo']}")
    nombre = (str(args["nombre"]).strip() if args.get("nombre") else None)
    fecha = args.get("fecha")
    if fecha:
        datetime.strptime(fecha, "%Y-%m-%d")  # valida formato
    conn = db()
    try:
        if cita_id:
            rows = conn.execute(
                "SELECT id, nombre, servicio, fecha, hora, estado FROM citas WHERE id = ?",
                (int(cita_id),),
            ).fetchall()
        elif nombre and fecha:
            rows = conn.execute(
                """SELECT id, nombre, servicio, fecha, hora, estado FROM citas
                   WHERE lower(nombre) = lower(?) AND fecha = ? ORDER BY hora""",
                (nombre, fecha),
            ).fetchall()
        else:
            raise ValueError("Indica el id de la cita, o nombre y fecha para localizarla")
        if not rows:
            raise ValueError("No se encontró ninguna cita con esos datos")
        candidatas = [r for r in rows if r[5] != "cancelada"]
        if not candidatas:
            r = rows[0]
            return {
                "ok": True, "ya_estaba_cancelada": True, "id": r[0],
                "resumen": (
                    f"La cita #{r[0]} ({r[2]} de {r[1]}, {r[3]} {r[4]}) ya estaba cancelada."
                ),
            }
        if len(candidatas) > 1:
            detalle = "; ".join(
                f"#{r[0]} {r[2]} a las {r[4]}" for r in candidatas
            )
            raise ValueError(
                f"Hay varias citas con ese nombre y fecha ({detalle}): "
                "indica el id o la hora exacta de la cita a cancelar"
            )
        r = candidatas[0]
        conn.execute("UPDATE citas SET estado = 'cancelada' WHERE id = ?", (r[0],))
        comun.registrar_evento(conn, "cancelada", r[0], "whatsapp")
        # El hueco queda libre: la lista de espera compatible pasa a
        # «por_avisar» (sin envío automático: no es posible con Twilio
        # trial, y nunca se finge enviado).
        n_aviso = comun.marcar_por_avisar(conn, r[2], r[3])
        conn.commit()
    finally:
        conn.close()
    return {
        "ok": True, "id": r[0], "codigo": comun.codigo_cita(r[0]),
        "estado": "cancelada",
        "lista_espera_por_avisar": n_aviso,
        "resumen": (
            f"Cita {comun.codigo_cita(r[0])} cancelada: {r[2]} de {r[1]}, "
            f"{r[3]} a las {r[4]}. "
            "El registro se conserva en la agenda con estado 'cancelada'."
        ),
    }


TOOLS = [
    {
        "name": "registrar_cita",
        "description": (
            "Registra una cita CONFIRMADA en la agenda real del salón. "
            "Úsala SOLO cuando la clienta haya aceptado expresamente el resumen "
            "de su cita (servicio, fecha, hora y nombre ya acordados). "
            "Antes de escribir comprueba el hueco: si la hora se solapa con "
            "otra cita confirmada de ese día, NO registra nada y devuelve un "
            "error que dice qué cita choca y desde qué hora queda libre la "
            "agenda; en ese caso explica el conflicto, ofrece la alternativa "
            "libre más cercana y espera a que la clienta elija y confirme la "
            "nueva hora antes de volver a llamarla. "
            "Devuelve el id, el código humano de la cita (AS-XXXX) y el "
            "enlace mágico de la clienta: incluye SIEMPRE el código y el "
            "enlace literal en tu mensaje de confirmación."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre de la clienta"},
                "servicio": {"type": "string", "description": "Servicio exacto, p. ej. 'Diseño de cejas'"},
                "fecha": {"type": "string", "description": "Fecha de la cita en formato YYYY-MM-DD"},
                "hora": {"type": "string", "description": "Hora en formato HH:MM (24 h)"},
                "precio_eur": {"type": "number", "description": "Precio en euros, p. ej. 18"},
                "duracion_min": {"type": "integer", "description": "Duración en minutos, p. ej. 25"},
                "origen": {
                    "type": "string", "enum": ["whatsapp", "cli"],
                    "description": "Canal de la conversación. Usa 'whatsapp' salvo que el sistema te indique otro canal.",
                },
                "telefono": {"type": "string", "description": "Teléfono/WhatsApp de la clienta si se conoce"},
                "notas": {"type": "string", "description": "Notas opcionales"},
            },
            "required": ["nombre", "servicio", "fecha", "hora", "precio_eur", "duracion_min"],
        },
    },
    {
        "name": "consultar_citas",
        "description": (
            "Lista las citas ya registradas para una fecha (YYYY-MM-DD). "
            "Úsala si necesitas comprobar qué hay anotado ese día antes de confirmar un hueco."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "fecha": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"},
            },
            "required": ["fecha"],
        },
    },
    {
        "name": "cancelar_cita",
        "description": (
            "Cancela una cita ya registrada: la marca como 'cancelada' en la "
            "agenda (el registro NO se borra). Úsala SOLO cuando la clienta "
            "haya confirmado expresamente que quiere cancelar ESA cita. "
            "Localízala por su id, por su código humano (AS-XXXX, el que "
            "recibió en su confirmación), o por nombre de la clienta y fecha "
            "de la cita (YYYY-MM-DD); si nombre+fecha dan varias citas, la "
            "herramienta lo avisa para que pidas el id o la hora. "
            "Al cancelar, el hueco liberado marca «por_avisar» en la lista "
            "de espera compatible (sin enviar ningún mensaje automático)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "Identificador de la cita, si se conoce"},
                "codigo": {"type": "string", "description": "Código humano de la cita (AS-XXXX), si la clienta lo da"},
                "nombre": {"type": "string", "description": "Nombre de la clienta (con fecha, si no hay id)"},
                "fecha": {"type": "string", "description": "Fecha de la cita en formato YYYY-MM-DD (con nombre, si no hay id)"},
            },
        },
    },
    {
        "name": "consultar_disponibilidad",
        "description": (
            "Huecos REALES libres para un servicio en una fecha, en páginas "
            "de 3–5 (parámetro limite) con desplazamiento para «ver más "
            "horarios». Úsala SIEMPRE antes de proponer horas: propón solo "
            "horas que esta herramienta devuelva, citando servicio, fecha y "
            "hora explícitos, y ofrece «ver más horarios» llamándola de "
            "nuevo con siguiente_desplazamiento cuando hay_mas sea true."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "servicio": {"type": "string", "description": "Servicio exacto de la carta, p. ej. 'Diseño de cejas'"},
                "fecha": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"},
                "limite": {"type": "integer", "description": "Cuántos huecos devolver (por defecto 5, máximo 12)"},
                "desplazamiento": {"type": "integer", "description": "Cuántos huecos saltarse (para «ver más horarios»)"},
            },
            "required": ["servicio", "fecha"],
        },
    },
    {
        "name": "apuntar_lista_espera",
        "description": (
            "Apunta a la clienta en la lista de espera activa cuando el "
            "hueco que quiere no existe o el día está completo. Si luego se "
            "libera un hueco compatible (cancelación de su servicio en su "
            "fecha preferida), su entrada quedará «por_avisar» en el panel "
            "del salón. NO prometas que le escribiremos automáticamente: "
            "con el canal actual el aviso saliente no es posible; dile que "
            "queda apuntada y que si nos escribe le diremos si se liberó."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Nombre de la clienta"},
                "telefono": {"type": "string", "description": "Su WhatsApp (el de esta conversación, si se conoce)"},
                "servicio": {"type": "string", "description": "Servicio exacto de la carta"},
                "fecha_pref": {"type": "string", "description": "Fecha preferida YYYY-MM-DD (opcional)"},
                "hora_pref": {"type": "string", "description": "Hora preferida HH:MM (opcional)"},
                "notas": {"type": "string", "description": "Notas opcionales"},
            },
            "required": ["nombre", "servicio"],
        },
    },
    {
        "name": "consultar_lista_espera",
        "description": (
            "Consulta la lista de espera de la clienta de ESTA conversación "
            "por su teléfono. Úsala al abrir la conversación cuando conozcas "
            "su número: si hay_hueco_liberado es true, se liberó un hueco "
            "compatible con lo que esperaba y debes ofrecérselo."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "telefono": {"type": "string", "description": "Teléfono/WhatsApp de la clienta"},
            },
            "required": ["telefono"],
        },
    },
]

HANDLERS = {
    "registrar_cita": registrar_cita,
    "consultar_citas": consultar_citas,
    "cancelar_cita": cancelar_cita,
    "consultar_disponibilidad": consultar_disponibilidad,
    "apuntar_lista_espera": apuntar_lista_espera,
    "consultar_lista_espera": consultar_lista_espera,
}


def result_text(payload, is_error=False):
    return {
        "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}],
        "isError": is_error,
    }


def handle(msg):
    method = msg.get("method", "")
    msg_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        proto = params.get("protocolVersion") or "2024-11-05"
        return {"jsonrpc": "2.0", "id": msg_id, "result": {
            "protocolVersion": proto,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "agenda-la-asistenta", "version": "1.0.0"},
        }}
    if method.startswith("notifications/"):
        return None  # las notificaciones no llevan respuesta
    if method == "ping":
        return {"jsonrpc": "2.0", "id": msg_id, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": msg_id, "result": {"tools": TOOLS}}
    if method == "resources/list":
        return {"jsonrpc": "2.0", "id": msg_id, "result": {"resources": []}}
    if method == "prompts/list":
        return {"jsonrpc": "2.0", "id": msg_id, "result": {"prompts": []}}
    if method == "tools/call":
        name = params.get("name", "")
        fn = HANDLERS.get(name)
        if fn is None:
            return {"jsonrpc": "2.0", "id": msg_id,
                    "result": result_text({"ok": False, "error": f"Herramienta desconocida: {name}"}, True)}
        try:
            payload = fn(params.get("arguments") or {})
            return {"jsonrpc": "2.0", "id": msg_id, "result": result_text(payload)}
        except Exception as exc:  # error de validación o de BD: se devuelve como error de herramienta
            return {"jsonrpc": "2.0", "id": msg_id,
                    "result": result_text({"ok": False, "error": str(exc)}, True)}
    return {"jsonrpc": "2.0", "id": msg_id,
            "error": {"code": -32601, "message": f"Método no soportado: {method}"}}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = handle(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
