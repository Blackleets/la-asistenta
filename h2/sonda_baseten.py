#!/usr/bin/env python3
"""Sonda de Baseten para la puerta H2 (solo lectura + 1 llamada de visión).

1) GET /v1/models con el surrogate de custom.baseten -> modelos accesibles
   con ESTA clave (busca modelos de imagen tipo Muse Image).
2) POST /v1/chat/completions DIRECTO con la foto de prueba (base64 data URL)
   -> mide la latencia de visión de Spark sin el sobrecoste de Hermes.

La clave real nunca aparece: la pone el intercambio de credenciales de Muse.
Salidas: sonda_modelos.json y respuesta_directa.json en este mismo directorio.
"""
import base64
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE = "https://inference.baseten.co/v1"
MODEL = "meta-models/muse-spark-open-1026"
HERE = os.path.dirname(os.path.abspath(__file__))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused, verify the endpoint")


def call(request, timeout=180):
    add_surrogate_to_request(request, "custom.baseten", allowed_hosts=["inference.baseten.co"])
    start = time.time()
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=timeout) as r:
            return r.status, time.time() - start, read_json_response(r)
    except urllib.error.HTTPError as e:
        return e.code, time.time() - start, {"error": e.read().decode("utf-8", "replace")[:1200]}


def main() -> None:
    # 1) Listado de modelos accesibles con esta clave
    req = urllib.request.Request(f"{BASE}/models", method="GET")
    status, lat, data = call(req, timeout=60)
    ids = [m.get("id") for m in (data.get("data") or [])] if isinstance(data, dict) else []
    modelos = {"status": status, "latency_s": round(lat, 2), "count": len(ids), "model_ids": ids,
               "raw_error": data.get("error") if isinstance(data, dict) else None}
    with open(os.path.join(HERE, "sonda_modelos.json"), "w") as f:
        json.dump(modelos, f, ensure_ascii=False, indent=2)
    print("MODELOS:", json.dumps(modelos, ensure_ascii=False)[:1500])

    # 2) Visión directa: Spark analiza la foto sin pasar por Hermes
    with open(os.path.join(HERE, "foto_prueba.jpg"), "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    prompt = (
        "Eres La Asistenta de Ari Vivas Beauty. Una clienta te manda esta foto de sus cejas. "
        "Analízalas (forma, grosor, densidad/huecos, dirección del pelo) y recomienda UN servicio "
        "de esta carta, diciendo cuál y por qué, con precio y duración: Diseño de cejas 18 € · 25 min; "
        "Ombré Brows con henna 30 € · 65 min; Laminación de cejas 45 € · 65 min; Depilación rápida "
        "(precio a consultar) · 12 min. Quiere algo que se note pero natural. Tono cálido, breve, español."
    )
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]}],
        "max_tokens": 1024,
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/chat/completions", data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    status, lat, data = call(req)
    choice = (data.get("choices") or [{}])[0] if isinstance(data, dict) else {}
    message = choice.get("message") or {}
    out = {"status": status, "latency_s": round(lat, 2), "model": data.get("model") if isinstance(data, dict) else None,
           "content": message.get("content"), "reasoning": message.get("reasoning_content") or message.get("reasoning"),
           "finish_reason": choice.get("finish_reason"),
           "usage": data.get("usage") if isinstance(data, dict) else None,
           "raw_error": data.get("error") if isinstance(data, dict) else None}
    with open(os.path.join(HERE, "respuesta_directa.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("VISION_DIRECTA:", json.dumps(out, ensure_ascii=False)[:2000])


if __name__ == "__main__":
    main()
