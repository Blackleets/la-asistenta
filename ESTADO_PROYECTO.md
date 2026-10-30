# LA ASISTENTA — Estado del proyecto (punto de recuperación vivo)

> Última actualización: 29/10/2026 ~09:45 (Europe/Madrid) — Fase 2 de la
> Orden Maestra COMPLETADA (ver la última sección: multinegocio con
> aislamiento probado, doble reserva transaccional, idempotencia,
> índices y mediciones reales). Antes, el 29/10 por la mañana: área
> profesional de la dueña y auditoría + sync del repo (c19dd1d).
> — 28/10/2026 ~19:45: ejecución autónoma
> de las fases A–E COMPLETADA, canal de WhatsApp/Twilio REPARADO (ver Fase D),
> guarda de agenda movida al endpoint de la API (ver «Mejora post-fases»),
> la web de la clienta convertida en PWA con sensación de app (ver
> «Iteración PWA»), el análisis hecho asíncrono, inmune al 502 (ver
> «Análisis asíncrono»), las 7 mecánicas de producto integradas (ver
> «Mecánicas tipo marketplace») y la interfaz rehecha en lenguaje de app
> de reservas propio (ver «Interfaz tipo app de reservas»).
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
- La latencia de Spark en Baseten es MUY variable: 12–46 s en las pasadas
  buenas del 28/10 y picos de >150 s (4 trabajos agotaron el timeout en la
  ventana 17:04–17:26 UTC). Desde la corrección asíncrona (ver «Análisis
  asíncrono») un pico ya no produce un 502: el trabajo queda en error
  recuperable con mensaje humano y botón de reintento. El cuello de
  botella es de Baseten, no de la web ni del proxy.
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

## Iteración PWA — la web como app (28/10 ~18:55)

Lee pidió que la experiencia de la clienta «sea más app». Hecho sin tocar
el flujo ni el webhook: la web ahora es una **PWA instalable** con
sensación de app nativa.

- **Instalable**: `web/manifest.webmanifest` (nombre «La Asistenta»,
  standalone, theme/background #252533), `web/icon.svg` propio (arco de
  ceja lavanda sobre carbón índigo con destello verde) e iconos PNG
  generados con `web/generar_iconos.py` (PIL): 192, 512, maskable 512,
  apple-touch-icon 180 y 5 pantallas de arranque de iOS en `web/icons/`.
  Splash Android = manifiesto (fondo de marca + icono); en iOS, las
  `apple-touch-startup-image` enlazadas. Botón «Instalar la app» visible
  solo cuando el navegador ofrece la instalación (y nunca en standalone).
- **Service worker** (`web/sw.js`): caché SOLO del cascarón (portada,
  fuentes, iconos — 11 recursos verificados). `/api/*` va siempre a la
  red: sin conexión la app abre la portada guardada con un **aviso
  honesto** («Sin conexión… el análisis y las reservas necesitan
  internet») y la carta muestra su error real, jamás datos falsos.
- **Sensación app**: barra de navegación inferior fija (Inicio · Análisis ·
  Reservar — solo las vistas reales del flujo; «Mis citas» NO se añadió
  porque no existe fuente real de citas por clienta) con estado activo
  sincronizado, blur, safe-area insets arriba y abajo, objetivos táctiles
  ≥44 px (medidos: nav 61 px, botones 52 px, huecos 44 px), inputs a
  16 px (sin zoom en iOS), esqueleto con brillo al cargar la carta y
  respeto a `prefers-reduced-motion` (animaciones y scroll suave off).
- **Servidor**: rutas NUEVAS en `web_server.py` (`/manifest.webmanifest`,
  `/sw.js`, `/icon.svg`, `/icons/…` con su Cache-Control); las rutas
  existentes no se tocaron. Respaldos: local
  `backups/2026-10-28_pre-pwa/` y en la máquina `*.bak-20261028-pwa`.
  Solo se reinició la web (pid → 50169); webhook y agenda intactos.
- **Pruebas**: `web/pruebas_web.py` sigue **11/11** tras el despliegue
  (análisis Spark real 14,14 s → Diseño de cejas; cita de prueba id=10
  cancelada en la limpieza). Nueva QA `web/qa2/qa2_cdp.mjs` (Chromium CDP
  en la máquina, 412×915): **12/13 evidencias en verde** — manifiesto 200
  y válido, iconos 200, SW registrado/activo/controlando, caché con la
  portada, táctiles y 16 px medidos, nav Reservar con 39 huecos reales,
  nav Análisis recorre consentimiento → foto de ejemplo, offline con
  portada desde caché y aviso visible. Capturas revisadas en `web/qa2/`.
  El único punto no verde es una limitación del Chromium headless, no de
  la app: no acepta emular `(display-mode: standalone)` por CDP
  (matchMedia siguió dando false), así que no hay captura del modo
  standalone; la instalabilidad queda probada por manifiesto + SW +
  iconos, y el splash por los activos enlazados (todos 200).
- **Nota para el repo público**: esta iteración añade ficheros nuevos
  (manifest, sw.js, icon.svg, icons/*.png — binarios: en la publicación
  anterior los binarios se omitieron y se anotaron en el README; decidir
  igual aquí) y toca `web/web_server.py`, `web/index.html` y
  `web/README.md`: incluir en la misma pasada de re-sincronización.

## Análisis asíncrono — inmunidad al «Error 502» (28/10 ~19:25)

- **Diagnóstico (evidencia, no hipótesis)**: Lee vio «Error 502» en la app
  al pulsar «Analizar mis cejas». NO era un fallo de la web: la petición
  síncrona a Spark se disparó a >150 s (a las 16:59 UTC el servidor
  registró `analisis_error TimeoutError` y un BrokenPipe de un cliente que
  ya se había ido) y el **proxy público de InstaBox abandona la petición
  larga**, así que el navegador recibía un 502 sin cuerpo nuestro. La
  latencia de Baseten es variable: 14,14 s a las 16:50 UTC el mismo día.
- **Cambios en `web/`** (sin tocar webhook ni la guarda de agenda):
  1. **Trabajos asíncronos con sondeo**: `POST /api/analizar` valida la
     foto (los 400 se siguen devolviendo al instante), crea un trabajo en
     memoria (id aleatorio, TTL 10 min, limpieza perezosa, un hilo por
     trabajo) y responde **202 {id}** — medido: creación en ≤0,01 s.
     `GET /api/analizar/<id>` devuelve `{estado: en_curso|listo|error}`;
     `listo` trae el mismo payload de siempre; `error` trae un mensaje
     humano. El frontend sondea cada 3 s con progreso honesto («mirando
     tu foto…», segundos transcurridos, aviso de hasta ~2 min) y el
     trabajo en error muestra el mensaje del servidor y el botón pasa a
     «Intentar de nuevo». **Nunca más un «Error 502» en pantalla.**
  2. **Foto más ligera en origen**: el frontend la reduce antes de
     enviarla (canvas, lado mayor ≤1280 px, JPEG 0,85; si ya es pequeña
     va tal cual). La foto de ejemplo: 142.988 B originales.
  3. **Timeouts con criterio**: la llamada a Spark mantiene 150 s, pero
     tras un timeout **NO hay reintento** (nueva excepción `SparkTarda`,
     evento `analisis_timeout` en el log); el único reintento que queda
     es el de siempre: respuesta recibida con JSON no válido.
  4. **Rate-limit intacto** (10 análisis/hora por IP en el POST; el
     sondeo no cuenta) y las validaciones del servidor no cambian.
- **Latencias medidas (28/10, ventana 17:04–17:26 UTC)**: 3 análisis
  completados seguidos por el flujo nuevo — **45,98 s** de servidor
  (52,7 s de pared, QA en navegador, → Diseño de cejas) · **18,09 s**
  (21,0 s de pared, → Brow Lamination) · **16,89 s** (18,0 s de pared,
  → Diseño de cejas) — y la pasada verde de la batería midió **11,99 s**.
  En la misma ventana, 4 trabajos agotaron los 150 s (rachas de Baseten):
  todos terminaron en error recuperable con mensaje humano.
- **Pruebas**: `web/pruebas_web.py` adaptada al flujo asíncrono (POST
  202 + sondeo) y **11/11 en verde** contra la máquina tras desplegar
  (análisis validado, lat=11,99 s; cita de prueba id=13 cancelada).
  QA real `web/qa3/qa3_cdp.mjs` (Chromium CDP, 412×915): **4/4** —
  foto reducida en origen, progreso visible sin 502, resultado real
  pintado y sin códigos crudos; capturas en `web/qa3/` (01-progreso,
  02-resultado). Medidor: `web/qa3/medir_analisis.py`.
- **Despliegue**: respaldos `backups/2026-10-28_pre-async/` (local) y
  `*.bak-20261028-async` (máquina); reiniciada SOLO la web
  (pid 50169 → 51347; tras la batería, un reinicio más para la pasada
  verde final: → 52898). Webhook (48241) y agenda (49404) intactos;
  `/salud` verificado en 8080, 8081 y 8090.
- **Nota para el repo público**: esta corrección toca `web/web_server.py`,
  `web/index.html` y `web/pruebas_web.py` y añade `web/qa3/` — incluir en
  la misma re-sincronización pendiente de la iteración PWA.

## Mecánicas tipo marketplace (28/10 ~19:10) — integradas y verificadas

Siete mecánicas de producto destiladas de una ingeniería inversa (REA,
solo análisis estático) de una app pública de reservas. Son MECÁNICAS
generales: no se copió código, textos ni marca de nadie. Orden de
ejecución por valor/riesgo: 3+1, 2, 6, 5, 4, 7. La lógica compartida vive
en **`agenda/agenda_comun.py`** (nuevo): migración aditiva, código
humano, tokens del enlace, eventos del embudo, lista de espera y texto
post-cita. Lo usan la API y el MCP para comportarse igual por todos los
canales. Respaldos: local `backups/2026-10-28_pre-marketplace/` y en la
máquina `*.bak-20261028-mkt`. Desplegado reiniciando SOLO agenda (pid
54343) y web (pid 54351); el webhook (48241) no se tocó.

1. **Enlace mágico post-reserva — HECHA.** Al crearse una cita (API o
   MCP) se genera un token aleatorio (32 caracteres); en la BD solo se
   guarda su **hash SHA-256** (columna nueva `citas.token_hash`, que la
   API nunca devuelve). Página pública **`/cita/<token>`**
   (`web/cita.html`, servida por el puerto 8090): la clienta ve su cita
   y puede **cancelar** y **reagendar** a otro hueco real (la guarda
   anti-solape/horario vive en la API, excluyendo a la propia cita; la
   cita conserva id y código y el cambio se anota como evento). En
   WhatsApp, `registrar_cita` devuelve `enlace` y `codigo` y el SOUL
   ordena incluir el enlace LITERAL siempre al confirmar; en la web, la
   confirmación muestra el enlace con botón de copiar y «Ver mi cita».
   Corrección asociada: el service worker ya NO cachea navegaciones que
   no sean `/` (la página del enlace es personal; caché v2).
2. **Slots con «ver más» — HECHA.** WhatsApp: herramienta MCP nueva
   **`consultar_disponibilidad`** (huecos reales paginados, por defecto
   5, con `siguiente_desplazamiento`); el SOUL ordena proponer 3–5 horas
   concretas (servicio+fecha+hora explícitos) y ofrecer «ver más
   horarios». Web: la rejilla muestra 8 y «Ver más horarios (N más)»
   despliega el resto (la API sigue devolviendo todos; es presentación).
3. **Confirmación sobre objeto cerrado con código — HECHA con una
   precisión honesta.** Cada cita tiene código humano **AS-XXXX**
   derivado del id (base 31 sin 0/O/1/I/L; inversa incluida: se puede
   cancelar por código en el MCP). Aparece en la confirmación de
   WhatsApp y de la web (grande), en la página del enlace, en
   `GET /citas`, en el CLI y en la bandeja. **Matiz**: el código nace con
   el id, es decir, AL registrar; no puede existir en el resumen previo.
   Por eso el SOUL y la tarjeta «Tu cita» de la web citan el objeto
   COMPLETO (servicio, fecha, hora, precio, duración, nombre) y el «sí»
   confirma ese objeto exacto; el código se entrega en la confirmación
   y es el identificador en adelante.
4. **Lista de espera activa — HECHA con su límite declarado.** Tabla
   `lista_espera`; alta por MCP (`apuntar_lista_espera`), por la API
   (`POST /lista-espera`) y desde la web (tarjeta «¿Sin hueco ese día?»
   cuando la disponibilidad sale vacía). Al CANCELARSE o REAGENDARSE una
   cita, las entradas compatibles (mismo servicio y fecha preferida
   coincidente o sin fecha) pasan a **«por_avisar»**. **LÍMITE**:
   Twilio trial no puede enviar WhatsApp saliente libre (error 21654),
   así que el aviso automático NO existe y nadie lo finge: la cola
   «por_avisar» es visible para Arianna (`GET /lista-espera?estado=
   por_avisar`, `agenda_cli.py --espera`) y, si la clienta escribe,
   Hermes lo sabe: herramienta MCP **`consultar_lista_espera`** por
   teléfono + instrucción en el SOUL de consultarla al abrir la
   conversación y ofrecerle el hueco liberado.
5. **Mini-formulario previo — HECHO.** En la página del enlace: 2
   preguntas propias de cejas (tratamiento reciente — con «cuál y
   cuándo» si lo lleva — y uso de retinol/ácidos) + enlace opcional al
   análisis con foto de la web. Respuestas en `citas.prep` (JSON, con
   fecha), visibles al consultar la cita por la API. Sin fotos nuevas
   por esta vía.
6. **Embudo medido — HECHO.** Tabla `eventos` (ts, tipo, cita_id,
   origen whatsapp|web) con los 7 tipos: hueco_propuesto (consulta de
   disponibilidad por MCP y por la web), reserva_confirmada, cancelada,
   reagendada, lista_espera_alta, cita_cumplida, no_show. Nuevas
   transiciones de estado vía API: `POST /citas/<id>/estado` con
   «cumplida»|«no_show» (solo desde «confirmada»; idempotente si ya está
   en ese estado; 409 desde cancelada o cumplida). Resumen:
   `GET /embudo?desde&hasta` y `agenda_cli.py --embudo`. Instrumentado
   sin cambiar comportamientos visibles (el evento de disponibilidad de
   la web va en un hilo aparte y sus fallos se ignoran a propósito).
   Muestra tras las pruebas del día (cifras de baterías de prueba, no de
   clientas): 51 eventos — hueco_propuesto 16 · reserva_confirmada 14 ·
   cancelada 11 · reagendada 4 · lista_espera_alta 3 · cita_cumplida 3 ·
   no_show 0 (web 50 · whatsapp 1).
7. **Post-cita — HECHA.** Al marcarse «cumplida» se crea en
   `bandeja_salida` un agradecimiento (estado «pendiente»).
   `GET /bandeja` devuelve cada mensaje con su **enlace wa.me de un
   toque** (número de la cita + texto precargado: eso sí funciona hoy,
   lo pulsa Arianna desde su WhatsApp) y `POST /bandeja/<id>/estado`
   marca enviada/descartada. La línea de reseña depende de la constante
   **`RESENA_URL`, vacía por defecto**: no se inventó ninguna URL; sin
   ella el texto omite la reseña. **Pendiente real: la URL de reseñas de
   Arianna** (configurarla por entorno `RESENA_URL` en el arranque de la
   API cuando la dé).

**Migración (solo aditiva)**: columnas `token_hash` y `prep` en citas
(con guarda por PRAGMA) y tablas `lista_espera`, `eventos`,
`bandeja_salida` (IF NOT EXISTS), aplicadas en local y en la BD viva de
la máquina (verificado por PRAGMA: 14 columnas y 5 tablas).

**Pruebas de esta fase** (contra la máquina real):
- Nueva batería `agenda/pruebas_mecanicas.py`: **20/20** (enlace y hash
  que nunca sale, prep, reagendar conservando id/código y 409 con
  alternativas, lista de espera → por_avisar, cumplida → bandeja con
  wa.me y sin reseña inventada, página pública del enlace, embudo).
- Flujo de lista de espera probado entero: alta «esperando» → cancelar
  cita compatible → entrada en «por_avisar» (batería, pasos 9–11) y por
  MCP (alta → cancelar por código → `consultar_lista_espera` dice
  «hay_hueco_liberado»); MCP verificado además en vivo en la máquina
  (6 herramientas; disponibilidad real de Brow Lamination: 36 huecos).
- QA con clics `web/qa4/qa4_cdp.mjs` (412×915): **8/8** — ver cita con
  código, enviar el mini-formulario, reagendar 10:00 → 12:00, cancelar
  y verificar en la agenda que quedó CANCELADA con su prep. Capturas
  `web/qa4/01-cita.png` … `04-cancelada.png`.
- Tras los cambios: `web/pruebas_web.py` **11/11** y
  `agenda/pruebas_api_guarda.py` **8/8**, sin tocar sus expectativas.
- SOUL.md actualizado (disponibilidad real y «ver más», objeto cerrado y
  código, enlace literal al confirmar, lista de espera honesta y
  consulta al abrir conversación, cancelar por código) en local y en la
  máquina.

## Interfaz tipo app de reservas (28/10 ~19:40) — fase final, sobre el mismo web/

Rediseño visual de `web/index.html` con patrones genéricos de apps de
reservas, adaptados a LA ASISTENTA (paleta y fuentes propias, radios
16–24 px, sombras suaves; nada de código, textos, colores ni marca de
terceros). `web/cita.html` ya compartía el lenguaje y hereda el mismo
sistema (tarjetas, píldoras, código grande). Respaldos:
`*.bak-20261028-ui` en la máquina y copia local en
`backups/2026-10-28_pre-marketplace/web/*.pre-rediseno-20261028`.
Desplegado reiniciando SOLO la web (pid 55368).

- **Inicio**: cabecera de marca cálida + servicios como **tarjetas
  ricas** (nombre, descriptor honesto del propio salón, duración en
  píldora, precio y «Reservar →» que entra al flujo con el servicio
  elegido). Sustituye a la lista plana con puntos.
- **Reserva por pasos con progreso visible**: indicador 1 Servicio →
  2 Día y hora → 3 Tus datos (con ✓ en los completados) y **tarjeta
  resumen fija** «TU CITA» (servicio, fecha, hora y precio) pegada
  arriba durante todo el flujo. Paso 1: tarjetas de servicio
  seleccionables. Paso 2: **tira horizontal de días** (14 días: letra +
  número + mes, desplazable; el domingo se ve «cerrado» y no se puede
  elegir) sincronizada con el selector de fecha, y **huecos como
  píldoras** en rejilla con el «Ver más horarios» de la mecánica 2. La
  tarjeta de lista de espera vive en este paso. Paso 3: datos +
  **tarjeta «Tu cita»** completa (servicio, día, hora, duración, precio,
  nombre y fila de código: «Se crea al confirmar», porque el código nace
  al registrar) + confirmación explícita de siempre.
- **Análisis en el mismo lenguaje**: la recomendación es una tarjeta
  con servicio + precio y CTA real **«Reservar este servicio»** que
  entra al paso 2 con el servicio preseleccionado (igual la alternativa).
- **Confirmación**: éxito claro con **código grande**, enlace mágico con
  «Copiar mi enlace» y «Ver mi cita» (abre su página del enlace): solo
  acciones reales.
- **Intocables verificados tras el rediseño**: consentimiento previo a
  la foto, análisis asíncrono con sondeo (QA3 4/4), reserva real
  verificada (batería web 11/11), PWA (manifiesto, SW v2, navegación
  inferior; QA2 12/13 con la única limitación headless ya conocida del
  modo standalone).
- **QA adaptadas (manteniendo su sentido)**: `qa2_cdp.mjs` recorre el
  paso 1 antes de medir huecos y mide solo los huecos VISIBLES (los 9+
  nacen ocultos tras «Ver más»); el resto, sin cambios.
- **QA final de interfaz** `web/qa4/qa5_ui_cdp.mjs`: **16/16** con clics
  a 412×915 y análisis real — capturas revisadas una a una, sin
  desbordes horizontales ni textos cortados: `web/qa4/ui-01-inicio.png`,
  `ui-02-analisis.png`, `ui-03-resultado.png`, `ui-04-reserva-paso1.png`,
  `ui-05-reserva-paso2.png`, `ui-06-reserva-paso3.png`,
  `ui-07-confirmacion.png` (la cita de la QA, AS-AAAZ, quedó cancelada
  en la limpieza). La página mágica: `01-cita.png`…`04-cancelada.png`.

**Nota para la próxima sincronización del repo público** — ficheros
nuevos: `agenda/agenda_comun.py`, `agenda/pruebas_mecanicas.py`,
`web/cita.html`, `web/qa4/` (scripts + capturas PNG: aplicar con las
capturas el mismo criterio de binarios anotado en publicaciones
anteriores). Ficheros modificados: `agenda/agenda_api.py`,
`agenda/mcp_agenda.py`, `agenda/agenda_cli.py`, `web/web_server.py`,
`web/index.html`, `web/sw.js`, `web/qa2/qa2_cdp.mjs`,
`hermes-home/SOUL.md`, este `ESTADO_PROYECTO.md`. Sin cambios:
`whatsapp/webhook.py` (intocable) y `agenda/pruebas_api_guarda.py`.

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

## Interfaz estilo app de reservas v2 (28/10 ~21:00) — la referencia de Lee

Lee mandó la captura exacta de la pantalla de inicio de la app de
referencia (marketplace de reservas) y pidió que el inicio quedara ASÍ
en estructura. Se adaptaron SOLO los patrones de layout (superficie
limpia, tarjetas grandes con foto y radios ~24 px, buscador píldora,
rejilla de accesos, sección «Recomendado», nav de 4 pestañas) con la
identidad intacta de LA ASISTENTA (paleta, Fraunces + Montserrat,
iconos SVG propios): nada de marca, textos, iconos ni fotos de terceros.
Respaldos: local `backups/2026-10-28_pre-ui-v2/web/` y en la máquina
`*.bak-20261028-uiv2`. Desplegado reiniciando SOLO la web (pid 58396);
webhook (48241) y agenda (54343) intactos. SHA-256 local = máquina.

- **Adiós a la banda oscura**: la cabecera global es ahora una barra de
  marca fina (LA ASISTENTA + icono) sobre todas las pantallas. El Inicio
  abre como la referencia: saludo («Hola, estás en el salón» + **Ari
  Vivas Beauty** en Fraunces + el lema) → **buscador píldora** →
  **pastillas** → **Recomendado** → tarjeta de análisis → carta completa.
  SIN fila de ubicación: no hay dirección verificada del salón y no se
  inventó ninguna.
- **Buscador REAL**: filtra en vivo (sin acentos) las tarjetas de
  «Recomendado» y de la carta completa por nombre y descriptor; sin
  coincidencias muestra un aviso honesto con sugerencias; el botón
  «Buscar» desplaza a la carta. Nada decorativo.
- **Pastillas de acceso (5)**: «Análisis IA» (destacada en lavanda,
  abre el recorrido de análisis) y Diseño / Ombré Henna / Laminación /
  Depilación, que preseleccionan ese servicio y entran en Reservar
  directamente en el paso 2 con huecos reales.
- **«Recomendado» con foto**: tarjetas fotográficas grandes (radio
  24 px) de los 3 servicios principales con nombre, descriptor,
  duración y precio REALES de la carta y botón «Reservar» (toda la
  tarjeta es el acceso). Sin insignias falsas: ni estrellas ni
  «Highly Recommended» (no hay datos de valoración).
- **Fotos (Pexels, licencia libre, autoalojadas en `web/img/`,
  1200×800, ≤97 KB cada una; NO son clientas reales)**:
  - `web/img/diseno.jpg` ← Pexels 5178009, Antoni Shkraba: diseño de
    cejas con pinzas, primer plano.
    https://www.pexels.com/photo/person-plucking-woman-s-eyebrow-5178009/
  - `web/img/henna.jpg` ← Pexels 5178001, Antoni Shkraba: aplicación
    de producto con pincel sobre la ceja.
    https://www.pexels.com/photo/woman-in-black-and-white-stripe-shirt-5178001/
  - `web/img/laminacion.jpg` ← Pexels 15046690, Xhemi Photo: cepillado
    de la ceja hacia arriba con spoolie.
    https://www.pexels.com/photo/a-person-applying-makeup-to-a-woman-15046690/
  El servidor web gana la ruta `GET /img/…` (image/jpeg, caché 7 días).
- **Navegación de 4 pestañas reales**: Inicio · Análisis · Reservar ·
  **Contacto** (nueva pantalla: tarjeta con el botón al WhatsApp
  público del salón, wa.me/584249134367 — el que ya constaba en la web —
  y el horario real cargado de `/api/servicios`). Todas con pantalla o
  acción real.
- **Intocables conservados**: la barra `#progreso` sigue SOLO dentro
  del recorrido de análisis (corrección de las 20:15); consentimiento
  previo, análisis asíncrono, reserva por pasos verificada, enlace
  mágico, lista de espera y PWA. El SW sube a **`la-asistenta-shell-v3`**
  (las 3 fotos entran en los EXTRAS del cascarón; network-first para
  `/` y sin cachear `/cita/` ni `/api/`, como antes).

**Pruebas tras el rediseño (contra la máquina real)**:
- Baterías: `web/pruebas_web.py` **11/11** · `agenda/pruebas_api_guarda.py`
  **8/8** · `agenda/pruebas_mecanicas.py` **20/20**.
- **Nueva QA `web/qa5/qa5_cdp.mjs`: 22/22** (CDP 412×915, con clics):
  saludo y buscador presentes, 5 pastillas, 3 tarjetas con la foto
  cargada y datos reales, buscador «henna» deja solo Ombré en ambas
  listas, «zzz» muestra el aviso honesto, borrar restaura la carta,
  pastilla Laminación → paso 2 con 36 huecos, tarjeta de Diseño →
  paso 2, pastilla IA → consentimiento, Contacto con el wa.me exacto
  y el horario real, SW v3 controlando, sin desborde horizontal en
  ninguna pantalla. Capturas revisadas visualmente una a una en
  `web/qa5/` (v2-01…v2-06).
- **QA anteriores SIN adaptar y en verde**: no hizo falta tocarlas —
  sus selectores miden bloques que el rediseño conservó (ids y
  pantallas), así que pasan tal cual, lo que también prueba que los
  flujos no se movieron: `qa4/qa5_ui_cdp.mjs` **16/16** (con análisis
  real → Brow Lamination y reserva AS-AABE cancelada en la limpieza),
  `qa4/qa4_cdp.mjs` (enlace mágico) **8/8**, `qa2/qa2_cdp.mjs` **12/13**
  (el único no verde es la limitación headless ya conocida del modo
  standalone; la caché detectada ya es la v3 con 14 recursos).
- Capturas clave copiadas a `web/icons/` para verlas con un toque:
  `vista-inicio2.png`, `vista-recomendado.png`, `vista-reserva2.png`
  (verificadas 200 en la URL pública).

**Nota para la próxima sincronización del repo público** — ficheros
nuevos: `web/img/` (3 JPG binarios: mismo criterio que los iconos —
anotarlos en el README si se omiten), `web/qa5/` (script + capturas).
Ficheros modificados en esta iteración: `web/index.html`, `web/sw.js`,
`web/web_server.py` (ruta /img/), este `ESTADO_PROYECTO.md`. Sin
cambios: `whatsapp/webhook.py`, la lógica de agenda y `web/cita.html`.

## Corrección 28/10 ~20:15 — barra de progreso solo en el análisis
Lee señaló («Aún tenemos esto») la barra de 4 segmentos visible en Inicio: era el `#progreso` del recorrido de análisis, renderizado sobre todas las pantallas y sin significado fuera de él. Ahora solo se muestra en consentimiento/foto/resultado (toggle en `ir()` + `display:none` inicial); la reserva conserva su propio indicador con etiquetas. Verificado por CDP en la máquina: computed display `none` en Inicio y `flex` en consentimiento (capturas `web/qa4/fix-01-inicio-sin-barra.png` y `fix-02-consentimiento-con-barra.png`). El SW es network-first para `/`, así que los móviles reciben el HTML nuevo sin subir versión de caché. Respaldos: local `backups/2026-10-28_pre-progreso/` y máquina `index.html.bak-20261028-progreso`. Solo se reinició la web (pid 57312); SHA-256 local = máquina.

## Interfaz v3 — espejo de la experiencia de referencia (28/10 ~21:20)

Corrección directa de Lee (21:05): la v2 era «inspirada en» la app de
referencia y no cumplía; esta vez la estructura, las proporciones y el
ritmo visual CALCAN su home pantalla a pantalla, con código, textos,
iconos y fotos nuestros y los datos reales de un solo salón. Respaldos:
local `backups/2026-10-28_pre-ui-v3/web/` y en la máquina
`*.bak-20261028-uiv3`. Desplegado reiniciando SOLO la web (pid 60855);
webhook (48241) y agenda (54343) intactos. SHA-256 local = máquina en
index.html, sw.js, cita.html y img/salon.jpg.

- **Inicio espejo**: fondo blanco; **fila del salón** con pin en círculo
  lavanda + «Ari Vivas Beauty» + chevron (tocarla abre la pantalla del
  salón: acción real; sigue SIN fila de ubicación con dirección: no hay
  dirección verificada y no se inventó); **buscador píldora** con botón
  negro «Buscar» (filtra de verdad, ahora también la tarjeta del salón);
  **rejilla 4×2 de pastillas gris cálido (#F1EDE3)** con iconos de línea
  propios: Análisis IA (destacada en lavanda) · Diseño de cejas ·
  Ombré Henna · Laminación · Depilación · Reservar · **Mi cita** ·
  Contacto — las 8 con acción real; sección **«Recomendado»** que abre
  con la **tarjeta grande del salón** (foto, nombre, chips con hechos:
  «L–V 10–20 · S 10–14» compactado del horario real de la API y «4
  servicios» contado de la carta; sin estrellas ni notas inventadas) y
  sigue con las 3 tarjetas fotográficas de servicios de la v2.
- **Foto nueva**: `web/img/salon.jpg` ← Pexels 7750114, **Max
  Vakhtbovych**: interior luminoso de salón de belleza con espejos de
  aro de luz. https://www.pexels.com/photo/beauty-salon-interior-design-7750114/
  (1200 px, 133 KB, autoalojada; se sirve por la ruta `/img/` existente.
  NO es el salón real: es foto de stock y así se declara en su `alt`.)
- **Pantalla del SALÓN (nueva, `#p-salon`)**: foto cabecera grande,
  nombre en Fraunces, chips de horario/servicios, texto breve y honesto
  (solo hechos: salón de cejas, carta, análisis IA, agenda real), los
  servicios en **filas** (nombre, duración + descriptor, precio y botón
  negro «Reservar» por fila → paso 2 con ese servicio) y la tarjeta de
  contacto con el WhatsApp público y el horario real. Absorbe a la
  antigua pantalla de Contacto, que desaparece como pantalla propia.
- **«Mi cita» (nueva, `#p-micita`)**: al confirmarse una reserva web,
  su enlace+código+datos se guardan en `localStorage` de ESE
  dispositivo (`la-asistenta-cita-v1`); la pantalla los muestra con
  «Abrir mi cita», «Copiar enlace» y «Quitar de este dispositivo». Sin
  reserva guardada, pantalla honesta: explica que el enlace llega al
  confirmar y, si reservó por WhatsApp, que está en la conversación.
  Sin login, sin cuentas: la agenda sigue siendo la fuente de verdad.
- **Reserva reestilizada**: mismos 3 pasos y misma lógica; filas de
  servicio seleccionables (selección en lavanda), pasos completados en
  lavanda, hora elegida en lavanda, botones principales negros anchos
  («Confirmar reserva» y «Reservar este servicio» pasan de verde a
  negro carbón). La tarjeta resumen «TU CITA» ya era negra.
- **Confirmación**: check grande, datos, código AS-XXXX, botón negro
  «Ver mi cita» + «Copiar mi enlace» y nota de que la cita queda en la
  pestaña «Mi cita» de este dispositivo.
- **Nav inferior de 4, nueva**: **Inicio · Buscar · Reservar · Mi
  cita**. «Buscar» es una acción real (sube al inicio y enfoca el
  buscador). El análisis deja de ser pestaña (vive en la pastilla
  Análisis IA y en la tarjeta del inicio); sus pantallas ya no
  encienden ninguna pestaña. Activa y seleccionados en lavanda.
- **Lenguaje visual**: blanco de fondo, negro carbón para botones y
  texto, lavanda SOLO como acento (activa, seleccionado, chips,
  detalles), Montserrat en toda la UI y **Fraunces solo en el nombre
  del salón/marca** (nombre del salón y lema en cursiva). Radios
  16–24 px y sombras muy suaves, como la referencia.
- **Intangibles conservados**: `#progreso` solo dentro del análisis;
  consentimiento previo; análisis asíncrono con sondeo; reserva real
  verificada; enlace mágico; lista de espera; mini-formulario. El SW
  sube a **`la-asistenta-shell-v4`** (añade /img/salon.jpg al cascarón;
  network-first para `/`, sin cachear `/cita/` ni `/api/`).
  `web/cita.html` hereda el acento: su hora seleccionada al reagendar
  pasa a lavanda (su QA sigue 8/8 sin tocar el script).

**Pruebas tras la reconstrucción (contra la máquina real)**:
- Baterías: `web/pruebas_web.py` **11/11** (análisis real 12,31 s) ·
  `agenda/pruebas_api_guarda.py` **8/8** · `agenda/pruebas_mecanicas.py`
  **20/20**.
- **Nueva QA comparativa `web/qa6/qa6_cdp.mjs`: 29/29** (CDP 412×915,
  con clics y lista de cotejo contra la referencia): orden de bloques
  medido por coordenadas (fila del salón < buscador < rejilla <
  recomendado), botón «Buscar» negro carbón rgb(37,37,51), rejilla de
  8 pastillas en 4 columnas × 2 filas en gris cálido rgb(241,237,227),
  tarjeta del salón con foto cargada y chips exactos («L–V 10–20 ·
  S 10–14», «4 servicios»), buscador ocultando también la tarjeta del
  salón, salón con 4 filas con botón Reservar y WhatsApp exacto, fila
  → paso 2 con 36 huecos, nav Buscar dejando el foco en #inp-buscar,
  «Mi cita» vacía honesta, **reserva completa real** (Diseño, 29/10
  10:00, código AS-AABN) → confirmación coherente → la cita aparece en
  «Mi cita» desde localStorage → limpieza: cita cancelada (id 42).
  Capturas revisadas visualmente una a una en `web/qa6/`
  (01-inicio … 07-micita), sin desbordes.
- **QA anteriores**: `qa4/qa4_cdp.mjs` (enlace mágico) **8/8** sin
  tocar; `qa4/qa5_ui_cdp.mjs` (interfaz) **16/16 SIN adaptar** — sus
  selectores (tarjetas, pasos, tira, confirmación) sobreviven al
  reestilizado, con análisis real y reserva AS-AABP cancelada;
  `qa2/qa2_cdp.mjs` **12/13** con UNA adaptación documentada en el
  propio script (el tramo «nav Análisis» pasa a la pastilla Análisis
  IA, porque el análisis ya no es pestaña; el único no verde sigue
  siendo la limitación headless del modo standalone). `qa5/qa5_cdp.mjs`
  (la QA de la v2) queda **retirada**: sus evidencias (buscador,
  pastillas, recomendado, contacto, SW) viven en qa6 ampliadas.
- Capturas clave copiadas a `web/icons/` para verlas con un toque
  (verificadas 200 en la URL pública): `vista-inicio3.png`,
  `vista-salon.png`, `vista-reserva3.png`.

**Nota para la próxima sincronización del repo público** — ficheros
nuevos: `web/img/salon.jpg` (binario: mismo criterio que el resto de
fotos), `web/qa6/` (script + capturas). Modificados: `web/index.html`,
`web/sw.js`, `web/cita.html` (un acento), `web/qa2/qa2_cdp.mjs`
(adaptación documentada), este `ESTADO_PROYECTO.md`. Sin cambios:
`whatsapp/webhook.py`, la lógica de agenda y `web/web_server.py`.

## Imágenes reales del salón + iconos Lucide (28/10/2026, noche)

Corrección de Lee: las fotos de stock de Pexels «están mal» y los
iconos dibujados a mano «dan lástima». Sustituidos ambos frentes,
solo en `web/`, protegiendo lo demás (respaldo
`backups/2026-10-28_pre-reales-lucide/` en local y
`*.bak-20261028-reales` + `img.bak-20261028-reales/` en la máquina).

- **Imágenes: TODAS de la propia web del salón** (regla de la casa:
  la app de un cliente usa LAS imágenes de ese negocio), tomadas de
  **https://arivivasbeauty.com/reserva-tu-experiencia** y de la
  portada, comprimidas a JPEG ≤200 KB y autoalojadas en `web/img/`
  con los mismos nombres que tenían las de Pexels (las referencias
  no cambian):
  - `salon.jpg` (1023×1537 → 151 KB) ← la foto principal de la
    página de reservas: Arianna diseñando las cejas de una clienta
    bajo el aro de luz.
    Origen: `https://arivivasbeauty.com/wp-content/uploads/2026/07/666B0A72-3D84-4C3D-BB11-946C05AEB63C.png`
  - `diseno.jpg` (720×1280 → 142 KB) ← clienta con las cejas
    diseñadas y definidas.
    Origen: `https://arivivasbeauty.com/wp-content/uploads/2026/09/photo_2026-09-25_18-07-43.jpg`
  - `henna.jpg` (720×1280 → 188 KB) ← clienta con el tinte aplicado,
    efecto maquillaje (en su web el fichero se llama «tinte»).
    Origen: `https://arivivasbeauty.com/wp-content/uploads/2026/10/tinte.jpg`
  - `laminacion.jpg` (1200×960 → 181 KB) ← primer plano de cejas
    laminadas, peinadas hacia arriba.
    Origen: `https://arivivasbeauty.com/wp-content/uploads/2026/08/photo_2026-08-15_22-07-34.jpg`
  - `lounge.jpg` (1100×1100 → 193 KB, NUEVA) ← su rincón «The
    Lounge» con el cartel y las tazas de la marca; ilustra el bloque
    The Lounge de la pantalla del Salón y la tarjeta del vídeo del
    tour.
    Origen: `https://arivivasbeauty.com/wp-content/uploads/2026/07/photo_2026-07-25_23-49-53.jpg`
  - **Depilación: sin foto.** En la página del salón no hay ninguna
    imagen de depilación/cera válida; no se fuerza ninguna (la
    pastilla y la fila funcionan sin tarjeta fotográfica, como ya
    era en la v3: solo 3 servicios tienen tarjeta en «Recomendado»).
  - Los textos alternativos ahora describen las fotos reales. El SW
    sube a **v5** (`la-asistenta-shell-v5`, añade `/img/lounge.jpg`)
    para que ningún dispositivo se quede con las fotos viejas en
    caché. Las referencias a Pexels desaparecen de `index.html` y
    del docstring de `web_server.py`.
- **Iconos: biblioteca Lucide** (https://lucide.dev, licencia
  **ISC**, paquete `lucide-static` v0.469.0 vía jsdelivr), SVG
  oficiales inlineados, trazo uniforme **2** con extremos redondos
  y tamaños por contexto (pastillas 27 px, nav 24 px):
  Análisis IA = `sparkles` · Diseño de cejas = `pencil-ruler` ·
  Ombré Henna = `droplet` · Laminación = `layers` · Depilación =
  `zap` · Reservar = `calendar-check` · Mi cita = `ticket` ·
  Contacto = `message-circle` · Buscar = `search` · pin =
  `map-pin` · chevron = `chevron-down` · Inicio = `house` · check
  de confirmación y de tarjeta seleccionada = `check` · reproducir
  = `play` · cerrar = `x` · cita textual = `quote`. Los 16 SVG a
  mano anteriores ya no existen; todos los nombres usados existen
  en Lucide, sin equivalentes forzados.
- **Vídeos del salón (TikTok)**: cuenta oficial
  **@arivivasbeauty** (enlazada desde la propia arivivasbeauty.com;
  confirmada también por Lee). Sección «Vídeos» en la pantalla del
  Salón + acceso «Ver vídeos de sus trabajos en TikTok» en Inicio:
  5 tarjetas con foto real del salón como miniatura que abren un
  modal con el **reproductor oficial embebido** de TikTok
  (`https://www.tiktok.com/embed/v2/<id>`) y botón «Abrir en
  TikTok». **El embed PASÓ el QA**: la captura del modal muestra el
  reproductor oficial con el vídeo cargado. No se descarga ni se
  realoja ningún vídeo. Vídeos elegidos (prioridad cejas):
  - `7692179415891070229` — «Bienvenidas a mi Home Studio» (el más
    visto, ~11,9 mil reproducciones):
    https://www.tiktok.com/@arivivasbeauty/video/7692179415891070229
  - `7700590054648925461` — «Técnicas y resultados reales» (el más
    reciente): https://www.tiktok.com/@arivivasbeauty/video/7700590054648925461
  - `7690387352631446804` — «Mis trabajos en Madrid»:
    https://www.tiktok.com/@arivivasbeauty/video/7690387352631446804
  - `7687377779133779221` — «Resultados que hablan por sí solos»:
    https://www.tiktok.com/@arivivasbeauty/video/7687377779133779221
  - `7687338935386672405` — «Tour por The Lounge»:
    https://www.tiktok.com/@arivivasbeauty/video/7687338935386672405
- **Reseñas reales**: sección «Lo que dicen sus clientas» con 3
  testimonios **citados tal cual** del carrusel de testimonios
  publicado en la propia tienda de Arianna (páginas de producto de
  Henna Menela, verificados en vivo el 28/10):
  https://arivivasbeauty.com/producto/kit-henna-menela-25-gr-fijador-de-15ml/
  y https://arivivasbeauty.com/producto/kit-6-tintes-menela/.
  Autoras (en la app solo el nombre de pila): **María Gonzales**,
  **Carmen López** e **Isabel Sanchez**. Matiz honesto: hablan de
  sus PRODUCTOS Henna Menela (kits y tinte que vende la tienda), no
  del servicio presencial; la sección lo atribuye a «su propia web»
  sin inventar estrellas ni contadores. No se localizó ficha de
  Google con reseñas del salón.
- **Verificación**: baterías web **11/11**, guarda **8/8**,
  mecánicas **20/20**; **QA7 nueva** (`web/qa7/qa7_cdp.mjs`, la QA6
  adaptada + bloque propio: foto real de 1023 px cargada, trazo
  Lucide calculado = 2 px en pastillas/nav/buscador, 5 tarjetas de
  vídeo, clic real que abre el modal con el embed oficial y su
  cierre, 3 reseñas literales, The Lounge, check de Lucide en la
  confirmación, SW v5 y reserva completa AS-AABX cancelada):
  **38/38 en verde**. Capturas revisadas una a una (inicio con los
  iconos y la foto real, salón, vídeos, reseñas, modal con el
  reproductor de TikTok funcionando). Clave en `web/icons/`:
  `vista-inicio4.png` y `vista-salon2.png`. Solo se reinició la web
  (pid 63204); webhook y agenda intactos.

**Nota para la próxima sincronización del repo público**
(actualizada) — incluye todo lo pendiente de las notas anteriores
(mecánicas, PWA/async, v3) y suma de esta iteración: modificados
`web/index.html`, `web/sw.js` (v5), `web/web_server.py` (solo la
doc), `web/qa7/qa7_cdp.mjs` (nuevo, sin capturas); sobrescritos
`web/img/diseno.jpg`, `web/img/henna.jpg`, `web/img/laminacion.jpg`,
`web/img/salon.jpg` y nuevo `web/img/lounge.jpg` (binarios: mismo
criterio que los iconos); nuevas capturas `web/icons/vista-inicio4.png`
y `web/icons/vista-salon2.png`; este `ESTADO_PROYECTO.md`. Sin
cambios: `whatsapp/webhook.py`, la lógica de agenda y `web/cita.html`.


## Reconstrucción v4 contra espec (28/10/2026, noche) — brechas de la §4 cerradas

Lee revisó la `ESPEC_REFERENCIA.md` y dio el «arranca». Se cierran las
cuatro brechas de la tabla de cobertura §4 sin romper nada de lo que
funcionaba. Respaldos previos en local (`backups/2026-10-28_pre-v4/`) y
en la máquina (`*.bak-20261028-v4`). Despliegue con SHA-256 idéntico;
se reiniciaron SOLO la agenda (pid 65393) y la web (pid 65401); el
webhook (pid 48241) ni se tocó. SW a **v6** (`la-asistenta-shell-v6`).

### 1 · Selección múltiple de servicios con total (pack)

- **Modelo**: UNA cita por reserva. El campo `servicio` guarda el
  nombre legible «A + B» (orden de carta); `precio_eur` y
  `duracion_min` son las SUMAS de la carta; la guarda (horario y
  anti-solape) trabaja con la duración total; los componentes quedan
  escritos en `notas` («Pack: Diseño de cejas (18 € · 25 min) + Brow
  Lamination (45 € · 65 min)»), antes de la nota de la clienta y de la
  marca «[reserva web]».
- **Contrato extendido de forma compatible** (un servicio sigue
  exactamente igual):
  - Agenda `POST /citas`: acepta además `servicios: [nombres]`
    (valida cada uno contra la carta, sin duplicados; precio y
    duración se calculan en el servidor, nunca del cliente).
    `fila_a_cita` compone la `precio_etiqueta` del pack desde el
    total guardado («63 €»; si algún componente es «a consultar»:
    «45 € + a consultar» — nunca un parcial disfrazado de total).
  - Web `POST /api/reservar`: acepta `servicios` (y sigue aceptando
    `servicio`); la disponibilidad previa se calcula con la duración
    total; el 409 de la guarda de la agenda ahora se traslada como
    409 con sus alternativas, no disfrazado de 400.
  - Web `GET /api/disponibilidad`: acepta `?servicios=A,B` y devuelve
    los inicios libres para la duración sumada (de la carta).
  - Reagendar un pack funciona: los huecos del enlace mágico se
    calculan con la `duracion_min` guardada en la cita (la total);
    para un servicio suelto el resultado es idéntico al de antes.
  - Lista de espera: el alta sigue siendo por servicio (el principal
    de la selección); al cancelar o reagendar un pack, las entradas
    compatibles de CADA componente pasan también a «por_avisar».
  - Embudo: el pack entra como el mismo evento `reserva_confirmada`
    (la tabla `eventos` no tiene columna de detalle y `/embudo` no se
    toca; el detalle de componentes vive en `citas.notas`).
  - **Hermes/WhatsApp sigue reservando de uno en uno** (fuera de
    alcance, como se acordó): el MCP no se ha tocado.
- **Superficies**: paso 1 con tarjetas que añaden/quitan (✓ lavanda);
  filas del salón con botón circular +/✓ de 44 px y barra inferior
  fija con contador («2 servicios»), total («63 € · 90 min en
  total») y CTA negro «Reservar ahora»; barra «TU CITA» con la lista
  y el total; paso 3 como objeto cerrado: una línea por servicio
  (nombre · duración · precio), fila TOTAL, duración total, y campo
  nuevo de notas opcionales para el salón. Los accesos de un servicio
  (pastillas, tarjetas de «Recomendado», análisis) siembran la
  selección con ese servicio y saltan al paso 2, como antes.

### 2 · Hora como la referencia: calendario de mes + lista con radios

- Paso 2 nuevo: **calendario de MES navegable** (anterior/siguiente
  dentro de la ventana hoy…+60 días; pasados, domingos y días fuera
  de ventana deshabilitados; hoy marcado con un punto; elegido =
  círculo relleno). Sustituye a la tira de 14 días y al input de
  fecha (la fecha elegida sigue viviendo en `#inp-fecha`, oculto).
- Los huecos del día son una **lista con radios**: fila de ≥52 px
  por inicio libre real (hora, precio total de la selección y radio
  a la derecha); los ocupados sencillamente no aparecen, porque la
  lista sale de la agenda. «Ver más horarios (N más)» conserva el
  contador, como pide la §5.
- Fechas compuestas en hora LOCAL (`isoLocal`): `isoFecha` es UTC y
  a medianoche local habría desplazado el día del calendario.

### 3 · «Añadir al calendario» (.ics) real, en cliente

- Generador .ics en el navegador (sin servidores nuevos), en la
  **confirmación** y en la **página del enlace mágico** (solo si la
  cita está confirmada): VEVENT con inicio = fecha+hora, fin =
  inicio + duración real (la sumada si es pack), título «Ari Vivas
  Beauty — <servicio>» y el código AS-XXXX en la descripción (en la
  confirmación, también el enlace personal). Hora local flotante,
  como exportan la mayoría de calendarios.
- QA8 descargó AMBOS .ics y verificó su contenido (DTSTART/DTEND
  exactos: 2026-11-06 17:00→18:30 para el pack de 90 min, salón,
  nombre del pack y código).

### 4 · Tokens según la §5 (medidos en QA8)

Buscador: contenedor **radio 16**, alto 78 px, botón negro DENTRO
(56 px). Pastillas: caja **88 px**, radio **16**, etiqueta **13 px**.
Carrusel «Recomendado»: tarjeta al **80,3 %** del ancho con asomo de
la siguiente (base flex 88 % del contenido: el % sobre el contenedor
con márgenes daba 74,8 % de pantalla; corregido y remedido). Tarjetas
de foto a radio 16. Botones `.btn` a píldora (999). Títulos de
sección a 22 px; nombre del salón a 28 px. Hero del salón con
botones flotantes circulares (volver y compartir REAL vía Web
Share/portapapeles). Filas de hora ≥48 dp (52 medidos).

### Veredicto por pantalla (cotejo §5, QA8)

| Pantalla espec | Veredicto | Notas |
|---|---|---|
| P1 Inicio | **CUBIERTA** | Desviaciones de marca: fondo de pastilla gris cálido `#F1EDE3` (no `#f5f5f5`); activa de nav = carbón + punto lavanda (no relleno violeta: legibilidad y marca). Siguen sin existir: insignias y segundo campo de ubicación (no hay datos: no se inventan). |
| P2 Buscar | PARCIAL por diseño | Sin cambios v4: es el buscador que filtra en Inicio (un solo salón). |
| P3 Resultados | NO APLICA | Multi-salón. |
| P4 Salón | **CUBIERTA** | Sin chips de categoría (los 4 servicios son de cejas; la propia espec los llama marginales) y sin insignias de reseñas integradas (sin datos públicos enlazados). Compartir real en vez de marcador. |
| P5 Servicios | **CUBIERTA** | Paso 1 + filas del salón, ahora con selección múltiple y total (era la brecha). |
| P6 Equipo | NO APLICA | Una sola profesional. |
| P7 Fecha/hora | **CUBIERTA** | Desviación: día seleccionado en lavanda `#C5B4F2` con número en carbón (marca + contraste) en vez de violeta `#6950f3` con blanco. Descuentos: no aplican (sin datos). |
| P8 Revisión | **CUBIERTA** | Objeto cerrado con líneas + TOTAL + aviso de cambio/cancelación sin coste + notas opcionales. Matices: el botón «Confirmar reserva» no repite el importe en su texto (el TOTAL está en la tarjeta y en la barra «TU CITA» siempre visible); no se pide email (sin cuentas: enlace mágico + teléfono opcional). |
| P9 Confirmación/gestión | **CUBIERTA** | .ics en confirmación y en enlace (contenido verificado), chip «Confirmada», gestión a ≤2 toques, líneas por componente + total, recuperable en «Mi cita». Sigue en pantalla completa (no hoja inferior) y sin «Cómo llegar» (dirección sin verificar: no se inventa). |
| P10 Historial | PARCIAL por diseño | Sin cambios: «Mi cita» local con la última cita; sin cuentas. |

### Verificación (todo contra la máquina real)

- Baterías: **web 19/19** (las 11 comprobaciones de siempre SIN tocar
  + 8 nuevas de pack: disponibilidad sumada, reserva única con
  totales, guarda con duración total, componentes en notas, pack por
  la API y 400 a componente inventado; corrida dos veces: tras el
  despliegue y tras el ajuste del carrusel) · **guarda 8/8** ·
  **mecánicas 20/20**, ambas con sus ficheros intactos.
- **QA8 comparativa NUEVA** (`web/qa8/qa8_cdp.mjs`): **41/41** a
  412×915 con clics reales. Recorrido completo: pack Diseño +
  Lamination desde las filas del salón → barra con «63 € · 90 min» →
  calendario a noviembre → 06/11 17:00 en la lista con radios →
  paso 3 con líneas y TOTAL → confirmación AS-AAB8 → .ics
  descargado y verificado → la cita en la agenda con 90 min y 63 €
  y el pack en notas → **cancelada en la limpieza**. La QA7 queda
  superada por la QA8 (apuntaba a los contenedores pre-carrusel).
- Capturas QA8: `web/qa8/qa8-01-inicio.png` … `qa8-08-paso1-pack.png`.
  Clave para Lee en `web/icons/` (verificadas con 200 en la URL
  pública): `vista-v4-inicio.png`, `vista-v4-pack.png` (paso 3 con
  el total) y `vista-v4-hora.png` (calendario de mes).

**Nota para la próxima sincronización del repo público** (suma a las
anteriores): modificados `agenda/agenda_api.py` (pack + etiqueta +
huecos por duración guardada), `web/web_server.py` (disponibilidad y
reserva con pack, traslado del 409), `web/index.html` (selección
múltiple, calendario, radios, .ics, carrusel y tokens),
`web/cita.html` (.ics), `web/sw.js` (v6), `web/pruebas_web.py`
(ampliada a 19) y este `ESTADO_PROYECTO.md`; nuevo
`web/qa8/qa8_cdp.mjs` (sin capturas) y capturas
`web/icons/vista-v4-inicio.png`, `web/icons/vista-v4-pack.png`,
`web/icons/vista-v4-hora.png`. Sin cambios: `whatsapp/webhook.py`,
`agenda/agenda_comun.py`, `agenda/mcp_agenda.py`,
`agenda/pruebas_api_guarda.py`, `agenda/pruebas_mecanicas.py`.

---

## Paleta de la referencia (v5 · 28/10, orden directa de Lee)

Lee: «su misma paleta de colores, la de su web». Se acabaron las tres
desviaciones de color documentadas en la v4: la interfaz adopta
ÍNTEGRA la paleta MEDIDA de fresha.com (ESPEC_REFERENCIA §1.1). El
remapeo se hizo por ROL sobre `web/index.html` y `web/cita.html`
(variables CSS renombradas: `--carbon/--lavanda/--fondo/--verde*` →
`--negro/--violeta/--blanco/--positivo`), más `manifest.webmanifest`
y `sw.js`. Webhook y agenda sin tocar.

### Tabla viejo → nuevo (por rol)

| Rol | Antes (marca v1–v4) | Ahora (referencia, espec §1.1) |
|---|---|---|
| Primario / seleccionado / foco / enlaces | Lavanda `#C5B4F2` | Violeta `#6950f3` |
| Día elegido (calendario) | Lavanda, número carbón | Violeta `#6950f3`, número blanco |
| Radio de hora elegida | Anillo y punto carbón | Anillo y punto `#6950f3` |
| Servicio elegido (borde, botón +/✓, segmentos, hueco) | Lavanda / carbón | Violeta `#6950f3`, marcas blancas |
| Botones de conversión (Buscar, Reservar, Confirmar, código) | Carbón `#252533` | Negro `#0d0d0d` (hover `#262626`) |
| Pestaña activa de la nav | Carbón + punto lavanda | Icono RELLENO y etiqueta en `#6950f3`; punto eliminado |
| Pastillas de categoría | Gris cálido `#F1EDE3` | `#f5f5f5` |
| Bordes (tarjetas, buscador, filas) | `#E7DFD2` | `#dee3e7` |
| Fondo de pantalla | Blanco cálido `#FAF7F2` | Blanco `#ffffff` |
| Texto principal | `#2B2B36` | `#0d0d0d` |
| Texto secundario / placeholder / deshabilitado | `#6E6E7E` / `#9A9AA8` / `#C6C6CF` | `#747a8d` / `#a4adba` / `#bfbfbf` |
| Positivo (confirmada, tick, OK) | Verde marca `#7AB7A7` / `#3E7C6B` | `#1f8900` |
| Error | `#B3402E` | `#bb1232` |
| Primario oscuro (texto de chips sobre tinte) | — | `#403591` |
| theme-color (manifest + meta) | `#252533` | `#ffffff` (y `background_color`) |

### Tintes derivados (documentados, no medidos: se derivan del token)

- `--violeta-tinte #F0EDFE` = `#6950f3` al 10 % sobre blanco: fondo de
  la pastilla destacada, chips de datos/duración, pin del salón.
- `#F9F8FE` = `#6950f3` al 4 %: fondo de la fila/tarjeta elegida y
  degradado de la tarjeta de análisis.
- `--violeta-claro #BCB0F9` = `#6950f3` aclarado al 55 %: SOLO texto
  o acento sobre negro (marca y cursiva de la cabecera de cita.html,
  etiqueta «TU CITA» de la barra resumen).
- Aviso `#FAF3EE`/`#E9CDB6`/`#b7570b` · Error `#FBF1F3`/`#EEC4CC`/
  `#bb1232` · OK `#EDF6EB`/`#BCDCB3`/`#1f8900`: fondo/borde/texto
  como tintes de los tokens semánticos de la espec.
- Sombras y veladuras: base neutra `rgba(13,13,13,…)` (antes
  `rgba(37,37,51,…)`).

### Única desviación consciente que queda

La tipografía: se quedan Fraunces/Montserrat. Roobert es la fuente
propietaria de Fresha y no se extrae; la orden de Lee era de colores.
El icono de la app (`icon.svg` y PNG: fondo carbón, arco lavanda,
estrella verde) NO cambia: es la marca de La Asistenta, no un control
de la interfaz.

### Verificación (contra la máquina real; solo se reinició la web, pid 67466)

- Baterías: **web 19/19 · guarda 8/8 · mecánicas 20/20**, ficheros
  sin tocar.
- **QA9 NUEVA** (`web/qa9/qa9_cdp.mjs`): **27/27** a 412×915. No
  opina: muestrea con `getComputedStyle` y afirma los hex exactos —
  botón principal `rgb(13,13,13)`, día elegido `rgb(105,80,243)` con
  número blanco, radio elegida (anillo y punto) `rgb(105,80,243)`,
  pastilla `rgb(245,245,245)`, borde de tarjeta `rgb(222,227,231)`,
  nav activa con `fill` y `stroke` `rgb(105,80,243)` y el punto
  eliminado, theme-color `#ffffff`, shell v7. Recorrido completo con
  reserva real (pack AS-AACM) y página del enlace; la cita quedó
  CANCELADA en la limpieza. Capturas `web/qa9/qa9-01…05` revisadas
  una a una; clave para Lee en `web/icons/`: `vista-v5-inicio.png`
  y `vista-v5-reserva.png` (200 en la URL pública).
- Respaldos: local `backups/2026-10-28_pre-paleta-v5/` y máquina
  `*.bak-20261028-v5`; SHA-256 local = máquina en los 4 ficheros.

**Nota para la próxima sincronización del repo público** (suma a las
anteriores): modificados `web/index.html`, `web/cita.html`,
`web/manifest.webmanifest`, `web/sw.js` (v7) y este
`ESTADO_PROYECTO.md`; nuevo `web/qa9/qa9_cdp.mjs` (sin capturas) y
capturas `web/icons/vista-v5-inicio.png`,
`web/icons/vista-v5-reserva.png`. Sin cambios: `whatsapp/webhook.py`,
todo `agenda/`, `web/web_server.py`, `web/pruebas_web.py`.

---

## v6 — anatomía exacta de la referencia (28/10/2026, tras la comparación del principal)

Lee (22:55): «Esa app no es la misma de fresha jamaaaaassssss». El
agente principal comparó visualmente `referencia/01-home.png` (captura
real de la app de Fresha en el móvil de Lee) con nuestra home y tenía
razón: la v3–v5 se INSPIRABA en la estructura, pero la anatomía fina
no era la misma. La v6 cierra, elemento a elemento, las 6 diferencias
verificadas en esa comparación. Solo `web/index.html` (+ bump del SW
a shell **v8**); funcionalidad intacta: baterías **web 19/19 · guarda
8/8 · mecánicas 20/20** con el código final desplegado.

### Tabla de cierre de diferencias

| # | Diferencia (referencia → v5) | Cierre v6 | Verificación QA10 |
|---|---|---|---|
| 1 | Barra de marca «LA ASISTENTA» + icono arriba | Eliminada del DOM. La home arranca con la fila ligera: pin `map-pin` de Lucide RELLENO en `#6950f3` con centro blanco (sin círculo de fondo) + «Ari Vivas Beauty» en peso **400** + chevron; abre el salón, como la suya abre la ubicación | `.topbar` ausente; fila a `top=14px` (lo primero de la pantalla); `fill` del pin `rgb(105,80,243)`; peso medido `400` |
| 2 | Buscador rectángulo redondeado (radio 16) con el placeholder cortado bajo el botón | PÍLDORA radio **999** (contenedor y botón). El campo pasa de `<input>` a `<textarea rows=2>`: un input NO envuelve su placeholder (ese era el defecto: el texto quedaba tapado); el textarea sí y conserva el filtrado real (`input`/`value` idénticos; Enter = buscar vía `requestSubmit`, sin saltos de línea) | Radio medido `999px/999px`; campo `TEXTAREA` de 54px ≈ 2,02 líneas; solape texto↔botón **−8px** (ya no se corta); filtrar «henna» deja solo Ombré en carta y carrusel |
| 3 | Pastillas = accesos propios con la primera teñida de violeta y etiquetas en negrita | Las 8 CATEGORÍAS del marketplace, en su orden y textos exactos: Todo · Cabello y peinado · Salones de uñas · Cejas y pestañas · Maquillaje · Tatuajes y piercings · Terapia médica · Odontología. Uniformes `#f5f5f5` (radio de baldosa 24), iconos Lucide de línea fina (trazo 1,7) y etiquetas en peso **400** a dos líneas. «Análisis IA» sale de la rejilla y vive como tarjeta destacada bajo el Recomendado Y en la pantalla del salón | Etiquetas exactas (array comparado); fondo único `rgb(245,245,245)`; peso único `400`; las 8 con SVG |
| 4 | «Recomendado» con subtítulo gris y tarjetas con la foto recortada arriba | SIN subtítulo (tras el título va el carrusel). Título a 29px/800. Tarjetas FOTO A SANGRE COMPLETA (radio **24**): la foto llena la tarjeta y UNA pastilla de cristal (`blur(8px)`) dice un HECHO — salón: «Reservas abiertas»; servicios: su duración real —. PROHIBIDO cumplido: no se simula su «Highly Recommended» (es una valoración que no tenemos). Bajo la foto: nombre 800 + línea gris («Salón de cejas · análisis con IA»; servicios: «precio · min · descriptor») + chips de hechos. Carrusel con asomo medido **80,3 %** | Siguiente hermano del título = `#carrusel-reco`; foto = contenedor (Δ<1px); radio `24px`; pill literal «Reservas abiertas» con `blur`; chip horario «L–V 10–20 · S 10–14» |
| 5 | Nav «Inicio · Buscar · Reservar · Mi cita» | Nav EXACTA de la referencia: **Inicio · Buscar · Historial · Perfil** (iconos house/search/calendar/user de Lucide; activa rellena en violeta, como la suya). Reservar deja de ser pestaña: se llega desde tarjetas, categoría de cejas, salón y barra del pack, como en la referencia. Historial = la antigua «Mi cita» (misma pantalla, textos actualizados). **Perfil NUEVO y real**: «Tus datos» (nombre/teléfono de las reservas, SOLO en el dispositivo — clave `la-asistenta-perfil-v1` —, con Guardar y Borrar funcionales; al confirmar una reserva se actualizan solos y el paso 3 se autorrellena), contacto del salón (wa.me público) con horario real, y nota de privacidad (la foto no se guarda) | Etiquetas exactas comparadas; Historial vacío honesto y con la cita del pack tras reservar; Perfil guarda en localStorage (verificado), el paso 3 llega relleno (verificado) y «Borrar mis datos» vacía perfil + cita (verificado) |
| 6 | Pesos duros en etiquetas y secundarios | Etiquetas de pastilla y de nav a **400** (medido); secundarios en gris sin negrita; títulos en Montserrat 800 (Recomendado 29px); aire: rejilla de pastillas con más respiro y cabeceras con margen generoso | Pesos únicos medidos `400` en pastillas y nav; título `29px/800` |
| 7 | Salón y reserva se conservan (v4/v5) revisados contra la misma anatomía | Cabecera del salón ahora A SANGRE DE VERDAD: la foto escapa del margen (0→412px) con los botones flotantes encima, como su ficha. Flujo de reserva y paleta v5 intactos | Foto de cabecera medida `left=0, width=412`; recorrido completo de pack en QA10 |

Iconos Lucide elegidos para las categorías (anotados, como pedía el
encargo): la referencia usa un secador para cabello (Lucide no lo
tiene → **scissors**), una uña estilizada (→ **hand**), pestañas
(→ **eye**), barra de labios (→ **brush**; `sparkles` descartado por
orden expresa), corazón con aguja para tatuajes (→ **pen-tool**),
cruz médica para terapia (→ **heart-pulse**) y diente para
odontología (→ **plus**, la cruz médica universal). SVG oficiales de
lucide-static v0.469.0, descargados de jsDelivr, sin paths inventados.

Comportamiento honesto de las categorías: «Todo» baja al Recomendado;
«Cejas y pestañas» abre el salón real (es su especialidad); las demás
abren la pantalla `#p-pronto`: «Muy pronto. Estamos sumando más
salones a La Asistenta… No es un error: es el estado real de una
plataforma que está empezando», con SOLO dos acciones reales (ver el
salón de cejas / volver). **Sin botón «Avísame»**: estaba prohibido
por no funcional y la QA lo comprueba por su ausencia.

### Micro-diferencia declarada (no un cierre falso)

El placeholder «Buscar todos los servicios» se VE en una línea: es
más corto que el suyo («…los tratamientos») y cabe entero en el
ancho disponible. El campo mantiene la ALTURA de dos líneas de la
referencia (54px medidos), el texto no se corta (solape −8px) y
envuelve en cuanto no cabe. Forzar la segunda línea habría exigido
estrechar el campo contra la anatomía, así que se deja así,
declarado.

Detalle de rodaje encontrado y corregido durante la QA: el carrusel
tiene `scroll-snap`; tras filtrar y borrar la búsqueda quedaba
enganchado en la tarjeta filtrada. Ahora, al vaciar la búsqueda, el
carrusel vuelve a la tarjeta del salón (`scrollLeft = 0`).

### Verificación (contra la máquina real; solo se reinició la web, pid final 70102)

- Baterías con el código final: **web 19/19 · guarda 8/8 ·
  mecánicas 20/20**, ficheros sin tocar.
- **QA10 NUEVA** (`web/qa10/qa10_cdp.mjs`): **43/43** a 412×915,
  tabla elemento→verificado por diferencia (arriba). Recorrido
  completo con reserva REAL de pack (Diseño + Laminación, 63 €,
  90 min, vie 6/11 17:00): las citas de las tres pasadas
  (AS-AACX id 82 · AS-AACY id 83 · AS-AACZ id 84) quedaron
  CANCELADAS en la limpieza de cada pasada. Capturas
  `web/qa10/qa10-01…08` revisadas una a una CONTRA
  `referencia/01-home.png`; clave para Lee en `web/icons/`:
  `vista-v6-inicio.png` y `vista-v6-nav.png` (200 en la URL pública;
  las copias temporales qa10-* en icons/ se retiraron tras la
  revisión).
- Respaldos: `index.html.bak-20261028-v6` y `sw.js.bak-20261028-v6`
  en local y en máquina; SHA-256 del `index.html` final local =
  máquina (`3069c052…`).

**Nota para la próxima sincronización del repo público** (suma a las
anteriores): modificados `web/index.html` y `web/sw.js` (v8) y este
`ESTADO_PROYECTO.md`; nuevos `web/qa10/qa10_cdp.mjs` (sin capturas) y
capturas `web/icons/vista-v6-inicio.png`, `web/icons/vista-v6-nav.png`.
Sin cambios: `web/cita.html`, `web/web_server.py`,
`web/pruebas_web.py`, `whatsapp/webhook.py`, todo `agenda/`.

## PIVOTE 28/10 23:26 — probador virtual (orden de Lee, «MISIÓN CRÍTICA»)

Lee corrige el concepto: LA ASISTENTA **deja de ser la app de reservas
del salón y de espejar a Fresha**. Fresha queda solo como gramática de
UX (la ESPEC y la v6 son base técnica, no destino). Nuevo producto:
**plataforma de comercio visual con IA — «Descubre cómo te quedaría
antes de comprarlo»**, con los modelos de Meta en el centro. Verticales:
**cejas** (análisis + reserva de Ari Vivas pasa a ser UNA vertical
dentro del Probador; la agenda y la operadora WhatsApp se conservan
como infraestructura que funciona) y **moda** (ropa, gafas, zapatillas,
accesorios). Referencia visual: el mockup de ChatGPT que envió Lee
(`~/workspace/user/files/1000056163_0_lu2t.png`): hero «Pruébatelo antes
de comprar», botón «Probar en mí», accesos Ropa/Gafas/Zapatillas/
Accesorios, tarjeta «Tu probador IA», nav Inicio·Explorar·Probador·
Perfil, blanco + violeta moderado.

**Primera entrega hecha (sin tocar código): `DIAGNOSTICO_PROBADOR.md`**
— qué existe (PROBADO: PWA v6, agenda, WhatsApp/TwiML, análisis Spark
asíncrono; baterías 19/19 · 8/8 · 20/20, QA10 43/43; máquina en marcha
y claves inventariadas por nombre/longitud: Baseten real len 45 en la
máquina, Twilio completo, Meta a len 0), qué se reutiliza (consenti-
miento + subida de foto, trabajos asíncronos con sondeo, orquestador
Spark, perfil en dispositivo, embudo de eventos, disciplina de datos
reales), qué muere (la home de salón y sus categorías de belleza; la
reserva se reubica en la vertical Cejas), qué falta (módulo de catálogo
real — `meta_catalog_search`/`shopify-ucp` existen en el entorno del
agente pero NO son llamables desde la máquina: vía viable = instantá-
neas curadas con procedencia; motor de try-on con contrato de adaptador
fijado; almacenamiento de resultados con retención/borrado; analítica
nueva), las 6 fases de Lee con la primera tarea y su prueba por fase, y
los bloqueos exactos (clave de equipo de Meta = Muse Image/SAM; motor
de moda = gasto nuevo que exige OK de Lee). Siguiente paso: fase 1
(interfaz/navegación) cuando Lee dé paso, sin aprobación intermedia
para tareas rutinarias.

## PIVOTE · Fase 1 — interfaz y navegación del probador virtual (28/10/2026, noche)

La web de la clienta ya NO es la app del salón: es la plataforma de
probador virtual de `DIAGNOSTICO_PROBADOR.md` §5, con la anatomía del
mockup aprobado por Lee (`1000056163_0_lu2t.png`). Solo cambió
`web/index.html` + `web/sw.js` (shell **v9**); `cita.html`, webhook y
agenda intactos (solo se reinició la web). El flujo de cejas
(consentimiento → foto → análisis → reserva) se reutilizó SIN tocar su
lógica: vive ahora dentro de la pestaña Probador.

- **Cabecera**: «✦ ASISTENTA» (estrella SVG propia) + botón de perfil.
  Fuera la fila del salón como puerta de la app.
- **Inicio**: hero editorial SIN fotos de stock («Pruébatelo antes de
  comprar» + «Tu estilo, tu avatar, tus decisiones» + píldora violeta
  «Probar en mí» → Probador) · «Empieza por aquí» con Ropa · Gafas ·
  Zapatillas · Accesorios (Lucide: shirt, glasses, footprints,
  shopping-bag) → Explorar filtrado · tarjeta «Tu probador IA» (3
  checks del mockup + nota honesta de estados) · tarjeta «Probador de
  cejas — Disponible ahora» (análisis + reserva real en Ari Vivas
  Beauty) · carrusel real de cejas · «Looks recomendados» como estado
  honesto (sin catálogo de moda verificado, sin productos inventados).
- **Explorar**: buscador píldora + chips Cejas/Ropa/Gafas/Zapatillas/
  Accesorios. Cejas = los 4 productos REALES de la carta (foto real —
  Depilación sin foto, con marcador gráfico, porque no existe foto
  suya —, precio, duración, «Probar con mi foto», «Reservar» y guardar
  en el dispositivo). Moda = estado honesto «Catálogo en preparación —
  estamos verificando productos reales». Acceso al salón al final.
- **Probador (hub)**: cejas «Disponible ahora» (flujo completo) · moda
  «En integración» · **perfil visual reutilizable**: foto guardada SOLO
  en el dispositivo (`la-asistenta-foto-perfil-v1`, reducida con el
  pipeline de siempre), con cambiar/borrar y el aviso de que aún no se
  envía a ningún motor · acceso a «Mi cita».
- **Probador de moda** (`p-moda`): consentimiento propio («mi foto no
  sale de este dispositivo por ahora»), subida real, selector de
  categoría y «Generar mi vista previa» que muestra el estado HONESTO:
  «El motor de prueba de moda está en integración. Tu foto no se envía
  a ningún sitio.» Cero peticiones, cero simulaciones. Desde ahí la
  foto puede guardarse como perfil visual.
- **Perfil**: lo de antes + «Mi cita» + **Mis guardados**
  (`la-asistenta-guardados-v1`) + **Mis looks**
  (`la-asistenta-looks-v1`: botón «Guardar este look» en el resultado;
  se guarda la recomendación SIN la foto). Todo en el dispositivo.
- **Nav**: Inicio · Explorar · Probador · Perfil. «Mi cita» se alcanza
  desde Perfil y desde el hub; la cita guardada no se pierde.
- **Verificación (código final desplegado)**: baterías **web 19/19 ·
  guarda 8/8 · mecánicas 20/20** (sin tocar: prueban APIs, no
  pantallas) y **QA11 nueva: 42/42** a 412×915 con clics reales
  (`web/qa11/qa11_cdp.mjs`): home contra el mockup, estado honesto de
  Gafas, guardar producto, hub, foto de moda por CDP con consentimiento
  y estado honesto, perfil visual, análisis REAL de cejas, guardar
  look, reserva real AS-AADH para el 06/11 **cancelada en la
  limpieza**, Perfil con guardados/looks. Dos fallos iniciales fueron
  del propio script de QA (mayúsculas y un literal sin interpolar), no
  de la app; corregidos y re-ejecutada entera. Capturas revisadas una a
  una: `web/qa11/` + copias en `web/icons/vista-pivote-inicio.png`,
  `vista-pivote-probador.png`, `vista-pivote-explorar.png`,
  `vista-pivote-moda.png`.
- Respaldos: `backups/2026-10-28_pre-pivote/` + `*.bak-20261028-pivote`
  en local y máquina. SHA-256 de index.html y sw.js idéntico local =
  máquina.
- **Nota para la próxima sincronización del repo público**: se suman
  `web/index.html` y `web/sw.js` en su estado pivote (la home de salón
  v6 queda superada por esta fase 1) y `web/qa11/` si se decide
  publicar la QA. Siguiente fase del pivote: la 2 (catálogo y fichas).

## PIVOTE · Motor FASHN VTON v1.5 en Baseten — BLOQUEADO por permisos de la clave (28/10/2026, noche)

- **Autorización**: Lee aprobó (28/10 23:34) desplegar FASHN VTON v1.5
  en Baseten y hacer la primera prueba real con ≈1–3 $ del crédito ya
  concedido (100 $), tope duro 5 $.
- **Resultado: bloqueo de plataforma ANTES de gastar nada. Coste real
  de la sesión: 0 $.** Ningún modelo ni réplica quedó creado
  (`GET /v1/models` = `[]` tras el intento); no hay coste en reposo.
- **Evidencia literal**: `truss push` (truss 0.18.36, desde la máquina)
  → `ERROR ApiError: The user does not have the authorization to
  perform the request`. Llamada directa: `POST
  https://api.baseten.co/v1/models` → **HTTP 403
  `{"code": "PERMISSION_DENIED", "message": "Authorization error"}`**.
  La misma clave SÍ lee (`GET /v1/models` 200) y SÍ hace inferencia
  (Spark en producción): es una clave **de inferencia (Model API)**,
  sin permiso para crear despliegues propios. `GET /v1/api_keys`
  también denegado.
- **Lo que queda construido y listo** (todo en `probador/`):
  - `truss-fashn/`: truss validado por la CLI oficial — GPU **L4**
    (la más pequeña con bf16 digno; T4 es Turing), pesos oficiales de
    HF descargados en `load()` (~2,3 GB), pipeline oficial sin tocar.
  - `adaptador_fashn_baseten.py`: cumple el contrato del diagnóstico
    (entrada foto+prenda+categoría; salida imagen + proveedor/modelo/
    latencia/coste con tarifa oficial L4 0,01414 $/min; timeout 600 s;
    2 reintentos acotados; clave solo en el entorno del servidor). Su
    **lógica está probada sin red: tests 5/5**
    (`test_adaptador_fashn.py`). NO es una prueba E2E.
  - `prueba-fashn/`: README con la evidencia completa + las imágenes
    OFICIALES de la prueba ya descargadas (`persona-oficial.webp`,
    `prenda-oficial.webp` = `examples/data/` del repo oficial de
    FASHN, tamaños idénticos al listado oficial). Ninguna foto de
    personas del proyecto se usó.
- **Desbloqueo (acción de Lee)**: crear en la consola de Baseten
  (Settings → API Keys) una clave con permisos de despliegue y
  guardarla como la actual. Si la consola exigiera método de pago
  para despliegues dedicados pese al crédito, sería gasto nuevo y
  requiere OK aparte. Con la clave, el despliegue es un comando
  (`truss push`) y la prueba E2E, el CLI del adaptador; coste
  estimado entonces: ≈0,3–0,6 $.
- **Veredicto del motor**: la calidad de FASHN VTON v1.5 sigue **sin
  verificar por nosotros** — ninguna generación se ha ejecutado. La
  fase 4 del pivote queda en «adaptador listo, despliegue bloqueado»,
  no en «motor conectado».
- **Nota para la próxima sincronización del repo público**: se suma
  `probador/` completo (truss, adaptador, tests y README de la
  prueba) — sin secretos, como siempre.

## LA ASISTENTA MODULAR — corrección de dirección (28/10/2026, noche)

Orden de Lee (23:45) que **modera el pivote de las 23:26**: LA ASISTENTA
es una plataforma modular; **Belleza (Ari Vivas Beauty) es el ÚNICO
módulo comercial activo**; Moda/probador, Gafas/accesorios y Calzado
quedan «próximamente» con diseño terminado y sin fingir nada. La
home que lideraba con el probador de moda (Fase 1 del pivote) queda
reequilibrada: el módulo activo manda.

### Reconciliación con la fase 2 detenida

La fase de catálogo de moda se detuvo a mitad: solo había creado el
directorio `catalogo/` **vacío** (local, 22:43) — sin instantánea,
sin fichas de producto y sin nada servido. Se ha eliminado el
directorio vacío y se ha anotado en `probador/INTERFACES.md` §9.
Nada de moda era visible en producción; no hubo que retirar
superficie alguna.

### Registro central de módulos (nuevo)

- `web/modulos.json` + ruta **`GET /api/modulos`** en `web_server.py`
  (único cambio del servidor: servir el registro, con `no-cache`).
- Cada módulo: id estable, nombre, categoría, estado
  (`activo|proximamente|desactivado`), navegación (estantería,
  orden, chip de Explorar y etiqueta), rutas propias, capacidades
  (y previstas en los futuros), requisitos de integración,
  preparación (nivel, porcentaje, notas) y dependencias.
- Módulos: `belleza` (**activo**; capacidades catalogo_servicios,
  disponibilidad, reservas, analisis_ia, whatsapp) ·
  `moda_probador`, `gafas_accesorios`, `calzado` (próximamente).
- La interfaz **lee el registro**: la estantería de la home
  (`#estanteria-modulos`), los chips de Explorar y la pantalla de
  próxima apertura se pintan desde el JSON. Fuera las categorías de
  moda codificadas a mano en home, Explorar y Probador.

### Cambios en la interfaz (`web/index.html`, SW → shell v10)

- **Home nueva**: hero de plataforma («PLATAFORMA MODULAR · BELLEZA
  ACTIVA» / «Tu asistenta de belleza, con IA de verdad») con dos
  salidas reales (servicios/reserva y análisis de cejas), tarjeta
  del módulo activo, carrusel real y **estantería de módulos** con
  su estado visible. Fuera: el hero «Pruébatelo antes de comprar»
  como promesa utilizable, la rejilla de categorías de moda, la
  tarjeta «Tu probador IA» con checks de moda y «Looks recomendados».
- **Pantalla de próxima apertura común** (`p-proxima`, sustituye a
  `p-pronto`): icono, chip «Próximamente», «qué podrás hacer» y
  «qué estamos preparando» salen del registro; sin precios,
  disponibilidad ni fechas (auditado literalmente en QA12).
- **Explorar**: chips = módulos del registro; Belleza pinta la carta
  real; tocar un módulo futuro abre su próxima apertura, no un
  catálogo vacío.
- **Probador (hub)**: cejas intacto; la tarjeta de moda pasa a
  «Próximamente» y enlaza a la próxima apertura. **Eliminadas** la
  pantalla de preparación de foto de moda (`p-moda`), la tarjeta de
  «perfil visual» y su JS: un módulo futuro no aparenta funciones.
  (Si una usuaria guardó la foto local de la Fase 1, la clave
  `la-asistenta-foto-perfil-v1` queda huérfana en su dispositivo:
  no se lee ni se envía a ningún sitio.)
- Sin tocar: `cita.html`, webhook, agenda, el recorrido completo de
  cejas (consentimiento → foto → análisis → reserva → confirmación),
  enlace mágico, Mi cita, Perfil, guardados y looks.

### Interfaces del futuro probador

`probador/INTERFACES.md` (nuevo): contratos de perfil visual/avatar,
consentimiento e imágenes, catálogo y variantes, adaptador de
modelo (el de FASHN ya cumple el patrón; dormido), resultados y
retención, looks guardados y enlaces de compra, + procedimiento de
activación. El análisis de cejas **no** se acopla a ese motor.
Coste de la fase en créditos de IA: **0 $** (las baterías y la QA
ejercen el análisis de cejas ya existente, como siempre).

### Pruebas ejecutadas (las 6 obligatorias de Lee)

1. **Reservas intactas**: baterías contra la máquina real —
   web **19/19** · guarda **8/8** · mecánicas **20/20**; y QA12 con
   recorrido completo con clics (análisis real → reserva 06/11 →
   confirmada **AS-AAD2** → cancelada en la limpieza).
2. **Fuentes reales**: `GET /api/servicios` de la web es
   **idéntico** al `/servicios` de la agenda (comparación JSON:
   iguales; carta 18 €/25 · 30 €/65 · 45 €/65 · Consultar/12 y
   horario L–V 10–20, S 10–14, D cerrado).
3. **Categorías futuras desde el registro**: QA12 43/43 — la
   estantería pinta los 4 módulos en el orden del JSON con sus
   estados; los chips de Explorar salen del registro.
4. **Sin invenciones**: auditoría literal en QA12 de la pantalla de
   próxima apertura (sin precios, sin disponibilidad, sin fechas) y
   de la home (sin precios de moda).
5. **Navegación móvil**: QA12 a 412×915, **consola sin errores** y
   sin desborde horizontal en inicio, próxima apertura, explorar y
   perfil. Capturas en `web/qa12/` (01 inicio · 02 estantería ·
   03 próxima · 04 explorar · 05 confirmada · 06 flip).
6. **Activación por configuración (QA12b, 6/6)**: en un entorno de
   prueba (puerto 8099, producción intacta) se sirvió la MISMA
   `index.html` con una copia del registro con `moda_probador` en
   «activo»: sin tocar código, la tarjeta pasó a «Activo», su chip
   quedó seleccionado en Explorar y su destino fue Explorar con el
   estado honesto «aún sin productos verificados» (0 productos
   inventados). El servidor de prueba se detuvo y producción quedó
   verificada: solo belleza activo.

### Receta para activar un módulo nuevo

1. Cumplir y verificar sus `dependencias` en `web/modulos.json`
   (para moda: motor probado con generaciones reales registradas,
   catálogo verificado, clave con permisos de despliegue).
2. Servir sus datos reales desde el servidor (instantánea curada,
   como la carta hoy) y conectar su adaptador tras el patrón
   asíncrono de trabajos (ver `probador/INTERFACES.md` §8).
3. Cambiar en `web/modulos.json` el `estado` del módulo a
   `"activo"` y subir el fichero (la web lo sirve con `no-cache`:
   no hace falta ni reiniciar).
4. Repetir baterías + QA con clics antes de darlo por abierto.

### Limitaciones y notas

- La navegación inferior (Inicio · Explorar · Probador · Perfil) es
  de la PLATAFORMA y no cambia por módulo; lo que el registro manda
  es la estantería, los chips y los destinos (suficiente para la
  activación demostrada; si un módulo futuro necesita pestaña
  propia, será otro cambio de código, declarado).
- `preparacion.porcentaje` de los módulos futuros es una estimación
  editorial documentada en sus notas, no una métrica medida.
- Respaldos: `backups/2026-10-28_pre-modular/` (local) y
  `*.bak-20261028-modular` en local y máquina. Solo se reinició la
  web (pid 73901); webhook (48241) y agenda (65393) intactos.
  SHA-256 local = máquina en index.html, sw.js, web_server.py y
  modulos.json.
- **Nota para la próxima sincronización del repo público**: se
  suman `web/modulos.json`, `web/qa12/` y `probador/INTERFACES.md`,
  y se actualizan `web/index.html`, `web/sw.js` y
  `web/web_server.py` (ruta `/api/modulos`).

## ÁREA PROFESIONAL — la dueña administra su negocio (29/10/2026)

Fase 1/3 de la Orden Maestra (prioridad 3: experiencia del
profesional). Arianna ya no depende del CLI ni del panel demo viejo:
tiene su área dentro de la misma web, con la identidad de siempre
(blanco/violeta, 412×915), construida SOLO con proxies autenticados
a la API de agenda existente. Webhook y flujo de la clienta intactos.

### Acceso y clave (seguridad)

- Vista **`GET /profesional`** (`web/profesional.html`, nueva) y API
  **`/api/profesional/*`** en `web_server.py`. Sin sesión válida,
  TODAS devuelven **401 y no revelan ni un dato** (probado en
  batería y en QA13 con captura del acceso denegado).
- **Clave NUEVA del negocio, distinta del token demo de la agenda**:
  aleatoria (32 caracteres), generada EN la máquina por
  `web/crear_clave_profesional.py` (el valor jamás se imprimió ni
  pasó por un argumento) y guardada solo en
  **`/data/la-asistenta/web/profesional.env` (permisos 600)**. El
  servidor la lee de ese fichero (o de la variable de entorno
  `PROFESIONAL_CLAVE`). Sin clave configurada, el acceso responde
  503: el área no se abre con ninguna contraseña «de demo».
  **⚠️ `web/profesional.env` NO debe sincronizarse al repo público
  jamás** (es el secreto; queda solo en la máquina).
- **Cómo se le entrega a Lee**: la clave vive únicamente en ese
  fichero de la máquina. Lee (o Aragan a petición suya) la lee una
  vez con el helper de InstaBox
  (`exec … 'cat /data/la-asistenta/web/profesional.env'`) y se la
  pasa a Arianna en persona o por su canal privado. Rotarla =
  regenerar el fichero con el mismo script (hay que borrar el
  anterior a mano: el script no sobrescribe) y reiniciar solo la web.
- Sesión simple en memoria: token aleatorio, **caducidad 8 h**,
  guardado en `sessionStorage` del navegador (se cierra con la
  pestaña). Rate-limit en el acceso: 8 intentos/15 min por IP.
  Comparación de la clave con `secrets.compare_digest`.

### Qué puede hacer la profesional (todo real, sobre la API existente)

- **Hoy**: citas del día (hora del salón, Europe/Madrid — la máquina
  corre en UTC) con hora, clienta, servicio, código AS-XXXX, precio
  y estado; el **mini-formulario de preparación** (`prep`) dentro de
  cada cita; acciones reales **Cumplida / No vino / Cancelar** (proxy
  a `POST /citas/<id>/estado|cancelar` de la agenda, con su guarda);
  escribir a la clienta por wa.me si hay teléfono; y la **bandeja de
  salida** con los agradecimientos pendientes, su enlace wa.me de un
  toque y marcar enviada/descartar.
- **Agenda**: próximos 7 días con las citas y los **intervalos
  libres reales** ([apertura, cierre) menos las confirmadas; no
  dependen de un servicio y no inventan ocupación).
- **Por avisar**: entradas `por_avisar` (y `esperando`) con botón
  **«Avisar por WhatsApp»** = enlace wa.me con el texto listo que se
  abre en el WhatsApp DE LA PROFESIONAL. La UI lo dice sin
  tecnicismos: la app no envía ese aviso sola (límite del trial).
  Acciones: atendida / descartar.
- **Mi negocio**: **embudo** real (7 contadores de `/embudo`) y
  **servicios y horarios en SOLO LECTURA** desde la carta servida.
  El botón «Editar carta u horarios» NO abre ningún formulario:
  muestra la nota honesta de que por ahora los cambios los aplica
  La Asistenta el mismo día (editar la carta en caliente queda
  fuera de esta fase, como se ordenó).
- Entrada desde la app de la clienta: tarjeta «¿Eres la
  profesional?» en Perfil → `/profesional`. SW → shell **v11**.

### Archivos

- Nuevos: `web/profesional.html`, `web/qa13/qa13_cdp.mjs`,
  `web/crear_clave_profesional.py` (utilidad del servidor, sin
  secretos), `web/limpiar_bandeja_pruebas.py` (utilidad de limpieza
  de pruebas) y, SOLO en la máquina, `web/profesional.env` (0600).
- Modificados: `web/web_server.py` (rutas y sesión del área),
  `web/index.html` (enlace en Perfil), `web/sw.js` (v11),
  `web/pruebas_web.py` (bloque 14: +13 pruebas del área).
- Respaldos `*.bak-20261029-profesional` en local y máquina. Solo
  se reinició la web (pid 76711 al desplegar); webhook (8080) y
  agenda (8081) intactos. SHA-256 local = máquina en los 5 ficheros
  desplegados.

### Pruebas ejecutadas (contra la máquina real)

- Baterías: web **32/32** (las 19 de siempre + 13 del área:
  401 sin sesión, clave falsa 401, sesión creada, cita de hoy con
  código, estado inventado 400, no_show real, limpieza cancelada,
  espera/embudo/carta/agenda con sesión, salir → 401) · guarda
  **8/8** · mecánicas **20/20**.
- **QA13 (CDP, 412×915): 27/27** — acceso, denegado con clave falsa
  (captura), acceso real, «Hoy» con la cita de prueba (id 134) y su
  prep visibles, cumplida → bandeja → descartada, agenda de 7 días
  con huecos, espera «por_avisar» con wa.me y atendida, embudo de 7
  tarjetas, carta de 4 servicios y nota de edición honesta; sin
  desborde horizontal y consola limpia (fuera del 401 deliberado
  del intento falso). Capturas en `web/qa13/`; la de Hoy servida en
  `/icons/vista-profesional-hoy.png`.
- Primera pasada de QA13: 25/27 por dos fallos DE LA QA, no de la
  app (la bandeja tenía 15 entradas pendientes de baterías
  anteriores y el clic cayó en la más antigua; el 401 del intento
  falso contaba como «error de consola»). Corregida la QA y
  repetida entera: 27/27.
- **Limpieza de la bandeja**: las 15 entradas pendientes eran TODAS
  de baterías de prueba (nombres «PRUEBA…»); se descartaron con
  `limpiar_bandeja_pruebas.py` (solo toca nombres con «PRUEBA») y
  la bandeja quedó a **0 pendientes**: pizarra limpia para Arianna.
  Ojo futuro: cada corrida de `pruebas_mecanicas.py` vuelve a crear
  agradecimientos de prueba al marcar cumplidas.

### Limitaciones y notas

- «Hoy» muestra también las citas canceladas del día (con su chip):
  es la vista completa y honesta del día; hoy 29/10 se ven restos
  cancelados de QAs anteriores, todos marcados «Cancelada».
- La sesión vive en memoria del proceso web: si la web se
  reinicia, Arianna entra de nuevo con su clave (8 h o reinicio,
  lo que llegue antes).
- La máquina tuvo un episodio de 503 `host_unavailable` en la API
  de InstaBox (~1 min, `retryable: true`) durante esta fase; se
  recuperó sola sin tocar nada. La URL pública tardó algo más en
  volver que el exec interno.
- **Nota para la próxima sincronización del repo público**: se
  suman `web/profesional.html`, `web/qa13/`,
  `web/crear_clave_profesional.py`, `web/limpiar_bandeja_pruebas.py`
  y se actualizan `web/web_server.py`, `web/index.html`,
  `web/sw.js`, `web/pruebas_web.py`. **EXCLUIR siempre
  `web/profesional.env`** (y su contenido no va en ningún informe).

---

## Auditoría Orden Maestra + sincronización del repo público (29/10/2026)

Primer paso de la Orden Maestra ejecutado: auditoría completa en
`AUDITORIA_ORDEN_MAESTRA.md` (inventario verificado, tabla de
diferencias D1–D10, cola priorizada P1–P7 y bloqueos B1–B7).

- **Evidencia del día (contra la máquina real)**: máquina encontrada
  suspendida y despertada por API (una visita web ya NO la despierta);
  `/salud` OK en 8080/8081/8090; baterías web **19/19** · guarda
  **8/8** · mecánicas **20/20** · QA12 **43/43** · adaptador FASHN
  **5/5** (sin red). Superficie pública verificada desde fuera
  (`/api/modulos`, `/api/servicios`).
- **Hallazgo D1 y su resolución**: en el momento de la auditoría,
  `web_server.py` local ≠ máquina (el backend del área profesional
  existía solo en local, sin página ni despliegue). La fase del área
  profesional documentada en la sección anterior lo completó y
  desplegó después (baterías 32/32, QA13 27/27): D1 queda resuelta
  por esa vía; la divergencia de SHA de la mañana queda registrada
  como lección («ningún cambio local sin registrar en ESTADO el
  mismo día»).
- **Sincronización del repo público — HECHA**: commit
  **`c19dd1d9158239699e64d9dc6ed232175c2a4c54`** en
  github.com/Blackleets/la-asistenta (main), snapshot de **115
  rutas**: todo lo posterior a `c5b9dbd` (PWA, análisis asíncrono,
  mecánicas, interfaces v3–v6, pivote Fase 1, corrección modular con
  `web/modulos.json`, `probador/` completo, ESPEC_REFERENCIA,
  DIAGNOSTICO_PROBADOR, MODELOS_TRYON, AUDITORIA_ORDEN_MAESTRA y los
  scripts de QA). Registro actualizado (3ª entrada en
  `~/workspace/la-asistenta-repo.muse-github-snapshot-sync.json`);
  manifiesto en `~/workspace/la-asistenta-paths-v3.bin`.
- **Auditoría de secretos de la publicación**: grep por patrones
  sobre el conjunto completo y verificación remota — **sin secretos
  reales**. El móvil/email personales del fundador solo existen en
  el fichero fuente interno `RUTA_C_TWILIO.md`; la copia de
  publicación va saneada desde H0.1-A y el historial público está
  limpio (verificado en el historial de la copia y con búsqueda de
  código remota: 0 resultados). No se ha reescrito historia. Queda
  anotado D7: el token de demo de la agenda es literal en el código
  y público desde el primer sync — rotación y paso a solo-entorno
  en la cola P4.
- **Alcance exacto de este commit**: incluye el `web_server.py` CON
  el backend del área profesional, pero NO `web/profesional.html`,
  `web/qa13/`, `web/crear_clave_profesional.py` ni
  `web/limpiar_bandeja_pruebas.py` (no existían al preparar la
  copia), ni las actualizaciones de `index.html`/`sw.js`/
  `pruebas_web.py` de esa fase: quedan para la próxima
  sincronización, como indica la nota de la sección anterior.
  `web/profesional.env` excluido siempre (solo existe en la
  máquina, 0600). Excluidos también, como siempre: `hermes-home/`
  entero, `*.db`, logs, fotos y binarios; y los documentos internos
  de evaluación (`ESTADO_PARA_CHATGPT.md`, `BENCHMARK_H1.md`,
  `PLAN_EXPOSICION.md`).


## FASE 2 DE LA ORDEN MAESTRA COMPLETADA (29/10/2026 mañana): multinegocio, transacciones, idempotencia, índices y mediciones

Resuelve D2 (agenda mononegocio) y prepara D7 (token literal) sin
rotarlo. Migración SOLO aditiva con respaldo previo
(`backups/agenda.db.bak-20261029-fase2` en la máquina; línea base
antes de tocar nada: web 32/32 · guarda 8/8 · mecánicas 20/20).

1. **Alcance por negocio**: columna `negocio_id` en citas,
   lista_espera, eventos y bandeja_salida (DEFAULT = piloto
   `ari-vivas-beauty`; las 141 citas, 18 esperas, 448 eventos y 18
   bandejas existentes quedaron adscritos al piloto). TODAS las
   consultas y escrituras de `agenda_comun.py`, la API, el MCP y el
   CLI filtran por negocio. La API acepta la cabecera `X-Negocio-Id`;
   los negocios válidos salen de `AGENDA_NEGOCIOS` (defecto: solo el
   piloto) y un negocio no configurado recibe 404.
2. **Doble reserva transaccional**: la guarda anti-solape y la
   inserción (y el reagendar) van en UNA transacción `BEGIN
   IMMEDIATE` en la API y en el MCP; conexiones con `busy_timeout`
   de 30 s (si la agenda está ocupada de verdad, la API responde
   503 «agenda ocupada», nunca un 500 pelado).
3. **Idempotencia**: `POST /citas` acepta `Idempotency-Key`; tabla
   `claves_idempotencia` con huella SHA-256 de la petición. Misma
   clave + mismo cuerpo → 200 con la cita ORIGINAL (sin el enlace
   mágico: el token solo viaja en la respuesta de creación). Misma
   clave + cuerpo distinto → **422**. La web envía una clave por
   intento de reserva y el MCP acepta `clave_idempotencia`.
4. **Índices** (EXPLAIN antes/después en `MEDICIONES.md`):
   `idx_citas_negocio_fecha_estado`, `idx_citas_token_hash`,
   `idx_eventos_negocio_tipo`, `idx_lista_espera_negocio`,
   `idx_bandeja_negocio`. El embudo pasa de SCAN completo de eventos
   a índice covering.
5. **Pruebas**: batería NUEVA `agenda/pruebas_fase2.py` **22/22** —
   levanta una instancia en el puerto 8091 con una COPIA de la base
   de datos (la de producción no se toca): aislamiento total entre
   el piloto y un segundo negocio de prueba (citas, espera, bandeja
   y embudo separados; el mismo hueco en dos negocios NO es
   conflicto; cancelar la cita ajena → 404), idempotencia (201 →
   200 sin duplicar; cuerpo distinto → 422) y concurrencia con
   barrera (2 y 5 POST simultáneos al mismo hueco → exactamente un
   201 y el resto 409 con alternativas). Tras el despliegue, en la
   máquina: **web 32/32 · guarda 8/8 · mecánicas 20/20 · fase2
   22/22**. La bandeja de salida volvió a quedar en 0 pendientes
   (limpieza de pruebas tras las baterías).
6. **Mediciones** (`MEDICIONES.md`, script `agenda/mediciones.py`):
   en localhost de la máquina (4 vCPU, 8 GiB): /salud p50 0,3 ms;
   disponibilidad p50 2,7 ms; crear cita p50 1,3 ms; ráfaga de 20
   lecturas: todas 200 con p95 ~1,03 s (cola de los dos servidores
   Python de un proceso); ráfaga de 5 escrituras al mismo hueco:
   1× 201 y 4× 409 en ~10 ms. Frase honesta del documento: esto
   soporta un negocio con holgura y decenas de negocios pequeños;
   para más haría falta base de datos servida, más procesos y
   máquinas sin pausa — NO se afirman millones.
7. **Token de la agenda (D7) — PREPARADO, NO ROTADO**: el token ya
   NO es un literal en el código de `agenda_api.py` ni de
   `web_server.py`: ambos lo leen SOLO de `AGENDA_API_TOKEN` en el
   entorno (la API sale con error claro si falta; la web igual) y
   `arrancar.sh` lo carga de `agenda/agenda.env` (0600, SOLO en la
   máquina, exclusión permanente del repo). El VALOR en uso no ha
   cambiado: el comportamiento es idéntico al de antes. Las baterías
   también leen el token del entorno o de `agenda.env`, sin literal.
   ⚠️ **El proceso MCP en marcha SÍ corre con el código nuevo**
   tras relanzar el gateway de Hermes conservando su entorno exacto
   (83 variables capturadas de /proc, valores nunca fuera de la
   máquina; gateway pid 80203, MCP pid 80293, verificados con una
   pregunta real de disponibilidad respondida por el cerebro).
   Constancia para el futuro: el supervisor de muerte del MCP NO lo
   rearranca solo si se mata el proceso; hay que relanzar el
   gateway (script usado: `run-logs/relanzar_gateway.py` en la
   máquina, captura el entorno del gateway vivo y lo relanza con
   el mismo comando).
8. **PENDIENTE CON AUTORIZACIÓN DE LEE — rotación del token (D7)**:
   el valor actual es público desde el primer sync del repo (era el
   literal del código). Rotarlo es cambiar una credencial de
   producción: paso exacto cuando Lee lo autorice — (a) generar un
   valor nuevo aleatorio, (b) escribirlo en
   `/data/la-asistenta/agenda/agenda.env`, (c) reiniciar SOLO la API
   de agenda y la web (matar sus pid de `run-logs/` y correr
   `arrancar.sh`), (d) repetir las baterías 32/32 · 8/8 · 20/20 ·
   22/22. El MCP no usa el token (habla directo con la base de
   datos): la rotación NO exige tocar el gateway. Ventana: ~2
   minutos con la agenda en pausa. La purga del valor viejo del
   historial público de git es otra decisión aparte (reescribir
   historia) que también requiere orden expresa.
9. **Próxima tarea exacta** (cola de la auditoría): del lado del
   agente no queda tarea técnica ordinaria bloqueada tras esta
   fase; lo siguiente es el **ensayo general del 02/11** (despertar
   la máquina por API, re-join al sandbox de Twilio y correr el
   guion de demo) y, cuando Lee desbloquee B1 (clave Meta), ejecutar
   el benchmark H1 de modelos (≈0,86 $). Siguen pendientes de Lee:
   B3 (un «Hola» real al +49 15888 620339), B4 (URL de reseñas),
   la rotación del token del punto 8 y la lectura de la clave del
   área profesional.

10. **Repo público sincronizado con esta fase** (29/10/2026):
    commit **`3cec687c569cd50951b5d39eb2822c988c0b88b6`**, 122 rutas
    (las 115 de `c19dd1d` + MEDICIONES.md, agenda/mediciones.py,
    agenda/pruebas_fase2.py, web/profesional.html, web/qa13/,
    web/crear_clave_profesional.py y web/limpiar_bandeja_pruebas.py,
    con el código actualizado de agenda y web). Manifiesto en
    `~/workspace/la-asistenta-paths-v4.bin`; registro actualizado
    (4ª entrada). Auditoría de secretos sobre el conjunto: sin
    .env reales, sin .db, sin datos personales del fundador, sin
    claves; `web/profesional.env` y `agenda/agenda.env` excluidos
    (solo existen en la máquina). El literal del token viejo solo
    sobrevive en artefactos históricos ya publicados y auditados
    (app Android v2, scripts QA4–QA7 y la auditoría de publicación
    S5); el código de servidor ya no lo contiene — la validez del
    valor cesa con la rotación del punto 8. (Esta nota se publica
    en la próxima sincronización, como la anterior.)

## RUNBOOK de ensayo y demo (29/10/2026): próxima tarea fechada = ensayo general 02/11

- Escrito `ENSAYO_Y_DEMO.md` (documento operativo; preparación
  documental, sin tocar la máquina ni gastar mensajes): cronograma
  del **02/11** paso a paso (despertar por API — la visita web ya NO
  despierta la máquina, D8 de la auditoría —, `/salud` ×3, re-join al
  sandbox de Twilio, calentamiento de Hermes con autoprueba de
  consumo 0, recorrido E2E completo con **presupuesto de mensajes
  contado: 13 de 100**), grabación del vídeo plano a plano desde
  `GUION_DEMO.md` actualizada al estado real (área profesional como
  pantalla de agenda; el plano del análisis se graba en vivo o
  pregrabado-etiquetado según la latencia medida en el ensayo; plan
  B de racha lenta de Baseten sin simular jamás), checklist de
  materiales y de lo que NO debe verse (secretos, datos de clientas,
  clave profesional), jornada de entrega del **04/11** (límite 21:00
  ET = 05/11 03:00 Madrid; objetivo interno: todo enviado a las
  23:00 Madrid) y árbol de fallos con recuperación en ≤3 pasos
  (máquina pausada · Spark lento · Twilio silencioso en modo TwiML ·
  gateway de Hermes caído → `run-logs/relanzar_gateway.py`, el
  supervisor NO rearranca el MCP solo).
- **Próxima tarea exacta: ejecutar el runbook el 02/11** (ensayo) y
  grabar según su §2; el 04/11, su §3. Siguen pendientes de Lee los
  desbloqueos ya conocidos (B1 clave de Meta, B3 «Hola» real al
  sandbox, B4 URL de reseñas, rotación del token de agenda D7 y
  lectura de la clave del área profesional).

## RE FINO de la home — descubrimiento (29/10/2026, mañana)

Veredicto del principal tras ver la captura real de Lee en su móvil:
la estantería de módulos era honesta, pero la home hablaba de
NUESTRA arquitectura en vez de vender descubrimiento, y Fresha
nunca hace eso. Corrección solo de presentación y textos en `web/`
(`index.html`, `modulos.json`, `sw.js`); el registro sigue mandando
(nada recodificado a mano); webhook, agenda y `cita.html` intactos.

### Textos que salieron de la cara de la clienta

- Kicker del hero «PLATAFORMA MODULAR · BELLEZA ACTIVA» y su párrafo
  («Hoy funciona Ari Vivas Beauty… Los próximos módulos llegarán
  cuando estén probados, no antes.»).
- Titular «Módulos de La Asistenta» y el párrafo «La plataforma
  crece por módulos. Solo está activo lo que funciona de verdad; el
  resto se anuncia como lo que es: próximo.».
- La nota interna bajo la estantería («Un módulo se activa desde el
  registro central de la plataforma cuando sus dependencias están
  cumplidas y verificadas. Sin catálogos ni funciones de mentira.»).
- «Disponible ahora · Belleza» con «El módulo activo de la
  plataforma: el salón real…» y la nota «Es el catálogo real del
  módulo de Belleza: la carta del salón, servida desde su agenda.».
- Barrido en el resto de superficies de clienta: próxima apertura
  («el módulo se activará» → «se abrirá cuando esté verificado»),
  estado vacío de Explorar («Este módulo está activo» → «Esto ya
  está activo»), hub del Probador («del módulo de Belleza» y «Será
  un módulo nuevo de la plataforma» → lenguaje de usuaria) y los
  `proxima.preparando` del registro (moda, gafas y calzado) sin
  «módulo» ni «plataforma». **Ningún hecho cambió**: lo
  «próximamente» sigue diciéndose, claro y visible, en los chips de
  estado y en las pantallas de próxima apertura, cuyo contenido
  factual es el mismo. (`preparacion.porcentaje` y las notas del
  registro son documentación interna y nunca se pintaron en cara de
  clienta: verificado en el barrido.)

### Orden nuevo de la home (descubrimiento)

1. **Fila ligera del salón** (pin violeta + «Ari Vivas Beauty» +
   chevron → abre el salón) y **buscador píldora real**: al enviar,
   la búsqueda queda puesta en Explorar y filtra la carta de verdad
   con la lógica existente (sin duplicar buscador).
2. **Hero ligero**: una línea de valor de clienta («Analiza tus
   cejas con IA y reserva en minutos») + las dos acciones reales
   (Ver servicios y reservar / Analizar mis cejas con IA). Nada de
   explicar la arquitectura.
3. **La tarjeta grande fotográfica del salón como pieza
   principal**, a todo ancho: `cargarCarta` la pinta en
   `#tarjeta-salon-home` (clase `principal`); el carrusel queda solo
   con los servicios.
4. **«Servicios»**: acceso rápido a los servicios reales
   (carrusel de tarjetas que llevan a la reserva).
5. La tarjeta de análisis de cejas de siempre (con su botón de
   instalar la app).
6. **«Más en camino»**: estantería solo de futuro en formato
   ligero (sin sombra, tarjetas compactas). `pintarEstanteria`
   filtra desde el registro los de estado «proximamente»; si un día
   no hubiera ninguno, la sección entera se oculta. Cada tarjeta
   conserva su chip «Próximamente» y abre la próxima apertura
   existente.

### Verificación

- Baterías contra la máquina real: **web 32/32 · guarda 8/8 ·
  mecánicas 20/20**. La de fase2 (22/22) no se ha re-ejecutado
  porque no se ha tocado la agenda.
- **QA14** (`web/qa14/qa14_cdp.mjs`, Chromium por CDP en la
  máquina, 412×915): **31/31**. Orden de descubrimiento verificado
  por DOM (buscador → hero → salón → servicios → futuro); auditoría
  literal de textos prohibidos sobre la home renderizada (sin
  «módulo», «plataforma» ni «registro central»); la fila y la
  tarjeta del salón abren el salón; buscar «henna» en la home →
  Explorar con 1 resultado real (Ombré Brows Henna); **reserva REAL
  desde una tarjeta de servicio confirmada (AS-AAF8, Diseño de
  cejas, hoy 10:00) y cancelada en la limpieza**; las 3 tarjetas
  futuras con su chip intacto abren su próxima apertura con el
  contenido del registro; consola sin errores y sin desborde
  horizontal. (Primera pasada: 17/18 por un fallo del propio script
  de QA — celdas del calendario sin `data-fecha` —; corregido el
  script y repetida entera: 31/31.)
- Capturas revisadas una a una en `web/qa14/`
  (01 descubrimiento · 03 futuro · 04 próxima moda · 05 confirmada)
  y copias servidas en `web/icons/vista-home-descubrimiento.png` y
  `web/icons/vista-home-futuro.png`.
- SW → shell **v12**. Respaldos `*.bak-20261029-homefino` en local
  y en la máquina. Solo se reinició la web (pid 81915); webhook
  (48241) y agenda (79625) intactos. SHA-256 local = máquina en
  `index.html`, `sw.js` y `modulos.json`.
- **Nota para la próxima sincronización del repo público**: se
  actualizan `web/index.html`, `web/sw.js` y `web/modulos.json`, y
  se suma `web/qa14/`.

## PASE DE ELEVACIÓN VISUAL (29/10/2026): adiós a la «tienda barata»

Veredicto de Lee sobre la home del RE FINO (10:40): «Aun. No me
convence, parece una app de tienda barata». Diagnóstico aceptado:
el primer pantallazo lo ocupaba un panel de gradiente lavanda con
titular Montserrat extrabold gritado, guión violeta y DOS botones
rellenos compitiendo (negro + violeta sólido) — lenguaje de
plantilla SaaS —; la foto real del salón, el mejor activo, quedaba
empujada bajo el pliegue; y los datos (horario, servicios,
duraciones) iban como pegatinas de tinte violeta por todas partes.

### Dirección aplicada (premium = contención)

- **Foto primero**: la tarjeta del salón abre la home tras el
  buscador, con su foto a 332 px de alto; el panel `.hero` ha
  desaparecido del DOM (con su gradiente, su estrella decorativa,
  su regla y cualquier eyebrow/chip flotante) y debajo de la foto
  va la línea de valor en bloque editorial sobre blanco.
- **Tipografía editorial**: Fraunces para el titular de portada
  (30 px, peso 600, interlineado generoso — la MISMA frase de
  siempre, sin eslogan nuevo), el nombre del salón, los títulos de
  sección, las tarjetas, la recomendación, la confirmación y las
  reseñas (como cita impresa, en itálica). Montserrat queda para
  UI y cuerpo.
- **UNA acción principal**: botón negro píldora «Reservar» (mismo
  id y mismo destino que antes: Explorar). La secundaria, «Analizar
  mis cejas con IA», es un enlace de texto sobrio subrayado. La
  clase `.btn-lavanda` deja de ser violeta sólido en TODA la app:
  pasa a botón blanco con borde hairline; el violeta queda solo
  como acento de estado (selección, pestaña activa, enlaces,
  chips de estado).
- **Datos como texto**: `.chip-dato` y `.sc-dur` pierden el fondo
  de tinte; horario y servicios se leen como UNA línea gris
  tranquila («L–V 10–20 · S 10–14 · 4 servicios»). Los chips del
  resultado pasan a contorno hairline sobre blanco.
- **Sistema contenido en todas las pantallas de clienta**: sombra
  global reducida a un susurro (`--sombra`), tarjetas sin sombra
  con borde hairline y radio 20–24, fuera los gradientes de la
  tarjeta del probador y de las fichas sin foto, «Tu cita» como
  carta impresa (total con regla negra), transiciones a .18s ease
  respetando `prefers-reduced-motion`. La tarjeta de cejas de la
  home usa ahora la foto de henna (la del salón ya protagoniza la
  portada: nada de repetir imagen en la misma pantalla).
- **Solo presentación**: cero cambios de lógica, ids, textos
  factuales ni registro de módulos. `cita.html` ya hablaba en
  Fraunces: intacta. SW → shell **v13**. Respaldos
  `*.bak-20261029-elevacion` en local y en la máquina. Solo se
  reinició la web (pid 83446); webhook y agenda intactos.

### Verificación

- Baterías contra la máquina real: **web 32/32 · guarda 8/8 ·
  mecánicas 20/20** (fase2 no re-ejecutada: no se tocó la agenda).
- **QA15** (`web/qa15/qa15_cdp.mjs`, Chromium por CDP en la
  máquina, 412×915): **38/38**. Medido, no opinado: ausencia de
  `.hero`/eyebrow/chips en el DOM; bloque de valor sin gradiente
  (`background-image: none`) con titular en Fraunces a 30 px; foto
  protagonista a 332 px; botón principal computado
  `rgb(13,13,13)` con etiqueta «Reservar» y secundaria con fondo
  transparente; ningún botón de la home relleno de violeta;
  chip-dato con fondo transparente y los hechos intactos como
  texto; tarjetas con `box-shadow: none`. Y el recorrido funcional
  completo sigue vivo: fila → salón, buscar «henna» → Explorar con
  1 resultado, **reserva REAL confirmada (AS-AAGH) y cancelada en
  la limpieza**, la secundaria abre el consentimiento del análisis,
  las 3 próximas aperturas del registro, consola limpia y sin
  desborde horizontal.
- **Comparativa lado a lado** en `web/qa15/comparativa.png`
  (izquierda: la home rechazada, guardada antes del pase en
  `qa15/00-home-actual.png`; derecha: la nueva), revisada captura
  a captura. Veredicto propio, con 3 motivos concretos: **(1)** la
  foto real manda el primer pantallazo y el panel lavanda
  desaparece — antes la foto salía cortada bajo el pliegue;
  **(2)** una sola voz de acción: negro para reservar y texto para
  analizar, frente a dos botones rellenos compitiendo; **(3)**
  contraste editorial Fraunces/Montserrat y datos sin pegatinas:
  la app se lee como una carta impresa, no como un bazar.
  Matiz declarado: como la foto manda, el botón «Reservar» asoma
  en el pliegue como invitación a deslizar y se ve entero al
  primer toque de scroll; se descartó encoger la foto para
  forzarlo dentro.
- Capturas en `web/qa15/` y copias servidas en
  `web/icons/vista-elevacion-inicio.png` y
  `web/icons/vista-elevacion-salon.png`.
- **Nota para la próxima sincronización del repo público**: se
  actualizan `web/index.html` y `web/sw.js`, y se suma `web/qa15/`.

## HOME SEGÚN LA ESPEC, CON TEMÁTICA PROPIA (29/10/2026, mediodía)

- **Orden de Lee (12:26)**: «organiza mejor esto, eso no se parece
  a Fresha ¿le hiciste ingeniería inversa? La idea es dejar todo
  pero cambiar la temática: Fresha es buscadores, nosotros somos
  lo que somos. Las fotos no encajan, no se ve bien». Traducción
  ejecutada: la ORGANIZACIÓN de la portada vuelve a ser la de la
  ingeniería inversa (ESPEC_REFERENCIA §P1 y `referencia/01-home.png`
  como ley de layout) y el CONTENIDO es el de una asistenta de UN
  salón real: nada de categorías de marketplace ni de buscador de
  salones.
- **La home, en orden**: ① fila pin violeta + «Ari Vivas Beauty»
  en peso normal + chevron (abre el salón) como PRIMERA fila —
  la cabecera global ✦ ASISTENTA se oculta SOLO en Inicio
  (`body.en-inicio`, clase que pone `ir()`); sigue viva en el
  resto de pantallas y el Perfil se alcanza por la nav inferior ·
  ② buscador píldora (radio 999) que filtra la carta real como ya
  hacía · ③ rejilla 4×2 de pastillas #f5f5f5 radio 16 con NUESTRAS
  ocho entradas, todas funcionales: Reservar (reserva en el paso
  1) · Análisis IA (su flujo, o el resultado si ya hay análisis) ·
  Diseño de cejas / Ombré Henna / Brow Lamination / Depilación
  (siembran la reserva con ese servicio y saltan al paso 2, como
  las tarjetas) · El salón (su ficha) · WhatsApp (el wa.me público
  real) · ④ «Recomendado» en Montserrat 800 (sin serif) con
  carrusel al ~80 % y asomo: la tarjeta del salón ABRE el carrusel
  y detrás van los servicios con foto (Depilación sin foto, como
  siempre) · ⑤ la tarjeta sobria del «Probador de cejas» y «Más
  en camino» del registro, recolocados tras el Recomendado y sin
  tocar en espíritu.
- **La foto como tarjeta**: aspecto 4:3, `object-fit: cover` y
  encuadre elegido foto a foto con `object-position` propio —
  salón `center 30%` · Diseño `center 28%` · Ombré Henna
  `center 45%` · Laminación `center 40%` — verificado
  visualmente captura a captura: en las cuatro, el trabajo (las
  cejas / la escena) queda dentro, sin deformar y sin cortes
  raros. Nombre + línea tranquila DEBAJO de la foto, fuera de la
  imagen, como en la referencia; la pastilla de cristal con el
  hecho (duración / «Reservas abiertas») va sobre la foto.
- **Retirado de la portada**: el hero editorial `.portada-valor`
  con su titular en Fraunces; la tarjeta del salón a todo ancho
  (332 px) fuera del carrusel; la foto de henna duplicada dentro
  de la tarjeta de análisis; la barra de marca sobre la fila del
  salón. Fraunces sale de la portada (queda en la página de la
  cita y en la ficha del salón). Las pastillas pasan de radio 24
  a 16 y las tarjetas de 24 a 16 (medidas de la espec).
- **Ajuste medido contra la espec**: el botón del buscador era
  una pastilla de texto «Buscar» de 95 px y el conjunto medía
  74 px de alto; la referencia manda círculo negro de 56 con
  lupa y 58 de alto. Botón circular negro de 56 con lupa Lucide
  (en Inicio y en Explorar, es el mismo componente) y padding
  del buscador 8→1 px: el conjunto mide ahora 60 px.
- **QA16 — 40/40 a 412×915 contra la máquina real**
  (`web/qa16/qa16_cdp.mjs`): tabla elemento→medido (fila 17 px
  peso 400 y pin #6950f3 · buscador radio 999, alto 60, botón
  56 negro · pastillas radio 16, #f5f5f5, etiquetas 13 px peso
  400 · «Recomendado» Montserrat 800 · carrusel 79 % con asomo ·
  fotos 1,33 de aspecto, cover, con encuadre propio · sin
  Fraunces en la portada · sin desborde), CADA pastilla probada
  con clic, buscador filtrando de verdad, reserva REAL confirmada
  desde «Recomendado» (AS-AAGU) y cancelada en la limpieza,
  consola limpia. Baterías tras el pase: **web 32/32 · agenda
  (guarda) 8/8 · mecánicas 20/20**. Capturas en `web/qa16/` y
  copias servidas en `web/icons/vista-espec-inicio.png` y
  `web/icons/vista-espec-recomendado.png`.
- **Incidencia de verificación (no del producto)**: la capa de
  lectura de imágenes devolvió cuerpos ajenos para tres copias
  de `web/icons/` (una barbería y un vestido que NO existen en
  el proyecto, y una captura de la home antigua). Verificación
  cruzada: los SHA-256 de las imágenes SERVIDAS coinciden con
  los ficheros reales del proyecto; el DOM vivo reporta
  `currentSrc` y tamaños naturales correctos en las 4 tarjetas;
  y las capturas validadas por sus bytes exactos (base64 vía
  exec) muestran la home nueva con las fotos reales bien
  encuadradas. Ningún fichero de imagen cambió en este pase.
- SW del cascarón a **v14**; web reiniciada (pid 87208) con el
  resto de servicios intactos. Respaldos
  `index.html.bak-20261029-espec` y `sw.js.bak-20261029-espec`
  en local y en la máquina.
- **Nota para la próxima sincronización del repo público**: se
  actualizan `web/index.html`, `web/sw.js` y `web/modulos.json`
  (pendiente de pases anteriores), y se suman `web/qa14/`,
  `web/qa15/` y `web/qa16/`.

## ARREGLO DE ORIENTACIÓN DE IMÁGENES (29/10/2026, mediodía) — QA17

Queja de Lee con captura de su móvil (12:51): en Explorar, la foto
de «Ombré Brows Henna» se veía DEL REVÉS (labios arriba, frente
abajo). Diagnóstico foto a foto leyendo los píxeles reales y el
EXIF de cada imagen servida (las cinco de `web/img/` llegaron SIN
EXIF al recomprimirse en su día: si los píxeles nacieron girados,
ninguna etiqueta los salvaba):

| Foto | Tamaño | Orientación encontrada | Corrección aplicada |
|---|---|---|---|
| salon.jpg | 1023×1537 | Recta (Arianna trabajando) | Ninguna (bytes intactos) |
| diseno.jpg | 720×1280 | **Girada 90°**: la cara de lado, eje ojos-boca casi horizontal | Rotación 90° CCW horneada en los píxeles → 1280×720; la versión CW se probó y dejaba la cara invertida (descartada) |
| henna.jpg | 720×1280 | **Invertida 180°**: barbilla/labios arriba, frente abajo — la queja de Lee | Rotación 180° horneada en los píxeles; queda 720×1280 |
| laminacion.jpg | 1200×960 | Recta (primer plano de cejas laminadas) | Ninguna (bytes intactos) |
| lounge.jpg | 1100×1100 | Recta («the LOUNGE» legible) | Ninguna (bytes intactos) |
| ejemplo.jpg (stock del análisis) | 1200×1800 | Recta, con EXIF de orientación = 1 (normal) | Ninguna |

- Las dos corregidas se guardaron SIN etiqueta de orientación,
  calidad 88, ≤ 250 KB (henna 235 KB · diseno 181 KB). La fuente
  sigue siendo la foto real del salón: solo se giraron los
  píxeles, nada sustituido. Originales respaldados en
  `backups/2026-10-29_pre-orientacion/` (local y máquina) y
  `index.html`/`sw.js` como `*.bak-20261029-orientacion`.
- **Encuadres tras el arreglo**: el mapa `FOTOS` manda ahora
  diseno `center` (al ser horizontal, el centro conserva la cara
  en el 4:3 y en Explorar), henna `center 25%` (antes 45%, elegido
  para la foto invertida) y laminacion `center 40%` (sin cambio).
  Explorar (`tarjetaProducto`) usa por fin el MISMO `pos` por foto
  que el carrusel (antes todas compartían el `center 30%` del CSS).
  La tarjeta de análisis (`.tc-foto`, diseno) y la cabecera del
  salón (salon, 22%) quedan como estaban: con las fotos rectas
  encuadran bien, verificado en QA17.
- **SW a v15**: las fotos viejas vivían en la caché EXTRAS del
  cascarón; sin subir la versión, los móviles seguirían viendo la
  henna del revés aunque el servidor ya sirviera la recta.
- **QA17 — 12/12 capturas a 412×915 revisadas una a una desde
  sus bytes** (`web/qa17/qa17_cdp.mjs`; tamaños de descarga =
  tamaños en la máquina, sin cuerpos ajenos esta vez): Inicio,
  Recomendado tarjeta a tarjeta (salón/diseño/henna/laminación),
  Explorar completa (diseño, henna — la de la queja, ya recta —,
  laminación y depilación SIN foto con su icono honesto), salón
  (cabecera y Lounge) y tarjeta del Probador. Veredicto por foto:
  **recta SÍ y encuadre digno SÍ en las 5 fotos y en todas sus
  superficies**. Medidas DOM: naturales servidos 1280×720
  (diseno) y 720×1280 (henna) con los object-position nuevos
  computados en vivo. Baterías tras el arreglo: **web 32/32 ·
  agenda (guarda) 8/8 · mecánicas 20/20**. Web reiniciada (pid
  89137); webhook y agenda intactos. SHA local = máquina en
  `web/img/henna.jpg`, `web/img/diseno.jpg`, `web/index.html` y
  `web/sw.js`. Capturas también servidas en `web/icons/qa17-*.png`
  (la de enseñar a Lee: `qa17-07-explorar-henna.png`).
- **Nota para la próxima sincronización del repo público**: se
  suman `web/img/diseno.jpg`, `web/img/henna.jpg` (corregidas) y
  `web/qa17/` a lo ya anotado en el pase anterior.

## 44. QA18 — BARRIDO COMPLETO + MATRIZ FUNCIONAL (29/10/2026, orden de Lee «la app debe funcionar totalmente»)

Recorrido entero a 412×915 con clics (CDP, capturas revisadas
desde los bytes), como clienta y como profesional, en 3 fases:
A (visual: A1/A2/A3), B (matriz funcional ejecutada) y C
(verificación de los arreglos). Baterías antes y después:
**web 32/32 · guarda 8/8 · mecánicas 20/20 · fase2 22/22**.
Trabajo en `web/qa18/` (scripts `qa18_a*.mjs`, `qa18_b.mjs`,
`qa18_c.mjs`, logs y `DEFECTOS_QA18.md`). Respaldos previos en
`backups/2026-10-29_pre-qa18/`. **SW v15 → v16.**

### Defectos corregidos en la pasada (verificados en la fase C)

- **D-04 (ALTA)** Barra «Reservar ahora» del salón fuera de la
  pantalla (left 206/right 558 en viewport 412; p-salon era la
  única pantalla con desborde, scrollW 558). Causa: la animación
  «sube» terminaba en `transform:none` con fill `both` y anulaba
  el centrado `translateX(-50%)`; además la barra vivía dentro de
  la pantalla (bloque contenedor del fixed). Arreglo: barra a
  nivel global + keyframes propios `subeBarra`. Tras el arreglo:
  barra y botón enteros dentro del viewport, scrollW 412
  (`web/icons/vista-barrido-salon-barra.png`).
- **D-01 (MEDIA)** Pie global con el lema del módulo de moda
  dormido («Descubre cómo te quedaría antes de comprarlo») →
  lema de marca «Tu belleza, mejor entendida».
- **D-02 (MEDIA)** `cita.html` decía siempre «CONFIRMADA» y
  ofrecía preparar/reagendar/cancelar sobre citas ya cumplidas.
  Ahora pinta el estado real, ofrece acciones solo con la cita
  viva y muestra el aviso «Esta cita ya se realizó…»
  (`web/icons/vista-barrido-cita-cumplida.png`).
- **D-03 (BAJA)** «← Volver» de la próxima apertura siempre iba a
  Inicio → ahora vuelve a la pantalla de origen (verificado
  desde Explorar, Probador e Inicio).
- **D-06 (BAJA)** Pastilla «Próximamente» en posición variable
  entre tarjetas hermanas → siempre en su línea bajo el nombre.
- **D-09 (MICRO)** Mensaje de enlace no válido con mayúscula.

### Abiertos (con motivo)

- **D-02b (MEDIA-ALTA, agenda)** Se puede CANCELAR una cita ya
  cumplida desde su enlace (reagendar sí está protegido).
  Reproducción exacta en `web/qa18/DEFECTOS_QA18.md` (evidencia:
  cita AS-AAHW). Recomendación: guarda simétrica en el cancelar
  de la agenda + prueba en la batería de mecánicas. No se
  parcheó la agenda en una pasada de organización; la mitad
  visible ya está cerrada por D-02.
- **D-05 (MEDIA, operativo)** La agenda del piloto arrastra
  restos de las QA anteriores (25 citas de prueba en «Hoy» el
  29/10 y mensajes de prueba en la bandeja). Recomendación:
  limpieza antes del ensayo del 02/11; la decisión es del
  principal (son datos del negocio).

### Matriz funcional ejecutada (evidencia: logs de las fases A/B/C)

| Función | Veredicto | Evidencia |
|---|---|---|
| Reserva E2E con pack (Diseño+Henna, 48 €, 90 min) | FUNCIONA | Código AS-AAHS; en agenda: confirmada, 90 min, 03/11 10:00 |
| .ics de la cita | FUNCIONA | DTSTART/DTEND correctos (10:00–11:30), código y enlace en la descripción |
| Enlace mágico: ver cita | FUNCIONA | Datos, código y estado correctos |
| Preparación de la cita (prep) | FUNCIONA | Guardada en la interfaz y verificada en la agenda |
| Reagendar desde el enlace | FUNCIONA | 03/11 → 04/11 verificado en agenda, mismo código |
| Cancelar desde el enlace | FUNCIONA | La cita queda `cancelada`, no borrada |
| Lista de espera: alta → hueco libre → por avisar → panel | FUNCIONA | Re-ejecutada íntegra en la fase C (entrada id 28; chip «¡Hueco liberado!»; descarte OK). Anomalía única no reproducible en la fase A3, registrada en DEFECTOS_QA18.md |
| Análisis de cejas E2E (foto de ejemplo autorizada) | FUNCIONA | Resultado real de Muse Spark; latencia medida en la interfaz: 12,2 s (11,6 s en el log del servidor) |
| Guardar look en Perfil y borrarlo | FUNCIONA | Aparece en «Mis looks» y el borrado deja el estado vacío |
| Profesional: acceso sin clave / clave mala | FUNCIONA | 401 sin datos; mensaje de clave no válida sin abrir el panel |
| Profesional: Cumplida / No vino / Cancelar | FUNCIONA | Las 4 acciones ejecutadas sobre citas de prueba y verificadas en la agenda |
| Profesional: bandeja con wa.me | FUNCIONA | Enlace correcto con teléfono; «Sin teléfono guardado» sin él |
| Profesional: Hoy / Agenda 7 días / Mi negocio | FUNCIONA | Cargan con datos reales (embudo, carta, horario) |
| Error: domingo cerrado | FUNCIONA | 0 huecos + motivo por API; día deshabilitado en el calendario |
| Error: hueco ocupado al confirmar (409) | FUNCIONA | Mensaje legible con huecos libres; la cita en conflicto no se crea |
| Error: buscador sin resultados | FUNCIONA | Mensaje claro, 0 tarjetas |
| Error: análisis sin foto / foto inválida | FUNCIONA | Botón deshabilitado sin foto; 400 legibles por API (sin imagen, base64 basura, no-data-URI); el 4.º caso quedó tras el rate-limit, que también responde con mensaje legible |
| Error: /cita/<token inventado> | FUNCIONA | Error digno visible, sin spinner colgado |
| PWA: actualización v15 → v16 | FUNCIONA | Tras navegar, la única caché es `la-asistenta-shell-v16` y manda el cascarón nuevo (pie nuevo servido); la actualización es inmediata al navegar (skipWaiting + limpieza en activate) |
| Disponibilidad tras pausa (arranque documentado) | FUNCIONA | `arrancar.sh` idempotente; /salud en verde de web (8090) y agenda (8081); el webhook (8080) responde (404 en la raíz = su comportamiento, solo acepta POST de Twilio) |
| WhatsApp real (sandbox de Twilio) | NO PROBABLE SIN LEE | Exige su gesto físico (mensaje real al sandbox); el canal está cableado y probado por TwiML |

Transversal: **cero errores JS de consola** en todo el recorrido,
cero textos cortados, cero botones sin función; modo sin conexión
muestra la portada guardada con su aviso. Las citas de la QA18
llevan nombre «QA18 …», quedaron en estados finales correctos y
los bloqueos de prueba, cancelados.

### Nota de sync para el repo público

Se suman a lo pendiente: `web/index.html`, `web/cita.html` y
`web/web_server.py` (arreglos QA18), `web/sw.js` (v16),
`web/modulos.json` (de QA17), `web/qa18/` (scripts, logs y
DEFECTOS) y las capturas `web/icons/vista-barrido-*.png`. Fuera
del repo, como siempre: logs con rutas internas se revisan antes
de subir y ningún fichero con claves o tokens.

## 45. CIERRE DE LOS ABIERTOS DE QA18 — D-02b y D-05 (29/10/2026, orden de Lee «la app debe funcionar totalmente»)

Baterías finales, todas contra la máquina real con el código ya
corregido: **web 32/32 · guarda 8/8 · mecánicas 23/23 (total
nuevo: +3 de D-02b) · fase2 22/22**. Respaldos previos:
`agenda/*.bak-20261029-d02b` (código) y
`backups/agenda.db.bak-20261029-d05` (BD, copia en línea con las
263 citas del momento).

### D-02b (MEDIA-ALTA) — CERRADO: guarda simétrica al cancelar

- **Reproducción antes del arreglo**: las 3 pruebas nuevas de la
  batería de mecánicas fallaron exactamente como el defecto
  (20/23): cancelar una cita cumplida por id y por su enlace
  mágico devolvía 200 y la cita quedaba «cancelada».
- **La guarda** vive en la agenda, que es donde viven todas las
  demás: `_bloqueo_cancelacion(estado)` en
  `agenda/agenda_api.py`, aplicada a `POST /citas/<id>/cancelar`
  y a `POST /enlace/<hash>/cancelar`. Una cita «cumplida»
  responde **409 «Esta cita ya se realizó»** y una «no_show»,
  409 «Esta cita ya pasó y quedó marcada como no realizada»; en
  ambos casos el estado queda intacto. Una «confirmada» cancela
  como siempre y una ya «cancelada» sigue respondiendo 200 sin
  cambios (idempotente, como esperan las baterías).
- **MCP (WhatsApp/Hermes)**: `cancelar_cita` en
  `agenda/mcp_agenda.py` aplica la misma guarda con ValueError
  legible. Verificado contra una COPIA de la BD
  (`AGENDA_DB=/tmp/mcp_test.db`, la real no se tocó): cumplida
  rechazada («Esta cita ya se realizó…», estado intacto),
  no_show rechazada, confirmada cancela, ya-cancelada
  idempotente.
- **Web**: sin cambios de código — los proxies de
  `web_server.py` propagan el 409 con su mensaje (enlace mágico
  y área profesional), y `cita.html` ya no ofrecía la acción
  desde D-02. La batería web lo cubre end-to-end: su paso de
  limpieza del área profesional quedó ACTUALIZADO al nuevo
  contrato («profesional: limpieza D-02b, la «no_show» no se
  cancela (409) y queda cerrada») — el paso antiguo forzaba
  cancelar tras marcar no_show, un resto de cuando cancelar no
  tenía guarda; con la guarda, ese paso dio el único fallo de la
  primera pasada post-arreglo (31/32) y ahora verifica la guarda
  en vez de contradecirla.
- **Pruebas nuevas en `agenda/pruebas_mecanicas.py`** (sección
  10b): cancelar una cumplida por id → 409 con el mensaje;
  cancelarla por su enlace → 409; la cita sigue «cumplida» tras
  ambos intentos. Total de la batería: 20 → **23/23**.

### D-05 (MEDIA) — CERRADO: limpieza de los restos de prueba

Script `agenda/limpiar_d05.py` (queda en el proyecto; primero se
ejecutó con `--solo-informe`). Informe completo en
`web/qa18/LIMPIEZA_D05.md`.

- **Regla de identificación (conservadora)**: es «de prueba»
  solo lo que lleva la marca de las baterías/QA en el nombre —
  empieza por «PRUEBA» (cualquier capitalización) o por «QA» +
  dígito. Los teléfonos de batería (600111222, 611222333,
  600123456, 600000000, +34600123456, +34600999888) corroboran
  en el informe pero nunca bastan solos. Todo lo demás NO se
  toca y se lista.
- **Ejecución** (vía API, con sus eventos): ANTES citas
  {cancelada 248 · confirmada 6 · cumplida 27 · no_show 3},
  bandeja pendiente 6 → **1 cita cancelada** (id 282 «PRUEBA
  PROFESIONAL», residuo confirmada de una pasada de la batería
  web abortada por el rate-limit; ocupaba hoy 19:30) y **6
  mensajes de la bandeja descartados** (ids 23, 24, 25, 28, 30,
  31, todos «PRUEBA MECANICAS 2») → DESPUÉS citas {cancelada
  249 · confirmada 5 · cumplida 27 · no_show 3}, **bandeja
  pendiente 0**. Como siempre: nada se ha borrado; las citas de
  prueba en estados terminales son historial y quedan.
- **NO tocadas, para decisión del principal** (sin marca de
  prueba inequívoca): citas **3 «Lucía», 4 «Marta» y 5 «Elena»**
  (whatsapp, sin teléfono, 02/11 10:00/10:00/11:30 — creadas el
  27/10 en una ráfaga de 33 min junto a la ya cancelada 2
  «Carmen», patrón de las primeras pruebas del receptor, pero
  sin marcador: se dejan) y **73/74 «Arianna»** (tel. omitido en la copia pública,
  web, hoy 11:00 Henna y mañana 19:45 — creadas el 28/10 a dos
  minutos una de otra; parecen la propia Arianna probando su
  web: se dejan).
- **Verificación de cierre** (tras la última batería web):
  citas {cancelada 253 · confirmada 5 · cumplida 27 · no_show
  5} — los +2 no_show y +4 cancelada son las propias pasadas de
  verificación, que se auto-cierran en estados terminales;
  **confirmadas vivas de prueba: 0** (las 5 vivas son las
  ambiguas listadas); **«Hoy» sin ninguna cita viva de prueba**;
  **bandeja pendiente total: 0**. La lista de espera no se ha
  tocado en esta limpieza: la anomalía única de QA18 queda como
  estaba registrada, sin reabrir.
- **Transparencia operativa**: las repeticiones de la batería
  web agotaron los rate-limits en memoria del servidor web
  (acceso profesional 8/15 min; reservar 30/h, desde localhost).
  Dos pasadas intermedias fallaron SOLO por eso (429 en cascada)
  y una tercera por el hueco 19:30 que ocupaba el residuo 282 —
  liberado por la propia limpieza. La pasada final (32/32) se
  hizo tras rearrancar la web (pid 96201), que reinicia los
  contadores; los límites quedan activos y sin tocar.
- **Cierre final de las 5 ambiguas (29/10/2026)**: Lee autorizó
  expresamente su cancelación (29/10 13:57: «Cancela las 5, son
  de nuestras pruebas»). Ejecutado el mismo día con
  `agenda/cancelar_5_autorizadas.py`, siempre vía API
  (`POST /citas/<id>/cancelar`, 200 en las cinco; nada borrado):
  **3 «Lucía»** (02/11 10:00), **4 «Marta»** (02/11 10:00),
  **5 «Elena»** (02/11 11:30), **73 «Arianna»** (29/10 11:00) y
  **74 «Arianna»** (30/10 19:45) constan ahora «cancelada».
  Verificación posterior: **confirmadas vivas en la agenda: 0**
  (de prueba o de cualquier tipo), **«Hoy» del área profesional
  limpio**, conteos {cancelada 258 · cumplida 27 · no_show 5}
  antes de las baterías de control, que cerraron en verde:
  **guarda 8/8 · mecánicas 23/23** (sus propias citas de prueba
  se auto-cierran en estados terminales, como siempre). Con
  esto la agenda del piloto queda sin ninguna cita viva de
  prueba de cara al ensayo del 02/11.

### Nota de sync para el repo público

Se suman a lo pendiente: `agenda/agenda_api.py`,
`agenda/mcp_agenda.py`, `agenda/pruebas_mecanicas.py`,
`agenda/limpiar_d05.py`, `agenda/cancelar_5_autorizadas.py`,
`web/pruebas_web.py` (paso D-02b),
`web/qa18/DEFECTOS_QA18.md` (cierre de abiertos) y
`web/qa18/LIMPIEZA_D05.md`. Los respaldos `*.bak-20261029-d02b`
y la copia de BD de `backups/` quedan fuera del repo.

## 46. PAQUETE DE ENTREGA DEL HACKATHON + PRE-ENSAYO TÉCNICO QA19 (29/10/2026)

Con la app verificada (QA18 + cierre §45), este paquete prepara
TODO lo que el jurado ve además de la app, para que el 04/11 sea
pegar y subir. Entregable: **`ENTREGA_HACKATHON.md`** (raíz del
proyecto, en inglés, listo para pegar en el formulario): nombre y
tagline, descripción corta y larga (problema, solución, piloto
real), «How we used Meta technology» (Muse Spark como cerebro en
producción sobre Baseten en sus dos puestos — análisis web y
operadora de WhatsApp sobre Hermes —; Muse Image + SAM 3.1 como
integración preparada y etiquetada como tal), impacto con las
cifras de MEDICIONES.md y las baterías, «built with», enlaces
(repo + app en vivo) y el guion final del vídeo de 3 minutos
alineado con el runbook `ENSAYO_Y_DEMO.md` §2 (qué se graba en el
ensayo del 02/11, en qué orden y con qué textos en pantalla). El
propio documento marca con ⚠️ PENDING los campos no cerrados:
**la URL del vídeo** (se graba tras el ensayo del 02/11) y **la
confirmación viva de WhatsApp** (mensaje real de Lee + conversación
completa, el 02/11). Regla de oro aplicada: solo afirmaciones
verificadas; lo preparado-y-dormido va etiquetado.

### Pre-ensayo técnico de la secuencia de demo (QA19)

Script `web/qa19/preensayo.mjs` (CDP a 412×915 contra la app real
en la máquina, misma plomería que QA18; log
`web/qa19/log-preensayo.json` y 8 capturas `p01…p08` en
`web/qa19/`). **Sin gastar ni un mensaje de Twilio**: la pata de
WhatsApp es el ensayo del 02/11. Resultado: **8/8 pasos OK, 0
errores de consola, scrollW 412 en todos los pasos** (sin desborde
horizontal). La cita creada se llamó «Pre-ensayo Demo» y quedó
**cancelada** al terminar, como siempre.

| # | Paso | Resultado | Tiempo |
|---|---|---|---|
| 1 | Abrir la app | OK | 1,9 s (interactiva en 715 ms; home según espec, SW controlando) |
| 2 | Buscar un servicio («henna») | OK | 1,5 s (aterriza en Explorar con «Ombré Brows Henna» visible) |
| 3 | Ver el Recomendado | OK | 2,7 s (carrusel de 4 tarjetas: salón + Diseño 18 € · Henna 30 € · Lamination 45 €; el deslizamiento funciona, scrollLeft 333) |
| 4 | Análisis de cejas con la foto de ejemplo | OK | 20,0 s el paso; **análisis 15,1 s de extremo a extremo en la interfaz** (12,26 s de modelo, lo que la propia app declara en su aviso) |
| 5 | Reservar el servicio recomendado | OK | 4,7 s («Reservar este servicio» siembra el paso 2; cita AS-AAKU, hoy 29/10 10:00 — ver hallazgo) |
| 6 | Confirmación con código y enlace mágico | OK | 3,1 s (el enlace abre la cita: CONFIRMADA, AS-AAKU, datos correctos) |
| 7 | Vista de la profesional en su panel | OK | 4,9 s (clave del negocio; AS-AAKU localizada en «Hoy») |
| 8 | Cancelar la cita de la demo | OK | 6,2 s (cancelada desde el enlace; sigue cancelada tras recargar) |

Detalle del paso 4: la puerta de consentimiento se verificó
(botón deshabilitado hasta aceptar); Spark recomendó **Diseño de
cejas (18 € · 25 min)** con alternativa Brow Lamination, y la
pantalla de resultado declara ella misma que la propuesta visual
aún no está disponible y que no se muestran imágenes falsas — la
etiqueta honesta de Muse Image/SAM funciona en producción, no
solo en los documentos. **Entrada para la decisión del runbook
(§2, plano 1:50–2:15)**: 15,1 s está muy por debajo del criterio
de ~45 s para grabar el análisis EN VIVO (QA18 midió 12,2 s el
mismo día); el plan es grabarlo en vivo en el ensayo, con el plan
B etiquetado del runbook si Baseten entra en racha lenta.

### Hallazgo menor (documentado, NO parcheado en este paquete)

`GET /api/disponibilidad` para el día en curso devuelve la jornada
completa **sin filtrar las horas ya pasadas**: a las ~16:25 el
primer hueco ofrecido de hoy era las 10:00, y la reserva se
completó en esa hora pasada (así lo eligió el script, que toma el
primer hueco; una persona elige un hueco con sentido). Sin impacto
en la demo ni en el ensayo (se elige hueco futuro), pero es una
observación real de producto. **Recomendación**: filtrar en la
disponibilidad las horas pasadas del día en curso, con su prueba
en la batería web. No se ha parcheado aquí por disciplina de
alcance: el núcleo de reservas no se toca en semana de entrega
salvo decisión expresa del principal.

### Qué falta EXACTAMENTE para entregar

1. **Ensayo general 02/11 con Twilio real** (runbook
   `ENSAYO_Y_DEMO.md` §1, 13 mensajes de 100 presupuestados):
   incluye el mensaje real de Lee al sandbox, que es el gesto que
   desbloquea la fila «WhatsApp real» de la matriz — hasta
   entonces sigue marcada NO PROBABLE SIN LEE, sin disfraz.
2. **Grabación del vídeo de 3 min** (tarde del 02/11 o 03/11,
   según el runbook §2) y su URL, que rellena el campo ⚠️ de
   `ENTREGA_HACKATHON.md`.
3. **Congelación del repo el 04/11**: diff pequeño sobre la sync
   auditada de hoy (commit `0eddb61`): notas del ensayo,
   `ENTREGA_HACKATHON.md`, este ESTADO y `web/qa19/`, tras la
   auditoría de secretos por dos vías de siempre. Objetivo
   interno: entregado el 04/11 a las 23:00 Madrid (deadline
   oficial: 04/11 21:00 ET = 05/11 03:00 Madrid).

No bloquean la entrega (quedan como están declarados): la
rotación del token de la agenda (preparada, espera el OK de Lee)
y la clave de equipo de Meta (Muse Image/SAM 3.1 se entregan
declarados como integración preparada).

### Nota de sync para el repo público

Se suman a lo pendiente de la congelación del 04/11:
`ENTREGA_HACKATHON.md` y `web/qa19/` (script, log y capturas del
pre-ensayo). La cita AS-AAKU del pre-ensayo consta «cancelada» en
la agenda: la agenda del piloto sigue con **0 citas vivas**.

## 47. CIERRE DEL HALLAZGO QA19 — HUECOS EN EL PASADO (29/10/2026)

El hallazgo de §46 queda **CERRADO**: ninguna vía puede ya ofrecer
ni crear una cita cuyo inicio ya pasó. La hora que manda es la del
salón (Europe/Madrid), no la UTC del servidor — la máquina vive en
UTC y sin esta distinción el filtro habría fallado cada tarde.

**Piezas** (solo `agenda/`; ni `web/index.html` ni
`web/web_server.py` se han tocado en esta pasada):

- `agenda_comun.py`: `ZONA_SALON`, `ahora_salon()`,
  `inicio_en_pasado(fecha, hora)` y `corte_hoy(fecha)` — la regla
  vive una sola vez y la comparten API y MCP.
- **Disponibilidad**: `huecos_de` (API — los huecos del enlace
  mágico) excluye los inicios <= ahora cuando la fecha es HOY;
  días futuros y domingo cerrado intactos, lógica de solapes sin
  tocar. El MCP (`consultar_disponibilidad`) filtra igual, y las
  «alternativas» de los 409 de creación/reagendación pasan por el
  mismo corte: ninguna respuesta de la agenda ofrece ya pasado.
- **Creación**: guarda dentro de la transacción de `POST /citas`,
  DESPUÉS de resolver la idempotencia — un reintento legítimo
  sigue devolviendo su cita original aunque su hora haya quedado
  atrás; una creación NUEVA con inicio en el pasado → **409 «Esa
  hora ya pasó: elige un hueco a partir de la hora actual o de
  otro día»**, sin cita creada. El MCP (`registrar_cita`) rechaza
  con el ValueError equivalente, con instrucciones a Hermes de
  ofrecer el próximo hueco libre. Y **reagendar** por el enlace a
  una hora pasada → el mismo 409 (puerta simétrica en la misma
  función: mover una cita al pasado era el mismo agujero).

**Evidencia antes/después (máquina real, jueves 29/10)**:

- ANTES (16:31): huecos de hoy por la vía del enlace = **39,
  primero 10:00**; crear hoy a las 10:00 → **201** (cita creada
  en hora pasada, reproducido el hallazgo de QA19).
- DESPUÉS (16:33): huecos de hoy = **12, primero 16:45** (el
  siguiente cuarto de hora); crear hoy a las 10:00 → **409 «Esa
  hora ya pasó»**; la creación futura sigue intacta (201).
- MCP verificado contra una COPIA de la BD (la real no se tocó):
  registrar hoy 10:00 y ayer 12:00 → ValueError «ya pasó»;
  disponibilidad de hoy toda futura (12 libres, primera 16:45);
  registro futuro normal OK.
- Despliegue: API de agenda reiniciada sola (pid 99376) y
  **gateway de Hermes relanzado** con `run-logs/relanzar_gateway.py`
  (gateway pid 99529, MCP nuevo pid 99635) para que la guarda
  viva también en la vía WhatsApp; webhook y web intactos,
  `/salud` ×3 en verde.

**Pruebas**: 3 nuevas en `pruebas_api_guarda.py` (disponibilidad
de hoy sin pasados por la vía del enlace; crear en pasado → 409
«ya pasó»; el intento no crea ninguna cita). **Baterías finales:
web 32/32 · guarda 11/11 (antes 8/8) · mecánicas 23/23 · fase2
22/22.**

Incidencia de la pasada (ajena al arreglo): el primer pase de la
batería web dio 30/31 porque el hueco 30/10 10:00 estaba ocupado
por la cita **312 «PRUEBA WEB E2E» confirmada**, residuo de una
pasada abortada de la propia batería (creada 15:34 UTC sin llegar
a su limpieza del paso 9). Cancelada como artefacto de prueba
— con la regla D-05: marcador inequívoco, cancelar y nunca
borrar — y la batería repetida: **32/32**. La guarda nueva no
podía ser la causa: solo rechaza inicios pasados y ese hueco es
futuro.

**Nota honesta de alcance**: la lista de huecos que pinta la web
la calcula `web_server.py` en local (no pasa por `huecos_de`).
Lo que este arreglo garantiza en la capa autoritativa de la
agenda es que ninguna superficie puede CREAR ni REAGENDAR a una
hora pasada — la invariante de fiabilidad — y que las
disponibilidades servidas por la agenda (enlace y MCP) ya no
ofrecen pasado. El filtro de la lista web pertenece al trabajo
en curso sobre `web_server.py`.

Respaldos `*.bak-20261029-pasado` (local y máquina) de los cuatro
ficheros tocados. **Nota de sync** para la congelación del
04/11: se suman `agenda/agenda_comun.py`, `agenda/agenda_api.py`,
`agenda/mcp_agenda.py` y `agenda/pruebas_api_guarda.py`.

## 48. CABLEADO META COMPLETO — el probador visual de cejas queda dormido pero enchufado (29/10/2026)

Orden de Lee (16:23): «dejar cableado todo para cuando tengamos
[la clave]; deja la app como Fresha manteniendo nuestro enfoque».
Fontanería invisible: **la app no cambia visualmente en nada**
sin clave (verificado abajo); el día que la clave de equipo de
Meta exista, el probador visual se enciende sin obra siguiendo
`ACTIVACION_META.md`.

**Piezas nuevas:**

- `probador/proveedor_meta.py` — cliente de la Meta Model API
  (`https://api.meta.ai/v1`, Bearer) cumpliendo el contrato de
  INTERFACES.md §4: `listar_modelos()`, `editar_cejas()` (Muse
  Image, 0,01 $/imagen oficial) y `segmentar()` (SAM 3.1,
  0,0025 $/imagen), con la instrucción de edición construida SOLO
  desde el análisis validado de Spark (estrategia A del benchmark
  H1). La clave se lee SOLO del entorno del servidor (variable
  `META_MODEL_API_KEY` o `web/meta.env`, 0600, solo máquina), en
  cada llamada y sin caché: nunca está en el repo ni en los logs.
  Errores mapeados: 401 → `ClaveNoValida` sin reintentos (estado
  interno del operador); 429 → espera (Retry-After) y reintentos
  acotados → `LimiteAlcanzado`; 5xx/timeout/red → reintentos
  acotados → `ErrorProveedor`; sin clave →
  `ProveedorNoConfigurado` sin hacer ninguna llamada.
  ⚠️ **A confirmar con la primera llamada real** (marcado en el
  código y en ACTIVACION_META.md, no inventado): la forma exacta
  de la petición de edición de `muse-image-1.0` y la invocación
  de SAM 3.1 — la documentación oficial recopilada (BENCHMARK_H1
  §1.2) no las fija; SAM consta como protocolo de streaming con
  librerías oficiales (meta-models/meta-sam). Si difieren, se
  ajusta solo ese fichero.
- `probador/stub_meta.py` — stub local de api.meta.ai para
  probar sin clave y sin gasto (modelos, Responses con imagen,
  máscara SAM, y comportamientos 401/429/lenta gobernados por la
  clave falsa que reciba).
- `probador/test_proveedor_meta.py` — 13 pruebas contra el stub
  por HTTP real: petición bien formada, respuesta procesada y
  payload listo para guardarse como look, errores mapeados y el
  interruptor volcándose con claves falsas (entorno y fichero).

**Cableado en la web (sin cambio visual sin clave):**

- `GET /api/capacidades` expone `probador_visual_cejas.disponible`
  según haya clave en el entorno. `web/modulos.json` NO se toca
  (es estático; la capacidad es dinámica y vive en este endpoint).
- El trabajo de análisis (`ejecutar_analisis`) devuelve el payload
  de siempre más `visual: {disponible: false}`; el aviso y la
  pantalla quedan **exactamente** como estaban. Con capacidad, el
  mismo trabajo encadena `editar_cejas()` y el payload trae la
  imagen; si la generación falla, el análisis se entrega igual y
  el fallo queda en el log interno (`visual_clave_no_valida`,
  `visual_error`) — a la clienta solo le llega un mensaje
  genérico, jamás el 401 ni la palabra «clave».
- `index.html`: bloque «PROPUESTA VISUAL · ORIENTATIVA» en el
  resultado y párrafo de consentimiento que nombra a Meta (Muse
  Image), ambos `display:none` por defecto y solo visibles si el
  payload/la capacidad los trae (INTERFACES.md §2: el proveedor
  se cuenta ANTES de enviar la foto). «Guardar este look» guarda
  también la imagen GENERADA (nunca la foto original; tope de
  1,5 MB para no reventar el almacenamiento del dispositivo) y
  *Mis looks* la enseña en miniatura. SW → shell **v17**.

**Verificación (sin clave real y sin gasto; prohibido llamar a
api.meta.ai en esta fase y no se ha llamado):**

- Probador: **18/18** (13 nuevos de Meta + 5 de FASHN), en local
  y en la máquina.
- **Vuelco del interruptor contra la máquina real: 15/15**
  (script en `run-logs/flip_meta.py`): instancia de PRUEBA de la
  web (puerto 8099) con clave falsa apuntando al stub (18123) —
  `/api/capacidades` vuelca a `disponible: true`; análisis REAL
  con la foto de ejemplo → payload con visual listo de
  `meta-model-api`/`muse-image-1.0`, imagen del stub procesada y
  aviso nuevo; con la clave rechazada (401) → análisis entregado
  igual, visual en error genérico sin filtrar nada, y el log
  interno registra `visual_clave_no_valida`. Producción (8090)
  respondió `disponible: false` antes y después, intacta; el
  fichero temporal de entorno se borró y los puertos de prueba
  quedaron libres.
- **Baterías finales: web 32/32 · guarda 11/11 · mecánicas
  23/23 · fase2 22/22.** La guarda estrenó hoy sus 3 pruebas de
  «pasado» (§47) y su primera pasada contra el nuevo código dio
  10/11 por la cita fantasma **302 «PRUEBA PASADO HOY»**, residuo
  de la evidencia «antes» de §47 (creada a las 16:31 con el 201
  que demostraba el hallazgo): cancelada con la regla D-05
  (marcador inequívoco, cancelar y nunca borrar) y la batería
  repetida a 11/11.

**Queda pendiente, literalmente, solo la clave:** Lee la crea en
dev.meta.ai y la guarda en la bóveda (paso 0 de
`ACTIVACION_META.md`); después: escribirla en `web/meta.env`
(0600), `GET /v1/models` de solo lectura, confirmar las formas
de Muse Image/SAM, humo con la foto de ejemplo (≈0,01 $) y el
**benchmark H1** (8 fotos autorizadas de BENCHMARK_H1 §3.1 —
IMG-02…06 por descargar, IMG-07/08 con consentimiento escrito —;
coste estimado ≈0,86 $, presupuesto 2 $). Hasta entonces la
integración se sigue entregando declarada como preparada, ahora
con la fontanería probada de punta a punta contra el stub.

Respaldos `*.bak-20261029-meta` (local y máquina) de
`web/web_server.py`, `web/index.html`, `web/sw.js` y
`probador/INTERFACES.md`. **Nota de sync** para la congelación
del 04/11: se suman `probador/proveedor_meta.py`,
`probador/stub_meta.py`, `probador/test_proveedor_meta.py`,
`web/web_server.py`, `web/index.html`, `web/sw.js`,
`probador/INTERFACES.md` y `ACTIVACION_META.md`.

## 49. FILTRO GEMELO EN LA LISTA WEB — cerrado el cabo de §47/§48 (29/10/2026)

La nota honesta de alcance de §47 queda **CERRADA**: la lista de
huecos que pinta la web — que `web/web_server.py` calcula en local,
sin pasar por `huecos_de` — ya no enseña horas pasadas de HOY. La
agenda sigue siendo la capa autoritativa (crear/reagendar en
pasado → 409) y ahora ninguna superficie ni siquiera OFRECE el
pasado.

**Pieza** (solo `web/web_server.py` y su batería; ni `agenda/`,
ni `web/index.html`, ni `probador/` tocados):

- `_cargar_agenda_comun()`: carga `agenda/agenda_comun.py` por
  ruta (el mismo patrón importlib del proveedor Meta de §48) y
  `_corte_hoy(fecha)` delega en `agenda_comun.corte_hoy` — la
  regla «ya pasó» (Europe/Madrid) sigue viviendo UNA sola vez, en
  la agenda, y la web la comparte en vez de copiarla. Si el módulo
  no se pudiera cargar, la réplica local usa la misma zona
  (`_zona_salon`) y la misma regla: el filtro nunca desaparece en
  silencio.
- `_huecos_con_duracion` (el núcleo compartido por un servicio y
  por los packs): tras calcular los inicios libres como siempre —
  las duraciones, también las sumadas de un pack, ya bloquearon
  al generar cada inicio —, si la fecha es HOY filtra los inicios
  con minuto <= corte. Días futuros y domingo cerrado, intactos.
  El filtro cubre también las «alternativas» de los 409 de la
  web, que salen de esta misma función (como en la agenda, §47).

**Evidencia antes/después (máquina real, jueves 29/10, tarde)**:

- ANTES (16:39): disponibilidad web de hoy, Diseño de cejas =
  **39 huecos, primero 10:00** (a la vista de la clienta, horas
  que la agenda habría rechazado al reservar); pack de hoy:
  35, primero 10:00.
- DESPUÉS (16:41): hoy Diseño = **12 huecos, primero 16:45** —
  el mismo resultado que la vía de la agenda en §47 —; pack de
  hoy: **8, primero 16:45, último 18:30** (la duración sumada
  de 90 min se sigue respetando: 18:30 + 90 min = cierre
  20:00). Controles: lunes futuro 09/11 intacto (39 huecos,
  10:00–19:30) y domingo 01/11 «domingo cerrado».
- Despliegue: reiniciada SOLO la web (pid 98876 → 100693);
  webhook (8080) y agenda (8081) intactos, `/salud` ×3 en
  verde, SHA-256 local = máquina en los dos ficheros tocados.

**Pruebas**: la batería web suma la prueba **15** (dinámica, como
la gemela de la guarda: disponibilidad de HOY sin ningún inicio
<= ahora, en hora del salón — en su primera pasada: «12 huecos,
primero=16:45, ahora=16:44») y su prueba 2 se mueve del 29/10 —
que pasó a ser «hoy» — al lunes futuro 09/11, conservando su
sentido (día completo, 10:00–19:30). **Baterías finales: web
33/33 (antes 32/32) · guarda 11/11 · mecánicas 23/23.**

Respaldos `*.bak-20261029-webpasado` (local y máquina) de
`web/web_server.py` y `web/pruebas_web.py`. **Nota de sync**
para la congelación del 04/11: se suman `web/web_server.py` y
`web/pruebas_web.py`.

## 50. PLAN ANTI-SUEÑO — vigilia programada para ensayo, entrega y días del jurado (29/10/2026)

**Orden de Lee** (29/10 18:01: «Monta el plan anti-sueño para los días
del jurado»): que ningún juez — ni el ensayo del 02/11 — encuentre la
app dormida. La máquina se pausa a los 30 min sin uso y una visita web
NO la despierta; el único despertar fiable es el `wake` del helper.

**Pieza ejecutora**: `bin/vigilia.sh` (en el workspace, que sobrevive
a los reemplazos de VM; copia también en la máquina). En cada pasada:
lee el estado de la máquina por API; si no está `running`, la despierta
(`wake`) y espera a que conste `running` (máx. ~3 min); comprueba
`/salud` de los tres servicios dentro de la máquina (8080 webhook ·
8081 agenda · 8090 web) y las URLs públicas de 8080 y 8090; si algo
falla, espera 20 s y reintenta UNA sola vez (con nuevo despertar si la
máquina volvió a caer). Deja UNA línea por ejecución en
`run-logs/vigilia.log` (hora Europe/Madrid, estado inicial, wake,
código por servicio, resultado y duración) y sale 0 si todo está sano,
1 si algo quedó caído tras el reintento.

**Prueba real (29/10 18:03)**: la máquina llevaba suspendida desde
las 17:15 (auto-suspensión por inactividad). Una sola ejecución:
`inicial=suspended wake=ok intento=1 8080=200 8081=200 8090=200
ext8080=200 ext8090=200 resultado=OK duracion=16s`. De paso, el
subcomando `wake` del helper `custom.instabox` queda **verificado**
(la doc del conector lo daba por no probado): despierta en segundos y
los procesos preservados vuelven sirviendo sin relanzar nada.

**Crons creados** (sin duplicar: revisado `cron.list` — no existía
ninguna vigilia de esta máquina; owner
`goal:meta-ai-hackathon-registration`; intervalo de 20 min en
Europe/Madrid; como el programador no expresa rangos de fechas, la
ventana y la caducidad van como compuerta dentro de las instrucciones
de cada cron, verificadas con `cron.view`):

- `la-asistenta-vigilia-trabajo` — anclado al **02/11 09:00**. Activo
  SOLO el **02/11** (ensayo general) y el **04/11** (entrega), de
  **09:00 a 23:59**: la máquina despierta y sana durante toda la
  jornada. **Última ejecución útil: 04/11/2026.**
- `la-asistenta-vigilia-jurado` — anclado al **05/11 14:00**. Activo
  del **05/11 al 10/11**, de **14:00 a 02:00** (ventana pensada para
  el jurado de EE. UU.; anuncio de ganadores 09–10/11; la ventana de
  la noche del 10/11 termina el 11/11 a las 02:00).

Ambos: **silencio total si todo está sano**; informan al chat SOLO si
el despertar falla o un servicio queda caído tras el reintento.

**Caducidad y retirada prevista: 11/11/2026.** Ambos crons quedan
listados para retirarse ese día (tras la última ventana del jurado).
Sus instrucciones declaran la caducidad: si una ejecución cae fuera de
fecha, no despiertan la máquina e informan una sola vez de que el cron
ha caducado y debe retirarse.

**Nota**: la vigilia NO sustituye el calentamiento manual del runbook
de ensayo (§1 de `ENSAYO_Y_DEMO.md`, que ya declara esta cobertura en
su pre-vuelo): es la red de seguridad entre pasadas, no el
procedimiento de la jornada.

## 51. PASE ESTRELLA DE PULIDO — QA20 (29/10/2026, orden de Lee «Mejora más la app»)

Dirección del pase (CTO): NADA de funciones nuevas ni rediseños. La
app se mejora en cómo se SIENTE y cómo CARGA, que era donde quedaba
distancia con una app de pago. La home conserva la anatomía de la
espec (intocable en estructura) y la lógica de agenda no se ha
tocado. Vara de medir: los skills de Emil Kowalski instalados
(design-eng, animate, mobile-native, animation-vocabulary, break-ui).
Respaldos fechados `*.bak-20261029-pulido`: `web/index.html` y
`web/sw.js` (local y máquina) y `web/pruebas_web.py` (máquina).

**Hallazgo previo (no causado por el pase): la batería web era
frágil a la hora del día.** La primera pasada base dio 28/33 sin
haber tocado aún código de la app: el bloque profesional creaba su
cita de hoy a la hora FIJA «19:30», y pasadas las 19:30 la guarda de
§47 la rechazaba (409) y cascaban 5 fallos. Robustizada la batería
SIN relajar aserciones ni cambiar el total (33): la cita va al
ÚLTIMO hueco libre real de hoy (el papel del 19:30) o, si hoy no
queda ninguno, al PRIMERO del siguiente día con huecos, y la
limpieza D-02b la localiza con el mismo criterio (hoy o agenda de 7
días). Las 2 citas residuales de la depuración (ids 349 y 352,
«PRUEBA PROFESIONAL», 30/10 10:00 y 10:30) quedaron CANCELADAS,
nunca borradas (regla D-05). Una rearrancada solo de la web reinició
los contadores de rate-limit (precedente §45; límites intactos).
Base verificada antes de pulir: **33/33**.

**Movimiento con oficio.** Tokens `--ease-out` y `--ease-in-out`
(curvas fuertes de Emil) en `:root`; fuera el `ease` pelado de la
UI. Pantallas a 240 ms; los pasos de la reserva deslizan según la
dirección (clase `atras` en `mostrarPaso`); `ir()` hace scroll
INSTANTÁNEO (el smooth luchaba con la entrada de cada pantalla).
Estados de pulsado completados donde faltaban o saltaban sin
transición (buscador, nav, flechas y días del calendario, flotantes
del salón, tarjetas de módulo, botón de vídeos, guardar, segmentos,
chips, enlaces, botones de «Mis looks») y hover de `.btn-primario`
solo tras `@media (hover:hover) and (pointer:fine)`. El radio de la
hora tiene el punto SIEMPRE presente y crece `scale(0)→scale(1)` al
elegir (verificado por estilo computado: 0 → 1). Los indicadores de
paso tiñen en transición y el número hace un micro-pop al pasar a
«hecho»; la barra de progreso tiñe en 300 ms. Modal de TikTok con
velo en fundido y caja desde `scale(.97)`. Carrusel con
`scroll-snap-stop: always` y `overscroll-behavior-x: contain`
(también la fila de vídeos). Base de sensación nativa:
`-webkit-tap-highlight-color: transparent`, `overscroll-behavior:
none`, `touch-action: manipulation` y `user-select: none` en
botones. `prefers-reduced-motion` sigue respetado por el bloque
global existente. Detectado y retirado un duplicado propio:
`.nav-btn:active` ya existía con scale(.96) más abajo en la hoja;
mi scale(.92) quedaba muerto por cascada — manda el .96 original.

**Carga que se nota.** Las fotos APARECEN con fundido de 350 ms
(clase `.desv` + helper `suavizar(img)`: tarjetas dinámicas del
salón, del Recomendado y de Explorar, y las estáticas — hero del
salón, tarjeta de análisis, The Lounge y las 5 miniaturas de
vídeo), con fondo tinte violeta en los huecos para que nunca se vea
un rectángulo blanco; el hueco ya lo reservaba el aspecto de cada
tarjeta, así que el fundido no mueve nada. Esqueletos con la FORMA
del contenido (`.sk-foto`): bloque 4:3 en el carrusel, fotos de
170 px en Explorar, filas en la carta del salón, en servicios de la
reserva y en «Más en camino»; `cargarHuecos()` muestra esqueleto
mientras consulta. **Tiempos de Inicio** (3 pasadas con caché y SW
limpios, navegador local de la máquina): hasta el carrusel poblado
434 ms → **432 ms** de mediana; `domInteractive` de la primera
pasada 307 → 119 ms. No empeora; el cambio es de percepción, no de
red.

**La espera del análisis, por fases honestas.** Mientras Spark
trabaja sus ~12–15 s reales, el texto cruza por tramos con fundido:
«Enviando tu foto al análisis…» (0–3 s) · «Mirando la forma de tus
cejas…» (3–9) · «Comparando con los diseños del salón…» (9–18) ·
«Eligiendo el servicio que mejor encaja…» (18–35) · «Ultimando tu
recomendación…» (35–75) · «Está tardando más de lo habitual, pero
sigue en marcha…» (>75). PROHIBIDO y no hecho: porcentajes o barras
que no midan nada; el contador de segundos reales se queda.
Verificado en el flujo real (foto de ejemplo): a los 2 s «Enviando
tu foto…», a los 9 s «Comparando con los diseños del salón…»; fotos
fijas con el panel en cuadro a 3,5 s y 11 s en
`web/qa20/despues/analisis-espera-fase{1,2}.png`. Latencia del
modelo idéntica antes/después: 12,3 s (el pase no toca el modelo).

**Micro-cierres.** La confirmación entra en secuencia sobria: el
círculo hace pop (450 ms), el trazo del ✓ se DIBUJA
(`stroke-dashoffset`, delay 180 ms) y el código AS-XXXX aparece
después (delay 300 ms). La captura «instante» del después caza el
círculo aún sin trazo y sin código: la secuencia funciona. Botones
que guardan se ven VIVOS con su rueda (`.btn.ocupado`: sin el gris
de deshabilitado, sin segundo toque posible) en «Confirmar
reserva» y «Apuntarme a la lista de espera». `pulsoBoton()`: el
propio botón confirma ~1,8 s («Guardado ✓» en Perfil, «¡Enlace
copiado!» en la confirmación, «¡Copiado!» en Mi cita). El resultado
del análisis entra en cascada breve (40 ms entre bloques).

**Prueba de rotura** (`web/qa20/rotura/`, por la frontera real):
nombre plausible de 55 caracteres («María José de los Ángeles
Fernández-Gutiérrez de la Torre») por el formulario → reserva
confirmada (AS-AANV/AS-AANX según pasada) y cancelada por su
enlace; `scrollWidth` 412 y CERO elementos fuera del viewport en el
paso 3 y en la confirmación (el nombre se parte en dos líneas en la
tarjeta «Tu cita»). Pack de los 4 servicios (93 € + a consultar):
el resumen queda dentro del viewport (18→394 px) con el precio
visible. Día sin huecos interceptando `/api/disponibilidad` en la
frontera fetch: mensaje honesto y sin desbordes. Día completo: la
lista de horas y los pasos aguantan (39 filas medidas en un día
real). Pulsados verificados con valor exacto por estilo computado:
buscador .94 y nav .96 con ratón real mantenido; pastilla .94 y
segmento .96 con pseudo-estado forzado por CDP; radio de hora
0 → 1 en el flujo real. Cero excepciones JS en todos los recorridos
QA20. La primera versión del guion de rotura tropezó con un hecho
de la app (el primer servicio viene PRESELECCIONADO: pulsarlo lo
deselecciona) — corregido el guion, no la app.

**Veredictos por pantalla** (comparativas lado a lado en
`web/qa20/comparativa-*.png`, vistas una a una): Inicio en carga =
**MEJOR** (el esqueleto tiene la forma de la tarjeta con foto; el
de antes eran dos barras sin significado). Inicio cargado y
Explorar = iguales en fotograma fijo: su mejora es la aparición de
las fotos y la respuesta al toque, no el retrato. Espera del
análisis = **MEJOR** (fases reales frente a un texto único).
Resultado = igual en fijo; la entrada en cascada es la mejora.
Confirmación = **MEJOR en la entrada** (secuencia tick → trazo →
código); el fotograma final es el mismo, como debe ser. **Nada
revertido**: ningún cambio empeoró su pantalla; lo único retirado
es la regla duplicada de `.nav-btn` citada arriba, sin efecto
visual.

**Cierre verificado tras el despliegue**: recorridos QA20 5/5 y
5/5 con 0 errores de consola; baterías **web 33/33 · guarda 11/11
· mecánicas 23/23 · fase2 22/22**. SW: v17 → v18 por el pase y
**v19** por la retirada del duplicado (sin cambio visual). Vistas
servidas: `web/icons/vista-pulido-inicio.png` y
`web/icons/vista-pulido-confirmacion.png` (SHA idénticos a
`qa20/despues/`). Artefactos en `web/qa20/`: `qa20.mjs` (recorrido
y tiempos antes/después), `fase.mjs` (foto fija de la espera),
`rotura.mjs` + `rotura/`, `antes/`, `despues/` con sus logs y las
comparativas.

**Nota de sync para la congelación del 04/11** (se suma a las de
§§46–50): entran también `web/index.html`, `web/sw.js` (v19),
`web/pruebas_web.py` (robustización horaria del bloque profesional
descrita arriba), `agenda/` sin cambios en este pase, `web/qa20/`
entero y esta §51 de `ESTADO_PROYECTO.md`.

## 52. MUSA · BLOQUE B1 — CONTRASTE AA DEL TEXTO DE APOYO (29/10/2026)

Primer bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (defecto D4),
ejecutado con su alcance exacto: **solo valores de color** en
`web/index.html`, `web/cita.html` y `web/profesional.html` (los tres
`:root` comparten valores idénticos tras el cambio) + la regla de
color del domingo en el calendario + bump del SW (**v19 → v20**).
Ni una clase, ni un texto, ni una mecánica tocados; el diff completo
contra los respaldos `*.bak-20261029-b1` (local y máquina) son 6
líneas de valores y 1 regla de solo color. El violeta y el negro de
la paleta quedan como están: todos los ajustes son de valor dentro
de la misma familia cromática.

**Ratios calculados con la fórmula WCAG 2.x** (la implementación
reproduce antes de fiarse los cuatro ratios del diagnóstico:
4,28 / 2,27 / 1,84 / 4,09 exactos):

| Par de lectura | Antes | Después |
|---|---|---|
| `--gris` `#747a8d`→`#626878` sobre blanco | 4,28 ✗ | **5,57** ✓ |
| `--gris` sobre `#f5f5f5` (superficie) | 3,92 ✗ | **5,11** ✓ |
| `--gris` sobre `#F0EDFE` (tinte violeta) | 3,72 ✗ | **4,84** ✓ |
| Placeholder del buscador `#a4adba`→`#6c727b` sobre blanco | 2,27 ✗ | **4,85** ✓ |
| Días deshabilitados (pasados / fuera de ventana) `#bfbfbf`→`#8a8a8a` sobre blanco | 1,84 ✗ | **3,45** ✓ (≥3) |
| Domingos deshabilitados: `#b23a48` sobre tinte `#f9e9ec` (tratamiento nuevo) | 1,84 ✗ (el mismo gris que los pasados) | **4,98** ✓ (≥3) |
| Chip «Disponible ahora»: `--positivo` `#1f8900`→`#1d7e00` sobre `#EDF6EB` | 4,09 ✗ | **4,70** ✓ |
| Chip «Cumplida» (profesional): `--positivo` sobre `#e5f4e0` | 3,96 ✗ | **4,55** ✓ |
| `--positivo` sobre blanco / blanco sobre `--positivo` (`.btn-verde`) | 4,53 | **5,20** ✓ |

**Domingo distinguido del día pasado** (exigencia del bloque): la
rejilla del calendario empieza en lunes, así que el domingo es la
7ª columna; la regla `.cal-dia[disabled]:nth-child(7n)` pinta SOLO
color (número rosa almanaque `#b23a48` sobre tinte `#f9e9ec`) sin
tocar JS, clases ni estructura — verificado en la captura: los
domingos 4/11/18/25 de octubre llevan su círculo rosa y los pasados
entre semana van en el gris nuevo. Sin iconografía nueva.

**Dos precisiones al diagnóstico, documentadas en vez de forzadas**
(regla del bloque): (1) su tabla D4 cita `--gris` a 4,28:1, que es
el ratio **sobre blanco**; sobre `#f5f5f5` — fondo real de parte de
esos textos — el ratio de partida era **3,92:1** (su propio texto
de B1 ya exigía pasar en ambos fondos; el valor elegido pasa en
los dos y también sobre el tinte violeta). (2) La tabla no listaba
el chip «Cumplida» del área profesional (`--positivo` sobre
`#e5f4e0`, 3,96:1): es el mismo token y la misma familia de par, y
queda corregido por el mismo cambio de `--positivo` en los tres
ficheros (en `cita.html` el mismo valor corrige además `.pastilla.ok`
y `.ok-caja`, que comparten el par `#EDF6EB`).

**Verificación**: despliegue por `put` con SHA-256 idénticos
local = máquina en los 4 ficheros; web reiniciada (pid 104329 →
110699, `/salud` 200). Capturas antes/después a 412×915 con el
guion `web/qa-b1/b1.mjs` (CDP contra la máquina, 0 errores de
consola en ambas pasadas): geometría idéntica (824×1830 en las 6
capturas) y comparativas lado a lado que demuestran **cero cambios
de layout** — servidas en `web/icons/vista-b1-inicio.png`,
`vista-b1-calendario.png` y `vista-b1-profesional.png` (originales
en `web/qa-b1/antes/` y `web/qa-b1/despues/`). Baterías tras el
despliegue: **web 33/33 · guarda 11/11 · mecánicas 23/23**.

**Nota de sync para la congelación del 04/11** (se suma a las de
§§46–51): entran también `web/index.html`, `web/cita.html`,
`web/profesional.html`, `web/sw.js` (v20), `web/qa-b1/` entero,
`web/icons/vista-b1-*.png`, `web/icons/b1-*.png` y esta §52 de
`ESTADO_PROYECTO.md`.

## 53. MUSA · BLOQUE B2 — EL RESULTADO HABLA COMO ORIENTACIÓN (29/10/2026)

Segundo bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (deficiencia
D1), ejecutado con su alcance exacto: en la pantalla de resultado
del análisis, la recomendación deja de presentarse como veredicto
y pasa a hablar como orientación. Cambios en `web/index.html`,
`web/web_server.py` y bump del SW (**v20 → v21**). El contrato del
análisis NO cambia: mismos campos JSON, misma validación
(`validar_analisis` intacta), mismo mecanismo asíncrono con
sondeo; `latencia_s` sigue viajando en el payload y en el log del
servidor — lo que sale es su exhibición a la clienta. Respaldos
`*.bak-20261029-b2` en local y máquina.

**Textos exactos antes → después**:

1. **Aviso del resultado** (payload de `/api/analizar`, en
   `web_server.py`). Antes: «Análisis real con Muse Spark. La
   propuesta visual generada (ver tus cejas con el servicio
   aplicado) aún no está disponible: no mostramos imágenes
   falsas.», y el cliente le añadía «(Análisis real en 11.24 s con
   Muse Spark.)» — la tecnología nombrada dos veces y el tiempo
   con centésimas en la cara de la clienta. Después: «Esto es una
   orientación a partir de tu foto, no un diagnóstico: Arianna
   confirma el diseño contigo en el salón antes de trabajar.
   Análisis real con Muse Spark. La propuesta visual generada
   (ver tus cejas con el servicio aplicado) aún no está
   disponible: no mostramos imágenes falsas.» — orientación
   primero, confirmación en el salón (el flujo real del negocio),
   tecnología una sola vez, sin tiempo. El sufijo del cliente se
   elimina: `mostrarResultado` pinta `d.aviso` tal cual.
2. **`AVISO_CON_VISUAL`** (dormido, sin clave Meta) reescrito con
   la misma voz: abre con la misma frase de orientación y la
   propuesta visual pasa a «también orientativa: una aproximación
   para ayudarte a decidir, no el resultado exacto del servicio»;
   «Muse Spark» queda como única marca nombrada en el aviso
   (Muse Image sigue nombrado en la nota de la propia tarjeta
   visual, que es donde describe la imagen).
3. **Etiqueta de la tarjeta**: «RECOMENDACIÓN» → «ORIENTACIÓN», y
   línea nueva DENTRO de la tarjeta, visible con ella y no en una
   nota al pie: «Una orientación desde tu foto, no un
   diagnóstico: Arianna confirma el diseño contigo en el salón
   antes de empezar.»
4. **`PROMPT_SISTEMA`** (D1 señalaba que no instruía orientación):
   se añade la instrucción de escribir resumen, motivo,
   motivo_alternativo y consejo «como una ORIENTACIÓN cercana,
   nunca como un diagnóstico ni un veredicto», con fórmulas («te
   puede encajar», «una buena opción para ti sería») y la
   obligación de dejar claro en el resumen que es una primera
   orientación desde la foto y que Arianna confirma el diseño con
   la clienta en el salón antes de trabajar. La forma exacta del
   JSON no se toca.

**Presentación y orden**:

- `.reco .etiqueta` y `.reco .datos`: de `var(--positivo)` (verde,
  semántica de oferta) a `var(--negro)`. Verificado por estilo
  computado en el recorrido real: rgb(29,126,0) → rgb(13,13,13)
  en ambos.
- **Rasgos**: las 4 píldoras-frase (chips con frases enteras del
  modelo) pasan a lista etiqueta→valor (`.rasgos` / `.rasgo` /
  `.rasgo-k` / `.rasgo-v` nuevas; el contenedor conserva el id
  `res-chips`). La clase `.chip` queda intacta para los datos
  cortos del resto de la app.
- **Orden de acciones**: primaria («Reservar este servicio») →
  alternativa → secundarias agrupadas (Guardar look / Elegir otro
  servicio / Borrar mi foto); `#res-aviso` se mueve al final de la
  sección y CIERRA la pantalla (antes se intercalaba entre la
  tarjeta alternativa y «Guardar look»). La regla de la cascada de
  entrada (§51) no cambia; el aviso, último hijo, entra el último.

**Verificación** (guion `web/qa-b2/b2.mjs`, CDP a 412×915 contra la
máquina, dos análisis REALES con la foto de ejemplo, 0 errores de
consola en ambas pasadas):

- **ANTES** (12,1 s): recomendación «Brow Lamination · 45 € ·
  65 min», etiqueta y datos en verde rgb(29,126,0), 4 chips-frase,
  aviso viejo con el sufijo de centésimas,
  avisoTrasAcciones=false.
- **DESPUÉS** (18,1 s, dentro del rango documentado de 10–46 s):
  recomendación «Diseño de cejas · 18 € · 25 min» (nombre, precio
  y duración exactos de la carta); etiqueta «ORIENTACIÓN» y datos
  en negro rgb(13,13,13); 4 filas de rasgos y 0 chips-frase; el
  propio modelo ya habla como orientación — su resumen cierra:
  «Esta es solo una primera orientación desde la foto y Arianna
  confirma el diseño contigo en el salón antes de trabajar para
  adaptarlo a tu gusto», y el motivo abre «Una buena opción para
  ti sería el Diseño de cejas, ya que te puede encajar…»; aviso
  nuevo íntegro y avisoTrasAcciones=true.
- **Recorrido resultado→reserva** en ambas pasadas: clic en
  «Reservar este servicio» → paso 2 con el servicio recomendado
  fijado en el resumen («Brow Lamination · viernes, 30 de
  octubre» antes; «Diseño de cejas · viernes, 30 de octubre»
  después). No se confirmó ninguna reserva.
- **Baterías tras el despliegue: web 33/33 · guarda 11/11 ·
  mecánicas 23/23 · fase2 22/22 · probador 18/18** (13 Meta + 5
  FASHN, contra stub, en local).
- Comparativa del resultado completo servida en
  `web/icons/vista-b2-resultado.png` (detalle de la tarjeta en
  `web/icons/vista-b2-reco.png`), **revisada visualmente**: cada
  criterio de aceptación del bloque se ve en la imagen.
  Precisión de conteo: dentro de los bloques del resultado la
  tecnología se nombra UNA vez (el aviso); el pie global de la
  app («Probador de cejas con Muse Spark · …»), presente en
  todas las pantallas, no pertenece al resultado ni al alcance
  de B2.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina en
  los 3 ficheros; web reiniciada (pid 110699 → 111950).
  Incidencia honesta del despliegue: un primer intento de
  reinicio lanzando `web_server.py` a mano murió al arrancar (sin
  `AGENDA_API_TOKEN` en el entorno: la web exige el entorno que
  prepara `arrancar.sh`) y dejó la web caída ~1 min hasta
  relanzarla con `arrancar.sh`; webhook (8080) y agenda (8081) no
  se tocaron en ningún momento. La composición de la comparativa
  se hizo en local (la máquina no tiene PIL) desde las capturas
  servidas por `web/icons/`, verificadas por SHA-256 idéntico a
  las de la máquina.

**Resto de D1 fuera del alcance exacto de B2 (sin tocar)**: la
tarjeta de Inicio que abre el embudo sigue diciendo «la IA
analiza tus cejas y te recomienda el servicio que mejor encaja» —
promete sin matiz; queda anotada para un bloque futuro o decisión
de Lee, no se ha colado en B2.

**Nota de sync para la congelación del 04/11** (se suma a las de
§§46–52): entran también `web/index.html`, `web/web_server.py`,
`web/sw.js` (v21), `web/qa-b2/` entero,
`web/icons/vista-b2-resultado.png`, `web/icons/vista-b2-reco.png`,
`web/icons/b2-*.png` y esta §53 de `ESTADO_PROYECTO.md`.

## §54 · MUSA Bloque B3 — el «Hoy» profesional que sirve para abrir el día (29/10/2026, noche)

Tercer bloque del plan de DIAGNOSTICO_UX_MUSA.md (deficiencia D2):
el área profesional medía mal el día — el titular anunciaba
«43 citas hoy» contando las canceladas, las canceladas se listaban
a pleno peso mezcladas en Hoy y por encima de los huecos en
Agenda, el embudo acumulado sin periodo iba antes que la carta, y
las cuatro vistas compartían el mismo título de página. Además el
área no tenía batería HTTP propia. Orden del bloque: primero la
red, después el arreglo.

- **Red primero — `web/pruebas_profesional.py` (NUEVA, 25
  comprobaciones)**: sin sesión, las 6 rutas de lectura devuelven
  401 sin revelar datos; clave falsa 401 («Clave no válida»);
  acceso crea sesión (cookie HttpOnly); hoy/agenda/espera/bandeja/
  embudo/servicios responden con su forma; cadena de acciones con
  efecto verificado EN LA AGENDA (cita de prueba marcada cumplida
  desde el área → su agradecimiento aparece en la bandeja →
  descartado desde el área; segunda cita cancelada desde el área
  con efecto; estado inventado 400; salir mata la sesión, 401
  después). Sobre el código ACTUAL (pre-arreglo): **las 20 de red
  en verde y las 5 aserciones B3 en rojo**, documentando los
  defectos con números (sin `por_atender`; una cancelada antes que
  una viva entre 43 citas; lo mismo por días en Agenda; embudo con
  `desde=None`; 3 de los 4 títulos ausentes del HTML). Precisión:
  `pruebas_web.py` §14 ya ejercitaba parte de la cadena profesional
  — la afirmación del diagnóstico «no existe batería HTTP del
  panel» era imprecisa; la dedicada ahora existe y cubre también
  bandeja y acciones con efecto cruzado.
- **El arreglo (mismas rutas y contratos; campos aditivos)**:
  - *Servidor* (`web/web_server.py`): `/api/profesional/hoy` suma
    `resumen.por_atender` (= confirmadas, las que esperan a
    Arianna) y devuelve las citas con las vivas primero y las
    canceladas al final (orden estable: dentro de cada grupo manda
    la hora, como venían de la agenda); `/api/profesional/agenda`
    aplica el mismo orden dentro de cada día;
    `/api/profesional/embudo` declara periodo por defecto — últimos
    30 días (`desde` = hoy−29 en Europe/Madrid) salvo `desde`/
    `hasta` explícitos, que se respetan — y la agenda lo devuelve
    en la respuesta (`desde`/`hasta` ya viajaban en su contrato).
  - *Panel* (`web/profesional.html`): el resumen de Hoy titula con
    **por atender · cumplidas hoy · mensajes por enviar** y las
    canceladas/no-vinieron pasan a una línea secundaria («También
    hoy: …»); la lista principal solo lleva citas vivas con sus
    acciones intactas y las canceladas cierran el día en un bloque
    propio («Canceladas de hoy · N») de líneas atenuadas (borde
    discontinuo, opacidad .62, sin acciones: una cancelada no tiene
    nada que decidir). En Agenda, cada día pinta vivas → huecos
    libres → grupo «Canceladas · N» atenuado al final de la
    tarjeta. **Un título por vista**: «Hoy en tu salón» · «Tu
    agenda de 7 días» · «Por avisar a tus clientas» · «Mi negocio ·
    carta y cifras», con subtítulo propio por vista (la fecha de
    Hoy se conserva al volver a la pestaña). En «Mi negocio»,
    **Servicios y horarios va ahora ANTES que el embudo**; el
    embudo se titula «Tu embudo · últimos 30 días», explica que
    cuenta movimientos (una misma cita puede contar al confirmarse
    y otra vez al cumplirse o cancelarse — por eso los contadores
    no son citas y no tienen por qué reconciliar entre sí) y cierra
    con el periodo exacto («Contado del … al …»). Ni una cifra
    inventada: todo sale de la agenda real.
  - *Rider D1 (resto anotado en §53)*: las DOS tarjetas que dicen
    «te recomienda el servicio que mejor encaja» (la de Inicio y la
    del hub Probador, `web/index.html`) pasan a la voz de
    orientación de B2: «te orienta sobre el servicio que mejor te
    puede encajar; Arianna lo confirma contigo en el salón».
- **QA visual (guion propio `web/qa-b3/b3.mjs`, 412×915, clave
  leída solo dentro de la máquina; 0 errores de consola en ambas
  pasadas)**: ANTES sobre el día real cargado de QA — titular
  «43 · citas hoy · 0 · por atender» y tarjetas de canceladas a
  pleno peso; en Agenda, 12 filas «Cancelada» antes de la primera
  cumplida y los huecos fuera de pantalla. Escenario honesto para
  el 30/10: citas marcadas «PRUEBA B3 ESCENARIO» en huecos reales
  (3 canceladas a horas tempranas + 2 confirmadas vivas; al
  terminar, las vivas se cancelaron — ids 394/395 — y el resto
  quedó en estados terminales, como manda la casa). DESPUÉS sobre
  EL MISMO día real: titular «0 · por atender · 2 · cumplidas hoy
  · 7 · mensajes por enviar · También hoy: 32 canceladas · 9 no
  vinieron», vivas primero, bloque de canceladas atenuado al
  final; en Agenda, «Huecos libres: 10:00–20:00» visible en la
  primera pantalla y «Canceladas · 32» cerrando el día.
  Comparativas revisadas visualmente una a una:
  `web/icons/vista-b3-hoy.png` y `web/icons/vista-b3-agenda.png`
  (compuestas en local, la máquina no tiene PIL).
- **Baterías al cierre (todas contra la máquina real)**: web
  **33/33** · guarda **11/11** · mecánicas **23/23** · fase2
  **22/22** · profesional (nueva) **25/25**. Incidencia honesta de
  la verificación, SIN tocar una sola aserción: las corridas
  encadenadas de baterías durante el bloque agotaron el límite de
  acceso profesional (8 intentos/15 min por IP — el documentado en
  §50) y dos corridas intermedias de `pruebas_web.py` salieron
  30/32 y 19/32 con fallos en cascada (429→401 en la cadena §14 y
  el anti-solape sucio por las citas del propio escenario B3 a las
  10:30). Con la ventana de 15 min limpia y el escenario retirado,
  la corrida única final dio **33/33** — los fallos eran del
  entorno de prueba, no del código; queda la lección operativa de
  espaciar las corridas que usan la clave.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina en
  `web/web_server.py`, `web/profesional.html`, `web/index.html` y
  `web/sw.js` (shell **v21 → v22**); web reiniciada SOLO con
  `arrancar.sh` (pid 111950 → 113678); webhook (8080) y agenda
  (8081) no se tocaron. La clave profesional se leyó únicamente
  dentro de la máquina (baterías y guion QA); jamás impresa ni
  extraída.

**Nota de sync para la congelación del 04/11** (se suma a las de
§§46–53): entran también `web/web_server.py`,
`web/profesional.html`, `web/index.html`, `web/sw.js` (v22),
`web/pruebas_profesional.py`, `web/qa-b3/` entero,
`web/icons/vista-b3-hoy.png`, `web/icons/vista-b3-agenda.png` y
esta §54 de `ESTADO_PROYECTO.md`.

## §55 · MUSA Bloque B4 — sistema visual único: tokens y escala (29/10/2026, noche)

Cuarto bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (deficiencia
D3): los tres ficheros dejan de tener cada uno su sistema y pasan
a compartir UNO. Sin tocar estructura, textos, rutas ni mecánicas:
las pantallas se ven iguales; lo que cambia es que ahora hay un
sistema cerrado debajo. SW **v22 → v23**. Respaldos
`*.bak-20261029-b4` en local y en la máquina.

- **Una sola fuente de tokens**: el bloque `:root` canónico es el
  que ya tenía `index.html` (lleva los valores AA de B1 intactos,
  la regla de elevación y las curvas §51) y queda copiado **byte a
  byte** en `index.html`, `cita.html` y `profesional.html` —
  verificación por SHA-256 del bloque extraído de los tres
  ficheros desplegados: un único hash (`4a584bdbbb48…`). La vía es
  copia verificada idéntica porque la arquitectura sirve ficheros
  sueltos, sin build ni plantilla compartida. Divergencias
  resueltas: `--sombra` canónica = el susurro
  `0 1px 3px rgba(13,13,13,.05)` (la regla de elevación deliberada
  del 29/10: manda el borde hairline, no la sombra); la profunda
  `.08` de cita/profesional la precedía y desaparece — en las
  comparativas el cambio es indistinguible. Cita y profesional
  ganan además `--ease-out`/`--ease-in-out` (declarados en el
  bloque común; sin uso nuevo en este bloque).
- **Escala tipográfica cerrada**: de **25 tamaños distintos** en
  uso (24 en index, 13 en cita, 16 en profesional, con
  fraccionarios como 11,5/13,5/16,5 mezclados sin criterio) a
  **7 peldaños con rol**: 11 micro · 12,5 apoyo · 13,5 cuerpo ·
  15 acción · 19 destacado · 23 titular · 28 hero. Única
  excepción, funcional y documentada en el propio `:root`:
  inputs y textarea se quedan a 16 (por debajo, iOS hace zoom al
  enfocar). Mapeo aplicado valor a valor: 10/11/11,5→11 ·
  12→12,5 · 13→13,5 · 14→13,5 (con dos subidas deliberadas a 15:
  los datos de la recomendación y el hueco elegido de `/cita`,
  que son acción) · 14,5/15,5/16/16,5→15 · 17/18/20→19 ·
  21→23 (salvo la hora de la cita del panel, 21→19: es dato
  destacado, no titular) · 22/24/25→23 · 27/29/31→28. La escala
  queda escrita como comentario en el `:root` canónico: el
  sistema se lee donde vive.
- **El 800 solo para titulares de verdad**: reclasificadas a 700
  **25 reglas** (19 en index —incluida `.prod-card .pc-precio`,
  detectada en la verificación posterior a la transformación—,
  1 en cita, 5 en profesional): precios, llamadas a la acción,
  etiquetas, estados, días del calendario y horas dejan de gritar
  en 800. Se quedan en 800: la marca, el titular de Inicio, el
  mes del calendario, el código AS-XXXX grande, el título de
  próxima apertura (index); los titulares de tarjeta, el nombre
  de la marca, los números display del resumen y el día de la
  agenda (profesional, más sus 5 titulares inline/de plantilla).
- **Familia de botones con nombres veraces**: de 8 variantes (con
  dos nombres que mentían y una muerta) a una familia cerrada:
  `.btn-primario` (negro) · `.btn-secundario` (blanco con borde;
  es la ex-`.btn-lavanda` de index, que pintaba blanco) ·
  `.btn-violeta` (la ex-`.btn-lavanda` de `/cita`, que sí pintaba
  violeta; su definición ya era idéntica a la del panel) ·
  `.btn-fantasma` · `.btn-peligro` (cita) · `.btn-texto` (index) ·
  `.btn-whatsapp` (ex-`.btn-verde`) · modificador `.btn-peq` y
  estado `.btn.ocupado`; `.btn-guardar` y `.btn-perfil-ico` son
  componentes-ícono, aparte. `.btn-videos` era CSS muerto (0 usos
  en markup y JS): sus 3 reglas se retiran. **Los radios de botón
  quedan fuera del bloque por decisión registrada**: la
  enumeración de alcance manda (`.btn` sigue a 999 en
  index/profesional y a 16 en cita); si se unifican, será un
  bloque propio con su comparativa.
- **Verde con una sola semántica**: disponibilidad/éxito. El
  token `--positivo` sigue solo en chips, pastillas y cajas de
  estado/disponibilidad; el único botón verde que queda es el de
  WhatsApp (`.btn-whatsapp`, solo enlaces wa.me), y «Mover mi
  cita» de `/cita` —una acción principal pintada de verde— pasa a
  `.btn-primario`. Los precios siguen en negro (B2), verificado
  en la comparativa del Resultado («45 € · 65 min» en negro).
- **Verificación**: comparativas antes/después a 412×915 de las
  seis pantallas (Inicio, Explorar, Salón, Reserva paso 2,
  Resultado con análisis real —18,1 s antes y 33,4 s después; la
  recomendación varía entre corridas, es el modelo real— y
  Profesional·Hoy), revisadas píxel a píxel:
  `web/icons/vista-b4-inicio.png`, `vista-b4-explorar.png`,
  `vista-b4-salon.png`, `vista-b4-reserva.png`,
  `vista-b4-resultado.png` y `vista-b4-profesional.png`, servidas
  en la máquina. Sin diferencias visibles no previstas: los
  únicos deltas son los del mapeo (titulares ±1–3 px a su
  peldaño, 800→700 en precios/CTA) y el reflow natural de ±0,5 px
  en dos párrafos. Baterías al cierre: web **33/33** ·
  profesional **25/25** · guarda **11/11** · mecánicas **23/23** ·
  fase2 **22/22**. La transformación fue un script determinista
  auditado (`web/qa-b4/transformar_b4.py`, 141 cambios
  registrados) con el diff completo revisado contra los respaldos
  antes de desplegar; guion de capturas en `web/qa-b4/b4.mjs`.
- **Incidencia honesta de la verificación** (sin tocar una sola
  aserción ni un límite): las primeras corridas de la batería web
  salieron 31/33 y luego en cascada (9/31) por el límite de
  reservas (30/h por IP) — los contadores viven **en la memoria
  del proceso web**, vivo desde las 20:46 UTC con las corridas de
  B3, y `arrancar.sh` es idempotente: no reinicia un servicio
  sano, así que mis «reinicios» no los pusieron a cero. Además,
  una corrida en cascada dejó la cita de prueba «PRUEBA
  PROFESIONAL» (id 426) **confirmada** mañana a las 10:00 y el
  escenario web chocaba con ella (409 correcto del anti-solape);
  se canceló por el canal propio de la agenda
  (`POST /citas/426/cancelar`: queda cancelada, no borrada) y la
  agenda quedó como estaba: 0 confirmadas futuras. Con el proceso
  web detenido y relanzado por `arrancar.sh` (pid 116394) y la
  agenda limpia, la corrida única dio **33/33**. Lección que
  amplía la de §54: antes de una batería, contadores a cero =
  proceso nuevo, no `arrancar.sh` a secas.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina en
  `web/index.html` (`d1d75f8c…`), `web/cita.html` (`6fe9be02…`),
  `web/profesional.html` (`16f1cf7c…`) y `web/sw.js`
  (`3c11c934…`, shell **v23**); webhook (8080) y agenda (8081) no
  se tocaron; la clave profesional se leyó solo dentro de la
  máquina.

**Nota de sync para la congelación del 04/11** (se suma a las de
§§46–54): entran también `web/index.html`, `web/cita.html`,
`web/profesional.html`, `web/sw.js` (v23), `web/qa-b4/` entero,
`web/icons/vista-b4-inicio.png`, `web/icons/vista-b4-explorar.png`,
`web/icons/vista-b4-salon.png`, `web/icons/vista-b4-reserva.png`,
`web/icons/vista-b4-resultado.png`,
`web/icons/vista-b4-profesional.png` y esta §55 de
`ESTADO_PROYECTO.md`. Los respaldos `*.bak-20261029-b4` NO viajan
al repo.

## §56 · MUSA Bloque B5 — una sola voz de titular (29/10/2026, noche)

Quinto bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (deficiencia
D3, la mitad de identidad): los titulares hablaban con DOS voces
— Montserrat solo en Inicio; Fraunces (serif editorial) en el
resto de pantallas (salón, reserva, resultado, cita,
profesional) — y la dirección editorial con serif ya fue
RECHAZADA por Lee el 29/10 (pase QA15). La voz canónica es la
de Inicio: **Montserrat**. Sin tocar textos, estructura, rutas
ni mecánicas; los tamaños son los peldaños de la escala cerrada
de B4 y no se mueven. SW **v23 → v24**. Respaldos
`*.bak-20261029-b5` en local y en la máquina.

- **El mapeo** (transformación determinista auditada,
  `web/qa-b5/transformar_b5.py`: 18 sustituciones con
  coincidencia exacta única, diff completo revisado contra los
  respaldos antes de desplegar). Titulares de sección/hero →
  Montserrat **800** con `letter-spacing:-.01em` (la voz exacta
  de `#p-inicio .seccion-titulo`, la pantalla aprobada): en
  index, `.salon-titulo` 28 (interlineado 1.12→1.15, el ajuste
  mínimo de ritmo al cambiar de familia) y `.seccion-titulo`
  base 23 — que ahora coincide con su propio override de
  Inicio — y `.confirmada h2` 28; en cita, `header h1` 28
  (1.12→1.15); en profesional, `h1` 28. Títulos de tarjeta →
  Montserrat **700** (el patrón de `.salon-card h3` de Inicio):
  en index, `.tarjeta h2` 23, `.reco h3` 23, `.lounge-card h3`
  19 y `.prod-card h3` 19; en cita, `.tarjeta h2` 23. El reparto
  800/700 ya era el de B4: lo que cambia es solo la familia.
- **El código también es voz**: `.codigo` de `/cita` (el
  AS-XXXX sobre pastilla negra) iba en Fraunces 700 mientras el
  de la confirmación en index ya era Montserrat 800: unificado
  a Montserrat 800 con su tracking `.12em` — el mismo código se
  lee igual en las dos pantallas en las que aparece.
- **El acento del h1 de `/cita`**: «siempre a mano» iba en
  itálica serif violeta dentro del titular. La Montserrat
  cargada no tiene itálica (400–800, solo recta) y fingirla con
  oblicua sintética sería un atajo de imprenta: el acento pasa
  a ser **de color** (`header h1 em` gana `font-style:normal` y
  conserva el violeta). En la comparativa se lee deliberado y
  de la misma familia que la marca.
- **Fraunces: dónde queda y por qué**. En `cita.html` y
  `profesional.html` queda **sin ningún uso**: sus `@font-face`
  se retiran y esas dos superficies dejan de descargar la
  fuente (67 KB la normal; en cita también la itálica, 81 KB).
  En `index.html` la recta queda sin uso: se retira su
  `@font-face` y sale del precache del SW. Sobrevive SOLO la
  **itálica**, para dos acentos de cita textual que no son
  titulares: el lema del salón (`.salon-sub em`, 13,5 px, bajo
  el nombre ya en Montserrat) y las reseñas literales de la
  tienda (`.resena p`). Regla resultante: Fraunces deja de ser
  voz de titular en toda la app; lo que queda es itálica de
  cita, decisión documentada aquí y no resto olvidado. El
  comentario histórico del CSS («sin Fraunces y sin hero
  editorial») se conserva como lo que es: historia del diseño.
- **Invariante B4 verificado tras el cambio**: el bloque
  `:root` extraído de los tres ficheros sigue byte a byte
  idéntico entre sí (SHA-256 `4a584bdbbb48…`, el canónico
  de §55); los valores AA de B1 intactos.
- **Verificación visual** (guion propio `web/qa-b5/b5.mjs`,
  412×915, 0 errores de consola en ambas pasadas): ANTES sobre
  producción post-B4 y DESPUÉS tras el despliegue, con
  análisis REAL en las dos pasadas (12,1 s y 12,1 s; la misma
  recomendación, «Diseño de cejas», en ambas) y la reserva
  completa de cada pasada cancelada desde la propia página
  `/cita` por el canal propio (AS-AARH y AS-AARJ quedan
  canceladas, no borradas). Comparativas lado a lado revisadas
  píxel a píxel: `web/icons/vista-b5-salon.png`,
  `vista-b5-profesional.png`, `vista-b5-cita.png`,
  `vista-b5-resultado.png`, `vista-b5-confirmada.png`,
  `vista-b5-reserva.png` (paso 1) y `vista-b5-reserva2.png`
  (paso 2), servidas en la máquina. Ninguna pantalla pierde:
  Profesional·Hoy, la Confirmada y los dos pasos de Reserva
  son indistinguibles salvo la voz del titular; en `/cita` el
  conjunto gana coherencia (titular y código en la voz de la
  marca y de la cabecera ASISTENTA). **Dos deltas declarados,
  sin ajuste aplicado**: (1) en Salón, el h2 de la tarjeta de
  análisis («¿No sabes qué servicio elegir?») pasa a dos
  líneas — la nueva voz es más ancha que la serif a igual
  peldaño — y la tarjeta crece ~30 px; al reposo, la barra fija
  de reserva cubre la última línea del párrafo siguiente, el
  mismo patrón con el que ya cubría el título «Servicios»:
  todo el contenido se alcanza con scroll, y el único ajuste
  posible sería bajar el peldaño 23 que fijó la escala cerrada
  de B4, fuera del alcance de este bloque; (2) en Reserva
  paso 1, el párrafo introductorio reenvuelve una palabra
  («una» salta de línea) por el reflow de borde al cambiar la
  métrica del titular que lo precede — sin texto cortado ni
  cambio de jerarquía (misma categoría de reflow aceptada
  en §55).
- **Baterías al cierre** (todas contra la máquina real; suite
  única tras relanzar el proceso web en fresco por
  `arrancar.sh` — contadores a cero, lección de §§54/55):
  web **33/33** · profesional **25/25** · guarda **11/11** ·
  mecánicas **23/23** · fase2 **22/22**.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina
  en `web/index.html` (`58519f86…`), `web/cita.html`
  (`fd132626…`), `web/profesional.html` (`3d9ed8a0…`) y
  `web/sw.js` (`8f79d3ae…`, shell **v24**); web reiniciada solo
  con `arrancar.sh` (pid 116914 → 118620); webhook (8080) y
  agenda (8081) no se tocaron; la clave profesional se leyó
  solo dentro de la máquina.

**Nota de sync para la congelación del 04/11** (se suma a las
de §§46–55): entran también `web/index.html`, `web/cita.html`,
`web/profesional.html`, `web/sw.js` (v24), `web/qa-b5/`
entero, `web/icons/vista-b5-salon.png`,
`web/icons/vista-b5-profesional.png`,
`web/icons/vista-b5-cita.png`,
`web/icons/vista-b5-resultado.png`,
`web/icons/vista-b5-confirmada.png`,
`web/icons/vista-b5-reserva.png`,
`web/icons/vista-b5-reserva2.png` y esta §56 de
`ESTADO_PROYECTO.md`. Los respaldos `*.bak-20261029-b5` NO
viajan al repo.

## §57 · MUSA Bloque B6 — wayfinding honesto: la navegación dice dónde estás (29/10/2026, noche)

Sexto bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (deficiencia
D5-wayfinding): la barra de navegación mentía — `NAV_DE` fijaba
`p-reserva → nav-probador` (durante TODO el flujo de reserva se
iluminaba «Probador», entraras desde donde entraras),
`p-proxima → nav-inicio` (la próxima apertura iluminaba siempre
«Inicio») y `p-confirmada → nav-perfil`. Solo cambian
`web/index.html` (la lógica de la pestaña activa) y el SW
(**v24 → v25**). Ni estructura, ni iconos, ni textos de las
pestañas. Respaldos `*.bak-20261029-b6` en local y en la máquina.

- **El criterio (el diagnóstico no lo fijaba para la reserva;
  su tabla de componentes manda «la pestaña del contexto real
  de la pantalla o ninguna»): herencia de contexto.** Reserva,
  confirmación y próxima apertura NO tienen pestaña propia: son
  pantallas de flujo lanzadas desde un contexto, y heredan la
  pestaña de ESE contexto. La reserva captura la pestaña de la
  pantalla activa al entrar (`pestanaFlujo`); la confirmación
  hereda la de la reserva que la produjo; la próxima apertura
  hereda la de su origen — el mismo `origenProxima` que ya
  alimentaba su botón Volver, ahora también manda en la
  pestaña. Si un origen no tuviera pestaña, no se iluminaría
  ninguna (la rama existe en código; ninguna pantalla
  alcanzable la dispara hoy: todo origen real es una pantalla
  de contexto). El Salón conserva su contexto declarado,
  Explorar (arquitectura del producto, PIVOTE Fase 1): el
  diagnóstico no lo señaló y no se ha movido.
- **El cambio**: `NAV_DE` conserva solo las pantallas con
  contexto fijo (inicio, explorar, probador, consentimiento,
  foto, resultado, salón, micita, perfil); `pestanaPara(id,
  anterior)` resuelve las de flujo; `ir()` lee la pantalla que
  se deja ANTES de conmutar (sin ese orden, la herencia leería
  ya la pantalla nueva). `PASOS` (la barra de progreso del
  análisis) no se toca.
- **Área profesional — verificado SIN el defecto**: el único
  camino que cambia de vista es el propio clic en la pestaña,
  que actualiza `.tab.activa`, panel visible y título (los de
  B3) en el mismo gesto; el acceso aterriza en Hoy con su
  pestaña activa ya en el HTML. No había nada que corregir:
  queda verificado en la matriz de las dos pasadas (4/4).
- **Verificación (guion propio `web/qa-b6/b6.mjs`, navegación
  real a 412×915, 0 errores de consola en ambas pasadas)**:
  - **ANTES** (producción v24): 17/17 filas reproducen
    exactamente las mentiras diagnosticadas — reserva desde
    Salón, Inicio, Explorar y Mi cita → «Probador»; próxima
    apertura desde Explorar y desde el Probador → «Inicio»;
    confirmación de una reserva hecha desde Explorar →
    «Perfil» — y lo que ya era verdad sale verdad (consentimiento
    y la reserva sin foto desde el recorrido → «Probador»;
    próxima apertura desde Inicio → «Inicio», su origen real).
    Reserva de prueba AS-AARX cancelada desde la propia página
    `/cita` (queda cancelada, no borrada).
  - **DESPUÉS** (v25): **20/20 filas honestas** — reserva desde
    Inicio → «Inicio»; desde Explorar y desde el Salón →
    «Explorar»; desde Mi cita → «Perfil»; desde el Resultado y
    desde el consentimiento sin foto → «Probador» (su contexto
    real); confirmación → «Probador» heredado del flujo del
    Resultado (análisis real, 12,1 s; reserva AS-AARY, cancelada
    por el canal propio); próxima apertura → la de su origen
    («Explorar» desde Explorar, «Probador» desde el Probador,
    «Inicio» desde Inicio); Inicio/Explorar/Probador/Perfil/Mi
    cita/Salón/consentimiento/foto/resultado, cada una con la
    suya. Profesional 4/4 (pestaña activa = panel visible =
    título por vista en Hoy/Agenda/Por avisar/Mi negocio).
  - **Comparativa visual** servida en
    `web/icons/vista-b6-matriz.png` (compuesta en local — la
    máquina no tiene PIL — desde las capturas de ambas pasadas,
    copiadas a `web/icons/b6-a-*.png` y `b6-d-*.png`), revisada
    píxel a píxel: las pantallas pareadas son idénticas salvo
    la pestaña encendida en la barra inferior.
- **Baterías al cierre** (corrida única tras relanzar el
  proceso web en fresco por `arrancar.sh` — contadores a cero,
  lección de §§54/55): web **33/33** · profesional **25/25** ·
  guarda **11/11** · mecánicas **23/23** · fase2 **22/22**.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina
  en `web/index.html` (`1aa4457c…`) y `web/sw.js` (`6e43301d…`,
  shell **v25**); web reiniciada solo con `arrancar.sh`
  (pid 119419 → 120449); webhook (8080) y agenda (8081) no se
  tocaron; la clave profesional se leyó solo dentro de la
  máquina.

**Nota de sync para la congelación del 04/11** (se suma a las
de §§46–56): entran también `web/index.html`, `web/sw.js`
(v25), `web/qa-b6/` entero, `web/icons/vista-b6-matriz.png`,
`web/icons/b6-a-*.png`, `web/icons/b6-d-*.png` y esta §57 de
`ESTADO_PROYECTO.md`. Los respaldos `*.bak-20261029-b6` NO
viajan al repo.

## §58 · MUSA Bloque B8 — ningún error es un callejón (29/10/2026, noche)

Octavo bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (deficiencia
D5-errores). B7 queda aparcado (decisión de Lee pendiente; no se
ha tocado). Regla del bloque: todo estado de error alcanzable
ofrece al menos una acción de continuación REAL en la misma
pantalla — nada de botones decorativos — y los mensajes que ya
eran buenos se conservan palabra por palabra. Cambian
`web/cita.html`, `web/index.html` y `web/profesional.html`; el SW
sube **v25 → v26** por los cambios de la clienta y **v26 → v27**
por el arreglo del carrusel (ver «Dos defectos cazados»);
`cita.html` no entra en el cascarón del SW (las navegaciones a
`/cita/*` van siempre a red), así que su arreglo intermedio no
necesitó subida propia. Respaldos `*.bak-20261029-b8` en local y
en la máquina.

- **Inventario declarado antes de tocar** (auditoría de las tres
  superficies): 14 estados en la clienta, 7 en `/cita` y 8 en el
  área profesional. Con salida digna ya (CONSERVAR, verificados
  en la matriz): el banner de sin conexión, la foto no válida y
  la de ejemplo, el análisis fallido (el botón pasa a «Intentar
  de nuevo»), el error de la propuesta visual dentro del
  resultado, el día sin huecos/domingo con su tarjeta de espera,
  el **409 (fondo intacto: mensaje, alternativas y vuelta
  automática al paso 2)**, la lista de espera, «Mi cita» vacía,
  el acceso profesional y la sesión caducada, la preparación y
  el 409 de reagendar en `/cita`. Sin salida o con la salida solo
  insinuada en prosa: los de los cambios siguientes.
- **`/cita/<token>` inválido (el callejón de la captura 17 del
  diagnóstico)**: junto a la caja de error — cuyo mensaje del
  servidor no cambia — aparecen dos acciones reales: «Ir a La
  Asistenta» (`/`, primario negro) y «Escribir al salón por
  WhatsApp» (verde WhatsApp, clase nueva `.btn-whatsapp` gemela
  de la de la portada, al wa.me público `584249134367` que ya usa
  `index.html`). Verificado pulsando la primera: vuelve a la
  portada y la carta carga.
- **Explorar**: la búsqueda sin resultados dice ahora «Ningún
  **servicio** coincide con «…»» (fuera el lenguaje de productos)
  y trae «Ver todos los servicios», que limpia la búsqueda y
  restaura la carta; el vacío de módulo activo sin carta pasa a
  «Sin servicios cargados todavía» / «…aún sin servicios
  cargados» y gana el mismo botón, que lleva a la carta de
  belleza. (El estado de módulo se provocó inyectando un módulo
  falso SOLO en el contexto de la página de QA: el registro real
  no se tocó.)
- **Reserva**: (a) si la agenda no responde al pedir los huecos
  (paso 2), el aviso «La agenda no respondió.» trae botón
  «Reintentar» que vuelve a pedirlos (cambiar el día sigue
  reintentando igual); (b) la rama **genérica** del error al
  confirmar gana su acción equivalente a la del 409: «Reintentar
  la reserva» junto a la caja, que repite el mismo intento (en la
  matriz, tras el 502 inyectado, el reintento completó una
  reserva real). La rama 409 no se ha tocado.
- **La carta no carga al arrancar** (servidor caído): los cuatro
  avisos «…no cargó; prueba a recargar la página» pierden la
  prosa y ganan botón «Recargar la página» que recarga de verdad;
  una marca `estado.cartaFallo` hace que Explorar enseñe el mismo
  aviso con su botón en vez de la rejilla vacía que dejaba
  `pintarExplorar()`.
- **`/cita` · huecos al reagendar**: mismo «Reintentar» que en el
  paso 2 de la clienta. Y una regla CSS de una línea
  (`.huecos>p{grid-column:1/-1}`): los mensajes hijos de la
  rejilla de huecos (cargando, domingo, sin huecos, error)
  quedaban apretados en una columna de ~85 px; ahora ocupan todo
  el ancho — se vio al fotografiar el error nuevo.
- **Profesional**: las vistas que no cargan (Hoy, Agenda, lista
  de espera, embudo y carta) ya no dejan un «prueba a recargar»
  en prosa ni un «Cargando…» eterno si la red muere a mitad (la
  excepción de red aterriza en el mismo aviso): `pintarFallo()`
  pinta el aviso con botón «Reintentar» que recarga ESA vista.
  La alerta de acción rechazada decía «Recarga y prueba de
  nuevo» cuando es la propia pantalla la que recarga el día:
  el texto ahora dice lo que pasa («Vuelvo a cargar tu día para
  que veas el estado real»); el mecanismo no cambia.
- **No provocados en vivo, declarados**: la acción profesional
  rechazada (P7) no se pudo provocar en navegación real — exige
  una cita confirmada de HOY y a la hora de la pasada ya no se
  podía crear ninguna (guarda de pasado) —; queda verificada por
  código (texto nuevo + la recarga de Hoy ejercida en otras
  filas). El error de la propuesta visual (Meta) sigue dormido
  sin clave: no provocable en producción; su pantalla conserva
  las salidas del resultado.
- **Dos defectos cazados mirando las capturas** (la matriz se
  revisó imagen a imagen): (1) el botón «Recargar» del carrusel
  quedaba fuera de la vista — el aviso iba en dos hijos sueltos
  de la fila flexible y cada uno ocupaba su propio 80 % —;
  envuelto en un bloque al 100 %: medido tras el arreglo en
  x=18, ancho 376, visible sin desplazar, y la recarga trae la
  carta (SW v27). (2) El «Reintentar» de `/cita` apretado en la
  rejilla (la regla CSS de arriba).
- **Verificación (guiones propios `web/qa-b8/b8.mjs`,
  `captura-b8.mjs` y `captura-carta.mjs`; navegación real a
  412×915 contra la máquina; los fallos de servidor se provocan
  interceptando la petición con el dominio Fetch de CDP — la
  interfaz real recibe un 502 o un corte de red sin tocar el
  servidor — y el 409 se provoca de verdad ocupando el hueco por
  la API entre cargar los huecos y confirmar)**:
  - **ANTES** (producción v25): **7/7 callejones reproducidos**
    tal cual — token sin ninguna acción visible (0), carta en
    prosa, sin resultados con «productos», vacío «productos
    verificados», huecos con la insinuación, genérico sin acción
    propia y Hoy profesional en prosa.
  - **DESPUÉS** (v26/v27): **14/14 filas con su salida
    funcionando** — cada botón nuevo se pulsa en la matriz y se
    comprueba su efecto (volver a portada, restaurar la carta,
    cargar los huecos, completar la reserva, recargar la vista);
    los CONSERVAR ejercidos igual (foto, análisis, 409, espera,
    prep, acceso, banner offline). Errores de consola de ambas
    pasadas: solo los fallos provocados (ERR_FAILED, 404, 500,
    502, 409 y el 401 de la clave mala); cero excepciones JS.
  - **Datos de prueba**: reservas «PRUEBA B8» del 30/10 (Diseño
    de cejas 10:00 y la de la API para el 409) canceladas desde
    la propia página `/cita`; la alta de lista de espera
    «PRUEBA B8» marcada «descartada» por la API profesional; las
    citas de las capturas enfocadas (AS-AASS, AS-AAST) canceladas
    por el canal propio al terminar cada guion. Nada borrado.
  - **Comparativa visual** servida en
    `web/icons/vista-b8-matriz.png` (compuesta en local desde las
    capturas de ambas pasadas, copiadas a `web/icons/b8-a-*.png`
    y `web/icons/b8-d-*.png`), revisada píxel a píxel: fuera de
    los estados de error provocados, las pantallas son las de
    B6. Las capturas de Explorar salieron a mitad de la animación
    de entrada (se ven lavadas en ambos modos por igual); los
    DOM de la matriz son la prueba y las fotos, el contexto.
- **Baterías al cierre** (corrida única tras relanzar el proceso
  web en fresco por `arrancar.sh` — contadores a cero, lección
  de §§54/55): web **33/33** · profesional **25/25** · guarda
  **11/11** · mecánicas **23/23** · fase2 **22/22**. Tras los dos
  arreglos de captura (rejilla de `/cita` y bloque del carrusel)
  se re-ejecutó SOLO la batería que lee el fichero tocado en cada
  caso (`pruebas_web.py`: 33/33 en ambas), con el proceso fresco
  en la del carrusel.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina en
  `web/index.html` (`9fb3be5c…`), `web/cita.html` (`d24e0010…`),
  `web/profesional.html` (`bed34242…`) y `web/sw.js`
  (`c465c442…`, shell **v27**); web reiniciada solo con
  `arrancar.sh` en cada despliegue y antes de cada corrida de
  cierre (último pid 123835); webhook (8080) y agenda (8081)
  no se tocaron; la clave profesional se leyó solo dentro de la
  máquina.

**Nota de sync para la congelación del 04/11** (se suma a las
de §§46–57): entran también `web/index.html`, `web/cita.html`,
`web/profesional.html`, `web/sw.js` (v27), `web/qa-b8/` entero,
`web/icons/vista-b8-matriz.png`, `web/icons/b8-a-*.png`,
`web/icons/b8-d-*.png` y esta §58 de `ESTADO_PROYECTO.md`. Los
respaldos `*.bak-20261029-b8` NO viajan al repo.

## §59 · MUSA Bloque B9 — foto: jerarquía correcta y preferencias declaradas opcionales (29/10/2026, noche)

Noveno bloque del plan de `DIAGNOSTICO_UX_MUSA.md` (fricción
F4/F5 del recorrido): en la pantalla de foto del análisis la
jerarquía estaba invertida y las preferencias parecían cinco
decisiones obligatorias. Cambian solo `web/index.html` (el
bloque de foto de `p-foto`) y el SW (**v27 → v28**). Respaldos
`*.bak-20261029-b9` en local y en la máquina.

- **Alcance y conflicto declarado (no resuelto en silencio)**:
  el diagnóstico concreta B9 SOLO en la pantalla de foto del
  análisis, y así se ha ejecutado. Revisadas contra el
  diagnóstico las demás superficies con foto: la tarjeta de
  orientación del resultado NO lleva foto del servicio — B2 la
  dejó así y el diagnóstico no pide añadirla: ahí mandan el
  servicio, el precio (en negro) y la acción, y no se ha
  tocado —; las tarjetas de servicio son B10 (Explorar, foto a
  170 px, hecho) y la anatomía de Inicio (foto 4:3 con nombre y
  datos debajo en Recomendado, encuadres por foto de QA16/17)
  es decisión cerrada de la ESPEC: cualquier cambio de
  jerarquía de foto ahí contradiría la espec y NO se ha hecho;
  en el Salón el diagnóstico no concreta cambio de foto. Sin
  fotos decorativas ni de stock nuevas: las únicas fotos del
  producto siguen siendo las reales del negocio y la de
  ejemplo declarada del análisis.
- **El defecto, reproducido con números sobre la producción
  actual (v27) antes de tocar** (guion `web/qa-b9/b9.mjs`,
  navegación real a 412×915, 0 errores de consola): «Elegir mi
  foto» y «Usar la de ejemplo» median lo mismo (140×56) pero la
  de ejemplo llevaba el borde negro pleno
  (`1px solid rgb(13,13,13)` sobre transparente) y la propia el
  hairline claro (`1px solid rgb(222,227,231)` sobre blanco):
  el elemento con más peso visual del bloque era la foto
  ajena. Las 5 preferencias venían pre-marcadas (5/5) sin
  ningún rótulo que lo dijera.
- **El cambio** (solo markup y clases del sistema cerrado de
  B4; ni una clase nueva, ni un ID tocado): fuera la fila a la
  par; «Elegir mi foto» pasa a `.btn-primario` a ancho
  completo — la primaria del sistema — y «Usar la de ejemplo»
  queda debajo como `.btn-secundario .btn-peq` a ancho
  completo (blanco, hairline, letra de apoyo). Y sobre el
  primer grupo de preferencias, el rótulo literal del
  diagnóstico: «Tu estilo — ya viene ajustado; cámbialo solo
  si quieres.» El diff completo contra el respaldo son esas
  dos piezas de markup y la constante del SW.
- **Verificación** (el mismo guion en modo DESPUÉS, tras
  desplegar): «Elegir mi foto» 290×52 con fondo negro
  `rgb(13,13,13)` y texto blanco a 15 px — el elemento con
  más peso visual del bloque es subir la foto propia —;
  «Usar la de ejemplo» 290×52 blanco con borde hairline a
  13,5 px, en una línea; rótulo presente y legible sobre
  NATURALIDAD; preferencias intactas (5/5 pre-marcadas, ahora
  declaradas: 0 decisiones obligatorias y la pantalla lo
  dice). **El camino no cambia**: análisis REAL con la foto
  de ejemplo en las dos pasadas (15,3 s antes → «Diseño de
  cejas · 18 € · 25 min»; 18,1 s después → «Brow Lamination ·
  45 € · 65 min»; la recomendación varía entre corridas, es
  el modelo real), 0 errores de consola en ambas.
  Comparativas lado a lado revisadas píxel a píxel:
  `web/icons/vista-b9-foto.png` (la pantalla tocada) y
  `web/icons/vista-b9-resultado.png` (el resultado SIN
  cambios, como verificación de no regresión del recorrido
  completo; originales en `web/icons/b9-a-*.png` y
  `b9-d-*.png`).
- **Delta observado y declarado**: al apilar los botones y
  añadir el rótulo, la tarjeta crece ~120 px y el quinto
  grupo de preferencias («Intensidad del cambio») queda bajo
  el pliegue, alcanzable con scroll como el resto del
  contenido de la app; en la primera pantalla quedan la
  acción principal, la secundaria, el rótulo y cuatro grupos.
  Es la consecuencia deliberada del ancho de primaria que
  manda el bloque; no se ha compensado tocando otros valores.
- **Baterías al cierre** (corrida única tras relanzar el
  proceso web en fresco por `arrancar.sh` — contadores a
  cero, lección de §§54/55): web **33/33** · profesional
  **25/25** · guarda **11/11** · mecánicas **23/23** ·
  fase2 **22/22**.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina
  en `web/index.html` (`3dd6f2f0…`) y `web/sw.js`
  (`312b3c8b…`, shell **v28**); web reiniciada solo con
  `arrancar.sh` (pid 123835 → 125264); webhook (8080) y
  agenda (8081) no se tocaron; la clave profesional se leyó
  solo dentro de la máquina.

**Nota de sync para la congelación del 04/11** (se suma a las
de §§46–58): entran también `web/index.html`, `web/sw.js`
(v28), `web/qa-b9/` entero, `web/icons/vista-b9-foto.png`,
`web/icons/vista-b9-resultado.png`, `web/icons/b9-a-*.png`,
`web/icons/b9-d-*.png` y esta §59 de `ESTADO_PROYECTO.md`.
Los respaldos `*.bak-20261029-b9` NO viajan al repo.

## §60 · MUSA Bloque B10 — Explorar: una tarjeta, una acción (29/10/2026, noche)

Décimo y último bloque ejecutable del plan de
`DIAGNOSTICO_UX_MUSA.md` (B7 sigue aparcado: decisión de Lee
pendiente, no se ha tocado). B9 (§59) había observado que parte
de B10 ya estaba en el código sin sección propia en este
ESTADO, así que el bloque empezó con la **auditoría previa**
contra la definición del diagnóstico, y solo se ejecutó lo que
faltaba. Cambian solo `web/index.html` (la tarjeta de Explorar)
y el SW (**v28 → v29**). Respaldos `*.bak-20261029-b10` en
local y en la máquina.

- **Auditoría previa (definición de B10 → estado encontrado,
  con evidencia)**:
  1. *«Foto menos alta»* — **YA ESTABA HECHO, sin sección**:
     `.prod-card .pc-foto` mide **170 px**. Consta así en los
     respaldos desde el **28/10/2026** (pase modular,
     `index.html.bak-20261028-modular`) y en todos los
     posteriores; la tarjeta `.prod-card` no existe en los
     respaldos anteriores (`-v6`, `-pivote`): nació con esa
     foto. La medida de 350 px del diagnóstico era la **tarjeta
     completa** (su propia tabla de medidas DOM: 376×350) y su
     tabla de componentes la atribuyó a la foto — imprecisión
     que §59 ya registró («foto a 170 px, hecho») y que esta
     auditoría confirma con medición propia ANTES: foto 170,
     tarjeta 350.
  2. *«UNA acción primaria negra Reservar»* — **FALTABA**:
     Reservar era `.btn-fantasma` (transparente, borde negro).
  3. *«Probar con mi foto como acción secundaria de texto»* —
     **FALTABA**: era `.btn-secundario` (contorno blanco) y
     competía en pie de igualdad con Reservar — medidos ambos
     a 138×58 con el mismo peso 700: el «doble botón contorno
     sin primaria» del diagnóstico, literal.
  4. *«Fuera el nombre del salón repetido en cada tarjeta»* —
     **FALTABA**: las 4 tarjetas llevaban
     `<span class="chip-dato">Ari Vivas Beauty</span>` en la
     línea de precio/duración.
  5. *«Descriptor para Depilación o anatomía sin hueco»* —
     **FALTABA por las dos vías**: descriptor no tiene ni debe
     inventarse — el código documenta la decisión de
     honestidad («Descriptores cortos y honestos: son el
     lenguaje del propio salón (los usa la recepcionista); de
     Depilación rápida no afirmamos nada más») y su precio es
     «Consultar» —; y la anatomía sin foto era MÁS BAJA que la
     de con foto (`.pc-sinfoto` 110 px frente a 170; tarjeta
     de 268 frente a 350): un esqueleto distinto, la
     «anatomía incompleta» del diagnóstico.
- **El cambio (solo lo que faltaba; diff completo revisado
  contra el respaldo: 3 piezas)**:
  - `tarjetaProducto` (solo la usa Explorar): **Reservar pasa
    a `.btn-primario`** (negra, la primaria del sistema B4) y
    abre la fila; **«Probar con mi foto» pasa a `.btn-texto`**
    (la acción de texto del sistema: sin caja, subrayada);
    **fuera el chip «Ari Vivas Beauty»** de la meta (el nombre
    del salón sigue donde es título — la tarjeta «El salón ·
    Ari Vivas Beauty» bajo la carta — y en el resto de la
    app). El icono de guardar no cambia: es el componente-icono
    de B4 y su mecánica (Mis guardados) queda intacta.
  - CSS: dos reglas de adaptación de la fila, en el patrón del
    propio sistema (como `.fila-botones .btn{flex:1}`):
    `.pc-acciones .btn-primario{flex:1}` y
    `.pc-acciones .btn-texto{width:auto;flex:none}`.
  - **`.pc-sinfoto` 110 → 170 px**: la caja de medio es LA
    MISMA con foto o sin ella (y la misma que el esqueleto de
    carga `.sk-foto.alta`, 170): anatomía única sin hueco, sin
    inventar ni una palabra sobre el servicio.
  - La anatomía canónica resultante es la del diagnóstico
    (foto, nombre, descripción cuando es lenguaje del salón,
    precio·duración, UNA primaria) y convive con las variantes
    documentadas sin tocarlas: la seleccionable del paso 1
    (`.servicio-card`) y la de Inicio/Recomendado (espec
    cerrada de Lee). Textos, precios y mecánicas intactos; el
    `:root` no se toca (invariante B4 a salvo: el diff no lo
    roza).
- **Verificación (guion propio `web/qa-b10/b10.mjs`,
  navegación real a 412×915 contra la máquina, 0 errores de
  consola en ambas pasadas)**:
  - **Medición DOM antes → después**: tarjeta con foto
    **350 → 340 px** (la fila de acciones baja de 58 a 48 al
    dejar de ser dos cajas); Depilación **268 → 318** (su
    caja de medio 110 → 170, la misma que las demás); meta de
    «18 € · 25 min · Ari Vivas Beauty» a «18 € · 25 min»;
    estilos computados después: Reservar fondo
    `rgb(13,13,13)` con texto blanco (`.btn-primario`), Probar
    transparente a 15/600 (`.btn-texto`), chip del salón:
    **0 en las 4 tarjetas**.
  - **Acciones ejercidas igual en las dos pasadas**: guardar
    alterna y se restaura; «Probar con mi foto» → pantalla de
    consentimiento; «Reservar» (2ª tarjeta) → paso 2 con
    «Ombré Brows Henna» en TU CITA. Sin confirmar ninguna
    reserva.
  - **Comparativas lado a lado revisadas píxel a píxel**:
    `web/icons/vista-b10-explorar.png` (la primera pantalla:
    la primaria negra manda, la secundaria es texto en una
    línea, y de la segunda tarjeta ya se lee también su
    precio sobre el pliegue, cosa que antes tapaba la barra
    de navegación) y `web/icons/vista-b10-depilacion.png`
    (la tarjeta sin foto con la caja a la altura de las
    demás, sobre la de Brow Lamination: mismo componente).
    Originales servidos en `web/icons/b10-a-*.png` y
    `b10-d-*.png`.
  - **Delta declarado, sin maquillar**: tarjetas por
    viewport — el criterio literal del diagnóstico (≥2
    visibles por intersección) se cumple antes y después
    (**2**); completas hay **1**, con la segunda visible al
    **94 %** (antes 88 %) y sus acciones aún justo bajo la
    barra de navegación. La densidad que queda no es la foto
    (170, su objetivo ya cumplido) sino la cabecera de la
    pantalla (244 px: título, buscador y chips) y el cuerpo
    de la tarjeta; bajar la foto por debajo de la pieza ya
    cerrada del propio bloque para ganar el número habría
    sido forzar la métrica, y no se ha hecho (misma categoría
    de delta declarado que §56).
  - **Baterías al cierre** (corrida única con el proceso web
    fresco del despliegue — contadores a cero, lección de
    §§54/55): web **33/33** · profesional **25/25** · guarda
    **11/11** · mecánicas **23/23** · fase2 **22/22**.
- **Despliegue**: `put` con SHA-256 idénticos local = máquina
  en `web/index.html` (`d7ce56bf…`) y `web/sw.js`
  (`7af28efb…`, shell **v29**); web detenida y relanzada solo
  con `arrancar.sh` (pid 125264 → 126594); webhook (8080) y
  agenda (8081) no se tocaron; la clave profesional se leyó
  solo dentro de la máquina.

**Nota de sync para la congelación del 04/11** (se suma a las
de §§46–59): entran también `web/index.html`, `web/sw.js`
(v29), `web/qa-b10/` entero, `web/icons/vista-b10-explorar.png`,
`web/icons/vista-b10-depilacion.png`, `web/icons/b10-a-*.png`,
`web/icons/b10-d-*.png` y esta §60 de `ESTADO_PROYECTO.md`.
Los respaldos `*.bak-20261029-b10` NO viajan al repo.

## §61 · QA21 — Pase integral post-MUSA y preparación del ensayo (30/10/2026, madrugada)

- **Encargo**: re-verificar la app ENTERA en su estado final
  post-MUSA (B1–B6, B8–B10 desplegados en §§52–60), no bloque a
  bloque, antes del ensayo del 02/11: matriz funcional completa,
  ruta de actualización PWA, secuencia de demo del runbook con
  tiempos, delta cosmético declarado de §56, baterías completas
  en verde y cero datos de prueba vivos al cerrar. Sin funciones
  nuevas ni rediseños. Todo lo de esta sección está ejecutado
  contra la máquina real a 412×915 (guiones en `web/qa21/`).

### Defecto real reportado por Lee — cabecera «TU CITA» (ARREGLADO, SW v30)

- **El defecto** (captura de Lee en su móvil, Brave, ~00:31,
  con el pack exacto de su reserva real id 512: Diseño de cejas
  + Ombré Brows Henna + Depilación rápida, sáb 31/10): la barra
  oscura fija del flujo de reserva (`.resumen-mini`) componía en
  UNA fila etiqueta + nombre del pack + precio con `nowrap`; el
  nombre quedaba exprimido en una **columna de 124 px, 5 líneas
  palabra por línea** (anchos medidos [123, 97, 58, 76, 45]),
  la barra medía **161 px** de alto y, al desplazar, tapaba la
  1ª línea de servicio de la tarjeta de resumen y recortaba la
  2ª. Los datos eran correctos (48 € + a consultar, 102 min):
  el fallo era solo de presentación. Reproducido tal cual con
  guion propio (`web/qa21/cabecera.mjs`: pack3 = el caso exacto
  de Lee — se eligió 12:00 porque la reserva 512 ocupa
  10:15–11:57 —, pack4 = el pack máximo de la carta, solo =
  regresión; no confirma reservas).
- **El arreglo (solo CSS en `web/index.html`; sin markup ni
  JS)**: `.resumen-mini` con `flex-wrap:wrap`; `.rm-etq` orden
  1; `.rm-precio` orden 2 con `margin-left:auto` (fila de
  cabecera: etiqueta + precio); `.rm-txt` orden 3 con
  `flex:1 1 100%` (nombre a ancho completo, fecha debajo).
- **Resultado medido**: pack3, barra **161 → 114 px**, columna
  **124 → 344 px**, nombre **5 → 2 líneas** [286, 124]; pack4
  (los 4 servicios, «93 € + a consultar») también 2 líneas y
  114 px; servicio suelto 63 → 95 px (estructura uniforme,
  verificado visualmente). Al desplazar, la barra solo cubre
  la fila de etiqueta de la tarjeta blanca: líneas, Total, Día,
  Hora y Duración visibles. **Gana claramente lado a lado**
  (capturas en `web/qa21/cabecera/{antes,despues}/`, copias
  servidas `web/icons/qa21-{a,d}-*.png`, revisadas una a una).
- **Despliegue**: SW **v29 → v30**; respaldos
  `*.bak-20261030-qa21` de `index.html` y `sw.js` en local y en
  la máquina; SHA local = máquina: index `d6319ded…`, sw
  `c0048e77…`; web reiniciada con proceso nuevo; `/salud` OK.
  **El caso queda permanente en la matriz QA21** (pack más
  largo de la carta real + servicio «a consultar»).

### Delta cosmético de §56 (Salón) — candidato evaluado y RECHAZADO

- Medido en reposo (`web/qa21/salon.mjs`): el h2 «¿No sabes qué
  servicio elegir?» a 23 px ocupa **2 líneas** (53 px) y la
  **barra de reserva del salón** `.salon-barra` (preselección
  por defecto de 1 servicio; y 755–829) cubre la 2ª línea del
  mini de privacidad y 37 de 53 px del botón «Analizar mis
  cejas». Matiz frente a §56: quien cubre es la barra del
  salón, no la barra de navegación. Todo alcanzable con scroll.
- **Candidato probado solo en sesión** (h2 a 19 px, el peldaño
  «destacado» de la escala cerrada de B4, sin desplegar): el h2
  pasa a 1 línea y el mini queda entero visible, **PERO el
  botón «Analizar mis cejas» queda ENTERO (53/53 px) tras la
  barra: peor que el estado actual**. Causa raíz: densidad de
  la primera pantalla (hero + intro + tarjeta) sobre barra fija
  de 74 px + navegación de 59 px; ningún ajuste de ±31 px lo
  resuelve. **No se aplica** (regla: si no gana claramente, no
  se entrega). Riesgo para el 02/11: ninguno — la demo no
  reposa en esta pantalla y todo se alcanza desplazando.

### Secuencia de demo del runbook contra v30 — 8/8

Guion `web/qa21/secuencia.mjs` (log en
`web/qa21/secuencia/log-secuencia.json`), sin gastar Twilio:

| Paso | QA19 (v. anterior) | QA21 (v30) |
|---|---|---|
| Abrir la app | 1,9 s | **1,2 s** |
| Buscar «henna» | 1,5 s | **1,5 s** |
| Recomendado | 2,7 s | **2,7 s** |
| Análisis (paso completo) | 20,0 s | **17,0 s** |
| — análisis E2E en la UI | 15,1 s | **12,1 s** |
| Reservar | 4,7 s | **4,0 s** |
| Enlace mágico | 3,1 s | **3,1 s** |
| Panel profesional | 4,9 s | **4,9 s** |
| Cancelar | 6,2 s | **6,2 s** |

0 errores de consola; `scrollWidth` 412 en todo. Verificado en
vivo post-MUSA: etiqueta «ORIENTACIÓN» en el resultado (B2),
precio en negro `rgb(13,13,13)`, el resumen del modelo cierra
en voz de orientación, puerta de consentimiento intacta. La
cita de la secuencia se reservó en el **primer hueco futuro
real** del día (30/10 10:00 — la guarda de pasados de §§47/49
funciona también aquí) y quedó cancelada (ids 513/514, las dos
corridas). **Contraste con `ENSAYO_Y_DEMO.md`: ningún paso,
texto ni pantalla difiere de lo que el runbook promete en la
v30 → el runbook NO se toca; constancia aquí.**

### Matriz funcional completa — 15/15 (dos corridas)

Guiones `web/qa21/matriz.mjs` (1ª corrida) y
`web/qa21/matriz-b.mjs` (compleción). La 1ª corrida dio **7/15**
con 3 errores de consola, **todos provocados** (409, 404 del
token inventado, 401 de la clave mala). Los 8 fallos se
diagnosticaron uno a uno contra la BD y el código: **eran
bugs de mi guion, no de la app** — buscador leído en
`#explorar-grid` (incluye tarjetas ocultas; el aviso real vive
en `#sin-resultados-exp`/`#sin-resultados-txt`); token derivado
de `localStorage` (ya no trae `g.token`; sale del href de
`#conf-ver-cita`); la espera tiene nombre propio `#esp-nombre`;
«Mi cita» muestra la reserva más reciente del dispositivo (la
fila verificó de hecho eso); la bandeja se leyó truncada a 220
caracteres; el reagendar de `cita.html` usa botones `.hueco`,
no `.hora-fila`. La compleción re-ejecutó cada fila corregida:

| Fila | Resultado |
|---|---|
| buscador-vacio | ✅ aviso «Ningún servicio coincide con…» visible, 0 tarjetas visibles, «Ver todos los servicios» restaura las 4 |
| pack-e2e | ✅ Diseño + Ombré, 31/10 12:00, **AS-AATW**; sumas en la interfaz: 48 € · 90 min; botón .ics visible |
| enlace-ver | ✅ (matriz-b, pack AS-AATZ) CONFIRMADA con pack, fecha y titular correctos |
| enlace-prep | ✅ «¡Guardado! Lo verá el salón junto a tu cita.» — y el prep consta en la BD de la cita |
| enlace-reagendar | ✅ 31/10 → **03/11 10:00**, confirmado en pantalla y en la BD |
| pro-hoy | ✅ cita de hoy creada y marcada **cumplida** desde el panel; su agradecimiento llegó a la bandeja |
| espera-domingo | ✅ «Los domingos el salón cierra» + alta en lista de espera con `#esp-nombre`; descartada después en «Por avisar» en su propia tarjeta |
| error-409 | ✅ mensaje real «Ese hueco se ocupó mientras reservabas… Vuelve a elegir la hora.»; la cita de ocupación se canceló por su enlace. *Nota: la lista de huecos alternativos del mensaje salió vacía en el texto capturado — el mensaje sigue siendo accionable (vuelve al paso de hora), pero queda anotado como pulido posible, sin riesgo para la demo* |
| token-inventado | ✅ error con salidas «Ir a La Asistenta» + WhatsApp (B8) |
| foto-invalida | ✅ «Esa foto no es JPG, PNG ni WebP. Prueba con otra.» |
| guardar-look | ✅ análisis real → look guardado (recomendado: Diseño de cejas) |
| guardados-y-perfil | ✅ guardados y Mis looks poblados; datos de perfil guardados en el dispositivo |
| mi-cita | ✅ muestra la reserva más reciente (en matriz-b, el pack AS-AATZ recién creado) |
| profesional | ✅ clave mala rechazada con error; Hoy con «QA21 Pro» → Cumplida → agradecimiento en bandeja; pack visible en la Agenda de 7 días; alta de espera en «Por avisar»; Mi negocio con carta de solo lectura y embudo con periodo |
| pack-cancelar | ✅ cancelada por su enlace mágico y **sigue cancelada tras recargar** |

- **Cierre de restos de la 1ª corrida** (en matriz-b, por sus
  canales propios): la cita **515** («QA21 Pack», viva) se
  canceló llamando desde la sesión del panel al mismo endpoint
  que usa el botón «Cancelar esta cita» (la vista Agenda es de
  solo lectura y Hoy solo muestra hoy) → 200; el mensaje de
  bandeja **id 54** se descartó con su selector exacto
  `[data-bandeja="54"]`.
- **Observación (sin arreglo, fuera del alcance «sin funciones
  nuevas»)**: «Mi cita» lee la copia guardada en el dispositivo
  al reservar; si la cita se reagenda desde otro dispositivo,
  esa copia no se refresca. Riesgo bajo y ajeno a la demo (el
  enlace mágico siempre muestra el estado real del servidor).
- **Estado final en la BD verificado**: citas QA21 513/514/517/
  518 canceladas, 515 cancelada, 516 cumplida; bandeja 54
  descartada; espera «QA21 Espera» (id 47) descartada. **Única
  cita viva futura: la id 512, la reserva real de Lee — intacta.**

### Ruta de actualización PWA — VEREDICTO: limpia

Guion `web/qa21/pwa.mjs` en dos fases con el mismo perfil de
Chromium (logs y capturas en `web/qa21/pwa/`):

- **Fase 1**: con el `sw.js` v29 (el respaldo
  `sw.js.bak-20261030-qa21`, que solo difiere en el nombre de
  la caché) servido temporalmente: instalación fresca →
  SW v29 `activated` y controlando, caché
  `la-asistenta-shell-v29` única, app renderiza entera
  (Recomendado + 8 pastillas), 0 errores de consola.
- **Fase 2**: restaurado el `sw.js` real v30 (SHA `c0048e77…`
  verificado tras la restauración) → `registration.update()` +
  recarga: **la caché v29 desaparece y queda solo
  `la-asistenta-shell-v30`**, SW activado, página controlada,
  `/` presente en la caché nueva, app entera funcional, 0
  errores de consola. **Una instalación vieja se actualiza a
  la v30 sin quedarse a medias.**

### Baterías completas al cierre (suite única, proceso web fresco)

Web detenida por su pid y relanzada solo con `arrancar.sh`
(pid nuevo 133503; contadores a cero) y suite en una sola
pasada contra la máquina real:

**web 33/33 · profesional 25/25 · guarda 11/11 · mecánicas
23/23 · fase2 22/22 · probador 18/18** (5 FASHN + 13 Meta
contra stub, `Ran 5 tests OK` / `Ran 13 tests OK`).

Tras las baterías, la única cita viva futura sigue siendo la
512: las baterías limpian sus propias citas por su canal
(guarda: ids 525–527 canceladas en su propia limpieza).

### Documentos

- `ENTREGA_HACKATHON.md` actualizado: cifras de baterías en
  «Impact» (33/33 · 25/25 · 11/11 · 23/23 · 22/22 · 18/18),
  latencia 12,1 s de QA21 sumada en «How we used Meta», nota
  del apéndice QA19 corregida (el bug de horas pasadas SÍ se
  parcheó en §§47/49 — constaba como no parcheado), apéndice
  nuevo «Full post-redesign re-verification — QA21» y la
  congelación del 04/11 incluye ya `web/qa21/`.
- `ENSAYO_Y_DEMO.md`: contrastado paso a paso contra la v30 —
  **sin diferencias; no se toca** (constancia en esta sección).
- Incidencia operativa menor: la máquina se suspendió una vez
  durante QA21 (pausa de 30 min entre corridas) y se despertó
  por API con `wake` en segundos, con los tres servicios sanos
  — el mismo procedimiento que el runbook prescribe para el
  02/11 y que la vigilia cubre ese día.

**Nota de sync para la congelación del 04/11** (se suma a las
de §§46–60): entran también `web/index.html` (v30,
`d6319ded…`), `web/sw.js` (v30, `c0048e77…`), `web/qa21/`
entero (guiones `cabecera.mjs`, `salon.mjs`, `secuencia.mjs`,
`matriz.mjs`, `matriz-b.mjs`, `pwa.mjs`, con sus logs y
capturas), `web/icons/qa21-*.png`, `ENTREGA_HACKATHON.md`
actualizado y esta §61 de `ESTADO_PROYECTO.md`. Los respaldos
`*.bak-20261030-qa21` NO viajan al repo.

## §62 · ACTIVACIÓN META — credencial verificada, formas reales confirmadas, BENCHMARK H1 (estrategia A) ejecutado; queda UN gesto de Lee (30/10/2026, madrugada)

La clave de equipo de la Meta Model API existe: Lee la creó en
dev.meta.ai desde su portátil y la pegó en la tarjeta segura del
conector `custom.meta-model-api` (30/10 ~01:46) — nunca pasó por el
chat. Lee confirmó además en la página **Billing** de dev.meta.ai
(30/10 ~01:50) que **los 150 $ de crédito SÍ están aplicados** a su
cuenta; todo el gasto de esta sección va contra ese crédito.

### Credencial verificada sin gasto (vía conector)

- `GET https://api.meta.ai/v1/models` por la ruta del conector
  (sustituto de `dynamic_credentials`, canjeado solo en el egress
  hacia `api.meta.ai`): **HTTP 200, 9 modelos** en la cuenta de Lee:
  muse-spark-1.3 · muse-spark-1.2 · muse-spark-1.1 ·
  muse-spark-1.3-contributor · muse-spark-1.2-contributor ·
  **muse-image-1.0** · **sam-3.1** · muse-voice-transcribe-1.0 ·
  muse-wonder-1.0. IDs exactos usados: `muse-image-1.0`, `sam-3.1`.

### Formas reales confirmadas (ACTIVACION_META.md paso 2, cerrado)

- **Muse Image** edita sobre la superficie Responses
  (`input_text` + `input_image` como data URI), tal como estaba
  cableado: imagen WebP de vuelta, latencia medida ≈ 21 s en el
  humo, 0,01 $. La forma de `editar_cejas()` queda confirmada sin
  cambios.
- **SAM 3.1** responde también por Responses (200, «completed»),
  pero su salida es el `output_text` del protocolo oficial con
  tokens `<|box;…|>` y `<|mask;…;data=<alto>,<ancho>,<RLE>|>`.
  `segmentar()` ya parsea ese formato real (caja + máscara en su
  RLE nativo); decodificar el RLE a bitmap exige el códec del
  cliente oficial (meta-models/meta-sam) y queda pendiente — solo
  lo necesitan las estrategias B/C; producción (A) no lo llama.
  Ambos ajustes y su evidencia viven en la cabecera de
  `probador/proveedor_meta.py`.

### Humo (paso 3) — ejecutado por la vía del conector

La edición real sobre la foto de ejemplo del proyecto
(`web/ejemplo.jpg`, stock autorizado; nunca fotos de clientas)
generó la propuesta visual con identidad preservada. El flujo de la
web en la máquina queda verificado en su forma dormida (ver el
gesto pendiente): sin clave en la máquina, la clienta recibe el
análisis como siempre y ningún paso visual aparece.

### ⚠️ EL ÚNICO GESTO PENDIENTE — paso 1 en su forma literal

La entrega a la máquina NO pudo completarse desde el agente, por
diseño de la bóveda: el conector entrega la credencial como
**sustituto canjeable solo en peticiones del propio agente**;
ningún canal soportado permite leer su valor en claro ni
escribirlo en un fichero. Estado real comprobado en la máquina:
**no existe `/data/la-asistenta/web/meta.env`** y
`GET /api/capacidades` responde `disponible: false`
(`proveedor_meta.py estado` → `fuente_clave: ninguna`). No se
improvisó ningún rodeo inseguro.

**El gesto exacto que falta (solo Lee, ~1 minuto, en la consola de
la máquina `la-asistenta` de su panel InstaBox):**

```bash
printf 'META_MODEL_API_KEY=%s\n' 'PEGA-AQUÍ-TU-CLAVE' > /data/la-asistenta/web/meta.env
chmod 600 /data/la-asistenta/web/meta.env
```

(El valor es la clave que él creó en dev.meta.ai → API keys; si la
consola no permite volver a verla, crea una nueva — se muestra una
sola vez — y usa esa; la del conector puede quedarse como está.)
Sin reinicio: el servidor lee la clave en cada petición y
`/api/capacidades` pasará a `disponible: true` en la siguiente
llamada, encendiendo el paso visual exactamente como quedó
cableado en §48. Verificación posterior prevista: humo del paso 3
de ACTIVACION_META.md ya dentro de la web (consentimiento →
análisis → propuesta visible → guardar en Mis looks).

### Benchmark H1 — estrategia A ejecutada (orden de Lee «Hazlo a tope», 01:55)

Detalle completo y apéndice de resultados en `BENCHMARK_H1.md`;
artefactos en `h1/resultados/` (set.json · registro.jsonl ·
puntuacion_tecnica.json · hojas `contacto.jpg` por imagen).

- **Alcance**: estrategia A sobre IMG-01…IMG-06 del set de banco
  (descargadas de Pexels con ID y licencia registrados y miradas
  una a una antes de asignar el caso). **IMG-07/IMG-08 no se
  ejecutaron**: exigen el consentimiento escrito de la plantilla
  de §3.6, que no consta. Estrategias B/C no ejecutadas (SAM sin
  códec RLE; la decisión de producción ya era A).
- **Generación**: 12/12 propuestas (6 casos × 2 intensidades), 0
  errores, con la MISMA función y la MISMA instrucción que
  producción (`proveedor_meta`), transporte por el conector.
- **Latencia de edición**: p50 **16,1 s** · media 16,9 s · rango
  11,4–24,3 s (criterio §3.6: p50 ≤ 45 s ✓).
- **Puntuación técnica** (rúbrica §3.4, juez operador; la ciega de
  Arianna es el voto decisivo y queda pendiente): Calidad media
  **4,33/5** (natural 4,67 · marcada 4,00 — la marcada tiende a
  sobre-rellenar), Identidad **5,00/5** (ninguna < 3),
  Delimitación **5,00/5**, **fugas graves 0/12 (0 %)**. Incluso el
  caso girado ~90° (IMG-03) editó solo las cejas.
- **Veredicto**: estrategia A **apta y confirmada para
  producción** en todos los criterios medibles de §3.6; abierto
  solo el criterio de aceptación (≥60 % «enseñable» según Arianna),
  que no bloquea el encendido porque la propuesta se presenta
  siempre como orientación que ella confirma en el salón.
- **Ejemplos servidos** en la web viva:
  `/icons/vista-benchmark-img02.jpg` e
  `/icons/vista-benchmark-img04.jpg` (original | natural |
  marcada; HTTP 200 verificado).
- Observación menor registrada: `construir_instruccion()` añade
  «/5» tras la naturalidad textual de producción («naturalidad muy
  natural/5»); es el constructor que usa producción tal cual y el
  benchmark lo heredó sin tocar — cosmético dentro del prompt, sin
  efecto observado en los resultados.

### Gasto Meta de la activación (contra el crédito de 150 $)

- Humo: edición 0,01 $ + SAM 0,0025 $ ≈ **0,013 $**.
- Benchmark H1-A: 12 × 0,01 $ = **0,12 $**.
- **Total documentado ≈ 0,13 $** (tope autorizado de la orden:
  1,50 $). Sin ningún otro cargo: el listado de modelos es de solo
  lectura.

### Baterías completas al cierre (máquina real)

Con el procedimiento de §61 (web detenida por su pid y relanzada
solo con `arrancar.sh`, pid nuevo 135965, contadores a cero) y la
suite en una pasada:

**web 33/33 · profesional 25/25 · guarda 11/11 · mecánicas 23/23 ·
fase2 22/22 · probador 18/18** (unittest contra stub, como siempre;
la parte Meta REAL queda cubierta por el humo y el benchmark de
esta sección, no por la batería offline).

Incidencia de procedimiento, registrada: una primera pasada contra
el proceso web longevo dio profesional 8/24 por el rate-limit de
acceso en memoria (la propia batería web consume inicios de sesión
del panel); con proceso fresco y una sola pasada, 25/25 — el mismo
fenómeno ya documentado en B3/§61. Sin cambios de código.

### Documentos

- `BENCHMARK_H1.md`: apéndice de resultados de la estrategia A.
- `ENTREGA_HACKATHON.md`: el párrafo de Muse Image + SAM ya
  recogía la verificación de la clave y el crédito confirmado; se
  le suma el resultado del benchmark H1 (12 propuestas, p50 16,1 s,
  identidad y delimitación 5,0/5, aceptación de Arianna pendiente).
  El único ⚠️ que queda en el documento es la URL del vídeo.
- `ACTIVACION_META.md`: nota de estado 30/10 en la cabecera con el
  gesto pendiente y su forma exacta.

**Nota de sync para la congelación del 04/11** (se suma a las de
§§46–61): entran también `probador/proveedor_meta.py` (formas
reales confirmadas), `h1/resultados/` (set, registro, puntuación y
hojas de contacto), `BENCHMARK_H1.md` con su apéndice,
`ACTIVACION_META.md` con su nota, `ENTREGA_HACKATHON.md`
actualizado, `web/icons/vista-benchmark-img02.jpg` e
`img04.jpg`, y esta §62 de `ESTADO_PROYECTO.md`. Excluidos como
siempre: `web/meta.env` (no existe aún; cuando exista, NUNCA viaja
al repo), claves y ficheros de entorno.

### Apéndice §62 · El gesto, reducido a un solo guion (30/10/2026, ~02:20)

La forma literal con `printf` resultaba confusa de madrugada, así
que el gesto queda empaquetado en un guion interactivo creado en
la máquina: **`/data/la-asistenta/bin/activar-meta.sh`** (copia
local idéntica en `bin/activar-meta.sh`, SHA-256
`c5238e8ef842d7e6…` en ambos lados). El guion: explica en una
línea qué hace, pide «Pega tu clave de Meta y pulsa Enter»
leyendo **sin eco** (`read -s`; la clave no se imprime, no se
registra y no viaja como argumento), escribe
`web/meta.env` con `META_MODEL_API_KEY=<valor>` y permisos
**600**, comprueba `GET /api/capacidades` y dice el veredicto en
lenguaje llano («✅ ENCENDIDO» o qué revisar), y cierra diciendo
que ya puede cerrar la consola.

**La orden exacta que Lee tecleará (una sola línea, en la consola
de la máquina `la-asistenta` de su panel InstaBox):**

```bash
bash /data/la-asistenta/bin/activar-meta.sh
```

**Prueba del guion (con la regla dura respetada)**: jamás se
ejecutó contra el `meta.env` real. Se probó en la máquina con el
destino sobreescrito a ficheros temporales
(`META_ENV_DEST=/tmp/…`, URL de capacidades sustituida por un
JSON local): rama «encendido» → veredicto correcto; rama «no
encendido» → consejos correctos; entrada vacía → sale con error
sin crear fichero. Formato del temporal verificado
(`META_MODEL_API_KEY=<valor>` en una línea) y permisos **600**.
Los temporales se borraron tras la prueba.

**Confirmación de cierre**: tras todo lo anterior,
`/data/la-asistenta/web/meta.env` **sigue sin existir** y
`GET /api/capacidades` sigue respondiendo `disponible: false` —
la honestidad del sistema queda intacta hasta que Lee ejecute el
guion con su clave. Ningún otro fichero de producción se tocó.
Nota de sync (se suma): entran también `bin/activar-meta.sh` y
este apéndice.

## §63 · SINCRONIZACIÓN INTERMEDIA DEL REPO PÚBLICO (30/10/2026)

Ejecutada la sync intermedia sobre `0eddb61` (29/10 ~14:05) para
que la congelación del 04/11 sea un diff pequeño y seguro. Contenido
compuesto desde las notas de sync de §§46–62: **64 rutas** (12
actualizaciones y 52 incorporaciones), un solo commit de snapshot
sobre `main` en github.com/Blackleets/la-asistenta. Hash del
commit: queda registrado en el fichero de sync
(`~/workspace/la-asistenta-repo.muse-github-snapshot-sync.json`,
6ª entrada) y se completa en esta sección en el original interno
tras la confirmación del push; manifiesto en
`~/workspace/la-asistenta-paths-v6.bin`.

**Contenido por bloque**:

- **§46 (entrega)**: `ENTREGA_HACKATHON.md` (nuevo) y `web/qa19/`
  en texto (guion y log del pre-ensayo).
- **§47 + §49 (guardas de pasado)**: `agenda/agenda_comun.py`,
  `agenda/agenda_api.py`, `agenda/mcp_agenda.py`,
  `agenda/pruebas_api_guarda.py`, `web/web_server.py`,
  `web/pruebas_web.py`.
- **§48 + §62 (cableado y activación Meta)**:
  `probador/proveedor_meta.py` (formas reales confirmadas),
  `probador/stub_meta.py`, `probador/test_proveedor_meta.py`,
  `probador/INTERFACES.md`, `ACTIVACION_META.md`,
  `BENCHMARK_H1.md` con su apéndice de resultados, los registros
  de texto de `h1/resultados/` (`set.json`, `registro.jsonl`,
  `puntuacion_tecnica.json`, `errores.jsonl`) y
  `bin/activar-meta.sh`.
- **§50 (vigilia)**: `bin/vigilia.sh`.
- **§51 (pulido QA20)**: `web/qa20/` en texto (guiones y logs).
- **MUSA B1–B6 y B8–B10 (§§52–60)**: `web/index.html`,
  `web/cita.html`, `web/profesional.html`, `web/sw.js` (v30),
  `web/web_server.py`, la batería nueva
  `web/pruebas_profesional.py` y las carpetas `web/qa-b1/`,
  `web/qa-b2/`, `web/qa-b3/`, `web/qa-b4/`, `web/qa-b5/`,
  `web/qa-b6/`, `web/qa-b8/`, `web/qa-b9/`, `web/qa-b10/` en
  texto (guiones, transformadores e informes).
- **§61 (QA21)**: `web/qa21/` en texto (guiones y logs) y
  `ENTREGA_HACKATHON.md` actualizado.
- **ESTADO**: esta historia completa hasta §63, saneada (abajo).

**Auditoría de secretos, por dos vías** (la de siempre, reforzada):

- *Vía local*: grep exhaustivo sobre los 64 ficheros candidatos
  ANTES de copiar (teléfono actual de Lee en todas sus formas,
  el antiguo 678, su email, el fragmento del teléfono de Arianna,
  el token de demo de la agenda, el prefijo de las claves de Meta, SID de Twilio `AC…`,
  asignaciones con valor literal de KEY/TOKEN/SECRET, `Bearer`
  con valor, blobs de 40+ caracteres y móviles españoles). Un
  solo hallazgo: ese fragmento en la §45 interna,
  saneado SOLO en la copia pública («tel. omitido en la copia
  pública», la fórmula de siempre); el original interno queda
  intacto. El resto: limpio. Los teléfonos que aparecen son los
  ficticios de batería (600123456 y familia) y el wa.me público
  del salón (584249134367), que es público por la web de Arianna
  y ya constaba en el repo.
- *Vía remota*: tras el push, búsqueda de código en GitHub sobre
  el repo (fragmento saneado, email, teléfono) — 0 resultados
  (detalle en el informe de la sync).

**Excluidos, confirmados**: `hermes-home/`, `*.db`, logs de
ejecución, `*.bak-*`, `profesional.env`, `agenda.env`,
`meta.env` (sigue sin existir), `RUTA_C_TWILIO.md`,
`ESTADO_PARA_CHATGPT.md`, `PLAN_EXPOSICION.md`, las fotos de
`h1/set/` y los binarios de `h1/resultados/` (hojas de contacto),
y **todos los binarios de vistas y capturas** (`web/icons/*.png`,
`web/qa*/**/*.png|jpg`): el canal de publicación los rechaza y
las vistas se referencian por su URL viva, como en 0eddb61. El
README público queda intacto.

**Pendiente EXACTO para la congelación del 04/11**:

1. El humo de activación dentro de la web si Lee ejecuta
   `bin/activar-meta.sh` (cierre de §62) y su registro.
2. La URL del vídeo de la demo en `ENTREGA_HACKATHON.md` (único
   ⚠️ que queda en el documento).
3. Esta §63 completada con el hash del commit de esta sync.
4. Retoques finales de última hora y el commit de congelación.
5. `DIAGNOSTICO_UX_MUSA.md` y `musa-diag/` (evidencia del
   diagnóstico MUSA): no estaban en las notas de sync de
   §§52–60 y no viajan en esta sync; decidir su inclusión en la
   congelación.

La app en producción no se ha tocado en esta sync (ni un
reinicio): solo se ha actualizado esta historia en la máquina,
como en cada bloque.
