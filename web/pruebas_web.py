#!/usr/bin/env python3
"""Pruebas E2E de la web de la clienta contra el servicio en 127.0.0.1:8090.
La reserva de prueba se cancela al final (queda 'cancelada', no se borra)."""
import base64, json, urllib.request, urllib.error, urllib.parse

WEB = "http://127.0.0.1:8090"
AGENDA = "http://127.0.0.1:8081"
TOK = {"X-API-Token": "la-asistenta-dev"}
res = []

def req(metodo, url, cuerpo=None, headers=None, timeout=180):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(url, data=datos, method=metodo)
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    if datos:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}

def prueba(nombre, ok, detalle=""):
    res.append((nombre, ok, detalle))
    print(("OK  " if ok else "FALLO") + " | " + nombre + (" | " + detalle if detalle else ""))

# 1 · servicios
st, d = req("GET", WEB + "/api/servicios")
prueba("servicios = carta real (4)", st == 200 and len(d.get("servicios", [])) == 4, f"st={st}")

# 2 · disponibilidad jueves 29/10 (sin confirmadas ese día)
st, d = req("GET", WEB + "/api/disponibilidad?servicio=" +
            urllib.parse.quote("Diseño de cejas") + "&fecha=2026-10-29")
h = d.get("huecos", [])
prueba("disponibilidad 29/10: primer hueco 10:00 y último 19:30",
       st == 200 and h and h[0] == "10:00" and h[-1] == "19:30", f"{len(h)} huecos")

# 3 · domingo cerrado
st, d = req("GET", WEB + "/api/disponibilidad?servicio=" +
            urllib.parse.quote("Diseño de cejas") + "&fecha=2026-11-01")
prueba("domingo 01/11 cerrado", st == 200 and d.get("huecos") == [] and d.get("motivo") == "domingo cerrado")

# 4 · reserva real de prueba (viernes 30/10 10:00)
st, d = req("POST", WEB + "/api/reservar", {
    "nombre": "PRUEBA WEB E2E", "servicio": "Diseño de cejas",
    "fecha": "2026-10-30", "hora": "10:00", "telefono": "", "notas": ""})
cita = d.get("cita") or {}
prueba("reserva creada y verificada", st == 201 and d.get("verificada") is True
       and cita.get("estado") == "confirmada", f"id={cita.get('id')} st={st} err={d.get('error','')}")
cid = cita.get("id")

# 5 · el hueco reservado y el solapado desaparecen
st, d = req("GET", WEB + "/api/disponibilidad?servicio=" +
            urllib.parse.quote("Diseño de cejas") + "&fecha=2026-10-30")
h = d.get("huecos", [])
prueba("anti-solape: 10:00 y 10:15 fuera, 10:30 dentro",
       "10:00" not in h and "10:15" not in h and "10:30" in h)

# 6 · segunda reserva en el mismo hueco -> 409 con alternativas
st, d = req("POST", WEB + "/api/reservar", {
    "nombre": "PRUEBA SOLAPE", "servicio": "Diseño de cejas",
    "fecha": "2026-10-30", "hora": "10:00"})
prueba("doble reserva rechazada (409) con alternativas",
       st == 409 and len(d.get("alternativas", [])) > 0, f"st={st}")

# 7 · errores de validación
st, d = req("POST", WEB + "/api/reservar", {
    "nombre": "X", "servicio": "Diseño de cejas", "fecha": "2026-10-30", "hora": "11:00"})
prueba("nombre demasiado corto -> 400", st == 400)
st, d = req("POST", WEB + "/api/reservar", {
    "nombre": "Prueba Pasado", "servicio": "Diseño de cejas", "fecha": "2020-01-01", "hora": "11:00"})
prueba("fecha pasada -> 400", st == 400)
st, d = req("POST", WEB + "/api/analizar", {"imagen": "no-es-una-foto", "preferencias": {}})
prueba("foto inválida -> 400", st == 400)

# 8 · análisis REAL con Spark (foto de ejemplo autorizada)
with open("/data/la-asistenta/web/ejemplo.jpg", "rb") as f:
    uri = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
st, d = req("POST", WEB + "/api/analizar", {
    "imagen": uri,
    "preferencias": {"naturalidad": "natural con algo de definición", "grosor": "medio",
                     "arco": "suave", "tono": "mi tono natural",
                     "intensidad": "que se note pero natural"}})
a = d.get("analisis") or {}
prueba("análisis Spark real validado", st == 200 and
       a.get("servicio_recomendado") in ("Diseño de cejas", "Ombré Brows Henna",
                                         "Brow Lamination", "Depilación rápida"),
       f"recomienda={a.get('servicio_recomendado')} lat={d.get('latencia_s')}s err={d.get('error','')}")

# 9 · limpieza: cancelar la cita de prueba en la agenda real
if cid:
    st, d = req("POST", f"{AGENDA}/citas/{cid}/cancelar", {}, TOK)
    prueba("limpieza: cita de prueba cancelada",
           st == 200 and (d.get("cita") or {}).get("estado") == "cancelada")

print()
fallos = [r for r in res if not r[1]]
print(f"RESUMEN: {len(res) - len(fallos)}/{len(res)} pruebas en verde")
