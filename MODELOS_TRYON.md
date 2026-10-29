# MODELOS_TRYON.md — Matriz de modelos para el probador virtual de LA ASISTENTA

> Investigación realizada el **28/10/2026** (Europe/Madrid) para el pivote «probador virtual con IA».
> Método: documentación y páginas de precios **oficiales del proveedor** como fuente primaria. Cuando una
> afirmación solo pudo apoyarse en un tercero, se marca **[tercero]**. Cuando no se pudo verificar, se
> marca **NO VERIFICADO** — no se rellena con suposiciones.
> No se ha hecho ningún registro, ninguna compra ni ninguna llamada de pago. Ningún modelo de esta lista
> está «conectado» hasta que exista una petición real verificada (regla del proyecto).

**Contexto de partida (lo que ya tenemos):** Baseten con **100 $ de crédito concedidos** y **Muse Spark
Open** (`meta-models/muse-spark-open-1026`) conectado y probado en producción (análisis de foto con JSON
validado; latencia medida en producción: 12–46 s, con picos >150 s). La **Meta Model API** (Muse Image,
SAM 3.1) existe y tiene precios públicos, pero **NO tenemos la clave de equipo** — bloqueo documentado;
todo lo que dependa de ella va en la categoría 3.

---

## Resumen ejecutivo

1. **La única vía de try-on de ropa ejecutable HOY sin tarjeta nueva** es **autohospedar un modelo abierto
   con licencia comercial en Baseten** pagando GPU por minuto contra el crédito de 100 $ que ya tenemos.
   Hay exactamente dos candidatos limpios: **FASHN VTON v1.5 (Apache 2.0)** y **Leffa (MIT)**. Los famosos
   IDM-VTON y CatVTON son **CC BY-NC-SA: prohibido su uso comercial**, también aunque un tercero los
   aloje como API (la licencia del modelo no se «lava» pasando por Segmind o Replicate).
2. **La mejor API comercial de ropa** es **FASHN.ai** (0,075 $/imagen en v1.6, latencia oficial 5–17 s,
   privacidad documentada, derechos comerciales incluidos), pero exige **compra mínima de 7,50 $ con
   tarjeta** → necesita OK de Lee.
3. **Google Vertex AI Virtual Try-On** es real y GA (`virtual-try-on-001`, 0,06 $/imagen), pero exige
   proyecto GCP con facturación → tarjeta y fricción de alta; es plan B, no arranque.
4. **Gafas**: no existe una API indie de try-on óptico serio. Fittingbox y Perfect Corp son B2B con
   precios de venta consultiva (decenas de miles al año en el caso enterprise de Perfect Corp). La vía
   pragmática hoy es **edición de imagen con referencias** (Nano Banana / FLUX Kontext / Muse Image cuando
   haya clave) + segmentación/landmarks para colocar y controlar, asumiendo resultado «aproximación
   visual», no ajuste óptico.
5. **Cejas**: la vertical ya funciona con Spark (recomendación). Para la **vista previa visual** el motor
   natural es **Muse Image (0,01 $/imagen)** — bloqueado por la clave de Meta. Alternativa disponible hoy
   vía terceros: **Nano Banana Edit en fal (0,0398 $/imagen)** o **FLUX.1 Kontext Pro (0,04 $/imagen)**,
   ambas tras tarjeta/recarga en fal o Replicate.
6. **Trampa detectada**: el endpoint de Kolors Virtual Try-On en fal (`fal-ai/kling/v1-5/kolors-virtual-try-on`)
   está **DEPRECADO según la propia página de fal**. No construir sobre él.

---

## A. Try-on de ROPA (foto de persona + imagen de prenda → resultado)

### A.1 APIs comerciales

| Campo | **FASHN.ai — Try-On v1.6 / Try-On Max** | **Google Vertex AI — Virtual Try-On (`virtual-try-on-001`)** | **Segmind — SegFIT / SegFit v1.2** |
|---|---|---|---|
| Proveedor y nombre exacto | FASHN.ai · `tryon-v1.6` y `tryon-max` (model_name en la API) | Google Cloud Vertex AI · `virtual-try-on-001` (GA desde 20/01/2026; antes `virtual-try-on-preview-08-04`) | Segmind · SegFIT, SegFit v1.1/v1.2, Try-On Diffusion |
| Endpoint/API oficial | `POST https://api.fashn.ai/v1/run` + polling/webhook; SDKs oficiales TS y Python. Docs: https://docs.fashn.ai/api-reference/tryon-v1-6 | `POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL_ID}:predict`. Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/virtual-try-on-api | API REST de Segmind (`api.segmind.com`), modelos en https://www.segmind.com/models/segfit |
| Coste por generación (oficial) | Crédito = **0,075 $**. v1.6 = 1 crédito/imagen (**0,075 $**). Max = 1–5 créditos según modo/resolución (**0,075–0,375 $**). Solo se cobra el resultado correcto. Fuente: https://fashn.ai/products/api | **0,06 $/imagen** (fila «Virtual Try-On» de la tabla oficial de precios de Imagen). Fuente: https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing | Por segundo de GPU: SegFIT 0,0108 $/s GPU (su estimador oficial da ≈**0,32 $**/generación); SegFit v1.2 0,0015 $/s GPU (estimador ≈**0,045–0,09 $**/generación). Fuentes: https://www.segmind.com/models/segfit/pricing · https://www.segmind.com/models/segfit-v1.2/pricing |
| Latencia (oficial) | v1.6: **5–17 s**. Max: ~10 s en modo rápido 1K, hasta ~55 s en calidad 4K. Fuente: FAQ oficial en https://fashn.ai/products/api | **NO VERIFICADO** en la documentación oficial consultada (cuota regional: 50 peticiones/min por modelo) | **NO VERIFICADO** (factura por segundos de GPU; la duración depende del modelo) |
| Resoluciones/formatos | v1.6: tops, bottoms, one-pieces. Max: hasta **4K**; también zapatos, bolsos, gorras y joyería según la página oficial. Entrada: foto de persona + prenda en flat-lay, maniquí fantasma o sobre modelo | Entrada máx. 10 MB, PNG/JPEG; salida con la **misma relación de aspecto y resolución que la entrada**; hasta 4 salidas por petición; watermark SynthID configurable. Fuente: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/virtual-try-on-001 | **NO VERIFICADO** en detalle (entrada persona+prenda por URL/base64 según la ficha del modelo) |
| Licencia / uso comercial | **Permitido**: «puedes usar las imágenes y vídeos creados con la API en tus productos, páginas de producto y marketing» (FAQ oficial) | Producto comercial de Google Cloud bajo sus términos de servicio cloud (uso comercial = uso normal del servicio) | SegFIT es modelo propio de Segmind servido bajo sus términos. **Ojo:** Segmind también aloja **IDM-VTON**, cuyo modelo subyacente es CC BY-NC-SA (ver A.3): que lo sirva un tercero **no** lo convierte en comercialmente limpio. **NO VERIFICADO** qué cobertura dan los términos de Segmind sobre ese punto |
| Privacidad / retención | **Documentada (oficial)**: salidas borradas a los **3 días**; imágenes enviadas en base64 se borran al completar la petición; **no entrena con tus datos salvo opt-in**; DPA disponible. Fuente: https://fashn.ai/products/api | Gobernanza de datos de Vertex AI (los datos del cliente no se usan para entrenar modelos de Google según los términos cloud estándar) — detalle específico de retención de VTO: **NO VERIFICADO** en esta pasada | **NO VERIFICADO** en fuente oficial en esta pasada |
| Barrera de entrada | **Sin créditos gratuitos en la API.** Compra mínima **7,50 $** (100 créditos) → **exige tarjeta**. Cuenta + API key | Proyecto GCP + **facturación activada (tarjeta)** + habilitar Vertex AI API. El free trial de GCP (300 $) existe para cuentas nuevas pero exige método de pago. Región: el modelo es regional; disponibilidad concreta en regiones UE **NO VERIFICADA** en esta pasada | Cuenta + créditos de pago (pay-as-you-go). Si exige tarjeta para la primera recarga: **NO VERIFICADO** |
| Coste estimado de la 1ª prueba real | **7,50 $** (compra mínima = 100 créditos ≈ 100 try-on v1.6) | **0,06 $** por imagen una vez exista el proyecto con facturación (el coste es el alta, no la llamada) | ≈**0,05–0,35 $** por generación según modelo, tras recargar créditos |

### A.2 Plataformas multi-modelo (fal.ai y Replicate)

**fal.ai** — qué try-on aloja hoy, verificado en sus propias páginas:

| Modelo en fal | Estado / precio oficial | Notas |
|---|---|---|
| `fal-ai/kling/v1-5/kolors-virtual-try-on` (Kling Kolors VTON v1.5) | ⚠️ **DEPRECADO**: «This model is no longer supported» en su propia página: https://fal.ai/models/fal-ai/kling/v1-5/kolors-virtual-try-on — precio ya no aplicable | Era el endpoint try-on «de catálogo» de fal. No usar |
| Plantilla `workflows/template/fal-vton` | Plantilla oficial de fal (flujo persona+prenda): https://fal.ai/workflows/templates/template/fal-vton | Es una plantilla de workflow, no un modelo con precio propio verificado |
| `fal-ai/nano-banana/edit` (Nano Banana = Gemini 2.5 Flash Image) | **0,0398 $/imagen** según la tabla oficial de precios de fal (resumen en https://fal.ai — pricing por modelo) | No es un try-on dedicado: es edición por instrucción con referencias. Mucha gente lo usa como try-on «suficientemente bueno». Ver §C |
| Generación/edición general (FLUX Kontext, Qwen Image Edit, etc.) | Por imagen/MP según modelo | Sirven como motor de edición (§B y §C), no como VTON especializado |

Precio de un endpoint try-on dedicado vivo en fal (tipo CatVTON serverless): **NO VERIFICADO en página
oficial de fal en esta pasada**. Un benchmark de terceros [tercero] midió Kling VTON ≈0,07 $/llamada y
CatVTON ≈0,05–0,06 $/generación (https://www.ionio.ai/blog/vton) — orientativo, no oficial.

Barrera fal: cuenta + saldo de pago (sin free tier en su página pública de precios) → **tarjeta/recarga
antes de la primera llamada de pago**. Primera prueba real estimada: **0,04–0,15 $** por imagen según modelo.

**Replicate** — modelos try-on vivos hoy en replicate.com:

| Modelo | Precio/latencia en su página | Licencia (la que manda) |
|---|---|---|
| `cuuupid/idm-vton` (IDM-VTON, KAIST) | ≈**0,025 $/ejecución**, predicción típica **~19 s**, hardware A100 80GB. https://replicate.com/cuuupid/idm-vton | 🔴 **CC BY-NC-SA 4.0 — «Non-Commercial use only»** en la propia página del modelo y en su repo. Sirve para **evaluar calidad en privado**, jamás para el producto |
| `viktorfa/oot_diffusion` y otros OOTDiffusion (comunidad) | Por tiempo de GPU según hardware (la página de cada modelo lo muestra al ejecutar) | La licencia de OOTDiffusion figura como Apache 2.0 en comparativas [tercero]; **NO VERIFICADO en el repo oficial en esta pasada** — verificar antes de cualquier uso. Calidad inferior a IDM-VTON según el paper de IDM-VTON |
| Editores oficiales útiles (§C): `black-forest-labs/flux-kontext-pro`, `google/nano-banana`, etc. | Kontext Pro **0,04 $/imagen** | Propietarios vía API de BFL/Google (uso comercial vía API) |

Barrera Replicate: cuenta (login GitHub) + **método de pago** para uso por API continuado. Primera prueba
real estimada: **0,025–0,04 $** por imagen.

### A.3 Autohospedaje en Baseten (con el crédito que YA tenemos) — la vía inmediata

Baseten factura los despliegues dedicados **por minuto de GPU** (fuente: tabla de precios de Baseten,
reproducida en https://www.eesel.ai/blog/baseten-pricing desde baseten.co/pricing): T4 0,01052 $/min ·
L4 0,01414 $/min · A10G 0,02012 $/min · **A100 80GB 0,06667 $/min** · H100 0,10833 $/min. Sin réplicas
activas no hay coste (scale-to-zero; se factura el tiempo de despliegue/arranque y de predicción).
Ese gasto sale del **mismo saldo** donde está el crédito de 100 $ → **no hace falta tarjeta nueva**.

| Modelo abierto | Licencia REAL (fuente) | Datos técnicos | Coste/generación estimado en Baseten |
|---|---|---|---|
| **FASHN VTON v1.5** (FASHN AI, pesos abiertos) | ✅ **Apache 2.0** — «released under Apache 2.0… for research and commercial use». Fuentes: https://fashn.ai/research/vton-1-5 · https://huggingface.co/fashn-ai/fashn-vton-1.5 | 972M parámetros, ~2 GB de pesos; pixel-space, **sin máscaras**; salida **576×864**; tops/bottoms/one-pieces; ~**5 s en H100** (fuente: su página de research) | Solo cómputo: 5 s en H100 ≈ **0,009 $**. Realista con arranques y margen: **primera prueba completa (despliegue + ~20 generaciones) ≈ 1–3 $ del crédito existente** |
| **Leffa** (Meta AI / franciszzj; CVPR 2025) | ✅ **MIT** para código y pesos. Fuentes: https://huggingface.co/franciszzj/Leffa · repo `franciszzj/Leffa`. ⚠️ Matiz honesto: los pesos se entrenaron con VITON-HD y DressCode (datasets de investigación); la propia comunidad de FASHN recomienda revisar los términos de esos datasets antes de uso comercial. Riesgo bajo pero **declarado** | Try-on + pose transfer; ~**6 s en A100** (changelog oficial del repo); necesita preproceso (parsing + pose) | 6 s en A100 ≈ **0,007 $** de cómputo. Primera prueba completa ≈ **1–3 $ del crédito existente** |
| IDM-VTON | 🔴 **CC BY-NC-SA 4.0** (repo y página de Replicate) | Referencia de calidad, pero **vetado para producto comercial** sin acuerdo aparte con KAIST | Solo evaluación interna privada |
| CatVTON | 🔴 **CC BY-NC-SA** [tercero: tabla de licencias en https://dev.to/om_prakash_3311f8a4576605 — **NO VERIFICADO** en el repo oficial en esta pasada, pero coincide con lo publicado por FASHN en su comparativa de modelos abiertos] | Ligero (8 GB VRAM) | Vetado igual que IDM-VTON mientras no se confirme lo contrario en el repo |
| Kolors Virtual Try-On (Kwai-Kolors) | ⚠️ Código Apache 2.0, pero **los pesos exigen registro comercial**: rellenar cuestionario y enviarlo a kwai-kolors@kuaishou.com; el registro se considera concedido si el producto no supera 300M de usuarios/mes. Fuente: repo oficial Kwai-Kolors/Kolors (README, sección License) | Try-on integrado en el ecosistema Kolors/Kling | Viable tras **registro gratuito por email** (trámite, no pago); no es «usar y listo» |
| OOTDiffusion | ⚠️ Apache 2.0 según comparativas [tercero]; **NO VERIFICADO** en fuente primaria en esta pasada | Calidad 2024, superado | Solo si se verifica la licencia en el repo |

**Coste de la primera prueba real (categoría «ya tenemos»):** desplegar FASHN VTON v1.5 **o** Leffa en
Baseten con Truss y generar las primeras ~20 imágenes de prueba: **≈1–3 $ estimados, cargo al crédito
Baseten existente (100 $)**. Es una estimación a partir de tarifas oficiales por minuto y tiempos
oficiales por inferencia; el primer despliegue puede consumir más minutos de arranque — hay que medirlo
en la propia prueba y registrar el coste real.

**Resultado de la prueba real de FASHN VTON v1.5 (28/10/2026, autorizado por Lee, ≈1–3 $):**
❌ **BLOQUEADA antes de gastar un céntimo — coste real: 0 $.** El truss quedó construido y
validado (`probador/truss-fashn/`, GPU L4) y el adaptador implementado con su lógica probada
sin red (`probador/adaptador_fashn_baseten.py`, tests 5/5), pero el despliegue fue rechazado
por la plataforma: `truss push` → `ApiError: The user does not have the authorization to
perform the request`; llamada directa `POST /v1/models` → **HTTP 403
`{"code": "PERMISSION_DENIED", "message": "Authorization error"}`**. La clave disponible es
de **inferencia** (Model API): lee modelos y llama a Spark, pero no crea despliegues propios.
Ninguna generación se ejecutó; la calidad del modelo sigue **sin verificar por nosotros**.
Desbloqueo: Lee crea en la consola de Baseten una clave con permisos de despliegue (ver
`probador/prueba-fashn/README.md`, con la evidencia completa y las imágenes oficiales de la
prueba ya preparadas). Al desbloquear, el coste estimado de la prueba baja a ≈0,3–0,6 $
(L4 a 0,01414 $/min, 20–40 min de réplica activa).

---

## B. GAFAS Y ACCESORIOS

Verdad incómoda primero: **el try-on óptico «de verdad»** (montura 3D, distancia pupilar, escala real)
es un mercado B2B cerrado. El probador 2D por IA generativa da una **aproximación visual**, suficiente
para «cómo me quedan estas gafas» como decisión de estilo, insuficiente para prometer ajuste. Hay que venderlo así en la UI.

| Candidato | Qué es / acceso | Coste | Veredicto |
|---|---|---|---|
| **Fittingbox** | Especialista óptico (20 años, base de >195.000 monturas 3D de >1.200 marcas, medición de distancia pupilar). Fuente: https://fittingbox.com/en/digital-frames/3d-digitization (digitalización de monturas propias: **9–250 € por montura**). Sus planes self-serve son para Shopify (59–199 $/mes según su ficha en la tienda de apps de Shopify [tercero]); el acceso API/plataforma es **venta B2B con contacto comercial** | Sin API pública de pago por uso; **no hay precio de API en su web oficial (verificado: su página vende digitalización y soluciones, no créditos API)** | ❌ No accesible para un indie sin contrato. Descartado para el MVP |
| **Perfect Corp (YouCam) — AI API Suite** | Suite de APIs de try-on (belleza, gafas, joyería, moda) con modelo «pay-as-you-go» anunciado en su nota oficial («costs starting as low as a few dollars per month»). Fuente: nota de prensa oficial vía https://www.stockwatch.com/News/Item/U-b20260324790104-U!PERF-20260324/U/PERF-20260324. Detalle de precios y alta self-serve de la API de gafas: **NO VERIFICADO** (su web comercial empuja a contacto/planes por SKU). Análisis de competidor [tercero]: planes self-serve de maquillaje 3.948–5.868 $/año y enterprise desde ~50.000 $/año, gafas/joyería con precio aparte (https://www.banuba.com/blog/banuba-vs-perfect) | Orientativo enterprise; el «desde unos dólares/mes» de su nota se refiere a la suite AI genérica, no necesariamente al try-on óptico | ⚠️ Posible a medio plazo si su API de gafas resulta self-serve; hoy: **opaco y probablemente caro**. No es la primera prueba |
| **Ditto** (try-on óptico B2B, hoy parte de un grupo mayor de óptica) | Venta enterprise a cadenas ópticas; sin API pública ni precios publicados encontrados | **NO VERIFICADO** (sin fuente oficial localizable en esta pasada) | ❌ Fuera del alcance indie |
| **FASHN Try-On Max** (el mismo de §A) | Su página oficial lista como probables: ropa, zapatos, bolsos, gorras y **joyería**. ⚠️ **«Gafas» no aparece en la lista oficial** de la API (sí en fichas de terceros). Bolsos y joyería sí están | 0,075–0,375 $/imagen (1–5 créditos) | ✅ Útil para **bolsos, gorras, joyería** dentro de la misma API de ropa. Para gafas: **NO VERIFICADO** que las soporte de verdad |
| **Edición generativa con referencias** (Nano Banana Edit / FLUX Kontext / Muse Image) | Se pasan **dos referencias** (foto de la persona + foto de las gafas) con instrucción «ponle estas gafas, conserva cara y luz». Nano Banana Pro admite hasta **14 imágenes de referencia** (fuente: https://fal.ai — página de Nano Banana Pro) | Nano Banana Edit 0,0398 $/img (fal) · Nano Banana Pro 0,15 $/img (fal) · Kontext Pro 0,04 $/img · Muse Image 0,01 $/img (con clave Meta) | ✅ **La vía realista hoy** para gafas y accesorios pequeños. Calidad variable: hay que evaluarla con la prueba, no prometerla |
| **Composición clásica con segmentación + landmarks** (sin generación) | Pipeline propio: detección facial/landmarks (p. ej. MediaPipe, gratuito y en dispositivo — coste 0) para posición/escala de la montura + segmentación para oclusiones. SAM 3.1 (cuando haya clave Meta) segmenta «gafas» por texto a 2,50 $/1.000 imágenes | ≈0 $ en cómputo propio + SAM cuando exista | ✅ Complemento barato y controlable; resultado menos «mágico» que el generativo pero geométricamente honesto |

**Coste estimado de la primera prueba real de gafas:** con edición por referencias en fal: **≈0,50 $
para una tanda de ~10 pruebas** (tras la recarga inicial en fal). Con Muse Image sería 0,10 $ la misma
tanda, pero está bloqueado por la clave (categoría 3).

---

## C. CEJAS — edición localizada sobre la foto

La vertical de cejas ya tiene la mitad hecha: **Spark analiza y recomienda** (en producción). Falta el
motor que **pinte** la propuesta sobre la foto. Candidatos de edición por instrucción:

| Candidato | Endpoint / precio oficial | Latencia | Notas para cejas |
|---|---|---|---|
| **Muse Image** (`muse-image-1.0`, Meta Model API) | **0,01 $/imagen**. Genera Y edita; «diseñado para cambiar exactamente lo que especificas y dejar el resto intacto». Fuentes oficiales: https://developer.meta.com/ai/models/muse-image/ · https://developer.meta.com/ai/products/meta-model-api/ | **NO VERIFICADO** oficialmente | 🔒 **BLOQUEADO: sin clave de equipo de Meta.** Es el motor «de la casa» para el hackathon (25 % del criterio son herramientas Meta) y el más barato por orden de magnitud. En la API Standard, Meta declara que los prompts **no** se usan para entrenar (el tier Contributor, más barato en texto, sí puede usarlos — no usar Contributor con fotos de clientas) |
| **SAM 3.1** (`sam-3.1`, Meta Model API) | **2,50 $/1.000 imágenes** (0,20 $/1.000 frames de vídeo). Segmentación por prompt de texto («cejas»), máscaras a nivel de píxel. Fuente oficial: https://developer.meta.com/ai/models/sam-3-1/ | **NO VERIFICADO** | 🔒 Mismo bloqueo. Su papel: **delimitar la zona de cejas** para que la edición (inpainting) no toque el resto de la cara, y para medir/validar el resultado |
| **Nano Banana Edit** (Gemini 2.5 Flash Image vía fal) | `fal-ai/nano-banana/edit` · **0,0398 $/imagen** (tabla oficial de precios de fal). Edición por instrucción sin máscara; versión 2.1 en fal: editar 1K ≈0,0415 $ (página oficial del modelo en fal.ai) | Segundos–decenas de segundos [tercero]; oficial **NO VERIFICADO** | Disponible hoy tras recarga en fal. Bueno siguiendo instrucciones finas («cejas más definidas, arco suave, tono castaño») conservando identidad |
| **FLUX.1 Kontext Pro** (Black Forest Labs; en fal y Replicate) | **0,04 $/imagen** (Max: 0,08 $). Precio oficial de BFL replicado por ambas plataformas | Segundos [tercero] | Edición contextual con gran preservación de identidad; candidato sólido y con precio publicado en dos plataformas |
| **Qwen Image Edit** (Alibaba; en fal/Replicate/Segmind) | Por MP/imagen según plataforma — precio concreto **NO VERIFICADO** en esta pasada | — | Alternativa abierta; evaluar solo si los dos anteriores fallan |
| Autohospedado: FLUX Kontext dev / editores abiertos en Baseten | GPU por minuto (tarifas §A.3) | — | ⚠️ Licencias: FLUX.1 [dev] es **no comercial**; Kontext [dev] igual según BFL. No asumir «abierto = comercial»: verificar modelo a modelo. Sin candidato de edición abierto comercialmente limpio confirmado en esta pasada |

**Coste estimado de la primera prueba real de cejas:** tanda de 10 ediciones con Nano Banana Edit ≈
**0,40 $** (tras recarga en fal) o con Kontext Pro ≈ **0,40 $** (fal/Replicate). Con Muse Image serían
**0,10 $**, bloqueados por la clave.

**Diseño recomendado del pipeline de cejas (cuando haya clave):** Spark propone forma/tono (ya hecho) →
SAM 3.1 recorta la región de cejas → Muse Image edita solo esa región → Spark valida el resultado contra
la carta antes de mostrarlo. Sin clave, el mismo pipeline funciona con Nano Banana/Kontext haciendo la
edición completa por instrucción y Spark validando.

---

## D. Comprensión visual de producto — Muse Spark (YA conectado)

Qué aporta el cerebro que ya tenemos, sin gastar un euro nuevo (tira del crédito Baseten existente;
coste por llamada = tokens de Spark en Baseten, céntimos en la práctica del proyecto):

1. **Clasificación de catálogo desde la foto del producto**: categoría (tops/bottoms/one-pieces para
   enrutar al try-on; gafas/bolso/zapatillas para enrutar a edición), color dominante, material aparente,
   estampado, y atributos vendibles — devuelto en **JSON validado contra un esquema**, el mismo patrón
   que ya funciona en producción para el análisis de cejas.
2. **Enrutado del orquestador**: Spark decide qué motor usar por producto (VTON dedicado si es ropa,
   edición con referencias si es gafas/accesorio, edición localizada si es cejas) y prepara la
   instrucción de edición.
3. **Validación del resultado**: comparar la imagen generada con el producto original (¿conserva color,
   logo, forma?) y con la persona (¿conserva identidad?) antes de enseñarla; si no pasa, reintento o
   aviso honesto. Esto ya es el patrón «la IA interpreta; el sistema decide» del proyecto.
4. **Lo que NO hace**: Spark no genera ni edita imágenes de try-on por sí mismo con calidad de probador;
   es el cerebro, no el pincel. Y es **Spark Open por Baseten**, no el Spark alojado de la Meta Model
   API — no confundirlos en ninguna comunicación (regla del proyecto).

Primera prueba real en esta capacidad: **coste ≈ 0 $ nuevo** (ya conectado; consume crédito Baseten
existente, céntimos por foto clasificada).

---

## RECOMENDACIÓN ORDENADA POR CAPACIDAD

### (1) Probable AHORA con lo que ya tenemos (crédito Baseten, sin tarjeta nueva)

| Capacidad | Acción | Coste 1ª prueba |
|---|---|---|
| **Ropa** | Desplegar **FASHN VTON v1.5 (Apache 2.0)** en Baseten vía Truss; respaldo: **Leffa (MIT)**. Generar la primera tanda real persona+prenda y medir latencia/coste reales | **≈1–3 $** del crédito existente (estimación desde tarifas oficiales; medir y registrar el real) |
| **Comprensión de producto** | Extender el patrón Spark existente: clasificador de producto (categoría/color/atributos en JSON validado) para alimentar el catálogo y el enrutado | **≈0 $** nuevo (céntimos de crédito por foto) |
| **Gafas/accesorios** | Pipeline de **composición con landmarks** (MediaPipe en dispositivo, coste 0) como base honesta + dejar preparado el adaptador de edición por referencias | **0 $** (la parte generativa cae en categoría 2) |
| **Cejas** | Mantener análisis+recomendación con Spark (ya en producción); dejar el adaptador de edición preparado contra la interfaz común | **0 $** nuevo |

### (2) Necesita tarjeta/gasto → OK de Lee (importe de la primera prueba entre paréntesis)

| Capacidad | Acción | Coste 1ª prueba |
|---|---|---|
| **Ropa (calidad comercial)** | Alta en **FASHN.ai API** y prueba real de Try-On v1.6 y Max con las mismas fotos del test autohospedado, para comparar calidad/coste contra VTON 1.5 propio | **7,50 $** (compra mínima, = 100 créditos) |
| **Cejas (vista previa ya)** | Recarga mínima en **fal** y tanda con **Nano Banana Edit** (y Kontext Pro como contraste) | **≈0,40–0,80 $** de consumo + la recarga mínima que exija fal al pagar (**NO VERIFICADO** el mínimo) |
| **Gafas (generativo)** | La misma recarga de fal sirve: tanda de gafas por referencias con Nano Banana Pro/Kontext | **≈0,50–1,50 $** de consumo |
| **Ropa (alternativa)** | **Vertex AI Virtual Try-On** si FASHN y el autohospedado no convencen: alta GCP con facturación | **0,06 $/imagen** (el coste real es el alta) |
| **Evaluación privada** | Replicate `cuuupid/idm-vton` SOLO como vara de medir de calidad en evaluación interna (su licencia prohíbe el producto) | **≈0,025 $/imagen** |

### (3) Depende de la clave de Meta (bloqueo conocido: Billing de dev.meta.ai + clave de equipo)

| Capacidad | Acción al desbloquear | Coste 1ª prueba |
|---|---|---|
| **Cejas** | **Muse Image** como motor de vista previa + **SAM 3.1** para delimitar la región: el pipeline completo «de la casa» | **≈0,10 $** (10 imágenes) + SAM ≈0,0025 $/imagen |
| **Gafas/accesorios** | Muse Image con referencias (persona + montura) como editor principal | **≈0,10 $** (10 imágenes) |
| **Ropa** | Muse Image como editor/compositor complementario (no es un VTON dedicado: no sustituye a FASHN/VTON para prendas completas) | **0,01 $/imagen** |

---

## Lista de NO VERIFICADO (para no vender humo)

- Precio oficial de un endpoint try-on dedicado **vivo** en fal (el de Kolors está deprecado; CatVTON en fal solo consta por terceros).
- Latencia oficial de Vertex AI Virtual Try-On y su disponibilidad concreta en regiones europeas.
- Si Segmind exige tarjeta para la primera recarga, y si sus términos cubren el uso comercial de modelos NC que aloja (IDM-VTON).
- Licencia de OOTDiffusion y de CatVTON **en sus repos oficiales** (las fuentes de esta pasada son comparativas de terceros y la página de FASHN).
- Precio self-serve real de la API de gafas de Perfect Corp (su nota oficial habla de la suite AI en general) y cualquier precio de Ditto.
- Que FASHN Try-On Max acepte **gafas** (su lista oficial: ropa, zapatos, bolsos, gorras, joyería).
- Retención de imágenes de usuario en fal y Replicate según sus páginas oficiales (no localizadas en esta pasada; FASHN y el autohospedaje en Baseten sí tienen historia de privacidad clara).
- Latencias oficiales de Muse Image y SAM 3.1 (Meta no las publica en las páginas consultadas).
- Si el crédito Baseten del hackathon se descuenta igual para despliegues dedicados que para Model APIs (la facturación es sobre el mismo saldo según la estructura de precios de Baseten; confirmarlo en el primer despliegue, que además medirá el coste real).

## Fuentes principales (oficiales primero)

- FASHN API y precios: https://fashn.ai/products/api · Docs try-on: https://docs.fashn.ai/api-reference/tryon-v1-6
- FASHN VTON v1.5 (Apache 2.0): https://fashn.ai/research/vton-1-5 · https://huggingface.co/fashn-ai/fashn-vton-1.5
- Leffa (MIT): https://huggingface.co/franciszzj/Leffa
- IDM-VTON (CC BY-NC-SA): https://replicate.com/cuuupid/idm-vton
- Kolors (registro comercial): repo oficial Kwai-Kolors/Kolors, sección License
- Vertex AI VTO: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/virtual-try-on-api · Modelo: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/virtual-try-on-001 · Precios: https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
- Segmind: https://www.segmind.com/models/segfit/pricing · https://www.segmind.com/models/segfit-v1.2/pricing · https://www.segmind.com/models/idm-vton/pricing
- fal (Kolors deprecado): https://fal.ai/models/fal-ai/kling/v1-5/kolors-virtual-try-on · Plantilla VTON: https://fal.ai/workflows/templates/template/fal-vton
- Meta: https://developer.meta.com/ai/models/muse-image/ · https://developer.meta.com/ai/models/sam-3-1/ · https://developer.meta.com/ai/products/meta-model-api/
- Fittingbox (digitalización 9–250 €/montura): https://fittingbox.com/en/digital-frames/3d-digitization
- Baseten (tarifas por minuto): baseten.co/pricing (tabla reproducida en https://www.eesel.ai/blog/baseten-pricing)
