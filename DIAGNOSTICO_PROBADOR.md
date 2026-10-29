# DIAGNÓSTICO — PIVOTE A PROBADOR VIRTUAL CON IA

> Encargo de Lee, 28/10/2026 23:26 («MISIÓN CRÍTICA»). Este documento es la
> primera entrega obligatoria ANTES de refactorar: qué existe, qué se
> reutiliza, qué cambia, qué falta y qué bloquea. **En esta pasada no se ha
> tocado código de la app** — solo inspección (repo, máquina InstaBox y
> conectores, 28/10 ~23:30) y este documento.
> Etiquetas: **PROBADO** (evidencia ejecutada) · **CONSTRUIDO** (existe,
> falta prueba en el nuevo uso) · **BLOQUEADO** (depende de terceros/Lee).

## 0. El concepto nuevo (fijado por Lee, no negociable en este documento)

LA ASISTENTA deja de ser «la app de reservas del salón» y de espejar a
Fresha. Fresha queda solo como **gramática de UX** (patrones de navegación,
tarjetas, búsqueda) recogida en `ESPEC_REFERENCIA.md`. El producto es una
**plataforma de comercio visual con IA**: «Descubre cómo te quedaría antes
de comprarlo». Verticales: **cejas** (el análisis del salón Ari Vivas pasa a
ser UNA vertical) y **moda** (ropa, gafas, zapatillas, accesorios).
Referencia visual aprobada: `~/workspace/user/files/1000056163_0_lu2t.png`
(mockup generado por ChatGPT a petición de Lee): cabecera «✦ ASISTENTA»,
hero «Pruébatelo antes de comprar» + botón violeta «Probar en mí», fila
«Empieza por aquí» (Ropa · Gafas · Zapatillas · Accesorios), tarjeta
«Tu probador IA», nav **Inicio · Explorar · Probador · Perfil**, fondo
blanco y violeta moderado.

## 1. Qué existe de verdad (repo y máquina)

**PROBADO — máquina InstaBox `la-asistenta` en marcha ahora mismo**
(4 vCPU / 8 GiB / 20 GiB en `/data`; `/salud` OK en web 8090 y webhook 8080;
procesos preservados tras pausa). Tres procesos vivos, un solo fichero por
superficie, todo Python stdlib:

| Pieza | Fichero(s) | Estado |
|---|---|---|
| Web PWA de la clienta (v6) | `web/web_server.py` (36 KB) + `web/index.html` (112 KB, una página) + `cita.html` + `sw.js` (shell v8) + `manifest.webmanifest` | **PROBADO**: QA10 43/43 a 412×915 contra la captura de referencia; instalable, caché solo del cascarón, `/api/*` jamás cacheado |
| Agenda real | `agenda/agenda.db` (SQLite) + `agenda_api.py` (8081, token) + `mcp_agenda.py` (6 herramientas) + `agenda_comun.py` | **PROBADO**: guarda de horario/anti-solape en el servidor; batería guarda **8/8** |
| Operadora WhatsApp | `whatsapp/webhook.py` + Hermes Agent (Nous) con Spark vía Baseten | **PROBADO** por autoprueba firmada (TwiML, 4,51 s); pendiente solo el mensaje real de Lee (trial: 100 mensajes, no se gastan en tests) |
| Análisis de cejas con foto | `POST /api/analizar` + `GET /api/analizar/<id>` en `web_server.py` | **PROBADO**: batería web **19/19**; visión real de Spark validada contra la carta |
| Mecánicas de reserva | enlace mágico `/cita/<token>` (en BD solo el hash), código AS-XXXX, lista de espera, prep, embudo, post-cita | **PROBADO**: batería mecánicas **20/20** |
| Baterías totales vigentes | web 19/19 · guarda 8/8 · mecánicas 20/20 · QA9 27/27 · QA10 43/43 | con el código final desplegado |

**Claves presentes (solo nombre/longitud, como siempre):**
- Máquina, `hermes-home/.env`: `BASETEN_API_KEY` len 45 (la real; cerebro
  probado con ella). Conector `custom.baseten` operativo en el entorno de
  Muse: modelo EXACTO `meta-models/muse-spark-open-1026`, endpoint
  `https://inference.baseten.co/v1/chat/completions`; crédito Baseten
  100 $ concedido (`credits-watch-state.json`: `baseten_key_connected:
  true`).
- Máquina, `whatsapp/.env`: Twilio completo (`TWILIO_ACCOUNT_SID` 34 ·
  `TWILIO_AUTH_TOKEN` 32 · `TWILIO_WHATSAPP_FROM` 23 ·
  `TWILIO_REPLY_MODE` len 5 = `twiml`). Las variables de WhatsApp directo
  de Meta están a **len 0** (ruta bloqueada, ver §6).
- **NO existe** ninguna clave de: Meta Model API (equipo), ni de ningún
  proveedor de generación/edición de imagen o try-on (fal, Replicate u
  otros), ni de catálogos de comercio. Buscado en los `.env` del proyecto
  y en los conectores instalados: no hay otra credencial de modelos.

**Conectores de comercio YA disponibles en el entorno de Muse**
(verificado en sus docs oficiales locales):
- `meta_catalog_search`: busca productos reales en muchos comercios —
  precio, imágenes, variantes, vendedor y si admite checkout. Sin login.
  Es un CLI del entorno del agente (`/opt/hatch/bin/meta-catalog-search`),
  **no una API que la máquina pueda llamar en producción** (ver §4).
- `shopify-ucp`: checkout real de productos del catálogo que traigan
  `checkout_token`, pagando con Link/Shop Pay; `checkout complete` exige
  aprobación del usuario y mueve dinero de verdad.

**Lo que NO existe**: catálogo de productos, fichas de producto, motor de
try-on, almacenamiento de resultados de pruebas, eventos de analítica de
compra, ni ninguna pantalla de moda. La app Android (Capacitor, APK v2 de
la dueña) existe pero no instalada; queda fuera del pivote salvo decisión
contraria.

## 2. Qué se reutiliza (tal cual o adaptado)

| Pieza actual | Reuso en el probador | Tipo |
|---|---|---|
| **Consentimiento antes de foto** (pantalla previa al análisis, opciones claras, foto solo en memoria) | Es literalmente el paso 2 del flujo del Probador; se amplía el texto a «perfil visual reutilizable» con opt-in separado | Tal cual + texto |
| **Subida de foto con reducción en el cliente** (canvas, lado ≤1280 px, JPEG 0,85; límites 6 MB, JPG/PNG/WebP, rate-limit 10/h) | Entrada del Probador para ropa (cuerpo) y cejas (rostro) | Tal cual |
| **Trabajos asíncronos con sondeo** (`POST` → 202 + trabajo en memoria con TTL, `GET /<id>` cada 3 s, progreso honesto, errores humanos, sin reintentos tras timeout) | Patrón anti-502 para la generación try-on, que será igual o más lenta que Spark. Es LA pieza de ingeniería clave del pivote | Tal cual (nuevo endpoint `/api/probar` gemelo) |
| **Orquestador Spark** (vía Baseten, clave solo en servidor, salidas JSON validadas antes de mostrar) | Interpretar peticiones («algo para una boda»), leer la foto (qué prendas/zona se ven), puntuar y ordenar productos del catálogo, redactar la recomendación. NO genera la imagen del try-on (no es su capacidad: queda escrito) | Adaptado (prompts y esquemas nuevos) |
| **Perfil en el dispositivo** (`localStorage`, clave `la-asistenta-perfil-v1`: nombre/teléfono, guardar/borrar verificados) | Base del «Perfil» nuevo: preferencias + consentimiento del perfil visual; los datos siguen sin salir del dispositivo salvo la foto enviada a analizar | Adaptado |
| **Estructura PWA + navegación** (cascarón cacheado, `/api/*` siempre red, nav inferior de 4 con activa violeta, tokens v5: `#6950f3`, `#0d0d0d`, `#f5f5f5`, `#dee3e7`, Montserrat) | La nav pasa a Inicio · Explorar · Probador · Perfil con la anatomía ya medida; el violeta de marca coincide con el mockup aprobado | Adaptado |
| **Analítica de embudo** (`agenda_comun.registrar_evento` + tabla `eventos` + `GET /embudo`) | Mismo patrón, eventos nuevos: `prueba_iniciada`, `generacion_ok`, `generacion_error`, `producto_guardado`, `clic_compra`. La medición honesta ya es cultura del proyecto | Adaptado (tipos nuevos) |
| **Disciplina de catálogo real** (la carta sale de la BD vía `/api/servicios`; nada se pinta sin fuente) | El catálogo de moda se servirá igual: endpoint propio del servidor con productos de fuente verificable; nunca productos escritos a mano en el HTML | Tal cual (principio) |
| **Vertical de cejas completa** (análisis + recomendación + reserva real) | Pasa a ser la vertical «Cejas» del Probador: mismo flujo, nueva casa. Es hoy la ÚNICA prueba visual funcional de la plataforma y la demo segura | Tal cual, reubicada |

## 3. Qué pantallas/funciones cambian o mueren

- **MUERE como home la pantalla del salón**: fuera de la superficie
  principal la fila de ubicación, las 8 categorías del marketplace de
  belleza (Todo/Cabello/Uñas/…/Odontología), el carrusel «Recomendado» de
  salones y la tarjeta del salón. La home nueva es la del mockup: hero
  «Pruébatelo antes de comprar», «Probar en mí», Ropa/Gafas/Zapatillas/
  Accesorios, «Tu probador IA», looks.
- **La reserva de cejas NO muere: se reubica.** Análisis, recomendación y
  reserva en la agenda real quedan dentro del Probador como vertical
  «Cejas» (y su pantalla de salón accesible desde ahí). La página del
  enlace mágico `/cita/<token>` y el post-cita se conservan intactos:
  son infraestructura de la vertical, no de la home.
- **Nav**: Inicio · Buscar · Historial · Perfil →
  **Inicio · Explorar · Probador · Perfil**. «Historial» como pestaña
  desaparece; las citas viven dentro de la vertical Cejas y los looks
  guardados en Perfil/Guardados. El botón «Reservar» nunca fue pestaña y
  sigue sin serlo.
- **Agenda y operadora WhatsApp: se conservan porque funcionan**, con su
  papel dicho sin maquillar: la agenda es el motor de la vertical Cejas
  (y la prueba de que la plataforma ejecuta acciones reales, no solo
  imágenes). La operadora WhatsApp queda como **canal de la vertical
  Cejas** y candidata natural a «probador conversacional» en una fase
  posterior; en el concepto nuevo NO es la superficie principal y no se
  le atribuye ningún papel que no tenga hoy.
- **ESPEC_REFERENCIA.md** deja de ser la orden de trabajo y pasa a ser lo
  que Lee ha fijado: referencia de patrones. La v6 queda como base
  técnica (anatomía, tokens, QA por comparación), no como destino.

## 4. Qué falta para la PRIMERA prueba virtual funcional

1. **Módulo de catálogo real (ingeniería + una decisión de fuente).**
   Hoy el try-on no tiene QUÉ probar: no existe ni un producto de moda en
   el sistema. Opciones evaluadas con lo que hay en el entorno:
   - `meta_catalog_search` da productos reales con foto, precio, variantes
     y enlace/checkout verificable — **pero** es un CLI del entorno del
     agente, no un servicio llamable desde la máquina pública. Uso
     viable y honesto: generar **instantáneas de catálogo curadas**
     (JSON versionado con procedencia y fecha) que el servidor de la
     máquina sirve como sirve la carta; la ficha enlaza al comercio real.
     Límite declarado: precios/disponibilidad son los de la instantánea,
     con su fecha visible; no es stock en vivo.
   - `shopify-ucp` permite cerrar la compra de los productos que traigan
     `checkout_token` — desde el entorno del agente y con aprobación de
     Lee por compra; sirve para el «acceso a compra» de la fase 5, no
     como checkout embebido anónimo en la web pública.
   - Catálogo propio de un comercio (Shopify del cliente, etc.): no hay
     ningún comercio de moda conectado hoy. **BLOQUEADO** hasta que exista
     fuente; no se inventarán productos, precios ni tiendas.
2. **Motor de try-on (el hueco).** No hay ningún modelo de generación
   conectado. La investigación de candidatos va en documento aparte; aquí
   queda fijado el **contrato de adaptador** que cualquier motor deberá
   cumplir para enchufarse sin reescribir la app:
   - Entrada: foto de la persona (ya reducida, con consentimiento),
     imagen del producto, variante elegida, categoría
     (`ropa|gafas|zapatillas|accesorios|cejas`).
   - Salida: imagen resultado + metadatos (proveedor, modelo exacto,
     latencia, coste) que se registran en el evento `generacion_ok`.
   - Ejecución SIEMPRE como trabajo asíncrono con sondeo (patrón §2),
     timeout declarado, error recuperable con «volver a intentarlo».
   - La foto y el resultado se procesan en servidor; ninguna clave en el
     navegador. Un adaptador no es «integración» hasta que una petición
     real suya devuelva una imagen verificada.
3. **Almacenamiento de resultados con retención y borrado.** Hoy los
   análisis son efímeros (trabajo en memoria, la foto muere con la
   petición) — correcto para cejas, insuficiente para «mis looks»: hace
   falta guardar SOLO el resultado y su referencia (producto/variante/
   fecha), con política escrita antes de construir: retención máxima,
   borrado a petición desde Perfil, y la foto original NO se persiste
   salvo consentimiento expreso de «perfil visual reutilizable» (y
   entonces cifrada en reposo y borrable). **CONSTRUIDO: no** — se diseña
   en la fase 3 y se construye en la 5.
4. **Analítica nueva**: los 5 eventos de §2 sobre el patrón existente +
   vista de embudo del probador (iniciadas → generadas → guardadas →
   clic de compra). Sin esto no hay «impacto medible» que enseñar.

## 5. Fases (las del encargo de Lee) — primeras tareas y su prueba

| Fase | Primeras tareas concretas | Prueba que demuestra que funciona |
|---|---|---|
| **1. Interfaz y navegación** | Home nueva según el mockup aprobado (hero, «Probar en mí», 4 accesos, tarjeta «Tu probador IA») y nav Inicio·Explorar·Probador·Perfil, reutilizando tokens/anatomía v6; Explorar y Probador abren con sus estados reales (catálogo vacío honesto hasta la fase 2; Probador lleva a la vertical Cejas, hoy funcional) | QA por CDP a 412×915 comparando contra el mockup de Lee (tabla elemento→verificado) + baterías actuales en verde: la vertical Cejas sigue reservando de principio a fin |
| **2. Catálogo y fichas** | Módulo de catálogo en el servidor (instantánea curada vía `meta_catalog_search`, con procedencia y fecha), `GET /api/catalogo` y ficha con foto/nombre/marca/precio/variantes reales + «Probar con mi foto» + guardar | Cada producto pintado se coteja 1:1 contra la salida del conector (precio, foto, vendedor); ficha sin ningún dato que no venga de la fuente; batería nueva de catálogo en verde |
| **3. Foto y consentimiento** | Flujo del Probador: consentimiento ampliado (qué se envía, a qué proveedor, retención), subida con el pipeline actual, perfil visual opt-in con borrado desde Perfil | Recorrido CDP completo: sin consentimiento no hay subida posible (verificado en red: ninguna petición sale); borrar el perfil lo elimina del dispositivo y del servidor |
| **4. Primer motor** | Implementar el adaptador del motor que elija la investigación, detrás de `/api/probar` asíncrono; categoría inicial única (la que el motor haga mejor, declarada) | **Una generación real de principio a fin**: foto autorizada + producto del catálogo → imagen resultado servida por nuestra URL, con proveedor/modelo/latencia/coste registrados. Sin esa evidencia, la fase NO está hecha |
| **5. Guardados y compra** | «Mis looks» (resultados con retención/borrado de §4.3), guardar productos, y acceso a compra: enlace verificado al comercio y, donde exista `checkout_token`, compra vía `shopify-ucp` con aprobación de Lee | Look guardado sobrevive a recargar y se borra de verdad; el clic de compra llega al comercio/checkout real del producto correcto y queda medido en el embudo |
| **6. Pruebas y documentación** | Baterías nuevas (catálogo, probador, looks) + regresión de las 3 actuales; ESTADO y README actualizados con lo probado/bloqueado | Suite completa en verde contra la máquina real + capturas 412×915 revisadas pantalla a pantalla |

## 6. Bloqueos exactos

1. **Clave de equipo de la Meta Model API — BLOQUEADO (acción de Lee).**
   Nadie la tiene: en dev.meta.ai Lee puso la tarjeta; solo él ve el
   Billing (crédito de 150 $ sin verificar) y puede crear la API key de
   equipo y guardarla en la bóveda. **Qué desbloquea, en orden**: (a)
   **Muse Image** (`muse-image-1.0`, genera Y edita imagen: es el motor
   Meta natural para la vista previa de cejas y candidato a edición para
   gafas/accesorios), (b) **SAM 3.1** (segmentación: delimitar cejas/zona
   antes de editar), (c) Spark hospedado si hiciera falta. Sin esta clave,
   el probador de cejas seguirá siendo «análisis + recomendación» sin
   imagen generada — hoy ya se dice así en pantalla, sin fingir.
2. **Motor de try-on de moda: sin proveedor ni clave.** Cualquier
   candidato (API de pago por generación) implica **gasto nuevo y alta de
   cuenta: requiere el OK expreso de Lee** antes de contratar o consumir
   créditos. En esta pasada no se ha gastado nada.
3. **Fuente de catálogo viva**: la instantánea curada (§4.1) es viable
   hoy; un catálogo en vivo exige un comercio conectado que no existe.
4. **Límites de infraestructura que el pivote hereda**: InstaBox gratuito
   se pausa a los 30 min (una visita a la URL pública lo despierta) y
   máximo 8 h encendida; Twilio trial con 100 mensajes y sin salientes
   libres; WhatsApp directo de Meta bloqueado (portfolio + bloqueo
   temporal de permisos: vars a len 0).
5. **Repo público desactualizado**: el último push es de las 17:50 del
   28/10 — todo lo posterior (PWA, mecánicas, v3–v6 y este pivote) está
   solo en local/máquina. Re-sincronizar tras la fase 1, con la auditoría
   de secretos de siempre.
