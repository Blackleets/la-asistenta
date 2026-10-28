# Suplemento lunes 26/10 — WhatsApp Cloud en Hermes: 4 trampas que el PLAN_WHATSAPP.md no listaba

Complemento a `PLAN_WHATSAPP.md` (24/10). No lo sustituye: las rutas A/B/C/D siguen valiendo. Esto solo tapa los fallos de configuración que harían que H3 pareciera roto aunque la ruta A esté bien elegida.

Fuente: guía oficial de Hermes Agent para WhatsApp Business Cloud API
(https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud),
verificada por búsqueda el 24/10/2026. El wizard `hermes whatsapp-cloud` valida
cada dato al introducirlo: si algo de abajo falla, el wizard lo dirá el lunes.

## 1. El token temporal muere a las 24 horas — usa token permanente desde el día 1
- El token que Meta genera en WhatsApp → API Setup empieza por `EAA` y dura **24 h**.
  Si se crea el lunes con ese token, el martes el canal está muerto y parecerá un
  fallo de Hermes. No es un fallo: es la caducidad.
- Para producción (y para que el canal sobreviva toda la semana del hackathon):
  business.facebook.com → Settings → System users → Add (`hermes-bot`, rol Admin)
  → Assign Assets: app (Manage app) + cuenta de WhatsApp (Manage WhatsApp Business
  Accounts) → Generate token con permisos `business_management`,
  `whatsapp_business_messaging`, `whatsapp_business_management` → expiración **Never**.
- Guardar ese token en `WHATSAPP_CLOUD_ACCESS_TOKEN` en `~/.hermes/.env` y
  reiniciar el gateway. Sin este paso, hay que regenerar el token cada día.

## 2. Sin App Secret, los mensajes entrantes se rechazan (503)
- App Secret: App Dashboard → Settings → Basic → Show junto a App secret
  (32 caracteres hex en minúsculas). Sirve para verificar la firma del webhook.
- Sin él, Hermes rechaza la entrega entrante. Si el lunes el bot "no responde
  a nada" pero Meta dice que envió el mensaje, este es el primer sitio a mirar.

## 3. Phone Number ID NO es el número de teléfono (el error nº 1 según la guía)
- Phone Number ID: App Dashboard → WhatsApp → API Setup, debajo del desplegable
  "From". Numérico, 15–17 dígitos. **No pegar el número de teléfono real aquí.**
- El número de prueba de Meta sigue limitado a 5 destinatarios verificados
  (Lee, Arianna + 3 de reserva), como ya dice el plan.

## 4. El webhook necesita una URL pública HTTPS + suscripción a `messages`
- Hermes necesita una ruta pública al gateway (opciones habituales: Cloudflare
  Tunnel o ngrok) y que el webhook de Meta esté suscrito al campo `messages`.
- El plan decía "configurar webhook público" en general; esto lo concreta:
  sin túnel/URL pública no hay mensajes entrantes, aunque todo lo demás esté bien.

## Prueba H3 del lunes (criterio de paso, sin ambigüedad)
1. Lee, desde su móvil autorizado, manda por WhatsApp al número de prueba:
   texto + nota de voz + selfie.
2. Pasa si: llega respuesta en el mismo hilo, la vista previa se devuelve como
   imagen, y al confirmar hora la reserva **aparece en el panel de Arianna**.
3. Falla si: solo funciona el texto, o la reserva no aparece en el panel.
   En ese caso, orden de diagnóstico: (a) token caducado, (b) App Secret,
   (c) Phone Number ID, (d) webhook/túnel — en ese orden, no tocando el resto.

## Nota de fecha (para no confundir el final)
- Ventana de construcción: 26/10 → 04/11. El 09/11 es la final/anuncio de
  ganadores, no el plazo de entrega. Según varias guías secundarias concordantes,
  la entrega cierra el 04/11 a las 21:00 ET, es decir, **05/11 a las 03:00 en
  Madrid** (tras el cambio de hora del domingo 25/10). A confirmar el lunes
  en las reglas oficiales del hackathon; no planificar entregas para el 09/11.
