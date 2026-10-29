#!/usr/bin/env python3
"""Limpieza de la bandeja de salida en la máquina: descarta SOLO las
entradas pendientes cuyo nombre de clienta contiene «PRUEBA» (son de
las baterías automáticas, no de clientas reales). No imprime textos
ni teléfonos: solo conteos e ids."""
import json
import os
import urllib.request

AGENDA = "http://127.0.0.1:8081"


def _token():
    """Token de la agenda SOLO desde el entorno (D7/Fase 2)."""
    t = (os.environ.get("AGENDA_API_TOKEN") or "").strip()
    if t:
        return t
    aqui = os.path.dirname(os.path.abspath(__file__))
    for ruta in (os.environ.get("AGENDA_ENV_FILE") or "",
                 os.path.join(aqui, "..", "agenda", "agenda.env")):
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
    r = urllib.request.Request(AGENDA + ruta, data=datos, method=metodo,
                               headers=TOK)
    with urllib.request.urlopen(r, timeout=15) as resp:
        return resp.status, json.loads(resp.read().decode())


st, d = req("GET", "/bandeja?estado=pendiente")
pendientes = d.get("bandeja", [])
de_prueba = [b for b in pendientes if "PRUEBA" in (b.get("nombre") or "")]
print(f"pendientes totales: {len(pendientes)} · de prueba: {len(de_prueba)}")
for b in de_prueba:
    st, _ = req("POST", f"/bandeja/{b['id']}/estado", {"estado": "descartada"})
    print(f"  bandeja {b['id']} (cita {b['cita_id']}) -> descartada [{st}]")
st, d = req("GET", "/bandeja?estado=pendiente")
print(f"pendientes tras la limpieza: {len(d.get('bandeja', []))}")
