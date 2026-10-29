#!/usr/bin/env python3
"""Cancelación autorizada por Lee (29/10/2026 13:57: «Cancela las 5,
son de nuestras pruebas») de las 5 citas ambiguas que la limpieza
D-05 dejó listadas sin tocar: ids 3 «Lucía», 4 «Marta», 5 «Elena»
(02/11) y 73, 74 «Arianna».

Siempre vía API: POST /citas/<id>/cancelar -> estado «cancelada»
(en este sistema nada se borra). Informe antes, cancelación y
verificación después. Requiere el token en agenda.env (como las
baterías).
"""
import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error

API = "http://127.0.0.1:8081"
AQUI = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(AQUI, "agenda.db")
IDS = [3, 4, 5, 73, 74]


def _token():
    t = (os.environ.get("AGENDA_API_TOKEN") or "").strip()
    if t:
        return t
    for ruta in (os.environ.get("AGENDA_ENV_FILE") or "",
                 os.path.join(AQUI, "agenda.env")):
        try:
            with open(ruta, encoding="utf-8") as f:
                for linea in f:
                    if linea.startswith("AGENDA_API_TOKEN="):
                        return linea.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
    raise SystemExit("Sin AGENDA_API_TOKEN")


TOK = {"X-API-Token": _token(), "Content-Type": "application/json"}


def req(metodo, ruta, cuerpo=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(API + ruta, data=datos, method=metodo,
                               headers=TOK)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def estados(conn, ids):
    filas = conn.execute(
        "SELECT id, nombre, fecha, hora, estado FROM citas WHERE id IN (%s) "
        "ORDER BY id" % ",".join("?" * len(ids)), ids).fetchall()
    return [dict(f) for f in filas]


def main():
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    print("ANTES:")
    for f in estados(conn, IDS):
        print(f"  cita {f['id']}: «{f['nombre']}» {f['fecha']} {f['hora']} "
              f"-> {f['estado']}")
    vivas = conn.execute(
        "SELECT COUNT(*) FROM citas WHERE estado = 'confirmada'"
    ).fetchone()[0]
    print(f"  confirmadas vivas (total agenda): {vivas}")
    conn.close()

    for cid in IDS:
        st, d = req("POST", f"/citas/{cid}/cancelar")
        print(f"POST /citas/{cid}/cancelar -> {st} {json.dumps(d, ensure_ascii=False)[:200]}")
        if st != 200:
            print(f"ERROR: la cita {cid} no devolvió 200; se detiene.",
                  file=sys.stderr)
            sys.exit(1)

    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    print("DESPUÉS:")
    ok = True
    for f in estados(conn, IDS):
        print(f"  cita {f['id']}: «{f['nombre']}» {f['fecha']} {f['hora']} "
              f"-> {f['estado']}")
        ok = ok and f["estado"] == "cancelada"
    restantes = conn.execute(
        "SELECT id, nombre, fecha, hora FROM citas "
        "WHERE estado = 'confirmada' ORDER BY id").fetchall()
    print(f"  confirmadas vivas restantes: {len(restantes)}")
    for f in restantes:
        print(f"    cita {f['id']}: «{f['nombre']}» {f['fecha']} {f['hora']}")
    hoy = conn.execute(
        "SELECT COUNT(*) FROM citas WHERE estado = 'confirmada' "
        "AND fecha = date('now', 'localtime')").fetchone()[0]
    print(f"  confirmadas vivas HOY: {hoy}")
    conteos = dict(conn.execute(
        "SELECT estado, COUNT(*) FROM citas GROUP BY estado").fetchall())
    print(f"  conteos por estado: {conteos}")
    conn.close()
    print("VERIFICACIÓN:", "OK — las 5 constan «cancelada»" if ok
          else "FALLO — alguna no quedó cancelada")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
