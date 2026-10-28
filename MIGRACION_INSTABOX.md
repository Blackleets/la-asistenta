# La Asistenta — Migración a InstaBox (28/10/2026)

**Estado: ✅ MIGRADA Y VERIFICADA.** El stack completo corre en la máquina
InstaBox `la-asistenta` (`m_agqyfjnmnvcrrnfraerzrpu5ye`) y el receptor
responde en su URL pública. El pipeline se detiene en un único punto,
esperado y documentado abajo: la llamada al modelo, porque la clave real
de Baseten aún no está en la máquina (la pone Lee; ver «Qué falta»).

## 1. Inventario de la máquina (verificado por exec)

- SO: Debian GNU/Linux 13 (trixie), kernel 6.18.54-instabox, x86_64.
- Python del sistema: 3.13.5 · git, pip3, curl, tar y módulo `venv` presentes.
- Disco persistente `/data`: 20 GiB (tras la migración: 3,8 GiB usados, 16 GiB libres).
- Usuario `user` (HOME=`/data/home`), con sudo sin clave — hizo falta para
  crear `/data/la-asistenta` (la raíz de `/data` es de root) y dejarlo en
  propiedad de `user`.
- El stack ocupa 3,7 GiB en `/data/la-asistenta` (casi todo, el runtime de Hermes).

## 2. Qué quedó instalado y dónde

```
/data/la-asistenta/
├── arrancar.sh            relanza webhook + API de agenda y verifica /salud
├── whatsapp/
│   ├── webhook.py         receptor (idéntico al local, sha verificado en la subida)
│   ├── .env               SOLO MARCADORES (600) — ver §4
│   └── logs/              webhook.log y vistos.json en tiempo de ejecución
├── agenda/
│   ├── mcp_agenda.py      servidor MCP (stdio)
│   ├── agenda_api.py      API de la agenda (puerto 8081)
│   ├── agenda_cli.py      visor
│   └── agenda.db          copia de la agenda local: 4 citas de prueba
│                          (Carmen cancelada; Lucía, Marta y Elena confirmadas)
├── hermes/                clon de NousResearch/hermes-agent en el commit fijado
├── hermes-runtime/        runtime aislado de Hermes (uv + CPython 3.14.9)
├── hermes-home/           HERMES_HOME: config.yaml (rutas adaptadas a /data),
│                          SOUL.md de la recepcionista y .env con marcador (600)
└── run-logs/              salidas y pids de los servicios + hermes-setup.log
```

- **Hermes Agent**: instalado con el método oficial del repo
  (`bash setup-hermes.sh`, con `TAR_OPTIONS=--no-same-owner` como en el
  sandbox) y fijado al **mismo commit que usa el sandbox**:
  `ab094da00f8d492eacc4f9524f938bd9c7c9d9f4`. Launchers en
  `/data/home/.local/bin/hermes`.
- **Subida de ficheros**: se usó la API de ficheros de InstaBox
  (`PUT /v1/machines/{id}/files?path=…&parents=true`), que devuelve el
  SHA-256 de cada fichero; los 7 ficheros subidos coinciden en tamaño con
  los originales locales. Para ello se añadió el subcomando `put` al helper
  del conector (y `timeoutSeconds: 600` en `exec`).

## 3. Verificaciones (evidencia)

| Prueba | Resultado |
|---|---|
| `hermes --version` en la máquina | `Hermes Agent vgit.ab094da (2026.9.24) · stable · Python: 3.14.9 · OpenAI SDK: 2.54.0` — idéntico al sandbox |
| `hermes status` | Model: `meta-models/muse-spark-open-1026` · Provider: `custom:baseten` |
| `hermes mcp test agenda` | Descubre las 3 herramientas: `registrar_cita`, `consultar_citas`, `cancelar_cita` |
| Servidor de humo (http.server, pid 3337) | Matado antes de arrancar el receptor |
| `bash /data/la-asistenta/arrancar.sh` | `webhook: OK (puerto 8080, pid 9281)` · `agenda-api: OK (puerto 8081, pid 9289)` |
| **Salud desde FUERA** | `GET https://8080-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech/salud` → `{"ok": true, "servicio": "la-asistenta-webhook"}` |
| Salud local de la agenda | `{"ok": true, "servicio": "agenda", "bd": "agenda.db"}` |
| POST simulado forma-Meta a `/webhook` (desde dentro) | 200 en modo dry-run; el webhook invocó a Hermes (sesión `wa-34600000001`, latencia 7,05 s) y Hermes falló solo en la llamada al modelo (ver §5) |

## 4. Secretos: ninguno real en la máquina

- `hermes-home/.env` contiene únicamente `BASETEN_API_KEY=PENDIENTE_CLAVE_REAL`.
- `whatsapp/.env` contiene marcadores/vacíos para Meta y Twilio, el puerto
  8080, la URL pública de Twilio ya apuntando a esta máquina
  (`https://8080-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech/twilio/webhook`) y
  las rutas de Hermes en `/data`. Ambos `.env` con permisos 600.
- El token surrogate del sandbox NO se copió (no sirve fuera de él) y no se
  copió ningún `.env` real del proyecto local.

## 5. Dónde se detiene el pipeline sin la clave real (error literal)

El mensaje simulado recorre: URL/receptor → parseo del payload de Meta →
dedup → invocación del CLI de Hermes → creación de la sesión
`wa-34600000001` → restauración del modelo `meta-models/muse-spark-open-1026`
→ **llamada a Baseten, que rechaza la clave marcador**. Salida literal de
Hermes (exit 1):

```
custom rejected your API key, so the model can't be reached. Update it in Settings → Providers, or run `hermes setup` in a terminal.

Provider said: HTTP 403: {"error":"please check the api-key you provided"}
```

El webhook captura ese fallo, anota `error_hermes` en
`whatsapp/logs/webhook.log` y responde a la clienta con el mensaje de
respaldo («Perdona, ahora mismo no puedo responder…»), en modo dry-run.
Nada más falla: en cuanto la clave real esté en `hermes-home/.env`, el mismo
camino debería completar el turno y poder registrar citas en la agenda de
la máquina vía MCP.

## 6. Qué falta EXACTAMENTE para la prueba real extremo a extremo

1. **Clave real de Baseten en la máquina** — Lee la deposita en la bóveda de
   secretos de InstaBox (u otro canal seguro) y se escribe como
   `BASETEN_API_KEY` en `/data/la-asistenta/hermes-home/.env`, sustituyendo
   `PENDIENTE_CLAVE_REAL`. Sin tocar nada más.
2. **Credenciales de Twilio en la máquina** — `TWILIO_ACCOUNT_SID` y
   `TWILIO_AUTH_TOKEN` en `/data/la-asistenta/whatsapp/.env` (hoy vacíos).
   Con ellas, el receptor confirma el webhook al instante y envía la
   respuesta por la API de Twilio.
3. **URL en la consola de Twilio** — pegar
   `https://8080-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech/twilio/webhook`
   en «When a message comes in» del Sandbox (consola clásica; paso aparcado
   por el anti-bots de Cloudflare).
4. **Unión al Sandbox vigente** — `join twilio-trial` al +49 15888 620339
   desde el WhatsApp de Lee (la unión caduca a los 3 días sin actividad).
5. **Máquina despierta** — InstaBox la pausa a los 30 min sin uso y la URL
   no responde mientras duerme (una visita NO la despierta): antes de cada
   prueba hay que despertarla por API/panel y, si hace falta, relanzar los
   servicios con `bash /data/la-asistenta/arrancar.sh`.

Con 1–5: WhatsApp de Lee → Twilio → esta máquina → Hermes/Spark → cita en
`agenda.db` de la máquina, verificable por SQL. Ese es el cierre de la
Ruta C.
