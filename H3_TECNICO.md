# Puerta H3 — Lado técnico LISTO (WhatsApp real → reserva en agenda)

**Fecha:** 2026-10-27 (noche) · **Estado:** ✅ todo lo construible sin credenciales
de Meta está construido y **demostrado en local de punta a punta**. Lo único que
falta es el paso del navegador en el panel de Meta (cuenta de Lee), cuyos campos
exactos quedan listados al final.

## Arquitectura final

```
Clienta (WhatsApp)
      │  POST HTTPS (payload Cloud API)
      ▼
whatsapp/webhook.py  ── receptor propio, stdlib, puerto 8080
  · GET  /webhook  → verificación de Meta (hub.challenge)
  · POST /webhook  → firma HMAC (si hay App Secret), dedup por wamid
      │  un turno por mensaje, sesión Hermes «wa-<telefono>»
      ▼
Hermes Agent (hermes-home, SOUL de recepcionista)
      │  chat_completions vía egress (surrogate de la bóveda)
      ▼
Muse Spark Open @ Baseten  (meta-models/muse-spark-open-1026)
      │  tool_call cuando la clienta confirma
      ▼
MCP «agenda» (agenda/mcp_agenda.py, stdio, sin dependencias)
      │  registrar_cita / consultar_citas
      ▼
SQLite  agenda/agenda.db  ← LA RESERVA QUEDA ESCRITA AQUÍ
      │
      └─ respuesta de vuelta: webhook → payload WhatsApp → (Graph API si hay
         token; si no, dry-run: payload en el 200 y en logs/webhook.log)
```

### Por qué la agenda es un servidor MCP (y no otra cosa)

Hermes ofrece tres vías para dar herramientas al modelo: herramientas del
núcleo, skills (instrucciones, no ejecutan) y **servidores MCP**. Se eligió MCP
porque es el mecanismo estándar del harness para herramientas externas: el
modelo invoca `registrar_cita` como *tool call* real (Spark la ejerce vía
Baseten, comprobado en la demo), el registro ocurre **dentro** del turno en el
que la clienta confirma —no en un post-procesado que podría perder la
conversación— y el servidor es un único fichero stdlib auditable (sin SDK de
MCP: el protocolo stdio es JSON-RPC y la superficie son 2 herramientas).
Frente a post-procesar la sesión: frágil (depende del texto exacto del
resumen) y tardío (la clienta ya se fue). Frente a un hook de shell: Hermes
los orienta a eventos de ciclo de vida, no a datos de negocio validados
(fecha/hora/precio) como hace la herramienta, que valida formato y devuelve id.

## Piezas y cómo se arranca cada una

| Pieza | Ruta | Arranque |
|---|---|---|
| Agenda (MCP + SQLite) | `agenda/mcp_agenda.py`, BD `agenda/agenda.db` | No se arranca: Hermes lo lanza por stdio al iniciar sesión (registrado en `hermes-home/config.yaml` → `mcp_servers.agenda`). Comprobar: `hermes mcp test agenda` → «Tools discovered: 2» |
| Visor de agenda | `agenda/agenda_cli.py` | `python3 agenda/agenda_cli.py [YYYY-MM-DD]` |
| Hermes (cerebro) | `hermes-home/` (SOUL.md actualizado: ordena llamar a `registrar_cita` al confirmar y solo confirmar tras el ok) | Lo invoca el webhook por turno: `hermes chat -Q --continue wa-<telefono> --create-if-missing --source whatsapp -q "<texto>"` |
| Webhook WhatsApp | `whatsapp/webhook.py` | `cd whatsapp && cp .env.example .env` (rellenar) `&& python3 webhook.py` → `http://127.0.0.1:8080/webhook` |
| Simulador (prueba sin Meta) | `whatsapp/simular.py` | `python3 whatsapp/simular.py` con el webhook en marcha |
| Túnel HTTPS (para Meta) | — | `cloudflared tunnel --url http://127.0.0.1:8080` o `ngrok http 8080` → URL pública `https://…/webhook` |

Registro del MCP en Hermes: el alta interactiva (`hermes mcp add`) no sirve en
automatización (descubre las herramientas pero se queda esperando un «Enable
all tools?» en TTY y muere por EOF sin guardar); la entrada quedó escrita
directamente en `config.yaml` (bloque `mcp_servers.agenda`, copia previa en
`config.yaml.bak-h3`), que es exactamente lo que el propio comando guarda.

## Demostración ejecutada (27/10/2026, local, vía nueva completa)

Guion de Carmen (el mismo de H1) enviado como payloads **forma-Meta** al
webhook local (`whatsapp/simular.py`, número simulado 34600000000):

| Turno | Contenido | Latencia Hermes |
|---|---|---|
| 1 | «Hola, buenas tardes» → saludo del salón | 24,9 s (primer turno: arranque de sesión + del MCP) |
| 2 | Pide cejas naturales → recomienda los 3 servicios con precio/duración reales | 8,2 s |
| 3 | Elige Diseño, jueves 17:30, «me llamo Carmen» → presenta resumen y pide confirmación | 11,7 s |
| 4 | «Sí, déjalo confirmado» → **llama a `registrar_cita`** y responde citando el nº de cita | 11,5 s |

Registro creado en `agenda/agenda.db` (verificado con SQL tras la demo):

```json
{"id": 2, "creado_en": "2026-10-27T21:34:47+00:00", "nombre": "Carmen",
 "servicio": "Diseño de cejas", "fecha": "2026-10-29", "hora": "17:30",
 "precio_eur": 18.0, "duracion_min": 25, "estado": "confirmada",
 "origen": "whatsapp", "telefono": null, "notas": null}
```

(El id es 2 porque el 1 fue una fila de humo del propio servidor MCP durante
su prueba de protocolo, borrada después. `telefono` queda nulo: el modelo no
ve el número de la remitente dentro de la sesión CLI de Hermes; el número sí
consta en `whatsapp/logs/webhook.log` junto a cada turno. Si se quiere en la
cita, el webhook puede inyectarlo como contexto en el primer mensaje — mejora
anotada, no necesaria para H3.)

Aviso de latencia: el turno con herramienta tarda ~11,5 s (Spark razona
siempre). Asumible en WhatsApp, pero es el número a vigilar con el canal real.

## Qué falta EXACTAMENTE en el panel de Meta (paso del navegador, cuenta de Lee)

Checklist del `PLAN_WHATSAPP.md` (ruta A). Al terminar, estos cinco valores
van al `.env` de `whatsapp/` (nunca a un repo ni a un chat):

| # | Campo | Dónde se obtiene en el panel | Dónde va |
|---|---|---|---|
| 1 | **URL del webhook** | La genera Aragan: túnel HTTPS → `https://<tunel>/webhook` | Panel: WhatsApp → Configuration → Webhook → Callback URL |
| 2 | **Verify token** | Lo inventa Lee/Aragan (secreto compartido); el `.env.example` trae uno de ejemplo SOLO como formato | Panel: mismo formulario de Webhook · `.env`: `WHATSAPP_VERIFY_TOKEN` (deben coincidir al carácter) |
| 3 | **phone_number_id** | WhatsApp → API Setup: «Phone number ID» del número de prueba (NO es el número visible) | `.env`: `WHATSAPP_PHONE_NUMBER_ID` |
| 4 | **Token de acceso** | WhatsApp → API Setup: «Temporary access token» | `.env`: `WHATSAPP_TOKEN` — ⚠️ caduca a las 24 h (ver riesgos) |
| 5 | **App Secret** | App Settings → Basic → App Secret (botón «Show») | `.env`: `WHATSAPP_APP_SECRET` — sin él no se puede verificar la firma de los POST |

Además, en el mismo panel:
- Suscribir el campo **`messages`** en el webhook (Configuration → Webhook fields).
- Añadir los números destinatarios del número de prueba (máx. 5: Lee,
  Arianna, reservas) en WhatsApp → API Setup → «Manage phone number list» y
  confirmar el código que llega a cada móvil.
- Con eso: mensaje real desde el móvil de Lee → respuesta → cita en
  `agenda.db` = **puerta H3 cerrada del todo**. El paso siguiente (fuera de
  H3) será publicar esa agenda en el panel de Arianna/Supabase del plan.

## Riesgos (los del plan, confirmados sobre esta construcción)

1. **Token temporal de 24 h.** El token de API Setup caduca al día: una demo
   que funcione hoy puede dejar de enviar mañana sin tocar nada. Mitigación
   antes de la entrega: crear un **usuario del sistema** en Meta Business
   Settings, asignarle la app y generar un token permanente con permisos
   `whatsapp_business_messaging` (+ `whatsapp_business_management`). Receta
   de refresco rápido si pilla en directo: regenerar el temporal y cambiar
   una línea del `.env`.
2. **Sin App Secret, los entrantes no son verificables (y en el gateway
   nativo de Hermes dan 503).** Nuestro receptor acepta los POST sin secreto
   (deja aviso en consola y `firma_verificada: null` en la respuesta y el
   log), pero eso significa que cualquiera que descubra la URL del túnel
   podría inyectar mensajes falsos. Con `WHATSAPP_APP_SECRET` puesto, el
   receptor verifica `X-Hub-Signature-256` (HMAC-SHA256) y rechaza con 401
   lo que no firme Meta. **No operar con clientas reales sin el secreto.**
3. **URL de túnel efímera.** cloudflared/ngrok gratuitos cambian la URL al
   reiniciar: si cambia, hay que re-pegarla en el panel o Meta deja de
   entregar. Dejar túnel + webhook + Hermes sin reiniciar durante ensayo y
   entrega.
4. **Surrogate de Baseten sin TTL conocido** (heredado de H1): si un turno
   empieza a devolver 401 del modelo, re-pedir el surrogate y reescribir
   `hermes-home/.env`; el webhook seguirá en pie y solo fallará ese turno.
5. **Número de prueba genérico.** Muestra un número de Meta, no «Ari Vivas
   Beauty», y solo habla con los 5 destinatarios verificados: es la ruta A;
   la B (número real ES + verificación de empresa) corre en paralelo según
   el plan.

## Ficheros creados en esta sesión

- `agenda/mcp_agenda.py` — servidor MCP (registrar/consultar citas) + esquema SQLite.
- `agenda/agenda.db` — la agenda (contiene la cita de la demo, id 2).
- `agenda/agenda_cli.py` — visor humano de la agenda.
- `whatsapp/webhook.py` — receptor (verificación GET, firma HMAC, dedup, sesiones Hermes, envío Graph API o dry-run).
- `whatsapp/simular.py` — simulador de payloads de Meta para probar sin credenciales.
- `whatsapp/.env.example` — plantilla con los 5 campos (verify token de ejemplo marcado como tal).
- `whatsapp/README.md` — arranque, túnel y resumen de pegado en el panel.
- `hermes-home/SOUL.md` — actualizado: la agenda ya es real y se registra con la herramienta al confirmar.
- `hermes-home/config.yaml` — bloque `mcp_servers.agenda` (respaldo: `config.yaml.bak-h3`).
