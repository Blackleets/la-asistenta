#!/usr/bin/env python3
"""Mide N análisis seguidos por el flujo asíncrono (POST 202 + sondeo)
contra la web local de la máquina y anota latencia del servidor y de pared."""
import base64, json, sys, time, urllib.request, urllib.error

WEB = "http://127.0.0.1:8090"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2

def req(metodo, url, cuerpo=None, timeout=60):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(url, data=datos, method=metodo)
    if datos:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

with open("/data/la-asistenta/web/ejemplo.jpg", "rb") as f:
    uri = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
PREFS = {"naturalidad": "natural con algo de definición", "grosor": "medio",
         "arco": "suave", "tono": "mi tono natural",
         "intensidad": "que se note pero natural"}

for i in range(1, N + 1):
    t0 = time.time()
    st, d = req("POST", WEB + "/api/analizar", {"imagen": uri, "preferencias": PREFS})
    tid = d.get("id")
    if st != 202 or not tid:
        print(f"#{i} CREACION FALLO st={st} resp={d}")
        continue
    t_crea = time.time() - t0
    estado, d = "en_curso", {}
    while estado == "en_curso" and time.time() - t0 < 300:
        time.sleep(3)
        _, d = req("GET", f"{WEB}/api/analizar/{tid}", timeout=30)
        estado = d.get("estado", "?")
    pared = time.time() - t0
    a = d.get("analisis") or {}
    print(f"#{i} estado={estado} latencia_servidor_s={d.get('latencia_s')} "
          f"pared_s={pared:.1f} creacion_s={t_crea:.2f} "
          f"recomienda={a.get('servicio_recomendado')} error={d.get('error', '')}")
