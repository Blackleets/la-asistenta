# Pruebas de robustez — La Asistenta (casos reales)

**Fecha:** 2026-10-27 (noche) · **Vía:** webhook local + simulador de payloads
forma-Meta (`whatsapp/simular.py` con guiones por escenario), sesiones nuevas
por escenario, dry-run (sin credenciales de Meta). **No se tocó
`whatsapp/webhook.py`.**

## Cambios previos a las pruebas

1. **`agenda/mcp_agenda.py` — nueva herramienta `cancelar_cita`** (registrada
   igual que las otras dos; Hermes la descubre: `hermes mcp test agenda` → 3
   herramientas). Localiza la cita por `id` o por `nombre`+`fecha`; la marca
   con estado `cancelada` (el registro **no** se borra). Si ya estaba
   cancelada, responde ok con aviso; si nombre+fecha dan varias citas
   confirmadas, devuelve error pidiendo el id o la hora. Probada también por
   protocolo JSON-RPC directo (error correcto con una cita inexistente).
2. **`hermes-home/SOUL.md`**:
   - Flujo de cancelación: localizar la cita → presentar cuál se va a
     cancelar → solo tras el «sí» de la clienta llamar a `cancelar_cita` →
     confirmar solo tras el ok de la herramienta.
   - Horario explícito y firme (L–V 10:00–20:00 · S 10:00–14:00 · domingos
     cerrado): fuera de horario o en domingo no se registra; se explica el
     horario y se ofrece la alternativa más cercana dentro del horario.

## Resultados por escenario

### (a) Cancelar la cita de Carmen (jue 29/10, 17:30) — ✅ SUPERADO
Sesión nueva (Carmen, 34611111111), 2 turnos:
| Turno | Qué pasó | Latencia Hermes |
|---|---|---|
| 1 | Pide cancelar → La Asistenta localiza la cita, la resume («Diseño de cejas, jueves 29, 17:30») y pide confirmación. **No cancela sin el sí.** | 20,1 s (arranque de sesión) |
| 2 | «Sí, esa misma» → llama a `cancelar_cita` y confirma la cancelación | 14,1 s |

Verificación SQL: la cita id 2 queda con estado **`cancelada`** y el registro
se conserva íntegro (no se borró).

### (b) Cita un domingo (1/11/2026) — ✅ SUPERADO tras 1 corrección
Primera pasada (Lucía, 34622222222):
- Turno 1 (11,1 s): rechaza el domingo explicando el horario y ofrece
  sábado 31/10 11:00 o lunes 2/11 por la mañana. ✔ Nada registrado el domingo.
- ⚠️ **Desviación detectada**: al aceptar Lucía el lunes 10:00 («apúntame…»),
  registró la cita (#3) y la anunció como confirmada **en el mismo mensaje**
  en que presentaba el resumen por primera vez, sin esperar su «sí» a ese
  resumen. La cita quedó bien registrada (dentro de horario), pero se saltó
  el orden resumen → sí → registro que marca el SOUL.
- Turno 3 (6,5 s): el «sí, confirmado» posterior se respondió sin duplicar
  la cita. ✔

**Corrección aplicada a SOUL.md**: el orden queda fijado como invariable
(resumen → sí expreso a ese resumen → registro), y se explicita que un
«apúntame» al pedir la cita **no** sustituye al resumen ni permite anunciar
la confirmación en el mismo mensaje que lo presenta.

Repetición con la corrección (Marta, 34655555555, sesión nueva):
| Turno | Qué pasó | Latencia Hermes |
|---|---|---|
| 1 | Pide domingo → rechazo con horario y dos alternativas | 20,5 s (arranque) |
| 2 | Acepta lunes 10:00 «apúntame…» → presenta el resumen y pregunta «¿Lo dejo así y te lo reservo?». **No registra todavía.** | 10,2 s |
| 3 | «Sí, déjalo así» → registra (cita #4), cita el número y confirma | 16,2 s |

Verificación SQL: domingo 2026-11-01 sigue con **0 citas**; la cita de Marta
(2/11 10:00) existe solo tras su confirmación. Flujo correcto. ✔

### (c) Solo precios, sin reservar — ✅ SUPERADO
(María, 34633333333) 2 turnos, latencias 7,3 s y 5,9 s. Respondió con los
precios reales exactos (laminación 45 € · 65 min; depilación rápida
«a consultar» · 12 min), sin presión comercial y **sin registrar nada**:
agenda.db sin cambios tras el escenario.

### (d) Mensaje confuso / fuera de tema — ✅ SUPERADO con una observación
(Sofía, 34644444444) 2 turnos, latencias 8,9 s y 12,3 s:
- Turno 1 (pregunta por la lluvia): respondió amable y se identificó, pero
  **se ofreció a «mirar el parte»** — promesa de consulta que no debe hacer.
  No inventó ningún dato y no registró nada.
- Turno 2 (confuso + «¿hacéis uñas?»): reconducción perfecta — catálogo real
  con precios, honestidad («uñas no hacemos, solo cejas y depilación
  rápida») y pregunta de recomendación. Sin registrar nada.

**Corrección aplicada a SOUL.md**: ante temas ajenos al salón, frase breve y
amable **sin prometer consultas ni datos que no tenga**, y reconducir a
cejas/citas. (No se repitió el escenario (d) por esta observación menor; la
repetición exigida por el encargo se hizo sobre el escenario corregido (b).)

## Estado final de agenda.db (verificado con SQL)

| id | Nombre | Servicio | Fecha | Hora | Estado | Origen |
|---|---|---|---|---|---|---|
| 2 | Carmen | Diseño de cejas | 2026-10-29 | 17:30 | **cancelada** | demo H3 → cancelada en (a) |
| 3 | Lucía | Laminación de cejas | 2026-11-02 | 10:00 | confirmada | escenario (b), 1ª pasada |
| 4 | Marta | Laminación de cejas | 2026-11-02 | 10:00 | confirmada | escenario (b), repetición |

## Limitaciones detectadas (sin maquillar)

1. **Doble reserva a la misma hora**: las citas #3 y #4 coinciden (lunes
   2/11, 10:00, laminación 65 min) y La Asistenta no detectó el solape: el
   SOUL permite usar `consultar_citas` «si duda», pero no le obliga a
   comprobar hueco antes de confirmar. Endurecimiento pendiente si se
   quiere agenda estricta (comprobación obligatoria + duración).
2. **Latencias**: primer turno de sesión nueva ~20 s (arranque de Hermes +
   MCP); turnos con herramienta 14–16 s; conversación simple 6–12 s.
   Asumible en WhatsApp, pero es el número a vigilar con el canal real.
3. La corrección del escenario (d) quedó aplicada pero **no re-probada** en
   esta sesión.
