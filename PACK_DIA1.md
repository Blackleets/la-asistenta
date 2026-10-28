# PACK DÍA 1 — La Asistenta · Hackathon de Meta
**Hoy: lunes 26/10/2026.** Objetivo del día: canal de WhatsApp vivo y puertas H1/H2/H3 en marcha.

## Línea de tiempo de hoy
- **18:00 CET** — Kickoff del hackathon (remoto). Aragan lo sigue y te lo resume en español.
- **Tarde** — Tu checklist de WhatsApp (15 min, abajo) + aceptar reglas en Cerebral Valley y entrar al Discord del evento.
- **Noche** — Wizard de Hermes/WhatsApp con Aragan y primer mensaje ida y vuelta.
- El evento corre hasta el **04/11 a las 21:00 ET** (= 05/11 03:00 en Madrid). Ganadores: 09/11.

## Lo tuyo, Lee (~15 min, solo tú puedes hacerlo: es tu cuenta)
1. Entra en **developers.facebook.com** y crea la app (tipo **Business**) + añade el producto **WhatsApp**.
2. En WhatsApp → API Setup, añade como **destinatarios de prueba** tu móvil y el de Arianna (cada uno confirma con el código que le llega). El número de prueba de Meta admite hasta 5.
3. **Inicia la verificación de empresa** si Meta la pide (documentación de autónomo a mano); tarda 1–3 días laborables y no bloquea la ruta de prueba.
4. Acepta las reglas del hackathon en **Cerebral Valley** y entra al **Discord** del evento.

Ojo a las 4 trampas del día 1 (detalle en `CHECKLIST_LUNES_WHATSAPP.md`):
- El token temporal de Meta **caduca en 24 h** → hoy mismo se genera el **token permanente** (System User, caducidad Never).
- Sin **App Secret**, los mensajes entrantes se rechazan (503).
- El **Phone Number ID** (15–17 dígitos) NO es el número de teléfono.
- El webhook necesita **URL pública HTTPS** y suscripción al campo `messages`.

## Lo mío, Aragan
- Seguir el kickoff y resumírtelo en español (reglas, entregables, fechas exactas).
- Reclamar las claves de **Meta Model API** y los créditos de partners: **Baseten 100 $ · Modal 100 $ · Fireworks 25 $**.
- Correr el wizard `hermes whatsapp-cloud`: webhook público, allowlist solo con los números de prueba y **token permanente guardado el día 1**.
- Primer mensaje ida y vuelta verificado, y la reserva de prueba escrita en la agenda de Arianna.

## Las 3 puertas (días 1–2)
- **H1 — Spark:** latencia y calidad con fotos reales de cejas (meta: respuesta en menos de ~10 s).
- **H2 — Muse Image:** la vista previa generada tiene que pasar el juicio de **Arianna**.
- **H3 — WhatsApp real:** mensaje desde un móvil externo → respuesta → **reserva visible en la agenda/panel de Arianna**. Criterio de paso en `CHECKLIST_LUNES_WHATSAPP.md` (texto + nota de voz + selfie).

⚠️ **Si H3 no está resuelto el miércoles 28/10 → pivote a EFESTO PROOF.** Sin degradar a Telegram.

## Stack (una línea)
**Hermes Agent** (Nous Research) como orquestador + modelos de **Meta** (Model API): **Spark** (visión), **Muse Image** (vista previa), **SAM 3.1** (segmentación de la zona de cejas) y **Voice Transcribe** (notas de voz).
