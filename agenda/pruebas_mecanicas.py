#!/usr/bin/env python3
"""Batería de las mecánicas de producto (enlace mágico, código, lista de
espera, embudo, post-cita) contra los servicios en marcha de la máquina
(agenda 8081 + web 8090). Sin análisis de Spark: no gasta crédito.

Las citas de prueba quedan CANCELADAS al final (semántica del sistema:
no se borran) salvo la que se marca cumplida para probar la bandeja de
salida, que queda identificada como PRUEBA en el nombre.

  python3 pruebas_mecanicas.py
"""
import hashlib
import json
import urllib.request
import urllib.error

API = "http://127.0.0.1:8081"
WEB = "http://127.0.0.1:8090"
TOK = {"X-API-Token": "la-asistenta-dev"}
FECHA = "2026-11-12"  # jueves, sin citas previas
res = []
creadas = []


def req(metodo, base, ruta, cuerpo=None, headers=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(base + ruta, data=datos, method=metodo)
    for k, v in (headers or {}).items():
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


def api(m, ruta, cuerpo=None):
    return req(m, API, ruta, cuerpo, TOK)


# 1 · crear cita por la API: trae código AS-XXXX y enlace mágico
st, d = api("POST", "/citas", {
    "nombre": "PRUEBA MECANICAS", "servicio": "Diseño de cejas",
    "fecha": FECHA, "hora": "10:00", "telefono": "+34600123456",
    "origen": "web"})
cita = d.get("cita") or {}
enlace = cita.get("enlace") or ""
token = enlace.rsplit("/", 1)[-1] if enlace else ""
prueba("crear cita: 201 con código AS-XXXX y enlace /cita/<token>",
       st == 201 and str(cita.get("codigo", "")).startswith("AS-")
       and "/cita/" in enlace and len(token) >= 20,
       f"id={cita.get('id')} codigo={cita.get('codigo')}")
if cita.get("id"):
    creadas.append(cita["id"])
thash = hashlib.sha256(token.encode()).hexdigest() if token else ""

# 2 · el hash no sale nunca: la cita por la API no expone token_hash
st, d = api("GET", f"/citas?fecha={FECHA}")
sin_hash = all("token_hash" not in c for c in d.get("citas", []))
con_codigo = all(str(c.get("codigo", "")).startswith("AS-")
                 for c in d.get("citas", []))
prueba("GET /citas: sin token_hash y con código en todas", sin_hash and con_codigo)

# 3 · enlace mágico: ver la cita por su hash (campos públicos, sin teléfono)
st, d = api("GET", f"/enlace/{thash}")
pub = d.get("cita") or {}
prueba("enlace GET: cita pública correcta, sin teléfono ni notas",
       st == 200 and pub.get("id") == cita.get("id")
       and "telefono" not in pub and "notas" not in pub
       and pub.get("estado") == "confirmada")

# 4 · hash inventado -> 404
st, d = api("GET", "/enlace/" + "0" * 64)
prueba("enlace con hash inexistente -> 404", st == 404)

# 5 · huecos para reagendar excluyen a las demás pero no a sí misma
st, d = api("GET", f"/enlace/{thash}/huecos?fecha={FECHA}")
prueba("huecos del enlace: su propio 10:00 sigue ofrecido",
       st == 200 and "10:00" in d.get("huecos", []))

# 6 · mini-formulario de preparación ligado a la cita
st, d = api("POST", f"/enlace/{thash}/prep", {
    "tratamiento_reciente": "Sí: henna hace 2 semanas", "retinol": "No"})
prep = (d.get("cita") or {}).get("prep") or {}
prueba("prep: guardado y visible al consultar la cita",
       st == 200 and prep.get("retinol") == "No"
       and "henna" in (prep.get("tratamiento_reciente") or ""))
st, d = api("GET", f"/citas?fecha={FECHA}")
prep_api = next((c.get("prep") for c in d.get("citas", [])
                 if c.get("id") == cita.get("id")), None)
prueba("prep: también visible por GET /citas (panel/API)",
       bool(prep_api) and prep_api.get("retinol") == "No")

# 7 · reagendar conserva id y código, y anota el cambio
st, d = api("POST", f"/enlace/{thash}/reagendar",
            {"fecha": FECHA, "hora": "11:00"})
mov = d.get("cita") or {}
prueba("reagendar: mismo id y código, nueva hora",
       st == 200 and mov.get("id") == cita.get("id")
       and mov.get("codigo") == cita.get("codigo")
       and mov.get("hora") == "11:00")

# 8 · reagendar sobre hueco ocupado -> 409 con alternativas
st, d2 = api("POST", "/citas", {
    "nombre": "PRUEBA MECANICAS 2", "servicio": "Diseño de cejas",
    "fecha": FECHA, "hora": "12:00", "telefono": "+34600123456",
    "origen": "web"})
cita2 = d2.get("cita") or {}
if cita2.get("id"):
    creadas.append(cita2["id"])
st, d = api("POST", f"/enlace/{thash}/reagendar",
            {"fecha": FECHA, "hora": "12:00"})
prueba("reagendar a hueco ocupado -> 409 con alternativas",
       st == 409 and len(d.get("alternativas", [])) > 0)

# 9 · lista de espera: alta -> cancelar cita compatible -> por_avisar
st, d = api("POST", "/lista-espera", {
    "nombre": "PRUEBA ESPERA", "telefono": "+34600999888",
    "servicio": "Diseño de cejas", "fecha_pref": FECHA, "origen": "web"})
entrada = d.get("entrada") or {}
prueba("lista de espera: alta en «esperando»",
       st == 201 and entrada.get("estado") == "esperando")
st, d = api("POST", f"/citas/{cita['id']}/cancelar", {})
prueba("cancelar la cita de las 11:00 (la reagendada)",
       st == 200 and (d.get("cita") or {}).get("estado") == "cancelada")
st, d = api("GET", "/lista-espera?estado=por_avisar")
marcada = any(e.get("id") == entrada.get("id") for e in d.get("lista_espera", []))
prueba("lista de espera: la entrada compatible pasa a «por_avisar»", marcada)

# 10 · estados post-cita: cumplida crea agradecimiento en la bandeja
st, d = api("POST", f"/citas/{cita2['id']}/estado", {"estado": "cumplida"})
prueba("marcar cumplida desde confirmada",
       st == 200 and (d.get("cita") or {}).get("estado") == "cumplida")
st, d = api("GET", "/bandeja?estado=pendiente")
mensajes = [b for b in d.get("bandeja", []) if b.get("cita_id") == cita2.get("id")]
prueba("bandeja: agradecimiento creado con enlace wa.me de un toque",
       bool(mensajes) and bool(mensajes[0].get("wa_link"))
       and mensajes[0]["wa_link"].startswith("https://wa.me/"))
sin_resena = bool(mensajes) and "reseña" not in mensajes[0]["texto"].lower()
prueba("bandeja: sin URL de reseñas configurada, el texto la omite (honesto)",
       sin_resena)
st, d = api("POST", f"/citas/{cita2['id']}/estado", {"estado": "no_show"})
prueba("cumplida no puede pasar a no_show -> 409", st == 409)
st, d = api("POST", f"/citas/{cita['id']}/estado", {"estado": "cumplida"})
prueba("cancelada no puede pasar a cumplida -> 409", st == 409)

# 11 · web pública: la página del enlace se sirve y la API de la cita responde
st_txt = None
try:
    with urllib.request.urlopen(WEB + "/cita/" + token, timeout=15) as resp:
        st_txt = resp.status
        html = resp.read().decode()
except Exception as e:
    html = ""
    st_txt = getattr(e, "code", None)
prueba("web: GET /cita/<token> sirve la página de la cita",
       st_txt == 200 and "Tu cita" in html)
st, d = req("GET", WEB, "/api/cita/" + token)
prueba("web: GET /api/cita/<token> devuelve la cita (ya cancelada)",
       st == 200 and (d.get("cita") or {}).get("estado") == "cancelada")

# 12 · embudo: los eventos de estas pruebas están contados
st, d = api("GET", "/embudo")
tipos = d.get("por_tipo") or {}
necesarios = ("reserva_confirmada", "cancelada", "reagendada",
              "lista_espera_alta", "cita_cumplida", "hueco_propuesto")
prueba("embudo: conteos por tipo y origen",
       st == 200 and all(tipos.get(t, 0) >= 1 for t in necesarios[:5])
       and d.get("por_origen", {}).get("web", 0) >= 5,
       f"por_tipo={tipos}")

# limpieza: cancelar la segunda cita si siguiera confirmada (quedó cumplida:
# no se toca; es el registro de prueba de la bandeja). La primera ya está
# cancelada. La entrada de lista de espera de prueba se marca descartada.
if entrada.get("id"):
    api("POST", f"/lista-espera/{entrada['id']}/estado",
        {"estado": "descartada"})

print()
fallos = [r for r in res if not r[1]]
print(f"RESUMEN: {len(res) - len(fallos)}/{len(res)} pruebas en verde")
