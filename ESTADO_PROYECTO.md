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
