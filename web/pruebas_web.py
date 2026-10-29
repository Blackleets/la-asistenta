#!/usr/bin/env python3
"""Pruebas E2E de la web de la clienta contra el servicio en 127.0.0.1:8090.
El análisis es asíncrono: POST crea el trabajo (202) y se sondea su estado.
La reserva de prueba se cancela al final (queda 'cancelada', no se borra).

v4 (reconstrucción contra espec): las pruebas 1–9 son las de siempre, sin
tocar (el contrato de UN servicio no cambia). Se AÑADEN las 10–13 para el
pack: disponibilidad con {servicios} (duración sumada), reserva con
{servicios:[...]} en la web y en la API de agenda (una sola cita con el
precio y la duración sumados, componentes en las notas), guarda con la
duración total y rechazo de componentes fuera de la carta."""
import base64, json, os, time, urllib.request, urllib.error, urllib.parse

WEB = "http://127.0.0.1:8090"
AGENDA = "http://127.0.0.1:8081"


def _token():
    """Token de la agenda SOLO desde el entorno (D7/Fase 2): variable
    AGENDA_API_TOKEN o el fichero agenda/agenda.env de la máquina."""
    t = (os.environ.get("AGENDA_API_TOKEN") or "").strip()
    if t:
        return t
    aqui = os.path.dirname(os.path.abspath(__file__))
    for ruta in (os.environ.get("AGENDA_ENV_FILE") or "",
                 os.path.join(aqui, "..", "agenda", "agenda.env"),
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

# 8 · análisis REAL con Spark (foto de ejemplo autorizada) — flujo asíncrono:
# POST crea el trabajo (202 al instante) y se sondea hasta listo/error.
with open("/data/la-asistenta/web/ejemplo.jpg", "rb") as f:
    uri = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
st, d = req("POST", WEB + "/api/analizar", {
    "imagen": uri,
    "preferencias": {"naturalidad": "natural con algo de definición", "grosor": "medio",
                     "arco": "suave", "tono": "mi tono natural",
                     "intensidad": "que se note pero natural"}})
tid = d.get("id")
creado_ok = st == 202 and bool(tid)
d = {}
if tid:
    for _ in range(80):  # hasta ~4 min de sondeo
        time.sleep(3)
        st2, d = req("GET", f"{WEB}/api/analizar/{tid}", timeout=30)
        if d.get("estado") in ("listo", "error"):
            break
a = d.get("analisis") or {}
prueba("análisis Spark real validado (asíncrono)", creado_ok and d.get("estado") == "listo" and
       a.get("servicio_recomendado") in ("Diseño de cejas", "Ombré Brows Henna",
                                         "Brow Lamination", "Depilación rápida"),
       f"recomienda={a.get('servicio_recomendado')} lat={d.get('latencia_s')}s err={d.get('error','')}")

# 9 · limpieza: cancelar la cita de prueba en la agenda real
if cid:
    st, d = req("POST", f"{AGENDA}/citas/{cid}/cancelar", {}, TOK)
    prueba("limpieza: cita de prueba cancelada",
           st == 200 and (d.get("cita") or {}).get("estado") == "cancelada")

# 10 · PACK (v4): disponibilidad con la duración SUMADA (25 + 65 = 90 min).
# Viernes 06/11/2026 sin citas previas: inicios 10:00 … 18:30 (35 huecos).
PACK = ["Diseño de cejas", "Brow Lamination"]
st, d = req("GET", WEB + "/api/disponibilidad?servicios=" +
            urllib.parse.quote(",".join(PACK), safe=",") + "&fecha=2026-11-06")
h = d.get("huecos", [])
prueba("pack: disponibilidad con duración total (90 min)",
       st == 200 and h and h[0] == "10:00" and h[-1] == "18:30" and len(h) == 35,
       f"{len(h)} huecos")

# 11 · PACK: reserva web de 2 servicios -> UNA cita con totales sumados
st, d = req("POST", WEB + "/api/reservar", {
    "nombre": "PRUEBA WEB PACK", "servicios": PACK,
    "fecha": "2026-11-06", "hora": "10:00", "telefono": "", "notas": ""})
pack = d.get("cita") or {}
prueba("pack: una sola cita, 90 min y 63 €, nombre legible «A + B»",
       st == 201 and d.get("verificada") is True
       and pack.get("duracion_min") == 90 and pack.get("precio_eur") == 63
       and pack.get("servicio") == "Diseño de cejas + Brow Lamination"
       and pack.get("precio_etiqueta") == "63 €",
       f"id={pack.get('id')} st={st} err={d.get('error','')}")
pid_ = pack.get("id")

# 12 · PACK: la guarda usa la duración total: el pack ocupa [10:00, 11:30),
# así que un servicio suelto a las 10:30 ya no cabe (409) y 11:30 sí.
st, d = req("GET", WEB + "/api/disponibilidad?servicio=" +
            urllib.parse.quote("Diseño de cejas") + "&fecha=2026-11-06")
h = d.get("huecos", [])
prueba("pack: anti-solape con duración total (10:30 fuera, 11:30 dentro)",
       "10:30" not in h and "11:30" in h)
st, d = req("POST", WEB + "/api/reservar", {
    "nombre": "PRUEBA PACK SOLAPE", "servicio": "Diseño de cejas",
    "fecha": "2026-11-06", "hora": "10:30"})
prueba("pack: reserva suelta dentro del pack rechazada (409)",
       st == 409, f"st={st}")
st, d = req("GET", f"{AGENDA}/citas?fecha=2026-11-06", None, TOK)
fila_pack = next((c for c in d.get("citas", []) if c.get("id") == pid_), {})
prueba("pack: componentes escritos en las notas de la cita",
       "Pack:" in (fila_pack.get("notas") or "")
       and "Brow Lamination (45 € · 65 min)" in (fila_pack.get("notas") or ""),
       f"notas={fila_pack.get('notas','')[:80]}")

# 13 · PACK en la API de agenda directamente (mismo contrato) + validación
st, d = req("POST", f"{AGENDA}/citas", {
    "nombre": "PRUEBA API PACK", "servicios": ["Ombré Brows Henna", "Diseño de cejas"],
    "fecha": "2026-11-06", "hora": "16:00", "origen": "web"}, TOK)
api_pack = d.get("cita") or {}
prueba("pack (API): 201 con 90 min y 48 € sumados",
       st == 201 and api_pack.get("duracion_min") == 90
       and api_pack.get("precio_eur") == 48,
       f"id={api_pack.get('id')} st={st}")
if api_pack.get("id"):
    req("POST", f"{AGENDA}/citas/{api_pack['id']}/cancelar", {}, TOK)
st, d = req("POST", f"{AGENDA}/citas", {
    "nombre": "PRUEBA API PACK MAL", "servicios": ["Diseño de cejas", "Inventado"],
    "fecha": "2026-11-06", "hora": "18:00", "origen": "web"}, TOK)
prueba("pack (API): componente fuera de la carta -> 400", st == 400, f"st={st}")

# limpieza del pack web: queda cancelada, no borrada
if pid_:
    st, d = req("POST", f"{AGENDA}/citas/{pid_}/cancelar", {}, TOK)
    prueba("pack: limpieza, cita del pack cancelada",
           st == 200 and (d.get("cita") or {}).get("estado") == "cancelada")

# 14 · ÁREA PROFESIONAL (29/10): acceso con la clave del negocio (vive
# SOLO en el servidor), sesión con caducidad y acciones reales sobre la
# agenda. La clave se lee de PROFESIONAL_CLAVE o del fichero del
# servidor (profesional.env); si no está disponible en este entorno,
# estas pruebas se OMITEN (nunca se inventa una clave de prueba).
import os as _os
from datetime import datetime as _dt


def _clave_pro():
    v = _os.environ.get("PROFESIONAL_CLAVE", "").strip()
    if v:
        return v
    ruta = _os.environ.get("PROFESIONAL_ENV_FILE",
                           "/data/la-asistenta/web/profesional.env")
    try:
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                if linea.startswith("PROFESIONAL_CLAVE="):
                    return linea.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None


CLAVE_PRO = _clave_pro()
if not CLAVE_PRO:
    print("OMITIDAS | área profesional: sin clave disponible en este entorno")
else:
    st, d = req("GET", WEB + "/api/profesional/hoy")
    prueba("profesional: sin sesión, /hoy no revela nada (401)",
           st == 401, f"st={st}")
    st, d = req("POST", WEB + "/api/profesional/acceso",
                {"clave": "clave-inventada-de-prueba"})
    prueba("profesional: clave falsa rechazada (401)", st == 401, f"st={st}")
    st, d = req("POST", WEB + "/api/profesional/acceso", {"clave": CLAVE_PRO})
    sesion_pro = d.get("sesion") or ""
    prueba("profesional: acceso con la clave del negocio crea sesión",
           st == 200 and len(sesion_pro) >= 20, f"st={st}")
    PRO = {"X-Sesion-Pro": sesion_pro}
    try:
        from zoneinfo import ZoneInfo as _ZI
        hoy_pro = _dt.now(_ZI("Europe/Madrid")).date().isoformat()
    except Exception:
        hoy_pro = _dt.now().date().isoformat()
    st, d = req("POST", f"{AGENDA}/citas", {
        "nombre": "PRUEBA PROFESIONAL", "servicio": "Diseño de cejas",
        "fecha": hoy_pro, "hora": "19:30", "origen": "web"}, TOK)
    cita_pro = d.get("cita") or {}
    prueba("profesional: cita de prueba creada para hoy",
           st == 201 and bool(cita_pro.get("id")), f"st={st}")
    st, d = req("GET", WEB + "/api/profesional/hoy", None, PRO)
    fila_pro = next((c for c in d.get("citas", [])
                     if c.get("id") == cita_pro.get("id")), {})
    prueba("profesional: /hoy trae la cita de prueba con su código AS-XXXX",
           st == 200 and bool(fila_pro)
           and (fila_pro.get("codigo") or "").startswith("AS-"), f"st={st}")
    st, d = req("POST", WEB + f"/api/profesional/citas/{cita_pro.get('id')}/estado",
                {"estado": "no_viene"}, PRO)
    prueba("profesional: estado inventado rechazado (400)",
           st == 400, f"st={st}")
    st, d = req("POST", WEB + f"/api/profesional/citas/{cita_pro.get('id')}/estado",
                {"estado": "no_show"}, PRO)
    prueba("profesional: marcar «no_show» desde el área funciona",
           st == 200 and (d.get("cita") or {}).get("estado") == "no_show",
           f"st={st}")
    st, d = req("POST", WEB + f"/api/profesional/citas/{cita_pro.get('id')}/cancelar",
                {}, PRO)
    prueba("profesional: limpieza, la cita de prueba queda cancelada",
           st == 200 and (d.get("cita") or {}).get("estado") == "cancelada",
           f"st={st}")
    st, d = req("GET", WEB + "/api/profesional/espera", None, PRO)
    prueba("profesional: lista de espera accesible con sesión",
           st == 200 and "lista_espera" in d, f"st={st}")
    st, d = req("GET", WEB + "/api/profesional/embudo", None, PRO)
    prueba("profesional: embudo accesible con sesión",
           st == 200 and "por_tipo" in d, f"st={st}")
    st, d = req("GET", WEB + "/api/profesional/servicios", None, PRO)
    prueba("profesional: carta de solo lectura (4 servicios)",
           st == 200 and len(d.get("servicios", [])) == 4, f"st={st}")
    st, d = req("GET", WEB + "/api/profesional/agenda?dias=7", None, PRO)
    prueba("profesional: agenda de 7 días con huecos reales",
           st == 200 and len(d.get("dias", [])) == 7, f"st={st}")
    st, d = req("POST", WEB + "/api/profesional/salir", {}, PRO)
    st2, d2 = req("GET", WEB + "/api/profesional/hoy", None, PRO)
    prueba("profesional: al salir, la sesión deja de valer (401)",
           st == 200 and st2 == 401, f"salir={st} después={st2}")

print()
fallos = [r for r in res if not r[1]]
print(f"RESUMEN: {len(res) - len(fallos)}/{len(res)} pruebas en verde")
