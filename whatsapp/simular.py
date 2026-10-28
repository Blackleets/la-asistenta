#!/usr/bin/env python3
"""Simulador de WhatsApp Cloud API para probar el webhook en local.

Envía payloads con la MISMA forma que Meta (entry/changes/messages) al
receptor local y muestra la respuesta de La Asistenta y la latencia de cada
turno. No usa ninguna credencial: sirve para demostrar el bucle completo
(webhook -> Hermes -> Spark -> agenda) antes del paso del navegador.

Uso: python3 simular.py [telefono] [nombre]
"""
import json
import sys
import time
import urllib.request

URL = "http://127.0.0.1:8080/webhook"
TELEFONO = sys.argv[1] if len(sys.argv) > 1 else "34600000000"
NOMBRE = sys.argv[2] if len(sys.argv) > 2 else "Carmen"

GUION = [
    "Hola, buenas tardes",
    "Quería hacerme las cejas, algo natural pero que se note. ¿Qué me recomiendas y cuánto cuesta?",
    "Me quedo con el diseño de cejas. ¿Puedo este jueves por la tarde, sobre las 17:30? Me llamo Carmen.",
    "Sí, perfecto, déjalo confirmado. ¡Gracias!",
]


def payload(texto, wamid):
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "WABA_SIMULADO",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"display_phone_number": "15550000000", "phone_number_id": "SIMULADO"},
                    "contacts": [{"profile": {"name": NOMBRE}, "wa_id": TELEFONO}],
                    "messages": [{
                        "from": TELEFONO,
                        "id": wamid,
                        "timestamp": str(int(time.time())),
                        "type": "text",
                        "text": {"body": texto},
                    }],
                },
            }],
        }],
    }


def main():
    print(f"== Simulación WhatsApp · clienta {NOMBRE} ({TELEFONO}) -> {URL}\n")
    for i, texto in enumerate(GUION, 1):
        wamid = f"wamid.SIMULADO.{int(time.time())}.{i}"
        req = urllib.request.Request(
            URL,
            data=json.dumps(payload(texto, wamid)).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        total = time.time() - t0
        resp_list = data.get("respuestas") or []
        cuerpo = ""
        lat = None
        if resp_list:
            cuerpo = resp_list[0]["payload_listo_para_whatsapp"]["text"]["body"]
            lat = resp_list[0]["latencia_hermes_s"]
        print(f"[Turno {i}] Clienta: {texto}")
        print(f"[Turno {i}] La Asistenta: {cuerpo}")
        print(f"[Turno {i}] Latencia Hermes: {lat} s · ida y vuelta del webhook: {total:.1f} s\n")


if __name__ == "__main__":
    main()
