# Puerta H2 — Selfie → análisis (→ vista previa): preparación y prueba real

**Fecha:** 2026-10-27 (noche) · **Estado:** 🟡 **Análisis de foto: PROBADO y funciona** (Spark ve la selfie y recomienda con la carta real). **Vista previa generada (Muse Image): SIN VÍA DISPONIBLE todavía** — ver §4, con la evidencia. El juicio de Arianna puede empezar ya sobre el análisis; la imagen generada queda pendiente de acceso.

---

## 1. Diseño del flujo H2 (tal como lo vivirá una clienta)

1. **Selfie.** La clienta escribe por WhatsApp y La Asistenta le ofrece: «Si quieres, mándame una foto de tus cejas y te digo qué te quedaría mejor». Antes de la foto, **consentimiento explícito y separado** (GDPR): la foto se usa solo para el análisis y **el original se borra tras el análisis** (la privacidad va en el diseño, no en la letra pequeña — línea ya fijada en el guion de demo).
2. **Análisis con Spark (visión nativa).** La foto llega a Hermes, que la adjunta nativamente (`image_url`, `supports_vision: true` ya configurado) a Muse Spark. Spark describe: forma, grosor, densidad/huecos, dirección del pelo, simetría.
3. **Recomendación con la carta real.** La Asistenta cruza el análisis con los 4 servicios reales (Diseño 18 € · Ombré Brows Henna 30 € · Laminación 45 € · Depilación rápida a consultar) y recomienda UNO principal con su porqué, precio y duración — sin inventar servicios ni descuentos (reglas ya en el SOUL).
4. **Vista previa generada (cuando exista la vía).** Con la zona de cejas delimitada (SAM 3.1, según el plan), Muse Image generaría una vista previa **etiquetada siempre como «orientativa»**. Hoy este paso **no se puede ejecutar**: no hay acceso verificado a ningún generador de imágenes (ver §4). En el flujo, este paso se salta con honestidad: la clienta recibe el análisis y la recomendación, sin prometerle una imagen que no podemos producir.
5. **Oferta de reserva.** La Asistenta cierra ofreciendo hueco («¿Te reservo…?») y, si la clienta acepta, entra el flujo H1/H3 ya probado: resumen de cita → confirmación → `registrar_cita` en la agenda.

**Gestión de la espera (importante):** el turno con foto tarda ~47 s vía Hermes (ver §3). En WhatsApp real hay que enviar un mensaje intermedio inmediato («¡La tengo! Dame un segundito que miro tus cejas… 👀») para que la clienta no perciba silencio.

---

## 2. La prueba ejecutada (27/10/2026)

- **Foto de prueba:** retrato libre de Pexels (ID 33949302, primer plano de mujer con cejas muy visibles: pobladas, gruesas, peinadas hacia arriba). Guardada en `h2/foto_prueba.jpg` (1200×1800). Ninguna persona real conocida.
- **Camino usado: EL MISMO que usará una clienta** — Hermes Agent con su config y SOUL actuales, adjuntando la imagen por CLI:
  `hermes chat --oneshot --image h2/foto_prueba.jpg -q "<mensaje de clienta>"`
  Hermes confirmó en su salida: *«attaching 1 image(s) natively (model supports vision)»* y ejecutó su herramienta de análisis de visión antes de responder como La Asistenta.
- **Mensaje de la clienta simulada:** «Hola, te mando una foto de mis cejas. ¿Me las analizas? Dime cómo las tengo ahora (forma, grosor, si se ven pobladas o con huecos) y qué servicio de los vuestros me encajaría mejor y por qué, con su precio y duración. Quiero algo que se note pero natural.»
- Transcripción bruta completa (incluye las trazas internas de Hermes): `h2/respuesta_hermes.txt`.

### Respuesta final de La Asistenta (íntegra)

> ¡Hola guapa! Gracias por la foto 😊 Te analizo:
>
> **Cómo las tienes ahora:**
> - Forma: bastante recta con arco suave, bien marcadas
> - Grosor: gruesas / medio-gruesas
> - Densidad: muy pobladas, sin huecos, con pelo largo y tupido
> - Acabado: se ven peinadas hacia arriba, efecto fluffy/laminado, muy definidas y con volumen
>
> Las tienes muy bonitas y con mucha base, no necesitan relleno.
>
> **¿Qué te encajaría?** Como quieres algo que se note pero natural, te recomiendo:
> 1. **Diseño de cejas (Brow Design) — 18 € · 25 min** → ideal para ti: perfilamos, limpiamos y definimos la forma manteniendo tu volumen natural. Queda muy limpio y se nota, pero sin oscurecer ni cambiar tu estilo.
> 2. Si quieres mantener justo ese efecto peinado y fijado hacia arriba que ya llevas, la otra opción sería **Laminación de cejas — 45 € · 65 min**, que fija el pelo y da ese efecto ordenado y esponjoso.
>
> Para lo que me pides (natural y que se note) yo empezaría por el Diseño. ¿Te apetece que te busque huequito?

**Juicio de la prueba:** análisis visualmente CORRECTO (la foto muestra exactamente eso: cejas gruesas, densísimas, sin huecos, peinadas hacia arriba estilo fluffy), recomendación principal razonada (Diseño) + alternativa honesta (Laminación), precios y duraciones EXACTOS, cero servicios inventados, tono de recepcionista por WhatsApp y cierre con oferta de reserva.

### Foto: corroboración por llamada directa a Spark (sin Hermes)

Para aislar cuánto tarda Spark «a pelo», se llamó directamente a Baseten con la misma foto (script `h2/sonda_baseten.py`, salida `h2/respuesta_directa_v2.json`). Respuesta completa en **14,9 s**, con la misma conclusión (Diseño de cejas 18 € · 25 min) y un análisis coincidente (forma recta/arco suave, medio-grueso, densidad muy alta sin huecos, pelo hacia arriba con remolino). Las dos vías convergen: el análisis es consistente.

⚠️ **Lección técnica de la llamada directa:** con `max_tokens: 1024` la respuesta visible salió VACÍA (`content: null`, `finish_reason: length`): Spark gastó 1.021 de los 1.024 tokens razonando. En llamadas directas hay que presupuestar ≥ 4.096 tokens (con 4.096: 1.825 de razonamiento + respuesta completa). Hermes ya gestiona esto por su cuenta.

---

## 3. Latencias medidas (reloj real)

| Medición | Latencia | Notas |
|---|---|---|
| Turno completo con foto vía Hermes (el camino real) | **47 s** (sesión, según Hermes; 54 s de reloj con el arranque del CLI) | Incluye la herramienta interna de análisis de visión + razonamiento. Es EL número a vigilar: 6× un turno de texto de H1 (~8 s). |
| Spark visión directa (Baseten, sin Hermes) | **14,9 s** | Respuesta completa con `max_tokens: 4096`. Prompt: 3.075 tokens (imagen incluida). |
| Spark visión directa, intento con `max_tokens: 1024` | 11,3 s | ❌ Respuesta truncada en el razonamiento (ver lección arriba). |
| `GET /v1/models` (sonda de §4) | 2,1 s | 200 OK. |

**Conclusión de latencia:** la visión de Spark en sí es rápida (~15 s); el sobrecoste está en el bucle de agente de Hermes (herramienta de visión + doble pasada). Para la demo y para WhatsApp sirve, con el mensaje intermedio de «estoy mirando tu foto» del paso 1.

---

## 4. Investigación: ¿qué ruta de GENERACIÓN de imagen («vista previa») existe hoy?

**Respuesta corta y honesta: NINGUNA disponible todavía.** No se da por hecho ningún acceso. Evidencia:

1. **Baseten (la clave concedida): NO ofrece generación de imagen.** `GET https://inference.baseten.co/v1/models` con esta clave devolvió 200 OK y **20 modelos, todos de texto/visión (LLM)**: `meta-models/muse-spark-open-1026`, `meta-models/muse-spark-open`, gpt-oss-120b, GLM-5.x, DeepSeek-V4, Kimi-K3, Nemotron (incl. un VL), Beam-1.0 y los «elephant/mammoth» de Baseten. **Cero modelos de generación o edición de imagen** (ningún Muse Image, ningún diffusion/flux). Lista completa guardada en `h2/sonda_modelos.json`. La clave de Lee es de Muse Spark (chat/visión), no de imagen.
2. **En el sandbox no hay otra vía de imagen conectada:** la config de Hermes no registra ninguna herramienta de generación de imágenes; el único generador mencionado en los documentos del proyecto es **Muse Image vía Meta (dev.meta.ai / Meta Model API)**, que es PLAN, no acceso: según `credits-watch-state.json`, el único crédito CONCEDIDO y verificado es **Baseten**; el de Meta (150 $) sigue **SIN VERIFICAR** (solo Lee puede verlo en el Billing de dev.meta.ai; el vigilante de créditos no ha confirmado concesión).
3. **SAM 3.1** (delimitación de la zona de cejas) está en la misma situación: es parte del plan vía herramientas de Meta, **sin acceso verificado hoy** en el sandbox.

**Qué desbloquearía la vista previa (exactamente):** que se confirme el crédito de Meta y exista un endpoint de Muse Image accesible con él (dev.meta.ai), o que Baseten añada un modelo de imagen a esta clave (no está), o contratar otra vía de edición de imagen con API. Hasta entonces, el paso 4 del flujo queda en «no disponible» y la demo usa el plan ya previsto en `GUION_DEMO.md`: rótulo «En construcción» en el tramo de la selfie si H2 no está cerrado el día de grabación — nunca presentarlo como hecho.

---

## 5. Qué falta EXACTAMENTE para que Arianna pueda juzgar H2

El juicio de Arianna tiene dos mitades, y una ya se puede hacer:

- [x] **Análisis + recomendación (LISTO para su juicio):** enseñarle a Arianna la foto de prueba y la respuesta de La Asistenta (§2). Ella decide si el análisis «lee» las cejas como lo haría ella y si la recomendación es la que daría en su salón. *Esto no requiere nada más que enseñárselo.*
- [ ] **La vista previa generada (BLOQUEADA):** falta el acceso a Muse Image (§4). Sin imagen generada no hay «antes/después orientativo» que juzgar. Desbloqueo: confirmación del crédito de Meta (solo visible por Lee en dev.meta.ai → Billing) + endpoint de imagen operativo.
- [ ] **Ajuste fino con su criterio:** si Arianna corrige la recomendación tipo (p. ej. «a unas cejas así yo les haría primero X»), esa regla se escribe en el SOUL y se repite la prueba con 2–3 fotos más (distintos casos: cejas finas/con huecos → Ombré; pelo rebelde → Laminación) antes de dar H2 por buena.
- [ ] **Consentimiento y borrado (diseño GDPR):** texto corto de consentimiento previo a la selfie + borrado del original tras el análisis, implementados en el canal real (depende de H3, el canal WhatsApp).

**Veredicto H2 a día de hoy: la mitad «ver y recomendar» está SUPERADA con prueba real; la mitad «generar la vista previa» está BLOQUEADA por falta de acceso a Muse Image, con la evidencia en §4.**

## Ficheros de esta preparación (en `~/workspace/la-asistenta/h2/`)

- `foto_prueba.jpg` — retrato libre de Pexels (ID 33949302) usado en la prueba.
- `respuesta_hermes.txt` — transcripción bruta completa del turno vía Hermes.
- `sonda_baseten.py` — sonda reproducible: lista de modelos + visión directa.
- `sonda_modelos.json` — los 20 modelos accesibles con la clave (evidencia de §4).
- `respuesta_directa.json` — llamada directa truncada (la lección de `max_tokens`).
- `respuesta_directa_v2.json` — llamada directa completa (14,9 s) con su `usage`.
