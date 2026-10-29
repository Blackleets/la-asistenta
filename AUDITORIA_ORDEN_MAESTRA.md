# AUDITORÍA — Orden Maestra (29/10/2026)

> Primer paso obligatorio de la Orden Maestra de Lee (29/10/2026 08:21).
> Auditoría ejecutada el 29/10/2026 por la mañana: documentación leída
> completa (H0_INFORME, ESTADO_PARA_CHATGPT 23:55, ESTADO_PROYECTO,
> DIAGNOSTICO_PROBADOR, MODELOS_TRYON, probador/INTERFACES), código
> inspeccionado, despliegue vivo verificado y **baterías re-ejecutadas
> hoy contra la máquina real**. Nada se marca verificado sin evidencia
> de esta pasada. Etiquetas: **VERIFICADO HOY** · **CONSTRUIDO** (existe,
> no re-probado hoy) · **DORMIDO** (código presente, inactivo) ·
> **PENDIENTE** · **BLOQUEADO** (terceros/fundador).

## (a) Inventario verificado de lo que funciona

**Despliegue vivo (máquina InstaBox `la-asistenta`, hoy):** encontrada
suspendida por auto-pausa (30 min) y despertada para la auditoría; los
tres servicios responden `/salud` OK — webhook 8080 (pid 48241),
agenda 8081 (pid 65393), web 8090 (pid 73901) — y el proceso de Hermes
está vivo. Disco /data: 16 GiB libres de 20. Superficie pública
verificada desde fuera: `/salud` OK, `/api/modulos` devuelve
`belleza=activo` + `moda_probador/gafas_accesorios/calzado=
proximamente`, `/api/servicios` devuelve la carta real (18 €/25 ·
30 €/65 · 45 €/65 · Consultar/12).

**Baterías re-ejecutadas HOY 29/10 contra la máquina real:**

| Batería | Resultado hoy | Qué prueba |
|---|---|---|
| `web/pruebas_web.py` | **19/19** | Carta, disponibilidad, reserva verificada, anti-solape, pack con totales, análisis Spark real, 409/400 correctos |
| `agenda/pruebas_api_guarda.py` | **8/8** | Guarda de horario/anti-solape en el propio endpoint de la API |
| `agenda/pruebas_mecanicas.py` | **20/20** | Enlace mágico (hash), código AS-XXXX, lista de espera, prep, embudo, bandeja post-cita |
| `web/qa12/qa12_cdp.mjs` (QA más reciente) | **43/43** | Recorrido completo a 412×915 con clics: módulos desde el registro, próxima apertura sin invenciones, análisis real → reserva (AS-AAEA) → cancelada, consola sin errores |
| `probador/test_adaptador_fashn.py` (local, sin red) | **5/5** | Lógica del adaptador FASHN (no es una prueba E2E: ninguna generación ejecutada) |

**Piezas y su estado:**
- **Agenda real** (SQLite + API 8081 con token + MCP de 6 herramientas
  + CLI): guarda de negocio en el servidor (horario L–V 10–20, S 10–14,
  domingo cerrado; anti-solape por intervalos; creación verificada
  releyendo). **VERIFICADO HOY** por las tres baterías.
- **Web de la clienta (PWA)**: registro de módulos como fuente de la
  interfaz, consentimiento previo a la foto, análisis de cejas con
  Muse Spark Open (asíncrono con sondeo, inmune al 502), reserva con
  pack y totales, .ics real, enlace mágico, lista de espera, embudo
  medido (390 eventos acumulados: 389 web / 1 whatsapp — tráfico de
  pruebas y QA, no de clientas). **VERIFICADO HOY** (batería web +
  QA12). Paridad local↔máquina: SHA-256 idénticos en `index.html`,
  `sw.js`, `modulos.json` y `cita.html`; `web_server.py` DIFIERE (ver
  diferencias, fila D1).
- **Operadora WhatsApp (Twilio sandbox → Hermes → Spark)**: adaptador
  con validación de firma `X-Twilio-Signature`, deduplicación por
  MessageSid y respuesta dentro del TwiML (la cuenta trial rechaza el
  texto libre por API, error 21654). **CONSTRUIDO y probado por
  autoprueba firmada el 28/10 (200 en 4,51 s)**; la confirmación con un
  mensaje real del fundador sigue **PENDIENTE** (presupuesto trial:
  100 mensajes, reservados para la demo).
- **Análisis de cejas con foto**: Spark visión con JSON validado
  contra la carta; foto solo en memoria. **VERIFICADO HOY** dentro de
  la batería web y de QA12. La propuesta visual generada (ver el
  resultado sobre la foto) NO existe: depende de Muse Image (bloqueo
  B1) y la pantalla lo dice así, sin imágenes falsas.
- **Contenido real del salón**: fotos de la propia web de Ari Vivas
  Beauty, 5 vídeos de su TikTok oficial embebidos, reseñas literales
  de su tienda (de sus productos Henna Menela — matiz declarado en la
  propia interfaz y en el ESTADO). **CONSTRUIDO** (QA7 38/38 el 28/10).
- **App Android de la dueña (Capacitor, APK v2)**: **CONSTRUIDO** el
  27/10, **desactualizada**: no incorpora las mecánicas del 28/10
  (enlace mágico, pack, embudo) ni se ha re-verificado hoy.
- **Probador virtual (módulo `moda_probador`)**: **PREPARADO Y
  DORMIDO, por decisión del fundador (corrección modular 28/10
  23:45)**. Investigación completa en `MODELOS_TRYON.md`; contratos en
  `probador/INTERFACES.md`; truss y adaptador de FASHN VTON v1.5
  construidos (lógica 5/5 hoy); **ninguna generación ejecutada**
  (despliegue bloqueado, B2). IDM-VTON y CatVTON vetados por licencia
  no comercial; el endpoint Kolors de fal está deprecado.
- **Vigilancia de créditos**: el vigilante de las 08:21 de hoy no vio
  concesiones nuevas: solo Baseten (100 $) está concedido; Meta,
  Modal y Fireworks siguen sin confirmar/exigiendo tarjeta.

## (b) Diferencias: interfaz ↔ backend ↔ pendiente (tabla honesta)

| # | Lo que la interfaz/el relato sugiere | Lo que el backend soporta de verdad | Estado / acción |
|---|---|---|---|
| D1 | ESTADO_PROYECTO afirmaba «SHA-256 local = máquina» en `web_server.py` | **Difieren**: el fichero local ganó +298/−1 líneas HOY 29/10 ~08:29 (durante esta auditoría): un **área profesional completa en backend** (`/profesional`, `/api/profesional/*` con clave del negocio y sesiones de 8 h, proxies autenticados a la agenda) que **no está desplegada** (en la máquina esas rutas no existen: 404 / «ruta no encontrada»), **no tiene página** (`profesional.html` no existe ni en local ni en la máquina) y **no estaba documentada** en ESTADO_PROYECTO.md | CONSTRUIDO EN LOCAL, NO DESPLEGADO. Reconciliar ESTADO y decidir despliegue con su página y su QA (prioridad 3 de la Orden Maestra) |
| D2 | «Plataforma para negocios» (registro de módulos, home de plataforma) | La agenda es **mononegocio**: no hay `negocio_id` en el esquema ni en el código (verificado por grep hoy); un solo salón, una sola BD. El aislamiento multinegocio es diseño, no código | PENDIENTE — prioridad 4 (ruta: `negocio_id` + migración aditiva + pruebas de aislamiento) |
| D3 | La profesional gestiona su salón (bandeja, lista de espera, embudo existen) | Esos datos solo son visibles por la API de agenda con token (CLI) o por el futuro área profesional (D1). La app Android v2 no los muestra en su versión actual | PENDIENTE — prioridad 3 |
| D4 | Reserva por WhatsApp como canal estrella | El canal está reparado y probado por autoprueba, pero **ningún mensaje real** lo ha confirmado E2E todavía | PENDIENTE — un mensaje del fundador (bloqueo B3) |
| D5 | «Análisis de cejas con IA» | Es análisis + recomendación textual validada. **No genera la vista previa visual** (Muse Image sin acceso) — la interfaz lo declara; cualquier material que sugiera «antes/después generado» sería falso | BLOQUEADO (B1); mantener el etiquetado honesto |
| D6 | Post-cita con reseña | El mensaje post-cita omite la reseña porque `RESENA_URL` está vacía a propósito: no existe URL de reseñas verificada de Arianna | PENDIENTE — la URL real la aporta el fundador/Arianna (B4) |
| D7 | Token de la API de agenda | Es el **token de demostración**, presente como valor por defecto en el código (agenda y baterías) y **ya publicado en este repositorio desde el primer sync** (no es una filtración nueva: consta en el historial público desde el 28/10). La API escucha solo en local (8081 sin URL pública) y la web lo usa en servidor. Aun así, incumple la regla de la Orden Maestra («nunca publiques credenciales de demostración») en su espíritu | PENDIENTE — rotar el token en la máquina y pasar el código a «solo por entorno, sin literal» (prioridad 4). La historia NO se reescribe sin orden expresa |
| D8 | «Web en vivo» permanente | InstaBox gratuito: la máquina **se pausa a los 30 min** y una visita web ya NO la despierta (verificado de nuevo hoy: hubo que despertarla por API). Máx. 8 h encendida | RIESGO OPERATIVO — mitigación: despertar antes de cada demo/ensayo; a largo plazo, hosting sin pausa (decisión de gasto del fundador) |
| D9 | Disponibilidad siempre actual | Correcto hoy: la disponibilidad se calcula en servidor desde la BD en cada petición (sin caché de huecos; el SW nunca cachea `/api/*`) | VERIFICADO HOY — mantener como invariante |
| D10 | La app de la clienta «es» el producto completo | La superficie profesional (dueña) vive en una app Android desactualizada (D3) y en un backend local sin desplegar (D1): la experiencia profesional es hoy el frente más débil | PENDIENTE — prioridad 3 |

**Auditoría de secretos de esta sincronización (29/10):** grep por
patrones (claves API, tokens, SID de Twilio, `hsurr:` con valor,
teléfonos y emails personales) sobre todo el conjunto a publicar.
Resultado: **ningún secreto real nuevo**. El móvil y el email
personales del fundador existen SOLO en el fichero fuente interno
`RUTA_C_TWILIO.md`; la copia de publicación lleva saneada desde la
auditoría H0.1-A y se ha verificado por grep que **el historial
público no los contiene** (búsqueda sobre el árbol y el historial de
la copia de publicación: 0 coincidencias). `hermes-home/` queda
excluido entero, como siempre (allí vive el token sustituto de
Baseten). No se reescribe historia: no hay nada que purgar.

## (c) Cola de tareas priorizada (orden de la Orden Maestra)

**P1 · Preservar y estabilizar**
1. Reconciliar ESTADO_PROYECTO.md con el hallazgo D1 (hecho en esta
   misma pasada: sección de la auditoría) y fijar la regla «ningún
   cambio local sin registrar en ESTADO el mismo día».
2. Rotar el token de demo de la agenda (D7) en cuanto se toque la
   máquina para otra cosa; hasta entonces, no exponer el 8081.
3. Ensayo general 02/11 con la máquina despertada por API (D8) y
   re-unión al sandbox de Twilio.

**P2 · Experiencia de reservas de cejas E2E**
4. Confirmación E2E de WhatsApp con un mensaje real (B3) — el único
   eslabón no probado de la cadena principal.
5. Configurar `RESENA_URL` cuando exista la URL real (B4) y cerrar el
   post-cita completo.

**P3 · Experiencia de cliente y profesional**
6. Completar el área profesional: crear `profesional.html` sobre el
   backend ya construido (D1), desplegar con clave del negocio en la
   máquina (fichero 600, fuera del repo), QA con clics a 412×915 y
   batería de acceso (sin clave → 401/503, con clave → datos reales).
7. Decidir el destino de la app Android v2: actualizarla a las
   mecánicas actuales o retirarla del relato y dejar la web/PWA +
   área profesional como superficies oficiales.

**P4 · Seguridad, aislamiento multinegocio y calidad**
8. Multinegocio real (D2): `negocio_id` en citas/lista_espera/eventos/
   bandeja con migración aditiva, filtro obligatorio en API/MCP y
   batería de aislamiento (un negocio no ve ni toca datos de otro).
9. Código sin literales de credencial (D7): token solo por entorno;
   baterías leen el token del entorno.
10. Pruebas nuevas que pide la Orden Maestra y hoy no existen:
    registro/acceso del área profesional, doble reserva concurrente
    (dos POST simultáneos al mismo hueco), idempotencia de webhooks
    repetidos, escritorio (la QA actual es solo móvil 412×915).

**P5 · IA y probador con resultados reales**
11. Primera generación FASHN real cuando exista la clave de Baseten
    con permisos de despliegue (B2): despliegue (1 comando) + tanda
    E2E con las imágenes oficiales ya preparadas; registrar calidad,
    latencia y coste reales antes de cualquier afirmación.
12. Benchmark de Muse Image/SAM cuando exista la clave de Meta (B1),
    contra el diseño ya escrito en `BENCHMARK_H1.md` (~0,86 $).

**P6 · Escalabilidad medida**
13. Medir antes de afirmar: prueba de carga ligera sobre
    disponibilidad/reserva en la máquina actual y registro de
    latencias p50/p95; techo honesto documentado. Sin microservicios
    ni colas hasta que una medición lo pida.

**P7 · Documentación y entrega**
14. Vídeo demo de 3 min (guion en `GUION_DEMO.md`) tras el ensayo del
    02/11; entrega 04/11 21:00 ET. Encuadre de la candidatura según la
    confrontación con ChatGPT (pendiente de que el fundador la traiga).

## (d) Riesgos y bloqueos, con su desbloqueo exacto

| # | Bloqueo | Desbloqueo exacto | De quién |
|---|---|---|---|
| B1 | Sin acceso a Muse Image / SAM 3.1 (Meta Model API) | Abrir dev.meta.ai → Billing, confirmar si el crédito de 150 $ está aplicado y crear la API key de equipo guardándola en la bóveda (nunca en el chat) | Fundador |
| B2 | FASHN sin desplegar: la clave de Baseten es solo de inferencia (403 PERMISSION_DENIED al crear despliegues; coste del intento: 0 $) | Crear en la consola de Baseten (Settings → API Keys) una clave con permisos de despliegue y guardarla como la actual. Si la consola exigiera tarjeta para despliegues, es gasto nuevo: OK expreso previo | Fundador |
| B3 | WhatsApp sin confirmar con tráfico real | Un mensaje real («Hola») al número del sandbox de Twilio; la sesión Hermes del fundador está caliente (turnos de 3–5 s) | Fundador |
| B4 | Post-cita sin línea de reseña | Aportar la URL real de reseñas de Ari Vivas Beauty; se configura por entorno `RESENA_URL` en la API | Fundador/Arianna |
| B5 | WhatsApp directo de Meta bloqueado (límite de portfolios + bloqueo temporal de permisos de la cuenta) | No reintentar clics (agrava el bloqueo). La ruta Twilio cubre la demo; reevaluar tras el hackathon | Meta |
| B6 | Pausa de InstaBox a los 30 min (D8) | Hoy: despertar por API antes de cada uso público. Estructural: plan sin pausa o hosting propio (gasto) | Fundador (si se quiere estructural) |
| B7 | Token de demo en código e historial público (D7) | Rotación en la máquina + código solo-por-entorno (tarea P4.9). La presencia en el historial ya es un hecho público desde el 28/10; purgarlo exigiría reescribir historia: **no se hace sin orden expresa** | Agente (código) + decisión del fundador (historial) |

---

*Sincronización del repo público asociada a esta auditoría: el nuevo
commit y su SHA se registran en `ESTADO_PROYECTO.md` y en el registro
de sincronización (`~/workspace/la-asistenta-repo.muse-github-
snapshot-sync.json`) al completarse el push. Excluidos de la
publicación, como siempre: `hermes-home/` entero, `*.db`, logs, fotos
de personas, binarios (fotos del salón, iconos PNG, capturas de QA,
fuentes) — omitidos por la mecánica de snapshot (solo texto UTF-8) y
anotados en el README — y los documentos internos de evaluación
(`ESTADO_PARA_CHATGPT.md`, `BENCHMARK_H1.md`, `PLAN_EXPOSICION.md`),
que contienen estrategia y prompts de confrontación no destinados a
los jueces.*
