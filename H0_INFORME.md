# H0 — Informe de inspección · LA ASISTENTA
**Fecha:** 27/10/2026 (noche) · **Hito:** H0 únicamente. Sin construcción nueva. Se detiene para aprobación.

## 1. Qué existe hoy (verificado, con evidencia)

El proyecto vive en `~/workspace/la-asistenta/` — **no es un repositorio git** (comprobado: `fatal: not a git repository`). Esto es un hueco directo contra la entrega del hackathon, que exige repositorio público.

| Pieza | Estado | Evidencia |
|---|---|---|
| Hermes Agent (Nous Research) + Muse Spark vía Baseten | ✅ Funciona | Conversación completa cerrando una cita (`PRUEBA_H1_HERMES.md`); primera llamada 27/10 22:11 CET, 200 OK, 7,3 s |
| Agenda real (SQLite + herramientas registrar/consultar/cancelar) | ✅ Funciona, con guarda anti-solape | Citas reales escritas y verificadas por SQL (`H3_TECNICO.md`, `SOLAPE_FIX.md`) |
| Receptor WhatsApp (webhook propio) | ✅ Construido y probado en local con payloads forma-Meta | Demo de punta a punta en local (`H3_TECNICO.md`) |
| Robustez conversacional | ✅ 4 escenarios + solape superados | `PRUEBAS_ROBUSTEZ.md`, `SOLAPE_FIX.md` |
| App Android de la dueña (panel) | ✅ APK v2 firmado, cara verificada con capturas 412×915 | `APP_BUILD.md`, `APP_V2.md`, `app/qa/` |
| Análisis de cejas con foto (Spark visión) | ✅ Probado: análisis correcto y recomendación con precios reales | `H2_PREP.md`, `h2/` |
| Guion de demo (3 min) | ✅ Borrador con tabla de estado honesta | `GUION_DEMO.md` |
| Canal WhatsApp real (número de prueba de Meta) | ⛔ Bloqueado | Ver §4 |
| Vista previa generada (Muse Image) | ⛔ Sin vía de acceso verificada | Ver §3 |
| Segmentación SAM 3.1 | ⛔ Sin vía de acceso verificada | Ver §3 |

## 2. Reglas del hackathon (contrastadas hoy)

- Meta Global AI Developer Hackathon (Meta × Cerebral Valley), en línea, 26/10–04/11/2026. **Entrega: 04/11 21:00 ET = 05/11 03:00 Madrid.** Ganadores ~09–10/11.
- Track de Lee: **Indie Developer** (bolsa 400.000 $; primer premio 150.000 $). Criterios: **Impacto 30% · Uso de herramientas Meta 25% · Demo (vídeo) 25% · Profundidad técnica 20%**.
- Créditos por participante seleccionado: **150 $ Meta Model API** + socios (Baseten 100 $, Modal 100 $, Fireworks 25 $).
- ⚠️ **Licencia de la entrega:** según las reglas publicadas, lo compartido durante el evento **no es confidencial** y los organizadores reciben una licencia mundial, perpetua y libre de royalties para usar/publicar/modificar el material entregado. La demo y el repo deben prepararse asumiéndolo (sin secretos, sin datos de clientas reales).

## 3. Modelos y APIs — disponibilidad REAL verificada

| Capacidad | Vía | Veredicto empírico |
|---|---|---|
| Muse Spark (texto) | Baseten, modelo exacto `meta-models/muse-spark-open-1026`, clave de Lee conectada | ✅ Operativo. Latencia ~8 s/turno en conversación |
| Muse Spark (visión) | El mismo modelo acepta imagen nativa | ✅ Operativo. Análisis de cejas correcto. Latencia: 47 s vía Hermes; 14,9 s en llamada directa. En llamadas directas hacen falta ≥4.096 tokens de salida (Spark razona siempre; con 1.024 la respuesta visible sale vacía) |
| Muse Image (generar/editar) | — | ⛔ **No disponible**: el listado de modelos accesible con la clave de Baseten (20 modelos, todos texto/visión) no contiene ningún modelo de imagen (`h2/sonda_modelos.json`). La otra vía posible es la Meta Model API con el crédito de 150 $, **sin verificar** (ver §4) |
| SAM 3.1 (segmentación) | — | ⛔ **Sin ruta verificada** en ninguna cuenta conectada. Solo consta como parte del stack de la Meta Model API |
| WhatsApp Cloud API | App de Meta «La Asistenta» (ID 1677043040611576), producto WhatsApp añadido | ⛔ Atascado en la vinculación del portfolio (ver §4) |

Conclusión de estrategias (edición directa / segmentación+edición / híbrida): **hoy no se puede ejecutar ninguna de las tres para generar propuestas visuales**, porque falta la pieza de generación de imagen. La mitad «entender la foto y recomendar» (Spark) sí está verificada. En cuanto exista acceso a Muse Image, la estrategia a benchmarcar primero es **edición directa** (menor latencia y complejidad), con la híbrida como candidata si la preservación de identidad falla.

## 4. Accesos y credenciales — estado exacto

- ✅ **Baseten: 100 $ concedidos, clave conectada y en uso** (la clave vive en la bóveda; Hermes opera con un token sustituto que solo se canjea hacia Baseten).
- ❔ **Meta Model API: 150 $ sin verificar.** La tarjeta ya está puesta; el saldo solo es visible para Lee en el Billing de dev.meta.ai. Sin esta confirmación no hay vía a Muse Image ni a SAM 3.1.
- ❌ **Modal (100 $) y Fireworks (25 $): no concedidos** — ambos exigen método de pago para activar.
- ⛔ **WhatsApp**: registro de desarrollador completo y app creada, pero la vinculación del portfolio comercial chocó con (a) dos portfolios viejos de Lee restringidos por Meta, (b) límite de portfolios alcanzado (no se puede crear uno nuevo sin borrar otro) y (c) un **bloqueo temporal de permisos a nivel de cuenta** por los intentos. Quedó seleccionado el portfolio válido «Lee RenMon's ★». **Reintento único programado: 28/10 ~09:42** (cron `la-asistenta-meta-retry-2026-10-28`), con el bloqueo ya frío.
- ⛔ **Exposición pública del servidor**: el webhook y la API de la agenda corren en local, pero los túneles probados (Cloudflare, localtunnel) **no pueden salir** desde este entorno (bloqueo de red del sandbox). Sin una ruta de exposición, Meta no podrá entregar mensajes al webhook ni la app del móvil leerá la agenda. Es el riesgo técnico nº 1 para H3–H4 de la especificación.
- ❌ **Repositorio público**: no existe. Crearlo es una publicación externa — requiere decisión de Lee (nombre, qué entra, qué queda fuera: claves, datos, la agenda de pruebas).

## 5. Riesgos principales

1. **Exposición pública bloqueada** (alto): sin ruta HTTPS pública no hay WhatsApp real ni datos en vivo en la app. Alternativas a evaluar en H2: túnel con cuenta propia, otro proveedor de túneles, o desplegar el receptor en una plataforma (cambiando dónde corre Hermes — decisión de arquitectura).
2. **Dependencia del crédito de Meta para la mitad visual** (alto): si los 150 $ no están, no hay Muse Image ni SAM 3.1 y la experiencia de propuestas se reduce a análisis+recomendación (real, pero sin «antes/después» generado). Plan B honesto ya previsto en el guion: rotularlo «en construcción».
3. **Token temporal de WhatsApp de 24 h** (medio): el día de la grabación hay que generarlo fresco; el permanente (usuario del sistema) queda para después de vincular el portfolio.
4. **Latencias** (medio): texto ~8 s/turno (asumible en WhatsApp); foto 47 s vía Hermes (hay diseño de mensaje intermedio; la vía directa baja a ~15 s).
5. **Token sustituto de Baseten sin TTL conocido** (bajo): si un turno devuelve 401, se re-pide el sustituto; documentado.
6. **Privacidad de fotografías** (medio): el flujo diseñado (H2_PREP) incluye consentimiento separado, borrado del original y no reutilización; **aún no está implementado** en código — es trabajo de H3/H6 de la especificación y requisito antes de tocar una foto real de clienta.
7. **Fecha límite única** (alto): todo converge el 04/11 21:00 ET; el canal de WhatsApp decide mañana 28/10 si el arco principal es viable tal cual.

## 6. Conflictos de la especificación con decisiones previas (necesitan tu OK)

1. **Superficie del MVP**: la especificación pide una **experiencia web mobile-first para la clienta** (explorar propuestas, comparar, ir a reservar). Lo construido hasta hoy es la **operadora por WhatsApp** + la **app de la dueña**. Son compatibles (tres caras del mismo sistema), pero hay que fijar **qué es EL MVP entregable** y en qué orden.
2. **Paleta**: la especificación trae la paleta de marca LA ASISTENTA (carbón índigo #252533, lavanda #C5B4F2, blanco cálido #FAF7F2, verde suave #7AB7A7), distinta de la del salón piloto (marfil/verde azulado/dorado) usada en la app — donde rige tu regla de que cada negocio se viste con SU marca. Propuesta: la experiencia de clienta y la marca del producto usan la paleta de la especificación; la app de la dueña conserva la del salón.
3. **Reservas**: la especificación dice que, sin API de reservas verificada, se enlace el sistema oficial del negocio y nunca se presente un clic como reserva. Nuestra agenda propia sí es un sistema de reservas real y verificado en local; falta su exposición pública (riesgo nº 1) para que lo sea de cara a la clienta.
4. **Nombres de hitos**: la especificación usa H0–H7; hasta hoy usábamos «puertas» H1/H2/H3 con otro significado. Propuesta: adoptar desde ahora la numeración de la especificación y archivar la antigua como «puertas técnicas».

## 7. Plan por hitos (especificación) contra el estado real

- **H0** — este informe. ⏸️ Esperando aprobación.
- **H1 (benchmark)**: Spark texto/visión ya medido (calidad, latencia, coste ~2 céntimos/conversación estimada en API de Meta; en Baseten el consumo va contra los 100 $). Benchmark de imagen: **bloqueado hasta verificar el crédito de Meta**.
- **H2 (arquitectura y contratos)**: base existente (Hermes + adaptador Baseten + agenda con herramientas). A definir: contratos de la experiencia de clienta y la ruta de exposición pública.
- **H3 (interfaz móvil, consentimiento, foto, preferencias)**: por construir según la decisión del punto 6.1; el diseño de consentimiento ya está esbozado en `H2_PREP.md`.
- **H4 (llamadas reales y comparación)**: depende de Muse Image.
- **H5 (catálogo y reservas)**: catálogo real ya cerrado (4 servicios del salón); reservas = agenda propia + WhatsApp.
- **H6 (privacidad y métricas)**: consentimiento, borrado verificable, aislamiento por negocio (hoy: un solo negocio piloto; el aislamiento multi-tenant es diseño, no código).
- **H7 (E2E, documentación, demo, checklist)**: guion de demo ya en borrador; README y repo público pendientes.

## 8. Decisiones que pido para cerrar H0

1. **Superficie MVP**: ¿la experiencia web de clienta de la especificación pasa a ser la cara principal del MVP (con WhatsApp y la app como respaldo), o el MVP sigue siendo la operadora de WhatsApp con la web como complemento?
2. **Paleta**: ¿se adopta la paleta LA ASISTENTA de la especificación para la experiencia de clienta, manteniendo la del salón en la app de la dueña?
3. **Repositorio público**: ¿creo el repo público de GitHub para la entrega (con .gitignore estricto: sin claves, sin datos, sin agenda de pruebas)?
4. **Hitos**: ¿adoptamos la numeración H0–H7 de la especificación desde ahora?

**Fin de H0. Sin construcción hasta tu aprobación.**
