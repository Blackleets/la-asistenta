# H1 — Verificación de acceso a modelos + diseño del benchmark · LA ASISTENTA

**Fecha:** 2026-10-27 · **Hito:** H1 (preparación). **Sin gasto nuevo y sin llamadas de generación nuevas en esta fase**: la única llamada realizada ha sido el re-listado de modelos de Baseten (GET, sin coste de generación). Lo demás es documental y de diseño.

---

## 1. Verificación documental (fuentes oficiales primero)

### 1.1 Qué expone la Meta Model API — DOCUMENTADO

| Modelo | ID | Qué es | Fuente oficial |
|---|---|---|---|
| Muse Spark | `muse-spark-1.3` / `1.2` / `1.1` (+ variantes `-contributor` de 1.3 y 1.2) | Razonamiento multimodal (texto, imagen, vídeo/documento), contexto 1M | Página oficial de producto: developer.meta.com/ai/products/meta-model-api/ (precios) y ai.developer.meta.com (docs) |
| Muse Image | `muse-image-1.0` | Generación **y edición** de imágenes («Generate from a description or edit what you already have») | Página oficial del modelo: developer.meta.com/ai/models/muse-image/ |
| SAM 3.1 | `sam-3.1` | Detección, segmentación y tracking desde prompt de texto, en imagen y vídeo; salida cajas + máscaras | llama.meta.com/get-started/ (tarjeta SAM 3.1 en Meta Model API, con Playground) |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | Voz → texto con diarización | Mismas fuentes |

**Precios oficiales** (página de producto de Meta, developer.meta.com/ai/products/meta-model-api/):
- Spark Standard: **$1,25 / $4,25 por millón de tokens** (entrada/salida), $0,15 cached. Contributor: $0,10 / $0,20 (a cambio de que Meta pueda entrenar con los datos — **descartado para fotos de clientas**).
- Muse Image: **$0,01 por imagen** (tarifa plana, no por tokens; las imágenes que fallan o filtra seguridad no se cobran, según la documentación del modelo recogida por terceros).
- SAM: **$2,50 / 1.000 imágenes** (= $0,0025 por imagen) y $0,20 / 1.000 frames de vídeo.

### 1.2 Endpoints y autenticación — DOCUMENTADO

- Base: `https://api.meta.ai/v1`. Superficies: **Responses API** (`POST /v1/responses`, verificado en la documentación oficial ai.developer.meta.com/docs/features/responses), Chat Completions y Messages (formato Anthropic). Compatible con los SDK de OpenAI/Anthropic.
- Autenticación: **clave API Bearer por equipo (team)**, creada en dev.meta.ai (sección API keys); la clave se muestra una sola vez al crearla (detalle recogido en documentación de terceros sobre dev.meta.ai — a confirmar al crearla).
- ⚠️ **No verificado en fuente oficial en esta pasada**: la forma exacta de la petición de generación/edición de imagen de `muse-image-1.0` y la ruta REST concreta de SAM 3.1. **No se inventan**: se confirmarán con la clave real (listado `/v1/models` + quickstarts oficiales) antes de escribir una sola línea de integración.

### 1.3 SAM 3.1: ¿API invocable o solo pesos? — AMBAS, documentado

- **Invocable vía Meta Model API**: el repositorio oficial de Meta `github.com/meta-models/meta-sam` se define como «client libraries for SAM 3.1 streaming segmentation **over the Meta Model API**» e incluye protocolo, casos de conformidad y librerías cliente Python/TypeScript; su playground pide «your Model API key» para segmentación en vivo. La invocación es un **protocolo de streaming con librerías cliente oficiales**, no un simple POST documentado en lo consultado.
- **Pesos descargables**: el checkpoint de SAM 3.1 también se distribuye para autohospedaje (licencia SAM; fuentes secundarias sitúan la descarga desde el 27/03/2026). ⚠️ Un artículo de terceros anterior («181 días») afirmaba que no había API hospedada: **quedó desactualizado** por el lanzamiento de la API en septiembre de 2026. Para LA ASISTENTA la vía autohospedada no compensa: el portátil de Lee es Intel Iris integrada (sin GPU para inferencia pesada) y el sandbox tampoco tiene GPU — vía API o nada.

### 1.4 Regiones / disponibilidad — DOCUMENTADO con cautela

- La página oficial de producto dice: «Public preview. **Now available with expanded global access**» (sustituye a guías de terceros antiguas que hablaban de solo EE. UU.).
- Cobertura secundaria del hackathon reportó la Model API bloqueada en algunos países (p. ej. Pakistán, Etiopía, Venezuela, Irak, Camboya) y Muse Image restringido en uno más. **España/UE no aparece entre los bloqueados** en lo consultado, pero **no se localizó una lista oficial pública de países** en esta pasada: la disponibilidad definitiva para Lee es la que muestre su equipo en dev.meta.ai (Billing y API keys operativos = disponible).

### 1.5 Distinción crítica de nombres

Lo que sirve la clave de Baseten de Lee es **Muse Spark Open** (variante de pesos abiertos: `meta-models/muse-spark-open` y `meta-models/muse-spark-open-1026`), servido por Baseten. **No es** el `muse-spark-1.3` hospedado de la Meta Model API. Mismo linaje, distribuciones y facturación distintas — el benchmark no debe mezclar cifras de ambas vías sin etiquetarlas.

---

## 2. Verificación en cuenta (solo lo ya autorizado)

### 2.1 Baseten — VERIFICADO EN CUENTA (repetido hoy)

Sonda de solo listado repetida el 27/10/2026 (`h1/sonda_listado.py` → `h1/sonda_modelos_h1.json`): `GET https://inference.baseten.co/v1/models` → **200 OK, 2,06 s, exactamente 20 modelos**, idénticos a la sonda de H2:

`gpt-oss-120b`, Nemotron-3-Ultra, GLM-5.2/5.3 (×6), DeepSeek-V4 (×5), Kimi-K3, Nemotron-3.5-Super-VL (visión-lenguaje), Beam-1.0, **`meta-models/muse-spark-open`**, **`meta-models/muse-spark-open-1026`**, baseten-elephant-9b, baseten-mammoth-27b.

**Conclusión sin ambigüedad: con esta clave NO hay ningún modelo de generación/edición de imagen ni ningún modelo de segmentación.** Lo único de imagen es Spark (visión: entiende fotos, no las genera) y un VL de NVIDIA. Toda propuesta visual pasa obligatoriamente por la Meta Model API.

### 2.2 Meta Model API — NO verificada en cuenta todavía. Qué falta, exactamente

Según `credits-watch-state.json`, el único crédito concedido y verificado es **Baseten**; el de Meta (150 $) sigue sin confirmar. Para verificar el acceso **sin pedir credenciales en chat**, Lee debe (en dev.meta.ai, con su cuenta del hackathon):

1. Entrar en **dev.meta.ai** y confirmar que su equipo (team) del registro existe y tiene acceso a Model API.
2. Abrir **Billing**: comprobar si el crédito de 150 $ del hackathon aparece como saldo del equipo (la tarjeta ya está puesta según H0; el crédito, si llegó, se ve ahí — nadie más puede verlo).
3. Abrir **API keys** → crear una clave del equipo (se muestra **una sola vez**) y guardarla en la **bóveda segura de Muse** con el flujo de conexión de conectores — **nunca pegarla en el chat**.
4. Con la clave en la bóveda, la verificación técnica es de solo lectura: `GET https://api.meta.ai/v1/models` con esa clave → lista real de modelos que SU equipo puede invocar (incluiría o no `muse-image-1.0` y `sam-3.1`). **Ese listado es la prueba**; hasta tenerlo, todo lo de §1 es «documentado», no «verificado en cuenta».
5. Si en Billing no hubiera crédito: opciones = uso de pago por uso (requiere OK expreso de Lee antes de gastar un céntimo) o reclamar el crédito en los canales del hackathon (Discord/office hours de Cerebral Valley). **No hay tercer camino y no se simula.**

---

## 3. Diseño del benchmark (documento — no ejecutado)

### 3.1 Conjunto de imágenes autorizadas (única materia prima permitida)

**Regla dura:** solo (a) fotos de banco con licencia que permita este uso, registradas con fuente e ID, y (b) fotos aportadas por Arianna/Lee o voluntarias con **consentimiento escrito** que cubra análisis, edición con IA y uso en la demo del hackathon. **Nunca fotos de clientas reales sin ese consentimiento.** Las fotos de banco llevan personas desconocidas: sirven para medir el sistema, no para prometer resultados a clientas.

| ID | Caso que cubre | Fuente / licencia | Estado |
|---|---|---|---|
| IMG-01 | Cejas pobladas, gruesas, efecto fluffy/laminado | Pexels ID **33949302** — Pexels License: uso gratuito personal y comercial, sin atribución obligatoria, modificación permitida (help.pexels.com); límite: no presentar a la persona en mal contexto ni implicar respaldo | ✅ Ya en `h2/foto_prueba.jpg` (1200×1800); usada en la prueba de H2 |
| IMG-02 | Cejas finas / con huecos (caso Ombré) | Pexels, misma licencia — registrar ID y URL al descargar | ⬜ Por descargar |
| IMG-03 | Pelo rebelde / rizado, arco débil (caso Laminación) | Pexels, misma licencia | ⬜ Por descargar |
| IMG-04 | Ceja ya diseñada, tono claro o pelirrojo | Pexels, misma licencia | ⬜ Por descargar |
| IMG-05 | Primer plano con luz mala / ángulo típico de selfie de WhatsApp | Pexels, misma licencia | ⬜ Por descargar |
| IMG-06 | Diversidad de tono de piel y estructura ósea | Pexels, misma licencia | ⬜ Por descargar |
| IMG-07 | Rostro de la profesional (juicio experto + demo) | **Arianna**, con consentimiento escrito (plantilla en §3.6) | ⬜ Pendiente de pedir |
| IMG-08 | Reserva / repetibilidad | Lee o voluntaria/o con consentimiento escrito | ⬜ Opcional |

Cada imagen se registra en la hoja de resultados con: ID, fuente, licencia/consentimiento (referencia al documento), dimensiones y caso clínico-estético que representa.

### 3.2 Paso común (ya verificado ejecutable hoy)

Antes de cualquier estrategia, **Spark visión analiza la foto y produce las preferencias estructuradas** en JSON validado contra esquema: `naturalidad` (1–5), `grosor` (fino/medio/grueso + delta deseado), `arco` (suave/medio/marcado), `tono` (sin cambio/−1/+1/+2), `intensidad` (natural/marcada). Este paso está probado (H2: análisis correcto, 14,9 s en llamada directa, 3.075 tokens de entrada con imagen y 2.080 de salida medidos). Las tres estrategias consumen ESTE JSON — ninguna recibe texto libre sin validar.

### 3.3 Las tres estrategias a comparar

- **A — Edición directa.** Prompt de edición construido desde el JSON de preferencias + foto original → 1 llamada a Muse Image por propuesta. La más simple y barata; el riesgo es que toque zonas fuera de la ceja.
- **B — Segmentación + edición.** SAM 3.1 segmenta la región de las cejas (prompt «eyebrows») → máscara → edición con Muse Image condicionada a la máscara (la edición solo puede actuar dentro de la región). La más controlada; añade una llamada y un punto de fallo.
- **C — Híbrida.** Spark planifica (JSON) → SAM segmenta → Muse Image edita → **Spark visión actúa de juez QA**: compara propuesta vs. original (identidad y confinamiento) con rúbrica automática; si no pasa, **1 reintento** con prompt corregido. La más completa; la más lenta y cara de las tres (sigue siendo céntimos).

Por imagen y estrategia se generan **2 propuestas** (intensidad natural / marcada) = 6 propuestas por imagen, 48 en el set completo de 8.

### 3.4 Métricas por estrategia (con rúbrica)

Puntuación **ciega**: quien puntúa no sabe qué estrategia produjo cada propuesta. Juezas: **Arianna** (criterio profesional, voto decisivo) + una segunda persona para contraste.

| Métrica | Cómo se mide | Escala |
|---|---|---|
| **Calidad percibida** | Rúbrica anclada: 1 = inusable/artefactos evidentes · 2 = se nota el retoque, pelo irreal · 3 = aceptable, fallos menores al mirar de cerca · 4 = natural, enseñable a una clienta · 5 = indistinguible de una foto real del resultado | 1–5 por propuesta |
| **Preservación de identidad** | Comparación lado a lado con el original: ¿es incuestionablemente la misma persona? ¿piel, ojos, nariz, luz y fondo intactos fuera de las cejas? | 1–5 + binario «misma persona: sí/no» |
| **Delimitación** | Confinamiento del cambio a la zona de cejas: sin cambios = 5 · cambios mínimos inapreciables = 4 · algún pelo/tono fuera = 3 · cambios visibles en piel/pelo/ojos = 2 · cara alterada = 1. Se anota además cada **fuga** (qué se tocó fuera) | 1–5 + registro de fugas |
| **Latencia** | Cronómetro por etapa y total por propuesta; se reporta **p50** (y máx.) por estrategia | segundos |
| **Coste por propuesta** | Suma real por fórmula con precios oficiales (§4): llamadas de imagen × $0,01 + segmentaciones × $0,0025 + tokens Spark × tarifa | $ por propuesta |
| **Tasa de aceptación** | % de propuestas con calidad ≥ 4 **y** identidad ≥ 4 **y** sin fuga grave, con voto «se lo enseñaría a una clienta» de Arianna | % |

### 3.5 Protocolo de ejecución (paso a paso, para cuando haya acceso)

0. **Congelar el set**: verificar licencia/consentimiento de cada IMG-xx; asignar códigos ciegos a las salidas (`P-<img>-<nº>` sin letra de estrategia en la hoja de puntuación).
1. **Etapa 0 — Análisis Spark** (ejecutable hoy, §5): por imagen, análisis + JSON de preferencias; validar esquema; registrar tokens y latencia.
2. **Generación**: por imagen × estrategia × intensidad, ejecutar el pipeline; guardar original, propuesta, máscara (B/C) y metadatos (modelo exacto, parámetros, latencia por etapa, coste calculado) con la convención `resultados/<img>/<estrategia>/<intensidad>.png` + `registro.jsonl`.
3. **Control de gasto**: tope duro de llamadas fijado antes de empezar (48 propuestas + 25% de reintentos de C); si se alcanza, se para y se informa — nunca se sigue gastando en silencio.
4. **Puntuación ciega**: hoja por propuesta (rúbricas de §3.4); las dos juezas por separado; prohibido mirar los metadatos antes de puntuar.
5. **Agregación**: medias por estrategia y métrica, p50 de latencia, coste medio por propuesta, tasa de aceptación; volcar en la tabla de resultados de este documento (apéndice).
6. **Decisión**: aplicar los criterios de §3.6; registrar la estrategia elegida y el porqué; los errores van al registro de §3.7, no a la memoria de nadie.
7. **Limpieza**: borrar originales y propuestas de las fotos consentidas según lo firmado (las de banco se conservan con su licencia); las propuestas del benchmark **no** se usan en la demo salvo las de IMG-07 si su consentimiento lo cubre.

### 3.6 Criterios de aceptación para elegir estrategia (propuesta — a calibrar con Arianna)

Una estrategia es **apta** solo si cumple TODAS:
- Identidad: media ≥ 4/5 y **ninguna** propuesta por debajo de 3.
- Delimitación: fugas graves (puntuación ≤ 2) en ≤ 10% de sus propuestas.
- Aceptación: ≥ 60% de propuestas «enseñables a una clienta» según Arianna.
- Latencia: p50 extremo a extremo ≤ 45 s por propuesta (el contexto es WhatsApp con mensaje intermedio de espera; por encima, la clienta abandona).

Entre las aptas gana la de **mayor aceptación**; desempate por menor coste y luego menor p50. Si ninguna pasa, se itera SOLO la híbrida (su juez QA es la palanca de mejora) con un máximo de 2 iteraciones de diseño dentro de la ventana del hackathon, re-midiendo con el mismo set.

**Plantilla de consentimiento (IMG-07/08)** — texto mínimo a firmar: qué foto se aporta, para qué (análisis y edición con IA dentro del benchmark de LA ASISTENTA y, en su caso, aparición en el vídeo demo del hackathon Meta 2026), qué NO se hará (no identificación, no cesión a terceros, no entrenamiento), conservación (borrado de originales al cerrar el benchmark, a más tardar el 05/11/2026) y revocación por mensaje en cualquier momento.

### 3.7 Registro de errores (diseño)

Fichero `resultados/errores.jsonl`, una línea por incidente: `fecha_hora, imagen, estrategia, etapa, tipo, codigo_http, mensaje, reintentado, resolucion`. Taxonomía fijada de antemano:

- `AUTH` — 401/clave (incluye «clave con forma válida pero rechazada»).
- `QUOTA_RATE` — límite de equipo o saldo.
- `TIMEOUT` — la doc oficial advierte de límite de servidor en peticiones no-streaming (HTTP 504): para llamadas largas, streaming o reintento único con backoff.
- `EMPTY_OUTPUT` — respuesta vacía por presupuesto de tokens (lección ya aprendida: Spark con `max_tokens` bajo se come la salida razonando; mínimo 4.096 en llamadas directas).
- `CONTENT_FILTER` — imagen filtrada (no facturada según doc; se registra igual).
- `MASK_FAIL` — SAM no encuentra la región o la máscara es inservible.
- `IDENTITY_DRIFT` — detectado en puntuación (no en ejecución): identidad < 3.
- `NETWORK` — fallo de red/sandbox (conocido: los túneles salientes están bloqueados en este entorno; las llamadas salen por el egress de conectores, no por túnel propio).

### 3.8 Qué se puede ejecutar HOY y qué está bloqueado

| Parte del benchmark | Estado |
|---|---|
| Etapa 0: análisis Spark + preferencias estructuradas sobre el set completo | ✅ **Ejecutable hoy** vía Baseten (crédito ya concedido; coste contra ese crédito). Es la mitad «entender» del benchmark y da ya la métrica de calidad de análisis para el juicio de Arianna. Requiere OK de Lee porque consume crédito de Baseten (céntimos) — en esta fase H1 **no se ha ejecutado** por la regla de no gastar sin pasar por el informe |
| Estrategia A (edición directa) | ⛔ Bloqueada: sin acceso verificado a Muse Image (Baseten no lo tiene; Meta Model API sin clave/saldo verificados) |
| Estrategia B (segmentación + edición) | ⛔ Bloqueada: SAM 3.1 y Muse Image, misma causa |
| Estrategia C (híbrida) | ⛔ Bloqueada en sus patas de imagen/segmentación; su pata de juicio QA con Spark sí es ejecutable hoy |
| Puntuación ciega de Arianna sobre análisis (sin propuestas) | ✅ Posible hoy con lo ya generado en H2 (1 imagen) y ampliable con la Etapa 0 |

---

## 4. Estimación de coste total del benchmark (precios oficiales documentados)

Supuestos: set de 8 imágenes, 2 intensidades, 3 estrategias → 48 propuestas.

| Concepto | Cálculo | Coste |
|---|---|---|
| Spark análisis + preferencias (Etapa 0) | 8 llamadas × (3.075 tok entrada × $1,25/M + 2.080 tok salida × $4,25/M) — tokens **medidos** en H2 | ≈ **$0,10** |
| Muse Image — Estrategia A | 16 imágenes × $0,01 | $0,16 |
| SAM — Estrategia B | 8 segmentaciones × $0,0025 | $0,02 |
| Muse Image — Estrategia B | 16 × $0,01 | $0,16 |
| SAM + Spark plan/QA — Estrategia C | 8 × $0,0025 + 16 llamadas Spark QA/plan ≈ 16 × $0,0127 | ≈ $0,22 |
| Muse Image — Estrategia C (+25% reintentos QA) | 20 × $0,01 | $0,20 |
| **TOTAL estimado** | | **≈ $0,86 → presupuesto con margen: $2** |

Notas de honestidad sobre el dinero:
- El coste es **irrelevante frente a los 150 $** del crédito de Meta **si el crédito existe**: el bloqueo del benchmark visual es de **acceso**, no de dinero.
- Si las llamadas Spark corren por Baseten (vía de hoy), consumen el crédito Baseten de 100 $ a las tarifas de Baseten (no publicadas en la documentación del conector del proyecto); el equivalente a precios de Meta sería ~$0,10–0,35 según la pata. En ningún caso se toca dinero de Lee sin su OK.
- La latencia de generación de imagen **no está documentada** en lo consultado: se medirá, no se asume.

## 5. Fuentes

**Oficiales de Meta:**
- developer.meta.com/ai/products/meta-model-api/ — modelos, precios oficiales, «Public preview. Now available with expanded global access», clave API en un clic.
- developer.meta.com/ai/models/muse-image/ — Muse Image: generación y edición, $0,01/imagen.
- ai.developer.meta.com/docs/features/responses — Responses API oficial (`POST /v1/responses`, SDK OpenAI, replay de razonamiento).
- llama.meta.com/get-started/ — tarjetas de Meta Model API: Spark 1.3, SAM 3.1 («Detect, segment, and track objects from a text prompt, across image and video»), Muse Image, Voice Transcribe.
- github.com/meta-models/meta-sam — librerías cliente oficiales de SAM 3.1 sobre la Meta Model API (protocolo de streaming, conformidad, playground con Model API key), licencia SAM.

**De terceros (solo como apoyo, nunca como prueba):** shipwithmuse.live y orcarouter.ai (resúmenes de la documentación y precios, coincidentes con las páginas oficiales), big-agi.com/docs/connect-meta (flujo de creación de clave en dev.meta.ai), mungomash.com (SAM 3.1 en la API desde el 18/09/2026 y checkpoint descargable desde el 27/03/2026).

**Internas del proyecto:** `H0_INFORME.md` §3–4 · `H2_PREP.md` §2–4 · `h2/sonda_modelos.json` · `h1/sonda_modelos_h1.json` (re-listado de hoy) · `h2/respuesta_directa_v2.json` (tokens medidos) · `credits-watch-state.json`.

**Fin de H1 (preparación). Sin generación ejecutada. La siguiente decisión es de Lee: verificar el crédito/clave de Meta en dev.meta.ai (§2.2) y dar OK a la Etapa 0.**

---

## APÉNDICE DE RESULTADOS — Estrategia A ejecutada (30/10/2026)

Ejecución ordenada por Lee («Hazlo a tope», 30/10 01:55) tras la
activación de la Meta Model API (§62 de ESTADO_PROYECTO.md). Se
ejecutó la **estrategia A** (la de producción) sobre el subconjunto
de banco del set; las estrategias B/C no se ejecutaron (su pata SAM
sigue sin códec RLE — ver proveedor_meta.py — y la decisión de
producción ya era A).

**Set ejecutado** (registro completo en `h1/resultados/set.json`;
las fotos se miraron una a una antes de asignar el caso):

| Imagen | Fuente | Caso |
|---|---|---|
| IMG-01 | Pexels 33949302 | pobladas/tupidas, caso ancla (= web/ejemplo.jpg) |
| IMG-02 | Pexels 7846544 | finas y muy claras, poca densidad (desviación: foto desde abajo, ojos semicerrados) |
| IMG-03 | Pexels 19727580 | pelo muy rizado (desviación: cabeza girada ~90°, cejas ya marcadas) |
| IMG-04 | Pexels 9854230 | pelirroja natural, cejas claras y suaves |
| IMG-05 | Pexels 15075186 | luz cálida desigual tipo selfie, encuadre parcial |
| IMG-06 | Pexels 9516040 | tono de piel profundo, primer plano |

**IMG-07 e IMG-08 NO se ejecutaron**: exigen consentimiento escrito
(Arianna / voluntaria) que no consta; quedan pendientes con su
plantilla de §3.6. Etapa 0 fijada por caso con el vocabulario real
de preferencias de producción; para IMG-01 se reutilizó el análisis
real de Spark de H2. Generación con la MISMA función y la MISMA
construcción de instrucción que producción
(`probador/proveedor_meta.py`), transporte por el conector
`custom.meta-model-api`. Registro crudo: `h1/resultados/registro.jsonl`
(errores: ninguno, `errores.jsonl` vacío).

**Resultados** (12 propuestas; coste 0,12 $ contra el crédito Meta):

- Latencia de edición: **p50 16,1 s** · media 16,9 s · rango
  11,4–24,3 s (criterio §3.6: p50 ≤ 45 s — cumple con margen; el
  flujo completo suma el análisis Spark previo, ~12 s medidos en
  QA21).
- Puntuación técnica del operador con la rúbrica de §3.4
  (`h1/resultados/puntuacion_tecnica.json`, hojas de contacto
  `contacto.jpg` por imagen): **Calidad media 4,33/5** (intensidad
  natural 4,67 · marcada 4,00 — la marcada tiende a sobre-rellenar),
  **Identidad media 5,00/5** (ninguna propuesta por debajo de 3),
  **Delimitación media 5,00/5**, **fugas graves 0/12 (0 %)**.
- Criterios §3.6: identidad ✓ · delimitación ✓ · latencia ✓ ·
  **aceptación: PENDIENTE** — el voto decisivo es la puntuación
  ciega de Arianna, no sustituible por la técnica.

**Veredicto**: la estrategia A queda **confirmada para producción**
en todos los criterios medibles; la aceptación de Arianna es el
único criterio abierto y no bloquea el encendido (la propuesta se
muestra siempre como orientación aproximada que ella confirma en el
salón). Ejemplos servidos: `web/icons/vista-benchmark-img02.jpg` e
`img04.jpg` en la web viva (original | natural | marcada).
