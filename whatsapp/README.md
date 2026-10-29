# La Asistenta · Receptor de WhatsApp (webhook)

Receptor mínimo de **WhatsApp Cloud API** y **Twilio WhatsApp Sandbox**
(stdlib de Python, sin dependencias) que pasa cada mensaje a Hermes Agent y
devuelve la respuesta por el mismo canal de entrada.

> Nota de diseño: Hermes trae además su propio gateway nativo de WhatsApp
> Cloud (`hermes whatsapp-cloud` / `hermes gateway`), que es la vía del plan
> original. Este receptor propio es la pieza construida para la puerta H3:
> es deliberadamente pequeño, auditable entero en un fichero, y ya está
> probado de punta a punta en local (ver `../H3_TECNICO.md`).

## Arranque en local

```bash
cd ~/workspace/la-asistenta/whatsapp
cp .env.example .env        # y rellena los valores (ver abajo)
python3 webhook.py          # escucha en http://127.0.0.1:8080/webhook
curl http://127.0.0.1:8080/salud
```

## Probar sin Meta (simulación)

Con el servidor en marcha, en otra terminal:

```bash
python3 simular.py            # clienta «Carmen», guion de 4 turnos
python3 ../agenda/agenda_cli.py   # la cita debe aparecer en la agenda
```

`simular.py` envía payloads con la forma exacta de Meta; el bucle completo
(webhook → Hermes → Spark → herramienta de agenda → respuesta) es el real.

## Exponerlo por HTTPS (para pegar la URL en el panel de Meta)

Meta exige que el webhook sea HTTPS público. En local se usa un túnel:

```bash
# Opción 1: Cloudflare Tunnel (sin cuenta para una prueba rápida)
cloudflared tunnel --url http://127.0.0.1:8080

# Opción 2: ngrok
ngrok http 8080
```

Ambos imprimen una URL pública `https://…`. La URL del webhook a pegar en
Meta será `https://<esa-url>/webhook`. Ojo: la URL del túnel gratuito cambia
al reiniciar; para la entrega conviene dejar túnel y servidor fijos durante
el ensayo y la demo.

## Qué se pega en el panel de Meta (resumen; detalle en ../H3_TECNICO.md)

En la app de Meta for Developers → WhatsApp → Configuration → Webhook:

- **Callback URL:** `https://<tu-url>/webhook`
- **Verify token:** exactamente el `WHATSAPP_VERIFY_TOKEN` de tu `.env`
  (lo inventas tú; Meta lo comprueba contra este servidor con un GET).
- **Campos suscritos:** `messages` (imprescindible).

Y en WhatsApp → API Setup, para poder ENVIAR (modo real):

- **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- **Token de acceso** → `WHATSAPP_TOKEN` (¡el temporal caduca a las 24 h!
  hay que generar uno permanente con un usuario del sistema de Meta Business)
- **App Secret** (App Settings → Basic) → `WHATSAPP_APP_SECRET`
  (sin él no se puede verificar la firma de los POST entrantes).

Sin `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` el servidor funciona en
**dry-run**: procesa y genera la respuesta, pero no la envía a Meta; la deja
en el cuerpo del 200 y en `logs/webhook.log`. Perfecto para probar; inútil
para clientas reales.

## Ruta C: Twilio WhatsApp Sandbox

La URL a configurar en Twilio para mensajes entrantes es:

```text
https://<tu-url-publica>/twilio/webhook
```

Twilio envía `From`, `Body`, `ProfileName` y `MessageSid` como formulario.
El servidor deduplica por `MessageSid`, reutiliza la misma sesión de Hermes
`wa-<telefono>` y, cuando están configurados `TWILIO_ACCOUNT_SID` y
`TWILIO_AUTH_TOKEN`, confirma el webhook de inmediato y envía la respuesta
después mediante la API de Twilio. Ese diseño evita depender del tiempo que
Hermes tarda en generar la respuesta. Sin credenciales, la ruta devuelve la
respuesta en TwiML y sirve solo para pruebas locales.

En la consola de Twilio, el Sandbox muestra el número compartido y el código
`join ...` que cada móvil de prueba debe enviar una vez por WhatsApp. Las
credenciales se guardan exclusivamente en el `.env` local o en la bóveda;
no se pegan en el código, el repo ni los chats.

## Ficheros

| Fichero | Qué es |
|---|---|
| `webhook.py` | El receptor (GET verificación, POST mensajes, firma HMAC, deduplicación por wamid, sesiones Hermes `wa-<telefono>`) |
| `simular.py` | Cliente de prueba con payloads forma-Meta |
| `.env.example` | Plantilla de configuración (el verify token de ejemplo NO es el definitivo) |
| `logs/webhook.log` | Registro JSON por línea de cada mensaje (sin secretos) |
| `logs/vistos.json` | IDs de mensaje ya procesados (Meta reintenta: hay que deduplicar) |

## Limitaciones honestas de esta pieza mínima

- La ruta de Meta procesa cada mensaje **en línea** antes de responder 200:
  un turno tarda lo que Hermes (~8–25 s). La ruta de Twilio con credenciales
  responde de inmediato y procesa en segundo plano; sin credenciales usa
  TwiML síncrono solo para pruebas locales.
- La sesión de Hermes se identifica por el número (`wa-<telefono>`): si la
  clienta cambia de número, empieza conversación nueva.
- El registro de la cita lo hace el modelo llamando a la herramienta de
  agenda: si Spark no la invocara, no hay red de seguridad automática. La
  instrucción está en `hermes-home/SOUL.md` y la prueba H3 la ejerce entera.
