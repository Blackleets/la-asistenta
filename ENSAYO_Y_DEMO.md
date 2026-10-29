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

## 0. Datos fijos (no cambian entre días)

| Pieza | Valor |
|---|---|
| Máquina | InstaBox `la-asistenta` (`m_agqyfjnmnvcrrnfraerzrpu5ye`), helper `custom.instabox` (`wake`, `exec`, `put`) |
| Web de la clienta | https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech |
| Webhook WhatsApp | https://8080-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech |
| Sandbox de Twilio | **+49 15888 620339** · unión: `join twilio-trial` (caduca a los 3 días sin actividad) |
| Teléfono de Lee | Móvil personal del fundador (omitido en la copia pública) |
| Respuesta WhatsApp | Viaja en el **TwiML** del webhook (`TWILIO_REPLY_MODE=twiml`). **NO tocar** — ver §4.3 |
| Arranque en la máquina | `bash /data/la-asistenta/arrancar.sh` (idempotente: webhook 8080 + agenda 8081 + web 8090) |
| Salud | `/salud` en los tres puertos debe responder OK antes de seguir |
| Conteo de mensajes | Cada turno de WhatsApp cuenta **2** (ida + respuesta). El `join` cuenta 1 |

**Regla de despertar (verificada en la auditoría, D8)**: la máquina se
pausa a los 30 min sin uso y **una visita a la URL web ya NO la
despierta**. Se despierta **por API** (`wake` del helper). Máximo 8 h
seguidas encendida: planifica cada jornada dentro de esa ventana.

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
| 11:00 | **7. Ensayo web — análisis de cejas con foto** | Consentimiento → foto de prueba autorizada → sondeo hasta resultado real. **Cronometrar la latencia y anotarla**: ese número decide en §2 si el plano del análisis se graba en vivo o pregrabado. Si Baseten tarda >60 s o encadena un error, se anota «racha lenta» y se aplica el plan B del vídeo. **Consumo Twilio: 0.** |
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
| 1:50–2:15 | Foto → análisis | **Decisión del ensayo (§1 paso 7)**: latencia anotada ≤ ~45 s → **EN VIVO** en la web (el sondeo asíncrono muestra progreso honesto). Racha lenta → **pregrabado**: se emite una grabación de un análisis REAL hecho ese mismo día, con rótulo y la latencia medida declarada en la narración. **Jamás simulado ni con resultado de otro día sin decirlo.** La vista previa de Muse Image y SAM siguen sin clave de Meta: el tramo se emite con el rótulo del guion | `En construcción — vista previa con Muse Image + SAM 3.1` (si aplica) |
| 2:15–2:40 | Día organizado de Arianna + derivación a humana | **EN VIVO** — área profesional real + el mensaje ambiguo del ensayo (§1 paso 5, se puede reaprovechar la toma del ensayo si quedó limpia, etiquetada como ensayo) | `Ante la duda, d
...[truncated 6463 chars]