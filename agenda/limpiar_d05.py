#!/usr/bin/env python3
"""Limpieza D-05 (QA18): retirar los restos de NUESTRAS pruebas de la
agenda del piloto (Ari Vivas Beauty) antes del ensayo del 02/11.

Regla de identificación (conservadora): un registro es «de prueba»
SOLO si el nombre de la clienta lleva la marca de las baterías/QA —
empieza por «PRUEBA» (cualquier capitalización: PRUEBA…, Prueba…) o
por «QA» seguido de dígito (QA18…, QA16…). Los teléfonos de batería
(600111222, 611222333, 600123456, 600000000, +34600123456,
+34600999888) se muestran como corroboración en el informe, pero
NUNCA bastan por sí solos: un registro con nombre sin marca no se
toca, se lista como «ambiguo» para decisión del principal.

Acciones (siempre vía API, para que queden los eventos del embudo):
  - citas de prueba aún «confirmada»  -> POST /citas/<id>/cancelar
    (quedan «cancelada»: en este sistema nada se borra);
  - mensajes de prueba «pendiente» de la bandeja de salida
    -> POST /bandeja/<id>/estado {descartada} (estado terminal).
Las citas de prueba en estados terminales (cumplida/no_show/
cancelada) son historial y NO se tocan.

Uso:
  python3 limpiar_d05.py --solo-informe   # no toca nada
  python3 limpiar_d05.py                  # aplica la limpieza
Requiere el token en el entorno o en agenda.env (como las baterías).
Antes de ejecutarlo se hizo respaldo: backups/agenda.db.bak-20261029-d05
"""
import json
import os
import re
import sqlite3
import sys
import urllib.request
import urllib.error

API = "http://127.0.0.1:8081"
AQUI = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(AQUI, "agenda.db")
PATRON_NOMBRE = re.compile(r"^(prueba|qa\d)", re.IGNORECASE)
TELEFONOS_BATERIA = {"600111222", "611222333", "600123456", "600000000",
                     "+34600123456", "+34600999888"}


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
    raise SystemExit("Sin AGENDA_API_TOKEN: define la variable o agenda/agenda.env")


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


def es_prueba(nombre):
    return bool(PATRON_NOMBRE.match((nombre or "").strip()))


def foto(conn):
    """Foto de conteos (piloto): citas por estado y bandeja pendiente."""
    citas = dict(conn.execute(
        "SELECT estado, COUNT(*) FROM citas "
        "WHERE negocio_id = 'ari-vivas-beauty' GROUP BY estado").fetchall())
    pend = conn.execute(
        "SELECT COUNT(*) FROM bandeja_salida WHERE estado = 'pendiente'"
    ).fetchone()[0]
    return citas, pend


def main():
    aplicar = "--solo-informe" not in sys.argv
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    citas_antes, pend_antes = foto(conn)
    confirmadas = conn.execute(
        "SELECT id, nombre, telefono, fecha, hora, origen FROM citas "
        "WHERE estado = 'confirmada' ORDER BY id").fetchall()
    conf_prueba = [r for r in confirmadas if es_prueba(r["nombre"])]
    conf_ambiguas = [r for r in confirmadas if not es_prueba(r["nombre"])]
    st, d = req("GET", "/bandeja?estado=pendiente")
    pendientes = d.get("bandeja", [])
    band_prueba = [b for b in pendientes if es_prueba(b.get("nombre"))]
    band_ambiguas = [b for b in pendientes if not es_prueba(b.get("nombre"))]
    conn.close()

    print(f"ANTES: citas={citas_antes} · bandeja pendiente={pend_antes}")
    print(f"confirmadas: {len(confirmadas)} · de prueba: {len(conf_prueba)}"
          f" · ambiguas (no se tocan): {len(conf_ambiguas)}")
    for r in conf_ambiguas:
        print(f"  AMBIGUA cita {r['id']}: «{r['nombre']}» tel={r['telefono']} "
              f"{r['fecha']} {r['hora']} origen={r['origen']}")
    print(f"bandeja pendiente: {len(pendientes)} · de prueba: "
          f"{len(band_prueba)} · ambigua: {len(band_ambiguas)}")
    for b in band_ambiguas:
        print(f"  AMBIGUA bandeja {b['id']}: «{b.get('nombre')}» "
              f"cita={b.get('cita_id')}")

    if aplicar:
        for r in conf_prueba:
            st, d = req("POST", f"/citas/{r['id']}/cancelar", {})
            print(f"  cita {r['id']} «{r['nombre']}» -> cancelar [{st}] "
                  f"estado={(d.get('cita') or {}).get('estado')}")
        for b in band_prueba:
            st, _ = req("POST", f"/bandeja/{b['id']}/estado",
                        {"estado": "descartada"})
            print(f"  bandeja {b['id']} (cita {b.get('cita_id')}, "
                  f"«{b.get('nombre')}») -> descartada [{st}]")
        conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        citas_despues, pend_despues = foto(conn)
        conn.close()
        print(f"DESPUÉS: citas={citas_despues} · "
              f"bandeja pendiente={pend_despues}")
    else:
        print("(solo informe: no se ha tocado nada)")


if __name__ == "__main__":
    main()
