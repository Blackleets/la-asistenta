> **ESTADO 30/10/2026 (ver §62 de ESTADO_PROYECTO.md):** pasos 0 y 2
> cumplidos y paso 3 (humo) ejecutado por la vía del conector
> `custom.meta-model-api`: credencial verificada (GET /v1/models →
> 200, 9 modelos), formas reales de Muse Image y SAM 3.1 confirmadas
> y ajustadas en el proveedor, benchmark H1 estrategia A ejecutado
> (12 propuestas, veredicto en BENCHMARK_H1.md). **Pendiente SOLO el
> paso 1 en su forma literal**: la bóveda del conector entrega la
> credencial como sustituto canjeable únicamente en peticiones del
> agente (nadie puede leerla en claro), así que el fichero
> `web/meta.env` de la máquina tiene que escribirlo Lee con el valor
> de la clave tecleado por él en la consola de la máquina — un solo
> comando, registrado en §62. Hasta entonces `/api/capacidades`
> sigue en `disponible: false` y la app se comporta como siempre.

# ACTIVACIÓN META — el día de la clave (probador visual de cejas)

> El cableado quedó completo y verificado el **29/10/2026** con un
> stub local (sin clave y sin gasto): proveedor
> `probador/proveedor_meta.py`, interruptor de capacidad en la web,
> paso visual en la pantalla de resultado y guardado del look con la
> imagen generada. Este documento es la receta para encenderlo el
> día que exista la clave de equipo de Meta: minutos y un solo gesto
> por paso. Estado y evidencia: ESTADO_PROYECTO.md §46.

## Qué se enciende exactamente

Sin clave, `GET /api/capacidades` responde
`probador_visual_cejas.disponible = false` y la experiencia de la
clienta es **exactamente** la de siempre (análisis con Spark, aviso
de que no mostramos imágenes falsas, ningún botón nuevo). Con la
clave en su sitio, el mismo trabajo de análisis encadena la edición
con **Muse Image** (estrategia A del benchmark H1) y la clienta ve
su propuesta visual orientativa en la pantalla de resultado, con su
aviso de «aproximación» y la opción de guardarla en *Mis looks*.

## Paso 0 · Precondiciones (solo Lee)

1. En **dev.meta.ai**, con su cuenta del hackathon: confirmar que el
   equipo «La Asistenta» tiene acceso a la Model API y mirar en
   **Billing** si el crédito de 150 $ está aplicado (nadie más puede
   verlo). Si no hay crédito, decidir antes de seguir: uso de pago
   por uso (OK expreso de Lee) o reclamación en los canales del
   hackathon. Sin una de las dos, no hay paso 1.
2. En **API keys**, crear la clave del equipo (se muestra **una
   sola vez**) y guardarla en la **bóveda segura de Muse** con el
   flujo de conexión ya enviado — **nunca pegarla en el chat**.

## Paso 1 · Escribir la clave en la máquina (el único gesto técnico)

La clave vive SOLO en un fichero de entorno dedicado de la máquina
InstaBox, fuera del repo y de los logs:

```bash
# en la máquina, /data/la-asistenta/web/meta.env (permisos 600)
META_MODEL_API_KEY=<la clave, recuperada de la bóveda>
```

```bash
chmod 600 /data/la-asistenta/web/meta.env
```

No hay que reiniciar nada para el interruptor: el servidor lee la
clave en cada petición. Comprobación inmediata, sin gasto:

```bash
curl -s http://127.0.0.1:8090/api/capacidades
# → {"probador_visual_cejas": {"disponible": true, ...}}
python3 /data/la-asistenta/probador/proveedor_meta.py estado
# → {"configurado": true, "fuente_clave": "fichero", ...} (no imprime la clave)
```

## Paso 2 · Confirmar las formas de la API (antes de gastar un céntimo)

Lo único que el cableado dejó marcado «a confirmar» (BENCHMARK_H1.md
§1.2), porque la documentación oficial recopilada no lo fija:

1. **Listado real de modelos** (solo lectura, sin coste):
   ```bash
   python3 /data/la-asistenta/probador/proveedor_meta.py modelos
   ```
   Debe incluir `muse-image-1.0` y `sam-3.1`. Si responde 401, la
   clave no es válida o no es del equipo correcto: se para aquí (la
   web seguirá enseñando el análisis como siempre; el log interno
   registrará `visual_clave_no_valida` si alguien analiza).
2. **Forma de la edición de Muse Image**: contrastar la forma
   provisional de `proveedor_meta.editar_cejas()` (superficie
   Responses: `input_text` + `input_image` como data URI) con los
   quickstarts oficiales de ai.developer.meta.com. Si difiere, se
   ajusta **solo esa función** y se repite la batería del probador
   (`python3 -m unittest probador.test_proveedor_meta`).
3. **Invocación de SAM 3.1**: la documentada es un protocolo de
   streaming con las librerías oficiales
   (github.com/meta-models/meta-sam). La forma REST de
   `proveedor_meta.segmentar()` es provisional: si se confirma la
   vía de streaming, se sustituye esa función por el cliente
   oficial. El resto de la fontanería no se toca en ningún caso.

## Paso 3 · Humo con la foto de ejemplo (coste ≈ 0,01 $)

Con la foto de stock autorizada (`web/ejemplo.jpg`), nunca con una
foto de clienta:

1. Abrir la app → Probador de cejas → consentimiento: ahora debe
   verse el párrafo que cuenta que la foto también va a Meta para
   la propuesta visual.
2. Analizar con la foto de ejemplo → el resultado debe traer la
   **propuesta visual** generada (tarjeta «PROPUESTA VISUAL ·
   ORIENTATIVA») y el aviso nuevo.
3. Guardar el look → en Perfil → *Mis looks* debe aparecer con la
   miniatura de la imagen generada.
4. Mirar el log de la web: evento `visual_ok` con la latencia real
   de Muse Image (la primera medición verdadera; no estaba
   documentada).

Si algo falla: el análisis se sigue entregando igual y el log dice
qué pasó (`visual_clave_no_valida`, `visual_error`). Apagar es
trivial: borrar o vaciar `web/meta.env` y la capacidad desaparece
en la siguiente petición.

## Paso 4 · Benchmark H1 (el mismo día o el siguiente)

Con el acceso ya probado, se corre el benchmark diseñado en
BENCHMARK_H1.md:

- **Set**: las 8 fotos autorizadas de §3.1. Ojo a lo que falta HOY:
  IMG-02…IMG-06 están **por descargar** de Pexels (registrando ID y
  licencia) e IMG-07/IMG-08 exigen **consentimiento escrito** de
  Arianna/voluntario con la plantilla de §3.6. Sin eso, el set no
  está congelado y el benchmark no empieza.
- **Estrategias**: A (edición directa — es la que el flujo de
  producción usa al encender), B (SAM + edición) y C (híbrida con
  juez Spark), 2 propuestas por imagen y estrategia = 48.
- **Coste estimado: ≈ 0,86 $** con los precios oficiales (presupuesto
  con margen: 2 $; tope duro de llamadas fijado antes de empezar,
  §3.5 paso 3 del benchmark). Si el crédito de 150 $ existe, el
  coste es irrelevante; el bloqueo era de acceso, no de dinero.
- **Puntuación ciega** de Arianna (voto decisivo) + segunda jueza,
  con las rúbricas de §3.4 y los criterios de aceptación de §3.6.
- **Decisión**: la estrategia ganadora es la que queda en
  producción. Si gana B o C, el cambio es interno
  (`ejecutar_analisis` encadena `segmentar()` antes de
  `editar_cejas()`); la interfaz y el interruptor no cambian.

## Paso 5 · Cierre

- Registrar en ESTADO_PROYECTO.md: fecha de activación, resultado
  del listado de modelos, latencias reales medidas, estrategia
  elegida por el benchmark y coste real total.
- Actualizar el repo público en la siguiente sync autorizada (el
  cableado ya va en la nota de sync de la §46).
- La clave **no** se rota ni se mueve de `web/meta.env` salvo
  incidente; si un día se revoca en dev.meta.ai, la web vuelve sola
  al comportamiento de siempre en cuanto el fichero se vacíe.
