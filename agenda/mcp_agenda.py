#!/usr/bin/env python3
"""Servidor MCP (stdio) de la agenda de La Asistenta — Ari Vivas Beauty.

Expone las herramientas de agenda que Hermes ofrece al modelo:
  - registrar_cita(...)   -> escribe la reserva en SQLite
  - consultar_citas(fecha) -> lista las citas de un día (para no duplicar)

Sin dependencias externas: solo la stdlib de Python (json, sqlite3).
El transporte MCP por stdio es JSON-RPC 2.0 delimitado por saltos de línea.

La base de datos vive junto a este fichero (agenda.db) y se puede mover con
la variable de entorno AGENDA_DB.
"""
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("AGENDA_DB", os.path.join(BASE_DIR, "agenda.db"))

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
        cur = conn.execute(
            """INSERT INTO citas
               (creado_en, nombre, servicio, fecha, hora, precio_eur,
                duracion_min, estado, origen, telefono, notas)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, ?, ?)""",
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
            ),
        )
        conn.commit()
        cita_id = cur.lastrowid
    finally:
        conn.close()
    return {
        "ok": True,
        "id": cita_id,
        "resumen": (
            f"Cita #{cita_id} registrada: {args['servicio']} para {args['nombre']}, "
            f"{args['fecha']} a las {args['hora']} "
            f"({args['precio_eur']} €, {args['duracion_min']} min, estado: confirmada)"
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
            "id": r[0], "nombre": r[1], "servicio": r[2], "hora": r[3],
            "precio_eur": r[4], "duracion_min": r[5], "estado": r[6], "origen": r[7],
        }
        for r in rows
    ]
    return {"ok": True, "fecha": fecha, "total": len(citas), "citas": citas}


def cancelar_cita(args):
    """Marca una cita como 'cancelada' (nunca la borra).

    Se localiza por id, o por nombre+fecha (debe haber exactamente una cita
    confirmada con ese nombre ese día; si hay varias, se devuelve error con
    el detalle para que se pida el id o la hora).
    """
    cita_id = args.get("id")
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
        conn.commit()
    finally:
        conn.close()
    return {
        "ok": True, "id": r[0], "estado": "cancelada",
        "resumen": (
            f"Cita #{r[0]} cancelada: {r[2]} de {r[1]}, {r[3]} a las {r[4]}. "
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
            "Devuelve el identificador de la cita registrada."
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
            "Localízala por su id, o por nombre de la clienta y fecha de la "
            "cita (YYYY-MM-DD); si nombre+fecha dan varias citas, la "
            "herramienta lo avisa para que pidas el id o la hora."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "Identificador de la cita, si se conoce"},
                "nombre": {"type": "string", "description": "Nombre de la clienta (con fecha, si no hay id)"},
                "fecha": {"type": "string", "description": "Fecha de la cita en formato YYYY-MM-DD (con nombre, si no hay id)"},
            },
        },
    },
]

HANDLERS = {
    "registrar_cita": registrar_cita,
    "consultar_citas": consultar_citas,
    "cancelar_cita": cancelar_cita,
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
