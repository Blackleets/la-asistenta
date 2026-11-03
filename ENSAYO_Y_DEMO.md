# RUNBOOK — Ensayo general (02/11) y entrega del hackathon (04/11)

> Preparado el 29/10/2026. Documento operativo: se ejecuta tal cual, sin
> improvisar. Fuentes: `GUION_DEMO.md` (el qué se graba),
> `ESTADO_PROYECTO.md` (limitaciones, Fase D de Twilio, Fase 2 de la
> Orden Maestra) y `AUDITORIA_ORDEN_MAESTRA.md` (hallazgo D8).
> ⚠️ El guion es del 27/10 y parte de su plan B quedó superado (token de
> Meta de 24 h, túneles efímeros): **en lo operativo manda este
> runbook** — el canal es Twilio sandbox con URLs fijas de InstaBox.
>
> **Presupuesto sagrado**: la cuenta trial de Twilio tiene **100
> mensajes**. Este runbook completo (ensayo + grabación + entrega) está
> diseñado para gastar **≤ 30**. Las autopruebas del servidor van
> directas a la máquina (consumo 0) y son siempre la primera opción.

> **Actualización QA23 (31/10/2026 — pre-ensayo contra la app final
> v31, probador visual ENCENDIDO)**: la secuencia de demo se ha
> corrido entera contra la app final. El análisis ya no tarda
> ~12 s: tarda **33–38 s** de extremo a extremo, porque el resultado
> incluye la propuesta visual generada (Spark 11,9–13,5 s + Muse
> Image 16,4–17,7 s, medidos en servidor). La escaleta de §2 sigue
> cabiendo en 3:00 con UN ajuste de edición en el plano del análisis
> (§2 y apéndice QA23 al final de este documento). El rótulo «En
> construcción — vista previa con Muse Image + SAM 3.1» queda
> RETIRADO: la propuesta es real desde el 30/10 (§65 del ESTADO) y
> abre la pantalla de resultado (la foto manda arriba).

## 0. Datos fijos (no cambian entre días)

| Pieza | Valor |
|---|---|
| Máquina | InstaBox `la-asistenta` (`m_agqyfjnmnvcrrnfraerzrpu5ye`), helper `custom.instabox` (`wake`, `exec`, `put`) |
| Web de la clienta | https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech |
| Webhook WhatsApp | https://8080-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech |
| Sandbox de Twilio | **+49 15888 620339** · unión: `join twilio-trial` (caduca a los 3 días sin actividad) |
| Teléfono de Lee | omitido en la copia pública |
| Respuesta WhatsApp | Viaja en el **TwiML** del webhook (`TWILIO_REPLY_MODE=twiml`). **NO tocar** — ver §4.3 |
| Arranque en la máquina | `bash /data/la-asistenta/arrancar.sh` (idempotente: webhook 8080 + agenda 8081 + web 8090) |
| Salud | `/salud` en los tres puertos debe responder OK antes de seguir |
| Conteo de mensajes | Cada turno de WhatsApp cuenta **2** (ida + respuesta). El `join` cuenta 1 |

**Regla de despertar (verificada en la auditoría, D8)**: la máquina se
pausa a los 30 min sin uso y **una visita a la URL web ya NO la
despierta**. Se despierta **por API** (`wake` del helper). Máximo 8 h
seguidas encendida: planifica cada jornada dentro de esa ventana.

**Vigilia anti-sueño (montada el 29/10, §50 de `ESTADO_PROYECTO.md`)**:
la vigilia cubre el 02/11 de 09:00 a 23:59 — el cron
`la-asistenta-vigilia-trabajo` ejecuta `bin/vigilia.sh` cada ~20 min
(despierta la máquina por API y comprueba `/salud` ×3 más las URLs
públicas; silencio si todo está sano, aviso solo si algo queda caído
tras el reintento). El 04/11 rige la misma cobertura. Aun así, el
calentamiento manual del §1 sigue siendo el procedimiento: la vigilia
es la red, no un sustituto.

---

## 1. Cronograma del ensayo general — lunes 02/11/2026 (Europe/Madrid)

Objetivo del día: correr el guion ENTERO una vez, con la máquina real,
el canal real y el presupuesto contado. Si el ensayo sale limpio, la
grabación puede hacerse la misma tarde (§2) o el 03/11 repitiendo solo
el calentamiento (§1, pasos 1–4).

| Hora | Paso | Detalle y verificación |
|---|---|---|
| **10:00** | **1. Despertar la máquina** | `wake` por el helper de InstaBox. Si los procesos no sobrevivieron a la pausa: `exec` → `bash /data/la-asistenta/arrancar.sh`. Verificar: `/salud` OK en 8080, 8081 y 8090. Sin los tres OK no se sigue. |
| 10:05 | **2. Re-unión al sandbox de Twilio** | Desde el móvil de Lee, enviar `join twilio-trial` al **+49 15888 620339**. La unión anterior habrá caducado (3 días sin actividad). **Mensajes: 1 (acumulado 1).** |
| 10:10 | **3. Calentar la sesión de Hermes** | Autoprueba del servidor directa a la máquina (firma HMAC, como la del 28/10): debe devolver 200 con la respuesta dentro del TwiML en <15 s. **Consumo Twilio: 0.** Después, Lee envía «Hola» desde su móvil: respuesta esperada en 3–5 s (sesión caliente). **Mensajes: 2 (acumulado 3).** |
| 10:20 | **4. Ensayo WhatsApp — conversación de reserva completa** | Guion de Carmen (el del vídeo, §2, planos 0:35–1:50): saludo y recomendación → elección y hora → resumen → «Sí, déjalo confirmado». 4 turnos. **Mensajes: 8 (acumulado 11).** Verificar en la agenda (área profesional o API) que la cita existe, confirmada, con su código AS-XXXX. |
| 10:35 | **5. Ensayo WhatsApp — derivación a humana** | Un mensaje ambiguo («¿me podéis hacer algo en el pelo también?») → la operadora deriva a Arianna en vez de improvisar. 1 turno. **Mensajes: 2 (acumulado 13).** |
| 10:45 | **6. Ensayo web — reserva completa** | Desde el móvil, en la web pública: Explorar → servicio de cejas → huecos reales → reservar (pack o simple) → confirmación con código y enlace mágico → abrir el enlace → reagendar o cancelar desde él. **Consumo Twilio: 0.** La cita de ensayo se deja **cancelada** al terminar (nunca borrada). |
| 11:00 | **7. Ensayo web — análisis de cejas con foto** | Consentimiento → foto de prueba autorizada → sondeo hasta resultado real. El resultado ya incluye la **propuesta visual generada**: comprobar que la tarjeta «PROPUESTA VISUAL · ORIENTATIVA» llega y abre la pantalla (la foto grande arriba; debajo, «Esto ve La Asistenta»). **Cronometrar la latencia completa y anotarla**: ese número decide en §2 si el plano del análisis se graba en vivo o pregrabado. Referencia QA23 (31/10): **33–38 s** de extremo a extremo (Spark ~12–13,5 s + visual ~16–18 s en servidor). Si la latencia completa supera ~60 s o encadena un error, se anota «racha lenta» y se aplica el plan B del vídeo. **Consumo Twilio: 0.** |
| 11:15 | **8. Ensayo — área profesional** | Entrar en `/profesional` con la clave (fuera de cámara: la clave no se enseña nunca) → «Hoy» muestra la cita del paso 4 → marcarla **cumplida** → comprobar la bandeja de salida → revisar «Por avisar» y el embudo. **Consumo Twilio: 0.** |
| 11:30 | **9. Cierre del ensayo** | Cancelar cualquier cita de ensayo que quede viva (las marcadas cumplidas en el paso 8 se quedan como evidencia del embudo, identificadas como prueba). Anotar en `ESTADO_PROYECTO.md`: latencia del análisis, mensajes gastados (meta: ≤15; previsto: **13**), incidencias. La máquina puede pausarse sola a los 30 min: no pasa nada, el siguiente arranque es el paso 1. |

**Presupuesto del ensayo: 13 de 100.** Si algo falla y hay que repetir
un bloque, se repite SOLO ese bloque: el margen hasta 100 es amplio,
pero cada repetición de la conversación completa cuesta 8.

---

## 2. Grabación del vídeo (3 min) — plano a plano

Base: la tabla minuto a minuto de `GUION_DEMO.md`, actualizada al
estado real del 29/10. Regla de oro que no cambia: **todo lo «en
directo» es en directo**; lo pregrabado se etiqueta en pantalla.

| Tiempo | Plano (del guion) | Cómo se graba | Etiqueta en pantalla |
|---|---|---|---|
| 0:00–0:20 | Arianna fuera de horario, WhatsApp acumulado, reloj 23:40 | **Pregrabado** (material real del salón, sin datos de clientas visibles: notificaciones de la conversación de ensayo, no reales) | — |
| 0:20–0:35 | Esquema de arquitectura (📞 WhatsApp · 🧠 Spark · 📋 agenda) | **Pregrabado** (gráfico) | — |
| 0:35–1:05 | Clienta escribe y recibe recomendación con precios reales | **EN VIVO** — conversación real por el sandbox de Twilio, grabación de pantalla sin cortes en el contenido; las esperas se aceleran en edición con el «escribiendo…» visible | — |
| 1:05–1:30 | Resumen de la cita y «¿Te lo dejo confirmado?» | **EN VIVO** (continuación de la misma conversación) | — |
| 1:30–1:50 | Al confirmar, la cita **aparece en la agenda** | **EN VIVO** — doble pantalla: móvil de la clienta + **área profesional «Hoy»** (la agenda real; el visor SQLite del guion original ya no es la superficie: existe área profesional de verdad) | `La cita se escribe en la agenda EN DIRECTO` |
| 1:50–2:15 | Foto → análisis → **propuesta visual** | **Decisión del ensayo (§1 paso 7)**: latencia completa anotada ≤ ~45 s → **EN VIVO** en la web (el sondeo asíncrono muestra progreso honesto). Medido en QA23 (31/10, app final v31): **33–38 s** de extremo a extremo → en vivo, con la **espera acelerada en edición (×~1,5)** para que el plano quepa en sus 25 s — la misma técnica ya usada en las esperas de WhatsApp. El resultado abre con la **foto generada grande** («PROPUESTA VISUAL · ORIENTATIVA») y debajo la orientación en texto: la narración describe ese orden (primero cómo se vería; después, la explicación). Racha lenta (>45 s) → **pregrabado**: se emite una grabación de un análisis REAL hecho ese mismo día, con rótulo y la latencia medida declarada en la narración. **Jamás simulado ni con resultado de otro día sin decirlo.** | — (la propuesta es real desde el 30/10, §65: el antiguo rótulo «En construcción» queda retirado) |
| 2:15–2:40 | Día organizado de Arianna + derivación a humana | **EN VIVO** — área profesional real + el mensaje ambiguo del ensayo (§1 paso 5, se puede reaprovechar la toma del ensayo si quedó limpia, etiquetada como ensayo) | `Ante la duda, deriva a la humana` |
| 2:40–3:00 | Plano final: el salón en funcionamiento | **Pregrabado** (material real del salón: Arianna trabajando con una clienta, su móvil boca abajo y en silencio; rótulo final con el nombre y la frase de cierre) | `La Asistenta — la recepcionista 24/7 que una pyme sí puede pagar` |

---

> **⚠️ Reposición (31/10/2026)**: la fila 2:40–3:00 de la tabla
> de §2 y las secciones §3 y §4 que siguen son una **REPOSICIÓN
> reconstruida, no el texto original**. QA23 detectó que las tres
> copias de este runbook (local, máquina y repo público) estaban
> truncadas en el mismo punto, sin copia íntegra en git ni en
> respaldos (§66 de `ESTADO_PROYECTO.md`), y dejó el pendiente
> registrado. La reposición se ha hecho solo desde los registros
> del proyecto: la fila 2:40–3:00 desde `GUION_DEMO.md` (su tabla
> minuto a minuto y sus textos en pantalla de cierre) y la tabla
> del guion final de `ENTREGA_HACKATHON.md`; §3 desde
> `ESTADO_PROYECTO.md` (§46, §50 y las notas de sync de §§62–66)
> y los campos de `ENTREGA_HACKATHON.md`; §4 desde las reglas ya
> escritas en el ESTADO (§§46, 50 y 63, y la Fase D) y en la §0
> de este mismo runbook. Del §4 original solo sobrevive una
> evidencia de estructura: la referencia «ver §4.3» de la tabla
> de §0, que apuntaba a la regla del TwiML — se ha conservado
> esa regla como §4.3; el orden del resto de reglas dentro de
> §4 es editorial, no texto recuperado. Lo que las fuentes no
> sostienen no se ha repuesto: ningún registro conserva horas
> concretas de la jornada del 04/11 más allá de las anclas de
> §3, y no se han inventado. La copia del repo público sigue
> truncada: este fichero repuesto viaja con la congelación del
> 04/11 (anotado en el apéndice de la §66 del ESTADO).

## 3. Entrega — miércoles 04/11/2026

La jornada de entrega tiene la misma cobertura anti-sueño que
la del ensayo: el cron `la-asistenta-vigilia-trabajo` cubre
también el 04/11 de **09:00 a 23:59** (§50 del ESTADO,
re-verificado en QA23), así que la máquina estará despierta y
sana durante toda la ventana. La vigilia es la red, no el
procedimiento: si hay que tocar la app ese día, manda el
calentamiento manual de §1.

Pasos, en orden:

1. **La URL del vídeo, en su campo.** Pegar la URL del vídeo de
   3 min — grabado tras el ensayo del 02/11 (la misma tarde o
   el 03/11, §2) — en el campo «Demo video» de
   `ENTREGA_HACKATHON.md`. Es el único ⚠️ que queda en el
   documento: la confirmación viva de WhatsApp se cierra en el
   ensayo del 02/11 (§1) y la activación de Meta quedó cerrada
   el 30/10 (§65 del ESTADO). El campo se rellena en el momento
   del envío, no antes (así lo declara el propio paquete).
2. **Congelación del repo.** Commit final sobre `feb8993` (la
   sync intermedia del 30/10, §63 del ESTADO), precedido de la
   **auditoría de secretos por dos vías** de siempre (grep
   local exhaustivo antes de copiar + búsqueda de código en
   GitHub tras el push). Contenido, según la suma de las notas
   de sync de §§62–66 y el pendiente exacto de §63:
   - `web/index.html` y `web/sw.js` (v31); `web/qa22/` y
     `web/qa23/` en texto (guiones y logs; las capturas PNG no
     viajan, como siempre).
   - `ACTIVACION_META.md` (completada), `ENTREGA_HACKATHON.md`
     final, este runbook repuesto y el `ESTADO_PROYECTO.md`
     final (con la §63 completada con el hash de su commit).
   - Las notas del ensayo del 02/11.
   - Decisión pendiente (§63, punto 5): si
     `DIAGNOSTICO_UX_MUSA.md` y `musa-diag/` entran en la
     congelación.

   Excluidos, como en cada sync: `hermes-home/`, `*.db`, logs
   de ejecución, `*.bak-*`, `profesional.env`, `agenda.env`,
   `meta.env`, `RUTA_C_TWILIO.md`, `ESTADO_PARA_CHATGPT.md`,
   `PLAN_EXPOSICION.md`, las fotos de `h1/set/` y todos los
   binarios de vistas y capturas.
3. **Envío del formulario.** `ENTREGA_HACKATHON.md` está
   redactado campo a campo para copiar y pegar: se pega y se
   envía. **Objetivo interno: entregado el 04/11 a las 23:00
   Madrid.** Límite oficial: **04/11 21:00 ET = 05/11 03:00
   Madrid** (§46 del ESTADO).
4. **Después del envío.** La evaluación corre con la vigilia
   del jurado (`la-asistenta-vigilia-jurado`, 05–10/11, de
   14:00 a 02:00, §50 del ESTADO). Retirada prevista de ambos
   crons de vigilia: **11/11/2026**.

No bloquea la entrega: la rotación del token de la agenda sigue
preparada y esperando el OK de Lee (§46 del ESTADO); no forma
parte del envío.

---

## 4. Qué no tocar

Reglas que protegen el ensayo, la grabación y la entrega. Todas
están ya escritas en los registros del proyecto; esta sección
las reúne (ver la nota de reposición que precede a §3).

### 4.1 La máquina y su arranque

- La máquina se despierta **solo por API** (`wake` del helper
  de InstaBox): se pausa a los 30 min sin uso y **una visita a
  la URL web NO la despierta** (§0 de este runbook y §50 del
  ESTADO). No se «prueba» la app a golpe de visitas esperando
  que despierte sola.
- Los servicios (8080 webhook · 8081 agenda · 8090 web) se
  arrancan **solo** con `bash /data/la-asistenta/arrancar.sh`.
  Tras un `wake`, los procesos preservados vuelven sirviendo
  sin relanzar nada (§50 del ESTADO): primero se comprueba
  `/salud` en los tres puertos, y `arrancar.sh` solo entra si
  algo no responde.

### 4.2 Secretos y claves

- `profesional.env`, `agenda.env` y `meta.env` viven solo en
  la máquina, con permisos 0600, y quedan **fuera de toda sync
  y del repo** (§63 del ESTADO, exclusiones confirmadas).
  Ninguna clave se pega en el chat, en documentos del proyecto
  ni en capturas.
- La clave del área profesional **no se enseña nunca**, tampoco
  en el vídeo: se entra en `/profesional` fuera de cámara (§1,
  paso 8).

### 4.3 El canal de WhatsApp: la respuesta viaja en el TwiML

- `TWILIO_REPLY_MODE=twiml` es **intocable** en el webhook: la
  cuenta trial rechaza los envíos de texto libre por la API
  REST (error 21654) y la respuesta a la clienta viaja dentro
  del TwiML de la respuesta HTTP del webhook. No revertir
  `webhook.py` ni quitar el ajuste: se rompería el canal en
  directo. (Es la regla a la que apunta el «ver §4.3» de la
  tabla de §0; la reparación del canal está registrada en la
  Fase D del ESTADO: «NO revertir webhook.py ni quitar
  TWILIO_REPLY_MODE».)
- El número del sandbox (**+49 15888 620339**) y las URLs de
  InstaBox son los datos fijos de §0: no cambian entre días y
  no se sustituyen por túneles ni atajos (el plan B del guion
  original quedó superado).

### 4.4 Presupuesto de mensajes de Twilio

- La cuenta trial tiene **100 mensajes** y todo el plan
  (ensayo + grabación + entrega) está diseñado para gastar
  **≤ 30** — el ensayo, 13 (cabecera de este runbook y §1). Las
  verificaciones se hacen con la **autoprueba del servidor**
  (firma HMAC directa a la máquina, consumo 0), que es siempre
  la primera opción. Nada de mensajes de prueba desde un móvil:
  cada turno cuesta 2 (ida + respuesta) y el `join`, 1.

### 4.5 El núcleo de reservas y las citas de ensayo

- El núcleo de reservas **no se toca en semana de entrega**
  salvo decisión expresa de Lee (§46 del ESTADO): ni «arreglos
  rápidos» sobre disponibilidad, agenda o webhook entre el
  ensayo y el envío.
- Las citas creadas en ensayos y pruebas **se cancelan al
  terminar, nunca se borran** (§1, pasos 6 y 9): la agenda del
  piloto queda solo con citas reales.

---

## Apéndice QA23 (31/10/2026) — pre-ensayo contra la app final v31

Secuencia de demo ENTERA ejecutada a 412×915 contra la app viva
(`web/qa23/secuencia-v31.mjs`, dos corridas; sonda del panel en
`web/qa23/sonda-panel.mjs`). Sin gasto de Twilio. Las citas de la
secuencia («QA23 Demo», lunes 02/11 10:00) quedaron canceladas al
terminar, como manda el procedimiento.

| Paso | QA21 (v30, sin visual) | QA23 (v31, con visual) |
|---|---|---|
| Abrir la app | 1,2 s | 1,2 s (carga útil 0,68 s; SW v31 controlando) |
| Buscar «henna» | 1,5 s | 1,5 s |
| Recomendado | 2,7 s | 2,7 s |
| Análisis — paso completo | 17,0 s | 38,1–43,2 s |
| — E2E en la UI (clic → resultado) | 12,1 s (solo orientación) | **33,1–38,2 s** (orientación + propuesta) |
| — en servidor: Spark / propuesta visual | 12,1 s / — | 11,9–13,5 s / 16,4–17,7 s |
| Reservar el recomendado | 4,0 s | 4,0 s |
| Enlace mágico | 3,1 s | 3,1 s |
| Panel profesional | 4,9 s (vista «Hoy») | 3,2 s (sonda en vista «Agenda»: login → cita futura visible por nombre) |
| Cancelar la cita | 6,2 s | 6,2 s |
| Errores de consola | 0 | 0 |

El incremento total de la secuencia web (~+21–26 s) es íntegro del
análisis con propuesta. Todo lo demás clava los tiempos de QA21.

**Orden de pantallas del resultado (nuevo en v31)**: 1ª tarjeta =
«PROPUESTA VISUAL · ORIENTATIVA» con la foto generada grande →
2ª «Esto ve La Asistenta» (la orientación en texto) → 3ª la tarjeta
ORIENTACIÓN con el servicio recomendado → 4ª la alternativa.
Verificado en el DOM en las dos corridas (`#res-visual.primera`).

**Veredicto de escaleta: CABE en 3:00 con un ajuste.** Los planos
pregrabados (0:00–0:35), el WhatsApp en vivo (0:35–1:50) y el panel
(2:15–2:40) no cambian. El plano del análisis (1:50–2:15) dispone
de 25 s y la latencia real es de 33–38 s: en vivo es viable
(≤ ~45 s, el criterio de §2) **acelerando la espera en edición
(×~1,5)**, igual que las esperas de WhatsApp. Sin ese ajuste, el
plano se comería 8–13 s del plano siguiente. Alternativa
equivalente: recortar ~10 s de pregrabado inicial.

**Verificaciones del runbook rehechas en QA23**:

- **Presupuesto Twilio del ensayo: 13** ✓ — la suma de §1 (join 1
  + «Hola» 2 + conversación 8 + derivación 2) coincide con lo
  declarado. La re-unión del paso 2 sigue siendo necesaria y
  correcta: la unión anterior (28–29/10) caduca a los 3 días sin
  actividad, así que el 02/11 habrá que repetir el `join`.
- **Vigilia del 02/11** ✓ — el cron `la-asistenta-vigilia-trabajo`
  está activo (cada 20 min, anclado a las 09:00) y su ventana
  cubre el 02/11 y el 04/11 de 09:00 a 23:59: ensayo y grabación
  enteros. La vigilia del jurado (05–10/11, 14:00–02:00) es otro
  cron, también activo.
- **Baterías de sanidad (proceso fresco)**: profesional **25/25** ·
  web **29/32**. Los 3 rojos de la web son la cadena del fixture
  fijo «2026-10-30 10:00» («reserva creada» → «anti-solape» →
  «doble reserva»): la fecha del fixture ya es PASADA y la API
  responde «elige una fecha entre hoy y los próximos 60 días»
  (400). Es el mismo diagnóstico de §§64/65 — allí eran 2 rojos
  porque el 30/10 aún era «hoy» —: podredumbre del fixture por
  fecha, NO una regresión. No se persiguen; su arreglo (fecha
  rodante) queda anotado para después de la entrega.

**Dos hallazgos de GUION (no de la app), corregidos en QA23**:

- El calendario de reserva puede abrir ya en el mes del primer
  día reservable (un sábado tras el cierre abre en noviembre): la
  lógica de QA21 pulsaba «mes siguiente» a ciegas y se saltaba ese
  mes entero. `secuencia-v31.mjs` solo avanza si la fecha queda
  más allá del último día visible. El 02/11 el ensayo web (§1
  paso 6) parte de la misma situación: sin sorpresas.
- La comprobación del panel en vista «Agenda» buscaba el código
  AS-XXXX, pero las tarjetas de Agenda pintan hora, nombre y
  servicio — el código solo se pinta en «Hoy». La sonda QA23 lo
  verifica por nombre (cita futura visible en Agenda en 3,2 s).
  El plano del vídeo usa «Hoy», cuya referencia (4,9 s, QA21)
  sigue vigente.

**⚠️ Nota de integridad de este fichero**: al abrirlo para QA23,
las TRES copias de este runbook (local, máquina y repo público)
resultaron truncadas en el mismo punto: el texto se cortaba a
mitad de la celda del rótulo del plano 2:15–2:40, con un marcador
literal de truncado, y faltan ~6.400 caracteres: el resto de §2
(la fila 2:40–3:00 en su redacción de runbook) y las secciones
§3 (entrega del 04/11) y §4 (qué no tocar). La celda cortada se
ha completado con el rótulo literal de `GUION_DEMO.md` («Ante la
duda, deriva a la humana», línea 47 de ese documento) y la fila
2:40–3:00 tiene su base en la línea 28 del mismo guion (plano
final: el salón en funcionamiento; rótulo de cierre). **§3 y §4
NO se han reconstruido aquí**: deben reponerse desde
`ESTADO_PROYECTO.md` (§§46, 50 y 65) y `ENTREGA_HACKATHON.md`
antes del ensayo del 02/11. Nada de lo anterior a este apéndice
se ha reescrito salvo los pasos y filas citados.
