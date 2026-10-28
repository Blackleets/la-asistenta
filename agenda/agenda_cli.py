#!/usr/bin/env python3
"""Visor humano de la agenda de La Asistenta (solo lectura).

Uso:
  python3 agenda_cli.py              -> todas las citas
  python3 agenda_cli.py 2026-10-29   -> citas de ese día
"""
import json
import os
import sqlite3
import sys

DB_PATH = os.environ.get(
    "AGENDA_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "agenda.db")
)


def main():
    if not os.path.exists(DB_PATH):
        print("La agenda aún no existe (nadie ha registrado una cita).")
        return
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if len(sys.argv) > 1:
        rows = conn.execute(
            "SELECT * FROM citas WHERE fecha = ? ORDER BY hora", (sys.argv[1],)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM citas ORDER BY fecha, hora").fetchall()
    conn.close()
    if not rows:
        print("Sin citas.")
        return
    for r in rows:
        print(json.dumps(dict(r), ensure_ascii=False))
    print(f"-- {len(rows)} cita(s)")


if __name__ == "__main__":
    main()
