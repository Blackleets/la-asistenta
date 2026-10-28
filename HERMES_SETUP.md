# La Asistenta — Base de Hermes Agent (setup)

**Fecha:** 2026-10-27 · **Estado:** ✅ instalado y verificado, a falta SOLO de la clave de Baseten.

## Qué se instaló

- **Repo oficial:** `NousResearch/hermes-agent` (GitHub), clonado en `~/workspace/la-asistenta/hermes/`
  - Commit: `ab094da00f8d492eacc4f9524f938bd9c7c9d9f4` (2026-10-27, rama `main`, clon `--depth 1`)
  - Versión que reporta el CLI: **Hermes Agent vgit.ab094da (2026.9.24) · stable**
- **Método:** el oficial del repo para trabajar desde un clon: `bash setup-hermes.sh`
  (su gestor «pm» instala todo con hashes verificados contra `uv.lock`):
  - `uv` fijado 0.13.5 (sha256 verificado) en el tool store del proyecto
  - **CPython 3.14.9** gestionado por uv (el proyecto exige 3.14; el Python del sistema es 3.12 y NO sirve: las dependencias llevan marcador `python_version >= '3.14'`)
  - Dependencias Python sincronizadas (`uv sync --frozen`) + herramientas del tool store (ripgrep, Chromium…)
  - Launchers publicados en `~/.local/bin/` (`hermes`, `hermes-acp`) y PATH añadido a `~/.bash_profile`

## Dónde vive cada cosa (todo bajo `~/workspace`, sobrevive al reemplazo de VM)

| Pieza | Ruta |
|---|---|
| Código de Hermes | `~/workspace/la-asistenta/hermes/` |
| Tool store (uv, herramientas) — `HERMES_RUNTIME_DIR` | `~/workspace/la-asistenta/hermes-runtime/` |
| Hogar de Hermes — `HERMES_HOME` (config, .env, sesiones, memoria, skills) | `~/workspace/la-asistenta/hermes-home/` |
| Python 3.14.9 gestionado por uv | `~/.local/share/uv/python/` |
| Log de la instalación | `~/workspace/la-asistenta/hermes-setup.log` |

> El instalador también sincronizó los skills empaquetados a `~/.hermes/skills` (su ruta por defecto); la config que manda para este proyecto es la de `hermes-home/`.

## Verificación (smoke test, sin llamadas a modelos)

```bash
export HERMES_HOME=$HOME/workspace/la-asistenta/hermes-home
hermes --version   # → Hermes Agent vgit.ab094da (2026.9.24) · stable · Python: 3.14.9 · OpenAI SDK: 2.54.0
hermes --help      # → OK (exit 0)
hermes status      # → Model: meta-models/muse-spark-open-1026 · Provider: custom:baseten · Providers: Baseten (Muse Spark Open)
hermes config get model.provider   # → custom:baseten
hermes config get model.default    # → meta-models/muse-spark-open-1026
```

## Configuración de Baseten (ya aplicada, lista para la clave)

Hermes configura endpoints OpenAI-compatibles en `config.yaml`. Se ha usado el mecanismo de
**proveedor personalizado con nombre** (`providers:`), documentado en
https://hermes-agent.nousresearch.com/docs/integrations/providers — ya está escrito en
`~/workspace/la-asistenta/hermes-home/config.yaml`:

```yaml
providers:
  baseten:
    name: Baseten (Muse Spark Open)
    api: https://inference.baseten.co/v1
    key_env: BASETEN_API_KEY
    transport: chat_completions
    default_model: meta-models/muse-spark-open-1026

model:
  default: meta-models/muse-spark-open-1026
  provider: custom:baseten
  supports_vision: true   # las selfies se envían nativamente como image_url (puerta H2)
```

Copias de referencia en la raíz del proyecto: `hermes-config.example.yaml` y `hermes-config.example.env`.

### Dónde va la clave cuando llegue

**Un solo sitio:** `~/workspace/la-asistenta/hermes-home/.env` (permisos 600), variable
`BASETEN_API_KEY`. Ya existe con un placeholder (`PEGA_AQUI_LA_CLAVE_DE_BASETEN`):
cuando Lee entregue la clave desde la bóveda, se sustituye ese valor y no hay que tocar nada más.
La clave NUNCA va en `config.yaml` (solo se referencia con `key_env`) ni en los ficheros `.example`.

## Cómo se arranca

```bash
export HERMES_HOME=$HOME/workspace/la-asistenta/hermes-home
export HERMES_RUNTIME_DIR=$HOME/workspace/la-asistenta/hermes-runtime
hermes            # chat interactivo (TUI)
hermes gateway    # gateway de mensajería (WhatsApp/Telegram/…) — puerta H3, aún sin configurar
# Alternativa dev, dentro del checkout:  cd ~/workspace/la-asistenta/hermes && source ./activate
```

## Qué falta para la primera prueba con Spark (puerta H1: latencia/calidad)

1. **La clave real de Baseten** en `hermes-home/.env` (ver arriba). Sin ella, cualquier llamada dará 401 — esperado.
2. Primera llamada real de un turno por el CLI y medición:
   - latencia al primer token y latencia total de respuesta;
   - calidad en español con un prompt de recepcionista de salón (reservas, precios, tono).
3. Confirmar contra el endpoint de Baseten lo que Hermes necesita para sesiones de agente:
   - que acepta `tool_calls` por `chat_completions` (el agente vive de herramientas);
   - el contexto real del modelo (`GET /v1/models`): Hermes exige ≥ 64k tokens de contexto para sesiones con herramientas.
4. Prueba de visión con una selfie de ejemplo (`supports_vision: true` ya está puesto) — enlaza con la puerta H2.

## Incidencias de la instalación (resueltas, quedan documentadas)

1. **tar no puede cambiar propietarios en esta VM:** el primer intento de `setup-hermes.sh` falló al
   desempaquetar uv (`Cannot change ownership to uid 1001: Operation not permitted` — tar como root
   intenta preservar el dueño del tarball). Solución: repetir con `TAR_OPTIONS=--no-same-owner`.
   Comando exacto que funcionó:
   ```bash
   cd ~/workspace/la-asistenta/hermes
   TAR_OPTIONS=--no-same-owner \
   HERMES_HOME=$HOME/workspace/la-asistenta/hermes-home \
   HERMES_RUNTIME_DIR=$HOME/workspace/la-asistenta/hermes-runtime \
   bash setup-hermes.sh
   ```
2. **Red inestable durante `uv sync`:** decenas de `IncompleteRead` con reintentos automáticos de uv;
   la instalación terminó bien (~11 min) gracias a la caché progresiva. Si un futuro `hermes pm install`
   falla por red, basta reintentar: retoma desde la caché.

## Actualización 2026-10-27 (noche): conexión con Spark RESUELTA — puerta H1 superada

La clave real nunca salió de la bóveda: en `hermes-home/.env` va un **surrogate** `hsurr:…` de la credencial `custom.baseten` (pedido con `dynamic_credential_entry()`), que el egress sustituye por la clave solo hacia `inference.baseten.co`. Funcionó en todos los procesos de Hermes sin necesidad del puente local. Primera conversación completa de La Asistenta ejecutada y documentada en `~/workspace/la-asistenta/PRUEBA_H1_HERMES.md` (4 turnos, cita cerrada, latencias 7,9–9,9 s). La personalidad de recepcionista está en `hermes-home/SOUL.md`; el SOUL por defecto queda en `SOUL.default-hermes.md`.
