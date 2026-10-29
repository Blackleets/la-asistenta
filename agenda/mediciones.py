#!/usr/bin/env python3
"""Mediciones de la Fase 2 (prioridad 6 de la Orden Maestra): latencia
y concurrencia REALES contra los servicios en marcha de la máquina.

Mide, con N acotado para no molestar:
  - GET /salud de la API de agenda (8081) y de la web (8090).
  - GET /api/disponibilidad de la web (huecos reales de un jueves).
  - POST /citas directo a la API: crear y cancelar (las citas de la
    medición quedan CANCELADAS, la semántica de siempre; no se borran).
  - Ráfaga concurrente: 20 GET de disponibilidad a la vez y 5 POST al
    mismo hueco a la vez (esperado: un 201 y cuatro 409; la ganadora
    se cancela al final).

Salida: tabla legible + JSON (para MEDICIONES.md). Sin Spark: no gasta
crédito de IA.

  python3 mediciones.py [--json ruta-salida.json]
"""
import json
import os
import statistics
import sys
import threading
import time
import urllib.request
import urllib.error
import urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
API = os.environ.get("AGENDA_API_URL", "http://127.0.0.1:8081").rstrip("/")
WEB = os.environ.get("WEB_URL", "http://127.0.0.1:8090").rstrip("/")
FECHA_MEDIDA = "2026-12-10"  # jueves futuro, ventana 10:00–20:00
SERVICIO = "Diseño de cejas"  # 25 min


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


TOKEN = _token()


def pedir(metodo, url, cuerpo=None, cabeceras=None, timeout=30):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(url, data=datos, method=metodo)
    for k, v in (cabeceras or {}).items():
        r.add_header(k, v)
    if datos:
        r.add_header("Content-Type", "application/json")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            resp.read()
            st = resp.status
    except urllib.error.HTTPError as e:
        e.read()
        st = e.code
    return st, (time.perf_counter() - t0) * 1000.0


def serie(nombre, n, fn):
    tiempos, codigos = [], []
    for _ in range(n):
        st, ms = fn()
        codigos.append(st)
        tiempos.append(ms)
    return resumen(nombre, tiempos, codigos)


def resumen(nombre, tiempos, codigos):
    ordenados = sorted(tiempos)
    def pct(p):
        return ordenados[min(len(ordenados) - 1,
                             int(round(p / 100.0 * (len(ordenados) - 1))))]
    return {
        "nombre": nombre, "n": len(tiempos),
        "p50_ms": round(statistics.median(tiempos), 1),
        "p95_ms": round(pct(95), 1),
        "max_ms": round(max(tiempos), 1),
        "codigos": {str(c): codigos.count(c) for c in sorted(set(codigos))},
    }


def en_paralelo(n, fn):
    barrera = threading.Barrier(n)
    salidas = [None] * n

    def uno(i):
        barrera.wait(timeout=15)
        salidas[i] = fn()
    hilos = [threading.Thread(target=uno, args=(i,)) for i in range(n)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=60)
    return salidas


def main():
    tok = {"X-API-Token": TOKEN}
    resultados = []

    resultados.append(serie("GET /salud (API agenda)", 50,
                            lambda: pedir("GET", API + "/salud", cabeceras=tok)))
    resultados.append(serie("GET /salud (web)", 50,
                            lambda: pedir("GET", WEB + "/salud")))
    disp = (WEB + "/api/disponibilidad?servicio="
            + urllib.parse.quote(SERVICIO) + f"&fecha={FECHA_MEDIDA}")
    resultados.append(serie("GET /api/disponibilidad (web)", 30,
                            lambda: pedir("GET", disp)))

    # Creación real: 12 huecos distintos y libres (cada 30 min desde
    # las 10:00; el servicio dura 25, así que no se pisan). Cada cita
    # se cancela justo después de medir su creación.
    creadas = []
    tiempos_crear = []
    for i in range(12):
        minutos = 600 + 30 * i
        hora = f"{minutos // 60:02d}:{minutos % 60:02d}"
        st, ms = pedir("POST", API + "/citas", {
            "nombre": "PRUEBA MEDICION", "servicio": SERVICIO,
            "fecha": FECHA_MEDIDA, "hora": hora, "origen": "app"},
            cabeceras=tok)
        tiempos_crear.append(ms)
        if st != 201:
            print(f"AVISO: crear a las {hora} devolvió {st} (¿hueco ocupado?)")
    # Recuperar los ids creados para cancelarlos:
    import urllib.request as _u
    r = _u.Request(API + f"/citas?fecha={FECHA_MEDIDA}", headers=tok)
    with _u.urlopen(r, timeout=15) as resp:
        citas = json.loads(resp.read().decode()).get("citas", [])
    creadas = [c["id"] for c in citas
               if c["nombre"] == "PRUEBA MEDICION" and c["estado"] == "confirmada"]
    canceladas = 0
    for cid in creadas:
        st, _ = pedir("POST", API + f"/citas/{cid}/cancelar", {}, cabeceras=tok)
        if st == 200:
            canceladas += 1
    r_crear = resumen("POST /citas (crear, API)", tiempos_crear, [201] * len(tiempos_crear))
    r_crear["canceladas_al_final"] = f"{canceladas}/{len(creadas)}"
    resultados.append(r_crear)

    # Ráfaga: 20 disponibilidades a la vez.
    salidas = en_paralelo(20, lambda: pedir("GET", disp))
    resultados.append(resumen("Ráfaga 20× GET disponibilidad",
                              [ms for _, ms in salidas],
                              [st for st, _ in salidas]))
    # Ráfaga: 5 creaciones al MISMO hueco (19:00, libre tras lo anterior).
    def crear_mismo():
        return pedir("POST", API + "/citas", {
            "nombre": "PRUEBA MEDICION CONC", "servicio": SERVICIO,
            "fecha": FECHA_MEDIDA, "hora": "19:00", "origen": "app"},
            cabeceras=tok)
    salidas = en_paralelo(5, crear_mismo)
    r_conc = resumen("Ráfaga 5× POST mismo hueco",
                     [ms for _, ms in salidas], [st for st, _ in salidas])
    resultados.append(r_conc)
    # Cancelar la ganadora de la ráfaga:
    r = _u.Request(API + f"/citas?fecha={FECHA_MEDIDA}", headers=tok)
    with _u.urlopen(r, timeout=15) as resp:
        citas = json.loads(resp.read().decode()).get("citas", [])
    for c in citas:
        if c["nombre"] == "PRUEBA MEDICION CONC" and c["estado"] == "confirmada":
            pedir("POST", API + f"/citas/{c['id']}/cancelar", {}, cabeceras=tok)

    print(f"{'medición':<38} {'n':>3} {'p50':>8} {'p95':>8} {'máx':>8}  códigos")
    for r in resultados:
        print(f"{r['nombre']:<38} {r['n']:>3} {r['p50_ms']:>7.1f} "
              f"{r['p95_ms']:>7.1f} {r['max_ms']:>7.1f}  {r['codigos']}"
              + (f"  canceladas={r['canceladas_al_final']}"
                 if "canceladas_al_final" in r else ""))
    if "--json" in sys.argv:
        ruta = sys.argv[sys.argv.index("--json") + 1]
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(resultados, f, ensure_ascii=False, indent=1)
        print("JSON en", ruta)


if __name__ == "__main__":
    main()
