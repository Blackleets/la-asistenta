#!/usr/bin/env python3
"""Receptor mínimo de WhatsApp Cloud API para La Asistenta (Ari Vivas Beauty).

Qué hace:
  - GET  /webhook : verificación de Meta (hub.mode / hub.verify_token / hub.challenge).
  - POST /webhook : recibe mensajes de WhatsApp, los pasa a Hermes Agent
                    (una sesión con nombre por número: wa-<telefono>) y genera
                    la respuesta lista para la WhatsApp Cloud API.
  - GET  /salud   : comprobación de vida.

Sin dependencias externas (solo stdlib). Si existen WHATSAPP_TOKEN y
WHATSAPP_PHONE_NUMBER_ID en el entorno, la respuesta se ENVÍA de verdad a la
Graph API; si no, queda en modo «dry-run»: la respuesta preparada se devuelve
en el cuerpo del 200 y se anota en el log (así se prueba todo sin credenciales).

Configuración: variables de entorno o un fichero .env junto a este script
(ver .env.example). Los secretos NUNCA se escriben en el log.
"""
import hashlib
import hmac
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(BASE_DIR, "logs", "webhook.log")
SEEN_PATH = os.path.join(BASE_DIR, "logs", "vistos.json")
GRAPH_VERSION = os.environ.get("WHATSAPP_GRAPH_VERSION", "v21.0")


def cargar_env():
    """Carga .env local (KEY=VALUE) sin pisar variables ya presentes."""
    ruta = os.path.join(BASE_DIR, ".env")
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if not linea or linea.startswith("#") or "=" not in linea:
                    continue
                clave, valor = linea.split("=", 1)
                os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


cargar_env()

VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
WA_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
PORT = int(os.environ.get("PORT", "8080"))
HERMES_BIN = os.environ.get("HERMES_BIN", os.path.expanduser("~/.local/bin/hermes"))
HERMES_TIMEOUT = int(os.environ.get("HERMES_TIMEOUT_S", "240"))


def log(evento):
    evento = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), **evento}
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(evento, ensure_ascii=False) + "\n")


def cargar_vistos():
    try:
        with open(SEEN_PATH, encoding="utf-8") as f:
            return set(json.load(f))
    except Exception:
        return set()


def guardar_vistos(vistos):
    os.makedirs(os.path.dirname(SEEN_PATH), exist_ok=True)
    with open(SEEN_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted(vistos)[-2000:], f)


VISTOS = cargar_vistos()


def preguntar_a_hermes(telefono, texto):
    """Un turno de conversación con Hermes en la sesión del número.

    Devuelve (respuesta, latencia_s). Lanza RuntimeError si Hermes falla.
    """
    env = dict(os.environ)
    env.setdefault("HERMES_HOME", os.path.expanduser("~/workspace/la-asistenta/hermes-home"))
    env.setdefault("HERMES_RUNTIME_DIR", os.path.expanduser("~/workspace/la-asistenta/hermes-runtime"))
    sesion = f"wa-{telefono}"
    cmd = [
        HERMES_BIN, "chat", "-Q",
        "--continue", sesion, "--create-if-missing",
        "--source", "whatsapp",
        "-q", texto,
    ]
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=HERMES_TIMEOUT, env=env)
    latencia = time.time() - t0
    if proc.returncode != 0:
        raise RuntimeError(f"hermes salió con {proc.returncode}: {proc.stderr.strip()[-400:]}")
    return proc.stdout.strip(), latencia


def enviar_whatsapp(para, cuerpo):
    """Envía el mensaje por la Graph API. Solo si hay credenciales reales."""
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": para,
        "type": "text",
        "text": {"body": cuerpo},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def extraer_mensajes(payload):
    """Saca los mensajes de texto del payload de WhatsApp Cloud API."""
    salida = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            if change.get("field") != "messages" or "messages" not in value:
                continue
            nombres = {
                c.get("wa_id"): (c.get("profile") or {}).get("name", "")
                for c in value.get("contacts", [])
            }
            for m in value["messages"]:
                if m.get("type") != "text":
                    continue
                salida.append({
                    "wamid": m.get("id", ""),
                    "telefono": m.get("from", ""),
                    "nombre": nombres.get(m.get("from", ""), ""),
                    "texto": (m.get("text") or {}).get("body", ""),
                })
    return salida


def firma_valida(raw, cabecera):
    if not APP_SECRET:
        return None  # sin secreto configurado: no se puede verificar (ver README)
    esperada = "sha256=" + hmac.new(
        APP_SECRET.encode("utf-8"), raw, hashlib.sha256
    ).hexdigest()
    return cabecera is not None and hmac.compare_digest(esperada, cabecera)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _responder(self, codigo, cuerpo, tipo="application/json"):
        datos = cuerpo.encode("utf-8") if isinstance(cuerpo, str) else cuerpo
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        partes = urlparse(self.path)
        if partes.path == "/salud":
            return self._responder(200, json.dumps({"ok": True, "servicio": "la-asistenta-webhook"}))
        if partes.path != "/webhook":
            return self._responder(404, json.dumps({"error": "ruta no encontrada"}))
        qs = parse_qs(partes.query)
        mode = (qs.get("hub.mode") or [""])[0]
        token = (qs.get("hub.verify_token") or [""])[0]
        challenge = (qs.get("hub.challenge") or [""])[0]
        if mode == "subscribe" and VERIFY_TOKEN and token == VERIFY_TOKEN:
            log({"evento": "verificacion_get", "resultado": "ok"})
            return self._responder(200, challenge, "text/plain; charset=utf-8")
        log({"evento": "verificacion_get", "resultado": "token_incorrecto"})
        return self._responder(403, json.dumps({"error": "verify token incorrecto"}))

    def do_POST(self):
        if self.path.split("?")[0] != "/webhook":
            return self._responder(404, json.dumps({"error": "ruta no encontrada"}))
        largo = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(largo)
        firma = firma_valida(raw, self.headers.get("X-Hub-Signature-256"))
        if firma is False:
            log({"evento": "post", "resultado": "firma_invalida"})
            return self._responder(401, json.dumps({"error": "firma inválida"}))
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            return self._responder(400, json.dumps({"error": "JSON inválido"}))

        respuestas = []
        for msg in extraer_mensajes(payload):
            if msg["wamid"] and msg["wamid"] in VISTOS:
                log({"evento": "duplicado_ignorado", "wamid": msg["wamid"]})
                continue
            if msg["wamid"]:
                VISTOS.add(msg["wamid"])
                guardar_vistos(VISTOS)
            t0 = time.time()
            try:
                texto_respuesta, latencia = preguntar_a_hermes(msg["telefono"], msg["texto"])
            except Exception as exc:
                log({"evento": "error_hermes", "telefono": msg["telefono"], "error": str(exc)[:300]})
                texto_respuesta, latencia = (
                    "Perdona, ahora mismo no puedo responder. Lo revisamos y te escribimos enseguida. 🙏",
                    time.time() - t0,
                )
            preparado = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": msg["telefono"],
                "type": "text",
                "text": {"body": texto_respuesta},
            }
            enviado = None
            if WA_TOKEN and PHONE_NUMBER_ID:
                try:
                    enviado = enviar_whatsapp(msg["telefono"], texto_respuesta)
                except Exception as exc:
                    log({"evento": "error_envio", "telefono": msg["telefono"], "error": str(exc)[:300]})
            log({
                "evento": "mensaje",
                "telefono": msg["telefono"],
                "nombre_perfil": msg["nombre"],
                "entrante": msg["texto"],
                "respuesta": texto_respuesta,
                "latencia_hermes_s": round(latencia, 2),
                "modo": "enviado" if enviado else "dry-run",
            })
            respuestas.append({
                "para": msg["telefono"],
                "latencia_hermes_s": round(latencia, 2),
                "payload_listo_para_whatsapp": preparado,
                "envio_graph_api": enviado,
            })
        return self._responder(200, json.dumps(
            {"status": "ok", "firma_verificada": firma, "respuestas": respuestas},
            ensure_ascii=False,
        ))

    def log_message(self, *args):  # silencio en consola: el log va a fichero
        pass


def main():
    if not VERIFY_TOKEN:
        print("AVISO: WHATSAPP_VERIFY_TOKEN no está definido: la verificación GET fallará.", file=sys.stderr)
    if not APP_SECRET:
        print("AVISO: sin WHATSAPP_APP_SECRET no se verificará la firma de los POST (riesgo documentado).", file=sys.stderr)
    modo = "ENVÍO REAL" if (WA_TOKEN and PHONE_NUMBER_ID) else "DRY-RUN (sin credenciales de envío)"
    print(f"La Asistenta · webhook WhatsApp en http://127.0.0.1:{PORT}/webhook · modo: {modo}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
