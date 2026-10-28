# Ruta C — Twilio WhatsApp Sandbox

**Decisión:** Lee eligió esta ruta el 28/10/2026 después de que el reintento
único de Meta volviera a devolver el bloqueo temporal de permisos.

## Qué se ha construido

El receptor existente `whatsapp/webhook.py` conserva intacta la ruta de Meta
(`POST /webhook`) y añade una ruta independiente para Twilio:

```text
POST /twilio/webhook
```

Flujo:

1. Twilio envía un formulario con `From`, `Body`, `ProfileName` y
   `MessageSid`.
2. El servidor valida `X-Twilio-Signature` cuando están configurados el
   Auth Token y la URL pública exacta.
3. Deduplica por `MessageSid` para que un reintento de Twilio no ejecute dos
   veces el mismo turno.
4. Convierte `whatsapp:+34...` al mismo identificador usado por la sesión de
   Hermes (`wa-<telefono>`), por lo que la conversación y la agenda son las
   mismas que en la ruta de Meta.
5. Twilio impone una espera corta al webhook y Hermes puede tardar más. Por
   eso, con `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` configurados, el
   servidor confirma el webhook de inmediato, procesa en segundo plano y
   envía la respuesta mediante la API de Twilio.
6. Sin credenciales, la ruta devuelve TwiML síncrono solo para pruebas
   locales; ese modo no es el que debe usarse con Twilio real.

Variables añadidas a `whatsapp/.env.example`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`
- `TWILIO_WEBHOOK_PUBLIC_URL`

Las credenciales reales quedan solo en el `.env` local o en la bóveda. No se
pegan en el repo, en documentos ni en chats.

## Prueba local ejecutada (28/10/2026)

Servidor aislado con un Hermes falso y determinista:

- `GET /salud` → 200.
- POST Twilio con firma válida → 200 `text/xml`, respuesta TwiML correcta.
- Caracteres XML especiales escapados correctamente (`<` y `&`).
- Segundo POST con el mismo `MessageSid` → `<Response/>`, sin segunda
  llamada a Hermes.
- Firma incorrecta → 403 y ninguna llamada a Hermes.

La prueba no llamó a Twilio ni consumió mensajes del Sandbox.

## Cuenta y Sandbox (28/10/2026, verificado en consola)

- Cuenta Twilio creada a nombre del fundador, con correo
  verificado y 2FA por SMS a su móvil actual. Sin tarjeta.
  Tipo: «My First Twilio Account», **prueba limitada de 30 días**.
- La vía «Sign up with Google» se abandonó: el SMS de Google iba al número
  antiguo perdido (terminado en 59). El alta se hizo con el formulario de
  correo y la contraseña guardada en la bóveda.
- **Número del WhatsApp Sandbox de esta cuenta: +49 15888 620339**
  (no es el +1 415 523 8886 genérico de la documentación antigua).
- **Código de unión de esta cuenta: `join twilio-trial`**
- Pendiente de localizar en la consola clásica: el campo
  «When a message comes in» donde se pegará la URL del webhook. La consola
  nueva no lo muestra; la clásica exige aprobar de nuevo el inicio de
  sesión con la tarjeta de credenciales.

## Qué falta para la prueba real

1. **URL pública HTTPS.** El webhook local debe ser alcanzable por Twilio.
   Sigue pendiente el alta gratuita de ngrok de Lee y su authtoken por el
   canal seguro; después se fijará una URL de la forma:
   `https://<dominio-ngrok>/twilio/webhook`.
2. **Campo del webhook.** Localizar «When a message comes in» en la consola
   clásica y pegar ahí la URL pública (cuando exista).
3. **Unión de móviles.** Lee envía `join twilio-trial` al número del
   Sandbox `+49 15888 620339` desde su WhatsApp. Arianna solo si se quiere
   probar también su móvil.
4. **Credenciales en el `.env` local.** Account SID y Auth Token se copian
   desde la consola al `.env` local de `whatsapp/` por el canal seguro
   (nunca al repo ni al chat): sin ellos el servidor no puede enviar las
   respuestas por la API de Twilio.
5. **Verificación extremo a extremo.** Mensaje real de Lee → respuesta de La
   Asistenta → reserva de prueba escrita en `agenda/agenda.db` y comprobada
   por SQL.

## Límites honestos

- El Sandbox usa un número compartido de Twilio, no un número propio del
  salón.
- La unión de cada móvil caduca tras 3 días sin actividad: habrá que
  repetir el `join ...` en el ensayo del 02/11 y la mañana de la entrega.
- Esta ruta esquiva el bloqueo actual de la cuenta/app de Meta directa,
  pero no sustituye una futura ruta de producción con número propio.
