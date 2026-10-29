#!/usr/bin/env python3
"""Adaptador de motor de prueba virtual: FASHN VTON v1.5 autohospedado en Baseten.

Cumple el contrato fijado en DIAGNOSTICO_PROBADOR.md (§4.2):

- Entrada: foto de la persona (bytes), imagen del producto (bytes),
  categoría de prenda y, opcional, tipo de foto de la prenda.
- Salida: imagen resultado (bytes PNG) + metadatos
  {proveedor, modelo, latencia_s, coste_estimado_usd, resolucion}.
- Pensado para ejecutarse como trabajo asíncrono con sondeo en el
  servidor web (patrón anti-502 ya en producción): esta función es la
  llamada bloqueante con timeout y reintentos acotados que el trabajo
  en segundo plano invoca. La clave vive SOLO en el entorno del
  servidor (BASETEN_API_KEY); nunca en el navegador ni en el repo.

Estado real (28/10/2026): el truss está construido
(probador/truss-fashn/) pero el DESPLIEGUE está bloqueado: la clave
actual de Baseten es de inferencia y la plataforma rechaza crear
modelos con HTTP 403 PERMISSION_DENIED (evidencia en
probador/prueba-fashn/README.md). Sin BASETEN_FASHN_MODEL_ID en el
entorno, `probar()` lanza MotorNoConfigurado sin hacer ninguna llamada.

Uso CLI (cuando exista despliegue):
  BASETEN_API_KEY=... BASETEN_FASHN_MODEL_ID=... \
    python3 adaptador_fashn_baseten.py persona.webp prenda.webp tops salida.png
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

PROVEEDOR = "baseten"
MODELO = "fashn-vton-1.5"
ENTORNO = os.environ.get("BASETEN_FASHN_ENV", "production")
# Tarifa pública de la GPU L4 en Baseten (oct-2026, verificada en la
# investigación): 0,01414 $/min. El coste estimado cubre solo la
# ventana de inferencia medida por el cliente; el arranque en frío
# de la réplica lo factura Baseten aparte y no se incluye aquí.
TARIFA_L4_USD_POR_S = 0.01414 / 60.0
TIMEOUT_S = 600
MAX_REINTENTOS = 2  # ante 429/5xx o error de red; nunca ante 4xx

CATEGORIAS_FASHN = ("tops", "bottoms", "one-pieces")
TIPOS_FOTO_PRENDA = ("model", "flat-lay")


class MotorNoConfigurado(RuntimeError):
    """Falta configuración del despliegue (p. ej. aún no existe)."""


class ErrorMotor(RuntimeError):
    """La llamada al motor falló tras los reintentos acotados."""


class _SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):  # noqa: D102
        raise ErrorMotor("redirección rechazada: verifica el endpoint")


def url_prediccion(model_id: str) -> str:
    return f"https://model-{model_id}.api.baseten.co/environments/{ENTORNO}/predict"


def _post_json(url: str, cuerpo: dict, clave: str, timeout: int) -> dict:
    datos = json.dumps(cuerpo).encode("utf-8")
    peticion = urllib.request.Request(
        url,
        data=datos,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Api-Key {clave}",
        },
        method="POST",
    )
    with urllib.request.build_opener(_SinRedireccion()).open(
        peticion, timeout=timeout
    ) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def probar(
    foto_persona: bytes,
    imagen_prenda: bytes,
    categoria: str,
    tipo_foto_prenda: str = "model",
    num_timesteps: int = 30,
    seed: int = 42,
    *,
    model_id: str | None = None,
    clave: str | None = None,
    _post=_post_json,
    _dormir=time.sleep,
) -> dict:
    """Genera una prueba virtual. Devuelve dict con la imagen y metadatos.

    `_post` y `_dormir` son inyectables para las pruebas sin red.
    """
    if categoria not in CATEGORIAS_FASHN:
        raise ValueError(
            f"categoría {categoria!r} no soportada por FASHN VTON; "
            f"válidas: {', '.join(CATEGORIAS_FASHN)}"
        )
    if tipo_foto_prenda not in TIPOS_FOTO_PRENDA:
        raise ValueError(f"tipo_foto_prenda inválido: {tipo_foto_prenda!r}")
    model_id = model_id or os.environ.get("BASETEN_FASHN_MODEL_ID", "")
    if not model_id:
        raise MotorNoConfigurado(
            "BASETEN_FASHN_MODEL_ID no está definido: el despliegue de "
            "FASHN VTON en Baseten aún no existe (bloqueo documentado "
            "en probador/prueba-fashn/README.md)."
        )
    clave = clave or os.environ.get("BASETEN_API_KEY", "")
    if not clave:
        raise MotorNoConfigurado("BASETEN_API_KEY no está en el entorno.")

    cuerpo = {
        "person_image_b64": base64.b64encode(foto_persona).decode("ascii"),
        "garment_image_b64": base64.b64encode(imagen_prenda).decode("ascii"),
        "category": categoria,
        "garment_photo_type": tipo_foto_prenda,
        "num_timesteps": num_timesteps,
        "seed": seed,
    }
    url = url_prediccion(model_id)
    ultimo_error: Exception | None = None
    for intento in range(MAX_REINTENTOS + 1):
        t0 = time.monotonic()
        try:
            respuesta = _post(url, cuerpo, clave, TIMEOUT_S)
        except urllib.error.HTTPError as e:
            ultimo_error = ErrorMotor(f"HTTP {e.code} del motor")
            if e.code < 500 and e.code != 429:
                raise ultimo_error from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            ultimo_error = ErrorMotor(f"error de red contra el motor: {e}")
        else:
            latencia = time.monotonic() - t0
            imagen = base64.b64decode(respuesta["image_b64"])
            return {
                "imagen_png": imagen,
                "proveedor": PROVEEDOR,
                "modelo": MODELO,
                "latencia_s": round(latencia, 2),
                "inference_s_servidor": respuesta.get("inference_s"),
                "coste_estimado_usd": round(latencia * TARIFA_L4_USD_POR_S, 5),
                "resolucion": [respuesta.get("width"), respuesta.get("height")],
                "categoria": categoria,
            }
        if intento < MAX_REINTENTOS:
            _dormir(2 * (intento + 1))
    raise ErrorMotor(
        f"motor sin respuesta tras {MAX_REINTENTOS + 1} intentos"
    ) from ultimo_error


def main() -> None:
    if len(sys.argv) != 5:
        print(__doc__)
        raise SystemExit(2)
    persona_path, prenda_path, categoria, salida_path = sys.argv[1:5]
    with open(persona_path, "rb") as f:
        foto = f.read()
    with open(prenda_path, "rb") as f:
        prenda = f.read()
    resultado = probar(foto, prenda, categoria)
    with open(salida_path, "wb") as f:
        f.write(resultado.pop("imagen_png"))
    print(json.dumps(resultado, ensure_ascii=False))


if __name__ == "__main__":
    main()
