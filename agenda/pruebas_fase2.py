#!/usr/bin/env python3
"""Batería de la Fase 2 (Orden Maestra): multinegocio, doble reserva
transaccional e idempotencia — contra una INSTANCIA DE PRUEBA de la API
de agenda, nunca contra la de producción.

La instancia de prueba se levanta en un puerto efímero (8091) con una
COPIA de la BD real y DOS negocios configurados (el piloto y
«negocio-prueba-fase2») vía AGENDA_NEGOCIOS. Al terminar se apaga y la
copia se borra: la agenda de producción no recibe ni una escritura.

Prueba:
  1. Aislamiento de citas: lo de un negocio no se ve ni se toca desde
     el otro (ni siquiera se solapan entre negocios distintos).
  2. Aislamiento de lista de espera, embudo y bandeja.
  3. Negocio no configurado → 404.
  4. Idempotencia: misma clave + mismo cuerpo → misma cita (200,
     idempotente); misma clave + cuerpo distinto → 422; sin clave, el
     mismo hueco dos veces → 201 y 409 (la guarda sigue mandando).
  5. Concurrencia: 2 (y luego 5) POST simultáneos al mismo hueco de un
     negocio → exactamente un 201 y el resto 409 con alternativas.

  python3 pruebas_fase2.py
"""
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import urllib.error

AQUI = os.path.dirname(os.path.abspath(__file__))
PUERTO = int(os.environ.get("AGENDA_PRUEBAS_PORT", "8091"))
API = f"http://127.0.0.1:{PUERTO}"
PILOTO = "ari-vivas-beauty"
OTRO = "negocio-prueba-fase2"
FECHA = "2026-12-03"   # jueves, sin citas previas en la copia
FECHA2 = "2026-12-04"  # viernes
res = []


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


def req(metodo, ruta, cuerpo=None, negocio=None, clave_idem=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    r = urllib.request.Request(API + ruta, data=datos, method=metodo)
    r.add_header("X-API-Token", TOKEN)
    if negocio:
        r.add_header("X-Negocio-Id", negocio)
    if clave_idem:
        r.add_header("Idempotency-Key", clave_idem)
    if datos:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def prueba(nombre, ok, detalle=""):
    res.append((nombre, ok))
    print(("OK   " if ok else "FALLO") + " | " + nombre +
          (" | " + detalle if detalle else ""))


def crear(nombre, hora, negocio=None, fecha=FECHA, clave_idem=None,
          servicio="Diseño de cejas"):
    return req("POST", "/citas", {
        "nombre": nombre, "servicio": servicio, "fecha": fecha, "hora": hora,
        "origen": "app"}, negocio=negocio, clave_idem=clave_idem)


def en_paralelo(n, fn):
    """Ejecuta fn(i) en n hilos soltados a la vez; devuelve los resultados."""
    barrera = threading.Barrier(n)
    salidas = [None] * n

    def uno(i):
        barrera.wait(timeout=15)
        salidas[i] = fn(i)
    hilos = [threading.Thread(target=uno, args=(i,)) for i in range(n)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=60)
    return salidas


def main():
    origen_db = os.environ.get("AGENDA_DB") or os.path.join(AQUI, "agenda.db")
    tmp = tempfile.mkdtemp(prefix="fase2-")
    db_copia = os.path.join(tmp, "agenda-pruebas.db")
    shutil.copyfile(origen_db, db_copia)
    env = dict(os.environ)
    env.update({
        "AGENDA_DB": db_copia,
        "AGENDA_API_TOKEN": TOKEN,
        "AGENDA_NEGOCIOS": f"{PILOTO},{OTRO}",
        "AGENDA_API_HOST": "127.0.0.1",
    })
    proc = subprocess.Popen(
        [sys.executable, os.path.join(AQUI, "agenda_api.py"),
         "--port", str(PUERTO), "--host", "127.0.0.1"],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        # Esperar a que la instancia de prueba responda.
        limite = time.time() + 30
        while True:
            try:
                with urllib.request.urlopen(API + "/salud", timeout=2) as r:
                    if r.status == 200:
                        break
            except Exception:
                if time.time() > limite:
                    raise SystemExit("la instancia de prueba no arrancó")
                time.sleep(0.25)

        # ---------- 3 · negocio no configurado ----------
        st, _ = req("GET", f"/citas?fecha={FECHA}", negocio="no-existe")
        prueba("negocio no configurado → 404", st == 404, f"st={st}")

        # ---------- 1 · aislamiento de citas ----------
        _, base = req("GET", f"/citas?fecha={FECHA}")  # piloto (por defecto)
        n_piloto_antes = len(base.get("citas", []))
        st, d = crear("PRUEBA FASE2 OTRO", "10:00", negocio=OTRO)
        cita_otro = (d.get("cita") or {}).get("id")
        prueba("crear cita en el negocio de prueba", st == 201 and bool(cita_otro),
               f"st={st} id={cita_otro}")
        _, d = req("GET", f"/citas?fecha={FECHA}")
        ids_piloto = [c["id"] for c in d.get("citas", [])]
        prueba("el piloto NO ve la cita del otro negocio",
               cita_otro not in ids_piloto and len(ids_piloto) == n_piloto_antes)
        _, d = req("GET", f"/citas?fecha={FECHA}", negocio=OTRO)
        prueba("el otro negocio SÍ ve su cita",
               [c["id"] for c in d.get("citas", [])] == [cita_otro])
        # El mismo hueco en el piloto NO choca con el del otro negocio:
        st, d = crear("PRUEBA FASE2 PILOTO", "10:00")  # mismo día y hora
        cita_piloto = (d.get("cita") or {}).get("id")
        prueba("mismo hueco en otro negocio NO es conflicto (201)",
               st == 201 and bool(cita_piloto), f"st={st}")
        # Tocar la cita ajena desde el piloto → 404:
        st, _ = req("POST", f"/citas/{cita_otro}/cancelar", {})
        prueba("cancelar la cita ajena desde el piloto → 404", st == 404,
               f"st={st}")
        st, d = req("POST", f"/citas/{cita_otro}/cancelar", {}, negocio=OTRO)
        prueba("cancelarla desde SU negocio → 200",
               st == 200 and d.get("cita", {}).get("estado") == "cancelada")

        # ---------- 2 · aislamiento de espera / embudo / bandeja ----
        st, d = req("POST", "/lista-espera", {
            "nombre": "PRUEBA FASE2 ESPERA", "servicio": "Brow Lamination",
            "fecha_pref": FECHA}, negocio=OTRO)
        entrada_otro = (d.get("entrada") or {}).get("id")
        prueba("alta en lista de espera del otro negocio", st == 201)
        _, d = req("GET", "/lista-espera")
        prueba("la espera del piloto no incluye la del otro",
               all(e["id"] != entrada_otro for e in d.get("lista_espera", [])))
        _, d = req("GET", "/lista-espera", negocio=OTRO)
        prueba("la espera del otro negocio sí la incluye",
               [e["id"] for e in d.get("lista_espera", [])] == [entrada_otro])
        # Cumplir la cita del piloto genera SU bandeja; la del otro, no.
        st, _ = req("POST", f"/citas/{cita_piloto}/estado", {"estado": "cumplida"})
        prueba("marcar cumplida la cita del piloto", st == 200, f"st={st}")
        _, d = req("GET", "/bandeja?estado=pendiente")
        prueba("la bandeja del piloto recoge SU agradecimiento",
               any(b["cita_id"] == cita_piloto for b in d.get("bandeja", [])))
        _, d = req("GET", "/bandeja?estado=pendiente", negocio=OTRO)
        prueba("la bandeja del otro negocio está vacía de eso",
               all(b["cita_id"] != cita_piloto for b in d.get("bandeja", [])))
        _, emb_p = req("GET", "/embudo")
        _, emb_o = req("GET", "/embudo", negocio=OTRO)
        prueba("embudo separado por negocio",
               emb_o.get("por_tipo", {}).get("lista_espera_alta", 0) >= 1
               and emb_o.get("por_tipo", {}).get("cita_cumplida", 0) == 0
               and emb_p.get("por_tipo", {}).get("cita_cumplida", 0) >= 1,
               f"otro={emb_o.get('por_tipo')}")

        # ---------- 4 · idempotencia ----------
        cuerpo = {"nombre": "PRUEBA FASE2 IDEM", "servicio": "Diseño de cejas",
                  "fecha": FECHA2, "hora": "10:00", "origen": "app"}
        st1, d1 = req("POST", "/citas", cuerpo, clave_idem="fase2-clave-1")
        st2, d2 = req("POST", "/citas", cuerpo, clave_idem="fase2-clave-1")
        id1 = (d1.get("cita") or {}).get("id")
        prueba("misma clave + mismo cuerpo → misma cita, sin duplicar",
               st1 == 201 and st2 == 200 and d2.get("idempotente") is True
               and (d2.get("cita") or {}).get("id") == id1,
               f"st1={st1} st2={st2} id={id1}")
        _, d = req("GET", f"/citas?fecha={FECHA2}")
        prueba("en la agenda hay UNA sola cita de esa petición",
               len([c for c in d.get("citas", [])
                    if c["nombre"] == "PRUEBA FASE2 IDEM"]) == 1)
        cuerpo_distinto = dict(cuerpo, hora="11:00")
        st3, _ = req("POST", "/citas", cuerpo_distinto, clave_idem="fase2-clave-1")
        prueba("misma clave + cuerpo distinto → 422", st3 == 422, f"st={st3}")
        st4, d4 = req("POST", "/citas", cuerpo)  # sin clave: manda la guarda
        prueba("sin clave, el mismo hueco otra vez → 409",
               st4 == 409 and bool(d4.get("alternativas") is not None), f"st={st4}")

        # ---------- 5 · concurrencia: un solo ganador ----------
        for n, hora in ((2, "12:00"), (5, "13:00")):
            salidas = en_paralelo(n, lambda i: crear(
                f"PRUEBA FASE2 CONC {i}", hora, fecha=FECHA2))
            codigos = sorted(s[0] for s in salidas)
            ganadores = [s for s in salidas if s[0] == 201]
            perdedores_ok = all(
                s[0] == 409 and isinstance(s[1].get("alternativas"), list)
                for s in salidas if s[0] != 201)
            prueba(f"{n} POST simultáneos al mismo hueco → un 201 y {n-1}×409 "
                   "con alternativas",
                   codigos == [201] + [409] * (n - 1) and perdedores_ok
                   and len(ganadores) == 1,
                   f"códigos={codigos}")
        _, d = req("GET", f"/citas?fecha={FECHA2}")
        confirmadas = [c for c in d.get("citas", [])
                       if c["estado"] == "confirmada"
                       and c["nombre"].startswith("PRUEBA FASE2 CONC")]
        prueba("tras la ráfaga, solo hay UNA confirmada por hueco disputado",
               len(confirmadas) == 2, f"confirmadas={len(confirmadas)}")

        # La copia debe llevar negocio_id en todo lo creado:
        conn = sqlite3.connect(db_copia)
        mal = conn.execute(
            "SELECT COUNT(*) FROM citas WHERE negocio_id IS NULL "
            "OR negocio_id = ''").fetchone()[0]
        conn.close()
        prueba("toda cita de la copia lleva su negocio_id", mal == 0)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        shutil.rmtree(tmp, ignore_errors=True)

    fallos = [n for n, ok in res if not ok]
    print(f"\nRESUMEN: {len(res) - len(fallos)}/{len(res)} pruebas en verde")
    if fallos:
        print("FALLOS:", *fallos, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    main()
