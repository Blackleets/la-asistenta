# La Asistenta — App Android de Arianna · Informe de construcción

**Fecha:** 2026-10-27 (noche) · **Resultado:** ✅ **hay APK instalable real y verificado**
(`app/dist/la-asistenta.apk`, 21.345 bytes, paquete `es.arivivas.asistenta`),
con las 5 pantallas y la agenda real detrás. Léelo entero: hay un matiz
importante sobre CÓMO se compiló el APK (ver «Elección técnica»).

---

## Elección técnica y por qué (con lo verificado, no con preferencias)

Se intentaron dos vías, en este orden:

### Vía 1 — Capacitor (proyecto creado y sincronizado; build bloqueada por el sandbox)

- Proyecto Capacitor **8.5.3** creado en `app/` (`npx cap init` + `cap add android`),
  `cap sync` **OK**: la web quedó copiada dentro del proyecto Android.
- Toolchain instalada bajo `app/toolchain/` (sobrevive al reemplazo de VM):
  **Temurin JDK 21.0.13**, **Android SDK** (platforms 35 y 36, build-tools
  35.0.0 y 36.0.0, platform-tools) y **Gradle 8.14.3**.
- **La compilación con Gradle es imposible desde mis sesiones en este sandbox**,
  verificado tres veces (wrapper, daemon y `sdkmanager`):
  - El sandbox intercepta los sockets TCP directos entre procesos
    (permiso «other_tcp» en *Deny*). Prueba mínima con dos JVM propias:
    el cliente recibió literalmente el mensaje del sistema —
    *«Other TCP connections is turned off for this assistant… Muse
    settings → Permissions → Direct network protocols → other_tcp»*.
  - Gradle necesita ese socket (cliente ↔ daemon): el daemon arranca,
    nunca recibe el encargo y el cliente muere con
    *«Could not receive a message from the daemon»*.
  - `sdkmanager` y la descarga del wrapper fallan por la misma familia de
    problema (túnel HTTPS de Java); por eso el SDK se montó **a mano con
    curl** desde los zips oficiales de Google (nombres verificados en el
    `repository2-1.xml` oficial).
- **Desbloqueo exacto de esta vía:** Lee abre Muse → Ajustes → Permisos →
  «Direct network protocols» → `other_tcp`: *Ask* (o *Allow*). Después:
  `~/workspace/la-asistenta/app/build-apk.sh` (ya escrito, con todas las
  rutas) y sale el APK de Capacitor en
  `app/android/app/build/outputs/apk/debug/app-debug.apk`.
  En cualquier ordenador normal no hace falta nada de esto.

### Vía 2 — Build manual con WebView (LA QUE PRODUJO EL APK ENTREGADO) ✅

La app no usa **ningún** API nativa (solo `fetch` a la API de la agenda y
`localStorage`), así que el contenedor Capacitor no aportaba nada para estas
5 pantallas. Se compiló el APK con la cadena clásica del SDK, sin Gradle y
sin red, todo con herramientas locales:

`aapt2 compile/link → javac (contra android.jar) → d8 → zipalign → apksigner`

- Contenedor: `app/android-manual/` — `MainActivity` (WebView a pantalla
  completa, JS + DOM storage + acceso entre ficheros activados, enlaces
  externos como `wa.me` salen al navegador), manifiesto (paquete
  `es.arivivas.asistenta`, minSdk 26, targetSdk 35, permiso INTERNET,
  `usesCleartextTraffic` para la API en red local/túnel), icono adaptativo
  propio (fondo verde azulado + anillo y monograma dorados vectoriales).
- La UI dentro del APK es **la misma** `www/` del proyecto Capacitor
  (mismos ficheros, empaquetados como assets — verificado en el listado
  del APK: `assets/index.html`, `assets/styles.css`, `assets/app.js`,
  `classes.dex`).
- Firma: clave debug propia generada en la build; `apksigner verify` →
  **v2 ✅, v3 ✅**. Script reproducible: `app/android-manual/build-manual.sh`.
- Diferencia honesta frente a Capacitor: no hay plugins nativos (no se
  necesitan hoy). El día que hagan falta (notificaciones push, compartir),
  la vía 1 es la buena y el proyecto ya está andamiado y sincronizado.

---

## La API de la agenda (la misma agenda real, sin inventar otra)

`~/workspace/la-asistenta/agenda/agenda_api.py` — Python stdlib, puerto 8081,
lee/escribe **la misma** `agenda/agenda.db` que usa Hermes por MCP.

- Token por cabecera `X-API-Token` (o `Authorization: Bearer`), configurable
  con la variable `AGENDA_API_TOKEN`. Valor por defecto de la demo:
  `la-asistenta-dev` (cambiarlo antes de cualquier uso fuera de la demo).
- Endpoints: `GET /salud` · `GET /servicios` (carta real + horario) ·
  `GET /citas?fecha=YYYY-MM-DD` · `POST /citas` (precio y duración salen de
  la carta, nunca del cliente) · `POST /citas/<id>/cancelar`.
- Arranque: `python3 ~/workspace/la-asistenta/agenda/agenda_api.py`
  (queda escuchando en `0.0.0.0:8081`). ⚠️ Los procesos mueren con cada
  reemplazo de VM: hay que rearrancarla tras cada reinicio del sandbox.

### Prueba con curl (salidas reales de esta sesión)

Lecturas contra la agenda real (puerto 8081) y escrituras contra una
**copia** de la BD (puerto 8082) para no ensuciar la agenda de verdad:

```
GET /salud            → {"ok": true, "servicio": "agenda", "bd": "agenda.db"}
GET /citas (sin token)→ 401
GET /servicios        → carta real: Diseño 18 €/25 · Ombré 30 €/65 ·
                        Lamination 45 €/65 · Depilación «Consultar»/12 + horario
GET /citas?fecha=2026-10-29 → la cita real de Carmen (Diseño de cejas,
                        17:30, 18 €) — en ese momento figuraba «cancelada»
                        por las pruebas de robustez en curso en paralelo.
POST /citas (copia)   → 201 {"id": 4, "nombre": "PRUEBA API (borrar)",
                        "servicio": "Brow Lamination", "fecha": "2026-10-30",
                        "hora": "11:00", "precio_eur": 45.0, "origen": "app", …}
POST /citas/3/cancelar (copia) → 200, estado pasa a "cancelada"
GET tras cancelar (copia)     → la cita creada sigue visible y correcta
```

---

## La app — 5 pantallas, con todo dentro

UI en `app/www/` (HTML/CSS/JS sin frameworks, tipografía Fraunces +
Montserrat, paleta de marca exacta y tarjetas suaves — nada de plantilla
genérica). Todo en español:

1. **Hoy** — citas del día desde la agenda real (hora, clienta, servicio,
   precio, estado, origen WhatsApp/App) + resumen: nº de citas e ingresos
   estimados del día.
2. **Agenda** — selector de día, lista de citas y **cancelar con
   confirmación** (modal) escribiendo en la agenda real vía API.
3. **Nueva cita** — alta manual (nombre, servicio de la carta real,
   fecha, hora, teléfono opcional) guardada en la agenda real.
4. **Servicios** — la carta real con precios/duraciones + tarjeta de horario.
5. **Estado** — La Asistenta «Activa»; canal WhatsApp declarado tal cual:
   **«Pendiente del número de prueba de Meta»**; estado de conexión con la
   agenda en vivo; **ajuste visible de URL de la API y token**, con botón
   «Guardar y comprobar»; y etiqueta de demostración del hackathon al pie.
   Hay además un punto de conexión en la cabecera (verde/rojo).

Datos reales usados (los únicos): Diseño de cejas 18 €/25 min · Ombré Brows
Henna 30 €/65 min · Brow Lamination 45 €/65 min · Depilación rápida
«Consultar»/12 min · Horario L–V 10:00–20:00, S 10:00–14:00.

---

## Estado honesto: construido / probado / pendiente

**Construido y probado ✅**
- API completa contra la agenda real (curl, salidas arriba).
- UI de 5 pantallas; JS validado con `node --check`; lógica atada a la API
  real (mismos endpoints probados por curl).
- APK compilado, firmado (v2/v3) y con badging verificado:
  `package: name='es.arivivas.asistenta' versionCode='1' versionName='1.0'`,
  `minSdkVersion:'26'`, `targetSdkVersion:'35'`, permiso INTERNET.
  Contenido verificado por listado: manifiesto + `classes.dex` + los tres
  ficheros de la UI en `assets/`.

**Construido pero NO probado (lo digo claro)**
- El APK **no se ha instalado en ningún teléfono todavía**: no hay emulador
  ni dispositivo accesible desde el sandbox. La primera instalación la hace
  Lee (pasos abajo) — si algo fallara al abrir, el sospechoso nº 1 sería el
  WebView cargando los assets, y la corrección es rápida recompilando con
  `build-manual.sh`.
- La UI no se ha ejercido en un navegador real desde mi sesión (sin
  navegador disponible para subagentes); se validó por código y por la API.

**Pendiente (con su paso exacto)**
1. **Que el móvil alcance la API.** La app trae por defecto
   `http://127.0.0.1:8081`, que solo sirve si la API corre en el propio
   dispositivo/red del teléfono. Para la demo con el Samsung de Lee:
   exponer la API con un túnel HTTPS (p. ej. `cloudflared tunnel --url
   http://127.0.0.1:8081` o ngrok) y pegar esa URL en la app →
   «Estado» → «URL de la API de la agenda» → Guardar y comprobar.
   (El túnel y la API deben quedar encendidos durante la demo; son
   procesos del sandbox y mueren con el reemplazo de VM.)
2. **APK de Capacitor** (vía 1): desbloquear `other_tcp` (pasos en
   «Elección técnica») y ejecutar `app/build-apk.sh`.
3. **Icono y firma de producción** si algún día se publica: hoy el icono
   es vectorial propio (correcto) y la firma es debug (válida para
   instalar en mano, no para tiendas).

---

## Cómo lo instala Lee en su Samsung (cuando quiera probarla)

1. Pasar `app/dist/la-asistenta.apk` al teléfono (USB, o descargarlo desde
   donde se le comparta el fichero).
2. Abrirlo desde «Mis archivos» → Android pedirá permiso para «instalar
   apps desconocidas» de esa fuente: permitirlo (es nuestra app, firmada
   con nuestra clave debug).
3. Instalar → aparecerá «La Asistenta · Ari Vivas» en el cajón de apps.
4. Abrirla → «Estado» → poner la URL de la API que esté en marcha
   (túnel) y «Guardar y comprobar»: punto verde = está viendo la agenda
   real del salón.

## Mapa de ficheros

| Pieza | Ruta |
|---|---|
| **APK entregado** | `app/dist/la-asistenta.apk` (21.345 B) |
| Build manual (script + fuentes) | `app/android-manual/` (`build-manual.sh`) |
| Proyecto Capacitor (andamiado, sync OK) | `app/` (`build-apk.sh` para cuando se desbloquee Gradle) |
| UI (la misma en ambas vías) | `app/www/` (`index.html`, `styles.css`, `app.js`) |
| API de la agenda | `agenda/agenda_api.py` (puerto 8081) |
| Toolchain durable (JDK 21, SDK, Gradle) | `app/toolchain/` |
