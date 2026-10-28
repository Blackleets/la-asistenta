# Auditoría de publicación — H0.1-A · LA ASISTENTA

**Fecha:** 27/10/2026 (noche) · **Alcance:** árbol completo de
`~/workspace/la-asistenta/` (~4,4 GB) y preparación de una copia
publicable en `~/workspace/la-asistenta-repo/`.
**Regla aplicada:** ante la duda, excluir. Ningún valor secreto se
reproduce en este informe (solo tipo y ubicación).

## Veredicto

**APTO CON EXCLUSIONES.** La copia de publicación preparada no
contiene ningún secreto real, ningún dato personal real y ninguna
fotografía. El proyecto original **no se ha modificado** (la única
escritura fuera de la copia es este informe). No se ha creado ningún
repositorio remoto ni se ha hecho push de nada.

## 1. Hallazgos (qué hay y dónde)

### Secretos y credenciales

| # | Hallazgo | Ubicación | Tratamiento |
|---|---|---|---|
| S1 | Token sustituto («surrogate») de la bóveda para Baseten, en uso activo, junto a la clave referenciada por nombre `BASETEN_API_KEY` | `hermes-home/.env` | **EXCLUIDO** con todo `hermes-home/` |
| S2 | El mismo tipo de token aparece además dentro de datos de sesión/estado de Hermes (base de estado y volcados de petición de la sesión de pruebas) | `hermes-home/` (ficheros de estado y de sesión) | **EXCLUIDO** con todo `hermes-home/` |
| S3 | El `.env` de WhatsApp **nunca se rellenó**: es byte a byte idéntico a su `.env.example`. Comprobado campo a campo: token de acceso **vacío**, App Secret **vacío**, ID de número **vacío**. El único valor con pinta de token era el verify token de ejemplo (hex de 32) que el propio fichero documenta como «ejemplo generado al azar para enseñar el formato» | `whatsapp/.env` y `whatsapp/.env.example` | El `.env` queda **EXCLUIDO** por norma; en la copia, el ejemplo trae ese valor **sustituido por un placeholder textual** |
| S4 | Keystore de firma de Android | `app/android-manual/debug.keystore` | **EXCLUIDO** el binario. Matiz: es el keystore de *debug* estándar, con la contraseña pública y universal «android», y el propio script de build lo regenera si falta. No es una clave de producción; aun así, fuera |
| S5 | Token de demostración de la API local de agenda: el código usa por defecto un token de desarrollo documentado en el propio código («la-asistenta-dev»), configurable por variable de entorno | `agenda/agenda_api.py`, `app/www/app.js` | **PUBLICABLE con nota**: no es un secreto real (es el valor por defecto de un ejemplo local, impreso en el código y en la documentación). Antes de exponer la API fuera de la máquina local hay que definir un token propio — así lo dice el README y el `.env.example` preparados |
| S6 | Sin claves literales en el código propio: los escaneos de patrones (api key, token, secret, Bearer, claves de GitHub/AWS/OpenAI, claves privadas PEM) sobre `agenda/`, `whatsapp/`, `h2/` y `app/www` devolvieron **cero** credenciales reales | — | — |

### Datos personales

| # | Hallazgo | Ubicación | Tratamiento |
|---|---|---|---|
| D1 | Base de datos de la agenda con 4 citas | `agenda/agenda.db` | **EXCLUIDA**. Las 4 citas son de las sesiones simuladas (nombres de pila de las personas ficticias de prueba — Carmen, Lucía, Marta, Elena — y campo de teléfono sin números reales, longitud 4, valores de prueba). Aun siendo ficticios, una BD no va al repo |
| D2 | Logs del webhook con transcripciones de las conversaciones simuladas y números **de simulación** (patrones tipo 34611111111, etiquetados SIM/SIMULADO en los propios registros) | `whatsapp/logs/` | **EXCLUIDOS** (son logs; y aunque los números son ficticios, no aportan nada públicos) |
| D3 | Teléfono real del usuario, su correo, DNI/NIE: buscados por patrón en todo el código y la documentación propios — **cero apariciones** | — | — |
| D4 | Los informes (`.md`) mencionan números de teléfono de las sesiones de prueba: todos siguen el patrón de simulación (dígitos repetidos) y están etiquetados como simulados en los propios documentos | Informes en la raíz | **PUBLICABLES**: son datos ficticios declarados |
| D5 | `credits-watch-state.json`: estado interno del vigilante de créditos (contiene identificadores de mensajes de correo, sin credenciales) | Raíz | **EXCLUIDO** (bookkeeping interno, sin valor público) |

### Imágenes y binarios

| # | Hallazgo | Ubicación | Tratamiento |
|---|---|---|---|
| I1 | Foto de prueba de una persona (imagen de banco, autorizada para la prueba de visión) | `h2/foto_prueba.jpg` | **EXCLUIDA**. Sin fotos de personas en lo público |
| I2 | Respuestas crudas del modelo sobre esa foto (análisis de sus cejas) y la transcripción de la sesión de visión | `h2/respuesta_*.json`, `h2/respuesta_hermes.txt` | **EXCLUIDAS**. Los resultados ya están resumidos en `H2_PREP.md`, que sí se publica |
| I3 | Capturas de QA de la app (muestran la agenda con los nombres ficticios de prueba) | `app/qa/` | **EXCLUIDAS** de esta primera copia por prudencia (nombres en pantalla). Se pueden regenerar con datos 100% ficticios si se quieren para el README |
| I4 | APK firmado y su firma | `app/dist/` | **EXCLUIDOS** del repo (decisión del mandato; el APK podrá adjuntarse como *release* más adelante) |
| I5 | Binario de terceros cloudflared (40 MB) | `bin/` | **EXCLUIDO** |

### Terceros y estado de ejecución (excluidos en bloque)

- `hermes/` — clon del repo abierto de Nous Research
  (https://github.com/NousResearch/hermes-agent, commit
  `ab094da00f8d492eacc4f9524f938bd9c7c9d9f4`). No se republica código
  de terceros: el README preparado lo referencia por URL y commit.
- `hermes-runtime/` — runtimes de terceros (Python, ffmpeg, node…).
- `hermes-home/` — hogar de ejecución de Hermes: contiene S1/S2,
  bases de estado y de proyectos, sesiones, logs y la personalidad
  (SOUL). Excluido entero; su configuración se publica solo como
  ejemplo (`hermes-config.example.*`).
- `app/toolchain/` y `app/node_modules/` — dependencias y toolchain
  de build (la mayor parte de los ~4,4 GB).
- `app/android/` (scaffold de Capacitor): incluido **excepto**
  `local.properties` (ruta local de la máquina) y las salidas de
  build. Los assets web sincronizados por Capacitor
  (`assets/public/`) se retiraron de la copia: se regeneran con
  `npx cap sync` desde `app/www/`.
- Logs varios (`hermes-setup.log`, `app/*.log`, `npm-install*.log`,
  `build*.log`): sin secretos detectados en el de setup (escaneado),
  excluidos todos por norma.

### Documentación que SÍ entra (con dos notas)

- Todos los informes y planes `.md` de la raíz + `README.md` nuevo +
  `whatsapp/README.md`. Notas de transparencia:
  1. `H0_INFORME.md` cita el **ID de la app de Meta** y el **nombre
     del portfolio comercial** del usuario. El App ID es un
     identificador público por diseño (no una credencial) y el
     nombre del portfolio es el nombre artístico/comercial que el
     propio usuario usa en su cuenta. Se dejan porque el informe es
     suyo, pero queda señalado aquí por si se prefiere tachar esa
     línea antes de publicar.
  2. `HERMES_SETUP.md` y `PRUEBA_H1_HERMES.md` mencionan el
     **prefijo** del mecanismo surrogate («hsurr:…») de forma
     descriptiva, con el valor elidido en los propios documentos. La
     verificación sobre lo que Git incluiría buscó tokens completos
     (prefijo + 20 o más caracteres de token): **ninguno**.

## 2. La copia preparada

`~/workspace/la-asistenta-repo/` — **101 ficheros, ~980 KB** (frente a
~4,4 GB del original). Repositorio git **local** inicializado, rama
`main`, dos commits locales de preparación, árbol limpio. **Sin
remoto y sin push.**

Contenido: `README.md` nuevo (arquitectura, instalación, ejecución,
configuración, pruebas, estado honesto), `LICENSE` (MIT),
`.gitignore` estricto, `.env.example` raíz con valores ficticios para
todos los servicios, `hermes-config.example.env/.yaml`, documentación
de informes, `agenda/` (3 ficheros Python), `whatsapp/` (código +
README + `.env.example`), `h2/` (sonda + resultado de modelos),
`app/` (`www/` completo, scaffold Capacitor sin `local.properties`,
`android-manual/` sin keystore ni intermedios, scripts de build,
`package.json`/`package-lock.json`).

### Verificación ejecutada sobre la copia (lo que Git incluiría)

- `git ls-files`: 101 ficheros; ninguno es `.env` real, `.db`,
  `.log`, keystore ni APK (la única coincidencia por nombre es
  `hermes-config.example.env`, el ejemplo con placeholder).
- Escaneo de patrones de secretos y datos personales sobre **exactamente**
  los ficheros trackeados: cero credenciales, cero teléfonos/correos/DNI
  reales, cero tokens completos.
- El `.gitignore` preparado bloquea además futuros `.env`, `.db`,
  logs, claves, keystores, APKs y la foto de prueba por ruta.

### Lo que NO he podido verificar (honestidad)

- El interior binario de las bases de estado de `hermes-home/` no se
  ha leído registro a registro: la carpeta se excluye entera, así que
  el riesgo para la publicación es nulo, pero la afirmación exacta es
  «contiene al menos el surrogate en `.env` y en datos de sesión
  (confirmado por escaneo de patrones)», no un inventario completo.
- No se ha verificado nada en GitHub (no se ha tocado la cuenta): la
  existencia/disponibilidad del nombre de repo y la publicación quedan
  para el paso siguiente.

## 3. Procedimiento exacto que falta para publicar

1. Decisión del usuario/agente principal: nombre del repositorio
   (sugerencia: `la-asistenta`) y si se tachan o no el App ID y el
   nombre del portfolio en `H0_INFORME.md` (ver nota 1 de §1).
2. `cd ~/workspace/la-asistenta-repo && gh repo create <nombre>
   --public --source=. --remote=origin` (o creación manual en
   github.com con el mismo contenido).
3. `git push -u origin main`.
4. Tras el push, repetir sobre el remoto la comprobación de la lista
   de ficheros visibles (la misma de §2) antes de compartir la URL.
5. Opcional, después: subir el APK como *release* y regenerar
   capturas de la app con datos ficticios para el README.

## 4. Recomendación de saneamiento (por si el principal lo decide)

El surrogate de `hermes-home/.env` **no está comprometido** por esta
auditoría (nunca salió del disco ni entra en la copia), pero ha vivido
en texto plano en el disco y ha aparecido en datos de sesión locales.
Si algún día se comparte cualquier pieza de `hermes-home/`, antes
habría que rotar la credencial de Baseten en la bóveda y re-pedir el
surrogate. Hoy no hace falta ninguna acción: basta con que
`hermes-home/` no se publique nunca, cosa que el `.gitignore` y esta
copia ya garantizan.
