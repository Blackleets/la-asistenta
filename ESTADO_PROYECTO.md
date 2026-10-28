# LA ASISTENTA — Estado del proyecto (punto de recuperación vivo)

> Última actualización: 28/10/2026 ~17:41 (Europe/Madrid) — ejecución autónoma
> de las fases A–E COMPLETADA, canal de WhatsApp/Twilio REPARADO (ver Fase D)
> y guarda de agenda movida al endpoint de la API (ver «Mejora post-fases»).
> Solo quedan bloqueos externos (ver abajo).
> Entrega del hackathon: **04/11/2026 21:00 ET** (05/11 03:00 Madrid).
> ⚠️ Presupuesto Twilio: la cuenta trial tiene **100 mensajes de prueba**;
> no gastar en pruebas internas (las autopruebas del servidor van directas
> a la máquina, sin pasar por Twilio: consumo 0). Reservar para la demo.

## Cómo reanudar el trabajo

1. Lee este fichero y `H0_INFORME.md`.
2. La pila en producción vive en la máquina InstaBox `la-asistenta`
   (`m_agqyfjnmnvcrrnfraerzrpu5ye`) en `/data/la-asistenta/`. Acceso solo por
   el helper: `python3 ~/workspace/custom-connectors/custom.instabox/bin/instabox_api.py exec|put ...`
   (doc en `~/workspace/custom-connectors/custom.instabox/CONNECTOR.md`).
3. La máquina se pausa a los 30 min sin actividad (las visitas a las URL
   públicas de puertos SÍ la despiertan, según la documentación oficial).
   Si no responde: `wake` por el helper y dentro `bash arrancar.sh`
   (copia local: `arrancar.instabox.sh`). Al despertar, los procesos se
   preservan (verificado el 28/10: `processesPreserved: true`).
4. URLs públicas:
   - Webhook: https://8080-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech
   - **Web de la clienta: https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech**
5. NUNCA imprimas valores de secretos: solo nombres de variables y longitudes.
6. Respaldos: `~/workspace/la-asistenta/backups/2026-10-28_pre-autonomo/`
   (local, previo a esta ejecución) y `arrancar.sh.bak-20261028` en la máquina.

## Hitos

- [x] H0 Inspección · repo público · operadora WhatsApp probada en local ·
      app Android v2 · migración a InstaBox · cerebro probado en la máquina ·
      credenciales Twilio cableadas (todo el 27–28/10, ver informes).
- [x] **Fase A — Estabilidad y seguridad** (28/10).
- [x] **Fase B — Web de la clienta** (28/10): construida, desplegada en la
      máquina (puerto 8090 publicado) y con QA visual real a 412×915.
- [x] **Fase C — IA y reservas** (28/10): separación IA/agenda aplicada en la
      web; disponibilidad real, anti-solape y verificación tras escribir.
- [x] **Fase D — Integraciones bloqueadas**: documentadas abajo con evidencia.
- [x] **Fase E — Pruebas y entrega** (28/10): batería E2E 11/11, README nuevo,
      actualización del repo público PREPARADA y auditada (sin push).

## Fase A — qué se hizo y se verificó

- Máquina encontrada **suspendida** (auto-pausa 14:40 UTC); `wake` la dejó
  `running` con los procesos preservados; webhook (8080) y agenda (8081)
  respondiendo en `/salud`.
- Auditoría de secretos SIN valores (nombre = longitud):
  `whatsapp/.env` en la máquina: WHATSAPP_VERIFY_TOKEN=26,
  WHATSAPP_APP_SECRET=32, WHATSAPP_TOKEN=0 (vacío: el canal Meta está
  bloqueado y no se generó token, deliberado), WHATSAPP_PHONE_NUMBER_ID=0,
  TWILIO_ACCOUNT_SID=34, TWILIO_AUTH_TOKEN=32, TWILIO_WHATSAPP_FROM=23,
  TWILIO_WEBHOOK_PUBLIC_URL=68, HERMES_BIN/HOME/RUNTIME_DIR presentes.
  `hermes-home/.env`: BASETEN_API_KEY presente (45; cerebro probado con ella).
- La API de agenda sin token devuelve 401 y con el token de demo responde:
  autenticación verificada. Disco de la máquina: 16 GiB libres.
- Respaldo local previo creado (`backups/2026-10-28_pre-autonomo/`, 176 KB:
  whatsapp/, agenda/, arrancar.sh, config y SOUL de Hermes).
- `arrancar.sh` de la máquina ampliado con la web (8090); respaldo
  `arrancar.sh.bak-20261028` en la propia máquina.

## Fase B/C — la web de la clienta (nueva)

- Código: `web/web_server.py` (stdlib) + `web/index.html` (una sola página,
  mobile-first, identidad LA ASISTENTA: #252533 / #C5B4F2 / #FAF7F2 / #7AB7A7,
  Fraunces + Montserrat locales). Sin tocar las rutas del webhook.
- Flujo: bienvenida con la carta real → **consentimiento informado antes de
  la foto** (con opción de foto de ejemplo autorizada o de saltar la foto) →
  preferencias estructuradas (naturalidad, grosor, arco, tono, intensidad) →
  **análisis REAL con Muse Spark Open vía Baseten** (llamada directa,
  `max_tokens` 4096, salida JSON validada contra la carta; 1 reintento) →
  recomendación honesta (la propuesta visual generada sigue bloqueada: se
  dice en pantalla, sin imágenes falsas) → **reserva en la agenda real**.
- La foto vive solo en memoria durante la petición: no se guarda ni se
  registra. Límites: 6 MB, JPG/PNG/WebP, rate-limit por IP en análisis y
  reservas. Los secretos (Baseten, token de agenda) solo existen en el
  servidor; el navegador nunca los ve.
- Reservas (Fase C): el servidor web calcula huecos desde las citas
  confirmadas de `agenda.db` (horario real L–V 10–20, S 10–14, D cerrado),
  valida el hueco elegido antes de insertar, crea la cita vía la API de
  agenda y **la verifica releyéndola** antes de responder «confirmada».
  Si el hueco se ocupó: 409 con alternativas reales.
- QA visual real (Chromium por CDP en la propia máquina, 412×915, recorrido
  completo con clics): 5 capturas revisadas en `web/qa/` — inicio,
  consentimiento, foto+preferencias, resultado con análisis real y reserva
  con 39 huecos pintados. Sin desbordes ni textos cortados.

## Fase D — integraciones bloqueadas (evidencia)

- **Twilio — CANAL REPARADO (28/10 ~16:50–17:05, chat principal)**: Lee SÍ
  pegó la URL en la consola nueva (Try out WhatsApp → Receive a message →
  Custom → Webhook URL + HTTP POST + Save) y su tráfico real llegó
  (inbounds 15:44/15:48/15:52 UTC verificados en la API de Twilio y en
  `whatsapp/logs/webhook.log`). Hermes respondía bien (3,4–13,2 s) pero
  nadie recibía nada por DOS causas encadenadas: (1) el proceso webhook en
  marcha era anterior a la escritura de las claves de Twilio en el .env
  (no las había cargado); (2) reparado eso, la cuenta **trial rechaza los
  envíos de texto libre por la API REST (error 21654 «ContentSid
  Required»)** y la **Content API no está disponible en trial (20003)**.
  Solución aplicada y verificada: `webhook.py` gana el ajuste
  `TWILIO_REPLY_MODE` y la máquina usa `twiml` (línea en su
  `whatsapp/.env`): la respuesta de Hermes viaja en el TwiML de la propia
  respuesta HTTP del webhook, sin envío por API. Autoprueba con firma
  HMAC idéntica a la de Twilio: **HTTP 200 en 4,51 s con la respuesta
  dentro del TwiML**. Servidor reiniciado con el parche (pid nuevo vía
  `arrancar.sh`). Pendiente SOLO la confirmación con un mensaje real de
  Lee (su sesión ya está caliente: turnos de ~3–5 s, dentro de la ventana
  de 15 s de Twilio). NO revertir webhook.py ni quitar TWILIO_REPLY_MODE.
  Por API sigue siendo imposible configurar el webhook del sandbox
  (0 números configurables): el ajuste vive solo en la consola web.
- **Meta WhatsApp directo**: sin cambios. Bloqueo temporal de permisos de
  la cuenta + límite de portfolios. No se ha reintentado ningún clic.
- **Meta Model API (Muse Image / SAM 3.1)**: sigue sin clave de equipo.
  Lo que falta, exactamente: que Lee abra dev.meta.ai → Billing y confirme
  si el crédito de 150 $ del hackathon está aplicado, y cree una API key
  de equipo guardándola en la bóveda de Muse (nunca en el chat). Con esa
  clave, la primera verificación es `GET /v1/models` y después el
  benchmark de `BENCHMARK_H1.md` (~0,86 $).
- **Consumo de esta ejecución**: 2 llamadas de análisis a Spark sobre el
  crédito de Baseten (1 en la batería de pruebas: 34,28 s, recomendó Brow
  Lamination; 1 en la QA visual: recomendó Diseño de cejas). Coste: céntimos.

## Fase E — pruebas ejecutadas (28/10, contra la máquina real)

Batería `web/pruebas_web.py` — **11/11 en verde**:
carta real (4 servicios) · disponibilidad 29/10 (39 huecos, 10:00–19:30) ·
domingo cerrado · reserva creada y verificada (id 6) · anti-solape
(10:00 y 10:15 bloqueados, 10:30 libre) · doble reserva → 409 con
alternativas · nombre corto → 400 · fecha pasada → 400 · foto inválida →
400 · análisis Spark real validado · limpieza (la cita de prueba quedó
cancelada, no borrada, como marca la semántica del sistema).
Más: `/salud` público de la web verificado desde fuera y QA visual (arriba).

## Errores conocidos / limitaciones reales

- La **API de agenda** ya valida horario y solapes en el propio endpoint
  (mejora del 28/10 ~17:41, ver «Mejora post-fases»): web, app y MCP quedan
  protegidos por la misma regla en el servidor.
- La máquina se pausa a los 30 min: para la demo hay que despertarla antes
  (una visita a la URL pública o `wake` por API) y el ensayo del 02/11 debe
  incluir ese paso. Máximo 8 h seguidas encendida.
- El análisis de Spark tarda ~15–45 s (34,28 s medidos): la web lo declara
  antes de empezar y muestra estado de carga; no hay timeout del cliente
  por debajo de 170 s.
- La unión al sandbox de Twilio caduca a los 3 días sin actividad:
  reenviar `join twilio-trial` en el ensayo y la mañana de la entrega.
- Token de la API de agenda: sigue el de demo en la máquina; cambiarlo
  antes de cualquier uso con clientas reales.

## Mejora post-fases — guarda en el endpoint de la API de agenda (28/10 ~17:41)

- `agenda/agenda_api.py` (`POST /citas`) ahora aplica en el propio servidor
  la guarda que antes solo vivía en el MCP y en la web: **horario del salón**
  (L–V 10–20, S 10–14, domingo cerrado; la cita debe terminar a la hora de
  cierre o antes) y **anti-solape** con intervalos [hora, hora+duración)
  contra las citas 'confirmada' (las canceladas no bloquean). Así la app
  Android, que usa la API tal cual, ya no puede crear solapes ni citas
  fuera de horario. Rechazos: **409 con «alternativas»** (inicios libres en
  rejilla de 15 min, máx. 8), el mismo patrón del servidor web; los errores
  de formato siguen siendo 400.
- **Divergencias encontradas entre MCP y web** (documentadas al unificar):
  1. El MCP `registrar_cita` NO valida horario, solo solape; la web sí.
     La API adopta la semántica horaria de la web.
  2. La web solo OFRECE inicios en rejilla de 15 min; el MCP y la API
     aceptan cualquier HH:MM dentro de la ventana (la rejilla solo se usa
     para calcular las alternativas de los 409).
  3. Fecha en el pasado o a más de 60 días: sigue siendo regla solo del
     flujo web; ni el MCP ni la API la aplican (sin cambios).
  4. El MCP recibe precio/duración del llamante; la API los toma siempre
     de la carta (sin cambios).
  5. La API ahora también rechaza con 400 «fecha no válida» las fechas con
     formato correcto pero inexistentes (p. ej. 31 de febrero), como ya
     hacían la web y el MCP.
- Pruebas: nueva batería `agenda/pruebas_api_guarda.py` — **8/8** en local
  (BD de usar y tirar) y **8/8** contra la máquina real (cita válida 201 →
  solapada 409 con alternativas → borde exacto 12:25 aceptado → fin tras
  cierre entre semana y sábado 409 → domingo 409 → limpieza). La batería
  existente `web/pruebas_web.py` sigue **11/11** tras el despliegue (su
  análisis de Spark tardó 8,57 s en esta pasada). Las citas de prueba
  (ids 7, 8 y la 9 de la batería web) quedaron **canceladas**, no borradas.
- Despliegue: sincronizado a `/data/la-asistenta/agenda/` (SHA-256 idéntico
  al local), reiniciada SOLO la API de agenda (pid 9289 → 49404; webhook
  48241 y web 44618 intactos) y `/salud` verificado en 8080, 8081 y 8090.
  Respaldos: local `backups/2026-10-28_pre-guarda-api/` y en la máquina
  `agenda/agenda_api.py.bak-20261028-guarda`.

## Demo reproducible

1. Despertar la máquina (visita a la URL de la web o `wake` por el helper)
   y, si hace falta, `bash arrancar.sh` dentro.
2. Abrir la web de la clienta y recorrer: consentimiento → foto de ejemplo
   → análisis real → reservar un hueco real → confirmación verificada.
3. En paralelo, la operadora: con la URL de Twilio pegada (pendiente de
   Lee), `join twilio-trial` y conversación que termina en cita en la
   agenda (la misma `agenda.db` que usa la web: la cita se ve en la app).
4. Guion minuto a minuto: `GUION_DEMO.md`.

## Siguiente tarea concreta

1. **Lee**: UN mensaje real al WhatsApp del sandbox para confirmar el
   canal Twilio ya reparado (modo TwiML verificado por autoprueba).
2. **Lee**: Billing de dev.meta.ai + clave de equipo a la bóveda →
   desbloquear H1 visual (benchmark diseñado, ~0,86 $).
3. Chat principal: la actualización del repo preparada en
   `~/workspace/la-asistenta-repo/` es ANTERIOR al parche TWILIO_REPLY_MODE:
   re-sincronizar `whatsapp/webhook.py` en la copia, re-auditar y publicar.
4. ~~Mejora: mover la guarda anti-solape/horario al propio endpoint de la
   API de agenda~~ — **HECHA el 28/10 ~17:41** (ver «Mejora post-fases»).
5. Ensayo general el 02/11 y grabación del vídeo (ver `GUION_DEMO.md`).
