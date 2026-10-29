#!/usr/bin/env python3
"""Pruebas de la guarda de agenda en el endpoint POST /citas (puerto 8081).

La guarda vive en la propia API de agenda para que TODOS los canales
(web, app, MCP) compartan la misma regla: horario del salón y anti-solape
con intervalos [hora, hora+duración) contra citas confirmadas.

Se ejecuta contra la API en marcha (por defecto 127.0.0.1:8081, dentro de
la máquina). Las citas de prueba quedan CANCELADAS al final (semántica del
sistema: no se borran).

  AGENDA_API_URL=http://127.0.0.1:8081 python3 pruebas_api_guarda.py
"""
import json
import os
import urllib.request
import urllib.error

API = os.environ.get("AGENDA_API_URL", "http://127.0.0.1:8081").rstrip("/")


def _token():
    """Token de la agenda SOLO desde el entorno (D7/Fase 2): variable
    AGENDA_API_TOKEN o el fichero agenda.env junto a esta batería."""
    t = (os.environ.get("AGENDA_API_TOKEN") or "").strip()
    if t:
        return t
    aqui = os.path.dirname(os.path.abspath(__file__))
    for ruta in (os.environ.get("AGENDA_ENV_FILE") or "",
                 os.path.join(aqui, "agenda.env")):
        try:
            with open(ruta, encoding="utf-8") as f:
                for linea in f:
                    if linea.startswith("AGENDA_API_TOKEN="):
                        return linea.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
    raise SystemExit("Sin AGENDA_API_TOKEN: define la variable o agenda/agenda.env")


TOK = {"X-API-Token": _token()}
res = []
creadas = []


def req(metodo, url, cuerpo=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(url, data=datos, method=metodo)
    for k, v in TOK.items():
        r.add_header(k, v)
    if datos:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def prueba(nombre, ok, detalle=""):
    res.append((nombre, ok))
    print(("OK  " if ok else "FALLO") + " | " + nombre + (" | " + detalle if detalle else ""))


def crear(hora, fecha="2026-11-05", servicio="Diseño de cejas"):
    return req("POST", API + "/citas", {
        "nombre": "PRUEBA API GUARDA", "servicio": servicio,
        "fecha": fecha, "hora": hora})


# 0 · precondición: el jueves 05/11 no hay confirmadas que choquen con
# el intervalo de la primera prueba [12:00, 12:25)
def _min(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


st, d = req("GET", API + "/citas?fecha=2026-11-05")
ocup = [c for c in d.get("citas", []) if c.get("estado") == "confirmada"
        and _min(c["hora"]) < _min("12:25")
        and _min("12:00") < _min(c["hora"]) + int(c["duracion_min"])]
prueba("precondición: 05/11 12:00 sin confirmadas previas", st == 200 and not ocup)

# 1 · cita válida (jueves 05/11 12:00, Diseño 25 min → [12:00, 12:25))
st, d = crear("12:00")
cita = d.get("cita") or {}
prueba("cita válida creada (201, confirmada)",
       st == 201 and cita.get("estado") == "confirmada", f"id={cita.get('id')} st={st}")
if cita.get("id"):
    creadas.append(cita["id"])

# 2 · solapada (12:10 cae dentro de [12:00, 12:25)) → 409 con alternativas
st, d = crear("12:10")
prueba("cita solapada rechazada (409) con alternativas",
       st == 409 and len(d.get("alternativas", [])) > 0,
       f"st={st} err={d.get('error', '')[:60]}")

# 3 · borde exacto: 12:25 empieza justo cuando termina la primera → cabe
st, d = crear("12:25")
cita = d.get("cita") or {}
prueba("borde exacto 12:25 aceptado (intervalo semiabierto)",
       st == 201 and cita.get("estado") == "confirmada", f"id={cita.get('id')} st={st}")
if cita.get("id"):
    creadas.append(cita["id"])

# 4 · fuera de horario: jueves 19:50 + 25 min termina 20:15 > cierre 20:00
st, d = crear("19:50")
prueba("fin tras el cierre entre semana rechazado (409)",
       st == 409, f"st={st} err={d.get('error', '')[:60]}")

# 5 · sábado 07/11 13:50 + 25 min termina 14:15 > cierre 14:00
st, d = crear("13:50", fecha="2026-11-07")
prueba("fin tras el cierre del sábado rechazado (409)",
       st == 409, f"st={st} err={d.get('error', '')[:60]}")

# 6 · domingo 08/11: cerrado todo el día
st, d = crear("11:00", fecha="2026-11-08")
prueba("domingo cerrado rechazado (409)",
       st == 409 and d.get("alternativas") == [],
       f"st={st} err={d.get('error', '')[:60]}")

# 7 · limpieza: las citas de prueba quedan canceladas, no borradas
ok_limpieza = bool(creadas)
for cid in creadas:
    st, d = req("POST", f"{API}/citas/{cid}/cancelar", {})
    ok_limpieza = ok_limpieza and st == 200 and (d.get("cita") or {}).get("estado") == "cancelada"
prueba("limpieza: citas de prueba canceladas", ok_limpieza,
       f"ids={creadas}")

print()
fallos = [r for r in res if not r[1]]
print(f"RESUMEN: {len(res) - len(fallos)}/{len(res)} pruebas en verde")
