# DIAGNÓSTICO UX · MUSA — La Asistenta (Fase 1: inspección)

**Fecha:** 29/10/2026 · **Alcance:** solo lectura. No se ha modificado ni un archivo de la app.
**Método:** recorrido real con Chromium contra la máquina viva (InstaBox `la-asistenta`, web en 8090) a 412×915 — 33 capturas en `~/workspace/la-asistenta/musa-diag/` + `metricas.json` (tamaños táctiles y anchos de scroll medidos en el DOM) —, análisis de cejas REAL ejecutado con la foto de ejemplo (resultado en 12,1 s), auditoría de código sobre `web/index.html`, `web/cita.html`, `web/profesional.html` y `web/web_server.py`, y contrastes calculados con la fórmula WCAG 2.x. Todo hallazgo lleva su evidencia: captura, medida o cita literal.

**Límites declarados:** (1) «Mi cita» en estado vacío no se capturó en imagen: el perfil de navegador reutilizado contenía la cita de prueba de QA20 (AS-AANX); el estado vacío se verificó por código («Aquí verás tu cita…»). La captura 16 muestra el estado CON cita, que es correcto y claro. (2) El área profesional se inspeccionó con el día real de hoy, cargado de citas de QA ya cerradas (43 registros): ese día «sucio» es precisamente lo que demuestra el defecto D2. (3) Sin pruebas con usuarias reales: esto es inspección experta con evidencia, no validación con personas.

**Lo que está bien se declara «CONSERVAR» al final. Fresha se usa como referencia de facilidad, no como plantilla: ninguna propuesta copia su interfaz; se corrige lo medido.**

---

## (1) Las 5 deficiencias de UX más importantes, por impacto

### D1 · La recomendación de la IA se presenta como veredicto, no como orientación — y la nota honesta habla de otra cosa
**Pantalla:** Resultado del análisis. **Evidencia:** capturas `12-resultado.jpg` y `12b-resultado-reco.jpg`.
- La etiqueta «RECOMENDACIÓN» y el precio van en **verde** (`--positivo`): en el sistema de referencia ese color significa *oferta/descuento*. Aquí no hay descuento: hay un precio normal pintado como ganga.
- Los chips del análisis meten **frases completas del modelo dentro de píldoras**: «Forma: Recta con arco suave poco marcado y ligeramente ascendente», «Huecos: Sin huecos visibles, cobertura uniforme en todo el recorrido». El componente chip se rompe y el lenguaje es el del modelo, no el de una clienta.
- La única nota de honestidad de la pantalla (código, `web_server.py`) dice: *«Análisis real con Muse Spark. La propuesta visual generada (ver tus cejas con el servicio aplicado) aún no está disponible: no mostramos imágenes falsas. (Análisis real en 10.62 s con Muse Spark.)»*. Habla de la imagen que falta, **no de que la recomendación sea una orientación**; nombra la tecnología **dos veces** y presume el tiempo con **centésimas de segundo**, como una métrica de depuración.
- En **ningún texto** de la app consta que Arianna confirma el servicio en persona. El `PROMPT_SISTEMA` del servidor tampoco lo instruye: pide «2-3 frases cálidas» y un JSON. La tarjeta que abre el embudo en Inicio promete sin matiz: *«la IA analiza tus cejas y te recomienda el servicio que mejor encaja»*.
**Impacto:** es el momento diferencial del producto y el de mayor riesgo de confianza: una clienta puede tomar la salida del modelo como un diagnóstico cerrado. Si el servicio recomendado no encaja al llegar al salón, el golpe es para la reputación de Arianna, no para la app.

### D2 · El área profesional no sirve para abrir el día: el titular cuenta canceladas y las canceladas ahogan la señal
**Pantallas:** Profesional · Hoy y Agenda. **Evidencia:** capturas `20-prof-hoy.jpg` y `21-prof-agenda.jpg`, medidas hoy 29/10.
- El resumen de Hoy anuncia **«43 citas hoy»** con **«0 por atender»** y **«2 cumplidas»**: el titular cuenta también las **41 canceladas**. El número que Arianna lee al abrir es falso a efectos de trabajo.
- Las citas canceladas se listan **con el mismo peso visual** que las vivas (misma tarjeta, mismo nombre en negrita; solo cambia un chip rosa «Cancelada») y **mezcladas por hora** en Hoy; en Agenda ocupan fila tras fila (16 filas seguidas de canceladas a las 10:00 en la captura) por encima de los huecos libres, que son la otra mitad de su trabajo.
- En «Mi negocio» (captura `23-prof-negocio.jpg`), lo primero es «Tu embudo»: **7 contadores acumulados de igual peso, sin periodo** (el subtítulo sí lo declara: «desde el primer día»), cuyas cifras ni siquiera reconcilian entre sí a ojo (357 confirmadas frente a 317 canceladas + 36 cumplidas + 22 no vinieron). Lo operativo —servicios y horarios— queda debajo. Y las cuatro vistas comparten **el mismo título de página** («Hoy en tu salón») cambie o no la pestaña.
**Impacto:** es la pantalla de la jornada de la única profesional real del piloto. Si abrir el día exige filtrar mentalmente decenas de filas muertas, la herramienta se abandona en silencio.

### D3 · No hay sistema visual cerrado: conviven dos voces de titular, >20 tamaños y tokens triplicados que ya divergen
**Evidencia:** auditoría de CSS sobre los tres ficheros (conteos reales).
- **Tipografía sin escala:** en `index.html` conviven más de 20 tamaños distintos, con fraccionarios por todas partes (13,5 px ×14 apariciones, 13 ×14, 12,5 ×8, 11 ×6, 15,5, 16,5, 14,5, 11,5…). La jerarquía se fabrica con peso: **800 se usa 24 veces**; hay 10 alturas de línea distintas. La referencia medida (ESPEC) trabajaba con escala cerrada.
- **Dos voces de titular según la pantalla:** `#p-inicio .seccion-titulo` es Montserrat 22/800, pero la clase base —Explorar, Probador, pasos de reserva, Perfil, Salón— es **Fraunces serif 25/600**; las tarjetas de servicio son Fraunces 23 en Explorar y Montserrat 19/700 en Inicio; «Hoy en tu salón» y «Tu cita, siempre a mano» también son serif. Lee rechazó el serif editorial como portada por «app de tienda barata»; el serif sigue mandando en todas las demás pantallas.
- **Tokens copiados, no compartidos:** el mismo `:root` está pegado en `index.html`, `cita.html` y `profesional.html` y **ya ha divergido**: `--sombra` vale `0 1px 3px rgba(13,13,13,.05)` en la app de la clienta y `0 10px 30px rgba(13,13,13,.08)` en el área profesional.
- **Radios sueltos:** junto al token `--radio:20px` aparecen 999, 24, 18, 16, 14, 13, 12, 10, 8… sin escala.
- **Botones: 8 variantes** (`.btn`, `-primario`, `-verde`, `-lavanda`, `-fantasma`, `-peq`, `-texto`, `.btn-videos`, `.btn-guardar`) y nombres que mienten: `.btn-lavanda` pinta **blanco con borde**, no lavanda. El verde tiene **tres semánticas distintas**: precio/«RECOMENDACIÓN» en el resultado, botón de WhatsApp en Perfil (captura `15-perfil.jpg`: es el elemento más chillón de su pantalla) y acción principal de reagendar en `cita.html`.
**Impacto:** es la raíz de la sensación «barata» que Lee ha rechazado dos veces: sin escala ni voz única, cada pantalla parece de una app distinta y cada mejora futura hereda el desorden.

### D4 · El texto de apoyo —el que más se lee— no llega al contraste mínimo
**Evidencia:** contrastes calculados (WCAG) sobre los pares reales.
| Par | Uso | Ratio | AA texto normal (4,5:1) |
|---|---|---|---|
| `#747a8d` sobre blanco | `.mini`, `.seccion-sub`, `.fs-meta`, etiquetas de campo: los textos pequeños de TODAS las pantallas | **4,28:1** | ✗ suspende |
| `#a4adba` sobre blanco | placeholder del buscador («Buscar todos los servicios»): la única etiqueta del buscador | **2,27:1** | ✗ |
| `#bfbfbf` sobre blanco | días deshabilitados del calendario | **1,84:1** | ✗ casi invisibles |
| `#1f8900` sobre `#EDF6EB` | chip «Disponible ahora» a 11,5 px | **4,09:1** | ✗ |
| `#6950f3` sobre blanco / negro sobre `#f5f5f5` / error `#bb1232` | acentos y titulares | 5,20 / 17,83 / 6,47 | ✓ |

En la captura `05-reserva-paso1.jpg` se ve el efecto: los días pasados y los **domingos** se pintan con el mismo gris casi invisible — la clienta no puede distinguir «ese día ya pasó» de «domingo, cerrado».
**Impacto:** legibilidad real a plena luz para clientas y para la profesional, en los textos que explican precios, pasos y estados. Es, además, el defecto más barato de corregir de los cinco.

### D5 · La conversión paga peajes contables y la orientación miente dentro del flujo que más importa
**Evidencia:** recorrido contado (sección siguiente), capturas `05b`, `07`, `12b`, `14`, `17`.
- **Paso 3 de reserva:** además de nombre y teléfono hay que **marcar una casilla** de dos líneas («Confirmo que quiero reservar esta cita. Sé que quedará escrita en la agenda del salón») para desbloquear «Confirmar reserva». El referente cerrado de la propia ESPEC (objeto P8) no tenía casilla: es **+1 toque y +1 lectura** en el último metro (decisión deliberada en su día: se señala como peaje, no como error; su cambio es decisión de Lee, ver bloque B7).
- **Preselección silenciosa:** al entrar en la reserva ya hay un servicio marcado (Diseño) con «Continuar» activo, y la barra resumen afirma **«TU CITA · Diseño de cejas · viernes, 30 de octubre»** antes de que la clienta haya elegido día: el sistema propone, pero lo presenta como hecho.
- **La navegación miente:** durante todo el flujo de reserva la pestaña iluminada es **«Probador»** (capturas `05b`, `07`, `12b`), y la pantalla de próxima apertura ilumina **«Inicio»** (captura `14`), venga de donde venga la clienta.
- **Resultado con 5 acciones apiladas** compitiendo tras la recomendación (Reservar este servicio / Reservar la alternativa / Guardar este look / Elegir otro servicio / Borrar mi foto), con la nota técnica intercalada entre ellas.
- **Errores sin salida:** el enlace `/cita/<token>` inválido (captura `17`) muestra una caja roja —«Este enlace no corresponde a ninguna cita; pide al salón que te lo reenvíe»— y **ningún botón**: ni ir a la app, ni escribir al salón. Calle sin salida en la página que una clienta abre desde su WhatsApp.
**Impacto:** cada reserva paga estos peajes y la desorientación ocurre justo en el recorrido reserva/resultado, el que la Orden Maestra declara prioritario sobre cualquier función de IA.

---

## El recorrido de conversión, contado (base de D5)

**Inicio → cita confirmada (reserva directa): 6 toques + 2 campos + 1 lectura.**
1. Toque: pastilla «Reservar» (o tarjeta de Explorar/Salón). 2. Paso 1 llega con servicio **preseleccionado** y Continuar activo → toque «Continuar al día y la hora» (decisión real: aceptar o corregir la preselección). 3. Paso 2 llega con **día preseleccionado** (primer día con huecos; en la captura, mañana) y horas cargadas → toque en una hora (entre 12 y 39 filas según duración). 4. Toque «Continuar a tus datos». 5. Escribir nombre y teléfono (0 si la clienta vuelve: el autorrelleno desde el dispositivo está verificado). 6. Toque en la casilla de confirmación (lectura de 2 líneas). 7. Toque «Confirmar reserva».

**Resultado del análisis → cita confirmada: 5 toques.** «Reservar este servicio» salta directo al paso 2 con el servicio fijado; hora → Continuar → datos → casilla → Confirmar.

**Inicio → resultado del análisis: ~5 toques + 1 lectura larga + la espera.** Pastilla «Análisis IA» → consentimiento (3 párrafos, casilla, Continuar) → «Elegir mi foto» + selector del sistema → «Analizar mis cejas» → espera medida en este diagnóstico: **12,1 s** (rango documentado del producto: 10–46 s, con picos >150 s tratados por sondeo asíncrono y fases honestas — CONSERVAR). Las 5 preferencias de estilo vienen **pre-marcadas** (0 decisiones obligatorias, pero sin ningún rótulo que lo diga: ver bloque B9).

**Medidas táctiles (DOM, 412×915):** pastillas de Inicio 88×128 · botón del buscador 56×56 · pestañas de nav 103×58 con etiqueta a 11 px · días del calendario 51×44 · filas de hora 376×52 · segmentos de preferencias 106×44 · casillas de consentimiento 22×22 (área de toque real: la fila completa, 44+) · botón «Reservar» de la barra del salón 156×**48** (el resto de primarios: 52) · tarjetas de Explorar 376×**350** (≈1,2 tarjetas por pantalla para una carta de 4 servicios) · «Elegir mi foto» **140×56** frente a «Usar la de ejemplo», visualmente más fuerte por su borde oscuro (captura `10-foto.jpg`: jerarquía invertida en el bloque que decide si hay análisis real).

---

## (2) Las 3 pantallas cuya mejora aporta más valor

1. **Resultado del análisis.** Es el momento que justifica que La Asistenta exista (la IA que mira tus cejas y te orienta) y hoy es donde se juntan D1 y media D5: veredicto sin matiz, color de oferta, lenguaje del modelo en píldoras, nota técnica en mitad de las acciones y 5 botones compitiendo. Arreglarla mejora a la vez **confianza y conversión**, y es barata: textos, orden y un color. Ninguna otra pantalla concentra tanto valor por euro de esfuerzo.
2. **Profesional · Hoy (con Agenda).** La pantalla de trabajo diaria de Arianna. D2 vive aquí: titular que cuenta muertas, canceladas a pleno peso en dos vistas, embudo sin periodo delante de lo operativo. Si esta pantalla duele al abrirla, el piloto se abandona sin que nadie avise; si entra por los ojos, todo lo demás (reservas web, WhatsApp, lista de espera) se usa. Es además la superficie con menos batería automática hoy: mejorarla obliga a crearla, y eso protege el resto del proyecto.
3. **Inicio.** La puerta y la primera impresión — la pantalla que Lee ha mandado rehacer dos veces por «barata». Aquí la doble voz y la falta de escala se notan en 3 segundos (es la única pantalla Montserrat en un mar de serif), y aquí está la etiqueta menos legible de la app: el placeholder del buscador a 2,27:1. Todo el tráfico pasa por ella; cualquier mejora de sistema (B1/B4/B5) se estrena aquí.

---

## (3) Componentes a reutilizar o consolidar (con dónde están duplicados hoy)

| Componente | Estado hoy (evidencia) | Consolidación propuesta |
|---|---|---|
| **Tokens CSS** | El mismo `:root` pegado en `index.html`, `cita.html` y `profesional.html`; `--sombra` ya divergente entre ellos | Una única fuente de tokens (fichero compartido o bloque generado) + comprobación en la batería que falle si los tres divergen |
| **Escala tipográfica** | >20 tamaños con fraccionarios; peso 800 ×24 como jerarquía | Escala cerrada con roles (p. ej. 11/12,5/13,5/15/16,5/19/23/28: etiqueta/cuerpo/cuerpo+/acción/tarjeta/título/sección/hero) aplicada a los tres ficheros |
| **Voz de titular** | `.seccion-titulo` Fraunces 25 en la base; Montserrat 22/800 solo en Inicio; `.tarjeta h2` Fraunces 23 vs Montserrat 19 en Inicio; `.salon-titulo` 31 | Una sola voz display para la app de la clienta (decisión por comparativa, bloque B5); Fraunces, si queda, solo en la página standalone de la cita |
| **Botón** | 8 variantes; `.btn-lavanda` es blanco; alturas 52 vs 48 (barra del salón); verde con 3 semánticas | 4 roles: primario (negro), secundario (contorno), texto, peligro; + estado ocupado (CONSERVAR el de §51); verde reservado a WhatsApp o a ofertas reales, nunca a precios |
| **Tarjeta de servicio** | 3 anatomías: Explorar (foto alta 350 px, 2 botones contorno + guardar), reserva (376×102 seleccionable con check), salón (fila con botón); Depilación sin descriptor (anatomía incompleta) | Una anatomía base (foto, nombre, descripción, precio·duración, UNA acción primaria) con variantes documentadas: seleccionable / con foto / compacta |
| **Insignias y chips** | `.chip-estado`, `.foto-pill`, `.mini-etiqueta`, `.etiqueta`, `.chip-dato` — la última admite frases enteras y se deforma | Sistema de insignias con contenido máximo (1–3 palabras); los rasgos del análisis pasan a lista etiqueta→valor, no a píldoras |
| **Buscador** | Dos placeholders («Buscar todos los servicios» / «Buscar en el catálogo») y dos comportamientos (filtrar la carta en la propia página / filtrar el catálogo) | Un componente, un placeholder, un comportamiento declarado; «catálogo» fuera del lenguaje de servicios |
| **Avisos y errores** | `.error-caja`, `.caja-aviso`, `.aviso`, `.nota-pro` sin roles claros | 3 roles con regla dura: todo error lleva acción de continuación en la misma pantalla |
| **Resumen de cita** | La misma información en 3 pieles: `.resumen-mini` (negra), `.tu-cita` (clara), `#resumen-espera` (beige) | Un componente de resumen con variante de superficie |
| **Navegación / wayfinding** | `PASOS`/`NAV_DE` iluminan «Probador» durante la reserva y «Inicio» en próxima apertura | La pestaña activa debe ser la del contexto real de la pantalla o ninguna |

**CONSERVAR tal cual (sistema ya bueno):** los tokens de movimiento del pase §51 (`--ease-out`, `--ease-in-out`, pulsados completados, snap del carrusel) — con dos restos de `ease` pelado por pulir en `.enlace` y `.seg`; el registro `modulos.json` como fuente única de la estantería/Explorar/próximas aperturas; la mecánica de preselección de día con huecos reales (lo que se critica es su presentación, no la mecánica).

---

## (4) Riesgos de regresión sobre lo verificado, por zona

| Zona a tocar | Qué lo protege hoy | Riesgo concreto |
|---|---|---|
| CSS/clases de `index.html` | Batería web 33/33 (lee el HTML servido y busca clases/IDs/textos), QA de clics (qa20 y sucesores usan `.servicio-card`, `.hora-fila`, `#btn-*`) | Renombrar clases o IDs rompe batería y QA a la vez. **Riesgo nº1 silencioso: la PWA** — cualquier cambio de assets sin subir la versión del service worker (hoy v19) deja a las clientas con la versión vieja en caché |
| Flujo de reserva (pasos, `cargarHuecos`, resumen) | Batería de guarda 11/11 y de mecánicas 23/23; la regla de horas pasadas se comparte con el servidor (`agenda_comun.py` importado por `web_server.py`) | Tocar el cliente sin re-ejecutar guarda+mecánicas puede reabrir el defecto de «reservar en el pasado» que costó dos fases cerrar (§§47/49 del ESTADO). La guarda, el anti-solape y la idempotencia viven en el servidor: **no se tocan desde UX** |
| Resultado del análisis | Batería del probador 18/18; contrato de `/analizar` y payload visual de la §48 (sin clave, la pantalla debe ser la de hoy salvo lo acordado; con clave nace la propuesta visual) | Cambiar textos es seguro; cambiar estructura del payload o el orden de bloques sin actualizar la batería rompe el interruptor honesto de capacidades Meta |
| Área profesional | QA de clics QA13 27/27 (**no existe batería HTTP del panel**) | El contador de Hoy y el orden de la lista salen de `/api/profesional/hoy`: corregir D2 exige un cambio pequeño de servidor sin red automática → crear la batería ANTES de tocar (incluido en B3) |
| `cita.html` | La batería web lee sus textos/estados (D-02: pinta el estado real) | Página aislada, riesgo bajo; mantener los textos de estado y error que la batería espera o actualizarla a la vez |
| `modulos.json` | La batería web verifica «Próximamente» y la activación por configuración (QA12b) | No tocar `estado` de ningún módulo en ningún bloque de este plan; los textos de próxima apertura viven aquí: editarlos es editar contenido servido |

Regla general del plan: **ningún bloque se da por hecho sin re-ejecutar las baterías de su zona y sin comparativa visual antes/después a 412×915.**

---

## (5) Plan de implementación por bloques pequeños y seguros

Ordenado por impacto/esfuerzo. Cada bloque: cambio, problema, tipo, esfuerzo, pruebas y aceptación con comparativa.

### B1 · Contraste AA del texto de apoyo — ⭐ PRIMER BLOQUE RECOMENDADO (ejecutable sin esperar aprobación)
- **Cambio:** oscurecer `--gris` hasta ≥4,5:1 sobre blanco y sobre `#f5f5f5` (valor candidato calculado: en torno a `#626878`, a verificar con la fórmula antes de fijarlo); placeholder del buscador a ≥3:1 (objetivo 4,5:1); días deshabilitados del calendario ≥3:1 **distinguiendo domingo de día pasado** (tono o marca distinta); chip «Disponible ahora» a ≥4,5:1.
- **Problema:** D4 completo. **Tipo:** visual (3 valores en 3 ficheros + subida de versión del SW en cada superficie).
- **Esfuerzo:** bajo (una sesión). **Pruebas:** recálculo de contrastes documentado, batería web 33/33, capturas antes/después de Inicio, Reserva paso 2 y Profesional·Hoy a 412×915.
- **Aceptación:** ningún par texto/fondo de lectura por debajo de 4,5:1 (deshabilitados ≥3:1 con domingo distinguible); cero cambios de layout en la comparativa; baterías en verde.
- **Por qué primero:** corrige el defecto que afecta a *todas* las pantallas, no toca ni una clase, ni un texto, ni una mecánica: riesgo de regresión mínimo y beneficio inmediato. Es el «quick win» seguro que el encargo pide para abrir la Fase 3.

### B2 · El resultado habla como orientación
- **Cambio:** reescribir el aviso del resultado: la recomendación se presenta como orientación («Esto es una orientación a partir de tu foto; Arianna lo confirma contigo en el salón»), la tecnología se nombra **una** vez y el tiempo técnico sale de la cara de la clienta (o en formato humano); precio y etiqueta de la recomendación en negro (el verde queda para ofertas reales); rasgos del análisis como lista etiqueta→valor en vez de píldoras-frase; orden de acciones: primaria → alternativa → (guardar / otro servicio / borrar) agrupadas como secundarias.
- **Problema:** D1 + parte de D5. **Tipo:** visual + textos (la cadena del aviso vive en `web_server.py`; el payload no cambia).
- **Esfuerzo:** bajo-medio. **Pruebas:** baterías web 33/33 y probador 18/18; análisis real con la foto de ejemplo; comparativa antes/después del resultado completo.
- **Aceptación:** la frase de orientación es visible en la tarjeta de la recomendación sin hacer scroll; un solo botón con peso primario antes del pliegue; «Muse Spark» aparece una vez en la pantalla.

### B3 · Hoy profesional que se puede abrir
- **Cambio:** el titular de Hoy cuenta solo citas vivas («N por atender · M cumplidas hoy · K canceladas» como dato secundario); las canceladas se relegan visualmente (una línea atenuada, al final de su hora o agrupadas al final del día) en Hoy y dejan de ocupar filas en Agenda (o colapsadas); título de página propio por vista.
- **Problema:** D2. **Tipo:** funcional ligero (respuesta de `/api/profesional/hoy` + cliente del panel).
- **Esfuerzo:** medio. **Pruebas:** **crear primero una batería HTTP del panel** (hoy no existe) que fije el comportamiento actual de sesiones y vistas; después QA de clics con un día cargado de canceladas (como el de este diagnóstico).
- **Aceptación:** con el día de la captura 20 (43 registros, 0 vivas por atender), el titular ya no dice «43 citas hoy»; ninguna cancelada aparece antes que una viva; QA13 de clics equivalente en verde.

### B4 · Escala cerrada y tokens únicos
- **Cambio:** fijar la escala tipográfica y de radios de la salida (3); remapear los >20 tamaños y los radios sueltos a la escala en los tres ficheros; unificar `--sombra`; una sola fuente de tokens con guarda en batería.
- **Problema:** D3 (la mitad estructural). **Tipo:** visual/arquitectónico ligero. **Esfuerzo:** medio (con QA visual pantalla a pantalla).
- **Pruebas:** batería web 33/33 + barrido visual completo comparado (ninguna pantalla puede salir peor: regla de la casa). **Aceptación:** 0 tamaños ni radios fuera de escala en los tres ficheros; `--sombra` idéntica en las tres superficies.

### B5 · Una sola voz de titular
- **Cambio:** decidir la voz display por comparativa lado a lado (propuesta de partida: Montserrat 800, la de la pantalla que Lee aprobó; Fraunces se retira de la app de la clienta o queda solo en `cita.html`) y aplicarla a `.seccion-titulo` y tarjetas en todas las pantallas.
- **Problema:** D3 (la mitad de identidad). **Tipo:** visual. **Esfuerzo:** bajo-medio tras B4.
- **Pruebas:** comparativa completa a 412×915 enseñada a Lee (es identidad: su OK visual cierra el bloque). **Aceptación:** un solo `font-family` display en los títulos de `index.html`.

### B6 · Wayfinding honesto
- **Cambio:** la reserva deja de iluminar «Probador» (sin pestaña activa o con contexto propio) y la próxima apertura conserva la pestaña desde la que se llegó.
- **Problema:** D5 (orientación). **Tipo:** funcional ligero (`PASOS`/`NAV_DE`). **Esfuerzo:** bajo.
- **Pruebas:** QA de clics entrando a la reserva desde Salón, Resultado, Explorar e Inicio. **Aceptación:** ninguna pantalla muestra activa una pestaña que no es su contexto.

### B7 · Paso 3 sin peaje doble — CONDICIONADO a decisión de Lee
- **Cambio (opción A, segura, sin su OK):** resumen + casilla + botón visibles sin scroll a 412×915 (compactar el paso 3). **Opción B (requiere a Lee):** retirar la casilla — era objeto cerrado de la ESPEC P8, decisión deliberada: no se toca sin su palabra.
- **Problema:** D5 (fricción). **Tipo:** visual (A) / funcional (B). **Esfuerzo:** bajo.
- **Pruebas:** baterías web + mecánicas; reserva completa grabada en clics. **Aceptación:** en A, «Confirmar reserva» visible sin scroll con los datos rellenos; en B, conteo del recorrido: 5 toques.

### B8 · Ningún error sin salida
- **Cambio:** `/cita/` inválido gana dos acciones («Ir a La Asistenta» y «Escribir al salón por WhatsApp»); el vacío de Explorar gana «Ver todos los servicios» y deja el lenguaje de «productos verificados» por el de servicios; el error genérico de reserva mantiene el 409 actual (CONSERVAR: ya trae alternativas y retorno automático al paso 2) y gana acción equivalente en su rama genérica.
- **Problema:** D5 (callejones). **Tipo:** textos/funcional ligero (incluye `cita.html`). **Esfuerzo:** bajo.
- **Pruebas:** batería web (ojo a los textos que fija) + clics sobre token inventado y búsqueda sin resultados. **Aceptación:** todo estado de error alcanzable ofrece al menos una acción de continuación en pantalla.

### B9 · Foto: jerarquía correcta y preferencias declaradas opcionales
- **Cambio:** «Elegir mi foto» pasa a ser la acción dominante del bloque (ancho y peso de primaria suave), «Usar la de ejemplo» queda como secundaria; sobre las preferencias, un rótulo que dice la verdad: «Tu estilo — ya viene ajustado; cámbialo solo si quieres».
- **Problema:** fricción F4/F5 del recorrido (jerarquía invertida medida: botón real 140 px, ejemplo con borde más fuerte). **Tipo:** visual + un texto. **Esfuerzo:** bajo.
- **Pruebas:** batería web + análisis real con la foto de ejemplo (el camino no cambia). **Aceptación:** el elemento con más peso visual del bloque es subir la foto propia; 0 decisiones obligatorias, ahora también declarado.

### B10 · Explorar: una tarjeta, una acción
- **Cambio:** tarjeta de servicio con foto menos alta, UNA acción primaria negra «Reservar» y «Probar con mi foto» como acción secundaria de texto; fuera el nombre del salón repetido en cada tarjeta (es el único negocio); descriptor para Depilación o anatomía sin hueco.
- **Problema:** densidad (350 px/tarjeta) y doble botón contorno sin primaria. **Tipo:** visual. **Esfuerzo:** medio.
- **Pruebas:** batería web + comparativa. **Aceptación:** ≥2 tarjetas visibles por viewport a 412×915; una sola acción con peso primario por tarjeta.

---

## CONSERVAR (verificado y bien: no tocar salvo lo indicado)
- **El consentimiento de la foto** («Antes de la foto, claro y corto»): el mejor texto del producto. Claro, corto y completo.
- **La espera del análisis por fases honestas** del pase §51, sin porcentajes inventados, con contador real.
- **El error 409 de reserva**: dice qué pasó, ofrece los huecos libres y devuelve sola al paso 2 recargándolos.
- **La confirmación** con secuencia (tick → código AS-XXXX → enlace) y el enlace mágico con sus guardas (no cancelar citas ya realizadas, no reservar en el pasado — §§45/47/49).
- **La próxima apertura**: honestidad ejemplar («Sin fechas inventadas…»), con su única pega en B6.
- **La preselección de día/hora con huecos reales** como mecánica (la crítica de D5 es a cómo se presenta el día en el resumen, no a la mecánica).
- **Las baterías y guardas** (33/11/23/22/18) como red de cada bloque, y el registro de módulos como fuente única de la interfaz.

## Anexo · Evidencia
- Capturas del recorrido (33) y métricas DOM: `~/workspace/la-asistenta/musa-diag/` (`01-inicio.jpg` … `23b-prof-negocio-bajo.jpg`, `metricas.json`); paso 1 real desde Inicio: `05b-reserva-paso1-real.jpg`; sondeo de preselección/autorrelleno con perfil virgen: `/tmp/musa2/sondeo.json` en la máquina (localStorage vacío → nombre vacío: el autorrelleno es del dispositivo, verificado).
- Contrastes calculados con la fórmula WCAG 2.x sobre los pares reales del CSS (tabla en D4).
- Conteos de la auditoría: tamaños/pesos/radios contados sobre el `<style>` de `web/index.html`; variantes de botón y duplicidades de `:root` verificadas en los tres ficheros.
- Análisis real de este diagnóstico: foto de ejemplo, resultado en 12,1 s, recomendación «Diseño de cejas» (capturas `11`, `12`, `12b`).
