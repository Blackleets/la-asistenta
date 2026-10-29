# La Asistenta — «Tu belleza, mejor entendida»

Operadora de IA para salones de belleza: atiende a las clientas por
WhatsApp (texto y foto), recomienda servicios con la carta real del
negocio, y escribe las reservas en una agenda real. La dueña lo ve todo
en su app Android.

Proyecto construido para el **Meta Global AI Developer Hackathon 2026**
(Meta × Cerebral Valley), track Indie Developer. Piloto: un salón real
de Madrid (Ari Vivas Beauty). Todos los datos de clientas que aparecen
en la documentación y las pruebas son **personas ficticias de
simulación** (Carmen, Lucía, Marta, Elena…), generados en sesiones de
prueba locales.

## Estado honesto (29/10/2026 — ver `AUDITORIA_ORDEN_MAESTRA.md`)

| Pieza | Estado |
|---|---|
| Cerebro: Hermes Agent + Muse Spark (Baseten) | ✅ Operativo, conversación completa probada; también DENTRO de la máquina InstaBox |
| Agenda real (SQLite) con herramientas registrar/consultar/cancelar | ✅ Operativa, con guarda anti-solape probada en el propio endpoint de la API (batería 8/8) |
| Receptor de WhatsApp (webhook Cloud API + ruta Twilio) | ✅ Corriendo en InstaBox tras URL pública |
| **Web de la clienta (PWA)** (consentimiento → foto → análisis → reserva) | ✅ Operativa en https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech — baterías web 19/19 · mecánicas 20/20 · QA 43/43 (29/10) |
| **Plataforma modular** (registro `web/modulos.json`) | ✅ Belleza es el único módulo activo; moda/probador, gafas y calzado se muestran como «próximamente» sin fingir funciones. Activación por configuración demostrada en prueba (6/6) |
| Mecánicas de reserva | ✅ Enlace mágico con hash, código AS-XXXX, pack de servicios con total, .ics real, lista de espera, embudo medido, post-cita por wa.me |
| Canal WhatsApp directo de Meta | ⛔ Bloqueado en la cuenta (permiso temporal denegado + límite de portfolios) |
| Canal WhatsApp vía Twilio Sandbox | ✅ Reparado: la respuesta viaja en el TwiML del propio webhook (el trial rechaza el texto libre por API); autoprueba firmada 200 en 4,51 s. Pendiente solo la confirmación con un mensaje real |
| App Android de la dueña (panel) | ⚠️ APK v2 construido y firmado; desactualizada respecto a las mecánicas del 28/10 |
| Análisis de cejas con foto (Spark visión) | ✅ En producción, asíncrono con sondeo (inmune a los picos de latencia de Baseten) |
| Probador virtual (módulo futuro) | 💤 Preparado y dormido por decisión de producto: investigación de modelos en `MODELOS_TRYON.md`, contratos en `probador/INTERFACES.md`, adaptador FASHN construido (lógica 5/5). Ninguna generación ejecutada: el despliegue está bloqueado porque la clave de Baseten es solo de inferencia |
| Vista previa generada (Muse Image) | ⛔ Sin acceso verificado a ningún modelo de imagen (falta la clave de equipo de la Meta Model API) |
| Segmentación (SAM 3.1) | ⛔ Sin ruta de acceso verificada |

> Nota de binarios: por la mecánica de publicación (snapshot de texto),
> este repo no incluye las fotografías del salón, los iconos PNG, las
> fuentes ni las capturas de QA; el código que las sirve y los scripts
> que las generan/verifican sí están (`web/generar_iconos.py`,
> `web/qa*/`).

El estado vivo y detallado está en `ESTADO_PROYECTO.md`; la migración a la
máquina, en `MIGRACION_INSTABOX.md`, y la ruta de Twilio, en
`RUTA_C_TWILIO.md`. La web de la clienta vive en `web/` (servidor stdlib +
página mobile-first) y comparte la MISMA agenda real que el canal de
WhatsApp: una cita hecha en la web se ve en la app de la dueña.

El detalle, con evidencias y límites, está en los informes del repo:
`H0_INFORME.md`, `H3_TECNICO.md`, `PRUEBAS_ROBUSTEZ.md`, `H2_PREP.md`,
`APP_BUILD.md`, `APP_V2.md`, `AUDITORIA_PUBLICACION.md` y la auditoría
de la Orden Maestra en `AUDITORIA_ORDEN_MAESTRA.md` (inventario
verificado, diferencias interfaz↔backend, cola priorizada y bloqueos
con su desbloqueo exacto). La especificación de experiencia medida
está en `ESPEC_REFERENCIA.md`; el diagnóstico del probador, en
`DIAGNOSTICO_PROBADOR.md`.

## Arquitectura

```
Clienta (WhatsApp)
      │  POST HTTPS (payload Cloud API)
      ▼
whatsapp/webhook.py ── receptor propio (Python stdlib, puerto 8080)
      │  un turno por mensaje, sesión por clienta
      ▼
Hermes Agent (Nous Research) ── orquestador
      │  chat completions
      ▼
Muse Spark Open @ Baseten (meta-models/muse-spark-open-1026)
      │  tool calls al confirmar / cancelar
      ▼
agenda/mcp_agenda.py ── servidor MCP propio (stdio)
      ▼
SQLite agenda.db ── LA RESERVA QUEDA ESCRITA AQUÍ
      ▲
agenda/agenda_api.py ── API local (puerto 8081) ── App Android (app/)
```

## Componentes

- **`agenda/`** — la agenda real. `mcp_agenda.py` (herramientas MCP
  para el agente: registrar, consultar y cancelar citas, con
  validación de solapes), `agenda_api.py` (API HTTP local con token
  para la app) y `agenda_cli.py` (visor de consola). La base de datos
  (`agenda.db`) se crea al primer uso y **no** está en el repo.
- **`whatsapp/`** — receptor del webhook de WhatsApp Cloud API:
  verificación GET, firma HMAC de los POST, deduplicación por mensaje
  y sesiones por clienta. `simular.py` permite probar todo el flujo en
  local sin credenciales de Meta, con payloads de la misma forma.
- **`h2/`** — sonda de capacidades de visión/generación:
  `sonda_baseten.py` lista los modelos realmente accesibles con tu
  clave y prueba el análisis de imagen de Spark. Resultado en
  `sonda_modelos.json` y en `H2_PREP.md`. Las fotos de prueba y las
  respuestas crudas del modelo **no** están en el repo.
- **`app/`** — app Android de la dueña (Capacitor sobre `www/`, más la
  vía de build manual en `android-manual/` que produjo el APK cuando
  el sandbox bloqueó a Gradle). Cinco pantallas: Hoy, Agenda, Nueva
  cita, Servicios y Estado.
- **Hermes Agent** — dependencia externa, **no** incluida en este
  repo: es el proyecto abierto de Nous Research
  (<https://github.com/NousResearch/hermes-agent>), usado en el commit
  `ab094da00f8d492eacc4f9524f938bd9c7c9d9f4`. La configuración de
  ejemplo está en `hermes-config.example.yaml` y
  `hermes-config.example.env`; la guía de montaje, en
  `HERMES_SETUP.md`.

## Instalación y ejecución

Requisitos: Python 3.11+ (solo biblioteca estándar para `agenda/` y
`whatsapp/`), una cuenta de Baseten con acceso a Muse Spark Open,
Hermes Agent instalado aparte, y Node 18+ solo si vas a compilar la app.

```bash
# 1. Configuración: copia el ejemplo y rellena TUS valores
cp .env.example .env        # nunca subas este fichero

# 2. Agenda + API local (la BD se crea sola)
python3 agenda/agenda_api.py            # http://127.0.0.1:8081
python3 agenda/agenda_cli.py            # ver las citas

# 3. Webhook de WhatsApp en local
cd whatsapp && cp .env.example .env     # rellena tus valores de Meta
python3 webhook.py                      # http://127.0.0.1:8080/webhook
python3 simular.py                      # prueba completa sin Meta

# 4. Hermes Agent (instalación aparte, ver HERMES_SETUP.md):
#    apunta HERMES_HOME a una carpeta con la config del ejemplo y
#    tu BASETEN_API_KEY en su .env; el webhook lo invoca por turno.

# 5. App Android: interfaz en app/www; build con app/build-apk.sh
#    (Capacitor) o app/android-manual/build-manual.sh (vía manual).
```

Para que Meta entregue mensajes al webhook hace falta exponerlo con
una URL HTTPS pública (túnel o despliegue) y pegar esa URL y el token
de verificación en el panel de la app de Meta. El procedimiento
completo está en `PLAN_WHATSAPP.md` y `H3_TECNICO.md`.

## Configuración

Todas las variables están documentadas, con valores ficticios, en
`.env.example` (raíz), `hermes-config.example.env` y
`whatsapp/.env.example`. Ninguna clave real vive en este repositorio:
las claves residen en un gestor de secretos y en los `.env` locales,
excluidos por `.gitignore`.

## Pruebas ejecutadas

- Conversación completa de reserva por el camino real (webhook →
  Hermes → Spark → agenda), verificada por SQL: `PRUEBA_H1_HERMES.md`.
- Robustez: cancelación con confirmación, rechazo de domingos,
  consulta de precios sin reserva, mensajes fuera de tema y corrección
  del hueco de doble reserva: `PRUEBAS_ROBUSTEZ.md`, `SOLAPE_FIX.md`.
- Análisis de foto con Spark visión (calidad y latencias medidas):
  `H2_PREP.md`.
- App: QA visual de las 5 pantallas a 412×915 y verificación del APK
  (paquete `es.arivivas.asistenta`, firma v2+v3): `APP_V2.md`.

## Privacidad

Las fotografías de clientas se tratan con consentimiento separado, se
usan solo para el análisis y la vista previa, y el diseño prevé el
borrado del original (ver `H2_PREP.md`). Este repositorio no contiene
fotografías, datos reales de clientas ni credenciales; la auditoría
previa a la publicación está en `AUDITORIA_PUBLICACION.md`.

## Licencia

Código propio bajo licencia MIT (ver `LICENSE`). Hermes Agent es un
proyecto de terceros con su propia licencia (Nous Research). Según las
reglas del hackathon, el material entregado no es confidencial y los
organizadores reciben una licencia de uso sobre la entrega.
