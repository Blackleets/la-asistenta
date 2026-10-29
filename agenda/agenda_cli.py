#!/usr/bin/env python3
"""Visor humano de la agenda de La Asistenta (solo lectura).

Uso:
  python3 agenda_cli.py              -> todas las citas
  python3 agenda_cli.py 2026-10-29   -> citas de ese día
  python3 agenda_cli.py --embudo     -> conteos del embudo medido
  python3 agenda_cli.py --embudo 2026-10-01 2026-10-31
                                     -> embudo entre dos fechas (inclusive)
  python3 agenda_cli.py --espera     -> lista de espera (por_avisar primero)
  python3 agenda_cli.py --bandeja    -> bandeja de salida (agradecimientos)
"""
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agenda_comun as comun

DB_PATH = os.environ.get(
    "AGENDA_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "agenda.db")
)

# Alcance por negocio (Fase 2, D2): el visor muestra SOLO el negocio
# indicado (por defecto, el piloto). Otro: AGENDA_NEGOCIO_ID=<id>.
NEGOCIO = os.environ.get("AGENDA_NEGOCIO_ID", comun.NEGOCIO_DEFECTO)


def embudo(conn, args):
    desde = args[0] if len(args) > 0 else None
    hasta = args[1] if len(args) > 1 else None
    cond, params = ["negocio_id = ?"], [NEGOCIO]
    if desde:
        cond.append("substr(ts, 1, 10) >= ?")
        params.append(desde)
    if hasta:
        cond.append("substr(ts, 1, 10) <= ?")
        params.append(hasta)
    donde = " WHERE " + " AND ".join(cond)
    por_tipo = dict(conn.execute(
        f"SELECT tipo, COUNT(*) FROM eventos{donde} GROUP BY tipo", params))
    por_origen = dict(conn.execute(
        f"SELECT origen, COUNT(*) FROM eventos{donde} GROUP BY origen", params))
    print(f"EMBUDO {desde or 'desde el principio'} → {hasta or 'hoy'}")
    for tipo in comun.TIPOS_EVENTO:
        print(f"  {tipo:<20} {por_tipo.get(tipo, 0)}")
    print(f"  {'TOTAL':<20} {sum(por_tipo.values())}")
    print("  por origen: " + ", ".join(f"{k}={v}" for k, v in por_origen.items()))


def main():
    if not os.path.exists(DB_PATH):
        print("La agenda aún no existe (nadie ha registrado una cita).")
        return
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    args = sys.argv[1:]
    if args and args[0] == "--embudo":
        embudo(conn, args[1:])
        conn.close()
        return
    if args and args[0] == "--espera":
        rows = conn.execute(
            """SELECT * FROM lista_espera WHERE negocio_id = ?
               ORDER BY (estado = 'por_avisar') DESC, creado_en""",
            (NEGOCIO,)).fetchall()
        conn.close()
        for r in rows:
            print(json.dumps(dict(r), ensure_ascii=False))
        print(f"-- {len(rows)} entrada(s) en lista de espera")
        return
    if args and args[0] == "--bandeja":
        rows = conn.execute(
            "SELECT * FROM bandeja_salida WHERE negocio_id = ? ORDER BY creado_en",
            (NEGOCIO,)).fetchall()
        conn.close()
        for r in rows:
            print(json.dumps(dict(r), ensure_ascii=False))
        print(f"-- {len(rows)} mensaje(s) en la bandeja de salida")
        return
    if args:
        rows = conn.execute(
            "SELECT * FROM citas WHERE fecha = ? AND negocio_id = ? ORDER BY hora",
            (args[0], NEGOCIO)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM citas WHERE negocio_id = ? ORDER BY fecha, hora",
            (NEGOCIO,)).fetchall()
    conn.close()
    if not rows:
        print("Sin citas.")
        return
    for r in rows:
        d = dict(r)
        d.pop("token_hash", None)  # el hash del enlace nunca se imprime
        d["codigo"] = comun.codigo_cita(d["id"])
        print(json.dumps(d, ensure_ascii=False))
    print(f"-- {len(rows)} cita(s)")


if __name__ == "__main__":
    main()
