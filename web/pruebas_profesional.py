#!/usr/bin/env python3
"""Batería HTTP del ÁREA PROFESIONAL (MUSA · B3, 29/10/2026).

Nace porque el panel de la dueña no tenía batería propia: QA13 era de
clics y la §14 de pruebas_web.py cubre acceso y una acción, pero el
contrato completo de /api/profesional/* (las seis lecturas, las tres
familias de acciones y su efecto verificado) no estaba fijado en
ninguna parte. Esta batería lo fija contra el servicio real en
127.0.0.1:8090, igual que pruebas_web.py hace con la app de la clienta.

Dos pisos de pruebas:
  · RED (debe estar verde ANTES y DESPUÉS de cualquier cambio del
    panel): sin sesión no se revela nada (401 en las seis lecturas),
    clave falsa rechazada, acceso correcto crea sesión, las vistas
    responden con su forma, y las acciones reales sobre citas de
    prueba tienen el efecto que prometen (cumplida → agradecimiento
    en la bandeja → descartado; cancelar → cancelada; estado
    inventado → 400; salir → la sesión muere).
  · B3 (el arreglo de D2): el resumen de Hoy trae «por_atender» (el
    titular ya no cuenta canceladas), las canceladas van AL FINAL de
    la lista de Hoy y de cada día de la Agenda (nunca antes que una
    viva), el embudo declara su periodo (desde dentro de los últimos
    30 días) y el HTML servido trae un título propio por vista.

La clave del negocio vive SOLO en el servidor (profesional.env): se
lee del entorno o del fichero, jamás se imprime. El token de la
agenda, igual que en pruebas_web.py: solo del entorno o de
agenda/agenda.env. Las citas de prueba se crean en huecos reales y
quedan en estados terminales (cumplida/cancelada): nunca se borran.
"""
import json, os, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timedelta

WEB = "http://127.0.0.1:8090"
AGENDA = "http://127.0.0.1:8081"


def _token():
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
    raise SystemExit("Sin AGENDA_API_TOKEN: la batería no puede crear "
                     "las citas de prueba en la agenda.")


def _clave_pro():
    v = (os.environ.get("PROFESIONAL_CLAVE") or "").strip()
    if v:
        return v
    ruta = os.environ.get("PROFESIONAL_ENV_FILE",
                          "/data/la-asistenta/web/profesional.env")
    try:
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                if linea.startswith("PROFESIONAL_CLAVE="):
                    return linea.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


TOK = {"X-API-Token": _token()}
res = []


def req(metodo, url, cuerpo=None, headers=None, timeout=60):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(url, data=datos, method=metodo)
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    if datos:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            cuerpo_txt = resp.read().decode()
            try:
                return resp.status, json.loads(cuerpo_txt)
            except Exception:
                return resp.status, {"_texto": cuerpo_txt}
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def prueba(nombre, ok, detalle=""):
    res.append((nombre, ok, detalle))
    print(("OK  " if ok else "FALLO") + " | " + nombre +
          (" | " + detalle if detalle else ""))


try:
    from zoneinfo import ZoneInfo
    HOY = datetime.now(ZoneInfo("Europe/Madrid")).date()
except Exception:
    HOY = datetime.now().date()
HOY_ISO = HOY.isoformat()

CLAVE = _clave_pro()
if not CLAVE:
    print("OMITIDA | área profesional: sin clave disponible en este entorno")
    raise SystemExit(0)

# ---------- RED · acceso ----------
LECTURAS = ["/api/profesional/hoy", "/api/profesional/agenda?dias=7",
            "/api/profesional/espera", "/api/profesional/bandeja",
            "/api/profesional/embudo", "/api/profesional/servicios"]
sin_sesion = [req("GET", WEB + r)[0] for r in LECTURAS]
prueba("red: sin sesión, las 6 lecturas devuelven 401",
       all(s == 401 for s in sin_sesion), f"st={sin_sesion}")

st, d = req("POST", WEB + "/api/profesional/acceso",
            {"clave": "clave-inventada-de-prueba-b3"})
prueba("red: clave falsa rechazada (401)", st == 401, f"st={st}")

st, d = req("POST", WEB + "/api/profesional/acceso", {"clave": CLAVE})
SESION = d.get("sesion") or ""
prueba("red: acceso con la clave del negocio crea sesión",
       st == 200 and len(SESION) >= 20, f"st={st}")
PRO = {"X-Sesion-Pro": SESION}

# ---------- RED · las vistas responden ----------
st, hoy = req("GET", WEB + "/api/profesional/hoy", None, PRO)
prueba("red: /hoy responde con fecha de hoy, citas, resumen y bandeja",
       st == 200 and hoy.get("fecha") == HOY_ISO
       and isinstance(hoy.get("citas"), list)
       and isinstance(hoy.get("resumen"), dict)
       and isinstance(hoy.get("bandeja"), list),
       f"st={st} fecha={hoy.get('fecha')}")
citas_hoy = hoy.get("citas", [])

st, agenda = req("GET", WEB + "/api/profesional/agenda?dias=7", None, PRO)
dias = agenda.get("dias", [])
prueba("red: /agenda responde 7 días con citas y huecos libres",
       st == 200 and len(dias) == 7
       and all("citas" in x and "libres" in x for x in dias), f"st={st}")

st, espera = req("GET", WEB + "/api/profesional/espera", None, PRO)
prueba("red: /espera responde con su lista",
       st == 200 and isinstance(espera.get("lista_espera"), list), f"st={st}")

st, bandeja = req("GET", WEB + "/api/profesional/bandeja", None, PRO)
prueba("red: /bandeja responde con los pendientes",
       st == 200 and isinstance(bandeja.get("bandeja"), list), f"st={st}")

st, embudo = req("GET", WEB + "/api/profesional/embudo", None, PRO)
prueba("red: /embudo responde con conteos por tipo",
       st == 200 and isinstance(embudo.get("por_tipo"), dict), f"st={st}")

st, servicios = req("GET", WEB + "/api/profesional/servicios", None, PRO)
prueba("red: /servicios responde la carta real (4 servicios)",
       st == 200 and len(servicios.get("servicios", [])) == 4, f"st={st}")


# ---------- utilidades de citas de prueba ----------
def huecos(fecha):
    sth, dh = req("GET", WEB + "/api/disponibilidad?servicio=" +
                  urllib.parse.quote("Diseño de cejas") + "&fecha=" + fecha)
    return dh.get("huecos", []) if sth == 200 else []


def buscar_huecos(n=2):
    """n huecos reales (fecha, hora) distintos, hoy primero (último del
    día, como el histórico 19:30) y luego días siguientes."""
    encontrados = []
    for delta in range(0, 8):
        f = (HOY + timedelta(days=delta)).isoformat()
        hs = huecos(f)
        if delta == 0 and hs:
            encontrados.append((f, hs[-1]))
            hs = hs[:-1]
        for h in hs:
            encontrados.append((f, h))
        if len(encontrados) >= n:
            return encontrados[:n]
    return encontrados


def crear_cita(nombre, fecha, hora):
    stc, dc = req("POST", AGENDA + "/citas", {
        "nombre": nombre, "servicio": "Diseño de cejas",
        "fecha": fecha, "hora": hora, "origen": "web"}, TOK)
    return stc, dc.get("cita") or {}


def fila_en_area(cid):
    """La cita vista por el área (Hoy si es de hoy; si no, la Agenda)."""
    stl, dl = req("GET", WEB + "/api/profesional/hoy", None, PRO)
    for c in dl.get("citas", []):
        if c.get("id") == cid:
            return stl, c
    stl, dl = req("GET", WEB + "/api/profesional/agenda?dias=7", None, PRO)
    for dia in dl.get("dias", []):
        for c in dia.get("citas", []):
            if c.get("id") == cid:
                return stl, c
    return stl, {}


huecos_disp = buscar_huecos(2)
prueba("red: hay huecos reales para las citas de prueba",
       len(huecos_disp) >= 2, f"huecos={huecos_disp}")

# ---------- RED · acción cumplida con su efecto (y su bandeja) ----------
cita_a = {}
if huecos_disp:
    fa, ha = huecos_disp[0]
    st, cita_a = crear_cita("PRUEBA PROFESIONAL B3", fa, ha)
    prueba("red: cita de prueba A creada en hueco real",
           st == 201 and bool(cita_a.get("id")), f"st={st}")
if cita_a.get("id"):
    st, fila = fila_en_area(cita_a["id"])
    prueba("red: la cita A se ve en el área con su código AS-XXXX",
           st == 200 and bool(fila)
           and (fila.get("codigo") or "").startswith("AS-"), f"st={st}")
    st, d = req("POST", WEB + f"/api/profesional/citas/{cita_a['id']}/estado",
                {"estado": "no_viene"}, PRO)
    prueba("red: estado inventado rechazado (400)", st == 400, f"st={st}")
    st, d = req("POST", WEB + f"/api/profesional/citas/{cita_a['id']}/estado",
                {"estado": "cumplida"}, PRO)
    ok_cumplida = st == 200 and (d.get("cita") or {}).get("estado") == "cumplida"
    st, fila = fila_en_area(cita_a["id"])
    prueba("red: marcar «cumplida» desde el área tiene su efecto",
           ok_cumplida and fila.get("estado") == "cumplida", f"st={st}")
    # La cumplida deja su agradecimiento en la bandeja de pendientes…
    st, bd = req("GET", WEB + "/api/profesional/bandeja", None, PRO)
    item = next((m for m in bd.get("bandeja", [])
                 if m.get("codigo") == cita_a.get("codigo")), None)
    prueba("red: la cumplida deja su agradecimiento en la bandeja",
           st == 200 and item is not None, f"st={st}")
    if item:
        st, d = req("POST",
                    WEB + f"/api/profesional/bandeja/{item['id']}/estado",
                    {"estado": "descartada"}, PRO)
        st, bd = req("GET", WEB + "/api/profesional/bandeja", None, PRO)
        sigue = any(m.get("id") == item["id"] for m in bd.get("bandeja", []))
        prueba("red: descartar el mensaje desde el área lo retira",
               st == 200 and not sigue, f"st={st}")

# ---------- RED · acción cancelar con su efecto ----------
cita_b = {}
if len(huecos_disp) >= 2:
    fb, hb = huecos_disp[1]
    st, cita_b = crear_cita("PRUEBA PROFESIONAL B3", fb, hb)
    prueba("red: cita de prueba B creada en hueco real",
           st == 201 and bool(cita_b.get("id")), f"st={st}")
if cita_b.get("id"):
    st, d = req("POST", WEB + f"/api/profesional/citas/{cita_b['id']}/cancelar",
                {}, PRO)
    st2, fila = fila_en_area(cita_b["id"])
    prueba("red: cancelar desde el área tiene su efecto",
           st == 200 and fila.get("estado") == "cancelada",
           f"cancelar={st} estado={fila.get('estado')}")

# ---------- RED · salir mata la sesión ----------
st, d = req("POST", WEB + "/api/profesional/salir", {}, PRO)
st2, d2 = req("GET", WEB + "/api/profesional/hoy", None, PRO)
prueba("red: al salir, la sesión deja de valer (401)",
       st == 200 and st2 == 401, f"salir={st} después={st2}")

# ---------- B3 · el arreglo de D2 (falla sobre el código anterior) ----
st, d = req("POST", WEB + "/api/profesional/acceso", {"clave": CLAVE})
PRO = {"X-Sesion-Pro": d.get("sesion") or ""}

st, hoy = req("GET", WEB + "/api/profesional/hoy", None, PRO)
citas_hoy = hoy.get("citas", [])
resumen = hoy.get("resumen", {})
n_confirmadas = sum(1 for c in citas_hoy if c.get("estado") == "confirmada")
prueba("B3: el resumen de Hoy trae «por_atender» = confirmadas (sin canceladas)",
       resumen.get("por_atender") == n_confirmadas,
       f"por_atender={resumen.get('por_atender')} confirmadas={n_confirmadas}")
prueba("B3: el resumen conserva las canceladas como dato aparte",
       "cancelada" in resumen, f"resumen={sorted(resumen)}")


def canceladas_al_final(citas):
    visto_cancelada = False
    for c in citas:
        if c.get("estado") == "cancelada":
            visto_cancelada = True
        elif visto_cancelada:
            return False
    return True


prueba("B3: en Hoy ninguna cancelada va antes que una viva",
       canceladas_al_final(citas_hoy),
       f"citas={len(citas_hoy)}")

st, agenda = req("GET", WEB + "/api/profesional/agenda?dias=7", None, PRO)
dias = agenda.get("dias", [])
prueba("B3: en Agenda, por día, las canceladas van al final",
       all(canceladas_al_final(x.get("citas", [])) for x in dias),
       f"días={len(dias)}")

st, embudo = req("GET", WEB + "/api/profesional/embudo", None, PRO)
desde = embudo.get("desde")
dias_periodo = None
if desde:
    try:
        dias_periodo = (HOY - datetime.fromisoformat(desde).date()).days
    except Exception:
        dias_periodo = None
prueba("B3: el embudo declara su periodo (últimos 30 días)",
       dias_periodo is not None and 0 <= dias_periodo <= 30,
       f"desde={desde} días={dias_periodo}")

st, html = req("GET", WEB + "/profesional")
texto_html = html.get("_texto", "") if isinstance(html, dict) else ""
TITULOS = ["Hoy en tu salón", "Tu agenda de 7 días",
           "Por avisar a tus clientas", "Mi negocio · carta y cifras"]
faltan = [t for t in TITULOS if t not in texto_html]
prueba("B3: el panel servido trae un título propio por vista",
       st == 200 and not faltan, f"faltan={faltan}")

req("POST", WEB + "/api/profesional/salir", {}, PRO)

fallos = [r for r in res if not r[1]]
print(f"\n{len(res) - len(fallos)}/{len(res)} pruebas en verde")
if fallos:
    raise SystemExit(1)
