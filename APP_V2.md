# La Asistenta — App de Arianna · Rediseño v2 «salón de lujo»

**Fecha:** 2026-10-27 (noche) · **Alcance:** SOLO la cara. La lógica de datos,
los endpoints y el contrato con la API de la agenda no se han tocado
(ver «Toques en app.js» — exclusivamente cadenas y plantillas de presentación).

La v1 funcionaba pero parecía una plantilla. La v2 es una app de salón de
lujo: misma paleta exacta de Ari Vivas Beauty (marfil/arena/negro/verde
azulado/rosa/dorado), tipografía con carácter cargada **en local** y cada
pantalla —incluido el estado sin conexión— diseñada, nunca un error crudo.

---

## Qué cambió (formato de revisión de diseño)

| Before (v1) | After (v2) | Why |
| --- | --- | --- |
| Iconos de pestaña con emojis (☀️📅➕✨⚙️) | 8 iconos SVG de trazo propios (sol, calendario, +, destello, deslizadores, reloj, arco de ceja, flecha) | Los emojis como iconos rompen cualquier aspiración premium |
| Fraunces + Montserrat desde Google Fonts (red) | Variables **locales** en `www/fonts/` (Fraunces normal/itálica + Montserrat, woff2, ~187 KB en el APK) | En el móvil no hay red garantizada; la v1 caía a fuentes del sistema sin conexión |
| Títulos de vista sin jerarquía | Sobrelínea dorada con filete («TU SALÓN, DE UN VISTAZO») + Fraunces 35 px con tracking negativo | Jerarquía editorial: primero el contexto, después el título |
| Dos stats iguales en blanco | Citas en tarjeta papel y **ingresos en tarjeta verde azulado con cifra dorada** | El dinero es el dato estrella del día; el contraste lo subraya |
| Tarjetas de cita planas | Bloque de hora en degradado rosa, filete lateral degradado verde→dorado, precio en Fraunces dorado, chips suaves, entrada escalonada (50 ms) | Sombras cálidas y micro-jerarquía en cada fila |
| Servicios como tarjetas genéricas | **Carta tipo menú**: nombre Fraunces, línea de puntos hasta el precio, duración con reloj SVG | Es la carta de un salón, no una lista de ajustes |
| Horario en tarjeta blanca de texto | Panel verde azulado con filetes de puntos dorados y «Cerrado» en itálica dorada | El horario es identidad de marca, no un párrafo |
| Modal centrado genérico | **Hoja inferior** con asa, fondo desenfocado y curva de cajón iOS (0.32, 0.72, 0, 1) | Tacto nativo en Android: las confirmaciones nacen abajo |
| Sin conexión = texto crudo «No se pudo conectar…» dentro de la lista | Estado vacío **diseñado**: ornamento de ceja dorado, título Fraunces itálica, texto humano y botón «Revisar la conexión» que navega a Estado | Sin datos la app sigue entera y bonita; nunca un error técnico a la vista |
| `alert()` al fallar una cancelación; ✅/❌ en mensajes | Toast píldora verde oscuro; mensajes en lenguaje humano sin emojis | Los `alert()` y emojis son el «esto es una web» más ruidoso |
| Barra inferior opaca con emoji | Barra translúcida con blur + saturación, píldora rosa tras el icono activo, feedback de presión `scale(.88)` | Material flotante sobre el contenido, como una app instalada |
| Botones sin respuesta al tacto consistente | `scale(.97)` al pulsar (160 ms ease-out fuerte), chips y cancelar incluidos | La respuesta vive en la presión, no en la soltura |
| Nada para saltar de día en Agenda | Chips **Hoy / Mañana** que fijan la fecha y recargan | Atajo de un toque para el gesto más repetido del panel |

**Sistema de movimiento** (Emil/Apple): curvas propias
(`--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-drawer: cubic-bezier(.32,.72,0,1)`),
todo bajo 350 ms, solo `transform`/`opacity`, y `@media (prefers-reduced-motion)`
que lo reduce a fundidos. **Base móvil nativa**: sin flash al tocar,
`touch-action: manipulation` y `user-select` solo en controles,
`overscroll-behavior: none`, entradas a 16 px (sin zoom), safe-areas respetadas.

## Pantalla a pantalla

1. **Hoy** — sobrelínea + fecha capitalizada; stats asimétricas (papel/verde);
   «Reservas del día» con filete; vacío conectado = «Día despejado» con ornamento.
2. **Agenda** — selector de día dentro de tarjeta con chips Hoy/Mañana; citas
   reales con botón Cancelar en píldora fantasma roja.
3. **Nueva cita** — formulario en tarjeta elevada, etiquetas doradas en
   mayúsculas, campos marfil con anillo verde al enfocar, select con chevron
   propio y botón primario con flecha SVG.
4. **Servicios** — la carta real en formato menú con líneas de puntos y el
   horario en panel verde con dorados.
5. **Estado** — filas de estado con orbes (verde con pulso suave / dorado en
   espera), WhatsApp declarado «Pendiente del número de prueba de Meta»,
   ajustes de conexión y etiqueta de demo.

## Toques en `app.js` (solo presentación, cero lógica)

- El error de carga de citas ahora rellena el estado vacío diseñado (antes:
  `textContent` crudo). Mismos datos, mismo flujo.
- La plantilla de servicio añade la línea de puntos y el reloj SVG.
- Fuera ✅/❌ de los mensajes de guardado/conexión; el error de guardado ya no
  vuelca el mensaje técnico de red.
- `alert()` de cancelación → toast. Nuevos: `mostrarToast()` y un oyente de
  presentación para `data-goto` (botón del estado vacío) y `data-setday`
  (chips Hoy/Mañana: fijan el input de fecha existente y disparan su `change`).
- Endpoints, token, `localStorage`, orden de llamadas y contrato con la API:
  **idénticos** a la v1. `node --check` OK.

## QA visual — ejercida de verdad a 412×915 (Samsung S25)

Chromium headless 152 vía CDP sobre la app servida en local, con la **API real
encendida** (datos reales de `agenda.db`) y también **apagada** (sin conexión).
Interacciones ejercidas con clics reales y captura tras cada una: las 5
pestañas, cambio de fecha en Agenda (02/11/2026: Lucía, Marta y Elena),
chip «Mañana», apertura y cierre («Volver») del modal de cancelar,
scroll hasta el final de Estado, y el botón «Revisar la conexión» del estado
sin conexión (aterriza en Estado y su nota dice «Sin conexión con…»).
Resultado: **0 errores JS, 0 desborde horizontal** (scrollWidth = 412 = innerWidth).

Capturas finales en `~/workspace/la-asistenta/app/qa/`:

| Captura | Qué demuestra |
| --- | --- |
| [hoy.png](sandbox://workspace/la-asistenta/app/qa/hoy.png) | Hoy conectado, día sin citas: stats y vacío elegante |
| [agenda.png](sandbox://workspace/la-asistenta/app/qa/agenda.png) | Agenda 02/11 con las 3 citas reales y sus Cancelar |
| [nueva.png](sandbox://workspace/la-asistenta/app/qa/nueva.png) | Formulario completo con la carta real en el select |
| [servicios.png](sandbox://workspace/la-asistenta/app/qa/servicios.png) | Carta tipo menú + horario en panel verde |
| [estado.png](sandbox://workspace/la-asistenta/app/qa/estado.png) | Estado con agenda «Conectada» y ajustes |
| [hoy-sin-conexion.png](sandbox://workspace/la-asistenta/app/qa/hoy-sin-conexion.png) | **Sin API**: punto rojo, stats «—» y estado vacío diseñado |
| [agenda-vacia.png](sandbox://workspace/la-asistenta/app/qa/agenda-vacia.png) | Agenda mañana vía chip, vacía y elegante |
| [modal-cancelar.png](sandbox://workspace/la-asistenta/app/qa/modal-cancelar.png) | Hoja inferior de cancelar sobre fondo desenfocado |

Revisión propia, captura a captura: se corrigió en caliente que la etiqueta
«INGRESOS ESTIMADOS» saltaba a dos líneas (ahora 10 px, una línea) y se
confirmó que la etiqueta de demo de Estado se ve entera sobre la barra al
llegar al final (el corte que sugería la captura de página completa era un
artefacto del cosido de la captura, no de la app).

## APK reconstruido y verificado

- Build con la vía manual probada (`app/android-manual/build-manual.sh`),
  sustituyendo el anterior en [app/dist/la-asistenta.apk](sandbox://workspace/la-asistenta/app/dist/la-asistenta.apk).
- **214.160 bytes** (v1: 21.345; la diferencia son las tipografías locales y
  el CSS nuevo), paquete `es.arivivas.asistenta`, minSdk 26 / targetSdk 35,
  permiso INTERNET.
- Firma verificada con `apksigner`: **v2 ✅, v3 ✅** (misma clave debug de la v1).
- Contenido verificado por listado: `assets/index.html` (referencia a
  `fonts/fonts.css` local), `assets/styles.css` v2, `assets/app.js` y los
  tres woff2 (`fraunces-normal`, `fraunces-italic`, `montserrat`).

## Límites honestos

- **Sin teléfono físico**: la QA es Chromium headless a exactamente 412×915
  con la app ejercida por clics; la primera instalación en el S25 de Lee
  sigue siendo la prueba de hardware (la v1 tampoco se instaló nunca).
- Los campos de fecha/hora pintan su formato según el idioma del sistema
  (en el headless, en inglés `mm/dd/aaaa`; en el Android español de Lee,
  `dd/mm/aaaa`). Es el control nativo, no la app.
- La QA navegó por `file://` porque este Chromium 152 bloquea la navegación
  a `http://127.0.0.1` (ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS, la misma
  peculiaridad ya documentada en este sandbox); desde `file://` la app
  llamó a la API real sin problema, igual que hará el WebView con los assets.
- La app sigue necesitando que la API sea alcanzable desde el móvil para
  ver datos (pendiente ya conocido de la v1: túnel); sin ella, lo que se
  ve es exactamente el estado sin conexión capturado arriba.
