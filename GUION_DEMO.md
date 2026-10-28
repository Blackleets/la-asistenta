# GUION DE LA DEMO — La Asistenta (Hackathon Meta × Cerebral Valley)

**Vídeo de 3 minutos · Entrega: 04/11/2026, 21:00 ET (05/11, 03:00 Madrid)**
**Regla de oro (de OBJETIVO_9): todo lo «en directo» es en directo. Nada de humo: lo que aún no está construido se dice en el guion como «en construcción».**

## Estado real de cada pieza (para no prometer de más)

| Pieza | Estado al 27/10/2026 |
|---|---|
| Conversación con Muse Spark vía Hermes Agent | ✅ **Probada** — puerta H1 superada: cita completa cerrada en 4 turnos, precios exactos, ~8 s/turno |
| Reserva escrita en agenda (SQLite vía herramienta MCP) | ✅ **Demostrada en local** — el webhook recibió la conversación y la cita de Carmen quedó registrada (Diseño de cejas, 29/10, 17:30, 18 €) |
| Canal WhatsApp real (número de prueba de Meta) | 🔧 **En construcción** — app «La Asistenta» creada en Meta y WhatsApp añadido; falta el paso del portfolio en el panel (bloqueo temporal de Meta, reintento 28/10). El receptor (webhook) ya está construido y probado con payloads forma-Meta |
| Selfie → análisis Spark + SAM 3.1 + vista previa Muse Image | 🔧 **En construcción** — puerta H2 pendiente; Spark acepta visión nativa (verificado en la ficha del modelo), aún no probado con foto real ni juzgado por Arianna |
| Panel de Arianna | 🔧 **En construcción** — hoy la agenda es SQLite con visor propio; el panel web de Lovable queda como prototipo. Decisión de Lee (27/10): el panel final será **app** (Android primero), leyendo la misma agenda. En el vídeo se enseña la agenda real, sin fingir una app que no existe |
| Voz (Voice Transcribe) | 🔧 **En construcción** — previsto en el alcance (voz/texto → transcripción); no ejercido aún |

## Guion minuto a minuto

| Tiempo | Qué se ve en pantalla | Qué se dice (narración) | Qué prueba |
|---|---|---|---|
| **0:00–0:20** | Arianna en su salón, móvil en la mano fuera de horario. Notificaciones de WhatsApp acumuladas: clientas preguntando por citas a las 23:40. Plano del reloj / luz apagada del salón. | «Son las once y media de la noche. El salón está cerrado, pero el WhatsApp de Arianna no. Cada mensaje sin responder es una cita que se pierde.» | **Impacto (30%)**: el problema es real, cotidiano y medible — reservas manuales que consumen el tiempo de una pyme. |
| **0:20–0:35** | Pantalla dividida: a un lado, el móvil de una clienta abre WhatsApp y escribe al número del salón. Al otro, un esquema mínimo con tres etiquetas: 📞 WhatsApp · 🧠 Muse Spark · 📋 la agenda. | «Esto es La Asistenta: una empleada, no un chatbot de botones. Atiende el WhatsApp del salón las 24 horas. Su cabeza es Muse Spark, el modelo de Meta. Y trabaja sobre Hermes Agent, el orquestador de código abierto de Nous Research.» | **Herramientas Meta (25%) + Profundidad (20%)**: arquitectura nombrada con honestidad — cada pieza con su función. |
| **0:35–1:05** | Grabación de pantalla del móvil de la clienta, en tiempo real. Escribe: «Hola, quería hacerme las cejas, algo natural pero que se note. ¿Qué me recomiendas y cuánto cuesta?» La Asistenta responde recomendando **Diseño de cejas — 18 € · 25 min** y **Ombré Brows con henna — 30 € · 65 min**, con los precios reales del salón. | «La clienta escribe como escribiría a una persona. La Asistenta entiende lo que busca, recomienda entre los servicios reales del salón y da precios exactos. Ni un euro inventado: son los precios de Ari Vivas Beauty.» | **Demo (25%) + Herramientas Meta**: Spark razona y conversa en español natural; la calidad ya está probada (puerta H1: misma conversación, mismos precios, cerrada el 27/10). |
| **1:05–1:30** | La clienta: «Me quedo con el diseño. ¿Puedo este jueves sobre las 17:30? Me llamo Carmen.» La Asistenta presenta el resumen completo de la cita (servicio, jueves 29 de octubre, 17:30, 18 €, 25 min) y pregunta: «¿Te lo dejo confirmado?» | «Convierte "este jueves" en la fecha correcta, comprueba que cae dentro del horario del salón y, antes de cerrar nada, enseña el resumen y pide confirmación. Como haría una buena recepcionista.» | **Profundidad**: validación de reglas (fecha, horario) y confirmación explícita antes de ejecutar — no reserva a ciegas. |
| **1:30–1:50** | La clienta: «Sí, déjalo confirmado.» **Doble pantalla**: al confirmar, la cita **aparece en ese instante en la agenda** (segunda pantalla: la agenda del día 29 con «17:30 — Carmen — Diseño de cejas — 18 € — confirmada»). Zoom breve al registro. | «Y aquí está la parte que no es conversación: al confirmar, la cita queda escrita en la agenda del salón. En directo. Sin que Arianna toque el móvil.» | **Demo en vivo (25%)**: el bucle completo mensaje→reserva real, cronometrado (objetivo: < 90 s). La escritura en agenda ya está demostrada en local vía la herramienta MCP `registrar_cita`. |
| **1:50–2:15** | La clienta manda una **selfie** *(tramo marcado en pantalla con el rótulo «En construcción» si H2 no está cerrado el día de grabación)*. Se ve el análisis de Spark sobre la foto y —si está listo— la delimitación de la zona de cejas con SAM 3.1 y la vista previa «orientativa» generada con Muse Image. | «La clienta puede mandar una foto. Spark la analiza, SAM delimita la zona de las cejas y Muse Image genera una vista previa para que sepa qué esperar. La foto original se borra tras el análisis: la privacidad va en el diseño, no en la letra pequeña.» | **Herramientas Meta (25%)**: SAM 3.1 y Muse Image haciendo lo que el texto no puede. GDPR: consentimiento y borrado del original como parte del producto. |
| **2:15–2:40** | La agenda de Arianna con su día organizado: la cita nueva entre las demás. Una clienta escribe algo ambiguo y La Asistenta **deriva a Arianna** con un aviso («esto prefiero que lo veas tú») en vez de improvisar. | «Arianna abre su agenda y el día ya está hecho. Y cuando algo es ambiguo, La Asistenta no improvisa: lo deriva a la humana. Saber cuándo no actuar también es parte del trabajo.» | **Impacto + Profundidad**: el panel/app es «en construcción» (hoy, agenda real en SQLite); la derivación a humana se enseña como virtud, no como fallo. |
| **2:40–3:00** | Plano final: el salón en funcionamiento, Arianna trabajando con una clienta, móvil boca abajo y en silencio. Rótulo final con el nombre y la frase de cierre. | «Un salón de barrio no puede pagar una recepcionista 24 horas. Ahora tiene una. La Asistenta, construida con las herramientas de Meta, sobre Hermes Agent.» | **Impacto (30%)**: cierre en la pyme real — el producto se entiende en una frase. |

## Planos y pantallas a grabar

1. **Salón real de Arianna** (o recreación fiel): Arianna con el móvil fuera de horario; reloj en pantalla 23:40; notificaciones acumuladas.
2. **Móvil de la clienta** — grabación de pantalla nativa de WhatsApp, conversación completa (guion de Carmen, el ya probado en H1/H3).
3. **Doble pantalla sincronizada** para el momento de la confirmación: móvil de la clienta + agenda (visor de la agenda real) en el mismo encuadre o en pantalla dividida.
4. **Esquema de arquitectura** (3 etiquetas: WhatsApp / Muse Spark–Hermes / agenda) — gráfico simple, 3–4 s.
5. **Selfie y análisis** *(solo si H2 está cerrado; si no, grabar el tramo «en construcción» tal cual se indica en el guion)*.
6. **Derivación a humana**: segundo móvil (Arianna) recibiendo el aviso de derivación.
7. **Plano de cierre**: salón trabajando, móvil en silencio.

## Textos en pantalla sugeridos

- Apertura: `23:40 — el salón está cerrado. Su WhatsApp, no.`
- Arquitectura: `📞 WhatsApp · 🧠 Muse Spark (Meta) · 🧭 Hermes Agent (Nous Research) · 📋 Agenda real`
- En la recomendación: `Precios reales de Ari Vivas Beauty — nada inventado`
- En la confirmación: `La cita se escribe en la agenda EN DIRECTO`
- En la selfie (si H2 no está cerrado): `En construcción — análisis de foto con Spark + SAM 3.1 + Muse Image`
- En la derivación: `Ante la duda, deriva a la humana`
- Cierre: `La Asistenta — la recepcionista 24/7 que una pyme sí puede pagar`

## Riesgos de grabación y plan B

| Riesgo | Plan B |
|---|---|
| **Latencia ~8–12 s por turno** (Spark razona siempre; medido: 7,9–11,7 s por respuesta, hasta ~25 s el primer turno de sesión) | Grabar la conversación **en tiempo real** y acelerar en edición solo los tramos de espera (con el indicador «escribiendo…» visible acelerado, sin cortes falsos en el contenido). El bucle total debe quedar < 90 s tras edición. |
| **El canal WhatsApp real depende del paso de Meta** (portfolio/bloqueo temporal; reintento 28/10) | Si el número de prueba no está a tiempo: grabar con el simulador local ya probado (payloads forma-Meta contra el webhook real) y rotularlo en pantalla como grabación con simulador. La reserva en agenda es real en ambos casos. |
| **Token temporal de WhatsApp caduca a las 24 h** | Generar el token **el mismo día** de la grabación, justo antes; tener la receta de refresco a mano (regenerar en el panel + cambiar una línea del `.env`). A medio plazo: token permanente con usuario del sistema. |
| **El túnel HTTPS (cloudflared/ngrok) cambia de URL al reiniciar** | No reiniciar túnel, webhook ni Hermes entre el ensayo y la grabación; comprobar la URL pegada en el panel de Meta justo antes de grabar. |
| **El surrogate de Baseten puede caducar** (TTL desconocido; si Hermes devuelve 401, ese turno falla) | Antes de grabar: prueba de humo («listo») y una conversación de ensayo completa. Si falla a mitad: re-pedir el surrogate y reescribir `hermes-home/.env` (un comando) y repetir la toma. |
| **H2 (selfie/SAM/Muse Image) no cerrado el día de grabación** | El guion ya lo contempla: el tramo se emite con rótulo «En construcción» y la narración lo presenta como siguiente paso — nunca como hecho. Alternativa: cortar el tramo y dar esos 25 s al bucle de reserva y a la derivación. |
| **La doble pantalla no sincroniza** (la cita tarda en verse en el visor) | Ensayar el visor de agenda con refresco inmediato; si falla, grabar las dos pantallas por separado con el mismo reloj visible y montar en dividido sin falsear el orden de los hechos. |
| **Una toma sale mal en directo** | Grabar mínimo 3 tomas completas del bucle. El vídeo de respaldo, si se usa, va etiquetado como respaldo (regla de OBJETIVO_9). |
