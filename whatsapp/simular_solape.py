#!/usr/bin/env python3
"""Simulador por turnos sueltos para la prueba de solape de agenda.

Igual que simular.py (payloads forma-Meta al webhook local, dry-run), pero
los mensajes se pasan por línea de comandos, para poder encadenar varias
invocaciones sobre la MISMA sesión (mismo teléfono) adaptando cada turno a
la respuesta anterior.

Uso: python3 simular_solape.py <telefono> <nombre> "mensaje 1" ["mensaje 2" ...]
"""
import json
import sys
import time
import urllib.request

URL = "http://127.0.0.1:8080/webhook"


def payload(telefono, nombre, texto, wamid):
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "WABA_SIMULADO",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"display_phone_number": "15550000000", "phone_number_id": "SIMULADO"},
                    "contacts": [{"profile": {"name": nombre}, "wa_id": telefono}],
                    "messages": [{
                        "from": telefono,
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
    telefono, nombre, mensajes = sys.argv[1], sys.argv[2], sys.argv[3:]
    print(f"== Simulación solape · clienta {nombre} ({telefono}) -> {URL}\n")
    for i, texto in enumerate(mensajes, 1):
        wamid = f"wamid.SIMSOLAPE.{int(time.time())}.{i}"
        req = urllib.request.Request(
            URL,
            data=json.dumps(payload(telefono, nombre, texto, wamid)).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        total = time.time() - t0
        resp_list = data.get("respuestas") or []
        cuerpo, lat = "", None
        if resp_list:
            cuerpo = resp_list[0]["payload_listo_para_whatsapp"]["text"]["body"]
            lat = resp_list[0]["latencia_hermes_s"]
        print(f"[Turno] Clienta: {texto}")
        print(f"[Turno] La Asistenta: {cuerpo}")
        print(f"[Turno] Latencia Hermes: {lat} s · ida y vuelta del webhook: {total:.1f} s\n")


if __name__ == "__main__":
    main()
