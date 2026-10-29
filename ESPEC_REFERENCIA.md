# ESPEC_REFERENCIA — La experiencia Fresha, pantalla a pantalla

**Para qué:** base de la reconstrucción de La Asistenta con QA comparativa por pantalla.
**Fecha:** 28/10/2026. **Alcance:** solo lectura — este documento no modifica ningún código.

## Método y honestidad (léelo antes de fiarte de una sola cifra)

| Etiqueta | Significado |
|---|---|
| **MEDIDA** | Sale de una captura real o del código servido (CSS/HTML/JS público de fresha.com), con el método indicado. |
| **OBSERVADA** | Vista en el recorrido web (texto renderizado de páginas reales) o en capturas oficiales de la tienda. |
| **INFERIDA** | Deducida de REA, de la ficha de la tienda o del patrón del producto; **sin recorrido directo**. No usar como si fuera medida. |

Fuentes usadas, por orden de fiabilidad:

1. **Captura real de la app en el móvil de Lee** (Samsung, app Fresha, en español) — `referencia/01-home.png`. Es la única captura píxel-real de la app. Medidas tomadas con análisis de imagen (bandas de contenido y muestreo de color), escala declarada en cada caso.
2. **Código servido por fresha.com** (descargado el 28/10 en `~/workspace/rea-sandbox/target-fresha/`): CSS del sistema de diseño (Stylex) + HTML de la home. De aquí salen tipografía, radios y colores exactos. La web y la app comparten sistema de diseño; donde aplico un token web a la app lo marco **MEDIDA (web) / INFERIDA (app)**.
3. **Capturas oficiales de Google Play** (ficha `com.fresha.Fresha`, descargadas el 28/10) — `referencia/02…07`. ⚠️ Son **renders promocionales**: el teléfono aparece reducido y con titulares de marketing encima. Sirven para orden de bloques, componentes y estados, **no** para píxeles exactos. En la misma página de Play se mezclan anuncios de OTRAS apps (Booksy, Kenjo, YesStyle…): se identificaron y **se excluyeron**; solo se usa el set verificado de Fresha (6 imágenes, en español, identidad visual coincidente).
4. **Recorrido web en texto** (sin navegador interactivo): home de fresha.com, landing de «Tinte de cejas · Madrid» con 83 establecimientos, y perfil profesional real (`/es/p/salon-beauty-glow-4253632`). La búsqueda (`/es/search`) es 100 % cliente: no devuelve contenido sin ejecutar JS.
5. **REA** (análisis estático del JS público, 3 pasadas selectivas: 29 archivos, ~440 000 nodos AST, ~750 hallazgos entre las tres; evidencia en `~/workspace/rea-sandbox/evidence-fresha-sel{,2,3}.json`). Lo estático **no** prueba comportamiento en tiempo real; los endpoints se componen dinámicamente y REA **no** los resolvió (incógnita declarada desde la primera pasada).

**Lo que falta y queda encargado** (capturas web en vivo a ~412 px — requieren el navegador del agente principal; este análisis no opera navegadores): ver la lista exacta en §8. Hasta que existan, las pantallas web de reserva se especifican desde la app + REA y van marcadas INFERIDA donde toca.

---

## 1. Tokens globales

### 1.1 Color — MEDIDA (CSS servido, frecuencia entre paréntesis)

| Token | Valor | Uso observado |
|---|---|---|
| Primario (marca) | `#6950f3` (17×, el hex más frecuente del CSS) | Pin de ubicación, pestaña activa, chip «Confirmada», día seleccionado, insignias |
| Primario en captura real | ≈ `#6550e9` (muestreo de píxeles en `01-home.png`; la compresión JPEG desplaza el tono) | El mismo primario, renderizado en el S25 de Lee |
| Primario oscuro | `#403591` (10×) | Variante profunda del violeta (estados/fondos de énfasis) — INFERIDA su asignación exacta |
| Texto principal | `#0d0d0d` (medido en captura: es el negro de botones y texto) · `#262626`, `#131313`, `#404040` en CSS | Texto y **botones primarios negros** |
| Texto secundario | `#747a8d` (variable `--ejjwht` del CSS) · `#a4adba`, `#bfbfbf` | Subtítulos, iconos inactivos, placeholders |
| Borde | `#dee3e7` (15×) | Bordes de tarjetas, buscador, filas |
| Superficie suave | `#f2f2f2` (CSS) · `#f5f5f5` (medido: fondo de las pastillas de categoría) | Pastillas, fondos de sección |
| Positivo | `#1f8900` | Descuentos («10 % de descuento», «Ahorra un 30 %»), chip «Ofertas» sobre fondo claro |
| Peligro | `#bb1232` · Aviso `#b7570b` · Enlace/info `#2d76ec` | Estados semánticos |
| Fondo de pantalla | Blanco `#ffffff` | Fondo dominante en app y web |

Regla que se deduce y se confirma en todas las capturas: **el botón que convierte es NEGRO** («Buscar», «Reservar ahora»); el violeta es acento de marca y de estado (activo/seleccionado), no el CTA principal.

### 1.2 Tipografía — MEDIDA (CSS servido)

- Familia: `--font-body: Roobert, AktivGroteskVF, sans-serif` (Roobert es la fuente propietaria de Fresha); `--font-header` = la misma; `--font-display: Tartuffo / PlayfairDisplay, serif` solo para titulares de marketing (las capturas de Play mezclan titular sans + palabra en serif itálica).
- Escala `textStyle` (tamaño/interlineado, pesos 400/500/600/700):

| Token | px | Uso típico |
|---|---|---|
| body.2xs | 11/12 | microcopy, insignias |
| body.xs | 13/16 | etiquetas de pastilla, captions |
| body.s | 14/20 | secundario, filas de datos |
| body.m | 16/22 | cuerpo y campos (≥16 px ⇒ iOS no hace zoom) |
| body.ml | 22/28 | destacados suaves |
| body.l | 24/32 | precios/titulares de tarjeta |
| header.2xs | 16/22 semibold | nombre en tarjetas |
| header.xs | 19/24 semibold | subtítulos de pantalla |
| header.s | 22/28 semibold | títulos de sección («Recomendado», «Servicios») |
| header.m | 24/32 semibold | título de pantalla («Seleccionar hora») |
| header.l | 28/36 semibold | nombre del salón |
| header.lm / xl / 2xl / 3xl | 34/40 · 40/44 · 48/52 · 64/80 | marketing |
| subheader.2xs | 11 px, 600, tracking +0,08 em | etiquetas en mayúsculas |

Letter-spacing: −0,1 px en body, −0,2 px en header. **MEDIDA (web) / INFERIDA (app)** en la asignación por pantalla; los tamaños relativos sí se confirman en las capturas.

### 1.3 Radios, espaciado, sombras — MEDIDA (CSS) + MEDIDA (captura)

- **Radios:** escala cerrada `0 · 2 · 4 · 8 · 12 · 16 · 999`. En la app: tarjetas de foto 16, pastillas de categoría ≈16, buscador 16, botones negros 999 (píldora) en «Buscar»/«Reservar ahora», hoja inferior ≈24 en la parte superior (OBSERVADA en `06-cita-gestion.png`).
- **Espaciado:** rejilla de carruseles web con hueco de **24 px** (`--item-width-large: calc((100% − 24px·n)/(n+1))`, MEDIDA). En app, margen lateral de contenido ≈ 5 % del ancho (≈20 dp a 412 px, MEDIDA en captura de Lee) y huecos de rejilla de ≈12–16 dp (MEDIDA aproximada en captura).
- **Sombras:** muy suaves y escasas; la elevación se resuelve con borde `#dee3e7` y fondos `#f5f5f5`, no con sombra (OBSERVADA en todas las capturas; el CSS confirma `box-shadow: none` como valor más frecuente).
- **Objetivos táctiles:** pastillas ≈88×80 dp, filas de hora ≥48 dp, botones primarios ≈56 dp de alto (MEDIDA aproximada en captura de Lee, ver §2.1).

### 1.4 Navegación inferior (app) — MEDIDA (captura de Lee)

4 pestañas con icono + etiqueta: **Inicio · Buscar · Historial · Perfil**. Activa: icono **relleno en violeta** + etiqueta violeta. Inactivas: icono de línea gris. Altura total ≈ 7–8 % de la pantalla (≈64 dp con área segura). La web no tiene esta barra: en web la navegación es superior (cabecera con buscador) — INFERIDA su equivalencia exacta.

---

## 2. Pantallas

### P1 · Home / Descubrir (app)

**Propósito:** entrar por ubicación + búsqueda y descubrir por categorías y recomendados.
**Evidencia:** `01-home.png` (MEDIDA, real) + `02-descubrir.png` (OBSERVADA, promo «Descubrir»).

Orden exacto de bloques (porcentajes = posición vertical medida en `01-home.png`, pantalla de 2048 px de alto; dp aproximados a viewport 412×915):

1. **Fila de ubicación** (≈11–16 % del alto): pin violeta ≈24 dp + «Ubicación actual» en body.m semibold + chevron de despliegue. Sin caja: texto directo sobre blanco.
2. **Buscador píldora** (≈22–31 %; ≈80 dp de alto total): contenedor único con borde, radio 16, dentro: lupa + placeholder en **dos líneas** («Buscar todos los / tratamientos») a la izquierda y **botón negro «Buscar»** (píldora, ≈56 dp de alto, ≈25 % del ancho) a la derecha, dentro del mismo contenedor. En la variante «Descubrir» (promo) el buscador se parte en **dos campos apilados** («Tratamiento o establecimiento», «Ubicación actual») con el botón negro a ancho completo debajo — dos presentaciones del mismo bloque según contexto (OBSERVADA).
3. **Rejilla de categorías 4 columnas × 2 filas** (iconos ≈38–52 %; etiquetas hasta ≈61 %): pastilla cuadrada ≈88 dp, fondo `#f5f5f5`, radio ≈16, icono de línea negro ≈28 dp centrado; etiqueta debajo en dos líneas, body.xs, centrada. En Lee: Todo · Cabello y peinado · Salones de uñas · Cejas y pestañas / Maquillaje · Tatuajes y piercings · Terapia médica · Odontología. En la promo «Descubrir» las categorías son **tarjetas con foto** («Populares cerca de ti»: Peluquerías, Barberías, Cejas, Masaje) — la app usa foto en Descubrir e icono en la home de Lee: **ambas variantes existen** (OBSERVADA; cuál se sirve depende de contexto/experimento — INFERIDA la regla).
4. **«Recomendado»** (título ≈64 %, header.s): carrusel horizontal de tarjetas de salón con foto grande (la tarjeta ocupa ≈80 % del ancho; foto ≈16:10), insignia flotante sobre la foto («⭐ Highly Recommended», «🏆 Best…» — pastilla blanca esquina superior izquierda) y nombre/valoración bajo la foto.
5. **Barra de navegación inferior** (§1.4), fija.

**Interacciones:** la fila de ubicación abre el selector de ubicación (hoja/pantalla — INFERIDA); el carrusel se desliza en horizontal con la siguiente tarjeta asomando (OBSERVADA en captura: la segunda tarjeta se corta a la derecha, invitando al swipe).

**Mapeo a La Asistenta:** nuestra `p-inicio` (v3) cubre ubicación→saludo del salón, buscador píldora con botón negro (el nuestro filtra la carta en vivo), rejilla 4×2 de pastillas propias y «Recomendado» con la tarjeta del salón. **Falta exactamente:** (a) el buscador de Fresha es de **dos campos** (tratamiento + ubicación) y lleva a resultados; el nuestro es un filtro local de un solo campo — equivalente aceptado para un solo salón, diferencia declarada; (b) insignias de recomendación — **no aplican** (serían datos inventados sin reseñas reales); (c) la variante de categorías con foto no está implementada (tenemos iconos Lucide, que era la otra variante real de Fresha). **Estado: PARCIAL (adaptación de un solo salón, estructura coincidente).**

### P2 · Buscar (pantalla completa)

**Propósito:** buscar por tratamiento/establecimiento + ubicación con sugerencias.
**Evidencia:** pestaña «Buscar» (MEDIDA su existencia) + promo `02-descubrir.png` (el bloque de dos campos). El interior completo de la pestaña no está en ninguna captura oficial: **INFERIDA** su composición (campo de texto con autocompletado de tratamientos y establecimientos, historial/recientes, categorías populares).

**Mapeo:** nuestra nav «Buscar» sube al inicio y enfoca el buscador-filtro. **Falta:** autocompletado y pantalla propia. Para un solo salón el equivalente funcional es el filtro en vivo; la pantalla dedicada **no aplica** a nuestro alcance. **Estado: PARCIAL por diseño.**

### P3 · Resultados (lista + mapa)

**Propósito:** resultados de una búsqueda con filtros y mapa.
**Evidencia:** `03-resultados-mapa.png` (OBSERVADA, promo): mapa superior con pines de precio/establecimiento y buscador flotante («Masaje · Ubicación actual» + botón de lista/mapa), fila de **chips de filtro** («Ordenar», «Precio máx.», «Tipo de…») con chevron, contador «Más de 1000 establecimientos cerca de ti», y tarjetas de resultado: foto a ancho completo (radio 16), nombre (header.2xs), fila de valoración (estrella + nota + n.º de reseñas), distancia a la derecha («1 km»). La navegación inferior persiste con **Buscar activa en violeta**.

**Mapeo:** **NO APLICA** — es marketplace multi-salón; con un solo salón no hay lista de resultados. Su equivalente conceptual es nuestra tarjeta del salón en «Recomendado». **Estado: NO APLICA.**

### P4 · Página de salón

**Propósito:** ficha completa del establecimiento: convencer y llevar a reservar.
**Evidencia:** `04-salon.png` (OBSERVADA, promo — la más rica de la ficha) + perfil profesional web real `/es/p/salon-beauty-glow-4253632` (OBSERVADA en texto) + ruta REA `/a/[locationSlug]` y `/a/[locationSlug]/all-offer` (INFERIDA la forma exacta de la URL de local).

Orden de bloques (promo, teléfono reducido — proporciones, no píxeles):

1. **Foto hero** a todo el ancho (≈35–40 % del alto visible), con dos botones flotantes circulares blancos arriba: atrás (izquierda) y compartir + corazón (derecha).
2. **Nombre** (header.l) y debajo **valoración**: «5.0» + 5 estrellas naranjas + «(734)».
3. **Distancia · ciudad** en violeta, como enlace («2,0 km • Madrid»); debajo «Abierto hasta las 20:00» en texto secundario.
4. **Chip «Ofertas»** (pastilla verde claro, texto verde) si el salón tiene ofertas.
5. **«Servicios»** (header.s) con **chips de categoría** en fila desplazable: el activo es negro con texto blanco («Destacado»), el resto con borde («Corte y peinado», «Tinte»).
6. **Filas de servicio:** nombre (body.m medium), debajo duración (body.s secundario, «1h 30 min»), a la derecha precio («desde €60») con posible tachado + «Ahorra un 30 %» en verde, y **botón circular «+»** con borde para añadir. Cada fila es seleccionable; se pueden añadir varios servicios.
7. **Barra inferior fija:** a la izquierda «21 servicios disponibles» (body.s) y a la derecha **botón negro «Reservar ahora»** (píldora). Es el CTA persistente de toda la ficha.
8. Más abajo (web, OBSERVADA en el perfil real): equipo/profesionales con contadores («Citas completadas», «Clientes atendidos»), resumen de reseñas «Resumido con IA», **reseñas individuales** (nombre, estrellas, texto, «Hoy • Corte Señora» = fecha + servicio), dirección con «Cómo llegar», «Miembro desde…».

**Interacciones:** chips filtran la lista sin recargar; el «+» añade el servicio a la selección y la barra inferior refleja el estado; «Reservar ahora» entra en el flujo (P5→P8).

**Mapeo:** nuestra `p-salon` tiene foto cabecera, nombre, chips de hechos (horario, n.º de servicios), filas de servicio con botón «Reservar» y contacto WhatsApp. **Falta exactamente:** (a) **selección múltiple** de servicios con barra de total — la nuestra reserva de uno en uno (su «Reservar» por fila entra directo); (b) chips de categoría que filtren (solo tenemos 4 servicios: ganancia marginal, pero el patrón no está); (c) reseñas y valoración — **no hay datos reales públicos integrados** (pendiente de la URL de reseñas de Arianna; no se inventan); (d) equipo — no aplica (una sola profesional, Arianna, aunque la ficha podría decirlo); (e) galería de varias fotos — tenemos las reales del salón ya integradas en v3.x. **Estado: PARCIAL.**

### P5 · Reserva, paso 1 — Servicios (selección)

**Propósito:** confirmar/ajustar los servicios elegidos antes de hora y equipo.
**Evidencia:** continuidad de P4 (la selección nace en la ficha, OBSERVADA) + descripción oficial de Play («programa citas directamente en el calendario del establecimiento»). La pantalla dedicada de «tu selección» dentro del flujo no aparece en capturas: **INFERIDA** (lista de seleccionados con quitar/añadir más, total y duración sumados, botón continuar).

**Mapeo:** nuestro paso 1 de `p-reserva` (elegir servicio de la carta, uno). **Falta:** multi-selección y total acumulado (ver P4-a). **Estado: PARCIAL.**

### P6 · Reserva, paso 2 — Equipo

**Propósito:** elegir profesional o «Cualquiera».
**Evidencia:** `05-equipo.png` (OBSERVADA, promo): título «Seleccionar un miembro del equipo» (header.m), **rejilla 2 columnas** de tarjetas: avatar circular grande con foto sobre fondo de color suave, insignia de valoración bajo el avatar («4.9 ★» en pastilla), nombre (header.2xs), rol en secundario («Masajista sénior»), «desde €90». La opción «Cualquiera» encabeza la rejilla en el flujo de fecha/hora (OBSERVADA en material de la tienda).

**Mapeo:** **NO APLICA** en la práctica — Ari Vivas Beauty tiene una profesional; el equivalente honesto es no pedirlo (la cita es con Arianna). Si el salón crece, esta pantalla es la referencia. **Estado: NO APLICA (documentado).**

### P7 · Reserva, paso 3 — Fecha y hora

**Propósito:** elegir día y hora real disponible.
**Evidencia:** `07-seleccionar-hora.png` (OBSERVADA, promo): título «Seleccionar hora» (header.m), nombre del mes («Enero», body.s secundario), **tira horizontal de días**: círculos con número y letra del día debajo (Lun, Mar, Mié…); el seleccionado es **círculo relleno violeta** con número blanco; algunos días llevan **punto/insignia verde** de descuento. Debajo, **lista vertical de horas** a ancho completo: cada fila con la hora (body.m), si hay oferta «10 % de descuento» en verde + precio tachado «€80» y precio final «€72», y **radio circular a la derecha** (el seleccionado se rellena). No es una rejilla de píldoras: es una **lista con radios**.

**Mapeo:** nuestro paso 2 de `p-reserva`: tira horizontal de **14 días** + **píldoras** de hora con «Ver más horarios». **Diferencias exactas:** (a) Fresha muestra el **mes con calendario/tira larga** y nosotros 14 días cerrados; (b) Fresha usa **lista + radio**, nosotros píldoras en rejilla (patrón válido pero distinto: es EL rasgo a decidir en la reconstrucción); (c) Fresha marca descuentos por franja — **no aplica** (sin política de descuentos del salón); (d) ambos consultan disponibilidad real antes de ofrecer (el nuestro lo hace contra agenda.db; el estado de Fresha vive en servidor — REA). **Estado: PARCIAL (función cubierta, patrón visual distinto en la hora).**

### P8 · Reserva, paso 4 — Datos y revisión (pre-confirmar)

**Propósito:** recoger datos del cliente y mostrar el objeto cerrado antes de confirmar.
**Evidencia:** **INFERIDA** — ninguna captura oficial la muestra y exige avanzar en un flujo real (ver §8). Patrón del producto según la ficha de Play («Paga después de reservar tu cita desde la aplicación», «confirmación al instante») y la mecánica destilada por REA: se confirma **un objeto cerrado** (servicios, profesional, fecha, hora, precio total) y el estado vive en el servidor y en la URL, no en el navegador. Composición esperada: resumen de la cita (salón, servicios, profesional, fecha/hora, total), formulario de datos (nombre, teléfono, email), notas para el establecimiento, política de cancelación, y botón de confirmación («Confirmar reserva» / pago si aplica depósito).

**Mapeo:** nuestro paso 3 de `p-reserva`: tarjeta «Tu cita» con el objeto completo (servicio, fecha, hora, precio) + nombre y teléfono; el código AS-XXXX nace al confirmar (no puede mostrarse antes — divergencia conocida y documentada). **Falta:** email, notas estructuradas (el mini-formulario prep vive en la página de la cita, después), política de cancelación visible. **Estado: PARCIAL.**

### P9 · Confirmación y gestión de la cita

**Propósito:** confirmar al instante y dar autogestión posterior.
**Evidencia:** `06-cita-gestion.png` (OBSERVADA, promo): **hoja inferior** (radio superior ≈24, sobre fondo atenuado) con foto del establecimiento de cabecera y **botón X circular blanco** arriba a la derecha; chip violeta «📅 Confirmada»; fecha y hora en header.s («Mar. 3 abr. a las 12:30») con la duración debajo en secundario («1h 15 min de duración»); **filas de acción** con icono violeta suave a la izquierda, título y subtítulo, chevron a la derecha: «Cómo llegar» (dirección), «Añadir al calendario» («Configurar un recordatorio»), **«Gestionar cita» («Reprograma o cancela tu cita»)**, «Información del establecimiento»; y **«Resumen»**: líneas servicio → precio («Corte de pelo largo — €50»).

**Mapeo:** nuestra `p-confirmada` (check, código AS-XXXX, enlace mágico, «Ver mi cita») + la página `/cita/<token>` (ver, cancelar, reagendar a huecos reales, mini-formulario prep). **Equivalencia:** su «Gestionar cita» = nuestra página del enlace mágico; su chip «Confirmada» = nuestro estado verificado releyendo la agenda. **Falta:** (a) «Añadir al calendario» (fichero .ics) — no lo tenemos; (b) «Cómo llegar» — no hay dirección verificada del salón que mostrar; (c) la presentación como hoja inferior con foto — la nuestra es pantalla completa. **Estado: PARCIAL (autogestión cubierta por otra vía).**

### P10 · Historial (Mis citas) y Perfil

**Propósito:** Historial = todas las citas del usuario (próximas y pasadas) contra su cuenta; Perfil = identidad y ajustes.
**Evidencia:** las pestañas existen (MEDIDA en `01-home.png`). El contenido **no** está en capturas oficiales accesibles y exige cuenta: **INFERIDA** su composición (lista de próximas citas con tarjeta por cita que abre la hoja de P9; pasadas con «Reservar de nuevo» — botón observado en material promocional de terceros, no verificado en la ficha propia, así que ni eso se afirma).

**Mapeo:** nuestro «Mi cita» (nav) muestra **solo la reserva hecha desde este dispositivo** (localStorage) + el acceso por enlace mágico; es el sustituto deliberado de la cuenta. **Falta estructural:** historial completo entre dispositivos (exigiría cuentas — fuera del alcance aprobado: sin registro). **Estado: PARCIAL por diseño, con la divergencia declarada.**

### Extra · Análisis de cejas con IA (solo La Asistenta)

No existe en Fresha: es nuestro diferenciador (consentimiento → foto → análisis Spark → recomendación → reserva). En la reconstrucción se mantiene como pastilla/pantalla propia sin tocar los patrones anteriores. **Estado: EXTRA (no mapea).**

---

## 3. Mecánicas — qué dice la evidencia REA (3 pasadas)

Ya integradas en el producto (ver ESTADO_PROYECTO.md); aquí solo su respaldo documental:

| Mecánica | Respaldo | Etiqueta |
|---|---|---|
| Estado de la reserva en servidor y URL, no en el navegador | Estructura de rutas `/a/[locationSlug]`, `/a/[locationSlug]/all-offer` (sel3); storage local solo para sesión/preferencias (30 nodos storage en sel1: get/set/remove de local/session) | INFERIDA (REA) |
| Autogestión post-reserva (reprogramar/cancelar) | Pantalla de gestión de cita en la ficha oficial (`06-cita-gestion.png`) | OBSERVADA |
| Confirmación sobre objeto cerrado | Patrón de flujo P4→P8 + resumen fijo en la hoja de cita | OBSERVADA/INFERIDA |
| Analítica de embudo (impresión de hueco → clic → reserva) | Nodos de analytics en el bundle (`ANALYTICS_API_URL/analytics`, proveedores GA4/Ads/Pixel diferidos, sel1+sel3) | INFERIDA (REA) |
| Endpoints de API concretos | **No resueltos**: se componen dinámicamente; REA los declara desconocidos (49+183 nodos `unknown` entre pasadas) | DESCONOCIDO declarado |

Pasadas REA: sel (12 archivos, 130 236 nodos, 210 hallazgos) + sel2 (7 archivos) + **sel3 nueva, hecha para esta espec** (10 archivos, 169 965 nodos, 249 hallazgos, 581 nodos de grafo: 16 endpoint, 13 storage) → **29 archivos analizados en profundidad de los 187 JS del bundle**; el resto es en su mayoría utilidades y el chunk gigante de librerías — subir esa cobertura no cambia ninguna pantalla de esta espec.

---

## 4. Tabla resumen de cobertura

| # | Pantalla Fresha | Nuestra pantalla | Estado |
|---|---|---|---|
| P1 | Home / Descubrir | `p-inicio` | PARCIAL — estructura espejo, buscador de 1 campo |
| P2 | Buscar | nav Buscar → filtro en inicio | PARCIAL por diseño |
| P3 | Resultados + mapa | — | NO APLICA (multi-salón) |
| P4 | Página de salón | `p-salon` | PARCIAL — falta multi-selección con total, reseñas reales |
| P5 | Reserva · servicios | `p-reserva` paso 1 | PARCIAL — un servicio, sin total acumulado |
| P6 | Reserva · equipo | — | NO APLICA (una profesional) |
| P7 | Reserva · fecha y hora | `p-reserva` paso 2 | PARCIAL — tira de 14 días y píldoras vs mes y lista con radios |
| P8 | Reserva · datos y revisión | `p-reserva` paso 3 | PARCIAL — falta email/notas/política en el paso |
| P9 | Confirmación / gestión | `p-confirmada` + `/cita/<token>` | PARCIAL — falta .ics y hoja inferior |
| P10 | Historial / Perfil | `p-micita` | PARCIAL por diseño — local, sin cuenta |
| — | (no existe) | Análisis IA | EXTRA nuestro |

Ninguna pantalla está «cubierta» al 100 % en sentido espejo: las diferencias están enumeradas una a una en §2. Eso es lo que la reconstrucción debe cerrar o aceptar por escrito, pantalla a pantalla.

---

## 5. Lista de cotejo para la QA de la reconstrucción

Para cada pantalla: rasgos **medibles** que deben coincidir (sí/no con captura a 412×915 al lado de la referencia).

**Global (todas):** □ fondo blanco y botones de conversión negros píldora · □ violeta solo como acento/estado (`#6950f3` ± tolerancia de render) · □ body ≥16 px en campos, etiquetas 13 px, títulos de sección 22 px semibold · □ radios: tarjetas 16, botones 999, hoja 24 sup. · □ sin sombras duras: borde `#dee3e7` o fondo `#f5f5f5`.

**P1 Inicio:** □ fila superior pin+nombre con chevron, sin caja · □ buscador en un contenedor con botón negro dentro, radio 16 · □ rejilla 4×2 de pastillas ≈88 dp, fondo `#f5f5f5`, etiqueta 13 px en ≤2 líneas · □ «Recomendado» en header.s con tarjeta que asoma la siguiente al borde · □ nav inferior de 4 con activa rellena en violeta.
**P4 Salón:** □ foto hero con flotantes circulares (atrás / acción) · □ nombre 28 px + fila de estado bajo el nombre · □ chips de categoría con activo negro · □ filas de servicio: nombre/duración/precio alineados y acción a la derecha · □ barra inferior fija con contador/total + CTA negro siempre visible.
**P7 Fecha y hora:** □ mes visible y tira de días con seleccionado = círculo relleno violeta y número blanco · □ horas en lista (o decisión escrita de mantener píldoras con su porqué) · □ ningún hueco ofrecido que no sea real (cruce con agenda) · □ «ver más» no esconde huecos sin contador.
**P8 Revisión:** □ objeto cerrado completo visible antes de confirmar (servicio, profesional, fecha, hora, precio) en una sola tarjeta · □ el «sí» no es ambiguo: un solo botón de confirmar con el total · □ política/aviso visible antes de confirmar.
**P9 Confirmación/gestión:** □ estado «Confirmada» en chip violeta tras verificar en servidor · □ acciones de gestión (cancelar/reagendar) a ≤2 toques desde la confirmación · □ resumen con precio por línea · □ la cita se recupera sin login (enlace) y consta en «Mi cita» del dispositivo.

---

## 6. Capturas web pendientes (encargo exacto para el navegador)

Este análisis no opera navegadores; estas capturas a **viewport 412×915** cierran la espec. Como invitado, sin registro y **deteniéndose antes de confirmar/pagar** ninguna reserva real:

1. `referencia/10-web-home.png` — https://www.fresha.com/es (home web móvil).
2. `referencia/11-web-listado.png` — la landing ya recorrida en texto: https://www.fresha.com/lp/es/tt/tinte-de-cejas/es-madrid/salvador (tarjetas de establecimiento).
3. `referencia/12-web-salon.png` — desde el listado, la ficha de un salón de cejas de Madrid (ruta `/es/a/…`).
4. `referencia/13-web-reserva-servicios.png` y `14-web-reserva-hora.png` — «Reservar ahora» en esa ficha, dos primeros pasos.
5. `referencia/15-web-reserva-revision.png` — paso de datos/revisión, **sin confirmar**.
6. Si la web pide cuenta para avanzar, capturar el muro de login como `16-web-muro-login.png` y parar: esa pantalla también es espec.

Con esas seis, P4/P5/P7/P8 web pasan de INFERIDA a MEDIDA y la QA comparativa puede ser píxel a píxel en web además de en app.

---

*Fuentes en disco: `referencia/01-home.png` (real, Lee) · `02-descubrir.png`, `03-resultados-mapa.png`, `04-salon.png`, `05-equipo.png`, `06-cita-gestion.png`, `07-seleccionar-hora.png` (oficiales de Play, renders promo) · CSS/HTML en `~/workspace/rea-sandbox/target-fresha/` · evidencia REA `~/workspace/rea-sandbox/evidence-fresha-sel{,2,3}.json`.*

### Resultado de las capturas web (28/10, sesión principal, CDP 412×915 en la máquina)

Ejecutado el encargo de esta sección con Chromium real sobre la máquina (script `referencia/captura_fresha.mjs`), como invitado y sin confirmar nada. Capturas en la máquina, `/data/la-asistenta/referencia-web/`:

- `10-web-home.png` · `11-web-listado.png` · `12-web-salon.png` — home, landing de Madrid y ficha de salón (Dessential Beauty), capturadas.
- `13-web-reserva-servicios.png` — el botón «Reservar» de la ficha abre `/booking` con un servicio ya en el carrito (`offerItems=sv:…`): la selección múltiple con total de P4/P5 se observa en vivo en web.
- `14-web-reserva-hora.png` — paso de fecha/hora alcanzado tras «Continuar».
- **15 (revisión): NO capturada.** El flujo no avanzó desde el paso de hora con los clics programados (selección de profesional/hueco con otro patrón de interacción) y no se forzó: forzar clics a ciegas podía crear una reserva real en un salón ajeno. El fichero gemelo que produjo el intento quedó renombrado `15-dup-hora-sin-avanzar.png` para que no conste como revisión. Sin muro de login hasta el paso de hora (16 no aplica por ahora).

Con esto, P4/P5/P7 en web suben de INFERIDA a OBSERVADA; P8 (revisión) sigue INFERIDA desde app+REA.
