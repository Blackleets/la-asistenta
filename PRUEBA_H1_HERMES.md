# Prueba H1 — Hermes Agent ↔ Muse Spark (Baseten): primera conversación de La Asistenta

**Fecha:** 2026-10-27 (noche) · **Resultado: ✅ SUPERADA** — Hermes conversa con Spark sin ver nunca la clave real, y la conversación de prueba de La Asistenta cierra una cita completa.

## Cómo se conectó (vía 1: surrogate directo — funcionó, sin puente)

1. Se pidió a authd el surrogate de la credencial `custom.baseten` con `dynamic_credential_entry()` de `dynamic_credentials.py`. El valor devuelto es un token `hsurr:…` (38 caracteres, placement `bearer_header`). **No es la clave real**: es un comodín que Sentinel/authd sustituye por la clave verdadera solo en el egress aprobado hacia `inference.baseten.co`.
2. Ese surrogate se escribió como `BASETEN_API_KEY` en `~/workspace/la-asistenta/hermes-home/.env` (el sitio que la config ya reservaba con `key_env`). `config.yaml` no se tocó: proveedor `custom:baseten` → `https://inference.baseten.co/v1`, modelo `meta-models/muse-spark-open-1026`.
3. Hermes (procesos separados, con su propia pila HTTP/OpenAI SDK) llamó a Baseten con `Authorization: Bearer hsurr:…` y el intercambio en el egress funcionó igual que con el helper verificado: respuestas 200 en todas las llamadas.

**El puente local (vía 2) NO hizo falta.** Queda como plan B documentado: si algún día el surrogate caduca a mitad de operación, un puente que pida un surrogate fresco por petición lo resuelve sin tocar la clave.

### Caveats honestos

- **Vida del surrogate:** se pidió una sola vez y funcionó en 5 procesos Hermes distintos a lo largo de toda la sesión de pruebas (test «listo» + 4 turnos). No consta su TTL exacto: si en el futuro Hermes devuelve 401, la reparación es volver a pedir el surrogate y reescribir el `.env` (un comando), o pasar al puente del plan B.
- En el `.env` hay hoy un **surrogate, no la clave**. La clave real sigue solo en la bóveda de Muse; nadie la ha leído ni copiado.
- Hermes registra `estimated_cost_usd = 0.0` porque no tiene tabla de precios de este modelo: el coste real se descuenta de los 100 $ de crédito de Baseten y se controla allí (tarifa del hackathon: ~2 céntimos por conversación completa estimada).

## Prueba de humo previa

`hermes chat -q "Responde únicamente con esta palabra: listo" --oneshot` → respondió **«listo»** (sesión `local-0210559d…`). Primera evidencia de que el intercambio del surrogate funciona también desde Hermes.

## La conversación de prueba (sesión `local-5214dd9dcfee2f3f9fc3e637bbd2632a8e680aee163ed1e8da35e033d5d6b372`)

Para que la prueba fuera de La Asistenta y no del Hermes genérico, se puso la personalidad de recepcionista en `hermes-home/SOUL.md` (servicios y precios reales de Ari Vivas Beauty; el SOUL por defecto de Hermes quedó guardado como `SOUL.default-hermes.md`). Clienta simulada por CLI, sin WhatsApp real (eso es la puerta H3).

| Turno | Quién | Mensaje |
|---|---|---|
| 1 | Clienta | «Hola, buenas tardes» |
| 1 | La Asistenta | «¡Hola! Buenas tardes 😊 Soy La Asistenta de Ari Vivas Beauty ✨ ¿En qué te ayudo hoy? ¿Te apetece que veamos una cita para tus cejitas?» |
| 2 | Clienta | «Quería hacerme las cejas, algo natural pero que se note. ¿Qué me recomiendas y cuánto cuesta?» |
| 2 | La Asistenta | Recomienda **Diseño de cejas — 18 € · 25 min** (natural y definido) y **Ombré Brows con henna — 30 € · 65 min** (más color y definición), precios y duraciones exactos, y pregunta cuál prefiere. |
| 3 | Clienta | «Me quedo con el diseño de cejas. ¿Puedo este jueves por la tarde, sobre las 17:30? Me llamo Carmen.» |
| 3 | La Asistenta | «¡Perfecto Carmen! 🥰 Te anoto el Diseño de cejas para este **jueves 29 de octubre a las 17:30**. Está dentro de nuestro horario sin problema. **Resumen de tu cita: Diseño de cejas, jueves 29 de octubre, 17:30, 18 €, 25 min, a nombre de Carmen.** ¿Te viene bien que te lo deje así confirmado?» |
| 4 | Clienta | «Sí, perfecto, déjalo confirmado. ¡Gracias!» |
| 4 | La Asistenta | «¡Confirmado Carmen! ✅ Te esperamos el jueves 29 a las 17:30 para tu Diseño de cejas (18 € · 25 min). ¡Muchas gracias a ti! Cualquier cosita me escribes por aquí 💖» |

### Latencias por turno (reloj real del comando CLI, incluye arranque de Hermes)

| Turno | Latencia |
|---|---|
| 1 (saludo) | ≈ 9,9 s |
| 2 (recomendación) | 8,6 s |
| 3 (reserva) | 8,8 s |
| 4 (confirmación) | 7,9 s |

Referencia: la llamada directa sin Hermes (helper `spark_chat.py`) midió 7,3 s; el sobrecoste de Hermes es pequeño. Spark **razona siempre**: de los tokens de salida de la sesión, 793 fueron de razonamiento. Para WhatsApp, ~8 s por respuesta es asumible pero es EL número a vigilar en H3.

### Consumo de la sesión (de `hermes-home/state.db`)

- Llamadas a la API: 4 · Modelo: `meta-models/muse-spark-open-1026` · `billing_base_url`: `https://inference.baseten.co/v1`
- Tokens: entrada 13.944 (+ 42.752 leídos de caché — el prompt caching funciona entre turnos), salida 1.115, razonamiento 793.
- El contexto por turno es pesado (~13–14 k tokens de entrada) por el system prompt y las herramientas de Hermes: con caché activa el coste por turno se contiene.

### Calidad (juicio de la prueba)

- Español natural, tono de WhatsApp, mensajes breves. ✅
- Precios y duraciones **exactos**, sin inventar servicios. ✅
- Convierte «este jueves» en la fecha correcta (29/10/2026) y valida el horario (17:30 dentro de L–V 10–20). ✅
- Cierra con resumen estructurado de la cita y pide confirmación antes de darla por cerrada. ✅

## Qué queda después de H1

- **H2:** probar la visión (selfie → Spark) y la vista previa con Muse Image, al juicio de Arianna.
- **H3:** canal WhatsApp real (ruta A del `PLAN_WHATSAPP.md`) + la cita escrita en la agenda/panel visible desde fuera. Sin eso aún no hay reserva «real»: en esta prueba la cita vive solo en la conversación.
- Vigilar la caducidad del surrogate en sesiones largas (ver caveat arriba).
