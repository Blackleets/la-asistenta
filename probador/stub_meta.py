#!/usr/bin/env python3
"""Stub LOCAL de api.meta.ai para probar el cableado de Meta SIN
clave y SIN gasto (prohibido llamar a la API real en esta fase).

Simula las formas documentadas en BENCHMARK_H1.md §1:
- `GET  /v1/models`    → lista con muse-spark-1.3, muse-image-1.0, sam-3.1
- `POST /v1/responses` → para `muse-image-1.0`, una salida Responses
  con la imagen (PNG 1×1 válido) en el resultado de la llamada de
  generación; para `sam-3.1`, un `output_text` con los tokens
  box/mask en el formato REAL confirmado el 30/10/2026 (§62).

El comportamiento se gobierna con la CLAVE que reciba (son claves de
mentira del propio stub, no credenciales de nadie):
- `stub-ok`             → todo correcto.
- `stub-401`            → 401 siempre (clave rechazada).
- `stub-429-una-vez`    → el primer POST devuelve 429 con
                          Retry-After: 1; los siguientes, OK.
- `stub-lenta-una-vez`  → el primer POST duerme DEMORA_S y luego OK
                          (para probar el reintento tras timeout).
- `stub-lenta-siempre`  → todos los POST duermen DEMORA_S.
Sin cabecera Authorization → 401, como la API real.

DEMORA_S sale de la variable STUB_DEMORA_S (defecto 2.5 s).

Uso en pruebas: importar y `crear_servidor()` (puerto efímero, hilo).
Uso suelto (p. ej. contra una instancia de prueba de la web):
  python3 stub_meta.py 18123
"""

from __future__ import annotations

import base64
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# PNG 1×1 válido (transparente): la «imagen generada» del stub.
PNG_1PX_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
DEMORA_S = float(os.environ.get("STUB_DEMORA_S", "2.5"))

MODELOS = [
    {"id": "muse-spark-1.3", "object": "model"},
    {"id": "muse-image-1.0", "object": "model"},
    {"id": "sam-3.1", "object": "model"},
]


class _Manejador(BaseHTTPRequestHandler):
    def log_message(self, *args):  # silencio: el stub no hace logs
        pass

    # -- utilidades --
    def _clave(self):
        auth = self.headers.get("Authorization") or ""
        return auth[7:].strip() if auth.startswith("Bearer ") else ""

    def _json(self, codigo, obj, cabeceras=None):
        datos = json.dumps(obj).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(datos)))
        for k, v in (cabeceras or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(datos)

    def _error(self, codigo, mensaje, cabeceras=None):
        self._json(codigo, {"error": {"message": mensaje, "code": codigo}},
                   cabeceras)

    def _registrar(self, ruta, modelo=None, cuerpo=None):
        entrada = {
            "metodo": self.command.split(" ")[0],
            "ruta": ruta,
            "modelo": modelo,
            "clave_stub": self._clave(),
        }
        if isinstance(cuerpo, dict):
            # Resumen del cuerpo para las aserciones de las pruebas:
            # textos enviados y si viaja una imagen como data URI.
            textos, tiene_imagen = [], False
            for item in cuerpo.get("input") or []:
                for parte in (item or {}).get("content") or []:
                    if parte.get("type") == "input_text":
                        textos.append(parte.get("text") or "")
                    if parte.get("type") == "input_image":
                        url = parte.get("image_url") or ""
                        tiene_imagen = url.startswith("data:image/")
            entrada["textos"] = textos
            entrada["tiene_imagen"] = tiene_imagen
        self.server.registro.append(entrada)

    def _puerta_clave(self):
        """Devuelve True si puede seguir; si no, ya respondió."""
        clave = self._clave()
        if not clave:
            self._error(401, "falta la cabecera Authorization")
            return False
        if clave == "stub-401":
            self._error(401, "invalid api key")
            return False
        return True

    # -- rutas --
    def do_GET(self):
        ruta = self.path.split("?")[0]
        if ruta == "/v1/models":
            if not self._puerta_clave():
                self._registrar(ruta)
                return
            self._registrar(ruta)
            return self._json(200, {"object": "list", "data": MODELOS})
        return self._error(404, "ruta no encontrada en el stub")

    def do_POST(self):
        ruta = self.path.split("?")[0]
        if ruta != "/v1/responses":
            return self._error(404, "ruta no encontrada en el stub")
        largo = int(self.headers.get("Content-Length") or 0)
        crudo = self.rfile.read(largo) if largo else b""
        try:
            cuerpo = json.loads(crudo.decode("utf-8")) if crudo else {}
        except Exception:
            return self._error(400, "JSON no válido")
        modelo = cuerpo.get("model")
        self._registrar(ruta, modelo, cuerpo)
        if not self._puerta_clave():
            return
        clave = self._clave()
        with self.server.lock:
            n = self.server.contadores.get(clave, 0) + 1
            self.server.contadores[clave] = n
        if clave == "stub-429-una-vez" and n == 1:
            return self._error(429, "rate limit", {"Retry-After": "1"})
        if clave == "stub-lenta-siempre" or (
                clave == "stub-lenta-una-vez" and n == 1):
            time.sleep(DEMORA_S)
        if modelo == "muse-image-1.0":
            return self._json(200, {
                "id": "resp_stub_imagen",
                "object": "response",
                "model": "muse-image-1.0",
                "output": [{
                    "type": "image_generation_call",
                    "id": "ig_stub",
                    "status": "completed",
                    "result": PNG_1PX_B64,
                }],
                "usage": {"stub": True},
            })
        if modelo == "sam-3.1":
            # Formato REAL confirmado el 30/10/2026 (§62): output_text
            # con tokens box/mask del protocolo oficial. La caja de
            # mentira (10,20)-(110,70) sobre una imagen 1200×1800 da
            # unas dims de máscara coherentes: 51×101.
            texto_sam = (
                "<0f>0"
                "<|box;x1=10;y1=20;x2=110;y2=70;w=1200;h=1800|>"
                "<|mask;x=0;y=0;data=51,101,datos-rle-de-mentira!!~|>"
            )
            return self._json(200, {
                "id": "resp_stub_sam",
                "object": "response",
                "model": "sam-3.1",
                "status": "completed",
                "output": [{
                    "type": "message",
                    "id": "msg_stub_sam",
                    "role": "assistant",
                    "status": "completed",
                    "content": [{
                        "type": "output_text",
                        "text": texto_sam,
                        "annotations": [],
                    }],
                }],
                "usage": {"stub": True},
            })
        return self._error(400, f"modelo no soportado por el stub: {modelo}")


def crear_servidor(puerto=0):
    """Crea el stub en 127.0.0.1 (puerto efímero si es 0) y lo arranca
    en un hilo. Devuelve (servidor, hilo, url_base_con_v1)."""
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), _Manejador)
    servidor.registro = []      # peticiones recibidas, para aserciones
    servidor.contadores = {}    # clave stub → nº de POST
    servidor.lock = threading.Lock()
    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    puerto_real = servidor.server_address[1]
    return servidor, hilo, f"http://127.0.0.1:{puerto_real}/v1"


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 18123
    servidor, _, base = crear_servidor(puerto)
    print(f"stub de Meta escuchando en {base} (Ctrl+C para parar)",
          flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        servidor.shutdown()


if __name__ == "__main__":
    main()
