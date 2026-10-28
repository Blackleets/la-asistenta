# PLAN WHATSAPP A PRUEBA DE FALLOS — La Asistenta (hackathon Meta, entrega 04/11)
Escrito el 24/10/2026 tras investigación con fuentes (docs Meta/Hermes/Twilio). Objetivo: que el canal funcione el día de la entrega SÍ O SÍ, con capas de respaldo independientes.

## La noticia clave
**Hermes Agent ya trae soporte nativo de WhatsApp Cloud API** (docs oficiales de Nous: hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud), con asistente de configuración (`hermes whatsapp-cloud`), allowlist propia por número y variables de entorno. La capa de canal NO hay que construirla: viene en el harness elegido.

## Capas (de principal a último recurso)

### Ruta A — PRINCIPAL: Meta Cloud API directo + número de prueba
- Al crear la app en Meta for Developers y añadir el producto WhatsApp, Meta asigna un **número de prueba gratuito e inmediato**.
- Límite: solo habla con **hasta 5 números destinatarios verificados** (se añaden en WhatsApp → API Setup → Manage phone number list; cada uno confirma con código).
- Las respuestas dentro de una conversación iniciada por la usuaria **no tienen límite de tier**.
- Suficiente para construir todo el bucle y para la demo (la «clienta» = móvil de Lee; panel = Arianna). Los 5 huecos: Lee, Arianna, 3 de reserva (familiares/testers).
- Aceptación (puerta H3, día 1–2): mensaje real desde el móvil de Lee → entra en Hermes → respuesta → reserva escrita en la agenda publicada de Arianna.

### Ruta B — PRODUCCIÓN (en paralelo desde el lunes 26)
- Registrar un **número real español** en la misma app + **verificación de empresa** en Meta Business (nombre legal, dirección, documento; tiempos típicos 1–3 días laborables según guías de BSP).
- Del 26/10 al 04/11 hay 9 días: margen suficiente si se inicia el primer día.
- Si está aprobada antes de la entrega → la demo se hace con número real (mejor historia). Si no → Ruta A, sin drama.
- El número debe poder recibir SMS/llamada de verificación y NO estar registrado como cuenta WhatsApp personal/Business app (o se borra la cuenta antes; para el piloto real existe además la opción de «coexistencia» app+API sobre el mismo número, a validar entonces).

### Ruta C — RESPALDO INDEPENDIENTE: Twilio WhatsApp Sandbox
- Número compartido de Twilio (+1 415 523 8886) activo **al instante**: cada móvil de prueba manda «join <código>» una vez y queda dentro.
- Otro proveedor de acceso a la misma red: cubre un bloqueo de la cuenta/app de Meta directa.
- Ojo: la unión caduca tras **3 días sin actividad** → re-join en el ensayo del 02/11 y la mañana de la entrega.
- Coste: trial gratuito (100 mensajes WhatsApp en trial); producción Twilio ya presupuestada aparte (~1 €/mes el número ES) — gasto pendiente de OK de Lee como siempre.

### Ruta D — ÚLTIMO RECURSO DECLARADO
- Vídeo de respaldo grabado en el ensayo del 02/11, **etiquetado como respaldo** (regla de honestidad del proyecto). Nunca se presenta como directo.

## Checklist lunes 26/10
**Lee (su cuenta, ~15 min):**
1. Entrar en developers.facebook.com y crear la app (tipo Business) + añadir producto WhatsApp.
2. Añadir su móvil y el de Arianna como destinatarios del número de prueba (confirmar códigos).
3. Iniciar la verificación de empresa si Meta la pide (documentación de autónomo a mano).

**Aragan (con Hermes):**
1. Ejecutar el wizard `hermes whatsapp-cloud`, configurar webhook público y allowlist (solo números de prueba).
2. Primer mensaje ida y vuelta verificado.
3. Conectar la salida con la agenda: una orden de reserva desde WhatsApp crea la fila en Supabase y aparece en el panel de Arianna (= H3 cerrada).

## Riesgos que quedan (honestos)
- La verificación de empresa puede pedir documentos extra o tardar más: por eso la Ruta A no depende de ella.
- El número de prueba muestra un número genérico de Meta, no «Ari Vivas Beauty»: aceptable en demo; el nombre/foto de perfil se pulen en Business Manager cuando exista número real (la revisión de nombre tarda ~24–48 h).
- Nada de librerías no oficiales (whatsapp-web.js/Baileys): riesgo de baneo y en un hackathon de Meta sería descalificante en espíritu. Solo vías oficiales.
