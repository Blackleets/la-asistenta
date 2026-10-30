#!/usr/bin/env python3
"""Proveedor Meta Model API para el probador visual de cejas (CABLEADO, DORMIDO).

Pieza de fontanería construida el 29/10/2026 por orden de Lee («dejar
cableado todo para cuando tengamos la clave»): el día que exista la
clave de equipo de Meta, el probador visual de cejas se enciende sin
obra — se escribe la clave en el fichero de entorno de la máquina y
esta misma capacidad aparece sola (ver ACTIVACION_META.md).

Cumple el contrato del adaptador (probador/INTERFACES.md §4):

- Entrada: foto de la persona (bytes) + instrucción de edición
  construida desde el análisis validado de Spark.
- Salida: imagen resultado (bytes) + metadatos
  {proveedor, modelo, latencia_s, coste_estimado_usd}.
- La clave se lee SOLO del entorno del servidor: variable
  META_MODEL_API_KEY o fichero dedicado (META_ENV_FILE, por defecto
  web/meta.env junto al servidor web, permisos 0600 en la máquina).
  Nunca está en el repo, nunca sale en los logs, nunca llega al
  navegador: este módulo solo expone si la capacidad EXISTE, no la
  clave.

Lo que está DOCUMENTADO en fuentes oficiales (recopilado en
BENCHMARK_H1.md §1 y MODELOS_TRYON.md §C):
- Base `https://api.meta.ai/v1`, autenticación Bearer por equipo.
- Superficie Responses: `POST /v1/responses`
  (ai.developer.meta.com/docs/features/responses) y listado
  `GET /v1/models`.
- Muse Image (`muse-image-1.0`) genera Y edita: 0,01 $/imagen.
- SAM 3.1 (`sam-3.1`) segmenta desde prompt de texto: 2,50 $/1.000
  imágenes (0,0025 $/imagen).

CONFIRMADO CON LLAMADAS REALES el 30/10/2026 (activación, §62):
- La edición de `muse-image-1.0` sobre la superficie Responses
  (input_text + input_image como data URI) FUNCIONA tal cual contra
  api.meta.ai: imagen WebP de vuelta, latencia medida ≈ 21 s,
  coste 0,01 $. La forma de `editar_cejas()` queda confirmada.
- SAM 3.1 responde TAMBIÉN por Responses (200, «completed»), pero
  su salida es el formato de texto del protocolo de streaming
  oficial: un `output_text` con tokens
  `<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>` y
  `<|mask;x=..;y=..;data=<alto>,<ancho>,<RLE>|>`.
  `segmentar()` ya parsea ese formato real y devuelve la caja y la
  máscara en su codificación RLE nativa; DECODIFICAR ese RLE a un
  bitmap exige el códec del cliente oficial (meta-models/meta-sam)
  y queda pendiente — solo lo necesitan las estrategias B/C del
  benchmark H1; producción (estrategia A) no llama a `segmentar()`.

Sin clave en el entorno, `configurado()` devuelve False y cualquier
operación lanza ProveedorNoConfigurado SIN hacer ninguna llamada:
la web se comporta exactamente como si este módulo no existiera.

Uso CLI (solo lectura / diagnóstico, nunca imprime la clave):
  python3 proveedor_meta.py estado    → si hay clave y de dónde sale
  python3 proveedor_meta.py modelos   → GET /v1/models REAL (la
      primera verificación del día de activación; hace red de verdad)
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

PROVEEDOR = "meta-model-api"
MODELO_IMAGEN = "muse-image-1.0"
MODELO_SEGMENTACION = "sam-3.1"
BASE_POR_DEFECTO = "https://api.meta.ai/v1"
# Precios oficiales (developer.meta.com/ai/products/meta-model-api/,
# recogidos en BENCHMARK_H1.md §1.1): tarifa plana por imagen; las
# imágenes que fallan o filtra seguridad no se cobran.
COSTE_IMAGEN_USD = 0.01
COSTE_SEGMENTACION_USD = 0.0025
TIMEOUT_S = 180  # la latencia de Muse Image NO está documentada: se medirá
MAX_REINTENTOS = 2  # ante 429/5xx/timeout/red; nunca ante 401 ni otros 4xx


class ProveedorNoConfigurado(RuntimeError):
    """No hay clave de Meta en el entorno: la capacidad no existe."""


class ClaveNoValida(RuntimeError):
    """La API rechazó la clave (401). Estado INTERNO: el servidor lo
    registra para el operador; a la clienta jamás se le filtra (la
    web lo traduce a un mensaje genérico)."""


class LimiteAlcanzado(RuntimeError):
    """429 persistente tras los reintentos acotados con espera."""


class ErrorProveedor(RuntimeError):
    """La llamada falló tras los reintentos, o la respuesta no tiene
    la forma esperada (ver marcas «a confirmar» en el módulo)."""


class _SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):  # noqa: D102
        raise ErrorProveedor("redirección rechazada: verifica el endpoint")


# ---------------- clave y configuración (solo entorno) ----------------

def _ruta_env_defecto() -> str:
    # probador/ → raíz del proyecto → web/meta.env (junto al servidor,
    # como profesional.env). En la máquina: /data/la-asistenta/web/meta.env
    return os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "web", "meta.env")


def _leer_clave_de_fichero(ruta: str) -> str:
    try:
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                if linea.startswith("META_MODEL_API_KEY="):
                    return linea.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def fuente_clave() -> str:
    """De dónde saldría la clave: "entorno" | "fichero" | "ninguna".
    Diagnóstico sin revelar jamás el valor."""
    if (os.environ.get("META_MODEL_API_KEY") or "").strip():
        return "entorno"
    ruta = os.environ.get("META_ENV_FILE") or _ruta_env_defecto()
    if _leer_clave_de_fichero(ruta):
        return "fichero"
    return "ninguna"


def clave() -> str:
    """La clave de equipo de Meta, leída del entorno en CADA llamada
    (sin caché: el interruptor de capacidad se vuelca en el momento
    en que el fichero aparece, sin reiniciar nada)."""
    k = (os.environ.get("META_MODEL_API_KEY") or "").strip()
    if k:
        return k
    ruta = os.environ.get("META_ENV_FILE") or _ruta_env_defecto()
    return _leer_clave_de_fichero(ruta)


def configurado() -> bool:
    """El interruptor de capacidad: True si hay una clave presente.
    Presente ≠ válida: la validez solo la prueba la primera llamada
    real (un 401 se mapea a ClaveNoValida, estado interno)."""
    return bool(clave())


def base_url() -> str:
    return (os.environ.get("META_MODEL_API_BASE") or BASE_POR_DEFECTO).rstrip("/")


# ---------------- transporte (inyectable para las pruebas) ----------------

def _peticion(metodo: str, url: str, cuerpo: dict | None,
              clave_: str, timeout: int) -> dict:
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo)
    req.add_header("Authorization", "Bearer " + clave_)
    if datos is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.build_opener(_SinRedireccion()).open(
            req, timeout=timeout) as respuesta:
        return json.loads(respuesta.read().decode("utf-8"))


def _con_reintentos(accion, _dormir):
    """Ejecuta `accion` con la política del proyecto (la misma del
    adaptador FASHN): 401 → ClaveNoValida sin reintentar; otros 4xx →
    ErrorProveedor sin reintentar; 429/5xx/timeout/red → hasta
    MAX_REINTENTOS reintentos con espera creciente (Retry-After si
    viene); 429 agotado → LimiteAlcanzado."""
    ultimo: Exception | None = None
    era_429 = False
    for intento in range(MAX_REINTENTOS + 1):
        try:
            return accion()
        except urllib.error.HTTPError as e:
            if e.code == 401:
                raise ClaveNoValida(
                    "la Meta Model API rechazó la clave (401)") from e
            if 400 <= e.code < 500 and e.code != 429:
                raise ErrorProveedor(f"HTTP {e.code} de la Meta Model API") from e
            era_429 = e.code == 429
            ultimo = ErrorProveedor(f"HTTP {e.code} de la Meta Model API")
            espera = 2 * (intento + 1)
            if era_429:
                try:
                    ra = int(e.headers.get("Retry-After") or 0)
                    if ra > 0:
                        espera = min(ra, 30)
                except Exception:
                    pass
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            era_429 = False
            ultimo = ErrorProveedor(f"error de red o timeout contra Meta: {e}")
            espera = 2 * (intento + 1)
        if intento < MAX_REINTENTOS:
            _dormir(espera)
    if era_429:
        raise LimiteAlcanzado(
            f"límite de la Meta Model API tras {MAX_REINTENTOS + 1} intentos"
        ) from ultimo
    raise ErrorProveedor(
        f"Meta Model API sin respuesta tras {MAX_REINTENTOS + 1} intentos"
    ) from ultimo


# ---------------- utilidades de imagen ----------------

def _mime_de(datos: bytes) -> str:
    if datos[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if datos[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def _data_uri(datos: bytes) -> str:
    return f"data:{_mime_de(datos)};base64," + base64.b64encode(datos).decode("ascii")


def construir_instruccion(analisis: dict, preferencias: dict | None = None) -> str:
    """Instrucción de edición determinista para la estrategia A del
    benchmark H1 (edición directa): se construye SOLO desde el JSON
    de análisis ya validado por la web y las preferencias de la
    clienta — nunca texto libre sin validar."""
    p = preferencias or {}
    return (
        "Edita esta foto SOLO en la zona de las cejas para mostrar una "
        "propuesta visual orientativa del servicio "
        f"«{analisis.get('servicio_recomendado', '')}» de un salón de cejas. "
        f"Objetivo del servicio: {analisis.get('motivo', '')} "
        "Estilo que busca la clienta: "
        f"naturalidad {p.get('naturalidad', '—')}/5, "
        f"grosor {p.get('grosor', '—')}, arco {p.get('arco', '—')}, "
        f"tono {p.get('tono', '—')}, intensidad {p.get('intensidad', '—')}. "
        "Conserva intactos y sin ningún cambio la piel, los ojos, el "
        "pelo, la luz, el fondo y la identidad de la persona. "
        "No añadas texto, logos ni marcas de agua."
    )


# ---------------- operaciones ----------------

def listar_modelos(*, clave_: str | None = None, _get=_peticion,
                   _dormir=time.sleep, timeout: int = 30) -> list:
    """GET /v1/models — la verificación de solo lectura del día de
    activación (BENCHMARK_H1.md §2.2 paso 4): la lista real de
    modelos que el equipo puede invocar."""
    k = clave_ if clave_ is not None else clave()
    if not k:
        raise ProveedorNoConfigurado(
            "META_MODEL_API_KEY no está en el entorno (ver ACTIVACION_META.md).")
    r = _con_reintentos(
        lambda: _get("GET", base_url() + "/models", None, k, timeout), _dormir)
    return [m.get("id") for m in r.get("data", []) if isinstance(m, dict)]


def _extraer_b64_imagen(nodo, profundidad=0):
    """Busca la imagen generada en la respuesta con tolerancia de
    forma (la forma exacta está A CONFIRMAR): resultado de una
    llamada de generación de imagen en Responses, o cualquier
    `b64_json` / `image_b64` presente."""
    if profundidad > 6:
        return None
    if isinstance(nodo, dict):
        for clave_b64 in ("result", "b64_json", "image_b64"):
            v = nodo.get(clave_b64)
            if isinstance(v, str) and len(v) > 40:
                return v
        for v in nodo.values():
            hallado = _extraer_b64_imagen(v, profundidad + 1)
            if hallado:
                return hallado
    elif isinstance(nodo, list):
        for v in nodo:
            hallado = _extraer_b64_imagen(v, profundidad + 1)
            if hallado:
                return hallado
    return None


def editar_cejas(foto: bytes, instruccion: str, *,
                 clave_: str | None = None, _post=_peticion,
                 _dormir=time.sleep, timeout: int = TIMEOUT_S) -> dict:
    """Edición con Muse Image: foto de la clienta + instrucción →
    imagen propuesta. Devuelve el dict del contrato (§4) con la
    imagen en bytes.

    FORMA CONFIRMADA el 30/10/2026 contra la API real (activación,
    §62): superficie Responses, contenido input_text + input_image
    como data URI; la respuesta trae la imagen generada (WebP en la
    medición real) localizable con `_extraer_b64_imagen`."""
    k = clave_ if clave_ is not None else clave()
    if not k:
        raise ProveedorNoConfigurado(
            "META_MODEL_API_KEY no está en el entorno (ver ACTIVACION_META.md).")
    cuerpo = {
        "model": MODELO_IMAGEN,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": instruccion},
                {"type": "input_image", "image_url": _data_uri(foto)},
            ],
        }],
    }
    t0 = time.monotonic()
    r = _con_reintentos(
        lambda: _post("POST", base_url() + "/responses", cuerpo, k, timeout),
        _dormir)
    latencia = round(time.monotonic() - t0, 2)
    b64 = _extraer_b64_imagen(r)
    if not b64:
        raise ErrorProveedor(
            "la respuesta de Muse Image no trae imagen reconocible "
            "(forma de respuesta a confirmar con la primera llamada real)")
    try:
        imagen = base64.b64decode(b64, validate=True)
    except Exception as e:
        raise ErrorProveedor("la imagen de Muse Image llegó dañada") from e
    return {
        "imagen": imagen,
        "mime": _mime_de(imagen),
        "proveedor": PROVEEDOR,
        "modelo": MODELO_IMAGEN,
        "latencia_s": latencia,
        "coste_estimado_usd": COSTE_IMAGEN_USD,
        "respuesta_id": r.get("id"),
    }


def _texto_de_respuesta(r: dict) -> str:
    """Concatena los `output_text` de una respuesta Responses."""
    partes = []
    for item in r.get("output") or []:
        if not isinstance(item, dict):
            continue
        for parte in item.get("content") or []:
            if isinstance(parte, dict) and parte.get("type") == "output_text":
                partes.append(parte.get("text") or "")
    return "".join(partes)


def segmentar(foto: bytes, prompt: str = "eyebrows", *,
              clave_: str | None = None, _post=_peticion,
              _dormir=time.sleep, timeout: int = TIMEOUT_S) -> dict:
    """Segmentación con SAM 3.1 (estrategias B/C del benchmark H1):
    localiza la región pedida por texto y devuelve su caja y su
    máscara en la codificación nativa del protocolo.

    FORMA REAL CONFIRMADA el 30/10/2026 (activación, §62): la
    petición Responses de siempre (modelo `sam-3.1`, input_text con
    el prompt + input_image) responde 200 «completed» con un
    `output_text` en el formato de tokens del protocolo oficial:
    `<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>` (caja en píxeles de
    la imagen original) y `<|mask;x=..;y=..;data=<alto>,<ancho>,
    <RLE>|>` (máscara recortada a la caja, RLE en el alfabeto ASCII
    propio del protocolo). Se devuelven la caja parseada y la
    máscara SIN decodificar (`mascara_datos`, tal cual llega):
    pasar ese RLE a un bitmap exige el códec del cliente oficial
    (github.com/meta-models/meta-sam), pendiente y SOLO necesario
    para las estrategias B/C — producción (estrategia A) no usa
    esta función. Cambio de contrato 30/10/2026: desaparece la
    clave `mascara` (bytes) que asumía un `mask_b64` inexistente."""
    k = clave_ if clave_ is not None else clave()
    if not k:
        raise ProveedorNoConfigurado(
            "META_MODEL_API_KEY no está en el entorno (ver ACTIVACION_META.md).")
    cuerpo = {
        "model": MODELO_SEGMENTACION,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": _data_uri(foto)},
            ],
        }],
    }
    t0 = time.monotonic()
    r = _con_reintentos(
        lambda: _post("POST", base_url() + "/responses", cuerpo, k, timeout),
        _dormir)
    latencia = round(time.monotonic() - t0, 2)
    texto = _texto_de_respuesta(r)
    m_caja = re.search(
        r"<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|>",
        texto)
    m_mask = re.search(r"<\|mask;x=(\d+);y=(\d+);data=([^|]+)\|>", texto)
    if not m_caja or not m_mask:
        raise ErrorProveedor(
            "la respuesta de SAM 3.1 no trae los tokens box/mask "
            "del formato real (confirmado el 30/10/2026)")
    datos = m_mask.group(3)
    dims = datos.split(",", 2)
    return {
        "caja": {
            "x1": int(m_caja.group(1)), "y1": int(m_caja.group(2)),
            "x2": int(m_caja.group(3)), "y2": int(m_caja.group(4)),
            "w": int(m_caja.group(5)), "h": int(m_caja.group(6)),
        },
        "mascara_datos": datos,
        "mascara_dims": (int(dims[0]), int(dims[1]))
        if len(dims) == 3 and dims[0].isdigit() and dims[1].isdigit()
        else None,
        "mascara_origen": {
            "x": int(m_mask.group(1)), "y": int(m_mask.group(2))},
        "prompt": prompt,
        "proveedor": PROVEEDOR,
        "modelo": MODELO_SEGMENTACION,
        "latencia_s": latencia,
        "coste_estimado_usd": COSTE_SEGMENTACION_USD,
        "respuesta_id": r.get("id"),
    }


def payload_visual(resultado: dict) -> dict:
    """La forma en que el resultado viaja a la web y se guarda como
    look en el dispositivo (INTERFACES.md §6): imagen como data URI
    + procedencia sin ambigüedad. La foto ORIGINAL de la clienta
    nunca forma parte de este payload."""
    return {
        "estado": "listo",
        "imagen": _data_uri(resultado["imagen"]),
        "proveedor": resultado["proveedor"],
        "modelo": resultado["modelo"],
        "latencia_s": resultado["latencia_s"],
        "coste_estimado_usd": resultado["coste_estimado_usd"],
    }


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in ("estado", "modelos"):
        print(__doc__)
        raise SystemExit(2)
    if sys.argv[1] == "estado":
        print(json.dumps({
            "configurado": configurado(),
            "fuente_clave": fuente_clave(),
            "base": base_url(),
        }, ensure_ascii=False))
        return
    # «modelos»: llamada REAL de solo lectura (día de activación).
    print(json.dumps(listar_modelos(), ensure_ascii=False))


if __name__ == "__main__":
    main()
